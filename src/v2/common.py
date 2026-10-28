"""v2 공통 설정 — 경로, 영역 정의, 1차 모듈 import 경로."""
from __future__ import annotations

import sys
from pathlib import Path

SRC = Path(__file__).resolve().parents[1]
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from utils import PROCESSED_DIR, ROOT  # noqa: E402
from analysis_config import ANALYSIS_ID  # noqa: E402

V2_PROCESSED = PROCESSED_DIR / "v2"
V2_TABLE = V2_PROCESSED / "analysis_table_v2.csv"
V2_RUNS = V2_PROCESSED / "model_runs"
V2_DOCS = ROOT / "docs" / ANALYSIS_ID / "v2"
V2_FIG = ROOT / "outputs" / ANALYSIS_ID / "v2" / "figures"
V2_REPORT = ROOT / "outputs" / ANALYSIS_ID / "v2" / "reports"

# 영역 코드 → (한글명, 수정 가능 여부 요약). 표시 순서도 이 순서를 따른다.
DOMAINS = {
    "demo": "인구",
    "econ": "경제",
    "phys": "신체건강",
    "behav": "건강행태",
    "social": "사회관계",
    "env": "생활환경",
    "care": "의료접근·건강정보",
    "proximal": "심리·증상근접",
}
MAIN_DOMAINS = [d for d in DOMAINS if d != "proximal"]  # 주 분석(증상근접 제외)
ADDABLE_DOMAINS = [d for d in MAIN_DOMAINS if d != "demo"]  # 인구 블록에 하나씩 더해 보는 영역


def load_v2_table():
    import pandas as pd

    return pd.read_csv(V2_TABLE, dtype={"exmprs_no": str, "household_key": str, "spot_key": str})
