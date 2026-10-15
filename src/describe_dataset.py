"""분석용 데이터셋 설명서 자동 생성.

실행: python src/describe_dataset.py   (preprocess.py 실행 후)
산출: docs/dataset_description.md, outputs/reports/dataset_profile.csv

컬럼 설명은 preprocess.VARIABLE_META(단일 출처)에서, 통계치는 저장된 analysis_table.csv에서 계산한다.
손으로 수정하지 말고 전처리를 바꾼 뒤 이 스크립트를 다시 실행할 것.
"""
from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd

from preprocess import VARIABLE_META
from utils import ANALYSIS_TABLE, COMBO_LABELS, DOCS_DIR, REPORT_DIR, load_analysis_table

# 범주형으로 요약할 변수(값별 빈도를 표시)
CATEGORICAL = {
    "Y", "walk_ok", "strength_code", "strength_ok", "activity_combo", "activity_combo_label",
    "contact_family", "contact_neighbor", "contact_friend", "friend_weekly", "sex", "educ",
    "econ_active", "marital", "hh_type", "income_source", "htn", "dm", "osteo", "in_analysis", "split",
    "walk_days",
}
IDENTIFIERS = {"exmprs_no", "household_key", "spot_key"}


def _fmt_num(x) -> str:
    if pd.isna(x):
        return ""
    if float(x).is_integer():
        return f"{int(x):,}"
    return f"{x:,.2f}"


def _range_or_levels(name: str, s: pd.Series) -> str:
    nn = s.dropna()
    if name in IDENTIFIERS:
        return f"고유값 {nn.nunique():,}개"
    if name in CATEGORICAL:
        vc = nn.value_counts().sort_index()
        if len(vc) > 10:
            return f"{len(vc)}개 범주"
        return "; ".join(f"{_fmt_num(k) if not isinstance(k, str) else k}: {v:,}" for k, v in vc.items())
    if nn.empty:
        return ""
    return (f"min {_fmt_num(nn.min())} / 중앙값 {_fmt_num(nn.median())} / "
            f"max {_fmt_num(nn.max())} (평균 {nn.mean():,.2f})")


