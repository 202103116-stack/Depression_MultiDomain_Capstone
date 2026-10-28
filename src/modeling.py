"""공통 모델링 유틸 — 정보 블록(M0~M3), 전처리 파이프라인, 알고리즘, 분할, 평가지표.

결측 대치·인코딩은 모두 sklearn Pipeline 안에서 학습 데이터에만 적합된다(누수 방지).
"""
from __future__ import annotations
import os

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.preprocessing import OneHotEncoder, SplineTransformer, StandardScaler

from utils import SEED

# ---------------------------------------------------------------------------
# 정보 블록
# ---------------------------------------------------------------------------
NUMERIC = ["age", "log_income_equiv", "bmi"]
CONTROL_CAT = ["sex", "educ", "econ_active", "marital", "hh_type", "htn", "dm", "osteo"]


def block_features(block: str, contact: str = "contact_friend") -> tuple[list[str], list[str]]:
    """블록별 (수치형, 범주형) 피처 목록. contact는 민감도 분석에서 친척/이웃으로 교체."""
    cats = list(CONTROL_CAT)
    if block in ("M1", "M2", "M3"):
        cats.append("activity_combo")
    if block in ("M2", "M3"):
        cats.append(contact)
    if block == "M3":
        cats.append(f"combo_x_{contact}")
    return list(NUMERIC), cats


def make_X(df: pd.DataFrame, block: str, contact: str = "contact_friend") -> pd.DataFrame:
    num, cat = block_features(block, contact)
    X = df[num].copy()
    for c in cat:
        if c.startswith("combo_x_"):
            # 활동조합 × 연락빈도 교차 범주(4×6=24 수준). 로지스틱에서는 원-핫 시 상호작용항 전체가 된다
            src = df[contact]
            X[c] = (df["activity_combo"].astype("Int64").astype(str) + "_" + src.astype("Int64").astype(str)).where(src.notna())
        else:
            X[c] = df[c].astype("Int64").astype(str).where(df[c].notna())
    return X


# ---------------------------------------------------------------------------
# 전처리
# ---------------------------------------------------------------------------
def _onehot():
    return make_pipeline(SimpleImputer(strategy="most_frequent"),
                         OneHotEncoder(handle_unknown="ignore", sparse_output=False))


def linear_preprocessor(num: list[str], cat: list[str], age_spline: bool = True) -> ColumnTransformer:
    """로지스틱·MLP용: 수치형 중앙값 대치+결측지시자+표준화, 나이는 스플라인(유연한 항), 범주형 원-핫."""
    num_other = [c for c in num if c != "age" or not age_spline]
    parts = [
        ("num", make_pipeline(SimpleImputer(strategy="median", add_indicator=True), StandardScaler()), num_other),
        ("cat", _onehot(), cat),
    ]
    if age_spline and "age" in num:
        parts.append(("age", make_pipeline(SimpleImputer(strategy="median"),
                                           SplineTransformer(n_knots=5, degree=3), StandardScaler()), ["age"]))
    return ColumnTransformer(parts)


def tree_preprocessor(num: list[str], cat: list[str]) -> ColumnTransformer:
    return ColumnTransformer([
        ("num", SimpleImputer(strategy="median", add_indicator=True), num),
        ("cat", _onehot(), cat),
    ])


class CatBoostModel(BaseEstimator, ClassifierMixin):
    """CatBoost 래퍼 — 범주형은 네이티브 처리, 수치형 결측은 CatBoost 기본 처리(Min)."""

    def __init__(self, cat_features=None, iterations=600, depth=6, learning_rate=0.05, random_state=SEED):
        self.cat_features = cat_features
        self.iterations = iterations
        self.depth = depth
        self.learning_rate = learning_rate
        self.random_state = random_state

    def _prep(self, X: pd.DataFrame) -> pd.DataFrame:
        X = X.copy()
        for c in self.cat_features:
            X[c] = X[c].fillna("NA").astype(str)
        return X

    def fit(self, X, y):
        from catboost import CatBoostClassifier

        self.model_ = CatBoostClassifier(
            iterations=self.iterations, depth=self.depth, learning_rate=self.learning_rate,
            random_seed=self.random_state, verbose=0, thread_count=-1, allow_writing_files=False,
        )
        self.model_.fit(self._prep(X), y, cat_features=list(self.cat_features))
        self.classes_ = np.array([0, 1])
        return self

    def predict_proba(self, X):
        return self.model_.predict_proba(self._prep(X))


