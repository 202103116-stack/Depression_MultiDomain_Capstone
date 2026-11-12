"""v3 공통 — 경로, 경제 불리 지표, 생활요인 개수, 교차 범주(칸) 모형.

v3 주제: 건강 생활요인은 경제적 불리함을 상쇄하는가(역전점 분석 + 운동 요인).
데이터·변수 처리·회귀 도구는 v2(src/v2)와 1차(src)의 검증된 함수를 그대로 쓴다.
"""
from __future__ import annotations

import itertools
import sys
from pathlib import Path

import numpy as np
import pandas as pd

V2_SRC = Path(__file__).resolve().parents[1] / "v2"
if str(V2_SRC) not in sys.path:
    sys.path.insert(0, str(V2_SRC))

import common  # noqa: E402,F401  (src, src/v2 경로 등록)
from common import load_v2_table  # noqa: E402
from eda_v2 import weighted_quintile  # noqa: E402
from survey_regression import SurveyLogit  # noqa: E402
from survey_regression_v2 import PARTNERS, SPEC, design, recode  # noqa: E402
from utils import ROOT  # noqa: E402

V3_FIG = ROOT / "outputs" / "v3" / "figures"
V3_REPORT = ROOT / "outputs" / "v3" / "reports"
V3_DOCS = ROOT / "docs" / "v3"
REPORT_DIR = ROOT / "report_v3"

BINS = ["0~2개", "3개", "4개", "5개", "6~7개"]
ADJ = [s for s in SPEC if s[2] in ("demo", "phys")]  # 경제 축을 비교하므로 다른 경제 변수는 조정하지 않음
ADJ_SENS = ADJ + [s for s in SPEC if s[0] in ("food_insecurity", "livelihood")]  # 소득 민감도: 식품안정성·수급 추가

NONEX = [(name, fn) for name, _, fn, prox in PARTNERS if not prox]  # 운동 외 생활요인 6개
EXERCISE = [("walk_ok", "걷기 실천(주 5일·30분)"), ("aerobic_ok", "중강도 이상 유산소 실천"),
            ("strength_ok", "근력운동 주 2일 이상")]
BEHAVIOR_ONLY = ["비흡연(현재 흡연 아님)", "고위험음주 아님", "아침식사 주 5회 이상"]  # + 신체활동 권고


def load():
    d = load_v2_table()
    d = d[d["Y"].notna()].reset_index(drop=True)
    return d, recode(d)


def _count(stack: pd.DataFrame) -> pd.Series:
    return stack.sum(axis=1).where(stack.notna().all(axis=1))


def lifestyle(d: pd.DataFrame) -> dict[str, pd.Series]:
    """생활요인 개수들. count7 = 신체활동 권고 + 운동 외 6개(v2 5-2와 같은 정의)."""
    nonex = pd.concat([fn(d) for _, fn in NONEX], axis=1)
    ex = d[[c for c, _ in EXERCISE]]
    beh = pd.concat([d["pa_guideline"]] + [fn(d) for name, fn in NONEX if name in BEHAVIOR_ONLY], axis=1)
    out = {
        "count7": _count(pd.concat([d["pa_guideline"], nonex], axis=1)),
        "nonex6": _count(nonex),
        "ex3": _count(ex),
        "beh4": _count(beh),
    }
    out["count9"] = out["nonex6"] + out["ex3"]
    return out


def binned(cnt: pd.Series, cuts: list[tuple[int, int, str]]) -> pd.Series:
    """cuts = [(하한, 상한, 라벨)] — 양끝 포함."""
    out = pd.Series(np.nan, index=cnt.index, dtype=object)
    for lo, hi, lab in cuts:
        out[cnt.between(lo, hi)] = lab
    return out


BIN_CUTS = [(0, 2, "0~2개"), (3, 3, "3개"), (4, 4, "4개"), (5, 5, "5개"), (6, 7, "6~7개")]


def indicators(d: pd.DataFrame) -> dict:
    iq = weighted_quintile(d["log_income_equiv"], d["wt_p"])
    return {
        "income": dict(label="균등화 소득", short="소득",
                       series=iq.map({1: "하위(1분위)", 2: "중위(2~4분위)", 3: "중위(2~4분위)", 4: "중위(2~4분위)", 5: "상위(5분위)"}),
                       groups=["하위(1분위)", "중위(2~4분위)", "상위(5분위)"], dis="하위(1분위)", adv="상위(5분위)"),
        "livelihood": dict(label="기초생활수급", short="수급",
                           series=d["livelihood"].map({1: "현재 수급", 2: "비수급", 3: "비수급"}),
                           groups=["현재 수급", "비수급"], dis="현재 수급", adv="비수급"),
        "food": dict(label="가구 식품안정성", short="식품",
                     series=d["food_insecurity"].map({1: "안정", 2: "안정", 3: "불안정", 4: "불안정"}),
                     groups=["불안정", "안정"], dis="불안정", adv="안정"),
    }


def income_quintile(d: pd.DataFrame) -> pd.Series:
    return weighted_quintile(d["log_income_equiv"], d["wt_p"])


