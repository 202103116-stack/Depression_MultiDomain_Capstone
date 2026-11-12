"""v4 단계 D — 생각3: 스포츠 조합에 가중치를 준 모델과 기본 모델의 예측 성능 비교.

실행: .venv\\Scripts\\python src/v4/train_weighted_v4.py   (combo_v4.py, train_cross_v4.py 실행 후)
산출: outputs/v4/reports/c3_*.csv

설계(decision_log D-44)
- 조합 선택: 탐색 세트(학습셋) 전체 층·y5에서 주 운동 4개 × 생활요인 5개 중 결합 감소 상위 2개(c1_pairs_explore.csv).
  시험셋은 보지 않는다.
- 모델(같은 분할, CatBoost 고정 하이퍼파라미터, 결과 y5)
  M0  기본: 주 분석 53개 변수(train_cross_v4의 y5__none 재사용)
  M1  기본 + 조합 구성 변수(공정한 비교 기준: 조합이 새 정보를 들여오는 효과를 분리)
  M2  M1 + 조합 지시변수(둘 다 충족 = 1)
  M3  M1 + feature_weights(운동 변수와 짝 변수의 분할 선택 가중 ↑, 가중값은 학습셋 3-fold 가구 그룹 CV로 선택)
- 판정: 시험 ΔAP(M2·M3 − M1, 가구 부트스트랩 95% CI), 보정, SHAP 상호작용값(운동 × 짝).
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score

import combo_v4 as c
from common_v4 import V4_REPORT, load_v4_table
from train_cross_v4 import WeightedCatBoost, fit_predict, perf_row

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "v2"))
from common import MAIN_DOMAINS  # noqa: E402
from modeling import group_bootstrap_delta, group_cv  # noqa: E402
from preprocess_v2 import domain_features  # noqa: E402
from train_v2 import PA_FEATURES, catboost_shap, make_X  # noqa: E402

# 조합 구성 변수 → 분석표 열(0/1)
COMPONENT_COL = {"walk": "walk_ok", "aerobic": "aerobic_ok", "strength": "strength_ok", "pa_guide": "pa_guideline",
                 "tobacco": "tobacco_free", "social": "social_connected", "brushing": "brush_evening_ok",
                 "breakfast": None, "alcohol": None}
WEIGHT_GRID = [2.0, 5.0]


def chosen_combos(k=2):
    p = pd.read_csv(V4_REPORT / "c1_pairs_explore.csv")
    q = p[(p.outcome == "y5") & (p.stratum == "전체") & (p.set == "train") & p.a.isin(c.SPORT_MAIN) & p.b.isin(c.LIFE_MAIN)]
    return q.nsmallest(k, "joint")[["a", "b", "joint", "syn"]].reset_index(drop=True)


def add_columns(d: pd.DataFrame, combos: pd.DataFrame) -> tuple[list[str], list[str]]:
    comp, ind = [], []
    for a, b in zip(combos.a, combos.b):
        for f in (a, b):
            col = COMPONENT_COL.get(f) or f"f_{f}"
            if col not in d:
                d[col] = c.FACTORS[f][1](d)
            if col not in comp:
                comp.append(col)
        name = f"combo_{a}_{b}"
        d[name] = (d[COMPONENT_COL.get(a) or f"f_{a}"] * d[COMPONENT_COL.get(b) or f"f_{b}"])
        ind.append(name)
    return comp, ind


def cv_weight(train, num, cat, extra, weighted, grid):
    """학습셋 3-fold 가구 그룹 CV AP로 feature_weights 값을 고른다."""
    tr = train[train["y5"].notna()].reset_index(drop=True)
    X = make_X(tr, num, cat)
    for col in extra:
        X[col] = tr[col].astype("Int64").astype(str).where(tr[col].notna())
    y = tr["y5"].astype(int).to_numpy()
    rows = []
    for wv in grid:
        fw = {f: wv for f in weighted}
        aps = []
        for i_tr, i_va in group_cv(3).split(X, y, tr["household_key"]):
            m = WeightedCatBoost(cat_features=list(cat) + list(extra), feature_weights=fw).fit(X.iloc[i_tr], y[i_tr])
            aps.append(average_precision_score(y[i_va], m.predict_proba(X.iloc[i_va])[:, 1]))
        rows.append({"weight": wv, "cv_AP_mean": float(np.mean(aps)), "cv_AP_sd": float(np.std(aps, ddof=1))})
        print(f"가중 {wv}: CV AP {np.mean(aps):.4f}", flush=True)
    return pd.DataFrame(rows)


def main():
    d = load_v4_table()
    combos = chosen_combos()
    print("선택된 조합(탐색 세트):\n", combos.round(3).to_string(index=False))
    comp, ind = add_columns(d, combos)
    train, test = d[d["split"] == "train"].reset_index(drop=True), d[d["split"] == "test"].reset_index(drop=True)
    num, cat = domain_features(MAIN_DOMAINS)
    hh = test["household_key"].to_numpy()
    y = test["y5"].to_numpy(float)

    p0, _, _ = fit_predict(train, test, num, cat, "y5", "none", "y5__none")
    p1, _, fm1 = fit_predict(train, test, num, cat, "y5", "none", "c3_M1_components", extra=comp)
    p2, _, _ = fit_predict(train, test, num, cat, "y5", "none", "c3_M2_indicators", extra=comp + ind)

    sport_cols = PA_FEATURES + [col for col in comp if col in ("walk_ok", "aerobic_ok", "strength_ok", "pa_guideline")]
    partner_cols = [col for col in comp if col not in sport_cols]
    weighted = sport_cols + partner_cols
    cvw = cv_weight(train, num, cat, comp, weighted, WEIGHT_GRID)
    cvw.to_csv(V4_REPORT / "c3_weight_cv.csv", index=False, encoding="utf-8-sig")
    best_w = float(cvw.loc[cvw.cv_AP_mean.idxmax(), "weight"])
    p3, _, _ = fit_predict(train, test, num, cat, "y5", "none", f"c3_M3_weights{best_w:g}", extra=comp,
                           feature_weights={f: best_w for f in weighted})

    rows = []
    for tag, p in [("M0 기본", p0), ("M1 +구성 변수", p1), ("M2 +조합 지시변수", p2), (f"M3 +특성 가중({best_w:g}배)", p3)]:
        row = perf_row(y, p, hh, model=tag)
        for ref_tag, ref in (("M0", p0), ("M1", p1)):
            if p is ref:
                continue
            r = group_bootstrap_delta(y.astype(int), p, ref, hh, n_boot=500)
            row.update({f"dAP_vs_{ref_tag}": r["dAP_vs_M0"], f"dAP_vs_{ref_tag}_lo": r["dAP_CI_low"],
                        f"dAP_vs_{ref_tag}_hi": r["dAP_CI_high"]})
        rows.append(row)
    res = pd.DataFrame(rows)
    res["combos"] = "; ".join(f"{c.LABEL[a]} + {c.LABEL[b]}" for a, b in zip(combos.a, combos.b))
    res["weighted_features"] = ", ".join(weighted)
    res.to_csv(V4_REPORT / "c3_models.csv", index=False, encoding="utf-8-sig")
    print(res[["model", "AP", "AP_lo", "AP_hi", "ROC_AUC", "Brier", "cal_slope", "dAP_vs_M1", "dAP_vs_M1_lo", "dAP_vs_M1_hi"]].round(4).to_string(index=False))

    # SHAP 상호작용(M1, 시험셋 2,000명 표본): 운동 변수 × 짝·생활 변수
    if fm1 is not None:
        model, Xte, cats = fm1
        sample = Xte.sample(2000, random_state=42)
        inter = np.abs(catboost_shap(model, sample, cats, interaction=True)[:, :-1, :-1]).mean(axis=0)
        names = list(sample.columns)
        rows = []
        for i, a in enumerate(names):
            for j, b in enumerate(names):
                if j <= i:
                    continue
                rows.append({"f1": a, "f2": b, "mean_abs_interaction": float(inter[i, j] * 2),
                             "involves_sport": a in sport_cols or b in sport_cols})
        it = pd.DataFrame(rows).sort_values("mean_abs_interaction", ascending=False)
        it["rank"] = np.arange(1, len(it) + 1)
        it.to_csv(V4_REPORT / "c3_shap_interactions.csv", index=False, encoding="utf-8-sig")
        print(it.head(15).round(4).to_string(index=False))
        print("운동 관련 상위:\n", it[it.involves_sport].head(10).round(4).to_string(index=False))


if __name__ == "__main__":
    main()
