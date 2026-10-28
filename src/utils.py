"""공통 경로·상수·로딩 유틸리티."""
from __future__ import annotations

from pathlib import Path
import os
import ast

import pandas as pd
from analysis_config import ANALYSIS_ID

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault('MPLCONFIGDIR', str(ROOT / 'data' / 'mplconfig'))
RAW_PATH = Path(os.environ.get('CHS_RAW_PATH', str(ROOT / 'data' / 'raw' / 'chs25_all.sas7bdat')))
PROCESSED_DIR = ROOT / "data" / "processed" / ANALYSIS_ID
ANALYSIS_TABLE = PROCESSED_DIR / "analysis_table.csv"
DOCS_DIR = ROOT / "docs"
FIG_DIR = ROOT / "outputs" / ANALYSIS_ID / "figures"
REPORT_DIR = ROOT / "outputs" / ANALYSIS_ID / "reports"

SEED = 42

# 대문자로 저장된 컬럼(로딩 후 확인 결과 8개 — SETUP_PROMPT의 7개 + EXAMIN_YEAR)
UPPERCASE_COLS = [
    "EXAMIN_YEAR", "CTPRVN_CODE", "PBHLTH_CODE", "SPOT_NO",
    "HSHLD_CODE", "MBHLD_CODE", "DONG_TY_CODE", "HOUSE_TY_CODE",
]

# 활동조합 4분류 코드 → 라벨 (코드 순서 = 그래프 표시 순서)
COMBO_LABELS = {
    1: "둘 다 미충족",
    2: "근력운동만",
    3: "걷기만",
    4: "둘 다 충족",
}
CONTACT_LABELS = {
    1: "월 1회 미만",
    2: "월 1회",
    3: "월 2~3회",
    4: "주 1회",
    5: "주 2~3회",
    6: "주 4회 이상",
}

# 차트 팔레트 (dataviz 기본 팔레트 light 모드, 고정 순서)
PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"]
INK = "#0b0b0b"
INK_MUTED = "#52514e"
GRID = "#e4e3df"


def load_raw() -> pd.DataFrame:
    """Read local SAS, or a verified 201-column CSV export without changing raw values."""
    if RAW_PATH.suffix.lower() == '.csv':
        raw = pd.read_csv(RAW_PATH, encoding='utf-8-sig')
        if raw.shape[1] != 201:
            raise ValueError('Use the original 201-column CSV, not an augmented target export.')
        # This CSV exported SAS character cells as Python byte literals (b'...').
        # Decode only those literals, retain character IDs/leading zeroes, and
        # cast SAS numeric columns to float. Never convert IDs to numbers.
        for col in raw:
            if pd.api.types.is_numeric_dtype(raw[col]):
                raw[col] = raw[col].astype(float)
            else:
                def decode(v):
                    if isinstance(v, str) and v.startswith(('b\"', "b'")):
                        value = ast.literal_eval(v)
                        if not isinstance(value, bytes):
                            raise ValueError(f'Unexpected character encoding in {col}')
                        return value.decode('cp949')
                    return v
                raw[col] = raw[col].map(decode)
        return raw
    return pd.read_sas(RAW_PATH, format="sas7bdat", encoding="cp949")


def load_analysis_table() -> pd.DataFrame:
    return pd.read_csv(ANALYSIS_TABLE, dtype={"exmprs_no": str, "household_key": str, "spot_key": str})


def setup_matplotlib():
    """한글 폰트와 공통 스타일 설정."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    plt.rcParams.update({
        "font.family": "Malgun Gothic",
        "axes.unicode_minus": False,
        "figure.dpi": 110,
        "savefig.dpi": 150,
        "savefig.bbox": "tight",
        "axes.edgecolor": INK_MUTED,
        "axes.labelcolor": INK,
        "axes.titleweight": "bold",
        "axes.titlesize": 11,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.grid": True,
        "axes.axisbelow": True,
        "grid.color": GRID,
        "grid.linewidth": 0.8,
        "xtick.color": INK_MUTED,
        "ytick.color": INK_MUTED,
        "legend.frameon": False,
    })
    return plt
