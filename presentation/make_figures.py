"""발표용 그림 — 논문 그림과 같은 자료를 슬라이드 크기·글자에 맞춰 다시 그린다.

실행: python -X utf8 presentation/make_figures.py   (paper/build_paper_data.py 실행 후)
산출: presentation/figures/*.png
수치는 paper/paper_data.json에서만 읽는다. 색과 글꼴은 presentation/design/DESIGN.md를 따른다.
그림 크기(인치)는 슬라이드에 넣을 자리와 같게 잡아, 글자 크기(pt)가 화면에서 그대로 보이게 한다.
"""
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(__file__).resolve().parent / "figures"
OUT.mkdir(exist_ok=True)
D = json.loads((ROOT / "paper" / "paper_data.json").read_text(encoding="utf-8"))

# DESIGN.md 색
INK, MUTED, SOFT, RULE, PANEL = "#1D2430", "#5B6472", "#A9B2C0", "#E3E6EA", "#F3F5F8"
ML, REG, RISK = "#2F5FB3", "#1F8A5B", "#C2412D"

plt.rcParams.update({
    "font.family": "Malgun Gothic", "axes.unicode_minus": False, "savefig.dpi": 220,
    "font.size": 13, "text.color": INK, "axes.labelcolor": MUTED, "axes.edgecolor": RULE,
    "xtick.color": MUTED, "ytick.color": INK, "axes.spines.top": False, "axes.spines.right": False,
    "axes.spines.left": False, "axes.grid": False,
})


def save(fig, name):
    fig.savefig(OUT / name, dpi=220, facecolor="white")  # 자리 크기를 지키려고 bbox를 자르지 않는다
    plt.close(fig)
    print("그림:", OUT / name)


def xgrid(ax):
    ax.grid(axis="x", color=RULE, lw=0.8)
    ax.set_axisbelow(True)
    ax.tick_params(axis="y", length=0)
    ax.tick_params(axis="x", length=0, labelsize=11)


# ---------------------------------------------------------------- RQ2 조정 OR 신뢰구간(바꿀 수 있는 요인, 유형별 대표)
def forest():
    seen, rows = set(), {"B": [], "A": []}
    for o in D["or_modifiable"]:
        t = o["mod_type"]
        if o["or"] > 1 and o["name"] not in seen and "안 먹음" not in o["level"] and len(rows[t]) < 6:
            seen.add(o["name"])
            rows[t].append(o)
    label = {"식품안정성": "식품 불안정", "인지 체형": "인지 체형", "친구 연락": "친구 연락"}
    order = [("B", "서비스·정책·환경으로 개선"), ("A", "개인 행동")]
    fig, ax = plt.subplots(figsize=(8.3, 4.45))
    fig.subplots_adjust(left=0.36, right=0.86, top=0.97, bottom=0.12)
    y, ticks, labs = 0, [], []
    for t, head in order:
        ax.annotate(head, xy=(0, y - 0.1), xycoords=("axes fraction", "data"), xytext=(-8, 0), textcoords="offset points",
                    ha="right", va="center", fontsize=12, fontweight="bold", color=MUTED)
        y += 0.9
        for o in rows[t]:
            ax.plot([o["lo"], o["hi"]], [y, y], color=INK, lw=2, solid_capstyle="round")
            ax.plot(o["or"], y, marker="o" if t == "A" else "s", ms=9, mfc=INK if t == "A" else "white", mec=INK, mew=2)
            ax.text(o["hi"] * 1.04, y, f'{o["or"]:.2f}', va="center", fontsize=12, color=INK)
            ticks.append(y)
            labs.append(f'{label.get(o["name"], o["name"])}: {o["level"]}')
            y += 1
        y += 0.4
    ax.set_yticks(ticks, labs, fontsize=12.5)
    ax.set_ylim(y - 0.6, -0.5)
    ax.set_xscale("log")
    ax.set_xlim(0.9, 4.6)
    ax.set_xticks([1, 1.5, 2, 3, 4], ["1", "1.5", "2", "3", "4"])
    ax.minorticks_off()
    ax.axvline(1, color=MUTED, lw=1, ls=(0, (4, 3)))
    ax.set_xlabel("조정 오즈비 (95% CI, 로그축)", fontsize=11)
    xgrid(ax)
    save(fig, "rq2_forest.png")


