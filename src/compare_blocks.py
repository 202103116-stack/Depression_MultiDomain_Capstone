"""인접 정보 블록 간 대응 비교(M1−M0, M2−M1, M3−M2) — 가구 단위 부트스트랩 95% CI.

실행: python src/compare_blocks.py   (train_models.py 실행 후, 캐시된 시험셋 예측 사용)
산출: outputs/reports/model_block_steps.csv

train_models.py의 비교표는 M0 대비 개선량만 제시하므로, 각 단계에서 추가한 정보(활동조합 → 친구 연락 → 상호작용항)가
바로 앞 블록보다 나아졌는지를 따로 확인한다.
"""
from __future__ import annotations

import pandas as pd

from modeling import ALGO_LABELS, group_bootstrap_delta
from train_models import RUN_DIR
from utils import REPORT_DIR, load_analysis_table

STEPS = [("M1", "M0"), ("M2", "M1"), ("M3", "M2")]
ALGOS = ["logistic", "catboost", "random_forest", "lightgbm", "mlp"]


def main():
    df = load_analysis_table()
    test = df[(df["in_analysis"] == 1) & (df["split"] == "test")].reset_index(drop=True)
    y = test["Y"].astype(int).to_numpy()
    groups = test["household_key"].to_numpy()
    pred = lambda b, a: pd.read_csv(RUN_DIR / f"{b}_{a}_test_pred.csv")["p"].to_numpy()

    rows = []
    for algo in ALGOS:
        for new, base in STEPS:
            d = group_bootstrap_delta(y, pred(new, algo), pred(base, algo), groups)
            rows.append({"algo": algo, "algo_label": ALGO_LABELS[algo], "step": f"{new}-{base}",
                         "dAP": d["dAP_vs_M0"], "dAP_CI_low": d["dAP_CI_low"], "dAP_CI_high": d["dAP_CI_high"],
                         "dAUC": d["dAUC_vs_M0"], "dAUC_CI_low": d["dAUC_CI_low"], "dAUC_CI_high": d["dAUC_CI_high"]})
            print(f"{algo:14s} {new}-{base}  dAP {d['dAP_vs_M0']:+.4f} [{d['dAP_CI_low']:+.4f}, {d['dAP_CI_high']:+.4f}]", flush=True)
    out = pd.DataFrame(rows)
    out.to_csv(REPORT_DIR / "model_block_steps.csv", index=False, encoding="utf-8-sig", float_format="%.5f")


if __name__ == "__main__":
    main()
