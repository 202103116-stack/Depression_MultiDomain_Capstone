"""v3 보고서 수치의 단일 출처 — outputs/v3/reports/*.csv → report_v3/report_data.json, 그림 복사.

실행: python src/v3/build_report_data.py  (eda_v3 → reversal_v3 → sensitivity_v3 → exercise_v3 다음)
보고서(make_report_v3.js)와 노션의 수치는 모두 이 JSON에서 가져온다(손으로 옮겨 적지 않음).
"""
from __future__ import annotations

import json
import shutil

import pandas as pd

from common_v3 import REPORT_DIR, V3_FIG, V3_REPORT

TABLES = {
    "table1": "eda_table1.csv", "prev_by_econ": "eda_prev_by_econ.csv", "factor_rates": "eda_factor_rates.csv",
    "count_dist": "eda_count_dist.csv", "cells": "rev_cells.csv", "reversal": "rev_reversal.csv",
    "interaction": "rev_interaction.csv", "decomposition": "rev_decomposition.csv", "sensitivity": "sens_summary.csv",
    "s1_cells": "ex_s1_cells.csv", "s1_std": "ex_s1_standardized.csv", "s1_steps": "ex_s1_steps.csv",
    "s1_slope": "ex_s1_slope.csv", "count9": "ex_count9_cells.csv", "s2": "ex_s2_types.csv",
}


def main():
    out = {}
    for k, f in TABLES.items():
        df = pd.read_csv(V3_REPORT / f)
        out[k] = json.loads(df.to_json(orient="records", force_ascii=False))
    t1 = pd.read_csv(V3_REPORT / "eda_table1.csv")
    out["n"] = {"raw": 231615, "analysis": int(t1.loc[t1["var"] == "n(비가중)", "전체"].iloc[0]),
                "prev_w": float(t1.loc[t1["var"] == "우울 증상(PHQ-9≥10)", "전체"].iloc[0]) / 100,
                "events": 8704, "design_df": 16988}
    fig_dir = REPORT_DIR / "figures"
    fig_dir.mkdir(parents=True, exist_ok=True)
    for p in sorted(V3_FIG.glob("fig_v3_*.png")):
        shutil.copy(p, fig_dir / p.name)
    (REPORT_DIR / "report_data.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print("저장:", REPORT_DIR / "report_data.json", {k: len(v) for k, v in out.items() if isinstance(v, list)})


if __name__ == "__main__":
    main()
