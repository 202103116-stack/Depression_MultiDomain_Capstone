"""v3 민감도 분석 — 역전점·가법 상호작용 결론이 정의·조정·하위집단에 따라 유지되는가.

실행: python src/v3/sensitivity_v3.py   (reversal_v3.analyze 재사용)
산출: outputs/v3/reports/sens_summary.csv, sens_cells.csv, outputs/v3/figures/fig_v3_07_sensitivity.png

① 소득 분석에 식품안정성·기초생활수급 추가 조정
② 행동 요인만 센 개수(신체활동 권고·비흡연·고위험음주 아님·아침식사, 0~4) — 사회·환경 인식 요인의 역인과 우려 대응
③ 성별·연령대(19~39 / 40~64 / 65세 이상) 층화 — 칸 크기 때문에 생활요인 단계를 0~3 / 4 / 5 / 6~7로 묶음
④ 소득 불리 기준 변경: 1분위 vs 2~5분위
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from common_v3 import ADJ, ADJ_SENS, BIN_CUTS, BINS, V3_FIG, V3_REPORT, binned, indicators, lifestyle, load
from reversal_v3 import analyze
from utils import INK, INK_MUTED, PALETTE, setup_matplotlib

BEH_CUTS = [(0, 1, "0~1개"), (2, 2, "2개"), (3, 3, "3개"), (4, 4, "4개")]
STRAT_CUTS = [(0, 3, "0~3개"), (4, 4, "4개"), (5, 5, "5개"), (6, 7, "6~7개")]


def summarize(spec, group_label, key, cells, rev, it):
    top = cells["bin"].iloc[-1] if False else rev["dis_bin"].iloc[-1]
    same = rev[(rev["compare_to"] == "유리 집단 같은 단계") & (rev["dis_bin"] == top)].iloc[0]
    return {"spec": spec, "subgroup": group_label, "indicator": key, "n_model": it["n_model"], "min_cell_n": int(cells["n"].min()),
            "reversal_1": it["reversal_1"], "reversal_2": it["reversal_2"],
            "same_top_pp": same["diff_pp"], "same_top_low": same["low_pp"], "same_top_high": same["high_pp"],
            "drop_dis_pp": it["drop_dis_pp"], "drop_adv_pp": it["drop_adv_pp"],
            "additive_pp": it["additive_pp"], "additive_low": it["additive_low"], "additive_high": it["additive_high"],
            "additive_p": it["additive_p"], "mult_p": it["mult_p"],
            "or_per_factor_dis": it["or_per_factor_dis"], "or_per_factor_adv": it["or_per_factor_adv"]}


def main():
    d, r = load()
    ls = lifestyle(d)
    lbin = binned(ls["count7"], BIN_CUTS)
    inds = indicators(d)
    rows, cell_tabs = [], []

    def run(spec, sub_label, key, ind, b, cnt, adj, levels, mask=None):
        c, rv, it, _ = analyze(d, r, key, ind, b, cnt, adj, levels=levels, mask=mask, tag=f"{spec}|{sub_label}")
        rows.append(summarize(spec, sub_label, key, c, rv, it))
        cell_tabs.append(c)
        print(f"{spec:<22} {sub_label:<10} {key:<10} n={it['n_model']:>7,} 최소칸 {c['n'].min():>5,} "
              f"①{it['reversal_1']:<5} ②{it['reversal_2']:<5} 가법 {it['additive_pp']:+.2f} [{it['additive_low']:+.2f}, {it['additive_high']:+.2f}]")

    for key, ind in inds.items():  # 비교용 주 분석
        run("주 분석", "전체", key, ind, lbin, ls["count7"], ADJ, BINS)
    run("① +식품안정성·수급 조정", "전체", "income", inds["income"], lbin, ls["count7"], ADJ_SENS, BINS)
    bbin = binned(ls["beh4"], BEH_CUTS)
    for key, ind in inds.items():
        run("② 행동 요인 4개만", "전체", key, ind, bbin, ls["beh4"], ADJ, [c[2] for c in BEH_CUTS])
    sbin = binned(ls["count7"], STRAT_CUTS)
    slev = [c[2] for c in STRAT_CUTS]
    for lab, m in [("남성", d["sex"] == 1), ("여성", d["sex"] == 2), ("19~39세", d["age"].between(19, 39)),
                   ("40~64세", d["age"].between(40, 64)), ("65세 이상", d["age"] >= 65)]:
        run("③ 층화", lab, "income", inds["income"], sbin, ls["count7"], ADJ, slev, mask=m.to_numpy())
    alt = dict(inds["income"])
    alt["series"] = inds["income"]["series"].map({"하위(1분위)": "하위(1분위)", "중위(2~4분위)": "2~5분위", "상위(5분위)": "2~5분위"})
    alt["groups"], alt["adv"] = ["하위(1분위)", "2~5분위"], "2~5분위"
    run("④ 1분위 vs 2~5분위", "전체", "income", alt, lbin, ls["count7"], ADJ, BINS)

    summ = pd.DataFrame(rows)
    assert (summ["min_cell_n"] >= 100).all(), summ.loc[summ["min_cell_n"] < 100, ["spec", "subgroup", "min_cell_n"]]
    summ.to_csv(V3_REPORT / "sens_summary.csv", index=False, encoding="utf-8-sig", float_format="%.4f")
    pd.concat(cell_tabs).to_csv(V3_REPORT / "sens_cells.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    plot(summ)


def plot(summ):
    plt = setup_matplotlib()
    s = summ[summ["indicator"] == "income"].reset_index(drop=True)
    fig, ax = plt.subplots(figsize=(10, 4.8))
    y = np.arange(len(s))
    for i, row in s.iterrows():
        c = PALETTE[1] if row["spec"] == "주 분석" else PALETTE[0]
        ax.errorbar(row["additive_pp"], i, xerr=[[row["additive_pp"] - row["additive_low"]], [row["additive_high"] - row["additive_pp"]]],
                    fmt="o", color=c, capsize=3, ms=6)
        ax.text(max(s["additive_high"]) + 0.6, i, f"역전 ① {row['reversal_1']} · ② {row['reversal_2']}", va="center", fontsize=8, color=INK)
    ax.axvline(0, color=INK_MUTED, lw=1)
    ax.set_yticks(y, [f"{a} · {b}" if b != "전체" else a for a, b in zip(s["spec"], s["subgroup"])], fontsize=8.5)
    ax.invert_yaxis()
    ax.set_xlim(None, max(s["additive_high"]) + 6)
    ax.set_xlabel("가법 상호작용: 불리 - 유리 집단의 생활요인 최저→최고 단계 감소 폭 차이(%p) · 95% CI\n(음수 = 불리 집단에서 감소 폭이 더 큼)")
    ax.set_title("민감도 분석(소득): 감소 폭 차이와 역전점", loc="left", fontsize=12, fontweight="bold")
    fig.tight_layout()
    fig.savefig(V3_FIG / "fig_v3_07_sensitivity.png")
    plt.close(fig)


if __name__ == "__main__":
    main()
