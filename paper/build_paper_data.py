"""논문용 수치·표 추출 — 분석 산출물(outputs/v2/reports)과 분석 테이블에서 논문에 들어갈 모든 값을 JSON으로 만든다.

실행: .venv/Scripts/python paper/build_paper_data.py
산출: paper/paper_data.json, paper/figures/fig1_flow.png (+ 본문 그림 복사)

원칙: 원고의 숫자는 이 JSON에서만 가져온다(손으로 옮기지 않는다). 개인 단위 값은 담지 않는다.
"""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "src" / "v2"))

from common import DOMAINS, V2_FIG, V2_REPORT, load_v2_table  # noqa: E402
from eda_v2 import LEVEL_LABELS, weighted_quintile  # noqa: E402
from preprocess_v2 import FEATURES, MOD_TYPE_LABELS  # noqa: E402
from utils import INK, PALETTE, setup_matplotlib  # noqa: E402

OUT = ROOT / "paper"
FIG_OUT = OUT / "figures"


def r(x, k=3):
    return None if pd.isna(x) else round(float(x), k)


def table1(s: pd.DataFrame) -> list[dict]:
    """대상자 특성: 전체·Y=0·Y=1별 비가중 n과 가중 %(열 기준) + 결측 수."""
    s = s.copy()
    s["age_grp"] = pd.cut(s["age"], [18, 29, 39, 49, 59, 69, 79, 200],
                          labels=["19~29세", "30~39세", "40~49세", "50~59세", "60~69세", "70~79세", "80세 이상"]).astype(object)
    s["inc_q"] = weighted_quintile(s["log_income_equiv"], s["wt_p"]).map(
        {1: "1분위(하)", 2: "2분위", 3: "3분위", 4: "4분위", 5: "5분위(상)"})
    s["pa_guideline_l"] = s["pa_guideline"].map({1: "충족", 0: "미충족"})
    s["walk_l"] = s["walk_ok"].map({1: "예", 0: "아니오"})
    s["tobacco_free_l"] = s["tobacco_free"].map({1: "예", 0: "아니오"})
    s["social_connected_l"] = s["social_connected"].map({1: "예", 0: "아니오"})
    rows_spec = [
        ("age_grp", "연령", None), ("sex", "성별", LEVEL_LABELS["sex"]), ("educ", "교육수준", LEVEL_LABELS["educ"]),
        ("marital", "혼인상태", LEVEL_LABELS["marital"]), ("inc_q", "균등화 가구소득(가중 5분위)", None),
        ("food_insecurity", "가구 식품안정성", LEVEL_LABELS["food_insecurity"]),
        ("livelihood", "기초생활수급", LEVEL_LABELS["livelihood"]),
        ("chewing", "저작불편", LEVEL_LABELS["chewing"]), ("fall", "연간 낙상 경험", LEVEL_LABELS["fall"]),
        ("unmet_medical", "연간 미충족 의료", LEVEL_LABELS["unmet_medical"]),
        ("pa_guideline_l", "신체활동 권고 충족(유산소+근력)", None),
        ("smoking_status", "흡연 상태", LEVEL_LABELS["smoking_status"]),
        ("tobacco_free_l", "담배제품 현재 미사용", None),
        ("breakfast", "아침식사", LEVEL_LABELS["breakfast"]),
        ("contact_friend", "친구와 연락 빈도", LEVEL_LABELS["contact_friend"]),
        ("social_connected_l", "사회적 연결(고립 지수 0~1)", None),
        ("neighbor_trust", "이웃 간 신뢰", LEVEL_LABELS["neighbor_trust"]),
        ("env_safety", "동네 안전 만족", LEVEL_LABELS["env_safety"]),
    ]
    out = []
    groups = {"all": s, "y0": s[s["Y"] == 0], "y1": s[s["Y"] == 1]}
    for var, name, lab in rows_spec:
        x = s[var] if lab is None else s[var].map(lab)
        order = list(dict.fromkeys(lab.values())) if lab else sorted(x.dropna().unique(), key=str)
        order = [o for o in order if o in set(x.dropna())]
        out.append({"type": "header", "name": name, "missing": int(x.isna().sum())})
        for lv in order:
            row = {"type": "level", "level": str(lv)}
            for g, d in groups.items():
                xg = x.loc[d.index]
                m = xg.notna()
                w = d.loc[m, "wt_p"]
                row[f"{g}_n"] = int((xg == lv).sum())
                row[f"{g}_pct"] = r(w[xg[m] == lv].sum() / w.sum() * 100, 1)
            # 해당 수준의 가중 유병률
            sub = s[x == lv]
            row["prev_w"] = r(np.average(sub["Y"], weights=sub["wt_p"]) * 100, 2)
            out.append(row)
    return out


