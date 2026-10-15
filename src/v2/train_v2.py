"""v2 ML — 영역 기여도 분석(추가·제거), 알고리즘 비교, SHAP, 연령대별 차이, 신체활동 상호작용.

실행: python src/v2/train_v2.py            (전체, 약 2~3시간 — 절전 해제 권장)
     python src/v2/train_v2.py --quick    (스모크 테스트: CatBoost 반복 축소, 부트스트랩 50회, 캐시 미사용)
산출: outputs/v2/reports/ml_*.csv, outputs/v2/figures/model_v2_*.png, data/processed/v2/model_runs/(캐시)

설계 (decision_log D-29~D-31)
- 특성 집합: base(인구) / base+영역 1개(추가) / full(주 분석 7개 영역) / full−영역 1개(제거) / full+증상근접 / base+증상근접
- CatBoost(주 모델)·LightGBM·로지스틱은 모든 특성 집합에서 학습셋 전체 적합 → 시험셋 1회 평가.
- 알고리즘 비교(5-fold 가구 그룹 CV 포함)는 full, full+증상근접에서 6개 알고리즘 모두.
- 비교는 같은 시험셋의 가구 단위 부트스트랩 ΔAP 95% CI(1차 group_bootstrap_delta 재사용).
"""
from __future__ import annotations

import argparse
import json
import time

import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, roc_auc_score

import common  # noqa: F401
from common import ADDABLE_DOMAINS, DOMAINS, MAIN_DOMAINS, V2_FIG, V2_REPORT, V2_RUNS, load_v2_table
from modeling import ALGO_LABELS, build_model, evaluate, group_bootstrap_delta, group_cv
from preprocess_v2 import FEATURES, domain_features
from utils import INK, INK_MUTED, PALETTE, SEED, setup_matplotlib

DOMAIN_COLORS = dict(zip(DOMAINS, PALETTE))
PA_FEATURES = ["walk_days", "strength_code", "vig_days", "mod_days", "log_met_min"]
AGE_GROUPS = {"19-39": (19, 39), "40-64": (40, 64), "65+": (65, 200)}


def feature_sets() -> dict[str, list[str]]:
    sets = {"base": ["demo"]}
    for d in ADDABLE_DOMAINS:
        sets[f"base+{d}"] = ["demo", d]
    sets["full"] = list(MAIN_DOMAINS)
    for d in MAIN_DOMAINS:
        sets[f"full-{d}"] = [x for x in MAIN_DOMAINS if x != d]
    sets["full+proximal"] = list(DOMAINS)
    sets["base+proximal"] = ["demo", "proximal"]
    return sets


def make_X(df: pd.DataFrame, num: list[str], cat: list[str]) -> pd.DataFrame:
    X = df[num].astype(float).copy()
    for c in cat:
        X[c] = df[c].astype("Int64").astype(str).where(df[c].notna())
    return X


class Runner:
    def __init__(self, train, test, quick: bool):
        self.train, self.test, self.quick = train, test, quick
        self.ytr = train["Y"].astype(int).to_numpy()
        self.yte = test["Y"].astype(int).to_numpy()
        self.models = {}

    def _model(self, algo, num, cat):
        m = build_model(algo, num, cat)
        if self.quick and algo == "catboost":
            m.set_params(iterations=60)
        return m

    def run(self, set_name, domains, algo, cv=False, keep=False):
        tag = f"{set_name}__{algo}" + ("__cv" if cv else "")
        meta_p, pred_p = V2_RUNS / f"{tag}.json", V2_RUNS / f"{tag}_pred.csv"
        if not self.quick and meta_p.exists() and pred_p.exists() and not keep:
            return json.loads(meta_p.read_text(encoding="utf-8")), pd.read_csv(pred_p)["p"].to_numpy()
        num, cat = domain_features(domains)
        Xtr, Xte = make_X(self.train, num, cat), make_X(self.test, num, cat)
        res = {"set": set_name, "domains": "+".join(domains), "algo": algo, "n_features": len(num) + len(cat)}
        if cv:
            aps, aucs = [], []
            for i_tr, i_va in group_cv(5).split(Xtr, self.ytr, self.train["household_key"]):
                m = self._model(algo, num, cat).fit(Xtr.iloc[i_tr], self.ytr[i_tr])
                p = m.predict_proba(Xtr.iloc[i_va])[:, 1]
                aps.append(average_precision_score(self.ytr[i_va], p))
                aucs.append(roc_auc_score(self.ytr[i_va], p))
            res.update(cv_AP_mean=np.mean(aps), cv_AP_sd=np.std(aps, ddof=1),
                       cv_AUC_mean=np.mean(aucs), cv_AUC_sd=np.std(aucs, ddof=1))
        t0 = time.time()
        model = self._model(algo, num, cat).fit(Xtr, self.ytr)
        res["fit_seconds"] = round(time.time() - t0, 1)
        p = model.predict_proba(Xte)[:, 1]
        res.update({f"test_{k}": v for k, v in evaluate(self.yte, p).items()})
        if keep:
            self.models[set_name] = (model, num, cat, Xte)
        if not self.quick:
            V2_RUNS.mkdir(parents=True, exist_ok=True)
            meta_p.write_text(json.dumps(res, ensure_ascii=False, default=float, indent=1), encoding="utf-8")
            pd.DataFrame({"p": p}).to_csv(pred_p, index=False)
        print(f"[{tag:40s}] AP {res['test_AP']:.4f} AUC {res['test_ROC_AUC']:.4f} ({res['fit_seconds']}s)", flush=True)
        return res, p


