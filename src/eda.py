"""체계적 EDA — 기초 / 이변량 / 심화(층화·결측) 시각화.

실행: python src/eda.py   (preprocess.py 실행 후)
산출: outputs/figures/eda_*.png, outputs/reports/eda_*.csv

원칙
- 모집단 수준 비율(“한국 성인의 몇 %”)은 개인가중치 wt_p를 적용한 가중 비율로 표시한다.
  (설계 기반 신뢰구간은 산출하지 않음 — 막대 위 숫자는 점추정치)
- 표본 수(N)는 비가중 인원으로 표시한다.
- 여러 그림을 함께 봐야 하는 경우 subplot 그리드 하나의 figure로 묶는다.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from utils import (COMBO_LABELS, CONTACT_LABELS, FIG_DIR, GRID, INK, INK_MUTED, PALETTE, REPORT_DIR,
                   load_analysis_table, setup_matplotlib)

plt = setup_matplotlib()

COMBO_ORDER = list(COMBO_LABELS.values())
COMBO_COLORS = dict(zip(COMBO_ORDER, PALETTE[:4]))
BLUE = PALETTE[0]

EDUC_LABELS = {1: "무학", 2: "초졸", 3: "중졸", 4: "고졸", 5: "대졸 이상"}
MARITAL_LABELS = {1: "배우자 동거", 2: "배우자 별거", 3: "사별", 4: "이혼", 5: "미혼"}
HH_LABELS = {1: "1인", 2: "부부", 3: "기타1세대", 4: "부부+자녀", 5: "한부모+자녀", 6: "기타2세대", 7: "3세대"}


# ---------------------------------------------------------------------------
# 헬퍼
# ---------------------------------------------------------------------------
def wmean(x: pd.Series, w: pd.Series) -> float:
    m = x.notna()
    return float(np.average(x[m], weights=w[m])) if m.any() else np.nan


def wshare(cat: pd.Series, w: pd.Series, order) -> pd.Series:
    """범주별 가중 구성비(%)."""
    m = cat.notna()
    tot = w[m].sum()
    return pd.Series({k: w[m & (cat == k)].sum() / tot * 100 for k in order})


def wrate_by(df: pd.DataFrame, by, y="Y") -> pd.DataFrame:
    """그룹별 가중 양성률(%)과 비가중 N."""
    g = df.groupby(by, observed=True)
    out = pd.DataFrame({
        "N": g.size(),
        "Y1": g[y].sum(),
        "rate_w": g.apply(lambda d: wmean(d[y], d["wt_p"]) * 100, include_groups=False),
        "rate_unw": g[y].mean() * 100,
    })
    return out


def bar_labels(ax, bars, fmt="{:.1f}%", inside=False):
    for b in bars:
        h = b.get_height()
        if np.isnan(h):
            continue
        ax.annotate(fmt.format(h), (b.get_x() + b.get_width() / 2, h),
                    xytext=(0, 2), textcoords="offset points", ha="center", va="bottom",
                    fontsize=8, color=INK)


def hbar_share(ax, share: pd.Series, title: str, color=BLUE):
    bars = ax.barh(range(len(share)), share.values, color=color, height=0.6)
    ax.set_yticks(range(len(share)), share.index)
    ax.invert_yaxis()
    ax.set_title(title, loc="left")
    ax.set_xlabel("가중 구성비(%)")
    ax.grid(axis="y", visible=False)
    for i, v in enumerate(share.values):
        ax.text(v, i, f" {v:.1f}%", va="center", fontsize=8, color=INK)
    ax.set_xlim(0, share.max() * 1.25)


def save(fig, name: str):
    FIG_DIR.mkdir(parents=True, exist_ok=True)
    fig.savefig(FIG_DIR / name)
    plt.close(fig)
    print("저장:", FIG_DIR / name)


# ---------------------------------------------------------------------------
# 1. 기초 EDA
# ---------------------------------------------------------------------------
def fig_outcome_and_key_x(df: pd.DataFrame, sample: pd.DataFrame):
    """Y 분포 + 핵심 X(활동조합, 연락빈도 3종) 분포."""
    fig, axes = plt.subplots(2, 3, figsize=(15, 8.5))
    w = df["wt_p"]

    # (a) PHQ-9 총점 분포
    ax = axes[0, 0]
    tot = df["phq9_total"].dropna()
    counts = tot.value_counts().sort_index()
    ax.bar(counts.index, counts.values, color=[PALETTE[1] if k >= 10 else BLUE for k in counts.index], width=0.8)
    ax.axvline(9.5, color=INK_MUTED, ls="--", lw=1)
    ax.text(10, counts.max() * 0.8, "컷오프 10점\n(Y=1)", fontsize=8, color=INK)
    ax.set_yscale("log")
    ax.set_title("(a) PHQ-9 총점 분포 (비가중 인원, 로그축)", loc="left")
    ax.set_xlabel("PHQ-9 총점")
    ax.set_ylabel("인원")

    # (b) 양성률: 비가중 vs 가중
    ax = axes[0, 1]
    yv = df[df["Y"].notna()]
    vals = [yv["Y"].mean() * 100, wmean(yv["Y"], yv["wt_p"]) * 100]
    bars = ax.bar(["비가중", "가중(wt_p)"], vals, color=[INK_MUTED, BLUE], width=0.5)
    bar_labels(ax, bars, "{:.2f}%")
    ax.set_ylim(0, max(vals) * 1.3)
    ax.set_title(f"(b) 우울 증상 기준 충족률 (N={len(yv):,})", loc="left")
    ax.set_ylabel("Y=1 비율(%)")
    ax.grid(axis="x", visible=False)

    # (c) 활동조합 구성비
    share = wshare(sample["activity_combo"], sample["wt_p"], COMBO_LABELS.keys())
    share.index = COMBO_ORDER
    ax = axes[0, 2]
    bars = ax.barh(range(4), share.values, color=[COMBO_COLORS[c] for c in COMBO_ORDER], height=0.6)
    ax.set_yticks(range(4), COMBO_ORDER)
    ax.invert_yaxis()
    for i, v in enumerate(share.values):
        ax.text(v, i, f" {v:.1f}%", va="center", fontsize=8, color=INK)
    ax.set_xlim(0, share.max() * 1.25)
    ax.set_title("(c) 활동조합 4분류 가중 구성비", loc="left")
    ax.set_xlabel("가중 구성비(%)")
    ax.grid(axis="y", visible=False)

    # (d)~(f) 연락빈도
    for ax, col, name in zip(axes[1], ["contact_friend", "contact_family", "contact_neighbor"],
                             ["(d) 친구와 연락 빈도 [주 조절변수]", "(e) 친척과 연락 빈도", "(f) 이웃과 연락 빈도"]):
        s = wshare(df[col], w, CONTACT_LABELS.keys())
        s.index = CONTACT_LABELS.values()
        hbar_share(ax, s, name, color=BLUE if col == "contact_friend" else INK_MUTED)

    fig.suptitle("기초 EDA ① 결과변수와 핵심 X변수 분포", x=0.01, ha="left", fontsize=14, fontweight="bold")
    fig.tight_layout()
    save(fig, "eda_01_outcome_keyx.png")


def fig_controls(df: pd.DataFrame):
    fig, axes = plt.subplots(3, 3, figsize=(15, 11))
    w = df["wt_p"]

    ax = axes[0, 0]
    ax.hist(df["age"], bins=range(19, 106, 3), weights=w / w.sum() * 100, color=BLUE, edgecolor="white")
    ax.set_title("(a) 연령 분포", loc="left"); ax.set_xlabel("만 나이"); ax.set_ylabel("가중 비율(%)")

    ax = axes[0, 1]
    s = wshare(df["sex"], w, [1, 2]); s.index = ["남자", "여자"]
    hbar_share(ax, s, "(b) 성별")

    ax = axes[0, 2]
    s = wshare(df["educ"], w, EDUC_LABELS.keys()); s.index = EDUC_LABELS.values()
    hbar_share(ax, s, "(c) 교육수준")

    ax = axes[1, 0]
    s = wshare(df["econ_active"], w, [1, 0]); s.index = ["경제활동 함", "경제활동 안 함"]
    hbar_share(ax, s, "(d) 경제활동")

    ax = axes[1, 1]
    s = wshare(df["marital"], w, MARITAL_LABELS.keys()); s.index = MARITAL_LABELS.values()
    hbar_share(ax, s, "(e) 혼인상태")

    ax = axes[1, 2]
    s = wshare(df["hh_type"], w, HH_LABELS.keys()); s.index = HH_LABELS.values()
    hbar_share(ax, s, "(f) 세대유형")

    ax = axes[2, 0]
    inc = df["income_equiv"]
    m = inc.notna() & (inc > 0)
    ax.hist(np.log10(inc[m]), bins=50, weights=w[m] / w[m].sum() * 100, color=BLUE, edgecolor="white")
    ticks = [100, 300, 1000, 3000, 10000, 30000]
    ax.set_xticks(np.log10(ticks), [f"{t:,}" for t in ticks])
    ax.set_title("(g) 균등화 가구 연소득(만원, 로그축)", loc="left"); ax.set_ylabel("가중 비율(%)")

    ax = axes[2, 1]
    b = df["bmi"].dropna()
    ax.hist(b, bins=np.arange(10, 50, 0.5), weights=w[b.index] / w[b.index].sum() * 100, color=BLUE, edgecolor="white")
    for x in (18.5, 25):
        ax.axvline(x, color=INK_MUTED, ls="--", lw=1)
    ax.set_xlim(14, 40)
    ax.set_title("(h) BMI (점선: 18.5, 25)", loc="left"); ax.set_ylabel("가중 비율(%)")

    ax = axes[2, 2]
    prev = pd.Series({"고혈압": wmean(df["htn"], w), "당뇨병": wmean(df["dm"], w), "골다공증": wmean(df["osteo"], w)}) * 100
    hbar_share(ax, prev, "(i) 만성질환 의사진단 경험률")
    ax.set_xlabel("가중 유병률(%)")

    fig.suptitle("기초 EDA ② 통제변수 분포 (가중)", x=0.01, ha="left", fontsize=14, fontweight="bold")
    fig.tight_layout()
    save(fig, "eda_02_controls.png")


# ---------------------------------------------------------------------------
# 2. 이변량 EDA
# ---------------------------------------------------------------------------
def fig_bivariate(sample: pd.DataFrame) -> pd.DataFrame:
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))

    # (a) 활동조합별 양성률
    ax = axes[0, 0]
    r = wrate_by(sample, "activity_combo")
    r.index = COMBO_ORDER
    x = np.arange(4)
    bars = ax.bar(x, r["rate_w"], color=[COMBO_COLORS[c] for c in COMBO_ORDER], width=0.6)
    bar_labels(ax, bars)
    ax.set_xticks(x, [f"{c}\n(N={n:,})" for c, n in zip(COMBO_ORDER, r["N"])])
    ax.set_ylabel("Y=1 가중 비율(%)")
    ax.set_ylim(0, r["rate_w"].max() * 1.25)
    ax.set_title("(a) 활동조합별 우울 증상 기준 충족률", loc="left")
    ax.grid(axis="x", visible=False)

    # (b) 연락 빈도별 양성률 — 친구/친척/이웃
    ax = axes[0, 1]
    for col, name, color in [("contact_friend", "친구", PALETTE[0]), ("contact_family", "친척", PALETTE[1]),
                             ("contact_neighbor", "이웃", PALETTE[2])]:
        rr = wrate_by(sample, col)
        ax.plot(rr.index, rr["rate_w"], marker="o", ms=6, lw=2, color=color, label=name)
    ax.set_xticks(list(CONTACT_LABELS.keys()), list(CONTACT_LABELS.values()), rotation=20)
    ax.set_ylabel("Y=1 가중 비율(%)")
    ax.set_ylim(0, None)
    ax.legend(loc="upper right")
    ax.set_title("(b) 연락 빈도별 우울 증상 기준 충족률", loc="left")

    # (c) 활동조합 × 친구 연락빈도 히트맵
    ax = axes[1, 0]
    ct = wrate_by(sample, ["activity_combo", "contact_friend"])
    heat = ct["rate_w"].unstack()
    n = ct["N"].unstack()
    im = ax.imshow(heat.values, cmap="Blues", aspect="auto")
    for i in range(heat.shape[0]):
        for j in range(heat.shape[1]):
            v = heat.values[i, j]
            ax.text(j, i, f"{v:.1f}%\nn={int(n.values[i, j]):,}", ha="center", va="center", fontsize=7.5,
                    color="white" if v > np.nanmax(heat.values) * 0.6 else INK)
    ax.set_xticks(range(6), list(CONTACT_LABELS.values()), rotation=20)
    ax.set_yticks(range(4), COMBO_ORDER)
    ax.grid(False)
    ax.set_title("(c) 활동조합 × 친구 연락빈도별 Y=1 가중 비율", loc="left")
    fig.colorbar(im, ax=ax, fraction=0.04, label="Y=1 가중 비율(%)")

    # (d) 친구 주 1회 이상 연락 여부로 나눈 활동조합별 양성률
    ax = axes[1, 1]
    r2 = wrate_by(sample, ["friend_weekly", "activity_combo"])["rate_w"].unstack(0)
    width = 0.38
    b1 = ax.bar(x - width / 2, r2[0.0], width, color=INK_MUTED, label="친구 연락 주 1회 미만")
    b2 = ax.bar(x + width / 2, r2[1.0], width, color=BLUE, label="친구 연락 주 1회 이상")
    bar_labels(ax, b1); bar_labels(ax, b2)
    ax.set_xticks(x, COMBO_ORDER)
    ax.set_ylabel("Y=1 가중 비율(%)")
    ax.set_ylim(0, r2.values.max() * 1.25)
    ax.legend(loc="upper right")
    ax.grid(axis="x", visible=False)
    ax.set_title("(d) 친구 연락 수준별 활동조합-우울 관계 (H2 탐색)", loc="left")

    fig.suptitle("이변량 EDA — 활동조합·연락빈도와 우울 증상 (비조정, 가중)", x=0.01, ha="left",
                 fontsize=14, fontweight="bold")
    fig.tight_layout()
    save(fig, "eda_03_bivariate.png")

    table = ct.reset_index()
    table["activity_combo"] = table["activity_combo"].astype(int).map(COMBO_LABELS)
    table["contact_friend"] = table["contact_friend"].astype(int).map(CONTACT_LABELS)
    return table


# ---------------------------------------------------------------------------
# 3. 심화 EDA
# ---------------------------------------------------------------------------
def _stratum_panel(ax, sample, strat_col, strat_labels: dict, title: str):
    r = wrate_by(sample, [strat_col, "activity_combo"])["rate_w"].unstack(1)
    r = r.loc[[k for k in strat_labels if k in r.index]]
    x = np.arange(len(r))
    width = 0.2
    for i, code in enumerate(COMBO_LABELS):
        ax.bar(x + (i - 1.5) * width, r[code], width, color=PALETTE[i], label=COMBO_LABELS[code])
    ax.set_xticks(x, [strat_labels[k] for k in r.index])
    ax.set_ylabel("Y=1 가중 비율(%)")
    ax.set_title(title, loc="left")
    ax.grid(axis="x", visible=False)


def fig_stratified(sample: pd.DataFrame) -> pd.DataFrame:
    s = sample.copy()
    s["age_grp"] = pd.cut(s["age"], [18, 39, 64, 200], labels=[1, 2, 3]).astype(float)
    # 균등화 소득 가중 5분위 (모집단 기준 분위)
    m = s["income_equiv"].notna()
    order = s.loc[m, "income_equiv"].sort_values().index
    cumw = s.loc[order, "wt_p"].cumsum() / s.loc[order, "wt_p"].sum()
    s.loc[order, "inc_q"] = np.minimum((cumw * 5).apply(np.ceil), 5)
    s["chronic_any"] = (s[["htn", "dm", "osteo"]].max(axis=1, skipna=True)).where(s[["htn", "dm", "osteo"]].notna().any(axis=1))

    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    _stratum_panel(axes[0, 0], s, "age_grp", {1: "19~39세", 2: "40~64세", 3: "65세 이상"}, "(a) 연령대별")
    _stratum_panel(axes[0, 1], s, "inc_q", {1: "1분위(하)", 2: "2분위", 3: "3분위", 4: "4분위", 5: "5분위(상)"},
                   "(b) 균등화 소득 5분위별")
    _stratum_panel(axes[1, 0], s, "sex", {1: "남자", 2: "여자"}, "(c) 성별")
    _stratum_panel(axes[1, 1], s, "chronic_any", {0: "만성질환 없음", 1: "고혈압·당뇨·골다공증 중 1개 이상"},
                   "(d) 만성질환 유무별")
    handles, labels = axes[0, 0].get_legend_handles_labels()
    fig.legend(handles, labels, loc="upper right", ncol=4, bbox_to_anchor=(0.99, 0.995))
    fig.suptitle("심화 EDA ① 통제변수로 층화한 활동조합별 Y=1 가중 비율 (혼란변수 탐색)", x=0.01, ha="left",
                 fontsize=14, fontweight="bold")
    fig.tight_layout(rect=(0, 0, 1, 0.96))
    save(fig, "eda_04_stratified.png")

    rows = []
    for col in ["age_grp", "inc_q", "sex", "chronic_any"]:
        r = wrate_by(s, [col, "activity_combo"]).reset_index().rename(columns={col: "stratum_value"})
        r.insert(0, "stratum", col)
        rows.append(r)
    out = pd.concat(rows)
    out["activity_combo"] = out["activity_combo"].astype(int).map(COMBO_LABELS)
    return out


def fig_missing(df: pd.DataFrame, sample: pd.DataFrame):
    cols = {
        "contact_friend": "친구 연락", "contact_family": "친척 연락",
        "contact_neighbor": "이웃 연락", "educ": "교육", "econ_active": "경제활동", "marital": "혼인",
        "income_annual": "가구소득", "height_cm": "키", "weight_kg": "몸무게", "bmi": "BMI",
        "htn": "고혈압", "dm": "당뇨병", "osteo": "골다공증",
    }
    fig, axes = plt.subplots(1, 3, figsize=(17, 5.8), gridspec_kw={"width_ratios": [1.1, 1, 1.2]})

    # (a) 변수별 결측률 (분석표본)
    ax = axes[0]
    miss = sample[list(cols)].isna().mean().mul(100).rename(index=cols).sort_values()
    ax.barh(miss.index, miss.values, color=[PALETTE[1] if v > 0.5 else BLUE for v in miss.values], height=0.6)
    for i, v in enumerate(miss.values):
        ax.text(v, i, f" {v:.2f}% ({int(round(v / 100 * len(sample))):,}명)", va="center", fontsize=7.5, color=INK)
    ax.set_xlim(0, miss.max() * 1.6)
    ax.set_xlabel("결측률(%)")
    ax.set_title(f"(a) 변수별 결측률 (분석표본 N={len(sample):,})", loc="left")
    ax.grid(axis="y", visible=False)

    # (b) 소득 산출 경로 구성과 경로별 Y=1 비율
    ax = axes[1]
    src = sample["income_source"].fillna(0).map({1: "연소득 응답", 2: "월소득×12", 3: "구간 중간값(2순위)", 0: "산출 불가"})
    order = ["연소득 응답", "월소득×12", "구간 중간값(2순위)", "산출 불가"]
    n = src.value_counts().reindex(order)
    rate = sample.groupby(src)["Y"].mean().reindex(order) * 100
    bars = ax.bar(range(4), rate.values, color=[BLUE, BLUE, PALETTE[1], PALETTE[7]], width=0.6)
    bar_labels(ax, bars)
    ax.set_xticks(range(4), [f"{k}\nN={v:,}" for k, v in n.items()], fontsize=8)
    ax.set_ylabel("Y=1 비율(%, 비가중)")
    ax.set_ylim(0, rate.max() * 1.3)
    ax.set_title("(b) 소득 산출 경로별 인원과 Y=1 비율", loc="left")
    ax.grid(axis="x", visible=False)

    # (c) 결측 동시발생 행렬 (결측이 있는 변수끼리)
    ax = axes[2]
    mcols = [c for c in cols if sample[c].isna().any()]
    M = sample[mcols].isna().astype(int)
    co = M.T @ M
    lab = [cols[c] for c in mcols]
    im = ax.imshow(np.log10(co.values + 1), cmap="Blues")
    for i in range(len(mcols)):
        for j in range(len(mcols)):
            v = co.values[i, j]
            if v:
                ax.text(j, i, f"{v:,}", ha="center", va="center", fontsize=6.5,
                        color="white" if np.log10(v + 1) > np.log10(co.values.max() + 1) * 0.6 else INK)
    ax.set_xticks(range(len(lab)), lab, rotation=45, ha="right")
    ax.set_yticks(range(len(lab)), lab)
    ax.grid(False)
    ax.set_title("(c) 결측 동시발생 인원 (대각선=변수별 결측 수)", loc="left")

    fig.suptitle("심화 EDA ② 결측 패턴 — 소득·BMI 중심", x=0.01, ha="left", fontsize=14, fontweight="bold")
    fig.tight_layout()
    save(fig, "eda_05_missing.png")


def main():
    df = load_analysis_table()
    sample = df[df["in_analysis"] == 1].copy()
    fig_outcome_and_key_x(df, sample)
    fig_controls(df)
    biv = fig_bivariate(sample)
    strat = fig_stratified(sample)
    fig_missing(df, sample)

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    combo = wrate_by(sample, "activity_combo").reset_index()
    combo["activity_combo"] = combo["activity_combo"].astype(int).map(COMBO_LABELS)
    combo.to_csv(REPORT_DIR / "eda_combo_rates.csv", index=False, encoding="utf-8-sig")
    biv.to_csv(REPORT_DIR / "eda_combo_x_friend_rates.csv", index=False, encoding="utf-8-sig")
    strat.to_csv(REPORT_DIR / "eda_stratified_rates.csv", index=False, encoding="utf-8-sig")
    print(combo.round(2).to_string(index=False))


if __name__ == "__main__":
    main()