def flow_figure(n: dict):
    plt = setup_matplotlib()
    fig, ax = plt.subplots(figsize=(9, 7.2))
    ax.axis("off")
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10)

    def box(x, y, w, h, text, color="#f2f1ee"):
        ax.add_patch(plt.Rectangle((x - w / 2, y - h / 2), w, h, facecolor=color, edgecolor=INK, lw=1))
        ax.text(x, y, text, ha="center", va="center", fontsize=9.5, color=INK)

    def arrow(x1, y1, x2, y2):
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1), arrowprops=dict(arrowstyle="->", color=INK, lw=1))

    box(5, 9.2, 6.4, 1.0, f"2025 지역사회건강조사 원시자료\n만 19세 이상 응답자 {n['raw']:,}명")
    arrow(5, 8.7, 5, 7.7)
    box(8.3, 8.2, 3.0, 0.9, f"제외: PHQ-9 산출 불가\n(문항 거부·모름) {n['y_missing']:,}명", "#ffffff")
    ax.plot([5, 6.8], [8.2, 8.2], color=INK, lw=1)
    box(5, 7.2, 6.4, 1.0, f"분석표본 {n['analysis']:,}명\n우울 증상 기준 충족(PHQ-9 ≥ 10) {n['y1']:,}명 ({n['prev_unw']:.2f}%)")
    arrow(3.2, 6.7, 2.5, 5.5)
    arrow(6.8, 6.7, 7.5, 5.5)
    box(2.5, 4.9, 4.4, 1.2, f"머신러닝 (가구 단위 80/20 분할)\n학습 {n['train']:,}명 (양성 {n['train_y1']:,})\n시험 {n['test']:,}명 (양성 {n['test_y1']:,})")
    box(7.5, 4.9, 4.4, 1.2, f"조사설계 반영 회귀\n7개 영역 동시 조정 완전 사례\n{n['reg']:,}명 ({n['reg_pct']:.1f}%)")
    arrow(2.5, 4.3, 2.5, 3.3)
    box(2.5, 2.7, 4.4, 1.1, "학습셋 5-fold 가구 그룹 교차검증\n→ 학습셋 전체 재적합 → 시험셋 1회 평가", "#ffffff")
    arrow(7.5, 4.3, 7.5, 3.3)
    box(7.5, 2.7, 4.4, 1.1, f"신체활동 × 생활요인 조합 분석\n완전 사례 {n['combo_min']:,}~{n['combo_max']:,}명", "#ffffff")
    fig.tight_layout()
    FIG_OUT.mkdir(parents=True, exist_ok=True)
    fig.savefig(FIG_OUT / "fig1_flow.png", dpi=200)
    plt.close(fig)