# ---------------------------------------------------------------------------
# 해석: SHAP, 영역 순열 중요도, 신체활동 상호작용
# ---------------------------------------------------------------------------
def catboost_shap(model, X: pd.DataFrame, cat: list[str], interaction=False):
    from catboost import Pool

    pool = Pool(model._prep(X), cat_features=list(cat))
    kind = "ShapInteractionValues" if interaction else "ShapValues"
    return model.model_.get_feature_importance(pool, type=kind)


def shap_tables(model, num, cat, Xte, test) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    sv = catboost_shap(model, Xte, cat)[:, :-1]
    names = list(Xte.columns)
    meta = FEATURES.set_index("name")
    imp = pd.DataFrame({"feature": names, "mean_abs_shap": np.abs(sv).mean(axis=0)})
    imp["label"] = imp["feature"].map(meta["label"])
    imp["domain"] = imp["feature"].map(meta["domain"])
    imp["modifiable"] = imp["feature"].map(meta["modifiable"])
    # 방향: 수치형은 값과 SHAP의 Spearman 상관, 범주형은 SHAP 평균이 가장 높은/낮은 수준
    direction = []
    for j, f in enumerate(names):
        x = Xte[f]
        if f in num:
            ok = x.notna()
            rho = pd.Series(x[ok].to_numpy()).corr(pd.Series(sv[ok.to_numpy(), j]), method="spearman")
            direction.append(f"값이 클수록 위험 {'↑' if rho > 0 else '↓'} (ρ={rho:+.2f})")
        else:
            g = pd.Series(sv[:, j]).groupby(x.fillna("NA").to_numpy()).mean()
            direction.append(f"위험↑ 수준={g.idxmax()} / 위험↓ 수준={g.idxmin()}")
    imp["direction"] = direction
    imp = imp.sort_values("mean_abs_shap", ascending=False)
    dom = (imp.groupby("domain")["mean_abs_shap"].sum().reindex([d for d in DOMAINS if d in set(imp["domain"])])
           .rename("sum_abs_shap").reset_index())
    dom["share"] = dom["sum_abs_shap"] / dom["sum_abs_shap"].sum()
    # 연령대별 영역 비중
    rows = []
    age = test["age"].to_numpy()
    for g, (lo, hi) in AGE_GROUPS.items():
        m = (age >= lo) & (age <= hi)
        a = pd.Series(np.abs(sv[m]).mean(axis=0), index=names).groupby(meta.loc[names, "domain"].to_numpy()).sum()
        for d, v in a.items():
            rows.append({"age_group": g, "domain": d, "sum_abs_shap": v, "share": v / a.sum()})
    return imp, dom, pd.DataFrame(rows)


