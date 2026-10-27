"""v2 성능 보완 지표 — 시험셋 성능의 95% CI, 보정(calibration), 성별·연령대별 하위집단 성능 (TRIPOD+AI 12e·14·23a).

실행: python src/v2/performance_v2.py   (train_v2.py 실행 후, 캐시된 시험셋 예측 사용 — 재학습 없음)
산출: outputs/v2/reports/ml_performance_ci.csv, outputs/v2/reports/ml_subgroup_performance.csv,
      outputs/v2/reports/ml_operating_points.csv (임계값별 민감도·특이도·정밀도, decision_log D-40)
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, roc_auc_score, roc_curve

import common  # noqa: F401
from common import V2_REPORT, V2_RUNS, load_v2_table
from utils import SEED

ALGOS = ["catboost", "logistic", "lightgbm", "mlp", "random_forest", "dummy"]
N_BOOT = 1000


def group_boot_ci(y, p, groups, n_boot=N_BOOT, seed=SEED):
    """가구 단위 부트스트랩 AP·ROC-AUC 95% CI."""
    rng = np.random.default_rng(seed)
    codes, uniq = pd.factorize(pd.Series(groups))
    ap, auc = [], []
    for _ in range(n_boot):
        w = np.bincount(rng.integers(0, len(uniq), len(uniq)), minlength=len(uniq))[codes]
        m = w > 0
        ap.append(average_precision_score(y[m], p[m], sample_weight=w[m]))
        auc.append(roc_auc_score(y[m], p[m], sample_weight=w[m]))
    return np.percentile(ap, [2.5, 97.5]), np.percentile(auc, [2.5, 97.5])


def calibration(y, p):
    """보정: 관측/예측 비(O:E)와 보정 기울기·절편(logit(p)에 대한 로지스틱 회귀)."""
    oe = y.mean() / p.mean()
    if np.std(p) == 0:
        return oe, np.nan, np.nan
    lp = np.log(np.clip(p, 1e-6, 1 - 1e-6) / (1 - np.clip(p, 1e-6, 1 - 1e-6))).reshape(-1, 1)
    m = LogisticRegression(penalty=None, max_iter=1000).fit(lp, y)
    return oe, float(m.coef_[0, 0]), float(m.intercept_[0])


HAN_PARK_FLAG = 0.184  # Han & Park(2025) 표 3.2에서 역산한 고위험 판정 비율(정확도·macro recall·시험셋 인원)


def confusion(y, p, t) -> dict:
    f = p >= t
    tp, fp = int((f & (y == 1)).sum()), int((f & (y == 0)).sum())
    fn, tn = int((~f & (y == 1)).sum()), int((~f & (y == 0)).sum())
    ppv = tp / (tp + fp) if tp + fp else np.nan
    sens = tp / (tp + fn)
    return {"flag_rate": f.mean(), "sensitivity": sens, "specificity": tn / (tn + fp), "ppv": ppv,
            "npv": tn / (tn + fn), "f1": 2 * ppv * sens / (ppv + sens) if tp else 0.0}


def choose_thresholds(y, p) -> dict:
    fpr, tpr, thr = roc_curve(y, p)
    cand = np.quantile(p, np.linspace(0.5, 0.999, 600))
    f1 = [confusion(y, p, t)["f1"] for t in cand]
    return {"Youden(민감도+특이도 최대)": thr[np.argmax(tpr - fpr)], "민감도 80%": thr[np.argmax(tpr >= 0.80)],
            "상위 10%": np.quantile(p, 0.90), "F1 최대": cand[int(np.argmax(f1))],
            f"상위 {HAN_PARK_FLAG:.1%}(Han & Park 판정 비율)": np.quantile(p, 1 - HAN_PARK_FLAG)}


def operating_points(y, p, groups, seed=SEED) -> pd.DataFrame:
    """가구 단위로 시험셋을 반으로 나눠 한쪽에서 임계값을 정하고 다른 쪽에서 평가(교차 적합) 후 평균."""
    rng = np.random.default_rng(seed)
    uniq = pd.unique(groups)
    half = np.isin(groups, rng.choice(uniq, len(uniq) // 2, replace=False))
    rows = []
    for tune, ev in [(half, ~half), (~half, half)]:
        for rule, t in choose_thresholds(y[tune], p[tune]).items():
            rows.append({"rule": rule, "threshold": t, **confusion(y[ev], p[ev], t)})
    out = pd.DataFrame(rows).groupby("rule", sort=False).mean().reset_index()
    out["per10k_flagged"] = out["flag_rate"] * 10_000
    out["per10k_tp"] = y.mean() * 10_000 * out["sensitivity"]
    out["per10k_fn"] = y.mean() * 10_000 - out["per10k_tp"]
    out["per10k_fp"] = out["per10k_flagged"] - out["per10k_tp"]
    return out


def main():
    df = load_v2_table()
    test = df[(df["Y"].notna()) & (df["split"] == "test")].reset_index(drop=True)
    y = test["Y"].astype(int).to_numpy()
    groups = test["household_key"].to_numpy()

    rows = []
    for s in ["full", "full+proximal"]:
        for a in ALGOS:
            p = pd.read_csv(V2_RUNS / f"{s}__{a}__cv_pred.csv")["p"].to_numpy()
            assert len(p) == len(y), "예측 길이와 시험셋 크기가 다름"
            (ap_lo, ap_hi), (auc_lo, auc_hi) = group_boot_ci(y, p, groups)
            oe, slope, intercept = calibration(y, p)
            rows.append({"set": s, "algo": a, "AP": average_precision_score(y, p), "AP_low": ap_lo, "AP_high": ap_hi,
                         "AUC": roc_auc_score(y, p), "AUC_low": auc_lo, "AUC_high": auc_hi,
                         "OE": oe, "cal_slope": slope, "cal_intercept": intercept})
            print(f"{s:14s} {a:14s} AP {rows[-1]['AP']:.3f} [{ap_lo:.3f}, {ap_hi:.3f}]  O:E {oe:.2f}  slope {slope:.2f}",
                  flush=True)
    pd.DataFrame(rows).to_csv(V2_REPORT / "ml_performance_ci.csv", index=False, encoding="utf-8-sig",
                              float_format="%.5f")

    # 하위집단 성능 — CatBoost 주 분석
    p = pd.read_csv(V2_RUNS / "full__catboost__cv_pred.csv")["p"].to_numpy()
    subs = {"남자": test["sex"] == 1, "여자": test["sex"] == 2,
            "19~39세": test["age"].between(19, 39), "40~64세": test["age"].between(40, 64), "65세 이상": test["age"] >= 65}
    srows = []
    for name, mask in subs.items():
        m = mask.to_numpy()
        (ap_lo, ap_hi), (auc_lo, auc_hi) = group_boot_ci(y[m], p[m], groups[m], n_boot=500)
        oe, slope, _ = calibration(y[m], p[m])
        srows.append({"subgroup": name, "n": int(m.sum()), "events": int(y[m].sum()), "prevalence": y[m].mean(),
                      "AP": average_precision_score(y[m], p[m]), "AP_low": ap_lo, "AP_high": ap_hi,
                      "AUC": roc_auc_score(y[m], p[m]), "AUC_low": auc_lo, "AUC_high": auc_hi, "OE": oe, "cal_slope": slope})
    sub = pd.DataFrame(srows)
    sub.to_csv(V2_REPORT / "ml_subgroup_performance.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    print(sub.round(3).to_string(index=False))

    # 임계값 운영점 — CatBoost 주 분석
    op = operating_points(y, p, groups)
    op.to_csv(V2_REPORT / "ml_operating_points.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    print(op.round(3).to_string(index=False))


if __name__ == "__main__":
    main()