def main():
    df = load_v2_table()
    s = df[df["Y"].notna()].copy()
    rep = V2_REPORT
    ml = pd.read_csv(rep / "ml_results.csv")
    deltas = pd.read_csv(rep / "ml_domain_deltas.csv")
    shap = pd.read_csv(rep / "ml_shap_features.csv")
    shap_dom = pd.read_csv(rep / "ml_shap_domains.csv")
    perm = pd.read_csv(rep / "ml_domain_permutation.csv")
    age_add = pd.read_csv(rep / "ml_age_domain_add.csv")
    inter = pd.read_csv(rep / "ml_pa_interactions.csv")
    reg = pd.read_csv(rep / "reg_v2_full_or.csv")
    vtest = pd.read_csv(rep / "reg_v2_variable_tests.csv")
    combo = pd.read_csv(rep / "reg_v2_pa_combo_summary.csv")
    count = pd.read_csv(rep / "reg_v2_lifestyle_count.csv")
    count_sens = pd.read_csv(rep / "reg_v2_lifestyle_count_sens.csv")
    count_summ = pd.read_csv(rep / "reg_v2_lifestyle_count_summary.csv")
    ctx = pd.read_csv(rep / "reg_v2_context_combo_summary.csv")
    opp = pd.read_csv(rep / "ml_operating_points.csv")
    crude = pd.read_csv(rep / "eda_v2_crude_effect_overview.csv")

    train, test = s[s["split"] == "train"], s[s["split"] == "test"]
    n = {
        "raw": len(df), "y_missing": int(df["Y"].isna().sum()), "analysis": len(s), "y1": int(s["Y"].sum()),
        "y0": int((s["Y"] == 0).sum()), "prev_unw": float(s["Y"].mean() * 100),
        "prev_w": float(np.average(s["Y"], weights=s["wt_p"]) * 100),
        "train": len(train), "test": len(test), "train_y1": int(train["Y"].sum()), "test_y1": int(test["Y"].sum()),
        "train_hh": int(train["household_key"].nunique()), "test_hh": int(test["household_key"].nunique()),
        "households": int(s["household_key"].nunique()),
        "reg": 227351, "combo_min": int(combo["n_domain"].min()), "combo_max": int(combo["n_domain"].max()),
        "n_features": int(len(FEATURES)), "n_main_features": int((FEATURES["domain"] != "proximal").sum()),
        "strata": int(df["kstrata"].nunique()), "psu": int(df["spot_key"].nunique()),
        "max_missing_pct": float(s[list(FEATURES["name"])].isna().mean().max() * 100),
    }
    n["reg_pct"] = n["reg"] / n["analysis"] * 100
    # 회귀 n 검증: 로그에 기록된 값과 일치해야 한다
    log = (rep / "regression_v2_log.txt").read_text(encoding="utf-8")
    assert f"n={n['reg']:,}" in log, "회귀 완전 사례 수가 로그와 다름"
    flow_figure(n)

    algos = {}
    for _, row in ml[ml["cv"]].iterrows():
        algos.setdefault(row["algo"], {})[row["set"]] = {
            "cv_ap": r(row.get("cv_AP_mean")), "cv_ap_sd": r(row.get("cv_AP_sd")), "ap": r(row["test_AP"]),
            "auc": r(row["test_ROC_AUC"]), "brier": r(row["test_Brier"], 4),
            "prec10": r(row["test_precision@top10%"] * 100, 1), "rec10": r(row["test_recall@top10%"] * 100, 1),
            "prec5": r(row["test_precision@top5%"] * 100, 1), "rec5": r(row["test_recall@top5%"] * 100, 1)}

    sets = {}
    for _, row in ml[~ml["cv"]].iterrows():
        sets.setdefault(row["set"], {})[row["algo"]] = {"ap": r(row["test_AP"]), "auc": r(row["test_ROC_AUC"])}

    dom = {}
    for _, row in deltas.iterrows():
        dom.setdefault(row["domain"], {}).setdefault(row["algo"], {})[row["kind"]] = {
            "d": r(row["dAP"]), "lo": r(row["low"]), "hi": r(row["high"])}
    for _, row in shap_dom.iterrows():
        dom.setdefault(row["domain"], {})["shap_share"] = r(row["share"] * 100, 1)
    for _, row in perm.iterrows():
        dom.setdefault(row["domain"], {})["perm"] = r(row["AP_drop_mean"])

    shap_top = [{"feature": x["feature"], "label": x["label"], "domain": x["domain"], "modifiable": bool(x["modifiable"]),
                 "shap": r(x["mean_abs_shap"]), "direction": x["direction"]} for _, x in shap.head(25).iterrows()]

    m = reg[reg["actionable"] & (reg["p"] < 0.05)].copy()
    m["dist"] = np.abs(np.log(m["OR"]))
    or_mod = [{"name": x["name"], "level": x["level"], "ref": x["ref"], "domain": x["domain"], "mod_type": x["mod_type"],
               "or": r(x["OR"], 2),
               "lo": r(x["OR_low"], 2), "hi": r(x["OR_high"], 2), "p": float(x["p"])}
              for _, x in m.sort_values("dist", ascending=False).head(20).iterrows()]
    or_pa = [{"name": x["name"], "level": x["level"], "ref": x["ref"], "or": r(x["OR"], 2), "lo": r(x["OR_low"], 2),
              "hi": r(x["OR_high"], 2), "p": float(x["p"])}
             for _, x in reg[reg["var"].isin(["walk_ok", "aerobic_ok", "strength_ok", "drinking", "high_risk_drinking",
                                              "sex"])].iterrows()]
    or_all = [{"name": x["name"], "level": str(x["level"]), "ref": x["ref"], "domain": x["domain"], "or": r(x["OR"], 2),
               "lo": r(x["OR_low"], 2), "hi": r(x["OR_high"], 2), "p": float(x["p"])} for _, x in reg.iterrows()]
    vt = [{"var": x["var"], "name": x["name"], "domain": x["domain"], "df": int(x["df"]), "F": r(x["F"], 1),
           "p": float(x["p"])} for _, x in vtest.sort_values("F", ascending=False).iterrows()]

    age = {}
    for _, row in age_add.iterrows():
        age.setdefault(row["age_group"], {})[row["domain"]] = {"d": r(row["dAP"]), "lo": r(row["low"]),
                                                               "hi": r(row["high"]), "n": int(row["n_test"]),
                                                               "prev": r(row["prev_test"] * 100, 2)}
    combos = [{k: (r(v, 4) if isinstance(v, float) else v) for k, v in row.items()} for row in combo.to_dict("records")]
    counts = [{"k": x["healthy_factors"], "prev": r(x["adj_prev"] * 100, 1), "lo": r(x["low"] * 100, 1),
               "hi": r(x["high"] * 100, 1), "n": int(x["n"])} for _, x in count.iterrows()]
    summ = {row["score"]: {"n_factors": int(row["n_factors"]), "wald_p": float(row["wald_p"]), "trend_or": r(row["trend_OR"], 2),
                           "trend_lo": r(row["trend_low"], 2), "trend_hi": r(row["trend_high"], 2), "trend_p": float(row["trend_p"])}
            for _, row in count_summ.iterrows()}
    mant, expo = f"{summ['주 분석']['wald_p']:.1e}".split("e")
    sup = str.maketrans("-0123456789", "⁻⁰¹²³⁴⁵⁶⁷⁸⁹")
    log_count = f"{mant} × 10{str(int(expo)).translate(sup)}"
    count_sens_rows = [{"score": x["score"], "k": x["healthy_factors"], "prev": r(x["adj_prev"] * 100, 1),
                        "lo": r(x["low"] * 100, 1), "hi": r(x["high"] * 100, 1), "n": int(x["n"])}
                       for _, x in count_sens.iterrows()]
    ctx_combos = [{k: (r(v, 4) if isinstance(v, float) else v) for k, v in row.items()} for row in ctx.to_dict("records")]
    op_points = [{"rule": x["rule"], "thr": r(x["threshold"], 3), "flag": r(x["flag_rate"] * 100, 1),
                  "sens": r(x["sensitivity"] * 100, 1), "spec": r(x["specificity"] * 100, 1), "ppv": r(x["ppv"] * 100, 1),
                  "npv": r(x["npv"] * 100, 1), "f1": r(x["f1"], 3),
                  "per10k": {k: int(round(x[f"per10k_{k}"])) for k in ("flagged", "tp", "fn", "fp")}}
                 for _, x in opp.iterrows()]
    # 생활요인 충족률(가중) — 선정 대응표용
    lf_cols = {"pa_guideline": "신체활동 권고 충족", "tobacco_free": "담배제품 미사용", "high_risk_drinking": "고위험음주 아님",
               "breakfast": "아침식사 주 5회 이상", "social_connected": "사회적 연결", "sleep_weekday": "주중 수면 7~9시간"}
    lf = {}
    for col, nm in lf_cols.items():
        x = s[col]
        met = {"high_risk_drinking": x == 0, "breakfast": x == 1, "sleep_weekday": x.between(7, 9)}.get(col, x == 1)
        mm = x.notna()
        lf[nm] = r(np.average(met[mm], weights=s.loc[mm, "wt_p"]) * 100, 1)
    crude_top = [{"label": x["label"], "domain": x["domain"], "max": r(x["max_rate"], 1), "min": r(x["min_rate"], 1),
                  "range": r(x["range_pp"], 1)} for _, x in crude.head(20).iterrows()]
    inter_top = [{"label": x["partner_label"], "domain": x["partner_domain"], "s": r(x["interaction_strength"], 4)}
                 for _, x in inter.head(10).iterrows()]

    variables = [{"name": x["name"], "label": x["label"], "domain": x["domain"], "kind": x["kind"],
                  "modifiable": bool(x["modifiable"]), "mod_type": x["mod_type"],
                  "mod_label": MOD_TYPE_LABELS[x["mod_type"]], "source": x["source"], "logic": x["logic"]}
                 for _, x in FEATURES.iterrows()]
    profile = pd.read_csv(rep / "dataset_profile_v2.csv")
    miss = dict(zip(profile["변수명"], profile["결측비율(%)"]))
    for v in variables:
        v["missing_pct"] = miss.get(v["name"])

    perf = pd.read_csv(rep / "ml_performance_ci.csv")
    for _, row in perf.iterrows():
        algos[row["algo"]][row["set"]].update({"ap_lo": r(row["AP_low"]), "ap_hi": r(row["AP_high"]),
            "auc_lo": r(row["AUC_low"]), "auc_hi": r(row["AUC_high"]), "oe": r(row["OE"], 2),
            "slope": r(row["cal_slope"], 2)})
    subgroup = [{k: (r(v, 3) if isinstance(v, float) else v) for k, v in row.items()}
                for row in pd.read_csv(rep / "ml_subgroup_performance.csv").to_dict("records")]
    n["train_prev"] = float(train["Y"].mean() * 100)
    n["test_prev"] = float(test["Y"].mean() * 100)

    data = {"n": n, "algos": algos, "sets": sets, "subgroup": subgroup, "domains": dom, "domain_labels": DOMAINS, "shap_top": shap_top,
            "or_modifiable": or_mod, "or_other": or_pa, "or_all": or_all, "variable_tests": vt, "age": age, "combos": combos,
            "counts": counts, "count_p": log_count, "count_summary": summ, "count_sens": count_sens_rows,
            "context_combos": ctx_combos, "operating_points": op_points, "lifestyle_prev": lf, "crude_top": crude_top, "pa_interactions": inter_top,
            "table1": table1(s), "variables": variables}
    (OUT / "paper_data.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")

    figs = {"fig2_domain_contribution.png": "model_v2_02_domain_contribution.png",
            "fig3_shap_top.png": "model_v2_03_shap_top.png",
            "fig4_forest_modifiable.png": "reg_v2_01_forest_modifiable.png",
            "fig5_age_groups.png": "model_v2_04_age_groups.png",
            "fig6_pa_combinations.png": "reg_v2_02_pa_combinations.png",
            "figS1_algorithms.png": "model_v2_01_algorithms.png",
            "figS2_crude_overview.png": "eda_v2_09_overview.png"}
    for dst, src in figs.items():
        shutil.copy(V2_FIG / src, FIG_OUT / dst)
    print("저장:", OUT / "paper_data.json", "| 그림", len(figs) + 1, "개")
    print(json.dumps(n, ensure_ascii=False))


if __name__ == "__main__":
    main()
