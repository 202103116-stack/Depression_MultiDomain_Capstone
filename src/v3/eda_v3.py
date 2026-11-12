"""v3 EDA — 경제 집단별 표본 특성, 우울 증상 유병률, 건강 생활요인 분포("노출 격차").

실행: python src/v3/eda_v3.py
산출: outputs/v3/reports/eda_table1.csv, eda_prev_by_econ.csv, eda_factor_rates.csv, eda_count_dist.csv
      outputs/v3/figures/fig_v3_01_flow.png, fig_v3_02_prev_by_econ.png, fig_v3_03_lifestyle_by_econ.png
비율은 모두 가중(wt_p). 연령 표준화는 전체 분석 대상의 연령대(recode.age_grp) 가중 분포를 표준 인구로 쓴 직접 표준화.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from common_v3 import (BIN_CUTS, BINS, EXERCISE, NONEX, V3_FIG, V3_REPORT, binned, income_quintile, indicators,
                       lifestyle, load)
from utils import INK, INK_MUTED, PALETTE, load_raw, setup_matplotlib

T1_VARS = [("sex", "성별"), ("age_grp", "연령"), ("educ", "교육수준"), ("marital", "혼인상태"), ("hh_type", "세대유형"),
           ("livelihood", "기초생활수급"), ("food_insecurity", "식품안정성"), ("occupation", "직업"), ("htn", "고혈압"),
           ("dm", "당뇨병"), ("urban_type", "동/읍면")]


def wmean(y, w):
    m = y.notna() & w.notna()
    return float(np.average(y[m], weights=w[m])) if m.any() else np.nan


def table1(d, r, g, groups):
    rows = []
    cols = {"전체": pd.Series(True, index=d.index)} | {a: g == a for a in groups}
    rows.append({"var": "n(비가중)", "level": "", **{k: int(m.sum()) for k, m in cols.items()}})
    rows.append({"var": "우울 증상(PHQ-9≥10)", "level": "가중 %", **{k: wmean(d.loc[m, "Y"], d.loc[m, "wt_p"]) * 100 for k, m in cols.items()}})
    rows.append({"var": "연령", "level": "가중 평균(세)", **{k: wmean(d.loc[m, "age"], d.loc[m, "wt_p"]) for k, m in cols.items()}})
    for v, name in T1_VARS:
        x = r[v]
        for lv in sorted(x.dropna().unique(), key=str):
            rows.append({"var": name, "level": lv, **{k: wmean((x[m] == lv).astype(float).where(x[m].notna()), d.loc[m, "wt_p"]) * 100
                                                      for k, m in cols.items()}})
    return pd.DataFrame(rows)


def factor_rates(d, r, ls, inds):
    """경제 집단별 생활요인 충족률 — 가중 조율과 연령 표준화율."""
    facs = [("pa_guideline", "신체활동 권고 충족", d["pa_guideline"])] + [(n, n, fn(d)) for n, fn in NONEX] \
        + [(c, lab, d[c]) for c, lab in EXERCISE]
    age = r["age_grp"]
    std_w = d.groupby(age)["wt_p"].sum()
    std_w = std_w / std_w.sum()
    rows = []
    for key, ind in inds.items():
        for gname in ind["groups"]:
            m = ind["series"] == gname
            for code, lab, x in facs:
                crude = wmean(x[m], d.loc[m, "wt_p"])
                by_age = {a: wmean(x[m & (age == a)], d.loc[m & (age == a), "wt_p"]) for a in std_w.index}
                agestd = sum(std_w[a] * v for a, v in by_age.items() if not np.isnan(v))
                rows.append({"indicator": key, "group": gname, "factor": code, "label": lab, "crude": crude, "age_std": agestd})
            cnt = ls["count7"][m]
            rows.append({"indicator": key, "group": gname, "factor": "count7_mean", "label": "생활요인 개수 평균(0~7)",
                         "crude": wmean(cnt, d.loc[m, "wt_p"]),
                         "age_std": sum(std_w[a] * wmean(ls["count7"][m & (age == a)], d.loc[m & (age == a), "wt_p"]) for a in std_w.index)})
    return pd.DataFrame(rows)


def count_dist(d, ls, inds):
    lbin = binned(ls["count7"], BIN_CUTS)
    rows = []
    for key, ind in inds.items():
        for gname in ind["groups"]:
            m = (ind["series"] == gname) & lbin.notna()
            w = d.loc[m, "wt_p"]
            for b in BINS:
                rows.append({"indicator": key, "group": gname, "bin": b, "n": int((lbin[m] == b).sum()),
                             "share": float(w[lbin[m] == b].sum() / w.sum())})
    return pd.DataFrame(rows)


def prev_by_econ(d, r):
    iq = income_quintile(d)
    rows = []
    for lab, s, order in [("균등화 소득 5분위", iq.map({1: "1분위(하)", 2: "2분위", 3: "3분위", 4: "4분위", 5: "5분위(상)"}),
                           ["1분위(하)", "2분위", "3분위", "4분위", "5분위(상)"]),
                          ("기초생활수급", r["livelihood"], ["아님", "과거 수급", "현재 수급"]),
                          ("가구 식품안정성", r["food_insecurity"], ["충분·다양", "충분·단조", "가끔 부족", "자주 부족"])]:
        for lv in order or sorted(s.dropna().unique(), key=str):
            m = s == lv
            rows.append({"indicator": lab, "level": lv, "n": int(m.sum()), "events": int(d.loc[m, "Y"].sum()),
                         "prev_w": wmean(d.loc[m, "Y"], d.loc[m, "wt_p"])})
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
def plot_flow(n_raw, n_y, n_models, path):
    plt = setup_matplotlib()
    fig, ax = plt.subplots(figsize=(8, 5.2))
    ax.axis("off")
    boxes = [(0.5, 0.90, f"2025 지역사회건강조사 원시자료\nn = {n_raw:,}"),
             (0.5, 0.62, f"PHQ-9 9문항 모두 응답(결과변수 산출 가능)\nn = {n_y:,}"),
             (0.5, 0.25, "주 분석 모형(경제 지표·생활요인 7개·조정변수 완전 응답)\n"
                         + "\n".join(f"{k}: n = {v:,}" for k, v in n_models.items()))]
    for x, y, t in boxes:
        ax.text(x, y, t, ha="center", va="center", fontsize=10.5, color=INK,
                bbox=dict(boxstyle="round,pad=0.6", fc="#f4f7fb", ec=PALETTE[0], lw=1.2))
    ax.annotate("", xy=(0.5, 0.70), xytext=(0.5, 0.82), arrowprops=dict(arrowstyle="->", color=INK_MUTED, lw=1.3))
    ax.annotate("", xy=(0.5, 0.40), xytext=(0.5, 0.54), arrowprops=dict(arrowstyle="->", color=INK_MUTED, lw=1.3))
    ax.text(0.55, 0.76, f"제외: PHQ-9 결측 {n_raw - n_y:,}명", fontsize=9, color=INK_MUTED, va="center")
    miss = [(1 - v / n_y) * 100 for v in n_models.values()]
    ax.text(0.55, 0.47, f"제외: 지표별 경제 변수·생활요인·\n조정변수 결측(지표별 {min(miss):.1f}~{max(miss):.1f}%)", fontsize=9,
            color=INK_MUTED, va="center")
    fig.savefig(path)
    plt.close(fig)


def plot_prev(prev, path):
    plt = setup_matplotlib()
    fig, axes = plt.subplots(1, 3, figsize=(15, 4.2), gridspec_kw={"width_ratios": [5, 3, 4]})
    for k, (ax, lab) in enumerate(zip(axes, ["균등화 소득 5분위", "기초생활수급", "가구 식품안정성"])):
        s = prev[prev["indicator"] == lab]
        bars = ax.bar(range(len(s)), s["prev_w"] * 100, color=[PALETTE[1] if i == 0 else PALETTE[0] for i in range(len(s))]
                      if k == 0 else PALETTE[0], alpha=0.85)
        for b, v, n in zip(bars, s["prev_w"] * 100, s["n"]):
            ax.text(b.get_x() + b.get_width() / 2, v + 0.6, f"{v:.1f}%\n(n={n:,})", ha="center", fontsize=8, color=INK)
        ax.set_xticks(range(len(s)), s["level"], fontsize=8.5)
        ax.set_ylim(0, prev["prev_w"].max() * 100 * 1.25)
        ax.set_ylabel("가중 유병률(%)")
        ax.set_title(f"({'abc'[k]}) {lab}", loc="left")
    fig.suptitle("경제 지표별 우울 증상(PHQ-9 ≥ 10) 가중 유병률(비조정)", x=0.01, ha="left", fontsize=13, fontweight="bold")
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def plot_lifestyle(rates, dist, inds, path):
    plt = setup_matplotlib()
    ind = inds["income"]
    fig, axes = plt.subplots(1, 2, figsize=(15, 5.2), gridspec_kw={"width_ratios": [1.25, 1]})
    ax = axes[0]
    sub = rates[(rates["indicator"] == "income") & (rates["factor"] != "count7_mean")]
    labs = list(dict.fromkeys(sub["label"]))
    y = np.arange(len(labs))
    for gname, c, off in [(ind["dis"], PALETTE[1], -0.15), (ind["adv"], PALETTE[0], 0.15)]:
        s = sub[sub["group"] == gname].set_index("label").reindex(labs)
        ax.scatter(s["age_std"] * 100, y + off, color=c, s=40, label=f"{gname} · 연령 표준화", zorder=3)
        ax.scatter(s["crude"] * 100, y + off, facecolors="none", edgecolors=c, s=40, label=f"{gname} · 조율", zorder=3)
    ax.set_yticks(y, labs, fontsize=8.5)
    ax.invert_yaxis()
    ax.axhline(6.5, color=INK_MUTED, lw=0.8, ls=":")
    ax.text(0.01, 6.45, "▼ 아래 3개: 신체활동 권고를 이루는 운동 요인(S1·S2 분석용)", fontsize=7.5, color=INK_MUTED, va="bottom",
            ha="left", transform=ax.get_yaxis_transform())
    ax.set_xlabel("가중 충족률(%)")
    ax.legend(fontsize=7.5, loc="lower right")
    ax.set_title("(a) 소득 하위·상위 집단의 생활요인별 충족률", loc="left")

    ax = axes[1]
    order = []
    for key, i2 in inds.items():
        order += [(key, i2["dis"], f"{i2['short']} · {i2['dis']}"), (key, i2["adv"], f"{i2['short']} · {i2['adv']}")]
    colors = ["#c9d9f2", "#9dbbe6", "#6c98d8", "#3b74c6", "#1d4f99"]
    left = np.zeros(len(order))
    for j, b in enumerate(BINS):
        vals = np.array([dist[(dist["indicator"] == k) & (dist["group"] == gname) & (dist["bin"] == b)]["share"].iloc[0] * 100
                         for k, gname, _ in order])
        ax.barh(range(len(order)), vals, left=left, color=colors[j], label=b)
        for i, (v, l0) in enumerate(zip(vals, left)):
            if v > 7:
                ax.text(l0 + v / 2, i, f"{v:.0f}", ha="center", va="center", fontsize=7.5, color="white" if j >= 2 else INK)
        left += vals
    ax.set_yticks(range(len(order)), [o[2] for o in order], fontsize=8.5)
    ax.invert_yaxis()
    ax.set_xlim(0, 100)
    ax.set_xlabel("가중 분포(%)")
    ax.legend(fontsize=7.5, ncol=5, loc="upper center", bbox_to_anchor=(0.5, -0.13), title="충족한 생활요인 개수(7개 중)", title_fontsize=8)
    ax.set_title("(b) 경제 집단별 생활요인 개수 분포(조율)", loc="left")
    fig.suptitle("경제 집단별 건강 생활요인 충족 현황", x=0.01, ha="left", fontsize=13, fontweight="bold")
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def main():
    d, r = load()
    ls = lifestyle(d)
    inds = indicators(d)
    t1 = table1(d, r, inds["income"]["series"], inds["income"]["groups"])
    prev = prev_by_econ(d, r)
    rates = factor_rates(d, r, ls, inds)
    dist = count_dist(d, ls, inds)
    assert dist.groupby(["indicator", "group"])["share"].sum().between(0.9999, 1.0001).all()
    prev_q = prev[prev["indicator"] == "균등화 소득 5분위"]["prev_w"]
    assert prev_q.iloc[0] == prev_q.max(), "소득 1분위 유병률이 최고가 아님"

    t1.to_csv(V3_REPORT / "eda_table1.csv", index=False, encoding="utf-8-sig", float_format="%.2f")
    prev.to_csv(V3_REPORT / "eda_prev_by_econ.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    rates.to_csv(V3_REPORT / "eda_factor_rates.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    dist.to_csv(V3_REPORT / "eda_count_dist.csv", index=False, encoding="utf-8-sig", float_format="%.5f")

    n_raw = len(load_raw()[["exmprs_no"]]) if False else 231615  # 원시자료 행 수(data_dictionary·v2 describe로 확인된 값)
    inter = pd.read_csv(V3_REPORT / "rev_interaction.csv")
    n_models = {inds[k]["label"]: int(v) for k, v in zip(inter["indicator"], inter["n_model"])}
    plot_flow(n_raw, len(d), n_models, V3_FIG / "fig_v3_01_flow.png")
    plot_prev(prev, V3_FIG / "fig_v3_02_prev_by_econ.png")
    plot_lifestyle(rates, dist, inds, V3_FIG / "fig_v3_03_lifestyle_by_econ.png")
    print(prev.round(4).to_string())
    print(rates[rates["indicator"] == "income"].round(3).to_string())
    print("저장:", V3_REPORT)


if __name__ == "__main__":
    main()