ALGORITHMS = ["dummy", "logistic", "catboost", "random_forest", "lightgbm", "mlp"]
ALGO_LABELS = {
    "dummy": "Dummy(사전확률)", "logistic": "로지스틱 회귀", "catboost": "CatBoost",
    "random_forest": "RandomForest", "lightgbm": "LightGBM", "mlp": "MLP",
}


def build_model(algo: str, num: list[str], cat: list[str]):
    """고정 하이퍼파라미터(사전 지정) — 튜닝 없음, decision_log D-12 참고."""
    if algo == "dummy":
        return DummyClassifier(strategy="prior")
    if algo == "logistic":
        return Pipeline([("pre", linear_preprocessor(num, cat)),
                         ("clf", LogisticRegression(C=1.0, max_iter=3000))])
    if algo == "catboost":
        return CatBoostModel(cat_features=cat)
    if algo == "random_forest":
        return Pipeline([("pre", tree_preprocessor(num, cat)),
                         ("clf", RandomForestClassifier(n_estimators=300, min_samples_leaf=50, max_features="sqrt",
                                                        n_jobs=-1, random_state=SEED))])
    if algo == "lightgbm":
        from lightgbm import LGBMClassifier

        return Pipeline([("pre", tree_preprocessor(num, cat)),
                         ("clf", LGBMClassifier(n_estimators=500, learning_rate=0.03, num_leaves=31,
                                                min_child_samples=100, subsample=0.8, subsample_freq=1,
                                                colsample_bytree=0.8, random_state=SEED, verbose=-1,
                                                n_jobs=int(os.environ.get('ML_THREADS','4'))))])
    if algo == "mlp":
        return Pipeline([("pre", linear_preprocessor(num, cat)),
                         ("clf", MLPClassifier(hidden_layer_sizes=(64, 32), alpha=1e-3, batch_size=512,
                                               learning_rate_init=1e-3, early_stopping=True,
                                               validation_fraction=0.1, n_iter_no_change=8, max_iter=200,
                                               random_state=SEED))])
    raise ValueError(algo)


# ---------------------------------------------------------------------------
# 분할 / 평가
# ---------------------------------------------------------------------------
def group_cv(n_splits: int = 5) -> StratifiedGroupKFold:
    """household_key 그룹 단위 + 양성률 층화 k-fold."""
    return StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=SEED)


def top_k_metrics(y: np.ndarray, p: np.ndarray, frac: float) -> tuple[float, float]:
    """예측 위험 상위 frac 비율을 양성으로 분류했을 때 (정밀도, 재현율)."""
    k = int(np.ceil(len(p) * frac))
    idx = np.argsort(-p, kind="stable")[:k]
    tp = y[idx].sum()
    return tp / k, tp / y.sum()


def evaluate(y, p) -> dict:
    y, p = np.asarray(y), np.asarray(p)
    out = {
        "AP": average_precision_score(y, p),
        "ROC_AUC": roc_auc_score(y, p),
        "Brier": brier_score_loss(y, p),
    }
    for frac in (0.05, 0.10):
        prec, rec = top_k_metrics(y, p, frac)
        out[f"precision@top{int(frac * 100)}%"] = prec
        out[f"recall@top{int(frac * 100)}%"] = rec
    return out


def group_bootstrap_delta(y, p_new, p_base, groups, n_boot: int = 1000, seed: int = SEED) -> dict:
    """가구 단위 부트스트랩으로 (p_new - p_base)의 AP·AUC 차이 95% CI 추정(같은 시험 표본, 대응 비교)."""
    rng = np.random.default_rng(seed)
    codes, uniq = pd.factorize(pd.Series(groups))
    n_groups = len(uniq)
    d_ap, d_auc = [], []
    for _ in range(n_boot):
        counts = np.bincount(rng.integers(0, n_groups, n_groups), minlength=n_groups)
        w = counts[codes]
        m = w > 0
        yy, ww = y[m], w[m]
        d_ap.append(average_precision_score(yy, p_new[m], sample_weight=ww)
                    - average_precision_score(yy, p_base[m], sample_weight=ww))
        d_auc.append(roc_auc_score(yy, p_new[m], sample_weight=ww) - roc_auc_score(yy, p_base[m], sample_weight=ww))
    return {
        "dAP_vs_M0": average_precision_score(y, p_new) - average_precision_score(y, p_base),
        "dAP_CI_low": np.percentile(d_ap, 2.5), "dAP_CI_high": np.percentile(d_ap, 97.5),
        "dAUC_vs_M0": roc_auc_score(y, p_new) - roc_auc_score(y, p_base),
        "dAUC_CI_low": np.percentile(d_auc, 2.5), "dAUC_CI_high": np.percentile(d_auc, 97.5),
    }
