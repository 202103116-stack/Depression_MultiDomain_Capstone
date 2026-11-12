"""v4 공통 — 경로, 결과변수(y5·y10·y_mood), 탐색/확인 분할, 여러 모형에 걸친 대비의 조사설계 분산.

v4 주제: 스포츠와 함께할 때 더 큰 효과 — 운동 × 생활요인 조합과 우울 증상(docs/v4/WORKFLOW_v4.md).
데이터·회귀 도구는 v2(src/v2)·v3(src/v3)·1차(src)의 검증된 함수를 그대로 쓴다.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

V2_SRC = Path(__file__).resolve().parents[1] / "v2"
if str(V2_SRC) not in sys.path:
    sys.path.insert(0, str(V2_SRC))

import common  # noqa: E402,F401  (src, src/v2 경로 등록)
from common import V2_TABLE  # noqa: E402
from survey_regression import SurveyLogit  # noqa: E402
from utils import PROCESSED_DIR, ROOT  # noqa: E402

V4_PROCESSED = PROCESSED_DIR / "v4"
V4_TABLE = V4_PROCESSED / "analysis_table_v4.csv"
V4_FIG = ROOT / "outputs" / "v4" / "figures"
V4_REPORT = ROOT / "outputs" / "v4" / "reports"
V4_DOCS = ROOT / "docs" / "v4"

# 결과변수(D-41): 주 결과 y5, 교차·재현 y_mood, 민감도 y10
OUTCOMES = {"y5": "PHQ-9 ≥ 5", "y_mood": "우울감 경험(mtb_01z1)", "y10": "PHQ-9 ≥ 10"}


def load_v4_table() -> pd.DataFrame:
    """v2 분석표 + 결과변수 3종. 분석 대상은 PHQ-9 산출 가능자(231,290명)."""
    d = pd.read_csv(V4_TABLE, dtype={"exmprs_no": str, "household_key": str, "spot_key": str})
    return d[d["Y"].notna()].reset_index(drop=True)


def wmean(x, w) -> float:
    x, w = np.asarray(x, float), np.asarray(w, float)
    ok = ~np.isnan(x)
    return float(np.average(x[ok], weights=w[ok]))


def fit_logit(X: pd.DataFrame, d: pd.DataFrame, y: str, mask: np.ndarray) -> SurveyLogit:
    return SurveyLogit(X, d[y].to_numpy(float), d["wt_p"].to_numpy(float), np.asarray(mask, bool),
                       d["kstrata"].to_numpy(), d["spot_key"].to_numpy()).fit()


# ---------------------------------------------------------------------------
# 여러 모형에 걸친 대비: PSU 단위 영향함수를 모아 결합 분산을 구한다.
# 같은 표본 설계(층·집락)에서 적합한 모형들의 추정량 q_k = f_k(β_k)에 대해
# q_k의 선형화 영향 = g_kᵀ H_k⁻¹ u_i(β_k) (u_i = 응답자 점수, 도메인 밖 0).
# PSU별로 합산하고 층 안에서 중심화하면 SurveyLogit._variance와 같은 테일러 분산이 된다.
# ---------------------------------------------------------------------------
class Influence:
    def __init__(self, strata: np.ndarray, psu: np.ndarray):
        self.psu_codes, self.psu_idx = np.unique(psu, return_inverse=True)
        self.psu_stratum = pd.Series(strata).groupby(self.psu_idx).first().to_numpy()
        self.df = len(self.psu_codes) - len(np.unique(strata))
        self.cols: dict[str, np.ndarray] = {}
        self.est: dict[str, float] = {}

    def add(self, mdl: SurveyLogit, quantities: dict[str, tuple[float, np.ndarray]]):
        """quantities = {키: (추정값, β에 대한 기울기)} — 한 모형에서 나온 추정량들을 등록한다."""
        m = mdl.domain
        p = 1 / (1 + np.exp(-(mdl.X @ mdl.beta)))
        H = (mdl.X[m] * (mdl.w[m] * p[m] * (1 - p[m]))[:, None]).T @ mdl.X[m]
        keys = list(quantities)
        A = np.linalg.solve(H, np.column_stack([quantities[k][1] for k in keys]))  # H 대칭
        Z = np.zeros((len(mdl.y), len(keys)))
        Z[m] = (mdl.X[m] @ A) * (mdl.w[m] * (mdl.y[m] - p[m]))[:, None]
        tot = np.zeros((len(self.psu_codes), len(keys)))
        np.add.at(tot, self.psu_idx, Z)
        for i, k in enumerate(keys):
            self.cols[k], self.est[k] = tot[:, i], quantities[k][0]

    def _var(self, v: np.ndarray) -> float:
        out = 0.0
        for h in np.unique(self.psu_stratum):
            vh = v[self.psu_stratum == h]
            if len(vh) < 2:
                continue
            out += len(vh) / (len(vh) - 1) * float(((vh - vh.mean()) ** 2).sum())
        return out

    def combo(self, weights: dict[str, float]) -> tuple[float, float, float, float]:
        """Σ w_k q_k의 추정·95% CI·p (t 분포, 자유도 = PSU 수 − 층 수)."""
        est = sum(w * self.est[k] for k, w in weights.items())
        v = sum(w * self.cols[k] for k, w in weights.items())
        se = np.sqrt(self._var(v))
        t = stats.t.ppf(0.975, self.df)
        return est, est - t * se, est + t * se, float(2 * stats.t.sf(abs(est / se), self.df))

    def wald_equal(self, keys: list[str]) -> float:
        """q_1 = … = q_K 동일성 결합 검정 p (차이 K−1개, F 근사)."""
        diffs = [{keys[0]: 1.0, k: -1.0} for k in keys[1:]]
        b = np.array([sum(w * self.est[k] for k, w in c.items()) for c in diffs])
        Z = np.column_stack([sum(w * self.cols[k] for k, w in c.items()) for c in diffs])
        V = np.zeros((len(diffs), len(diffs)))
        for h in np.unique(self.psu_stratum):
            zh = Z[self.psu_stratum == h]
            if len(zh) < 2:
                continue
            dev = zh - zh.mean(axis=0)
            V += len(zh) / (len(zh) - 1) * dev.T @ dev
        q = len(diffs)
        W = float(b @ np.linalg.solve(V, b))
        F = (self.df - q + 1) / (self.df * q) * W
        return float(stats.f.sf(F, q, self.df - q + 1))
