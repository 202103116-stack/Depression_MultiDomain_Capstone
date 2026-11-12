"""탐색 단계 검토 보고서(REPORT_econ_lifestyle.md)를 v3 집계표로 다시 만든다.

원래 src/v2/explore_econ_lifestyle.py가 만들던 보고서와 같은 구성·같은 수치다(계산은 v3 reversal_v3.py로 이전, D-33).
실행: python src/v3/explore_report_v3.py   (reversal_v3.py, sensitivity_v3.py 다음)
산출: outputs/v3/exploratory/REPORT_econ_lifestyle.md + 그림 2장
"""
from __future__ import annotations

import shutil
from datetime import date

import pandas as pd

from common_v3 import BINS, V3_FIG, V3_REPORT

OUT = V3_REPORT.parent / "exploratory"
INDS = {
    "income": dict(label="균등화 소득", groups=["하위(1분위)", "중위(2~4분위)", "상위(5분위)"], dis="하위(1분위)", adv="상위(5분위)"),
    "livelihood": dict(label="기초생활수급", groups=["현재 수급", "비수급"], dis="현재 수급", adv="비수급"),
    "food": dict(label="가구 식품안정성", groups=["불안정", "안정"], dis="불안정", adv="안정"),
}
COMPS = ["유리 집단 0~2개", "유리 집단 전체 평균", "유리 집단 같은 단계"]


