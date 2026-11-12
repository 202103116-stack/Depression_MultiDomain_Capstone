"""논문 v4 수치 JSON — outputs/v4/reports 집계표에서 원고에 쓰는 값만 모은다(손으로 옮기지 않음).

실행: .venv\\Scripts\\python paper/build_paper_data_v4.py   (src/v4 분석과 figures_v4.py 실행 후)
산출: paper/paper_data_v4.json, paper/figures/v4/*.png(그림 사본)
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
REP, FIG = ROOT / "outputs" / "v4" / "reports", ROOT / "outputs" / "v4" / "figures"
OUT = ROOT / "paper"
R = lambda n: pd.read_csv(REP / n)


def rec(df: pd.DataFrame) -> list[dict]:
    return json.loads(df.replace({np.nan: None}).to_json(orient="records", force_ascii=False))


def main():
    D = {}
    a = R("a_outcomes.csv")
    D["outcomes"] = rec(a)
    cross = R("a_outcomes_cross.csv")
    D["kappa"] = {r.pair: r.kappa for r in cross.dropna(subset=["kappa"]).itertuples()}
    D["p_mood_given_y5"] = float(cross.loc[cross.pair == "y5×y_mood", "P(y_mood|y5)"].dropna().iloc[0])
    D["p_y5_given_mood"] = float(cross.loc[cross.pair == "y5×y_mood", "P(y5|y_mood)"].dropna().iloc[0])
    D["outcomes_by_group"] = rec(R("a_outcomes_by_group.csv"))

    # 생각1
    specs = R("c1_specs.csv")
    cand = R("c1_candidates.csv")
    D["c1_n_models"] = int(len(R("c1_pairs_explore.csv")))
    D["c1_n_specs"] = int(len(specs))
    s5 = specs[specs.outcome == "y5"]
    D["c1_n_specs_y5"] = int(len(s5))
    mood = specs[specs.outcome == "y_mood"].set_index(["stratum", "sport", "x", "metric"])["contrast"]
    j = s5.join(mood.rename("mood"), on=["stratum", "sport", "x", "metric"])
    D["c1_n_rule_pass"] = int(((j.contrast < 0) & (j.p < 0.05) & (j.mood < 0)).sum())
    D["c1_candidates"] = rec(cand[["stratum", "sport", "x", "metric", "contrast", "lo", "hi", "p", "contrast_mood"]])
    D["c1_confirm"] = rec(R("c1_confirm.csv"))
    rk = R("c1_rank_confirm.csv")
    D["c1_rank"] = rec(rk[["outcome", "stratum", "a", "b", "a_label", "b_label", "n", "both_pct", "p00", "p10", "p01", "p11",
                           "joint", "joint_lo", "joint_hi", "joint_p", "syn", "syn_lo", "syn_hi", "syn_p", "equal_joint_p"]])
    D["c1_patterns"] = rec(R("c1_patterns.csv"))
    D["c1_best_explore"] = rec(R("c1_best_partner_explore.csv"))

    # 생각2
    D["c2_cross"] = rec(R("c2_cross_outcome.csv"))
    D["c2_cross_delta"] = rec(R("c2_cross_delta.csv"))
    D["c2_imbalance"] = rec(R("c2_imbalance.csv"))
    D["c2_shap_overlap"] = rec(R("c2_shap_overlap.csv"))[0]
    sh = R("c2_shap.csv")
    D["c2_shap_top"] = rec(sh[sh["rank"] <= 10].sort_values(["target", "rank"]))

    # 생각3
    if (REP / "c3_models.csv").exists():
        D["c3_models"] = rec(R("c3_models.csv"))
        D["c3_weight_cv"] = rec(R("c3_weight_cv.csv"))
        it = R("c3_shap_interactions.csv")
        D["c3_inter_top"] = rec(it.head(10))
        D["c3_inter_sport_top"] = rec(it[it.involves_sport].head(10))

    # 보충: 1:1 조합 30쌍 순위, 소득 계층별 순위, 충족률
    D["r_pairs"] = rec(R("r_pairs.csv"))
    D["r_by_factor"] = rec(R("r_by_factor.csv"))
    D["r_income"] = rec(R("r_income_pairs.csv"))
    D["r_income_tests"] = rec(R("r_income_tests.csv"))
    D["r_prev"] = rec(R("r_prevalence.csv"))

    # 단계 E
    vt = R("e1_variable_tests.csv")
    D["e1_variable_tests"] = rec(vt.head(15))
    orr = R("e1_full_or.csv")
    D["e1_or"] = rec(orr[["name", "level", "ref", "domain", "mod_type", "actionable", "OR", "OR_low", "OR_high", "p"]])
    D["e1_combos"] = rec(R("e1_pa_combo_summary.csv"))
    D["e1_count_summary"] = rec(R("e1_lifestyle_count_summary.csv"))
    D["e1_count"] = rec(R("e1_lifestyle_count.csv"))
    if (REP / "e1_ml_domains.csv").exists():
        D["e1_ml_domains"] = rec(R("e1_ml_domains.csv"))
    D["e2_inter"] = rec(R("e2_rev_interaction.csv"))
    D["e2_cells"] = rec(R("e2_rev_cells.csv"))
    D["e2_reversal"] = rec(R("e2_rev_reversal.csv"))
    D["e2_dec"] = rec(R("e2_rev_decomposition.csv"))

    (OUT / "paper_data_v4.json").write_text(json.dumps(D, ensure_ascii=False, indent=1), encoding="utf-8")
    dst = OUT / "figures" / "v4"
    dst.mkdir(parents=True, exist_ok=True)
    for p in sorted(FIG.glob("fig_v4_*.png")):
        shutil.copy2(p, dst / p.name)
    print(f"paper_data_v4.json 키 {len(D)}개, 그림 {len(list(dst.glob('*.png')))}개")


if __name__ == "__main__":
    main()