# ---------------------------------------------------------------- RQ1 변수 수준: SHAP(ML) ↔ 결합검정 F(회귀) 나비 그림
def lenses():
    vt = {v["var"]: v for v in D["variable_tests"]}
    rank = {v["var"]: i + 1 for i, v in enumerate(sorted(D["variable_tests"], key=lambda v: -v["F"]))}
    top = [s for s in D["shap_top"] if s["feature"] in vt][:10]
    labels = {"log_met_min": "주간 신체활동량", "hl_explain": "의료진 설명 이해", "food_insecurity": "식품 불안정"}
    names = [labels.get(s["feature"], s["label"].replace("연간 ", "").replace("가구 ", "")) for s in top]
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(8.3, 4.45), sharey=True, gridspec_kw={"wspace": 0.62})
    fig.subplots_adjust(left=0.03, right=0.97, top=0.88, bottom=0.08)
    y = np.arange(len(top))
    a1.barh(y, [s["shap"] for s in top], color=ML, height=0.62)
    a1.invert_xaxis()
    a2.barh(y, [vt[s["feature"]]["F"] for s in top], color=REG, height=0.62)
    for i, s in enumerate(top):
        a1.text(s["shap"] + 0.004, i, f'{s["shap"]:.2f}', ha="right", va="center", fontsize=11, color=MUTED)
        F = vt[s["feature"]]["F"]
        a2.text(F + 3, i, f"{rank[s['feature']]}위", va="center", fontsize=11, color=MUTED)
    a1.set_yticks([])
    a1.set_ylim(len(top) - 0.5, -0.6)
    for i, n in enumerate(names):
        fig.text(0.5, a1.transData.transform((0, i))[1] / fig.dpi / fig.get_figheight(), n, ha="center", va="center", fontsize=12.5)
    a1.set_title("머신러닝  평균 |SHAP|", fontsize=12.5, color=ML, fontweight="bold", loc="right")
    a2.set_title("조사설계 회귀  결합검정 F", fontsize=12.5, color=REG, fontweight="bold", loc="left")
    a2.set_xlim(0, 200)
    for a in (a1, a2):
        xgrid(a)
        a.tick_params(axis="y", left=False)
    save(fig, "rq1_two_lenses.png")


# ---------------------------------------------------------------- RQ4 신체활동 × 생활요인 4칸 조정 유병률
def combos():
    cs = [c for c in D["combos"] if not c["proximal"]]
    short = {"담배제품 미사용": "담배제품 미사용", "고위험음주 아님": "고위험음주 아님", "아침식사 주 5회 이상": "아침식사 주 5회+",
             "사회적 연결": "사회적 연결", "저녁 후·잠자기 전 칫솔질": "잠자기 전 칫솔질"}
    fig, ax = plt.subplots(figsize=(8.3, 4.2))
    fig.subplots_adjust(left=0.25, right=0.97, top=0.86, bottom=0.13)
    for i, c in enumerate(cs):
        n = c["prev_neither"] * 100
        pa = n + c["pa_only_diff"] * 100
        fo = n + c["f_only_diff"] * 100
        b = c["prev_both"] * 100
        ax.plot([b, n], [i, i], color=RULE, lw=6, solid_capstyle="round", zorder=1)
        ax.scatter([n], [i], s=110, color="white", edgecolor=SOFT, lw=2, zorder=3)
        ax.scatter([pa], [i], s=70, marker="D", color=MUTED, zorder=3)
        ax.scatter([fo], [i], s=70, marker="D", color=SOFT, zorder=3)
        ax.scatter([b], [i], s=140, color=REG, zorder=4)
        ax.text(b - 0.12, i, f"{b:.1f}", ha="right", va="center", fontsize=12, fontweight="bold", color=REG)
        ax.text(n + 0.12, i, f"{n:.1f}", ha="left", va="center", fontsize=12, color=MUTED)
    ax.set_yticks(range(len(cs)), [short[c["partner"]] for c in cs], fontsize=13)
    ax.set_ylim(len(cs) - 0.5, -0.9)
    ax.set_xlim(1.2, 7.4)
    ax.set_xlabel("조정 유병률 (%)", fontsize=11)
    xgrid(ax)
    hs = [plt.Line2D([], [], marker="o", ls="", ms=11, color=REG, label="둘 다 충족"),
          plt.Line2D([], [], marker="D", ls="", ms=8, color=MUTED, label="신체활동만"),
          plt.Line2D([], [], marker="D", ls="", ms=8, color=SOFT, label="생활요인만"),
          plt.Line2D([], [], marker="o", ls="", ms=11, mfc="white", mec=SOFT, mew=2, label="둘 다 아님")]
    ax.legend(handles=hs, ncol=4, loc="lower left", bbox_to_anchor=(-0.02, 1.0), frameon=False, fontsize=11.5, handletextpad=0.3, columnspacing=1.2)
    save(fig, "rq4_combos.png")