def fmt_ci(e, lo, hi, d=1):
    return f"{e:+.{d}f}%p [{lo:+.{d}f}, {hi:+.{d}f}]"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    cells = pd.read_csv(V3_REPORT / "rev_cells.csv")
    rev = pd.read_csv(V3_REPORT / "rev_reversal.csv")
    inter = pd.read_csv(V3_REPORT / "rev_interaction.csv").set_index("indicator")
    sens = pd.read_csv(V3_REPORT / "sens_summary.csv")
    s = sens[sens["spec"] == "① +식품안정성·수급 조정"].iloc[0]
    t1 = pd.read_csv(V3_REPORT / "eda_table1.csv")
    n_total = int(t1.loc[t1["var"] == "n(비가중)", "전체"].iloc[0])
    shutil.copy(V3_FIG / "fig_v3_04_reversal_lines.png", OUT / "fig_econ_lifestyle_lines.png")
    shutil.copy(V3_FIG / "fig_v3_05_reversal_heatmap.png", OUT / "fig_econ_lifestyle_heatmap.png")

    L = ["# 탐색 분석: 경제적 불리함을 건강 생활요인이 상쇄하는가 (\"역전점\" 분석)",
         "",
         f"> 탐색 단계(2026-10-21)에 공식 문서와 분리해 검토용으로 만든 보고서다. 원래 `src/v2/explore_econ_lifestyle.py`가 생성했고, 계산이 v3로 옮겨진 뒤에는 "
         f"`src/v3/explore_report_v3.py`가 v3 집계표(`outputs/v3/reports/rev_*.csv`)로 같은 내용을 다시 만든다({date.today().isoformat()}). "
         "이 검토를 바탕으로 v3 주제(「건강 생활요인은 경제적 불리함을 상쇄하는가」, `docs/v3/WORKFLOW_v3.md`)로 확정했다.",
         "> 조정 유병률은 조사설계(가중치·층·집락)를 반영한 로지스틱 회귀의 예측 주변값이며, 인구·신체건강 변수를 조정했다(다른 경제 변수는 조정하지 않음).",
         "",
         "## 질문",
         "경제적으로 불리한 집단이 건강 생활요인(신체활동 권고 + 친구 연락·이웃 신뢰·비흡연·고위험음주 아님·아침식사·동네 안전)을 많이 충족하면, "
         "생활요인이 적은 경제적 유리 집단보다 우울 증상 기준 충족률이 **낮아지는 지점(역전점)**이 있는가?",
         "",
         "## 판정 기준",
         "- **역전점** = 불리 집단의 조정 유병률이 비교 기준보다 낮고, 그 차이의 95% 신뢰구간 상한이 0 미만인 가장 낮은 생활요인 단계.",
         "- 비교 기준은 세 가지다.",
         "  - ① 유리 집단 중 생활요인 0~2개",
         "  - ② 유리 집단 전체 평균(유리 집단의 실제 생활요인 분포로 가중)",
         "  - ③ 유리 집단 같은 단계 — 같은 노력을 할 때 격차가 남는가",
         "",
         "## 한눈에 보기", "",
         "| 경제 지표 | 불리 vs 유리 | 역전점 ① (vs 유리 0~2개) | 역전점 ② (vs 유리 전체 평균) | 같은 단계 격차 (6~7개에서) | 감소 폭이 다른가(가법) | 승법 상호작용 p |",
         "|---|---|---|---|---|---|---|"]
    detail = []
    for key, ind in INDS.items():
        rv = rev[(rev["indicator"] == key) & (rev["spec"] == "주 분석")]
        it = inter.loc[key]
        same = rv[(rv["compare_to"] == COMPS[2]) & (rv["dis_bin"] == BINS[-1])].iloc[0]
        L.append(f"| {ind['label']} | {ind['dis']} vs {ind['adv']} | **{it['reversal_1']}** | **{it['reversal_2']}** | "
                 f"{fmt_ci(same['diff_pp'], same['low_pp'], same['high_pp'])} | "
                 f"{fmt_ci(it['additive_pp'], it['additive_low'], it['additive_high'])} (p={it['additive_p']:.3f}) | {it['mult_p']:.3f} |")
        c = cells[(cells["indicator"] == key) & (cells["spec"] == "주 분석")]
        detail += [f"### {ind['label']} — {ind['dis']} vs {ind['adv']} (모형 n = {int(it['n_model']):,})", "",
                   "| 경제 집단 | " + " | ".join(BINS) + " |", "|---|" + "---|" * len(BINS)]
        for g in ind["groups"]:
            row = [c[(c["group"] == g) & (c["bin"] == b)].iloc[0] for b in BINS]
            detail.append(f"| {g} | " + " | ".join(f"{x['adj_prev'] * 100:.1f}% [{x['low'] * 100:.1f}, {x['high'] * 100:.1f}] (n={int(x['n']):,})" for x in row) + " |")
        detail += ["", f"불리 집단({ind['dis']})의 단계별 차이 (조정 유병률 차, %p [95% CI]; **굵게** = 유의하게 낮음):", "",
                   "| 불리 집단 단계 | ① vs 유리 0~2개 | ② vs 유리 전체 평균 | ③ vs 유리 같은 단계 |", "|---|---|---|---|"]
        for b in BINS:
            cols = []
            for comp in COMPS:
                x = rv[(rv["dis_bin"] == b) & (rv["compare_to"] == comp)].iloc[0]
                txt = fmt_ci(x["diff_pp"], x["low_pp"], x["high_pp"])
                cols.append(f"**{txt}**" if x["significantly_lower"] else txt)
            detail.append(f"| {b} | " + " | ".join(cols) + " |")
        detail += ["",
                   f"- 생활요인 0~2개 → 6~7개 감소 폭: {ind['dis']} {fmt_ci(it['drop_dis_pp'], it['drop_dis_low'], it['drop_dis_high'])}, "
                   f"{ind['adv']} {fmt_ci(it['drop_adv_pp'], it['drop_adv_low'], it['drop_adv_high'])} → 차이 {fmt_ci(it['additive_pp'], it['additive_low'], it['additive_high'])}, p = {it['additive_p']:.3f}",
                   f"- 생활요인 1개당 OR: {ind['dis']} {it['or_per_factor_dis']:.2f} [{it['or_dis_low']:.2f}, {it['or_dis_high']:.2f}], "
                   f"{ind['adv']} {it['or_per_factor_adv']:.2f} [{it['or_adv_low']:.2f}, {it['or_adv_high']:.2f}] (기울기 차이 p = {it['slope_interaction_p']:.3f})",
                   f"- 승법 상호작용(경제 × 생활요인 단계 결합 Wald): F = {it['mult_F']:.2f}, df = {int(it['mult_df'])}, p = {it['mult_p']:.3f}", ""]
    L += ["", "- 감소 폭 차이(가법) = (불리 집단의 0~2개→6~7개 변화) − (유리 집단의 같은 변화). 두 변화가 모두 음수(감소)이므로, **음수면 불리 집단에서 생활요인에 따른 유병률 감소 폭이 더 크다**는 뜻이다(%p 기준).",
          "", "![](fig_econ_lifestyle_lines.png)", "", "![](fig_econ_lifestyle_heatmap.png)", "", "## 지표별 상세", ""] + detail
    L += ["## 민감도: 소득 분석에 식품안정성·기초생활수급을 추가 조정",
          f"- 역전점 ① {s['reversal_1']}, ② {s['reversal_2']}; 감소 폭 차이 {fmt_ci(s['additive_pp'], s['additive_low'], s['additive_high'])} "
          f"(p = {s['additive_p']:.3f}); 승법 p = {s['mult_p']:.3f}",
          "- 소득이 같아도 식품 불안정·수급 여부가 따로 작용하는 부분을 걷어낸 결과다. 주 분석과 결론이 같은지 확인용.", "",
          "## 해석할 때 주의할 점",
          "- **인과가 아니다.** 우울하지 않은 사람이 생활습관을 잘 지키는 역인과, 불리 집단 중 생활요인을 많이 충족하는 사람이 원래 심리적으로 건강한 집단일 가능성(선택)을 배제할 수 없다. 결론은 \"상쇄와 일치하는 패턴이 관찰된다\" 수준으로 쓴다.",
          "- **생활요인 중 일부는 경제와 얽혀 있다.** 예를 들어 동네 안전 인식과 아침식사는 소득과 관련될 수 있다. 이 분석은 생활요인 개수를 하나의 묶음으로 본다.",
          "- **비교가 많다.** 3개 지표 × 5단계 × 3기준. 신뢰구간 끝이 0에 가까운 경계선 결과는 보수적으로 읽는다.",
          "- 칸 크기: 모든 칸 n ≥ 500(검증 assert).", "",
          "## 공식 문서에 반영한다면 (제안 — 탐색 단계 당시)",
          "- 위치: WORKFLOW_v2 5-2 뒤 \"5-3. 경제적 불리함을 생활요인이 상쇄하는가\", 노션 6-2 뒤, 논문 결과의 \"신체활동과 생활요인의 조합\" 뒤 하위 절 + 논의의 실천 제언·한계.",
          "- 반영 전 확인: 지표별로 결론이 다르면 어떤 지표를 주 결과로 할지 정해야 한다(사전에 정하지 않은 탐색 분석이라는 점을 명시).",
          f"- 분석 대상: Y 산출 가능 {n_total:,}명 중 경제 지표·생활요인·조정변수가 모두 있는 사람.",
          "- (이후 결정) v2 문서에 끼워 넣는 대신 독립 주제 v3로 재구성했다 — `docs/decision_log.md` D-33."]
    (OUT / "REPORT_econ_lifestyle.md").write_text("\n".join(L), encoding="utf-8")
    print("저장:", OUT / "REPORT_econ_lifestyle.md")


if __name__ == "__main__":
    main()
