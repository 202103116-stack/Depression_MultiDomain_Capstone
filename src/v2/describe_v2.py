"""v2 분석용 데이터셋 설명서 자동 생성.

실행: python src/v2/describe_v2.py   (preprocess_v2.py 실행 후)
산출: docs/v2/dataset_description_v2.md, outputs/v2/reports/dataset_profile_v2.csv
"""
from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd

import common  # noqa: F401
from common import DOMAINS, V2_DOCS, V2_REPORT, load_v2_table
from preprocess_v2 import VARIABLE_META_V2

ROLE_LABELS = {"id": "식별자", "design": "조사설계", "outcome": "결과변수", "meta": "메타", **DOMAINS}


def _fmt(x) -> str:
    if pd.isna(x):
        return ""
    return f"{int(x):,}" if float(x).is_integer() else f"{x:,.2f}"


def summarize(name: str, kind, s: pd.Series) -> str:
    nn = s.dropna()
    if name in ("exmprs_no", "household_key", "spot_key"):
        return f"고유값 {nn.nunique():,}개"
    if nn.empty:
        return ""
    if kind == "cat" or pd.isna(kind) and (nn.nunique() <= 12 or nn.dtype == object) or (kind == "num" and nn.nunique() <= 7):
        vc = nn.value_counts().sort_index()
        if len(vc) > 12:
            return f"{len(vc)}개 범주"
        return "; ".join(f"{_fmt(k) if not isinstance(k, str) else k}: {v:,}" for k, v in vc.items())
    return f"min {_fmt(nn.min())} / 중앙값 {_fmt(nn.median())} / max {_fmt(nn.max())} (평균 {nn.mean():,.2f})"


def main():
    df = load_v2_table()
    s = df[df["Y"].notna()]
    rows = []
    for _, m in VARIABLE_META_V2.iterrows():
        col = s[m["name"]]
        rows.append({
            "변수명": m["name"], "한글설명": m["label"], "영역": ROLE_LABELS.get(m["domain"], m["domain"]),
            "모형투입": {"num": "수치형", "cat": "범주형"}.get(m["kind"], "미투입"),
            "수정가능": "" if pd.isna(m["modifiable"]) else ("예" if m["modifiable"] else "아니오"),
            "원본변수": m["source"], "파생로직": m["logic"], "값_분포": summarize(m["name"], m["kind"], col),
            "결측수": int(col.isna().sum()), "결측비율(%)": round(col.isna().mean() * 100, 2),
        })
    prof = pd.DataFrame(rows)
    V2_REPORT.mkdir(parents=True, exist_ok=True)
    prof.to_csv(V2_REPORT / "dataset_profile_v2.csv", index=False, encoding="utf-8-sig")

    feats = VARIABLE_META_V2[VARIABLE_META_V2["kind"].notna()]
    dom = (feats.groupby("domain", sort=False)
           .agg(변수수=("name", "size"), 수정가능=("modifiable", lambda x: int((x == True).sum())))
           .rename(index=DOMAINS).reset_index().rename(columns={"domain": "영역"}))
    w_prev = np.average(s["Y"], weights=s["wt_p"])

    def md(t: pd.DataFrame) -> str:
        cols = list(t.columns)
        out = ["| " + " | ".join(cols) + " |", "|" + "|".join("---" for _ in cols) + "|"]
        out += ["| " + " | ".join(str(r[c]).replace("|", "/") for c in cols) + " |" for _, r in t.iterrows()]
        return "\n".join(out)

    doc = f"""# v2 분석용 데이터셋 설명서 — 우울 증상의 다차원 요인

> `src/v2/describe_v2.py`가 자동 생성한다(생성일 {date.today().isoformat()}). 직접 수정하지 말 것.
> 변수의 검증 근거는 `docs/v2/data_dictionary_v2.md` 참고.

## 1. 요약
- 파일: `data/processed/v2/analysis_table_v2.csv` — {len(df):,}행 × {df.shape[1]}열
- 분석표본(Y 산출 가능): **{len(s):,}명**, Y=1 {int(s['Y'].sum()):,}명(비가중 {s['Y'].mean() * 100:.2f}%, 가중 {w_prev * 100:.2f}%)
- 학습/시험: {(s['split'] == 'train').sum():,} / {(s['split'] == 'test').sum():,} (1차 가구 단위 분할을 그대로 승계)
- 모형 투입 변수 {len(feats)}개, 8개 영역. **심리·증상근접** 영역은 주 분석에서 제외하고 별도 비교에만 쓴다.

{md(dom)}

## 2. 변수별 설명 (분석표본 기준)
{md(prof)}
"""
    V2_DOCS.mkdir(parents=True, exist_ok=True)
    (V2_DOCS / "dataset_description_v2.md").write_text(doc, encoding="utf-8")
    print("생성:", V2_DOCS / "dataset_description_v2.md")
    print(dom.to_string(index=False))


if __name__ == "__main__":
    main()
