"""v2 성능 보완 지표 — 시험셋 성능의 95% CI, 보정(calibration), 성별·연령대별 하위집단 성능 (TRIPOD+AI 12e·14·23a).

실행: python src/v2/performance_v2.py   (train_v2.py 실행 후, 캐시된 시험셋 예측 사용 — 재학습 없음)
산출: outputs/v2/reports/ml_performance_ci.csv, outputs/v2/reports/ml_subgroup_performance.csv
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, roc_auc_score

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


if __name__ == "__main__":
    main()
