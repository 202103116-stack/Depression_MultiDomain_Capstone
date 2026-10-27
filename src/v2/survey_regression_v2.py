"""v2 조사설계 반영 회귀 — (1) 7개 영역 동시 조정 오즈비, (2) 신체활동 × 생활요인 조합(스포츠 조합 분석).

실행: python src/v2/survey_regression_v2.py   (preprocess_v2.py 실행 후)
산출: outputs/v2/reports/reg_v2_*.csv, outputs/v2/figures/reg_v2_*.png

방법은 1차 src/survey_regression.py의 SurveyLogit(가중 IRLS + 테일러 선형화, 층 kstrata·집락 spot_no)을 그대로 쓴다.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from matplotlib.ticker import NullFormatter

import common  # noqa: F401
from common import DOMAINS, MAIN_DOMAINS, V2_FIG, V2_REPORT, load_v2_table
from eda_v2 import LEVEL_LABELS, REGION, weighted_quintile
from preprocess_v2 import FEATURES
from survey_regression import SurveyLogit
from utils import INK, INK_MUTED, PALETTE, setup_matplotlib

DOMAIN_COLORS = dict(zip(DOMAINS, PALETTE))


# ---------------------------------------------------------------------------
# 회귀용 코딩: (열, 기준범주, 영역, 수정가능, 한글명, 수준 라벨)
# ---------------------------------------------------------------------------
def recode(d: pd.DataFrame) -> pd.DataFrame:
    r = pd.DataFrame(index=d.index)
    r["age_grp"] = pd.cut(d["age"], [18, 29, 39, 49, 59, 69, 79, 200],
                          labels=["19-29세", "30대", "40대", "50대", "60대", "70대", "80세+"]).astype(object)
    r["inc_q"] = weighted_quintile(d["log_income_equiv"], d["wt_p"]).map({1: "1분위(하)", 2: "2분위", 3: "3분위", 4: "4분위", 5: "5분위(상)"})
    occ = d["occupation"].map({0: "비경제활동", 1: "관리·전문", 2: "관리·전문", 3: "사무", 4: "서비스·판매", 5: "서비스·판매",
                               6: "농림어업", 7: "기능·노무", 8: "기능·노무", 9: "기능·노무", 10: "기능·노무"})
    r["occupation"] = occ
    r["bmi_grp"] = pd.cut(d["bmi"], [0, 18.5, 23, 25, 30, 100], right=False,
                          labels=["<18.5", "18.5-23", "23-25", "25-30", "30+"]).astype(object)
    drink = d["drinking_freq"].map({0: "안 마심", 1: "월1회 이하", 2: "월1회 이하", 3: "월2~4회", 4: "주2회+", 5: "주2회+"})
    r["drinking"] = drink
    for v in ["sex", "educ", "marital", "hh_type", "livelihood", "food_insecurity", "body_image", "htn", "dm", "osteo",
              "oral_health", "chewing", "fall", "injury", "walk_ok", "aerobic_ok", "strength_ok", "smoking_status",
              "ecig_current", "high_risk_drinking", "breakfast", "weight_control", "brushing_lunch", "contact_friend",
              "contact_family", "contact_neighbor", "neighbor_trust", "neighbor_events", "dementia_care", "env_safety",
              "env_nature", "env_living", "env_transport", "env_medical", "urban_type", "housing", "region",
              "unmet_medical", "unmet_dental", "checkup", "flu_vax", "public_health_use", "hl_explain", "hl_written",
              "hl_seek"]:
        lab = LEVEL_LABELS.get(v, {1: "예", 0: "아니오"})
        r[v] = d[v].map(lab)
    return r


SPEC = [  # (회귀 열, 기준범주, 영역, 한글명) — 기준범주는 건강·바람직한 상태(위험 쪽 OR > 1)
    ("age_grp", "40대", "demo", "연령"), ("sex", "남", "demo", "성별"), ("educ", "대졸+", "demo", "교육수준"),
    ("marital", "배우자 동거", "demo", "혼인상태"), ("hh_type", "부부", "demo", "세대유형"),
    ("inc_q", "3분위", "econ", "균등화 소득"), ("livelihood", "아님", "econ", "기초생활수급"),
    ("food_insecurity", "충분·다양", "econ", "식품안정성"), ("occupation", "사무", "econ", "직업"),
    ("bmi_grp", "18.5-23", "phys", "BMI"), ("body_image", "보통", "phys", "인지 체형"), ("htn", "아니오", "phys", "고혈압"),
    ("dm", "아니오", "phys", "당뇨병"), ("osteo", "아니오", "phys", "골다공증"), ("oral_health", "좋음", "phys", "구강건강"),
    ("chewing", "전혀 안 불편", "phys", "저작불편"), ("fall", "아니오", "phys", "낙상"), ("injury", "아니오", "phys", "사고·중독"),
    ("walk_ok", "예", "behav", "걷기 실천"), ("aerobic_ok", "예", "behav", "중강도 이상 신체활동"),
    ("strength_ok", "예", "behav", "근력운동 주2일+"), ("smoking_status", "비흡연", "behav", "흡연"),
    ("ecig_current", "아니오", "behav", "전자담배"), ("drinking", "월1회 이하", "behav", "음주 빈도"),
    ("high_risk_drinking", "아니오", "behav", "고위험음주"), ("breakfast", "주5~7회", "behav", "아침식사"),
    ("weight_control", "유지", "behav", "체중조절"), ("brushing_lunch", "예", "behav", "점심 후 칫솔질"),
    ("contact_friend", "주 1회", "social", "친구 연락"), ("contact_family", "주 1회", "social", "친척 연락"),
    ("contact_neighbor", "주 1회", "social", "이웃 연락"), ("neighbor_trust", "예", "social", "이웃 신뢰"),
    ("neighbor_events", "예", "social", "이웃 경조사"), ("dementia_care", "해당 없음", "social", "치매환자 가족"),
    ("env_safety", "예", "env", "동네 안전"), ("env_nature", "예", "env", "자연환경"), ("env_living", "예", "env", "생활환경"),
    ("env_transport", "예", "env", "대중교통"), ("env_medical", "예", "env", "의료서비스"), ("urban_type", "동", "env", "동/읍면"),
    ("housing", "아파트", "env", "주택유형"), ("region", "서울", "env", "시도"),
    ("unmet_medical", "없음", "care", "미충족 의료"), ("unmet_dental", "없음", "care", "미충족 치과"),
    ("checkup", "예", "care", "건강검진"), ("flu_vax", "예", "care", "독감접종"), ("public_health_use", "아니오", "care", "보건기관 이용"),
    ("hl_explain", "쉬움", "care", "의료진 설명 이해"), ("hl_written", "쉬움", "care", "건강정보 글 이해"),
    ("hl_seek", "쉬움", "care", "건강정보 찾기"),
]
# 수정 유형(A 개인 행동 / B 서비스·정책·환경 / C 바꿀 수 없음) — preprocess_v2.MOD_TYPE, 회귀용 재코딩 열 보충
MOD_TYPE = dict(zip(FEATURES["name"], FEATURES["mod_type"]))
MOD_TYPE.update({"age_grp": "C", "inc_q": "B", "bmi_grp": "B", "drinking": "A", "walk_ok": "A",
                 "aerobic_ok": "A", "strength_ok": "A", "high_risk_drinking": "A"})


def actionable(t: pd.DataFrame) -> pd.Series:
    """제언 대상 수준: 수정 가능 변수 중 행동으로 바꿀 수 없는 수준(모름, 필요 없었음, 직업군)은 뺀다."""
    not_action = t["level"].isin(["모름", "필요 없었음"]) | ((t["var"] == "occupation") & (t["level"] != "비경제활동"))
    return t["mod_type"].isin(["A", "B"]) & ~not_action


def design(r: pd.DataFrame, spec) -> tuple[pd.DataFrame, list[dict]]:
    cols = {"const": np.ones(len(r))}
    info = []
    for var, ref, dom, name in spec:
        x = r[var]
        levels = [lv for lv in pd.unique(x.dropna()) if lv != ref]
        assert ref in set(x.dropna()), f"{var} 기준범주 {ref} 없음"
        for lv in sorted(levels, key=str):
            col = f"{var}={lv}"
            cols[col] = (x == lv).astype(float).where(x.notna())
            info.append({"term": col, "var": var, "level": lv, "ref": ref, "domain": dom, "name": name,
                         "mod_type": MOD_TYPE.get(var), "modifiable": MOD_TYPE.get(var) in ("A", "B")})
    return pd.DataFrame(cols, index=r.index), info


def fit(X, d, domain_mask) -> SurveyLogit:
    return SurveyLogit(X, d["Y"].to_numpy(float), d["wt_p"].to_numpy(float), domain_mask,
                       d["kstrata"].to_numpy(), d["spot_key"].to_numpy()).fit()


# ---------------------------------------------------------------------------
# (2) 신체활동 × 생활요인 조합
# ---------------------------------------------------------------------------
def _yes(col, val=1):
    return lambda d: (d[col] == val).astype(float).where(d[col].notna())


# 생활요인 선정 규칙(decision_log D-38): ① 개인 행동(수정 유형 A) ② 생활 영역 — Zhao et al.(2023)의 우울 관련 7개 영역과
# HP2030 건강생활 실천 5개 분야(금연·절주·영양·신체활동·구강건강)의 합집합 8개 ③ 지침서 지표·공중보건 권고로 충족 기준이 정해짐
# ④ 영역당 대표 문항 1개 ⑤ 증상근접은 민감도로만. 신체활동은 기준축(pa_guideline), 좌식행동은 2025 조사에 문항이 없다.
PARTNERS = [  # (이름, Zhao 영역, 충족 정의, 증상근접 여부)
    ("담배제품 미사용", "흡연", _yes("tobacco_free"), False),
    ("고위험음주 아님", "음주", _yes("high_risk_drinking", 0), False),
    ("아침식사 주 5회 이상", "식생활", _yes("breakfast"), False),
    ("사회적 연결", "사회적 연결", _yes("social_connected"), False),
    ("저녁 후·잠자기 전 칫솔질", "구강건강", _yes("brush_evening_ok"), False),
    ("주중 수면 7~9시간", "수면", lambda d: d["sleep_weekday"].between(7, 9).astype(float).where(d["sleep_weekday"].notna()), True),
]
# 생활습관이 아닌 사회·환경 맥락 요인 — 조합 분석은 부록에만 보고
CONTEXT_PARTNERS = [
    ("이웃을 신뢰함", "사회 맥락", _yes("neighbor_trust"), False),
    ("동네가 안전하다고 느낌", "환경 맥락", _yes("env_safety"), False),
]
MIN_CELL = 1000  # 개수 점수 칸의 최소 인원 — 미만이면 이웃 칸과 합친다
COMBO_ADJUST = [s for s in SPEC if s[2] in ("demo", "econ", "phys")]  # 조합 분석의 조정변수: 인구·경제·신체건강


def combo_analysis(d: pd.DataFrame, r: pd.DataFrame, in_sample: np.ndarray, pa_col="pa_guideline", partners=PARTNERS):
    Xadj, _ = design(r, COMBO_ADJUST)
    pa = d[pa_col]
    rows, cells = [], []
    for name, dom, fn, proximal in partners:
        f = fn(d)
        X = Xadj.copy()
        X["PA"], X["F"] = pa, f
        X["PAxF"] = pa * f
        mdl = fit(X, d, in_sample)
        j = {n: mdl.names.index(n) for n in ("PA", "F", "PAxF")}
        cf = {}
        for a in (0, 1):
            for b in (0, 1):
                Xc = mdl.X.copy()
                Xc[:, j["PA"]], Xc[:, j["F"]], Xc[:, j["PAxF"]] = a, b, a * b
                cf[(a, b)] = Xc
        mg = mdl.margins(cf)
        for (a, b), (est, grad) in mg.items():
            e, lo, hi, _ = mdl.contrast(est, grad)
            cells.append({"partner": name, "domain": dom, "proximal": proximal, "PA": a, "F": b,
                          "adj_prev": e, "low": lo, "high": hi,
                          "n": int(((pa == a) & (f == b) & in_sample).sum())})
        g = lambda k: mg[k]
        joint = mdl.contrast(g((1, 1))[0] - g((0, 0))[0], g((1, 1))[1] - g((0, 0))[1])
        pa_only = mdl.contrast(g((1, 0))[0] - g((0, 0))[0], g((1, 0))[1] - g((0, 0))[1])
        f_only = mdl.contrast(g((0, 1))[0] - g((0, 0))[0], g((0, 1))[1] - g((0, 0))[1])
        add_int = mdl.contrast(g((1, 1))[0] - g((1, 0))[0] - g((0, 1))[0] + g((0, 0))[0],
                               g((1, 1))[1] - g((1, 0))[1] - g((0, 1))[1] + g((0, 0))[1])
        mult = mdl.wald(["PAxF"])
        rows.append({"partner": name, "domain": dom, "proximal": proximal, "n_domain": int(mdl.domain.sum()),
                     "prev_both": g((1, 1))[0], "prev_neither": g((0, 0))[0],
                     "joint_diff": joint[0], "joint_low": joint[1], "joint_high": joint[2],
                     "pa_only_diff": pa_only[0], "f_only_diff": f_only[0],
                     "additive_interaction": add_int[0], "add_low": add_int[1], "add_high": add_int[2], "add_p": add_int[3],
                     "mult_interaction_p": mult["p"]})
    return pd.DataFrame(rows), pd.DataFrame(cells)


def count_bins(count: pd.Series, in_sample: np.ndarray) -> list[tuple[int, int]]:
    """양 끝 칸이 MIN_CELL명 미만이면 안쪽 칸과 합친다. 반환: [(하한, 상한), ...]."""
    vals = sorted(int(v) for v in count.dropna().unique())
    bins = [[v, v] for v in vals]
    n = lambda b: int((count.between(b[0], b[1]) & in_sample).sum())
    while len(bins) > 2 and n(bins[0]) < MIN_CELL:
        lo = bins.pop(0)[0]
        bins[0][0] = lo
    while len(bins) > 2 and n(bins[-1]) < MIN_CELL:
        hi = bins.pop()[1]
        bins[-1][1] = hi
    assert all(n(b) >= MIN_CELL for b in bins), "개수 칸 최소 인원 미달"
    return [tuple(b) for b in bins]


def count_score(d, r, in_sample, factors: list[pd.Series], label: str):
    """비가중 합산 점수(충족한 요인 수 — 순서 개념 없음)별 조정 유병률, 결합 검정, 1개 증가당 OR."""
    stack = pd.concat(factors, axis=1)
    count = stack.sum(axis=1).where(stack.notna().all(axis=1))
    bins = count_bins(count, in_sample)
    names = [f"{lo}개" if lo == hi else f"{lo}~{hi}개" for lo, hi in bins]
    grp = pd.Series(np.nan, index=count.index, dtype=object)
    for (lo, hi), nm in zip(bins, names):
        grp[count.between(lo, hi)] = nm
    Xadj, _ = design(r, COMBO_ADJUST)
    X = Xadj.copy()
    for nm in names[1:]:
        X[f"cnt={nm}"] = (grp == nm).astype(float).where(grp.notna())
    mdl = fit(X, d, in_sample)
    terms = [f"cnt={nm}" for nm in names[1:]]
    cf = {}
    for nm in names:
        Xc = mdl.X.copy()
        for t in terms:
            Xc[:, mdl.names.index(t)] = 0.0
        if nm != names[0]:
            Xc[:, mdl.names.index(f"cnt={nm}")] = 1.0
        cf[nm] = Xc
    mg = mdl.margins(cf)
    # 1개 증가당 OR(선형 추세) — 같은 조정변수, 점수를 연속형으로
    Xt = Xadj.copy()
    Xt["cnt"] = count
    trend = fit(Xt, d, in_sample).table().set_index("term").loc["cnt"]
    rows = []
    for nm in names:
        e, lo, hi, _ = mdl.contrast(*mg[nm])
        rows.append({"score": label, "healthy_factors": nm, "adj_prev": e, "low": lo, "high": hi,
                     "n": int(((grp == nm) & in_sample).sum())})
    summary = {"score": label, "n_factors": len(factors), "wald_p": mdl.wald(terms)["p"],
               "trend_OR": trend["OR"], "trend_low": trend["OR_low"], "trend_high": trend["OR_high"], "trend_p": trend["p"]}
    return pd.DataFrame(rows), summary


def lifestyle_count(d, r, in_sample):
    """주 점수(신체활동 권고 + 증상근접이 아닌 생활요인 5개)와 민감도(하나씩 빼기, 수면 포함)."""
    main = [("신체활동 권고", d["pa_guideline"])] + [(n, fn(d)) for n, _, fn, prox in PARTNERS if not prox]
    sleep = [(n, fn(d)) for n, _, fn, prox in PARTNERS if prox]
    tab, summ = count_score(d, r, in_sample, [s for _, s in main], "주 분석")
    tabs, summs = [tab], [summ]
    for i, (drop, _) in enumerate(main):
        t, s = count_score(d, r, in_sample, [s for j, (_, s) in enumerate(main) if j != i], f"{drop} 제외")
        tabs.append(t), summs.append(s)
    t, s = count_score(d, r, in_sample, [s for _, s in main + sleep], "수면 포함")
    tabs.append(t), summs.append(s)
    return pd.concat(tabs, ignore_index=True), pd.DataFrame(summs)


# ---------------------------------------------------------------------------
# 그림
# ---------------------------------------------------------------------------
def plot_forest(tab: pd.DataFrame):
    plt = setup_matplotlib()
    t = tab[tab["actionable"] & (tab["p"] < 0.05)].copy()
    t["dist"] = np.abs(np.log(t["OR"]))
    t = t.sort_values("dist", ascending=False).head(30).iloc[::-1]  # 1에서 먼 수준이 위로
    fig, ax = plt.subplots(figsize=(11, 10))
    y = np.arange(len(t))
    for yi, (_, row) in enumerate(t.iterrows()):
        c = DOMAIN_COLORS[row["domain"]]
        ax.plot([row["OR_low"], row["OR_high"]], [yi, yi], color=c, lw=2)
        if row["mod_type"] == "A":  # 개인 행동 = 채운 원, 서비스·정책·환경 = 빈 사각형
            ax.plot(row["OR"], yi, "o", color=c, ms=7)
        else:
            ax.plot(row["OR"], yi, "s", mfc="white", mec=c, mew=1.8, ms=7)
        ax.text(max(row["OR_high"], 1) * 1.03, yi, f"{row['OR']:.2f} [{row['OR_low']:.2f}, {row['OR_high']:.2f}]",
                va="center", fontsize=7.5, color=INK)
    ax.axvline(1, color=INK_MUTED, ls="--", lw=1)
    ax.set_xscale("log")
    ax.set_yticks(y, [f"{r['name']}: {r['level']} (vs {r['ref']})" for _, r in t.iterrows()], fontsize=8)
    ax.xaxis.set_minor_formatter(NullFormatter())
    ticks = [0.5, 0.7, 1, 1.5, 2, 3, 5]
    ax.set_xticks(ticks, [str(x) for x in ticks])
    handles = [plt.Line2D([], [], color=DOMAIN_COLORS[d], lw=2) for d in MAIN_DOMAINS if d != "demo"]
    handles += [plt.Line2D([], [], color=INK, marker="o", ls="none", ms=7),
                plt.Line2D([], [], color=INK, marker="s", mfc="white", mew=1.8, ls="none", ms=7)]
    ax.legend(handles, [DOMAINS[d] for d in MAIN_DOMAINS if d != "demo"] + ["A 개인 행동", "B 서비스·정책·환경"],
              loc="lower right", fontsize=8)
    ax.set_xlabel("조정 오즈비 (95% CI, 로그축) — 7개 영역 동시 조정, 조사설계 반영")
    ax.grid(axis="y", visible=False)
    ax.set_title("바꿀 수 있는 요인 중 우울 증상과 연관이 큰 30개 수준 (p<0.05, |log OR| 순)", loc="left",
                 fontsize=12, fontweight="bold")
    fig.tight_layout()
    fig.savefig(V2_FIG / "reg_v2_01_forest_modifiable.png")
    plt.close(fig)


def plot_combos(summary: pd.DataFrame, cells: pd.DataFrame, count_all: pd.DataFrame):
    plt = setup_matplotlib()
    count = count_all[count_all["score"] == "주 분석"].reset_index(drop=True)
    fig, axes = plt.subplots(1, 2, figsize=(16, 6.5), gridspec_kw={"width_ratios": [1.4, 1]})
    ax = axes[0]
    order = summary.sort_values("prev_both")["partner"].tolist()
    y = np.arange(len(order))
    w = 0.2
    for k, ((a, b), lab, col) in enumerate([((0, 0), "둘 다 아님", INK_MUTED), ((1, 0), "신체활동만", PALETTE[0]),
                                           ((0, 1), "생활요인만", PALETTE[2]), ((1, 1), "둘 다 충족", PALETTE[3])]):
        c = cells[(cells["PA"] == a) & (cells["F"] == b)].set_index("partner").reindex(order)
        ax.barh(y + (k - 1.5) * w, c["adj_prev"] * 100, w, color=col, label=lab)
    ax.set_yticks(y, [f"{p}{' (증상근접)' if pr else ''}" for p, pr in
                      zip(order, summary.set_index("partner").loc[order, "proximal"])], fontsize=9)
    ax.invert_yaxis()
    ax.set_xlabel("조정 유병률(%) — 인구·경제·신체건강 조정")
    ax.legend(loc="lower right", fontsize=8)
    ax.grid(axis="y", visible=False)
    ax.set_title("(a) 신체활동 권고 충족 × 생활요인 조합별 조정 유병률", loc="left")
    ax = axes[1]
    ax.bar(range(len(count)), count["adj_prev"] * 100, color=PALETTE[0], width=0.6)
    ax.errorbar(range(len(count)), count["adj_prev"] * 100,
                yerr=[(count["adj_prev"] - count["low"]) * 100, (count["high"] - count["adj_prev"]) * 100],
                fmt="none", ecolor="#333", capsize=3)
    for i, (v, n) in enumerate(zip(count["adj_prev"] * 100, count["n"])):
        ax.text(i + 0.32, v, f"{v:.1f}%\n(n={n:,})", ha="left", va="center", fontsize=7.5)
    # 하나씩 빼기 민감도: 요인 1개를 뺀 점수 — 같은 개수 축에 회색 선으로
    for sc, g in count_all[count_all["score"].str.endswith("제외")].groupby("score", sort=False):
        xs = [list(count["healthy_factors"]).index(h) if h in set(count["healthy_factors"]) else None
              for h in g["healthy_factors"]]
        pts = [(x, v) for x, v in zip(xs, g["adj_prev"] * 100) if x is not None]
        ax.plot(*zip(*pts), color=INK_MUTED, lw=0.9, alpha=0.7, marker=".", ms=4)
    ax.plot([], [], color=INK_MUTED, lw=0.9, marker=".", label="요인 1개씩 뺀 점수(민감도)")
    ax.legend(loc="upper right", fontsize=8)
    ax.set_xticks(range(len(count)), count["healthy_factors"])
    ax.set_xlabel("충족한 건강 생활요인 수 (신체활동 권고 + 생활요인 5개, 비가중 합산)")
    ax.set_ylabel("조정 유병률(%)")
    ax.grid(axis="x", visible=False)
    ax.set_title("(b) 건강 생활요인 개수별 조정 유병률", loc="left")
    fig.suptitle("스포츠(신체활동)와 함께할 때 우울 증상 비율이 가장 낮은 생활요인 조합", x=0.01, ha="left",
                 fontsize=14, fontweight="bold")
    fig.tight_layout()
    fig.savefig(V2_FIG / "reg_v2_02_pa_combinations.png")
    plt.close(fig)


def main():
    d = load_v2_table()
    d = d[d["Y"].notna()].reset_index(drop=True)  # Y 결측 325명 제외(1차와 달리 도메인 처리 생략, 영향 미미)
    in_sample = np.ones(len(d), dtype=bool)
    r = recode(d)

    # (1) 7개 영역 동시 조정 모형
    X, info = design(r, SPEC)
    mdl = fit(X, d, in_sample)
    t = mdl.table().merge(pd.DataFrame(info), on="term", how="left")
    t = t[t["term"] != "const"]
    t["actionable"] = actionable(t)
    var_tests = []
    for var, ref, dom, name in SPEC:
        terms = [x["term"] for x in info if x["var"] == var]
        w = mdl.wald(terms)
        var_tests.append({"var": var, "name": name, "domain": dom, "df": w["q"], "F": w["F"], "p": w["p"]})
    var_tests = pd.DataFrame(var_tests)
    print(f"[전체 조정 모형] n={mdl.domain.sum():,}, 계수 {len(t)}개, 설계 df={mdl.df:,}")

    # (2) 조합 분석
    summary, cells = combo_analysis(d, r, in_sample)
    ctx_summary, ctx_cells = combo_analysis(d, r, in_sample, partners=CONTEXT_PARTNERS)
    count_all, count_summary = lifestyle_count(d, r, in_sample)
    count = count_all[count_all["score"] == "주 분석"]

    V2_REPORT.mkdir(parents=True, exist_ok=True)
    t.to_csv(V2_REPORT / "reg_v2_full_or.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    var_tests.to_csv(V2_REPORT / "reg_v2_variable_tests.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    summary.to_csv(V2_REPORT / "reg_v2_pa_combo_summary.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    cells.to_csv(V2_REPORT / "reg_v2_pa_combo_cells.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    count.to_csv(V2_REPORT / "reg_v2_lifestyle_count.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    count_all.to_csv(V2_REPORT / "reg_v2_lifestyle_count_sens.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    count_summary.to_csv(V2_REPORT / "reg_v2_lifestyle_count_summary.csv", index=False, encoding="utf-8-sig",
                         float_format="%.6g")
    ctx_summary.to_csv(V2_REPORT / "reg_v2_context_combo_summary.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    V2_FIG.mkdir(parents=True, exist_ok=True)
    plot_forest(t)
    plot_combos(summary, cells, count_all)

    print("\n[변수별 결합 검정 p<0.001, F 상위 25]")
    print(var_tests.sort_values("F", ascending=False).head(25).round(4).to_string(index=False))
    print("\n[바꿀 수 있는 요인 OR (p<0.05) 상위 20, |log OR| 순]")
    m = t[t["actionable"] & (t["p"] < 0.05)].copy()
    m["dist"] = np.abs(np.log(m["OR"]))
    print(m.sort_values("dist", ascending=False).head(20)[["name", "level", "ref", "OR", "OR_low", "OR_high", "p"]]
          .round(3).to_string(index=False))
    print("\n[신체활동 × 생활요인 조합]")
    print(summary[["partner", "prev_both", "prev_neither", "joint_diff", "joint_low", "joint_high",
                   "additive_interaction", "add_p", "mult_interaction_p"]].round(4).to_string(index=False))
    print("\n[건강 생활요인 개수 — 요약]")
    print(count_summary.to_string(index=False))
    print(count_all.round(4).to_string(index=False))
    print("\n[맥락 요인 조합]")
    print(ctx_summary[["partner", "prev_both", "prev_neither", "joint_diff", "add_p", "mult_interaction_p"]]
          .round(4).to_string(index=False))


if __name__ == "__main__":
    main()
