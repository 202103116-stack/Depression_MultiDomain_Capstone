"""v4 그림 — 단계 A~E 집계 결과(outputs/v4/reports)만 읽어 그린다.

실행: .venv\\Scripts\\python src/v4/figures_v4.py   (combo_v4·combo_patterns_v4·train_cross_v4·train_weighted_v4·update_y5_v4 실행 후)
산출: outputs/v4/figures/fig_v4_01~08.png
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from common_v4 import V4_FIG, V4_REPORT
from combo_v4 import LABEL, LIFE_MAIN, SPORT_MAIN
from utils import INK, INK_MUTED, PALETTE, setup_matplotlib

R = lambda name: pd.read_csv(V4_REPORT / name)
SHORT = {"walk": "걷기", "aerobic": "중강도 이상 유산소", "strength": "근력운동", "pa_guide": "신체활동 권고",
         "tobacco": "담배 미사용", "alcohol": "고위험음주 아님", "breakfast": "아침식사", "social": "사회적 연결",
         "brushing": "저녁 칫솔질"}
BLUE, ORANGE, GREEN = PALETTE[0], PALETTE[1], PALETTE[2]


def save(fig, name):
    V4_FIG.mkdir(parents=True, exist_ok=True)
    fig.savefig(V4_FIG / name)


def fig_joint_heatmap(plt):
    """확인 세트 y5: 운동 4 × 생활요인 5의 결합 감소(%p)와 함께 충족률."""
    r = R("c1_rank_confirm.csv")
    r = r[(r.outcome == "y5") & (r.stratum == "전체")]
    M = r.pivot(index="a", columns="b", values="joint").reindex(index=list(SPORT_MAIN), columns=LIFE_MAIN)
    B = r.pivot(index="a", columns="b", values="both_pct").reindex(index=list(SPORT_MAIN), columns=LIFE_MAIN)
    fig, ax = plt.subplots(figsize=(9, 4.2))
    im = ax.imshow(-M.to_numpy(), cmap="Blues", vmin=0, vmax=9, aspect="auto")
    for i in range(M.shape[0]):
        for j in range(M.shape[1]):
            v = M.iat[i, j]
            ax.text(j, i - 0.12, f"{v:.1f}%p", ha="center", va="center", fontsize=11, fontweight="bold",
                    color="white" if -v > 5.5 else INK)
            ax.text(j, i + 0.22, f"함께 충족 {B.iat[i, j]:.0f}%", ha="center", va="center", fontsize=8,
                    color="white" if -v > 5.5 else INK_MUTED)
    ax.set_xticks(range(len(LIFE_MAIN)), [SHORT[x] for x in LIFE_MAIN])
    ax.set_yticks(range(len(SPORT_MAIN)), [SHORT[s] for s in SPORT_MAIN])
    ax.grid(False)
    cb = fig.colorbar(im, ax=ax, shrink=0.8)
    cb.set_label("결합 감소(%p, 클수록 진함)")
    ax.set_title("운동 × 생활요인을 함께 충족할 때의 우울 증상 감소 — 확인 세트, PHQ-9 ≥ 5", loc="left")
    fig.tight_layout()
    save(fig, "fig_v4_01_joint_heatmap.png")
    plt.close(fig)


def fig_spec_curve(plt):
    """탐색 세트 y5 시너지 대비(스포츠 특이성) 504개의 명세 곡선 + 후보 5개의 확인 세트 추정."""
    s = R("c1_specs.csv")
    s = s[(s.outcome == "y5") & (s.metric == "syn")].sort_values("contrast").reset_index(drop=True)
    cand = R("c1_candidates.csv")
    conf = R("c1_confirm.csv")
    conf = conf[conf.outcome == "y5"]
    key = lambda t: list(zip(t.stratum, t.sport, t.x))
    is_c = pd.Series(key(s)).isin(key(cand[cand.metric == "syn"])).to_numpy()
    sig = (s.hi < 0) | (s.lo > 0)
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(13, 4.6), gridspec_kw={"width_ratios": [3, 1.3]})
    x = np.arange(len(s))
    a1.vlines(x, s.lo, s.hi, color=np.where(sig, BLUE, "#c9c9c9"), lw=0.6)
    a1.scatter(x, s.contrast, s=6, color=np.where(sig, BLUE, "#9a9a9a"), zorder=3)
    a1.scatter(x[is_c], s.contrast[is_c], s=40, color=ORANGE, zorder=4, label="확인 세트로 보낸 후보 5개")
    a1.axhline(0, color=INK, lw=0.8)
    a1.set_xlabel(f"탐색 세트에서 시도한 명세 {len(s)}개 (층 9 × 운동 정의 7 × 생활요인 8), 대비 크기 순")
    a1.set_ylabel("스포츠 특이 시너지 대비(%p)\n음수 = 스포츠와 짝지을 때 더 줄어듦")
    a1.legend(loc="upper left", fontsize=9)
    a1.set_title("(a) 탐색: 시도한 모든 명세", loc="left")
    lab = [f"{st} · {SHORT.get(sp, LABEL.get(sp, sp))}+{SHORT[xx]}" for st, sp, xx in zip(conf.stratum, conf.sport, conf.x)]
    y = np.arange(len(conf))
    a2.hlines(y, conf.lo, conf.hi, color=ORANGE, lw=2)
    a2.scatter(conf.contrast, y, color=ORANGE, zorder=3)
    a2.axvline(0, color=INK, lw=0.8)
    a2.set_yticks(y, lab, fontsize=8)
    a2.invert_yaxis()
    a2.set_xlabel("확인 세트 대비(%p) · 95% CI")
    a2.set_title("(b) 확인: 후보 5개 모두 0 포함", loc="left")
    fig.tight_layout()
    save(fig, "fig_v4_02_spec_curve.png")
    plt.close(fig)


def fig_income_link(plt):
    """확인 세트 y5: 운동 + 사회적 연결의 결합 감소, 소득 하위 vs 상위 20%."""
    r = R("c1_rank_confirm.csv")
    r = r[(r.outcome == "y5") & (r.b == "social") & r.stratum.isin(["소득 하위 20%", "소득 상위 20%"])]
    pat = R("c1_patterns.csv")
    pat = pat[(pat.hypothesis.str.startswith("P2")) & (pat.outcome == "y5")].set_index("sport")
    fig, ax = plt.subplots(figsize=(9, 4.4))
    sports = list(SPORT_MAIN)
    for k, (st, c) in enumerate([("소득 하위 20%", ORANGE), ("소득 상위 20%", BLUE)]):
        q = r[r.stratum == st].set_index("a").reindex(sports)
        y = np.arange(len(sports)) + (k - 0.5) * 0.32
        ax.hlines(y, q.joint_lo, q.joint_hi, color=c, lw=2.2)
        ax.scatter(q.joint, y, color=c, s=45, zorder=3, label=st)
        for yi, v in zip(y, q.joint):
            ax.text(v, yi - 0.17, f"{v:.1f}", ha="center", fontsize=8, color=c)
    for i, s in enumerate(sports):
        p = pat.loc[s]
        ax.text(0.6, i, f"차이 {p.contrast:+.1f}%p\nHolm p={p.p_holm:.3f}", va="center", fontsize=8,
                color=INK if p.p_holm < 0.05 else INK_MUTED, fontweight="bold" if p.p_holm < 0.05 else "normal")
    ax.axvline(0, color=INK, lw=0.8)
    ax.set_yticks(range(len(sports)), [f"{SHORT[s]} + 사회적 연결" for s in sports])
    ax.invert_yaxis()
    ax.set_xlim(None, 4)
    ax.set_xlabel("함께 충족 시 우울 증상 감소(%p, 둘 다 충족 - 둘 다 아님) · 95% CI")
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.16), ncol=2, fontsize=9)
    ax.set_title("운동 + 사회적 연결의 감소 폭은 소득 하위 20%에서 더 크다 — 확인 세트, PHQ-9 ≥ 5", loc="left")
    fig.tight_layout()
    save(fig, "fig_v4_03_income_link.png")
    plt.close(fig)


def fig_cross(plt):
    c = R("c2_cross_outcome.csv")
    lab = {"y5": "PHQ-9 ≥ 5", "y_mood": "우울감 경험"}
    fig, axes = plt.subplots(1, 2, figsize=(10, 4))
    for ax, ev in zip(axes, ["y5", "y_mood"]):
        q = c[c.eval_target == ev].set_index("train_target").reindex(["y5", "y_mood"])
        x = np.arange(2)
        ax.bar(x, q.AP, color=[BLUE, GREEN], width=0.55)
        ax.errorbar(x, q.AP, yerr=[q.AP - q.AP_lo, q.AP_hi - q.AP], fmt="none", ecolor=INK, capsize=4)
        ax.axhline(q.prevalence.iloc[0], color=INK_MUTED, ls="--", lw=1)
        ax.text(1.45, q.prevalence.iloc[0], f"무작위 {q.prevalence.iloc[0]:.3f}", va="bottom", ha="right", fontsize=8)
        for xi, (ap, keep) in enumerate(zip(q.AP, q.AP_retained_pct)):
            ax.text(xi, ap + 0.02, f"{ap:.3f}\n({keep:.0f}%)", ha="center", fontsize=9)
        ax.set_xticks(x, [f"{lab[t]}로 학습" for t in ["y5", "y_mood"]])
        ax.set_ylim(0, max(q.AP_hi) * 1.3)
        ax.set_ylabel("시험셋 AP · 95% CI")
        ax.set_title(f"평가: {lab[ev]}", loc="left")
    fig.suptitle("다른 결과로 학습한 모델도 자기 결과 모델 AP의 92~93%를 회복한다 (괄호 = 회복률)", x=0.01, ha="left",
                 fontsize=12, fontweight="bold")
    fig.tight_layout()
    save(fig, "fig_v4_04_cross_outcome.png")
    plt.close(fig)


def fig_imbalance(plt):
    m = R("c2_imbalance.csv")
    lab = {"y5": "PHQ-9 ≥ 5", "y_mood": "우울감 경험"}
    methods = ["none", "balanced", "smotenc"]
    mlab = ["보정 없음", "클래스 가중치", "SMOTE-NC"]
    fig, axes = plt.subplots(1, 2, figsize=(10, 3.8))
    for k, (ax, col, title) in enumerate(zip(axes, ["AP", "OE"], ["판별력: AP", "보정: 관측/예측 비(1이 이상적)"])):
        for j, t in enumerate(["y5", "y_mood"]):
            q = m[m.target == t].set_index("method").reindex(methods)
            x = np.arange(3) + (j - 0.5) * 0.36
            ax.bar(x, q[col], width=0.34, color=[BLUE, GREEN][j], label=lab[t])
            for xi, v in zip(x, q[col]):
                ax.text(xi, v, f"{v:.2f}" if col == "OE" else f"{v:.3f}", ha="center", va="bottom", fontsize=8)
        if col == "OE":
            ax.axhline(1, color=INK, ls="--", lw=0.8)
        ax.set_xticks(range(3), mlab)
        ax.set_title(title, loc="left")
        if k == 0:
            ax.legend(fontsize=8)
    fig.suptitle("불균형 보정은 AP를 높이지 못하고 예측 확률을 왜곡한다 — 시험셋", x=0.01, ha="left", fontsize=12, fontweight="bold")
    fig.tight_layout()
    save(fig, "fig_v4_05_imbalance.png")
    plt.close(fig)


def fig_reversal(plt):
    cells = R("e2_rev_cells.csv")
    inter = R("e2_rev_interaction.csv")
    spec = [s for s in cells.spec.unique() if s.startswith("주")][0]
    cells, inter = cells[cells.spec == spec], inter[inter.spec == spec]
    bins = ["0~2개", "3개", "4개", "5개", "6개"]
    inds = [("income", "균등화 소득", "하위(1분위)", "상위(5분위)", "소득 하위 20%", "소득 상위 20%"),
            ("livelihood", "기초생활수급", "현재 수급", "비수급", "현재 수급", "비수급"),
            ("food", "가구 식품안정성", "불안정", "안정", "식품 불안정", "식품 안정")]
    fig, axes = plt.subplots(1, 3, figsize=(16, 4.8), sharey=True)
    for k, (ax, (key, title, dis, adv, dl, al)) in enumerate(zip(axes, inds)):
        sub = cells[cells.indicator == key]
        x = np.arange(len(bins))
        for g, c, l in ((dis, ORANGE, dl), (adv, BLUE, al)):
            s = sub[sub.group == g].set_index("bin").reindex(bins)
            ax.plot(x, s.adj_prev * 100, marker="o", lw=2, color=c, label=l)
            ax.fill_between(x, s.low * 100, s.high * 100, color=c, alpha=0.15, lw=0)
        a0 = sub[(sub.group == adv) & (sub.bin == "0~2개")].adj_prev.iloc[0] * 100
        it = inter[inter.indicator == key].iloc[0]
        ax.axhline(a0, color=BLUE, ls="--", lw=1)
        ax.text(len(bins) - 1, a0, f"{al} 0~2개 {a0:.1f}%", va="bottom", ha="right", fontsize=8)
        ax.axhline(it.adv_avg_prev * 100, color=BLUE, ls=":", lw=1)
        ax.text(len(bins) - 1, it.adv_avg_prev * 100, f"{al} 평균 {it.adv_avg_prev * 100:.1f}%", va="top", ha="right", fontsize=8)
        ax.set_xticks(x, bins)
        ax.set_xlabel("충족한 건강 생활요인 수 (신체활동 권고 + 5개)")
        ax.set_title(f"({'abc'[k]}) {title} — 역전 ① {it.reversal_1}, ② {it.reversal_2}, 가법 {it.additive_pp:+.1f}%p", loc="left", fontsize=10)
        ax.legend(fontsize=8, loc="upper right")
    axes[0].set_ylabel("조정 유병률(%) · 95% CI, PHQ-9 ≥ 5")
    fig.tight_layout()
    save(fig, "fig_v4_06_reversal_y5.png")
    plt.close(fig)


def fig_weighted(plt):
    m = R("c3_models.csv")
    fig, ax = plt.subplots(figsize=(9, 3.6))
    y = np.arange(len(m))
    ax.hlines(y, m.AP_lo, m.AP_hi, color=BLUE, lw=2)
    ax.scatter(m.AP, y, color=BLUE, zorder=3)
    for yi, row in zip(y, m.itertuples()):
        d = getattr(row, "dAP_vs_M1", np.nan)
        txt = f"{row.AP:.4f}" + ("" if pd.isna(d) else f"   ΔAP vs M1 {d:+.4f} [{row.dAP_vs_M1_lo:+.4f}, {row.dAP_vs_M1_hi:+.4f}]")
        ax.text(row.AP_hi + 0.002, yi, txt, va="center", fontsize=8)
    ax.set_yticks(y, m.model)
    ax.invert_yaxis()
    ax.set_xlim(m.AP_lo.min() - 0.01, m.AP_hi.max() + 0.06)
    ax.set_xlabel("시험셋 AP · 95% CI (PHQ-9 ≥ 5)")
    ax.set_title("스포츠 조합에 가중치를 준 모델의 예측 성능", loc="left")
    fig.tight_layout()
    save(fig, "fig_v4_07_weighted_models.png")
    plt.close(fig)


def fig_domains(plt):
    m = R("e1_ml_domains.csv")
    m = m[m.kind.isin(["단독", "고유"])]
    doms = m[m.kind == "단독"].sort_values("dAP", ascending=False).domain.tolist()
    lab = dict(zip(m.domain, m.domain_label))
    fig, ax = plt.subplots(figsize=(9, 4))
    for k, (kind, c) in enumerate([("단독", BLUE), ("고유", ORANGE)]):
        q = m[m.kind == kind].set_index("domain").reindex(doms)
        y = np.arange(len(doms)) + (k - 0.5) * 0.3
        ax.hlines(y, q.dAP_lo, q.dAP_hi, color=c, lw=2)
        ax.scatter(q.dAP, y, color=c, zorder=3, label=f"{kind} 기여")
    ax.axvline(0, color=INK, lw=0.8)
    ax.set_yticks(range(len(doms)), [lab[d] for d in doms])
    ax.invert_yaxis()
    ax.set_xlabel("ΔAP · 95% CI (CatBoost, 시험셋, PHQ-9 ≥ 5)")
    ax.legend(fontsize=9)
    ax.set_title("영역별 예측 기여 — 단독 = 인구 + 영역, 고유 = 전체 - 영역", loc="left")
    fig.tight_layout()
    save(fig, "fig_v4_08_domains_y5.png")
    plt.close(fig)


def fig_pair_ranks(plt):
    """1:1 조합 30쌍: (a) 전체 결합 감소 순위, (b) 소득 하위 vs 상위 20% 감소 폭(소득 차이 순). 운동 조합은 주황."""
    t = R("r_pairs.csv")
    t = t[t.outcome == "y5"].sort_values("joint")
    g = R("r_income_pairs.csv")
    g = g[g.outcome == "y5"].sort_values("gap")
    lab = lambda df: [f"{a} + {b}" for a, b in zip(df.a_label if "a_label" in df else df.pair.str.split(" \\+ ").str[0],
                                                    df.b_label if "b_label" in df else df.pair.str.split(" \\+ ").str[1])]
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(15, 9.5), gridspec_kw={"wspace": 0.55})
    y = np.arange(len(t))
    col = np.where(t.kind == "운동+일반", ORANGE, BLUE)
    a1.hlines(y, t.joint_lo, t.joint_hi, color=col, lw=2)
    a1.scatter(t.joint, y, color=col, zorder=3)
    a1.set_yticks(y, [f"{i}. {s}" for i, s in zip(t.rank_all, lab(t))], fontsize=8.5)
    a1.invert_yaxis()
    a1.set_xlabel("둘 다 충족 시 감소(%p) · 95% CI — 전체")
    a1.set_title("(a) 전체: 운동 조합(주황)은 최고 8위", loc="left")
    y = np.arange(len(g))
    col = np.where(g.kind == "운동+일반", ORANGE, BLUE)
    a2.hlines(y, g.low_joint, g.high_joint, color="#c9c9c9", lw=3, zorder=1)
    a2.scatter(g.low_joint, y, color=col, s=36, zorder=3, label="소득 하위 20%(채운 점)")
    a2.scatter(g.high_joint, y, facecolor="white", edgecolor=col, s=36, zorder=3, label="소득 상위 20%(빈 점)")
    for yi, v in zip(y, g.gap):
        a2.text(1.0, yi, f"{v:+.1f}", va="center", ha="right", fontsize=8, color=INK_MUTED)
    a2.set_yticks(y, [f"{i}. {s}" for i, s in zip(g.rank_gap, g.pair)], fontsize=8.5)
    a2.invert_yaxis()
    a2.set_xlim(None, 1.5)
    a2.set_xlabel("둘 다 충족 시 감소(%p) — 오른쪽 숫자 = 하위 - 상위 차이")
    a2.set_title("(b) 소득 차이 순: 2~7위가 모두 운동 조합", loc="left")
    a2.legend(loc="lower left", fontsize=8)
    fig.suptitle("1:1 생활요인 조합 30쌍의 우울 증상 감소(PHQ-9 ≥ 5, 전체 표본) — 주황 = 운동 포함 조합", x=0.01, ha="left",
                 fontsize=13, fontweight="bold")
    fig.tight_layout()
    save(fig, "fig_v4_09_pair_ranks.png")
    plt.close(fig)


def main():
    plt = setup_matplotlib()
    for fn in (fig_joint_heatmap, fig_spec_curve, fig_income_link, fig_cross, fig_imbalance, fig_reversal, fig_weighted, fig_domains,
               fig_pair_ranks):
        try:
            fn(plt)
            print("그림:", fn.__name__)
        except FileNotFoundError as e:
            print("건너뜀(결과 파일 없음):", fn.__name__, e.filename)


if __name__ == "__main__":
    main()