def build_profile(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    rng = np.random.default_rng(0)
    for name, desc, source, logic, role in VARIABLE_META:
        s = df[name]
        nn = s.dropna()
        uniq = nn.unique()
        examples = rng.choice(uniq, size=min(4, len(uniq)), replace=False) if len(uniq) else []
        if name in IDENTIFIERS:
            examples = []  # 식별자는 예시값을 노출하지 않음(노션 등 공유 문서 재사용 대비)
        rows.append({
            "변수명": name,
            "데이터타입": str(s.dtype),
            "한글설명": desc,
            "역할": role,
            "원본변수": source,
            "파생로직": logic,
            "유효범위_범주": _range_or_levels(name, s),
            "결측수": int(s.isna().sum()),
            "결측비율(%)": round(s.isna().mean() * 100, 2),
            "예시값": ", ".join(_fmt_num(v) if not isinstance(v, str) else v for v in examples),
        })
    return pd.DataFrame(rows)


def _md_table(df: pd.DataFrame) -> str:
    cols = list(df.columns)
    lines = ["| " + " | ".join(cols) + " |", "|" + "|".join("---" for _ in cols) + "|"]
    for _, r in df.iterrows():
        lines.append("| " + " | ".join(str(r[c]).replace("|", "/") for c in cols) + " |")
    return "\n".join(lines)


def build_summary(df: pd.DataFrame) -> str:
    sample = df[df["in_analysis"] == 1]
    y_valid = df[df["Y"].notna()]
    w_prev = np.average(y_valid["Y"], weights=y_valid["wt_p"])

    combo = (sample.groupby("activity_combo")
             .agg(N=("Y", "size"), Y1=("Y", "sum"), 비가중양성률=("Y", "mean"))
             .reset_index())
    w = sample.groupby("activity_combo").apply(lambda g: np.average(g["Y"], weights=g["wt_p"]), include_groups=False)
    combo["가중양성률"] = combo["activity_combo"].map(w)
    combo.insert(1, "활동조합", combo["activity_combo"].map(COMBO_LABELS))
    combo["N"] = combo["N"].map("{:,}".format)
    combo["Y1"] = combo["Y1"].astype(int).map("{:,}".format)
    combo["비가중양성률"] = (combo["비가중양성률"] * 100).map("{:.2f}%".format)
    combo["가중양성률"] = (combo["가중양성률"] * 100).map("{:.2f}%".format)
    combo["activity_combo"] = combo["activity_combo"].astype(int)
    combo = combo.rename(columns={"activity_combo": "코드", "Y1": "Y=1"})

    split = sample.groupby("split").agg(N=("Y", "size"), 가구수=("household_key", "nunique"), 양성률=("Y", "mean"))
    split = split.loc[["train", "test"]].reset_index()
    split["N"] = split["N"].map("{:,}".format)
    split["가구수"] = split["가구수"].map("{:,}".format)
    split["양성률"] = (split["양성률"] * 100).map("{:.2f}%".format)

    return f"""## 1. 데이터셋 요약

- 파일: `data/processed/analysis_table.csv` (UTF-8 with BOM)
- 전체: **{len(df):,}행 × {df.shape[1]}열** (원시자료 전체 응답자 1행 = 1명, 파생변수만 보관)
- 주 분석표본(`in_analysis == 1`, Y와 활동조합이 모두 산출됨): **{len(sample):,}명**
- 원천: 2025 지역사회건강조사 원시자료 `chs25_all.sas7bdat` (231,615명 × 201열, 만 19세 이상)

### Y 정의
PHQ-9 9문항(`mtb_07a1`~`mtb_07i1`)을 0~3점으로 변환해 합산(0~27점), **10점 이상 → Y=1**. 9문항 모두 유효할 때만 산출.

| 구분 | 인원 |
|---|---|
| Y=1 | {(df["Y"] == 1).sum():,} |
| Y=0 | {(df["Y"] == 0).sum():,} |
| 산출 불가(결측) | {df["Y"].isna().sum():,} |
| 양성률(비가중) | {y_valid["Y"].mean() * 100:.2f}% |
| 양성률(개인가중치 `wt_p`) | {w_prev * 100:.2f}% |

### 활동조합 4분류 요약 (주 분석표본)
걷기 실천 = 주 5일 이상 & 1일 30분 이상, 근력운동 실천 = 주 2일 이상(`pha_19z1` 3~6).

{_md_table(combo)}

### 학습/시험 분할 (가구 단위 그룹 분할, `household_key`, 80/20, seed=42)

{_md_table(split)}

같은 가구 구성원은 train/test 중 한쪽에만 속한다(전처리 assert로 검증).
"""


def main() -> None:
    df = load_analysis_table()
    profile = build_profile(df)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    profile.to_csv(REPORT_DIR / "dataset_profile.csv", index=False, encoding="utf-8-sig")

    md_cols = ["변수명", "데이터타입", "한글설명", "원본변수", "파생로직", "유효범위_범주", "결측수", "결측비율(%)", "예시값"]
    doc = f"""# 분석용 데이터셋 설명서

> 이 문서는 `src/describe_dataset.py`가 자동 생성한다(생성일 {date.today().isoformat()}). 직접 수정하지 말 것.
> 원시자료 개인 단위 값은 포함하지 않으며, 예시값은 각 변수의 고유값 중 무작위 일부다.

{build_summary(df)}
## 2. 컬럼별 설명

역할: 결과변수 / 핵심 X / 주·민감도 조절변수 / 통제 / 조사설계 / 식별자 / 메타.
기계 판독용 동일 정보: `outputs/reports/dataset_profile.csv`

{_md_table(profile[["변수명", "역할"] + md_cols[1:]])}

## 3. 결측 처리 원칙 요약

- 문항별 특수코드(7·77·77777=응답거부, 9·99·99999=모름, 8·88·88888=비해당)는 **변수별 코드표에 맞춰** 결측 처리했다. 7·8·9를 일괄 결측 처리하지 않는다(걷기 일수 7일 등 유효값 보호).
- 걷기 시간의 비해당(88)은 걷기 0일 응답자에게만 발생하며, 이들은 걷기 실천 0으로 분류된다(결측 아님).
- 통제변수 결측은 이 테이블에서 대치하지 않는다. 모델링 시 학습 데이터에서만 대치값을 적합한다(`src/modeling.py`).
"""
    (DOCS_DIR / "dataset_description.md").write_text(doc, encoding="utf-8")
    print("생성:", DOCS_DIR / "dataset_description.md", REPORT_DIR / "dataset_profile.csv")


if __name__ == "__main__":
    main()
