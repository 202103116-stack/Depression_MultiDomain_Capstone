"""v3 스포츠·운동 요인 분석 — S1 운동 요인 누적 효과, S2 운동 종류 비교.

실행: python src/v3/exercise_v3.py
산출: outputs/v3/reports/ex_s1_cells.csv, ex_s1_standardized.csv, ex_s1_steps.csv, ex_s1_slope.csv, ex_count9_cells.csv,
      ex_s2_types.csv / outputs/v3/figures/fig_v3_08~11

S1: 운동 외 생활요인 6개(친구 연락·이웃 신뢰·비흡연·고위험음주 아님·아침식사·동네 안전)의 단계를 고정하고,
    운동 요인(걷기 실천·중강도 이상 유산소 실천·근력운동 주 2일 이상)을 0→3개로 늘릴 때 유병률이 얼마나 더 낮아지는가.
    경제 집단 × 운동 외 단계 × 운동 개수 교차 범주 모형 → 운동 외 단계를 전체 분포로 표준화한 조정 유병률.
S2: 세 운동을 한 모형에 서로 조정해 넣고 각각 × 경제 집단 → 집단별 실천 vs 미실천 유병률 차이와 그 차이의 차.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from common_v3 import (ADJ, EXERCISE, V3_FIG, V3_REPORT, CellModel, adj_design, binned, indicators, lifestyle, load,
                       survey_fit)
from utils import INK, INK_MUTED, PALETTE, setup_matplotlib

NB_INCOME = [(0, 2, "0~2개"), (3, 3, "3개"), (4, 4, "4개"), (5, 6, "5~6개")]
EX_INCOME = [(0, 0, "0개"), (1, 1, "1개"), (2, 2, "2개"), (3, 3, "3개")]
NB_SMALL = [(0, 4, "0~4개"), (5, 6, "5~6개")]  # 수급·식품: 불리 집단이 작아 단계를 묶음
EX_SMALL = [(0, 0, "0개"), (1, 1, "1개"), (2, 3, "2~3개")]
C9 = [(0, 3, "0~3"), (4, 4, "4"), (5, 5, "5"), (6, 6, "6"), (7, 7, "7"), (8, 8, "8"), (9, 9, "9")]


# ---------------------------------------------------------------------------
# S1 운동 요인 누적 효과
# ---------------------------------------------------------------------------
def s1(d, r, key, ind, ls, nb_cuts, ex_cuts):
    g, groups, dis, adv = ind["series"], ind["groups"], ind["dis"], ind["adv"]
    nb, ex = binned(ls["nonex6"], nb_cuts), binned(ls["ex3"], ex_cuts)
    nbl, exl = [c[2] for c in nb_cuts], [c[2] for c in ex_cuts]
    mask = np.ones(len(d), bool)
    Xadj = adj_design(r, ADJ, mask)
    cm = CellModel(d, Xadj, [(g, groups), (nb, nbl), (ex, exl)], (adv, nbl[0], exl[0]), mask)
    cells = cm.table(indicator=key).rename(columns={"f0": "group", "f1": "nonex", "f2": "ex"})
    pi = cm.share({}, axis=1)  # 운동 외 단계의 전체(도메인) 가중 분포로 표준화

    def std(a, e):
        return {(a, k, e): w for k, w in pi.items()}

    stdrows, steps = [], []
    for a in groups:
        for e in exl:
            est, lo, hi, _ = cm.ci(std(a, e))
            stdrows.append({"indicator": key, "group": a, "ex": e, "adj_prev": est, "low": lo, "high": hi})
    pairs = [(exl[i], exl[i + 1]) for i in range(len(exl) - 1)] + [(exl[0], exl[-1])]
    for e0, e1 in pairs:
        res = {}
        for a in (dis, adv):
            coefs = {**std(a, e1), **{c: -w for c, w in std(a, e0).items()}}
            res[a] = coefs
            est, lo, hi, p = cm.ci(coefs)
            steps.append({"indicator": key, "group": a, "step": f"{e0}→{e1}", "diff_pp": est * 100,
                          "low_pp": lo * 100, "high_pp": hi * 100, "p": p})
        dd = dict(res[dis])
        for c, w in res[adv].items():
            dd[c] = dd.get(c, 0.0) - w
        est, lo, hi, p = cm.ci(dd)
        steps.append({"indicator": key, "group": "차이(불리−유리)", "step": f"{e0}→{e1}", "diff_pp": est * 100,
                      "low_pp": lo * 100, "high_pp": hi * 100, "p": p})

    # 보조: 운동 개수 1개당 OR(운동 외 단계 조정) — 집단별 기울기와 차이
    ok = cm.domain
    X = Xadj.copy()
    for k in nbl[1:]:
        X[f"NB={k}"] = (nb == k).astype(float).where(ok)
    X["ex_count"] = ls["ex3"].where(ok)
    for a in groups:
        if a != adv:
            X[f"G={a}"] = (g == a).astype(float).where(ok)
            X[f"G={a}×ex_count"] = X[f"G={a}"] * X["ex_count"]
            for k in nbl[1:]:
                X[f"G={a}×NB={k}"] = X[f"G={a}"] * X[f"NB={k}"]
    m = survey_fit(X, d, ok)
    i_c, i_x = m.names.index("ex_count"), m.names.index(f"G={dis}×ex_count")
    b_adv, b_dis = m.beta[i_c], m.beta[i_c] + m.beta[i_x]
    se_dis = float(np.sqrt(m.vcov[i_c, i_c] + m.vcov[i_x, i_x] + 2 * m.vcov[i_c, i_x]))
    slope = {"indicator": key, "n_model": int(ok.sum()),
             "or_adv": np.exp(b_adv), "or_adv_low": np.exp(b_adv - 1.96 * m.se[i_c]), "or_adv_high": np.exp(b_adv + 1.96 * m.se[i_c]),
             "or_dis": np.exp(b_dis), "or_dis_low": np.exp(b_dis - 1.96 * se_dis), "or_dis_high": np.exp(b_dis + 1.96 * se_dis),
             "ratio_of_or": np.exp(m.beta[i_x]), "p_interaction": m.table().set_index("term").loc[f"G={dis}×ex_count", "p"]}
    return cells, pd.DataFrame(stdrows), pd.DataFrame(steps), slope


def count9(d, r, ind, ls):
    """사용자 원 아이디어의 시각화: 운동 외 6개 + 운동 3개 = 0~9개 확장 개수별 조정 유병률."""
    g, groups, adv = ind["series"], ind["groups"], ind["adv"]
    b = binned(ls["count9"], C9)
    lv = [c[2] for c in C9]
    mask = np.ones(len(d), bool)
    cm = CellModel(d, adj_design(r, ADJ, mask), [(g, groups), (b, lv)], (adv, lv[0]), mask)
    return cm.table(indicator="income").rename(columns={"f0": "group", "f1": "count9"})


# ---------------------------------------------------------------------------
# S2 운동 종류 비교
# ---------------------------------------------------------------------------
def s2(d, r, key, ind, ls, comps: list[str], label: str):
    g, groups, dis, adv = ind["series"], ind["groups"], ind["dis"], ind["adv"]
    nb = binned(ls["nonex6"], NB_INCOME)
    ok = g.notna().to_numpy() & nb.notna().to_numpy() & d[comps].notna().all(axis=1).to_numpy()
    X = adj_design(r, ADJ, ok).copy()
    for k in [c[2] for c in NB_INCOME][1:]:
        X[f"NB={k}"] = (nb == k).astype(float).where(ok)
    others = [a for a in groups if a != adv]
    for a in others:
        X[f"G={a}"] = (g == a).astype(float).where(ok)
    for c in comps:
        X[c] = d[c].where(ok)
        for a in others:
            X[f"G={a}×{c}"] = X[f"G={a}"] * X[c]
    m = survey_fit(X, d, ok)
    base = m.X.copy()

    def cf(a, comp, val):
        Xc = base.copy()
        if comp is not None:
            Xc[:, m.names.index(comp)] = val
        for a2 in others:
            Xc[:, m.names.index(f"G={a2}")] = float(a2 == a)
            for c in comps:
                Xc[:, m.names.index(f"G={a2}×{c}")] = float(a2 == a) * Xc[:, m.names.index(c)]
        return Xc

    rows = []
    for c in comps:
        eff = {}
        for a in (dis, adv):
            mg = m.margins({1: cf(a, c, 1.0), 0: cf(a, c, 0.0)})
            e1, e0 = mg[1], mg[0]
            eff[a] = (e1[0] - e0[0], e1[1] - e0[1])
            est, lo, hi, p = m.contrast(*eff[a])
            rows.append({"indicator": key, "model": label, "component": c, "group": a,
                         "prev_do": e1[0], "prev_not": e0[0], "diff_pp": est * 100, "low_pp": lo * 100, "high_pp": hi * 100, "p": p})
        est, lo, hi, p = m.contrast(eff[dis][0] - eff[adv][0], eff[dis][1] - eff[adv][1])
        rows.append({"indicator": key, "model": label, "component": c, "group": "차이(불리−유리)",
                     "prev_do": np.nan, "prev_not": np.nan, "diff_pp": est * 100, "low_pp": lo * 100, "high_pp": hi * 100, "p": p})
    return rows


# ---------------------------------------------------------------------------
# 그림
# ---------------------------------------------------------------------------
def plot_s1(std, steps, ind, path):
    plt = setup_matplotlib()
    fig, axes = plt.subplots(1, 2, figsize=(14, 5), gridspec_kw={"width_ratios": [1.1, 1]})
    ax = axes[0]
    sub = std[std["indicator"] == "income"]
    exl = list(dict.fromkeys(sub["ex"]))
    x = np.arange(len(exl))
    for gname, c in [(ind["dis"], PALETTE[1]), (groups_mid(ind), INK_MUTED), (ind["adv"], PALETTE[0])]:
        s = sub[sub["group"] == gname].set_index("ex").reindex(exl)
        ax.plot(x, s["adj_prev"] * 100, marker="o", lw=2, color=c, label=gname)
        ax.fill_between(x, s["low"] * 100, s["high"] * 100, color=c, alpha=0.15, lw=0)
        for xi, v in zip(x, s["adj_prev"] * 100):
            ax.text(xi + 0.05, v + 0.15, f"{v:.1f}", fontsize=8, color=c)
    ax.set_xticks(x, [f"운동 {e}" for e in exl])
    ax.set_xlabel("충족한 운동 요인 개수 (걷기 · 중강도 이상 유산소 · 근력운동)")
    ax.set_ylabel("조정 유병률(%) · 95% CI")
    ax.set_ylim(0, None)
    ax.legend(fontsize=8.5)
    ax.set_title("(a) 운동 외 생활요인 분포를 같게 맞춘 조정 유병률", loc="left")

    ax = axes[1]
    st = steps[steps["indicator"] == "income"]
    order = list(dict.fromkeys(st["step"]))
    w = 0.26
    for j, (gname, c) in enumerate([(ind["dis"], PALETTE[1]), (ind["adv"], PALETTE[0]), ("차이(불리−유리)", INK_MUTED)]):
        s = st[st["group"] == gname].set_index("step").reindex(order)
        xx = np.arange(len(order)) + (j - 1) * w
        ax.bar(xx, s["diff_pp"], w, color=c, alpha=0.85, label=gname.replace("−", "-"))
        ax.errorbar(xx, s["diff_pp"], yerr=[s["diff_pp"] - s["low_pp"], s["high_pp"] - s["diff_pp"]], fmt="none", color=INK, capsize=2, lw=1)
    ax.axhline(0, color=INK, lw=0.8)
    ax.set_xticks(range(len(order)), [f"운동 {o}" for o in order], fontsize=8.5)
    ax.set_ylabel("유병률 변화(%p) · 95% CI")
    ax.legend(fontsize=8.5, loc="lower left")
    ax.set_title("(b) 운동 요인을 하나씩 더할 때의 추가 변화", loc="left")
    fig.suptitle("S1. 운동 외 생활요인이 같을 때 운동 요인을 더하면 우울 증상 유병률이 더 낮아지는가 (균등화 소득)",
                 x=0.01, ha="left", fontsize=12.5, fontweight="bold")
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def groups_mid(ind):
    mids = [g for g in ind["groups"] if g not in (ind["dis"], ind["adv"])]
    return mids[0] if mids else None


def plot_s1_by_nonex(cells, ind, path):
    plt = setup_matplotlib()
    sub = cells[cells["indicator"] == "income"]
    nbl = list(dict.fromkeys(sub["nonex"]))
    exl = list(dict.fromkeys(sub["ex"]))
    fig, axes = plt.subplots(1, len(nbl), figsize=(16, 4.4), sharey=True)
    for ax, k in zip(axes, nbl):
        for gname, c in [(ind["dis"], PALETTE[1]), (ind["adv"], PALETTE[0])]:
            s = sub[(sub["group"] == gname) & (sub["nonex"] == k)].set_index("ex").reindex(exl)
            x = np.arange(len(exl))
            ax.plot(x, s["adj_prev"] * 100, marker="o", lw=2, color=c, label=gname)
            ax.fill_between(x, s["low"] * 100, s["high"] * 100, color=c, alpha=0.15, lw=0)
        ax.set_xticks(range(len(exl)), exl)
        ax.set_xlabel("운동 요인 개수")
        ax.set_title(f"운동 외 생활요인 {k}", loc="left", fontsize=10.5)
    axes[0].set_ylabel("조정 유병률(%) · 95% CI")
    axes[0].set_ylim(0, None)
    axes[0].legend(fontsize=8)
    fig.suptitle("S1 보충. 운동 외 생활요인 단계별로 본 운동 요인 개수와 조정 유병률 (균등화 소득)", x=0.01, ha="left",
                 fontsize=12.5, fontweight="bold")
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def plot_count9(c9, ind, path):
    plt = setup_matplotlib()
    lv = [c[2] for c in C9]
    fig, ax = plt.subplots(figsize=(10, 4.8))
    for gname, c in [(ind["dis"], PALETTE[1]), (groups_mid(ind), INK_MUTED), (ind["adv"], PALETTE[0])]:
        s = c9[c9["group"] == gname].set_index("count9").reindex(lv)
        x = np.arange(len(lv))
        ax.plot(x, s["adj_prev"] * 100, marker="o", lw=2, color=c, label=gname)
        ax.fill_between(x, s["low"] * 100, s["high"] * 100, color=c, alpha=0.15, lw=0)
    ax.set_xticks(range(len(lv)), lv)
    ax.set_xlabel("확장 생활요인 개수 (운동 외 6개 + 운동 3개)")
    ax.set_ylabel("조정 유병률(%) · 95% CI")
    ax.set_ylim(0, None)
    ax.legend(fontsize=8.5)
    ax.set_title("운동 요인을 따로 센 확장 생활요인 개수(0~9개)와 조정 유병률 (균등화 소득)", loc="left", fontsize=12, fontweight="bold")
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def plot_s2(types, ind, path):
    plt = setup_matplotlib()
    sub = types[(types["indicator"] == "income") & (types["model"] == "상호 조정")]
    names = dict(EXERCISE)
    comps = list(dict.fromkeys(sub["component"]))
    fig, ax = plt.subplots(figsize=(10, 4.6))
    w = 0.26
    for j, (gname, c) in enumerate([(ind["dis"], PALETTE[1]), (ind["adv"], PALETTE[0]), ("차이(불리−유리)", INK_MUTED)]):
        s = sub[sub["group"] == gname].set_index("component").reindex(comps)
        xx = np.arange(len(comps)) + (j - 1) * w
        ax.bar(xx, s["diff_pp"], w, color=c, alpha=0.85, label=gname.replace("−", "-"))
        ax.errorbar(xx, s["diff_pp"], yerr=[s["diff_pp"] - s["low_pp"], s["high_pp"] - s["diff_pp"]], fmt="none", color=INK, capsize=2, lw=1)
        for xi, v in zip(xx, s["diff_pp"]):
            ax.text(xi, v - 0.12, f"{v:+.1f}", ha="center", va="top", fontsize=7.5, color=INK)
    ax.axhline(0, color=INK, lw=0.8)
    ax.set_xticks(range(len(comps)), [names[c] for c in comps])
    ax.set_ylabel("실천 - 미실천 조정 유병률 차이(%p) · 95% CI")
    ax.legend(fontsize=8.5, loc="lower right")
    ax.set_title("S2. 운동 종류별 실천과 관련된 유병률 차이 (세 운동 상호 조정, 균등화 소득)", loc="left", fontsize=12, fontweight="bold")
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def main():
    d, r = load()
    ls = lifestyle(d)
    inds = indicators(d)
    cells_all, std_all, steps_all, slopes = [], [], [], []
    for key, ind in inds.items():
        nbc, exc = (NB_INCOME, EX_INCOME) if key == "income" else (NB_SMALL, EX_SMALL)
        c, st, sp, sl = s1(d, r, key, ind, ls, nbc, exc)
        assert (c["n"] >= 100).all(), f"S1 {key}: 100명 미만 칸 {c.loc[c['n'] < 100, ['group', 'nonex', 'ex', 'n']].to_dict('records')}"
        cells_all.append(c); std_all.append(st); steps_all.append(sp); slopes.append(sl)
        tot = sp[sp["step"].str.startswith(exc[0][2]) & sp["step"].str.endswith(exc[-1][2])]
        print(f"S1 [{ind['label']}] " + " / ".join(f"{t.group} {t.diff_pp:+.2f} [{t.low_pp:+.2f}, {t.high_pp:+.2f}]" for t in tot.itertuples())
              + f" | OR/운동 불리 {sl['or_dis']:.2f} 유리 {sl['or_adv']:.2f} p={sl['p_interaction']:.3f}")
    cells, std, steps = pd.concat(cells_all), pd.concat(std_all), pd.concat(steps_all)
    c9 = count9(d, r, inds["income"], ls)
    assert (c9["n"] >= 100).all()

    comps = [c for c, _ in EXERCISE]
    rows = []
    for key, ind in inds.items():
        rows += s2(d, r, key, ind, ls, comps, "상호 조정")
        for c in comps:
            rows += s2(d, r, key, ind, ls, [c], "단독")
    types = pd.DataFrame(rows)
    print(types[(types["indicator"] == "income") & (types["model"] == "상호 조정")][["component", "group", "diff_pp", "low_pp", "high_pp", "p"]].round(3))

    cells.to_csv(V3_REPORT / "ex_s1_cells.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    std.to_csv(V3_REPORT / "ex_s1_standardized.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    steps.to_csv(V3_REPORT / "ex_s1_steps.csv", index=False, encoding="utf-8-sig", float_format="%.4f")
    pd.DataFrame(slopes).to_csv(V3_REPORT / "ex_s1_slope.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    c9.to_csv(V3_REPORT / "ex_count9_cells.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    types.to_csv(V3_REPORT / "ex_s2_types.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    plot_s1(std, steps, inds["income"], V3_FIG / "fig_v3_08_exercise_stack.png")
    plot_s1_by_nonex(cells, inds["income"], V3_FIG / "fig_v3_09_exercise_by_nonex.png")
    plot_count9(c9, inds["income"], V3_FIG / "fig_v3_10_count9.png")
    plot_s2(types, inds["income"], V3_FIG / "fig_v3_11_exercise_types.png")
    print("저장:", V3_REPORT)


if __name__ == "__main__":
    main()
