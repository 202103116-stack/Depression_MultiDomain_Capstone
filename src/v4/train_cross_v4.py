"""v4 단계 C — 생각2: PHQ-9가 아닌 결과로 모델링(교차 결과 예측)과 불균형 처리 비교.

실행: .venv\\Scripts\\python src/v4/train_cross_v4.py   (outcomes_v4.py 실행 후, 약 30분)
산출: outputs/v4/reports/c2_*.csv, data/processed/v4/model_runs/(개인 단위 예측 캐시, 공유 금지)

설계(decision_log D-41·D-42)
- CatBoost(v2 주 모델, 고정 하이퍼파라미터), 주 분석 53개 변수, v2 가구 단위 분할 승계.
- 모델 A = y5(PHQ-9 ≥ 5) 학습, 모델 B = y_mood(우울감 경험) 학습 → 시험셋에서 두 결과 모두로 평가(2×2 교차).
  기존 입력에는 PHQ 문항이 없다(D-25). 교차 예측이 되면 모델이 특정 척도가 아니라 우울 위험을 학습했다는 근거가 된다.
- 불균형 처리: 보정 없음 / 클래스 가중치(auto_class_weights="Balanced") / SMOTE-NC(학습셋에만 적용).
  시험셋은 원래 비율 그대로 두고 AP·ROC-AUC·Brier·보정(O:E, 기울기)으로 판정한다.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

from common_v4 import OUTCOMES, V4_PROCESSED, V4_REPORT, load_v4_table

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "v2"))
from common import MAIN_DOMAINS  # noqa: E402
from modeling import CatBoostModel, evaluate, group_bootstrap_delta  # noqa: E402
from performance_v2 import calibration, group_boot_ci  # noqa: E402
from preprocess_v2 import FEATURES, domain_features  # noqa: E402
from train_v2 import catboost_shap, make_X  # noqa: E402
from utils import SEED  # noqa: E402

RUNS = V4_PROCESSED / "model_runs"
TARGETS = ["y5", "y_mood"]
METHODS = ["none", "balanced", "smotenc"]
METHOD_LABELS = {"none": "보정 없음", "balanced": "클래스 가중치", "smotenc": "SMOTE-NC"}
LABEL = dict(zip(FEATURES["name"], FEATURES["label"])) if "label" in FEATURES else {}


class WeightedCatBoost(CatBoostModel):
    """CatBoostModel + 클래스 가중치·특성 가중치 옵션(생각3에서도 사용)."""

    def __init__(self, cat_features=None, iterations=600, depth=6, learning_rate=0.05, random_state=SEED,
                 auto_class_weights=None, feature_weights=None):
        super().__init__(cat_features, iterations, depth, learning_rate, random_state)
        self.auto_class_weights = auto_class_weights
        self.feature_weights = feature_weights

    def fit(self, X, y):
        from catboost import CatBoostClassifier

        kw = {}
        if self.auto_class_weights:
            kw["auto_class_weights"] = self.auto_class_weights
        if self.feature_weights:
            kw["feature_weights"] = self.feature_weights
        self.model_ = CatBoostClassifier(iterations=self.iterations, depth=self.depth, learning_rate=self.learning_rate,
                                         random_seed=self.random_state, verbose=0, thread_count=-1,
                                         allow_writing_files=False, **kw)
        self.model_.fit(self._prep(X), y, cat_features=list(self.cat_features))
        self.classes_ = np.array([0, 1])
        return self


def smotenc(Xtr: pd.DataFrame, y: np.ndarray, num: list[str], cat: list[str]):
    """SMOTE-NC: 학습셋에서만. 수치형 결측은 학습셋 중앙값, 범주형 결측은 'NA' 범주로 둔 뒤 합성한다."""
    from imblearn.over_sampling import SMOTENC

    X = Xtr.copy()
    med = X[num].median()
    X[num] = X[num].fillna(med)
    codes = {}
    for c in cat:
        s = X[c].fillna("NA").astype(str)
        codes[c] = pd.Index(sorted(s.unique()))
        X[c] = codes[c].get_indexer(s)
    cat_idx = [X.columns.get_loc(c) for c in cat]
    Xs, ys = SMOTENC(categorical_features=cat_idx, random_state=SEED).fit_resample(X.to_numpy(float), y)
    Xs = pd.DataFrame(Xs, columns=X.columns)
    for c in cat:
        Xs[c] = codes[c][Xs[c].round().astype(int).clip(0, len(codes[c]) - 1)].astype(str)
    return Xs, ys


def fit_predict(train, test, num, cat, target, method, tag, feature_weights=None, extra=None):
    """학습셋 적합 → 시험셋 예측(캐시). extra = 학습·시험에 붙일 추가 특성 열 이름(생각3)."""
    pred_p, meta_p = RUNS / f"{tag}_pred.csv", RUNS / f"{tag}.json"
    if pred_p.exists() and meta_p.exists():
        return pd.read_csv(pred_p)["p"].to_numpy(), json.loads(meta_p.read_text(encoding="utf-8")), None
    tr = train[train[target].notna()]
    Xtr, Xte = make_X(tr, num, cat), make_X(test, num, cat)
    for c in extra or []:
        Xtr[c], Xte[c] = tr[c].astype("Int64").astype(str).where(tr[c].notna()), test[c].astype("Int64").astype(str).where(test[c].notna())
    cats = list(cat) + list(extra or [])
    y = tr[target].astype(int).to_numpy()
    t0 = time.time()
    if method == "smotenc":
        Xtr, y = smotenc(Xtr, y, num, cats)
    model = WeightedCatBoost(cat_features=cats, auto_class_weights="Balanced" if method == "balanced" else None,
                             feature_weights=feature_weights).fit(Xtr, y)
    p = model.predict_proba(Xte)[:, 1]
    meta = {"tag": tag, "target": target, "method": method, "n_train": int(len(Xtr)), "train_pos_rate": float(y.mean()),
            "fit_seconds": round(time.time() - t0, 1)}
    RUNS.mkdir(parents=True, exist_ok=True)
    pd.DataFrame({"p": p}).to_csv(pred_p, index=False)
    meta_p.write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"[{tag}] 적합 {meta['fit_seconds']}초", flush=True)
    return p, meta, (model, Xte, cats)


def perf_row(y, p, groups, **tag) -> dict:
    ok = ~np.isnan(y)
    y, p, g = y[ok].astype(int), p[ok], np.asarray(groups)[ok]
    ev = evaluate(y, p)
    (ap_lo, ap_hi), (auc_lo, auc_hi) = group_boot_ci(y, p, g, n_boot=500)
    oe, slope, icpt = calibration(y, p)
    return {**tag, "n": int(len(y)), "prevalence": float(y.mean()), "AP": ev["AP"], "AP_lo": ap_lo, "AP_hi": ap_hi,
            "AP_lift": ev["AP"] / y.mean(), "ROC_AUC": ev["ROC_AUC"], "AUC_lo": auc_lo, "AUC_hi": auc_hi,
            "Brier": ev["Brier"], "OE": oe, "cal_slope": slope, "cal_intercept": icpt,
            "recall_top10": ev["recall@top10%"], "precision_top10": ev["precision@top10%"]}


def main():
    V4_REPORT.mkdir(parents=True, exist_ok=True)
    d = load_v4_table()
    train, test = d[d["split"] == "train"].reset_index(drop=True), d[d["split"] == "test"].reset_index(drop=True)
    num, cat = domain_features(MAIN_DOMAINS)
    print(f"특성 {len(num) + len(cat)}개, 학습 {len(train):,} / 시험 {len(test):,}")
    hh = test["household_key"].to_numpy()

    preds, fitted = {}, {}
    for target in TARGETS:
        for method in METHODS:
            p, meta, fm = fit_predict(train, test, num, cat, target, method, f"{target}__{method}")
            preds[(target, method)] = p
            if fm is not None and method == "none":
                fitted[target] = fm

    # 1) 교차 결과 예측 2×2 (보정 없음)
    rows = []
    for tr_t in TARGETS:
        for ev_t in TARGETS:
            rows.append(perf_row(test[ev_t].to_numpy(float), preds[(tr_t, "none")], hh,
                                 train_target=tr_t, eval_target=ev_t))
    cross = pd.DataFrame(rows)
    # 같은 결과로 평가할 때, 다른 결과로 학습한 모델이 자기 결과 모델 AP의 몇 %를 회복하는가
    for ev_t in TARGETS:
        own = cross.loc[(cross.train_target == ev_t) & (cross.eval_target == ev_t), "AP"].item()
        cross.loc[cross.eval_target == ev_t, "AP_retained_pct"] = 100 * cross.loc[cross.eval_target == ev_t, "AP"] / own
    cross.to_csv(V4_REPORT / "c2_cross_outcome.csv", index=False, encoding="utf-8-sig")
    print(cross[["train_target", "eval_target", "prevalence", "AP", "AP_lo", "AP_hi", "AP_lift", "ROC_AUC", "AP_retained_pct"]].round(4).to_string(index=False))

    # 교차 대응 비교: 다른 결과로 학습한 모델 − 자기 결과 모델 (가구 부트스트랩)
    deltas = []
    for ev_t in TARGETS:
        other = [t for t in TARGETS if t != ev_t][0]
        ok = test[ev_t].notna().to_numpy()
        r = group_bootstrap_delta(test.loc[ok, ev_t].astype(int).to_numpy(), preds[(other, "none")][ok],
                                  preds[(ev_t, "none")][ok], hh[ok], n_boot=500)
        deltas.append({"eval_target": ev_t, "model": f"{other} 학습", "vs": f"{ev_t} 학습", **r})
    pd.DataFrame(deltas).to_csv(V4_REPORT / "c2_cross_delta.csv", index=False, encoding="utf-8-sig")

    # 2) 불균형 처리 비교
    rows = []
    for target in TARGETS:
        y = test[target].to_numpy(float)
        ok = ~np.isnan(y)
        for method in METHODS:
            row = perf_row(y, preds[(target, method)], hh, target=target, method=method, method_label=METHOD_LABELS[method])
            if method != "none":
                r = group_bootstrap_delta(y[ok].astype(int), preds[(target, method)][ok], preds[(target, "none")][ok], hh[ok], n_boot=500)
                row.update(dAP_vs_none=r["dAP_vs_M0"], dAP_lo=r["dAP_CI_low"], dAP_hi=r["dAP_CI_high"])
            rows.append(row)
    imb = pd.DataFrame(rows)
    imb.to_csv(V4_REPORT / "c2_imbalance.csv", index=False, encoding="utf-8-sig")
    print(imb[["target", "method", "AP", "ROC_AUC", "Brier", "OE", "cal_slope", "dAP_vs_none", "dAP_lo", "dAP_hi"]].round(4).to_string(index=False))

    # 3) 두 모델의 SHAP 상위 변수 비교(시험셋)
    shap_rows = []
    for target in TARGETS:
        if target not in fitted:
            print(f"SHAP: {target} 모델 캐시만 있어 건너뜀(캐시 삭제 후 재실행)")
            continue
        model, Xte, cats = fitted[target]
        sv = np.abs(catboost_shap(model, Xte, cats)[:, :-1]).mean(axis=0)
        for f, v in zip(Xte.columns, sv):
            shap_rows.append({"target": target, "feature": f, "label": LABEL.get(f, f), "mean_abs_shap": float(v)})
    if shap_rows:
        sh = pd.DataFrame(shap_rows)
        sh["rank"] = sh.groupby("target")["mean_abs_shap"].rank(ascending=False, method="first").astype(int)
        sh.to_csv(V4_REPORT / "c2_shap.csv", index=False, encoding="utf-8-sig")
        top = {t: set(sh[(sh.target == t) & (sh["rank"] <= 10)].feature) for t in TARGETS if t in set(sh.target)}
        if len(top) == 2:
            inter = top["y5"] & top["y_mood"]
            piv = sh.pivot(index="feature", columns="target", values="mean_abs_shap")
            rho = piv.rank().corr(method="pearson").iloc[0, 1]
            summ = {"top10_overlap": len(inter), "overlap_features": ", ".join(sorted(LABEL.get(f, f) for f in inter)),
                    "spearman_all": float(rho)}
            pd.DataFrame([summ]).to_csv(V4_REPORT / "c2_shap_overlap.csv", index=False, encoding="utf-8-sig")
            print(summ)


if __name__ == "__main__":
    main()
