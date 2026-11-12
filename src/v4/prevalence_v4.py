"""v4 보충 — 운동 4개·일반 생활요인 5개의 가중 충족률(전체·소득 하위·상위 20%). 도달 범위 해석용.

실행: .venv\\Scripts\\python src/v4/prevalence_v4.py   (outcomes_v4.py 실행 후)
산출: outputs/v4/reports/r_prevalence.csv
"""
from __future__ import annotations

import pandas as pd

import combo_v4 as c
from common_v4 import V4_REPORT, load_v4_table, wmean
from ranking_v4 import LABEL, LIFE5, SPORT4
from survey_regression_v2 import recode


def main():
    d = load_v4_table()
    S = c.strata(d, recode(d))
    rows = []
    for k in list(SPORT4) + list(LIFE5):
        f = c.FACTORS[k][1](d)
        row = {"factor": k, "label": LABEL[k], "is_sport": k in SPORT4}
        for st in ("전체", "소득 하위 20%", "소득 상위 20%"):
            m = S[st]
            row[st] = 100 * wmean(f[m], d.loc[m, "wt_p"])
        rows.append(row)
    t = pd.DataFrame(rows)
    t.to_csv(V4_REPORT / "r_prevalence.csv", index=False, encoding="utf-8-sig")
    print(t.round(1).to_string(index=False))


if __name__ == "__main__":
    main()