def survey_fit(X: pd.DataFrame, d: pd.DataFrame, mask: np.ndarray) -> SurveyLogit:
    return SurveyLogit(X, d["Y"].to_numpy(float), d["wt_p"].to_numpy(float), mask,
                       d["kstrata"].to_numpy(), d["spot_key"].to_numpy()).fit()


def adj_design(r: pd.DataFrame, spec, mask: np.ndarray) -> pd.DataFrame:
    """조정변수 설계행렬. 하위집단(mask)에 기준범주가 없으면 가장 흔한 수준으로 바꾸고, 하위집단에서 상수인 열은 뺀다."""
    spec2 = []
    for var, ref, dom, name in spec:
        x = r.loc[mask, var].dropna()
        if x.nunique() < 2:
            continue
        spec2.append((var, ref if (x == ref).any() else x.value_counts().idxmax(), dom, name))
    X, _ = design(r, spec2)
    keep = [c for c in X.columns if c == "const" or X.loc[mask, c].fillna(0).sum() > 0]
    return X[keep]


class CellModel:
    """교차 범주(칸) 모형: Y ~ 칸 지시변수(기준 칸 제외) + 조정변수.

    margins는 모형 도메인 전체의 조정변수 분포로 표준화한 칸별 예측 유병률(델타법 기울기 포함).
    """

    def __init__(self, d, Xadj, factors: list[tuple[pd.Series, list]], ref: tuple, mask: np.ndarray):
        self.levels = [lv for _, lv in factors]
        self.cells = list(itertools.product(*self.levels))
        assert ref in self.cells
        ok = np.asarray(mask, bool).copy()
        for s, _ in factors:
            ok &= s.notna().to_numpy()
        X = Xadj.copy()
        member = {}
        for c in self.cells:
            m = np.ones(len(d), bool)
            for (s, _), v in zip(factors, c):
                m &= (s == v).to_numpy()
            member[c] = m
            if c != ref:
                X[self.col(c)] = pd.Series(m.astype(float), index=X.index).where(ok)
        self.mdl = survey_fit(X, d, ok)
        self.d, self.ref, self.member = d, ref, member
        idx = [self.mdl.names.index(self.col(c)) for c in self.cells if c != ref]
        self.mg = {}
        for c in self.cells:
            Xc = self.mdl.X.copy()
            Xc[:, idx] = 0.0
            if c != ref:
                Xc[:, self.mdl.names.index(self.col(c))] = 1.0
            self.mg[c] = self.mdl.margins({0: Xc})[0]

    @staticmethod
    def col(c) -> str:
        return "cell=" + "|".join(map(str, c))

    @property
    def domain(self):
        return self.mdl.domain

    def lin(self, coefs: dict) -> tuple[float, np.ndarray]:
        est = sum(w * self.mg[c][0] for c, w in coefs.items())
        grad = sum(w * self.mg[c][1] for c, w in coefs.items())
        return est, grad

    def ci(self, coefs: dict):
        return self.mdl.contrast(*self.lin(coefs))

    def share(self, fixed: dict[int, object], axis: int, among: np.ndarray | None = None) -> dict:
        """도메인(또는 among) 안에서 axis 요인의 가중 분포. fixed = {요인 위치: 값} 조건."""
        dom = self.domain if among is None else self.domain & among
        w = self.d["wt_p"].to_numpy()
        out = {}
        for lv in self.levels[axis]:
            m = dom & np.logical_or.reduce([self.member[c] for c in self.cells
                                       if c[axis] == lv and all(c[k] == v for k, v in fixed.items())])
            out[lv] = w[m].sum()
        tot = sum(out.values())
        return {k: v / tot for k, v in out.items()}

    def table(self, **extra) -> pd.DataFrame:
        rows = []
        y, w = self.d["Y"].to_numpy(), self.d["wt_p"].to_numpy()
        for c in self.cells:
            m = self.domain & self.member[c]
            e, lo, hi, _ = self.mdl.contrast(*self.mg[c])
            rows.append({**extra, **{f"f{i}": v for i, v in enumerate(c)}, "n": int(m.sum()), "events": int(y[m].sum()),
                         "crude_w": float(np.average(y[m], weights=w[m])) if m.any() else np.nan,
                         "adj_prev": e, "low": lo, "high": hi})
        return pd.DataFrame(rows)


def interaction_model(d, Xadj, g: pd.Series, groups, adv, b: pd.Series, levels, mask):
    """주효과 + 곱항 모수화 모형 → 승법 상호작용 결합 Wald."""
    ok = np.asarray(mask, bool) & g.notna().to_numpy() & b.notna().to_numpy()
    X = Xadj.copy()
    for a in groups:
        if a != adv:
            X[f"G={a}"] = (g == a).astype(float).where(ok)
    for lv in levels[1:]:
        X[f"B={lv}"] = (b == lv).astype(float).where(ok)
    for a in groups:
        if a == adv:
            continue
        for lv in levels[1:]:
            X[f"G={a}×B={lv}"] = X[f"G={a}"] * X[f"B={lv}"]
    m = survey_fit(X, d, ok)
    return m.wald([n for n in m.names if "×" in n])
