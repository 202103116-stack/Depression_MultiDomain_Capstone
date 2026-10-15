"""조사설계를 반영한 조정 로지스틱 회귀 — H1(활동조합 조정 차이), H2(활동조합 × 연락 빈도 상호작용).

실행: python src/survey_regression.py   (preprocess.py 실행 후)
산출:
  outputs/reports/reg_h1_or.csv              H1 조정 오즈비(활동조합) — 주 모형 + 민감도
  outputs/reports/reg_h1_margins.csv         H1 활동조합별 조정 유병률(예측 주변값)과 차이
  outputs/reports/reg_h2_tests.csv           H2 상호작용 결합 Wald 검정 — 친구(주) / 친척·이웃(민감도) / 이분·6범주
  outputs/reports/reg_h2_margins.csv         H2 활동조합 × 친구 주 1회 이상 조정 유병률, 가법·승법 상호작용 대비
  outputs/reports/reg_full_coefficients.csv  모든 모형의 전체 계수
  outputs/figures/reg_01_h1.png, reg_02_h2.png

방법 (지침서 권고: 가중치 wt_p, 층 kstrata, 집락 spot_no)
- 점추정: 개인가중치 wt_p를 적용한 로지스틱 회귀(가중 최대우도, IRLS).
- 분산: 테일러 선형화(샌드위치) — 층 안에서 집락(PSU) 점수합의 편차로 계산, 유한모집단 수정 없음.
  R survey::svyglm, SAS PROC SURVEYLOGISTIC과 같은 방식. PSU가 1개인 층은 SAS 기본값처럼 분산 기여 0.
- 부분모집단: 분석 대상(완전 사례)이 아닌 사람도 설계 구조(층·집락)에는 남겨 두고 점수를 0으로 둔다(도메인 추정).
- 자유도: 설계 자유도 = PSU 수 − 층 수. 결합 검정은 수정 Wald F = (df−q+1)/(df·q)·W ~ F(q, df−q+1).
- 조정 유병률: 표본 전원의 공변량을 그대로 두고 활동조합만 바꿔 예측한 가중 평균(예측 주변값), 델타법 CI.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from matplotlib.ticker import NullFormatter
from scipy import stats

from utils import COMBO_LABELS, CONTACT_LABELS, FIG_DIR, INK_MUTED, PALETTE, REPORT_DIR, load_analysis_table, setup_matplotlib

# ---------------------------------------------------------------------------
# 공변량 설계 (해석 가능하도록 범주화, 기준범주는 첫 값)
# ---------------------------------------------------------------------------
AGE_BINS = [18, 29, 39, 49, 59, 69, 79, 200]
AGE_LABELS = ["19-29", "30-39", "40-49", "50-59", "60-69", "70-79", "80+"]
BMI_BINS = [0, 18.5, 23, 25, 100]  # 대한비만학회 기준: 저체중 / 정상 / 비만전단계 / 비만
BMI_LABELS = ["<18.5", "18.5-23", "23-25", "25+"]

CONTROL_CATS = {
    "age_grp": "40-49",
    "sex": 1,
    "educ": 5,
    "econ_active": 1,
    "marital": 1,
    "hh_type": 2,
    "inc_q": 3,
    "bmi_grp": "18.5-23",
    "htn": 0, "dm": 0, "osteo": 0,
}


def prepare(df: pd.DataFrame) -> pd.DataFrame:
    d = df.copy()
    d["age_grp"] = pd.cut(d["age"], AGE_BINS, labels=AGE_LABELS).astype(str)
    d["bmi_grp"] = pd.cut(d["bmi"], BMI_BINS, labels=BMI_LABELS, right=False).astype(object).where(d["bmi"].notna())
    # 균등화 소득 5분위 — 분석표본의 wt_p 가중 분위수(모집단 기준)
    s = d[(d["in_analysis"] == 1) & d["income_equiv"].notna()]
    order = s["income_equiv"].sort_values(kind="stable")
    cumw = s.loc[order.index, "wt_p"].cumsum() / s["wt_p"].sum()
    cuts = [order[cumw >= q].iloc[0] for q in (0.2, 0.4, 0.6, 0.8)]
    d["inc_q"] = pd.cut(d["income_equiv"], [-np.inf] + cuts + [np.inf], labels=[1, 2, 3, 4, 5]).astype(float)
    return d


def design_matrix(d: pd.DataFrame, combo: bool = True, contact: str | None = None,
                  interaction: str | None = None, missing_category: bool = False) -> pd.DataFrame:
    """더미 코딩 설계행렬. interaction='full'(6범주) 또는 'weekly'(주 1회 이상 이분)."""
    cols = {"const": np.ones(len(d))}
    controls = dict(CONTROL_CATS)
    for var, ref in controls.items():
        x = d[var]
        if missing_category and var in ("inc_q", "bmi_grp"):
            x = x.astype(object).where(x.notna(), "missing")
        for lv in sorted(x.dropna().unique(), key=str):
            if lv == ref:
                continue
            cols[f"{var}={lv}"] = (x == lv).astype(float).where(x.notna())
    if combo:
        for k in (2, 3, 4):
            cols[f"combo={COMBO_LABELS[k]}"] = (d["activity_combo"] == k).astype(float)
    if contact:
        c = d[contact]
        if interaction == "weekly":
            cols[f"{contact}_weekly"] = (c >= 4).astype(float).where(c.notna())
        else:
            for lv in (1, 2, 3, 5, 6):  # 기준: 4(주 1회)
                cols[f"{contact}={CONTACT_LABELS[lv]}"] = (c == lv).astype(float).where(c.notna())
        if interaction:
            for k in (2, 3, 4):
                ck = (d["activity_combo"] == k).astype(float)
                if interaction == "weekly":
                    cols[f"combo={COMBO_LABELS[k]}×{contact}_weekly"] = ck * cols[f"{contact}_weekly"]
                else:
                    for lv in (1, 2, 3, 5, 6):
                        cols[f"combo={COMBO_LABELS[k]}×{contact}={CONTACT_LABELS[lv]}"] = ck * cols[f"{contact}={CONTACT_LABELS[lv]}"]
    return pd.DataFrame(cols, index=d.index)


# ---------------------------------------------------------------------------
# 설계 기반 로지스틱 회귀
# ---------------------------------------------------------------------------
class SurveyLogit:
    def __init__(self, X: pd.DataFrame, y: np.ndarray, w: np.ndarray, domain: np.ndarray,
                 strata: np.ndarray, psu: np.ndarray):
        self.names = list(X.columns)
        self.domain = domain & X.notna().all(axis=1).to_numpy() & ~np.isnan(y)
        self.X = X.to_numpy(dtype=float)
        self.y, self.w, self.strata, self.psu = y, w, strata, psu
        self.n_psu = len(np.unique(psu))
        self.n_strata = len(np.unique(strata))
        self.df = self.n_psu - self.n_strata

    def fit(self, max_iter: int = 50, tol: float = 1e-10):
        m = self.domain
        X, y, w = self.X[m], self.y[m], self.w[m] / self.w[m].mean()  # 가중치 스케일은 추정에 무관
        beta = np.zeros(X.shape[1])
        for _ in range(max_iter):
            p = 1 / (1 + np.exp(-(X @ beta)))
            H = (X * (w * p * (1 - p))[:, None]).T @ X
            step = np.linalg.solve(H, X.T @ (w * (y - p)))
            beta += step
            if np.max(np.abs(step)) < tol:
                break
        self.beta = beta
        self._variance()
        return self

    def _variance(self):
        """테일러 선형화: V = H⁻¹ · Σ_h n_h/(n_h−1) Σ_c (u_hc − ū_h)(u_hc − ū_h)ᵀ · H⁻¹ (원 가중치 기준)."""
        m = self.domain
        p = 1 / (1 + np.exp(-(self.X @ self.beta)))
        H = (self.X[m] * (self.w[m] * p[m] * (1 - p[m]))[:, None]).T @ self.X[m]
        U = np.zeros_like(self.X)
        U[m] = self.X[m] * (self.w[m] * (self.y[m] - p[m]))[:, None]  # 도메인 밖은 점수 0
        psu_codes, psu_idx = np.unique(self.psu, return_inverse=True)
        u_psu = np.zeros((len(psu_codes), U.shape[1]))
        np.add.at(u_psu, psu_idx, U)
        psu_stratum = pd.Series(self.strata).groupby(psu_idx).first().to_numpy()
        meat = np.zeros((U.shape[1], U.shape[1]))
        for h in np.unique(psu_stratum):
            uh = u_psu[psu_stratum == h]
            nh = len(uh)
            if nh < 2:
                continue  # 단일 PSU 층: SAS 기본값처럼 분산 기여 0
            dev = uh - uh.mean(axis=0)
            meat += nh / (nh - 1) * dev.T @ dev
        Hinv = np.linalg.inv(H)
        self.vcov = Hinv @ meat @ Hinv
        self.se = np.sqrt(np.diag(self.vcov))

    def table(self) -> pd.DataFrame:
        t = stats.t.ppf(0.975, self.df)
        z = self.beta / self.se
        return pd.DataFrame({
            "term": self.names, "beta": self.beta, "se": self.se,
            "OR": np.exp(self.beta), "OR_low": np.exp(self.beta - t * self.se), "OR_high": np.exp(self.beta + t * self.se),
            "p": 2 * stats.t.sf(np.abs(z), self.df),
        })

    def wald(self, terms: list[str]) -> dict:
        idx = [self.names.index(t) for t in terms]
        b, V = self.beta[idx], self.vcov[np.ix_(idx, idx)]
        W = float(b @ np.linalg.solve(V, b))
        q = len(idx)
        F = (self.df - q + 1) / (self.df * q) * W
        return {"q": q, "Wald_chi2": W, "F": F, "df1": q, "df2": self.df - q + 1,
                "p": float(stats.f.sf(F, q, self.df - q + 1))}

    def margins(self, X_cf: dict[str, np.ndarray]) -> dict[str, tuple[float, np.ndarray]]:
        """반사실 설계행렬별 가중 평균 예측확률과 β에 대한 기울기(델타법용)."""
        m = self.domain
        w = self.w[m] / self.w[m].sum()
        out = {}
        for key, Xc in X_cf.items():
            Xc = Xc[m]
            p = 1 / (1 + np.exp(-(Xc @ self.beta)))
            out[key] = (float(w @ p), (Xc * (w * p * (1 - p))[:, None]).sum(axis=0))
        return out

    def contrast(self, est: float, grad: np.ndarray) -> tuple[float, float, float, float]:
        se = float(np.sqrt(grad @ self.vcov @ grad))
        t = stats.t.ppf(0.975, self.df)
        return est, est - t * se, est + t * se, float(2 * stats.t.sf(abs(est / se), self.df))


def counterfactual(model: SurveyLogit, set_terms: dict[str, float], zero_prefix: list[str]) -> np.ndarray:
    """zero_prefix로 시작하는 열을 0으로 만든 뒤 set_terms 값을 지정."""
    Xc = model.X.copy()
    for j, name in enumerate(model.names):
        if any(name.startswith(pfx) for pfx in zero_prefix):
            Xc[:, j] = 0.0
    for name, val in set_terms.items():
        Xc[:, model.names.index(name)] = val
    return Xc


# ---------------------------------------------------------------------------
# 분석
# ---------------------------------------------------------------------------
def fit_model(d, domain, **kw) -> SurveyLogit:
    X = design_matrix(d, **kw)
    return SurveyLogit(X, d["Y"].to_numpy(float), d["wt_p"].to_numpy(float), domain,
                       d["kstrata"].to_numpy(), d["spot_key"].to_numpy()).fit()


def h1_margins(model: SurveyLogit, label: str) -> pd.DataFrame:
    combo_terms = [f"combo={COMBO_LABELS[k]}" for k in (2, 3, 4)]
    cf = {COMBO_LABELS[1]: counterfactual(model, {}, combo_terms)}
    for k in (2, 3, 4):
        cf[COMBO_LABELS[k]] = counterfactual(model, {f"combo={COMBO_LABELS[k]}": 1.0}, combo_terms)
    mg = model.margins(cf)
    rows = []
    base_est, base_grad = mg[COMBO_LABELS[1]]
    for k in (1, 2, 3, 4):
        est, grad = mg[COMBO_LABELS[k]]
        e, lo, hi, _ = model.contrast(est, grad)
        row = {"model": label, "activity_combo": COMBO_LABELS[k], "adj_prev": e, "low": lo, "high": hi}
        if k != 1:
            de, dlo, dhi, dp = model.contrast(est - base_est, grad - base_grad)
            row.update({"diff_vs_none": de, "diff_low": dlo, "diff_high": dhi, "diff_p": dp})
        rows.append(row)
    return pd.DataFrame(rows)


def h2_weekly_margins(model: SurveyLogit, contact: str) -> pd.DataFrame:
    """활동조합(4) × 연락 주1회 이상(2) 조정 유병률, 연락 수준별 '둘 다 충족 − 미충족' 차이와 그 차이(가법 상호작용)."""
    combo_terms = [f"combo={COMBO_LABELS[k]}" for k in (2, 3, 4)]
    wk = f"{contact}_weekly"
    zero = combo_terms + [wk]
    cf = {}
    for k in (1, 2, 3, 4):
        for f in (0, 1):
            sets = {wk: float(f)}
            if k != 1:
                sets[f"combo={COMBO_LABELS[k]}"] = 1.0
                sets[f"combo={COMBO_LABELS[k]}×{wk}"] = float(f)
            cf[(k, f)] = counterfactual(model, sets, zero)
    mg = model.margins(cf)
    rows = []
    for (k, f), (est, grad) in mg.items():
        e, lo, hi, _ = model.contrast(est, grad)
        rows.append({"contact": contact, "row": "adj_prev", "activity_combo": COMBO_LABELS[k],
                     "weekly": f, "est": e, "low": lo, "high": hi, "p": np.nan})
    for k in (2, 3, 4):
        diffs = {}
        for f in (0, 1):
            est = mg[(k, f)][0] - mg[(1, f)][0]
            grad = mg[(k, f)][1] - mg[(1, f)][1]
            diffs[f] = (est, grad)
            e, lo, hi, p = model.contrast(est, grad)
            rows.append({"contact": contact, "row": "diff_vs_none", "activity_combo": COMBO_LABELS[k],
                         "weekly": f, "est": e, "low": lo, "high": hi, "p": p})
        # 가법 상호작용: (주1회 이상에서의 차이) − (주1회 미만에서의 차이)
        e, lo, hi, p = model.contrast(diffs[1][0] - diffs[0][0], diffs[1][1] - diffs[0][1])
        rows.append({"contact": contact, "row": "additive_interaction", "activity_combo": COMBO_LABELS[k],
                     "weekly": np.nan, "est": e, "low": lo, "high": hi, "p": p})
    return pd.DataFrame(rows)


def plot_h1(margins: pd.DataFrame, ors: pd.DataFrame):
    plt = setup_matplotlib()
    fig, axes = plt.subplots(1, 2, figsize=(14, 5.2))
    m = margins[margins["model"] == "주 모형"]
    ax = axes[0]
    x = np.arange(4)
    ax.bar(x, m["adj_prev"] * 100, color=PALETTE[:4], width=0.6)
    ax.errorbar(x, m["adj_prev"] * 100, yerr=[(m["adj_prev"] - m["low"]) * 100, (m["high"] - m["adj_prev"]) * 100],
                fmt="none", ecolor="#333", capsize=4, elinewidth=1)
    for xi, v in zip(x, m["adj_prev"] * 100):
        ax.text(xi + 0.08, v, f"{v:.2f}%", fontsize=8, va="bottom")
    ax.set_xticks(x, m["activity_combo"])
    ax.set_ylabel("조정 유병률(%) · 95% CI")
    ax.set_title("(a) 활동조합별 조정 유병률 (예측 주변값, 가중)", loc="left")
    ax.grid(axis="x", visible=False)

    ax = axes[1]
    o = ors[ors["model"] == "주 모형"].reset_index(drop=True)
    y = np.arange(len(o))
    ax.errorbar(o["OR"], y, xerr=[o["OR"] - o["OR_low"], o["OR_high"] - o["OR"]], fmt="o", ms=7,
                color=PALETTE[0], ecolor=PALETTE[0], capsize=4)
    for yi, r in o.iterrows():
        ax.text(r["OR_high"] * 1.02, yi, f"{r['OR']:.2f} [{r['OR_low']:.2f}, {r['OR_high']:.2f}]", va="center", fontsize=8)
    ax.axvline(1, color=INK_MUTED, ls="--", lw=1)
    ax.set_yticks(y, o["term"].str.replace("combo=", ""))
    ax.invert_yaxis()
    ax.set_xscale("log")
    ax.set_xticks([0.3, 0.5, 0.7, 1.0], ["0.3", "0.5", "0.7", "1.0"])
    ax.xaxis.set_minor_formatter(NullFormatter())
    ax.set_xlim(0.25, 1.4)
    ax.set_xlabel("조정 오즈비 (기준: 둘 다 미충족, 로그축)")
    ax.set_title("(b) 조정 오즈비 · 95% CI", loc="left")
    fig.suptitle("H1 — 인구·경제·건강 조정 후 활동조합별 우울 증상 기준 충족", x=0.01, ha="left",
                 fontsize=14, fontweight="bold")
    fig.tight_layout()
    fig.savefig(FIG_DIR / "reg_01_h1.png")
    plt.close(fig)


def plot_h2(h2m: pd.DataFrame):
    plt = setup_matplotlib()
    fig, axes = plt.subplots(1, 2, figsize=(14, 5.2))
    a = h2m[(h2m["contact"] == "contact_friend") & (h2m["row"] == "adj_prev")]
    ax = axes[0]
    x = np.arange(4)
    width = 0.38
    for i, (f, color, lab) in enumerate([(0, INK_MUTED, "친구 연락 주 1회 미만"), (1, PALETTE[0], "친구 연락 주 1회 이상")]):
        s = a[a["weekly"] == f]
        xx = x + (i - 0.5) * width
        ax.bar(xx, s["est"] * 100, width, color=color, label=lab)
        ax.errorbar(xx, s["est"] * 100, yerr=[(s["est"] - s["low"]) * 100, (s["high"] - s["est"]) * 100],
                    fmt="none", ecolor="#333", capsize=3, elinewidth=1)
    ax.set_xticks(x, list(COMBO_LABELS.values()))
    ax.set_ylabel("조정 유병률(%) · 95% CI")
    ax.legend()
    ax.grid(axis="x", visible=False)
    ax.set_title("(a) 친구 연락 수준별 활동조합 조정 유병률", loc="left")

    ax = axes[1]
    dlt = h2m[(h2m["contact"] == "contact_friend") & (h2m["row"] == "diff_vs_none")]
    for i, (f, color, lab) in enumerate([(0, INK_MUTED, "주 1회 미만"), (1, PALETTE[0], "주 1회 이상")]):
        s = dlt[dlt["weekly"] == f]
        xx = np.arange(3) + (i - 0.5) * width
        ax.bar(xx, s["est"] * 100, width, color=color, label=lab)
        ax.errorbar(xx, s["est"] * 100, yerr=[(s["est"] - s["low"]) * 100, (s["high"] - s["est"]) * 100],
                    fmt="none", ecolor="#333", capsize=3, elinewidth=1)
    ax.axhline(0, color=INK_MUTED, lw=1)
    ax.set_xticks(np.arange(3), [COMBO_LABELS[k] for k in (2, 3, 4)])
    ax.set_ylabel("둘 다 미충족 대비 조정 유병률 차이(%p)")
    ax.legend(title="친구 연락")
    ax.grid(axis="x", visible=False)
    ax.set_title("(b) 미충족 대비 차이 — 연락 수준별 비교 (가법 척도)", loc="left")
    fig.suptitle("H2 — 활동조합 차이가 친구 연락 빈도에 따라 다른가", x=0.01, ha="left", fontsize=14, fontweight="bold")
    fig.tight_layout()
    fig.savefig(FIG_DIR / "reg_02_h2.png")
    plt.close(fig)


def main():
    df = prepare(load_analysis_table())
    in_sample = (df["in_analysis"] == 1).to_numpy()

    coef_rows, or_rows, margin_rows, test_rows, h2m_rows = [], [], [], [], []

    def record(model, label):
        t = model.table()
        t.insert(0, "model", label)
        t["n_domain"] = int(model.domain.sum())
        coef_rows.append(t)
        return t

    # ---------------- H1 ----------------
    h1_specs = [
        ("주 모형", dict(combo=True), "완전 사례, 설계 기반"),
        ("민감도: 결측 범주", dict(combo=True, missing_category=True), "소득·BMI 결측을 별도 범주로 두고 표본 유지"),
        ("민감도: 친구 연락 추가 조정", dict(combo=True, contact="contact_friend"), "연락 빈도까지 조정"),
    ]
    for label, kw, note in h1_specs:
        mdl = fit_model(df, in_sample, **kw)
        t = record(mdl, label)
        sub = t[t["term"].str.startswith("combo=") & ~t["term"].str.contains("×")].copy()
        sub["note"] = note
        or_rows.append(sub)
        margin_rows.append(h1_margins(mdl, label))
        print(f"[H1 {label}] n={mdl.domain.sum():,} 설계 df={mdl.df:,}")
        print(sub[["term", "OR", "OR_low", "OR_high", "p"]].round(3).to_string(index=False))

    # 비가중(설계 무시) 비교 — 가중치 영향 확인용
    unw = df.copy()
    unw["wt_p"] = 1.0
    mdl = fit_model(unw, in_sample, combo=True)
    t = record(mdl, "참고: 비가중")
    sub = t[t["term"].str.startswith("combo=")].copy()
    sub["note"] = "가중치 미적용(층·집락만 반영)"
    or_rows.append(sub)

    # ---------------- H2 ----------------
    for contact, role in [("contact_friend", "주 분석"), ("contact_family", "민감도"), ("contact_neighbor", "민감도")]:
        for inter in ("full", "weekly"):
            base = fit_model(df, in_sample, combo=True, contact=contact, interaction=inter)
            label = f"H2 {contact} {inter}"
            record(base, label)
            terms = [n for n in base.names if "×" in n]
            res = base.wald(terms)
            res.update({"contact": contact, "role": role,
                        "coding": "6범주(기준 주 1회) × 활동조합" if inter == "full" else "주 1회 이상 여부 × 활동조합",
                        "n_domain": int(base.domain.sum())})
            test_rows.append(res)
            print(f"[{label}] 상호작용 q={res['q']} F={res['F']:.2f} p={res['p']:.4f}")
            if inter == "weekly":
                h2m_rows.append(h2_weekly_margins(base, contact))

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    ors = pd.concat(or_rows)
    ors.to_csv(REPORT_DIR / "reg_h1_or.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    margins = pd.concat(margin_rows)
    margins.to_csv(REPORT_DIR / "reg_h1_margins.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    tests = pd.DataFrame(test_rows)[["contact", "role", "coding", "q", "Wald_chi2", "F", "df1", "df2", "p", "n_domain"]]
    tests.to_csv(REPORT_DIR / "reg_h2_tests.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    h2m = pd.concat(h2m_rows)
    h2m.to_csv(REPORT_DIR / "reg_h2_margins.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    pd.concat(coef_rows).to_csv(REPORT_DIR / "reg_full_coefficients.csv", index=False, encoding="utf-8-sig",
                                float_format="%.5f")

    FIG_DIR.mkdir(parents=True, exist_ok=True)
    plot_h1(margins, ors)
    plot_h2(h2m)

    print("\n[H1 조정 유병률]")
    print(margins.round(4).to_string(index=False))
    print("\n[H2 결합 검정]")
    print(tests.round(4).to_string(index=False))
    print("\n[H2 가법 상호작용 (친구)]")
    print(h2m[h2m["row"] != "adj_prev"].round(4).to_string(index=False))


if __name__ == "__main__":
    main()