def domain_permutation(model, Xte, y, domains, n_repeats=3) -> pd.DataFrame:
    rng = np.random.default_rng(SEED)
    base = average_precision_score(y, model.predict_proba(Xte)[:, 1])
    meta = FEATURES.set_index("name")
    rows = []
    for d in domains:
        cols = [c for c in Xte.columns if meta.loc[c, "domain"] == d]
        drops = []
        for _ in range(n_repeats):
            Xp = Xte.copy()
            idx = rng.permutation(len(Xp))
            Xp[cols] = Xp[cols].iloc[idx].to_numpy()  # 영역 안의 변수들을 한 번에 같은 순서로 섞어 관계 유지
            drops.append(base - average_precision_score(y, model.predict_proba(Xp)[:, 1]))
        rows.append({"domain": d, "AP_drop_mean": np.mean(drops), "AP_drop_sd": np.std(drops, ddof=1)})
    return pd.DataFrame(rows)


def pa_interactions(model, Xte, cat, n=2000) -> pd.DataFrame:
    sample = Xte.sample(n=min(n, len(Xte)), random_state=SEED)
    inter = catboost_shap(model, sample, cat, interaction=True)[:, :-1, :-1]
    strength = np.abs(inter).mean(axis=0)
    names = list(sample.columns)
    meta = FEATURES.set_index("name")
    rows = []
    for pa in PA_FEATURES:
        i = names.index(pa)
        for j, f in enumerate(names):
            if f in PA_FEATURES or f == pa:
                continue
            rows.append({"pa_feature": pa, "partner": f, "partner_label": meta.loc[f, "label"],
                         "partner_domain": meta.loc[f, "domain"], "interaction_strength": strength[i, j] * 2})
    out = pd.DataFrame(rows)
    agg = (out.groupby(["partner", "partner_label", "partner_domain"])["interaction_strength"].sum()
           .reset_index().sort_values("interaction_strength", ascending=False))
    return agg


