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
MODIFIABLE = dict(zip(FEATURES["name"], FEATURES["modifiable"]))
MODIFIABLE.update({"age_grp": False, "inc_q": True, "bmi_grp": True, "drinking": True, "walk_ok": True,
                   "aerobic_ok": True, "strength_ok": True, "high_risk_drinking": True})


def actionable(t: pd.DataFrame) -> pd.Series:
    """제언 대상 수준: 수정 가능 변수 중 행동으로 바꿀 수 없는 수준(모름, 필요 없었음, 직업군)은 뺀다."""
    not_action = t["level"].isin(["모름", "필요 없었음"]) | ((t["var"] == "occupation") & (t["level"] != "비경제활동"))
    return (t["modifiable"] == True) & ~not_action  # noqa: E712


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
                         "modifiable": MODIFIABLE.get(var)})
    return pd.DataFrame(cols, index=r.index), info


def fit(X, d, domain_mask) -> SurveyLogit:
    return SurveyLogit(X, d["Y"].to_numpy(float), d["wt_p"].to_numpy(float), domain_mask,
                       d["kstrata"].to_numpy(), d["spot_key"].to_numpy()).fit()


# ---------------------------------------------------------------------------
# (2) 신체활동 × 생활요인 조합
# ---------------------------------------------------------------------------
PARTNERS = [  # (이름, 영역, 충족 정의, 증상근접 여부)
    ("친구와 주 1회 이상 연락", "social", lambda d: (d["contact_friend"] >= 4).astype(float).where(d["contact_friend"].notna()), False),
    ("이웃을 신뢰함", "social", lambda d: (d["neighbor_trust"] == 1).astype(float).where(d["neighbor_trust"].notna()), False),
    ("비흡연(현재 흡연 아님)", "behav", lambda d: (d["smoking_status"] != 2).astype(float).where(d["smoking_status"].notna()), False),
    ("고위험음주 아님", "behav", lambda d: (d["high_risk_drinking"] == 0).astype(float).where(d["high_risk_drinking"].notna()), False),
    ("아침식사 주 5회 이상", "behav", lambda d: (d["breakfast"] == 1).astype(float).where(d["breakfast"].notna()), False),
    ("동네가 안전하다고 느낌", "env", lambda d: (d["env_safety"] == 1).astype(float).where(d["env_safety"].notna()), False),
    ("주중 수면 7~9시간", "proximal", lambda d: d["sleep_weekday"].between(7, 9).astype(float).where(d["sleep_weekday"].notna()), True),
]
COMBO_ADJUST = [s for s in SPEC if s[2] in ("demo", "econ", "phys")]  # 조합 분석의 조정변수: 인구·경제·신체건강


def combo_analysis(d: pd.DataFrame, r: pd.DataFrame, in_sample: np.ndarray, pa_col="pa_guideline"):
    Xadj, _ = design(r, COMBO_ADJUST)
    pa = d[pa_col]
    rows, cells = [], []
    for name, dom, fn, proximal in PARTNERS:
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


def lifestyle_count(d, r, in_sample):
    """신체활동 권고 + 수정 가능한 생활요인(증상근접 제외 6개) 충족 개수별 조정 유병률."""
    parts = [fn(d) for name, dom, fn, prox in PARTNERS if not prox]
    stack = pd.concat([d["pa_guideline"]] + parts, axis=1)
    count = stack.sum(axis=1).where(stack.notna().all(axis=1))
    grp = count.clip(upper=6).map(lambda k: f"{int(k)}개" if k < 6 else "6~7개")
    Xadj, _ = design(r, COMBO_ADJUST)
    levels = sorted(grp.dropna().unique())
    ref = levels[0]
    X = Xadj.copy()
    for lv in levels[1:]:
        X[f"cnt={lv}"] = (grp == lv).astype(float).where(grp.notna())
    mdl = fit(X, d, in_sample)
    terms = [f"cnt={lv}" for lv in levels[1:]]
    cf = {}
    for lv in levels:
        Xc = mdl.X.copy()
        for t in terms:
            Xc[:, mdl.names.index(t)] = 0.0
        if lv != ref:
            Xc[:, mdl.names.index(f"cnt={lv}")] = 1.0
        cf[lv] = Xc
    mg = mdl.margins(cf)
    rows = []
    for lv in levels:
        e, lo, hi, _ = mdl.contrast(*mg[lv])
        rows.append({"healthy_factors": lv, "adj_prev": e, "low": lo, "high": hi,
                     "n": int(((grp == lv) & in_sample).sum())})
    return pd.DataFrame(rows), mdl.wald(terms)


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
        ax.plot(row["OR"], yi, "o", color=c, ms=7)
        ax.text(max(row["OR_high"], 1) * 1.03, yi, f"{row['OR']:.2f} [{row['OR_low']:.2f}, {row['OR_high']:.2f}]",
                va="center", fontsize=7.5, color=INK)
    ax.axvline(1, color=INK_MUTED, ls="--", lw=1)
    ax.set_xscale("log")
    ax.set_yticks(y, [f"{r['name']}: {r['level']} (vs {r['ref']})" for _, r in t.iterrows()], fontsize=8)
    ax.xaxis.set_minor_formatter(NullFormatter())
    ticks = [0.5, 0.7, 1, 1.5, 2, 3, 5]
    ax.set_xticks(ticks, [str(x) for x in ticks])
    handles = [plt.Line2D([], [], color=DOMAIN_COLORS[d], marker="o", lw=2) for d in MAIN_DOMAINS if d != "demo"]
    ax.legend(handles, [DOMAINS[d] for d in MAIN_DOMAINS if d != "demo"], loc="lower right", fontsize=8)
    ax.set_xlabel("조정 오즈비 (95% CI, 로그축) — 7개 영역 동시 조정, 조사설계 반영")
    ax.grid(axis="y", visible=False)
    ax.set_title("바꿀 수 있는 요인 중 우울 증상과 연관이 큰 30개 수준 (p<0.05, |log OR| 순)", loc="left",
                 fontsize=12, fontweight="bold")
    fig.tight_layout()
    fig.savefig(V2_FIG / "reg_v2_01_forest_modifiable.png")
    plt.close(fig)


def plot_combos(summary: pd.DataFrame, cells: pd.DataFrame, count: pd.DataFrame):
    plt = setup_matplotlib()
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
        ax.text(i, v + 0.15, f"{v:.1f}%\n(n={n:,})", ha="center", fontsize=7.5)
    ax.set_xticks(range(len(count)), count["healthy_factors"])
    ax.set_xlabel("충족한 건강 생활요인 개수 (신체활동 권고 + 6개 생활요인)")
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
    count, count_test = lifestyle_count(d, r, in_sample)

    V2_REPORT.mkdir(parents=True, exist_ok=True)
    t.to_csv(V2_REPORT / "reg_v2_full_or.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    var_tests.to_csv(V2_REPORT / "reg_v2_variable_tests.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    summary.to_csv(V2_REPORT / "reg_v2_pa_combo_summary.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    cells.to_csv(V2_REPORT / "reg_v2_pa_combo_cells.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    count.to_csv(V2_REPORT / "reg_v2_lifestyle_count.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    V2_FIG.mkdir(parents=True, exist_ok=True)
    plot_forest(t)
    plot_combos(summary, cells, count)

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
    print("\n[건강 생활요인 개수]", f"결합 검정 p={count_test['p']:.2e}")
    print(count.round(4).to_string(index=False))


if __name__ == "__main__":
    main()
