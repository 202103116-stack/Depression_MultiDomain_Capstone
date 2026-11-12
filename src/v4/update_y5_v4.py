"""v4 단계 E — 연구 1(v2 다차원 회귀)과 연구 2(v3 경제적 역전점)를 주 결과 y5(PHQ-9 ≥ 5)로 다시 낸다.

실행: .venv\\Scripts\\python src/v4/update_y5_v4.py   (outcomes_v4.py 실행 후)
산출: outputs/v4/reports/e1_*.csv(연구 1 회귀), e2_*.csv(연구 2 역전점)

- 연구 1: 7개 영역 동시 조정 OR, 변수별 결합 검정, 신체활동 × 생활요인 조합, 생활요인 개수(src/v2/survey_regression_v2.py 함수 그대로).
- 연구 2: 생활요인 정의를 연구 1과 통일(신체활동 권고 + 생활요인 5개 = 0~6, 0~2/3/4/5/6 단계 — 중간발표 추후 계획).
  이전 정의(7개)는 민감도로 함께 낸다. 역전점·가법·분해는 src/v3/reversal_v3.analyze 그대로.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

from common_v4 import V4_REPORT, load_v4_table

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "v3"))
from common_v3 import ADJ, BIN_CUTS, BINS, binned, indicators, lifestyle  # noqa: E402
from reversal_v3 import analyze  # noqa: E402
from survey_regression_v2 import (CONTEXT_PARTNERS, PARTNERS, SPEC, actionable, combo_analysis, design, fit,  # noqa: E402
                                  lifestyle_count, recode)

CUTS6 = [(0, 2, "0~2개"), (3, 3, "3개"), (4, 4, "4개"), (5, 5, "5개"), (6, 6, "6개")]
BINS6 = [lab for _, _, lab in CUTS6]


def study1(d, r):
    ins = np.ones(len(d), bool)
    X, info = design(r, SPEC)
    mdl = fit(X, d, ins)
    t = mdl.table().merge(pd.DataFrame(info), on="term", how="left")
    t = t[t["term"] != "const"]
    t["actionable"] = actionable(t)
    vt = []
    for var, ref, dom, name in SPEC:
        w = mdl.wald([x["term"] for x in info if x["var"] == var])
        vt.append({"var": var, "name": name, "domain": dom, "df": w["q"], "F": w["F"], "p": w["p"]})
    vt = pd.DataFrame(vt).sort_values("F", ascending=False)
    summary, cells = combo_analysis(d, r, ins)
    count_all, count_summary = lifestyle_count(d, r, ins)
    t.to_csv(V4_REPORT / "e1_full_or.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    vt.to_csv(V4_REPORT / "e1_variable_tests.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    summary.to_csv(V4_REPORT / "e1_pa_combo_summary.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    count_all.to_csv(V4_REPORT / "e1_lifestyle_count.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    count_summary.to_csv(V4_REPORT / "e1_lifestyle_count_summary.csv", index=False, encoding="utf-8-sig", float_format="%.6g")
    print(f"[연구 1 회귀, y5] n={mdl.domain.sum():,}")
    print(vt.head(12).round(3).to_string(index=False))
    m = t[t["actionable"] & (t["p"] < 0.05)].copy()
    m["dist"] = np.abs(np.log(m["OR"]))
    print(m.sort_values("dist", ascending=False).head(12)[["name", "level", "ref", "OR", "OR_low", "OR_high"]].round(2).to_string(index=False))
    print(summary[["partner", "prev_both", "prev_neither", "joint_diff", "additive_interaction", "add_p"]].round(4).to_string(index=False))
    print(count_summary.to_string(index=False))


def study2(d, r):
    ls = lifestyle(d)
    count6 = pd.concat([d["pa_guideline"]] + [fn(d) for name, _, fn, prox in PARTNERS if not prox], axis=1)
    count6 = count6.sum(axis=1).where(count6.notna().all(axis=1))
    specs = [("주 분석(생활요인 6개, 연구 1과 통일)", binned(count6, CUTS6), count6, BINS6),
             ("민감도(이전 정의 7개)", binned(ls["count7"], BIN_CUTS), ls["count7"], BINS)]
    out = {k: [] for k in ["cells", "rev", "inter", "dec"]}
    for tag, lbin, cnt, levels in specs:
        for key, ind in indicators(d).items():
            c, rv, it, dc = analyze(d, r, key, ind, lbin, cnt, ADJ, levels=levels, tag=tag)
            out["cells"].append(c)
            out["rev"].append(rv)
            out["inter"].append(it)
            out["dec"] += dc
            print(f"[{tag} · {ind['label']}] n={it['n_model']:,} 최소 칸 {c['n'].min()} 역전①={it['reversal_1']} ②={it['reversal_2']} "
                  f"가법 {it['additive_pp']:+.2f}%p [{it['additive_low']:+.2f}, {it['additive_high']:+.2f}] "
                  f"분해(연령 표준화) {dc[0]['share_explained'] * 100:.0f}%", flush=True)
    cells, rev = pd.concat(out["cells"]), pd.concat(out["rev"])
    inter, dec = pd.DataFrame(out["inter"]), pd.DataFrame(out["dec"])
    cells.to_csv(V4_REPORT / "e2_rev_cells.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    rev.to_csv(V4_REPORT / "e2_rev_reversal.csv", index=False, encoding="utf-8-sig", float_format="%.4f")
    inter.to_csv(V4_REPORT / "e2_rev_interaction.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    dec.to_csv(V4_REPORT / "e2_rev_decomposition.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    piv = cells.assign(pct=cells.adj_prev * 100).pivot_table(index=["spec", "indicator", "group"], columns="bin", values="pct")
    print(piv.round(1).to_string())


def main():
    V4_REPORT.mkdir(parents=True, exist_ok=True)
    d = load_v4_table()
    d["Y"] = d["y5"]  # v2·v3 함수는 d["Y"]를 결과로 쓴다
    r = recode(d)
    study1(d, r)
    study2(d, r)


if __name__ == "__main__":
    main()