# ---------------------------------------------------------------------------
# 그림
# ---------------------------------------------------------------------------
def plots(results: pd.DataFrame, deltas: pd.DataFrame, imp, dom_age, age_add, inter, perm, prevalence):
    plt = setup_matplotlib()
    V2_FIG.mkdir(parents=True, exist_ok=True)

    # 1) 알고리즘 비교
    cv = results[results["cv"]]
    sets = ["full", "full+proximal"]
    algos = [a for a in ["dummy", "logistic", "catboost", "random_forest", "lightgbm", "mlp"] if a in set(cv["algo"])]
    fig, axes = plt.subplots(1, 2, figsize=(15, 5.2))
    for ax, metric, title in [(axes[0], "test_AP", "(a) 시험셋 AP"), (axes[1], "test_ROC_AUC", "(b) 시험셋 ROC-AUC")]:
        x = np.arange(len(algos))
        for i, s in enumerate(sets):
            sub = cv[cv["set"] == s].set_index("algo").reindex(algos)
            ax.bar(x + (i - 0.5) * 0.38, sub[metric], 0.38, color=[PALETTE[0], PALETTE[7]][i],
                   label={"full": "주 분석(7개 영역)", "full+proximal": "+ 심리·증상근접"}[s])
        if metric == "test_AP":
            ax.axhline(prevalence, color=INK_MUTED, ls="--", lw=1)
        else:
            ax.axhline(0.5, color=INK_MUTED, ls="--", lw=1)
            ax.set_ylim(0.45, None)
        ax.set_xticks(x, [ALGO_LABELS[a] for a in algos], rotation=15)
        ax.set_title(title, loc="left")
        ax.grid(axis="x", visible=False)
    axes[0].legend(loc="upper left")
    fig.suptitle("알고리즘 비교 — 주 분석 vs 증상근접 포함", x=0.01, ha="left", fontsize=14, fontweight="bold")
    fig.tight_layout()
    fig.savefig(V2_FIG / "model_v2_01_algorithms.png")
    plt.close(fig)

    # 2) 영역 추가·제거 ΔAP (CatBoost CI + LightGBM·로지스틱 점)
    fig, axes = plt.subplots(1, 2, figsize=(15, 5.5))
    for ax, kind, title in [(axes[0], "add", "(a) 인구 블록에 더했을 때의 단독 정보량 (ΔAP vs base)"),
                            (axes[1], "drop", "(b) 전체에서 뺐을 때의 고유 기여 (ΔAP full − 제거)")]:
        d = deltas[deltas["kind"] == kind]
        doms = [x for x in (ADDABLE_DOMAINS if kind == "add" else MAIN_DOMAINS) if x in set(d["domain"])]
        y = np.arange(len(doms))
        cb = d[d["algo"] == "catboost"].set_index("domain").reindex(doms)
        ax.barh(y, cb["dAP"], color=[DOMAIN_COLORS[x] for x in doms], height=0.6, label="CatBoost (95% CI)")
        ax.errorbar(cb["dAP"], y, xerr=[cb["dAP"] - cb["low"], cb["high"] - cb["dAP"]], fmt="none", ecolor="#333",
                    capsize=3)
        for algo, mk in [("lightgbm", "D"), ("logistic", "o")]:
            o = d[d["algo"] == algo].set_index("domain").reindex(doms)
            ax.scatter(o["dAP"], y, marker=mk, color=INK, s=22, zorder=3, label=ALGO_LABELS[algo])
        ax.axvline(0, color=INK_MUTED, lw=1)
        ax.set_yticks(y, [DOMAINS[x] for x in doms])
        ax.invert_yaxis()
        ax.set_title(title, loc="left", fontsize=11)
        ax.grid(axis="y", visible=False)
        ax.legend(fontsize=8, loc="lower right")
    fig.suptitle("영역별 기여도 — 어떤 영역의 정보가 우울 증상 구분에 도움이 되는가", x=0.01, ha="left",
                 fontsize=14, fontweight="bold")
    fig.tight_layout()
    fig.savefig(V2_FIG / "model_v2_02_domain_contribution.png")
    plt.close(fig)

    # 3) SHAP 상위 25 변수
    top = imp.head(25).iloc[::-1]
    fig, ax = plt.subplots(figsize=(11, 9))
    ax.barh(range(len(top)), top["mean_abs_shap"], color=[DOMAIN_COLORS[d] for d in top["domain"]], height=0.7)
    ax.set_yticks(range(len(top)), [f"{l}{' ★' if m else ''}" for l, m in zip(top["label"], top["modifiable"])],
                  fontsize=9)
    handles = [plt.Rectangle((0, 0), 1, 1, color=DOMAIN_COLORS[d]) for d in MAIN_DOMAINS]
    ax.legend(handles, [DOMAINS[d] for d in MAIN_DOMAINS], loc="lower right", title="영역")
    ax.set_xlabel("평균 |SHAP| (로그오즈 기여)")
    ax.grid(axis="y", visible=False)
    ax.set_title("변수별 기여도 상위 25 — CatBoost 주 분석, 시험셋 (★ = 바꿀 수 있는 요인)", loc="left", fontsize=12,
                 fontweight="bold")
    fig.tight_layout()
    fig.savefig(V2_FIG / "model_v2_03_shap_top.png")
    plt.close(fig)

    # 4) 연령대별: 영역 SHAP 비중 + 영역 추가 ΔAP(LightGBM)
    fig, axes = plt.subplots(1, 2, figsize=(15, 5.5))
    ax = axes[0]
    groups = list(AGE_GROUPS)
    left = np.zeros(len(groups))
    for d in MAIN_DOMAINS:
        v = dom_age[dom_age["domain"] == d].set_index("age_group").reindex(groups)["share"].fillna(0).to_numpy() * 100
        ax.barh(groups, v, left=left, color=DOMAIN_COLORS[d], label=DOMAINS[d], height=0.6, edgecolor="white")
        for i, (l, w) in enumerate(zip(left, v)):
            if w >= 6:
                ax.text(l + w / 2, i, f"{w:.0f}%", ha="center", va="center", fontsize=8, color="white")
        left += v
    ax.set_xlabel("영역별 |SHAP| 비중(%)")
    ax.legend(fontsize=7, ncol=4, loc="upper center", bbox_to_anchor=(0.5, -0.12))
    ax.set_title("(a) 연령대별 영역 기여 비중", loc="left")
    ax.grid(False)
    ax = axes[1]
    w = 0.25
    for i, g in enumerate(groups):
        sub = age_add[age_add["age_group"] == g].set_index("domain").reindex(ADDABLE_DOMAINS)
        ax.barh(np.arange(len(ADDABLE_DOMAINS)) + (i - 1) * w, sub["dAP"], w, color=PALETTE[i], label=g)
    ax.set_yticks(np.arange(len(ADDABLE_DOMAINS)), [DOMAINS[d] for d in ADDABLE_DOMAINS])
    ax.invert_yaxis()
    ax.axvline(0, color=INK_MUTED, lw=1)
    ax.legend(title="연령대")
    ax.set_xlabel("ΔAP (인구 + 영역 − 인구, LightGBM)")
    ax.set_title("(b) 연령대별 영역 단독 정보량", loc="left")
    ax.grid(axis="y", visible=False)
    fig.suptitle("연령대에 따라 우울 증상과 관련된 영역이 다른가", x=0.01, ha="left", fontsize=14, fontweight="bold")
    fig.tight_layout()
    fig.savefig(V2_FIG / "model_v2_04_age_groups.png")
    plt.close(fig)

    # 5) 신체활동과 상호작용이 큰 요인
    top = inter.head(15).iloc[::-1]
    fig, ax = plt.subplots(figsize=(10, 6.5))
    ax.barh(range(len(top)), top["interaction_strength"], color=[DOMAIN_COLORS[d] for d in top["partner_domain"]])
    ax.set_yticks(range(len(top)), top["partner_label"], fontsize=9)
    ax.set_xlabel("신체활동 변수 5종과의 평균 |SHAP 상호작용| 합")
    ax.grid(axis="y", visible=False)
    ax.set_title("신체활동과 함께 작동하는 요인 상위 15 (CatBoost SHAP 상호작용, 시험셋 2,000명 표본)", loc="left",
                 fontsize=11, fontweight="bold")
    fig.tight_layout()
    fig.savefig(V2_FIG / "model_v2_05_pa_interactions.png")
    plt.close(fig)

    # 6) 영역 순열 중요도
    fig, ax = plt.subplots(figsize=(9, 4.5))
    p = perm.set_index("domain").reindex(MAIN_DOMAINS)
    ax.barh(range(len(p)), p["AP_drop_mean"], xerr=p["AP_drop_sd"], color=[DOMAIN_COLORS[d] for d in p.index],
            height=0.6, capsize=3)
    ax.set_yticks(range(len(p)), [DOMAINS[d] for d in p.index])
    ax.invert_yaxis()
    ax.set_xlabel("영역 변수를 함께 섞었을 때 AP 감소(3회 평균)")
    ax.grid(axis="y", visible=False)
    ax.set_title("영역 단위 순열 중요도 — CatBoost 주 분석, 시험셋", loc="left", fontsize=12, fontweight="bold")
    fig.tight_layout()
    fig.savefig(V2_FIG / "model_v2_06_domain_permutation.png")
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true")
    args = ap.parse_args()
    df = load_v2_table()
    s = df[df["Y"].notna()]
    train = s[s["split"] == "train"].reset_index(drop=True)
    test = s[s["split"] == "test"].reset_index(drop=True)
    if args.quick:
        train = train.sample(30000, random_state=SEED).reset_index(drop=True)
    print(f"train {len(train):,} / test {len(test):,} / 시험 양성률 {test['Y'].mean():.4f}")
    R = Runner(train, test, args.quick)
    sets = feature_sets()
    n_boot = 50 if args.quick else 1000
    groups = test["household_key"].to_numpy()

    rows, preds = [], {}
    # (1) 알고리즘 비교 (CV 포함)
    cv_algos = ["dummy", "logistic", "lightgbm", "random_forest", "mlp", "catboost"]
    for sname in ["full", "full+proximal"]:
        for algo in cv_algos:
            if args.quick and algo in ("random_forest", "mlp"):
                continue
            res, p = R.run(sname, sets[sname], algo, cv=not args.quick)
            rows.append({**res, "cv": True})
    # (2) 영역 추가·제거 (CatBoost·LightGBM·로지스틱, 시험셋 1회)
    for sname, doms in sets.items():
        for algo in ["catboost", "lightgbm", "logistic"]:
            keep = algo == "catboost" and sname in ("full", "full+proximal")
            res, p = R.run(sname, doms, algo, keep=keep)
            rows.append({**res, "cv": False})
            preds[(sname, algo)] = p
    results = pd.DataFrame(rows)

    # (3) ΔAP: 추가(base+d − base), 제거(full − (full−d)), 증상근접(full+prox − full)
    drows = []
    for algo in ["catboost", "lightgbm", "logistic"]:
        nb = n_boot if algo == "catboost" else 200
        for d in ADDABLE_DOMAINS:
            r = group_bootstrap_delta(R.yte, preds[(f"base+{d}", algo)], preds[("base", algo)], groups, nb)
            drows.append({"kind": "add", "domain": d, "algo": algo, "dAP": r["dAP_vs_M0"], "low": r["dAP_CI_low"],
                          "high": r["dAP_CI_high"], "dAUC": r["dAUC_vs_M0"]})
        for d in MAIN_DOMAINS:
            r = group_bootstrap_delta(R.yte, preds[("full", algo)], preds[(f"full-{d}", algo)], groups, nb)
            drows.append({"kind": "drop", "domain": d, "algo": algo, "dAP": r["dAP_vs_M0"], "low": r["dAP_CI_low"],
                          "high": r["dAP_CI_high"], "dAUC": r["dAUC_vs_M0"]})
        r = group_bootstrap_delta(R.yte, preds[("full+proximal", algo)], preds[("full", algo)], groups, nb)
        drows.append({"kind": "proximal", "domain": "proximal", "algo": algo, "dAP": r["dAP_vs_M0"],
                      "low": r["dAP_CI_low"], "high": r["dAP_CI_high"], "dAUC": r["dAUC_vs_M0"]})
        print(f"[ΔAP] {algo} 완료", flush=True)
    deltas = pd.DataFrame(drows)

    # (4) 해석 — CatBoost full
    model, num, cat, Xte = R.models["full"]
    imp, dom, dom_age = shap_tables(model, num, cat, Xte, test)
    perm = domain_permutation(model, Xte, R.yte, MAIN_DOMAINS)
    inter = pa_interactions(model, Xte, cat, n=500 if args.quick else 2000)
    model_p, num_p, cat_p, Xte_p = R.models["full+proximal"]
    imp_p, dom_p, _ = shap_tables(model_p, num_p, cat_p, Xte_p, test)

    # (5) 연령대별 영역 추가 ΔAP (LightGBM, 연령대 안에서 학습·평가)
    arows = []
    for g, (lo, hi) in AGE_GROUPS.items():
        tr_g = train[train["age"].between(lo, hi)].reset_index(drop=True)
        te_g = test[test["age"].between(lo, hi)].reset_index(drop=True)
        Rg = Runner(tr_g, te_g, quick=True)  # 캐시 없이 직접 계산
        _, pb = Rg.run(f"age{g}_base", sets["base"], "lightgbm")
        for d in ADDABLE_DOMAINS:
            _, pd_ = Rg.run(f"age{g}_base+{d}", sets[f"base+{d}"], "lightgbm")
            r = group_bootstrap_delta(Rg.yte, pd_, pb, te_g["household_key"].to_numpy(), 200)
            arows.append({"age_group": g, "domain": d, "dAP": r["dAP_vs_M0"], "low": r["dAP_CI_low"],
                          "high": r["dAP_CI_high"], "n_test": len(te_g), "prev_test": te_g["Y"].mean()})
    age_add = pd.DataFrame(arows)

    out = V2_REPORT if not args.quick else V2_REPORT / "_quick"
    out.mkdir(parents=True, exist_ok=True)
    results.to_csv(out / "ml_results.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    deltas.to_csv(out / "ml_domain_deltas.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    imp.to_csv(out / "ml_shap_features.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    imp_p.to_csv(out / "ml_shap_features_with_proximal.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    dom.to_csv(out / "ml_shap_domains.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    dom_p.to_csv(out / "ml_shap_domains_with_proximal.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    dom_age.to_csv(out / "ml_shap_domains_by_age.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    perm.to_csv(out / "ml_domain_permutation.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    inter.to_csv(out / "ml_pa_interactions.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    age_add.to_csv(out / "ml_age_domain_add.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    if not args.quick:
        plots(results, deltas, imp, dom_age, age_add, inter, perm, R.yte.mean())

    print("\n[알고리즘 비교]")
    print(results[results["cv"]][["set", "algo", "test_AP", "test_ROC_AUC"]].round(4).to_string(index=False))
    print("\n[영역 ΔAP — CatBoost]")
    print(deltas[deltas["algo"] == "catboost"].round(4).to_string(index=False))
    print("\n[SHAP 상위 15]")
    print(imp.head(15)[["label", "domain", "mean_abs_shap", "direction"]].round(4).to_string(index=False))
    print("\n[SHAP 영역 비중]")
    print(dom.round(3).to_string(index=False))
    print("\n[신체활동 상호작용 상위 10]")
    print(inter.head(10).round(4).to_string(index=False))


if __name__ == "__main__":
    main()