# ---------------------------------------------------------------- RQ4 점수별 조정 유병률 + 하나씩 빼기
def score():
    num = lambda k: 1 if k.startswith("0~1") else int(k[0])
    fig, ax = plt.subplots(figsize=(7.2, 4.1))
    fig.subplots_adjust(left=0.1, right=0.97, top=0.95, bottom=0.14)
    main = D["counts"]
    x = [num(c["k"]) for c in main]
    ax.bar(x, [c["prev"] for c in main], color=REG, width=0.62, zorder=2)
    ax.errorbar(x, [c["prev"] for c in main], yerr=[[c["prev"] - c["lo"] for c in main], [c["hi"] - c["prev"] for c in main]],
                fmt="none", ecolor=INK, elinewidth=1.2, capsize=3, zorder=3)
    for c, xi in zip(main, x):
        ax.text(xi, c["hi"] + 0.25, f'{c["prev"]:.1f}', ha="center", fontsize=13, fontweight="bold")
    for sc in sorted({s["score"] for s in D["count_sens"]}):
        if not sc.endswith("제외"):
            continue
        r = [s for s in D["count_sens"] if s["score"] == sc]
        r = [s for s in r if num(s["k"]) >= 1]  # 0개 칸이 따로 있는 점수는 주 점수 축(0~1개부터)에 맞춰 1개부터 그린다
        ax.plot([num(s["k"]) for s in r], [s["prev"] for s in r], color=INK, lw=1, alpha=0.35, marker="o", ms=3, zorder=4)
    ax.set_xticks(x, [c["k"] for c in main], fontsize=12.5)
    ax.set_ylim(0, 11)
    ax.set_yticks([0, 2, 4, 6, 8, 10])
    ax.grid(axis="y", color=RULE, lw=0.8)
    ax.set_axisbelow(True)
    ax.tick_params(length=0, labelsize=11)
    ax.set_ylabel("조정 유병률 (%)", fontsize=11)
    ax.set_xlabel("충족한 건강 생활요인 수", fontsize=11)
    ax.text(4.6, 8.6, "회색 선 = 요인을 하나씩 뺀 점수 6가지", fontsize=11, color=MUTED, ha="center")
    save(fig, "rq4_score.png")


# ---------------------------------------------------------------- RQ3 연령대 × 영역 히트맵
def age_heat():
    dl, order = D["domain_labels"], ["phys", "care", "econ", "behav", "social", "env"]
    ages = [("19-39", "19~39세"), ("40-64", "40~64세"), ("65+", "65세 이상")]
    M = np.array([[D["age"][a][d]["d"] for a, _ in ages] for d in order])
    fig, ax = plt.subplots(figsize=(7.2, 4.35))
    fig.subplots_adjust(left=0.27, right=0.98, top=0.9, bottom=0.03)
    from matplotlib.colors import LinearSegmentedColormap
    cmap = LinearSegmentedColormap.from_list("ml", ["#FFFFFF", "#C9D8F3", ML])
    ax.imshow(M, cmap=cmap, vmin=0, vmax=M.max(), aspect="auto")
    for i in range(M.shape[0]):
        for j in range(M.shape[1]):
            top = M[i, j] == M[:, j].max()
            ax.text(j, i, f"+{M[i, j]:.3f}", ha="center", va="center", fontsize=14,
                    fontweight="bold" if top else "normal", color="white" if M[i, j] > 0.78 * M.max() else INK)
    ax.set_xticks(range(3), [l for _, l in ages], fontsize=13)
    ax.xaxis.tick_top()
    ax.set_yticks(range(len(order)), [dl[d] for d in order], fontsize=13)
    ax.tick_params(length=0)
    for s in ax.spines.values():
        s.set_visible(False)
    ax.set_xticks(np.arange(-0.5, 3), minor=True)
    ax.set_yticks(np.arange(-0.5, len(order)), minor=True)
    ax.grid(which="minor", color="white", lw=3)
    ax.tick_params(which="minor", length=0)
    save(fig, "rq3_age_heat.png")


if __name__ == "__main__":
    forest()
    lenses()
    combos()
    score()
    age_heat()
