"""v2 EDA — 영역별 요인 수준에 따른 우울 증상 기준 충족률(가중), 연관 크기 개요, 변수 간 상관, 결측.

실행: python src/v2/eda_v2.py   (preprocess_v2.py 실행 후)
산출: outputs/v2/figures/eda_v2_*.png, outputs/v2/reports/eda_v2_*.csv

- 비율은 개인가중치 wt_p를 적용한 가중 비율, N은 비가중 인원(1차 EDA 원칙과 동일).
- 비조정(crude) 관계이므로 혼란을 고려하지 않은 탐색 결과다.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

import common  # noqa: F401
from common import DOMAINS, V2_FIG, V2_REPORT, load_v2_table
from eda import wrate_by  # 1차 가중 비율 함수 재사용
from preprocess_v2 import FEATURES
from utils import CONTACT_LABELS, INK, INK_MUTED, PALETTE, setup_matplotlib

plt = setup_matplotlib()

DOMAIN_COLORS = dict(zip(DOMAINS, PALETTE))

YN = {1: "예", 0: "아니오"}
YN9 = {1: "예", 2: "아니오", 9: "모름"}
LIKERT5_GOOD = {1: "매우 좋음", 2: "좋음", 3: "보통", 4: "나쁨", 5: "매우 나쁨"}
LEVEL_LABELS = {
    "sex": {1: "남", 2: "여"},
    "educ": {1: "무학", 2: "초졸", 3: "중졸", 4: "고졸", 5: "대졸+"},
    "marital": {1: "배우자 동거", 2: "별거", 3: "사별", 4: "이혼", 5: "미혼"},
    "hh_type": {1: "1인", 2: "부부", 3: "기타1세대", 4: "부부+자녀", 5: "한부모+자녀", 6: "기타2세대", 7: "3세대"},
    "livelihood": {1: "현재 수급", 2: "과거 수급", 3: "아님"},
    "food_insecurity": {1: "충분·다양", 2: "충분·단조", 3: "가끔 부족", 4: "자주 부족"},
    "occupation": {0: "비경제활동", 1: "관리자", 2: "전문가", 3: "사무", 4: "서비스", 5: "판매", 6: "농림어업",
                   7: "기능원", 8: "기계조작", 9: "단순노무", 10: "군인"},
    "emp_status": {0: "비경제활동", 1: "고용주·자영", 2: "임금근로", 3: "무급가족"},
    "body_image": {1: "매우 마름", 2: "약간 마름", 3: "보통", 4: "약간 비만", 5: "매우 비만"},
    "htn": YN, "dm": YN, "osteo": YN, "fall": YN, "injury": YN,
    "oral_health": LIKERT5_GOOD,
    "chewing": {1: "매우 불편", 2: "불편", 3: "그저그럼", 4: "별로 안 불편", 5: "전혀 안 불편"},
    "strength_code": {1: "안 함", 2: "1일", 3: "2일", 4: "3일", 5: "4일", 6: "5일+"},
    "smoking_status": {0: "비흡연", 1: "과거흡연", 2: "현재흡연"},
    "ecig_current": YN,
    "drinking_freq": {0: "안 마심", 1: "월1회 미만", 2: "월1회", 3: "월2~4회", 4: "주2~3회", 5: "주4회+"},
    "binge_freq": {0: "음주 안 함", 1: "폭음 없음", 2: "월1회 미만", 3: "월1회", 4: "주1회", 5: "거의 매일"},
    "breakfast": {1: "주5~7회", 2: "주3~4회", 3: "주1~2회", 4: "거의 안 함"},
    "weight_control": {1: "감량", 2: "유지", 3: "증량", 4: "노력 안 함"},
    "brushing_lunch": {1: "예", 2: "아니오", 3: "점심 안 먹음"},
    "contact_family": CONTACT_LABELS, "contact_neighbor": CONTACT_LABELS, "contact_friend": CONTACT_LABELS,
    "neighbor_trust": YN9, "neighbor_events": YN9,
    "dementia_care": {0: "해당 없음", 1: "가족(비동거)", 2: "동거"},
    "env_safety": YN9, "env_nature": YN9, "env_living": YN9, "env_transport": YN9, "env_medical": YN9,
    "urban_type": {1: "동", 2: "읍·면"}, "housing": {1: "일반주택", 2: "아파트"},
    "unmet_medical": {1: "있음", 2: "없음", 3: "필요 없었음"}, "unmet_dental": {1: "있음", 2: "없음", 3: "필요 없었음"},
    "checkup": YN, "flu_vax": YN, "public_health_use": YN,
    "hl_explain": {1: "아주 쉬움", 2: "쉬움", 3: "다소 어려움", 4: "매우 어려움"},
    "hl_written": {1: "아주 쉬움", 2: "쉬움", 3: "다소 어려움", 4: "매우 어려움", 5: "관심 없음"},
    "hl_seek": {1: "아주 쉬움", 2: "쉬움", 3: "다소 어려움", 4: "매우 어려움", 5: "찾지 않음"},
    "stress": {1: "대단히 많이", 2: "많이", 3: "조금", 4: "거의 없음"},
    "self_rated_health": LIKERT5_GOOD,
    "eq_mobility": {1: "문제 없음", 2: "다소", 3: "심함"}, "eq_selfcare": {1: "문제 없음", 2: "다소", 3: "심함"},
    "eq_usual": {1: "문제 없음", 2: "다소", 3: "심함"}, "eq_pain": {1: "없음", 2: "다소", 3: "심함"},
    "bedridden": YN,
    "internet_interf": {1: "이용 안 함", 2: "지장 없음", 3: "월1회 미만", 4: "월1회", 5: "주1회", 6: "거의 매일"},
    "gambling_interf": {1: "도박 안 함", 2: "지장 없음", 3: "월1회 미만", 4: "월1회", 5: "주1회", 6: "거의 매일"},
    "cognitive_decline": {1: "예", 0: "아니오", 8: "40세 미만"},
}
REGION = {11: "서울", 26: "부산", 27: "대구", 28: "인천", 29: "광주", 30: "대전", 31: "울산", 36: "세종", 41: "경기",
          42: "강원", 43: "충북", 44: "충남", 45: "전북", 46: "전남", 47: "경북", 48: "경남", 50: "제주"}  # 지침서 시도번호표
LEVEL_LABELS["region"] = REGION


def weighted_quintile(x: pd.Series, w: pd.Series) -> pd.Series:
    m = x.notna()
    order = x[m].sort_values(kind="stable").index
    cumw = w[order].cumsum() / w[order].sum()
    q = pd.Series(np.nan, index=x.index)
    q[order] = np.minimum(np.ceil(cumw * 5), 5)
    return q


def level_series(s: pd.DataFrame, var: str) -> tuple[pd.Series, list]:
    """변수를 그래프용 수준(문자열 라벨, 순서 있음)으로 변환."""
    x = s[var]
    if var == "age":
        b = pd.cut(x, [18, 29, 39, 49, 59, 69, 79, 200], labels=["19-29", "30대", "40대", "50대", "60대", "70대", "80+"])
        return b.astype(object), list(b.cat.categories)
    if var == "bmi":
        b = pd.cut(x, [0, 18.5, 23, 25, 30, 100], right=False, labels=["<18.5", "18.5-23", "23-25", "25-30", "30+"])
        return b.astype(object), list(b.cat.categories)
    if var in ("log_income_equiv", "log_met_min"):
        q = weighted_quintile(x, s["wt_p"])
        lab = {1: "1분위(하)", 2: "2분위", 3: "3분위", 4: "4분위", 5: "5분위(상)"}
        return q.map(lab), list(lab.values())
    if var in ("walk_days", "vig_days", "mod_days"):
        b = pd.cut(x, [-1, 0, 2, 4, 6, 7], labels=["0일", "1-2일", "3-4일", "5-6일", "7일"])
        return b.astype(object), list(b.cat.categories)
    if var in ("sleep_weekday", "sleep_weekend"):
        b = pd.cut(x, [0, 5, 6, 7, 8, 24], labels=["≤5시간", "6시간", "7시간", "8시간", "≥9시간"])
        return b.astype(object), list(b.cat.categories)
    if var == "happiness":
        b = pd.cut(x, [-1, 4, 5, 6, 7, 8, 10], labels=["0-4", "5", "6", "7", "8", "9-10"])
        return b.astype(object), list(b.cat.categories)
    lab = LEVEL_LABELS.get(var)
    if lab is None:
        raise KeyError(var)
    order = [v for k, v in lab.items() if k in set(x.dropna().unique())]
    order = list(dict.fromkeys(order))
    return x.map(lab), order


def crude_table(s: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for _, f in FEATURES.iterrows():
        lv, order = level_series(s, f["name"])
        r = wrate_by(s.assign(_lv=lv), "_lv").reindex(order)
        for level, row in r.iterrows():
            rows.append({"variable": f["name"], "label": f["label"], "domain": f["domain"], "level": level,
                         "N": row["N"], "rate_w": row["rate_w"]})
    return pd.DataFrame(rows)


def fig_domain(tab: pd.DataFrame, domain: str, overall: float, idx: int):
    sub = tab[tab["domain"] == domain]
    vars_ = list(dict.fromkeys(sub["variable"]))
    ncol = 4 if len(vars_) > 6 else 3
    nrow = int(np.ceil(len(vars_) / ncol))
    fig, axes = plt.subplots(nrow, ncol, figsize=(4.6 * ncol, 3.3 * nrow), squeeze=False)
    color = DOMAIN_COLORS[domain]
    for ax, v in zip(axes.flat, vars_):
        d = sub[sub["variable"] == v]
        y = np.arange(len(d))
        ax.barh(y, d["rate_w"], color=color, height=0.65)
        ax.axvline(overall, color=INK_MUTED, ls="--", lw=1)
        ax.set_yticks(y, [str(l) for l in d["level"]], fontsize=8)
        ax.invert_yaxis()
        for yi, (rate, n) in enumerate(zip(d["rate_w"], d["N"])):
            ax.text(rate, yi, f" {rate:.1f}% (n={int(n):,})", va="center", fontsize=7, color=INK)
        ax.set_xlim(0, max(d["rate_w"].max() * 1.55, overall * 1.5))
        ax.set_title(d["label"].iloc[0], loc="left", fontsize=10)
        ax.grid(axis="y", visible=False)
        ax.tick_params(axis="x", labelsize=7)
    for ax in list(axes.flat)[len(vars_):]:
        ax.axis("off")
    fig.suptitle(f"영역 {idx}. {DOMAINS[domain]} — 요인 수준별 우울 증상 기준 충족률 (가중, 점선 = 전체 {overall:.2f}%)",
                 x=0.01, ha="left", fontsize=13, fontweight="bold")
    fig.tight_layout(rect=(0, 0, 1, 0.97))
    V2_FIG.mkdir(parents=True, exist_ok=True)
    fig.savefig(V2_FIG / f"eda_v2_{idx:02d}_{domain}.png")
    plt.close(fig)


def fig_overview(tab: pd.DataFrame) -> pd.DataFrame:
    """변수별 비조정 연관 크기: N ≥ 500인 수준 사이 최고−최저 가중 유병률 차(%p)."""
    t = tab[tab["N"] >= 500]
    eff = (t.groupby(["variable", "label", "domain"])
           .agg(max_rate=("rate_w", "max"), min_rate=("rate_w", "min"))
           .assign(range_pp=lambda d: d["max_rate"] - d["min_rate"])
           .reset_index().sort_values("range_pp", ascending=False))
    fig, ax = plt.subplots(figsize=(11, 15))
    y = np.arange(len(eff))
    ax.barh(y, eff["range_pp"], color=[DOMAIN_COLORS[d] for d in eff["domain"]], height=0.7)
    ax.set_yticks(y, eff["label"], fontsize=8)
    ax.invert_yaxis()
    for yi, v in enumerate(eff["range_pp"]):
        ax.text(v, yi, f" {v:.1f}", va="center", fontsize=7, color=INK)
    handles = [plt.Rectangle((0, 0), 1, 1, color=DOMAIN_COLORS[d]) for d in DOMAINS]
    ax.legend(handles, list(DOMAINS.values()), loc="lower right", title="영역")
    ax.set_xlabel("수준 간 최고-최저 가중 유병률 차이(%p, N≥500 수준만)")
    ax.grid(axis="y", visible=False)
    ax.set_title("비조정 연관 크기 개요 — 변수별 우울 증상 기준 충족률의 최대 격차", loc="left", fontsize=13,
                 fontweight="bold")
    fig.tight_layout()
    fig.savefig(V2_FIG / "eda_v2_09_overview.png")
    plt.close(fig)
    return eff


def fig_correlation(s: pd.DataFrame) -> pd.DataFrame:
    feats = list(FEATURES["name"])
    X = s[feats].astype(float)
    corr = X.corr(method="spearman")
    fig, ax = plt.subplots(figsize=(17, 15))
    im = ax.imshow(corr.values, cmap="RdBu_r", vmin=-1, vmax=1)
    labels = list(FEATURES["label"])
    ax.set_xticks(range(len(feats)), labels, rotation=90, fontsize=6)
    ax.set_yticks(range(len(feats)), labels, fontsize=6)
    # 영역 경계선
    bounds = np.cumsum(FEATURES.groupby("domain", sort=False).size().values)[:-1] - 0.5
    for b in bounds:
        ax.axhline(b, color=INK, lw=0.6)
        ax.axvline(b, color=INK, lw=0.6)
    ax.grid(False)
    fig.colorbar(im, ax=ax, fraction=0.03, label="Spearman ρ")
    ax.set_title("변수 간 상관(Spearman) — 영역 순서로 정렬, 선은 영역 경계", loc="left", fontsize=13, fontweight="bold")
    fig.tight_layout()
    fig.savefig(V2_FIG / "eda_v2_10_correlation.png")
    plt.close(fig)
    pairs = (corr.where(np.triu(np.ones(corr.shape, dtype=bool), 1)).stack().rename("rho").reset_index()
             .rename(columns={"level_0": "var1", "level_1": "var2"}))
    return pairs.reindex(pairs["rho"].abs().sort_values(ascending=False).index)


def fig_missing(s: pd.DataFrame):
    miss = s[list(FEATURES["name"])].isna().mean().mul(100)
    order = miss.sort_values(ascending=False)
    top = order[order > 0]
    fig, ax = plt.subplots(figsize=(10, 0.28 * len(top) + 1.5))
    lab = FEATURES.set_index("name")
    ax.barh(range(len(top)), top.values, color=[DOMAIN_COLORS[lab.loc[v, "domain"]] for v in top.index], height=0.7)
    ax.set_yticks(range(len(top)), [lab.loc[v, "label"] for v in top.index], fontsize=8)
    ax.invert_yaxis()
    for i, v in enumerate(top.values):
        ax.text(v, i, f" {v:.2f}% ({int(round(v / 100 * len(s))):,}명)", va="center", fontsize=7)
    ax.set_xlim(0, top.max() * 1.5)
    ax.set_xlabel("결측률(%)")
    ax.grid(axis="y", visible=False)
    ax.set_title(f"투입 변수 결측률 (분석표본 N={len(s):,}, 결측 0인 변수 {int((miss == 0).sum())}개는 생략)",
                 loc="left", fontsize=12, fontweight="bold")
    fig.tight_layout()
    fig.savefig(V2_FIG / "eda_v2_11_missing.png")
    plt.close(fig)


def main():
    df = load_v2_table()
    s = df[df["Y"].notna()].copy()
    overall = np.average(s["Y"], weights=s["wt_p"]) * 100
    tab = crude_table(s)
    for i, d in enumerate(DOMAINS, start=1):
        fig_domain(tab, d, overall, i)
    eff = fig_overview(tab)
    pairs = fig_correlation(s)
    fig_missing(s)

    V2_REPORT.mkdir(parents=True, exist_ok=True)
    tab.to_csv(V2_REPORT / "eda_v2_crude_rates.csv", index=False, encoding="utf-8-sig", float_format="%.4f")
    eff.to_csv(V2_REPORT / "eda_v2_crude_effect_overview.csv", index=False, encoding="utf-8-sig", float_format="%.4f")
    pairs.head(40).to_csv(V2_REPORT / "eda_v2_top_correlations.csv", index=False, encoding="utf-8-sig",
                          float_format="%.3f")
    print(f"전체 가중 유병률 {overall:.2f}%")
    print("비조정 격차 상위 15:")
    print(eff.head(15)[["label", "domain", "max_rate", "min_rate", "range_pp"]].round(2).to_string(index=False))
    print("상관 |ρ| 상위 10:")
    print(pairs.head(10).round(3).to_string(index=False))


if __name__ == "__main__":
    main()
