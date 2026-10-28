"""원시자료 로딩 → 파생변수 생성 → 검증 assert → 분석용 테이블 저장.

실행: python src/preprocess.py
산출: data/processed/analysis_table.csv

변수 해석 근거는 docs/data_dictionary.md, 판단 근거는 docs/decision_log.md 참고.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.model_selection import GroupShuffleSplit

from utils import ANALYSIS_TABLE, COMBO_LABELS, PROCESSED_DIR, SEED, UPPERCASE_COLS, load_raw
from analysis_config import PHQ_CUTOFF, EXPECTED_OUTCOME_COUNTS, OUTCOME_LABEL

PHQ_ITEMS = [f"mtb_07{c}1" for c in "abcdefghi"]

# fma_24z2(월 소득 구간, 만원) → 구간 중간값. 8(600만원 이상)은 상한이 없어 700으로 고정(decision_log D-07)
INCOME_BAND_MID = {1: 25, 2: 75, 3: 150, 4: 250, 5: 350, 6: 450, 7: 550, 8: 700}

# ---------------------------------------------------------------------------
# 분석용 테이블 변수 메타데이터 — describe_dataset.py가 설명서를 만들 때 사용하는 단일 출처
# (name, 한글 설명, 원본 변수, 파생 로직, 역할)
# ---------------------------------------------------------------------------
VARIABLE_META = [
    ("exmprs_no", "응답자 고유 ID", "exmprs_no", "원본 그대로(231,615개 모두 고유)", "식별자"),
    ("household_key", "가구 복합키", "CTPRVN_CODE, PBHLTH_CODE, SPOT_NO, HSHLD_CODE",
     "4개 코드를 '_'로 연결. HSHLD_CODE 단독은 959개 값뿐이라 사용 불가", "식별자(분할 그룹)"),
    ("spot_key", "표본지점(집락) 복합키", "CTPRVN_CODE, PBHLTH_CODE, SPOT_NO", "3개 코드를 '_'로 연결", "조사설계"),
    ("kstrata", "층화 변수", "kstrata", "원본 그대로", "조사설계"),
    ("wt_p", "개인 가중치", "wt_p", "원본 그대로. 모집단 수준 기술통계에만 사용", "조사설계"),
    ("phq9_total", "PHQ-9 총점", "mtb_07a1~mtb_07i1", "각 문항 1~4 → 0~3점 변환 후 합산. 9문항 모두 유효할 때만 산출", "결과(보조)"),
    ("Y", OUTCOME_LABEL, "phq9_total", f"총점 ≥{PHQ_CUTOFF} → 1, 미만 → 0, 총점 결측 → 결측", "결과변수"),
    ("walk_days", "주간 걷기 일수", "phb_01z1", "0~7 유효, 77/99 → 결측", "핵심 X(구성)"),
    ("walk_min", "1일 걷기 시간(분)", "phb_02z1, phb_03z1",
     "시간(0~24)×60 + 분(0~59). 88(비해당=걷기 0일)·77·99 → 결측", "핵심 X(구성)"),
    ("walk_ok", "걷기 실천(주5일 이상 & 1일 30분 이상)", "walk_days, walk_min",
     "지침서 ph_b0200 SAS 로직: 0~4일 → 0, 5~7일이면 30분 이상 1/미만 0, 판정 불가 → 결측", "핵심 X(구성)"),
    ("strength_code", "근력운동 일수 코드", "pha_19z1", "1=전혀 안 함, 2=1일 … 6=5일 이상", "핵심 X(구성)"),
    ("strength_ok", "근력운동 실천(주 2일 이상)", "pha_19z1", "코드 3~6 → 1, 1~2 → 0", "핵심 X(구성)"),
    ("activity_combo", "활동조합 4분류(코드)", "walk_ok, strength_ok",
     "1=둘 다 미충족, 2=근력운동만, 3=걷기만, 4=둘 다 충족", "핵심 X"),
    ("activity_combo_label", "활동조합 4분류(라벨)", "activity_combo", "코드 → 한글 라벨", "핵심 X"),
    ("contact_family", "친척(가족 포함)과 연락 빈도", "enb_01z1", "1=월1회 미만 … 6=주4회 이상, 7/9 → 결측", "민감도 조절변수"),
    ("contact_neighbor", "이웃과 연락 빈도", "enb_02z1", "1~6, 7/9 → 결측", "민감도 조절변수"),
    ("contact_friend", "친구와 연락 빈도", "enb_03z1", "1~6, 7/9 → 결측", "주 조절변수"),
    ("friend_weekly", "친구와 주 1회 이상 연락", "enb_03z1", "4~6 → 1, 1~3 → 0 (연구상 구분)", "주 조절변수(이분)"),
    ("age", "만 나이", "age", "원본 그대로(19~105)", "통제"),
    ("sex", "성별", "sex", "1=남자, 2=여자", "통제"),
    ("educ", "최종 학력 5분류", "sob_01z1, sob_02z1",
     "지침서 educ SAS 로직(졸업 여부로 이수 단계 보정): 1=무학 … 5=대학교 이상, 77/99 → 결측", "통제"),
    ("econ_active", "경제활동 여부", "soa_01z1", "1=예 → 1, 2=아니오 → 0, 7 → 결측", "통제"),
    ("marital", "혼인 상태", "sod_02z3",
     "1=배우자와 동거, 2=배우자 있으나 별거, 3=사별, 4=이혼, 5=미혼, 7 → 결측", "통제"),
    ("hh_type", "세대 유형", "fma_19z3", "1=1인가구 … 7=3세대 가구(7분류)", "통제"),
    ("hh_size", "가구원 수", "mbhld_co", "원본 그대로", "통제(소득 균등화용)"),
    ("income_annual", "가구 연소득(만원)", "fma_12z1, fma_13z1, fma_14z1, fma_24z2",
     "1순위: 연 기준이면 fma_13z1, 월 기준이면 fma_14z1×12. 2순위: fma_24z2 구간 중간값×12", "통제"),
    ("income_source", "소득 산출 경로", "fma_12z1, fma_24z2", "1=연소득, 2=월소득×12, 3=구간 중간값×12, 결측=산출 불가", "메타"),
    ("income_equiv", "균등화 가구 연소득(만원)", "income_annual, hh_size", "income_annual / √hh_size", "통제"),
    ("log_income_equiv", "log(1+균등화 가구 연소득)", "income_equiv", "log1p 변환 — 모형 투입용", "통제"),
    ("height_cm", "키(cm)", "oba_02z1", "50~210 범위만 유효(지침서 ob_a0100 로직), 77777/99999 → 결측", "통제(구성)"),
    ("weight_kg", "몸무게(kg)", "oba_03z1", "20~180 범위만 유효, 77777/99999 → 결측", "통제(구성)"),
    ("bmi", "체질량지수(kg/m²)", "height_cm, weight_kg", "몸무게/키(m)². 10 ≤ BMI < 50만 유효(지침서 ob_a0101)", "통제"),
    ("htn", "고혈압 의사진단 경험", "hya_04z1", "1=예 → 1, 2=아니오 → 0, 7/9 → 결측", "통제"),
    ("dm", "당뇨병 의사진단 경험", "dia_04z1", "1 → 1, 2 → 0, 7/9 → 결측", "통제"),
    ("osteo", "골다공증 의사진단 여부", "osa_04z1", "1 → 1, 2 → 0, 7/9 → 결측", "통제"),
    ("in_analysis", "주 분석표본 포함 여부", "Y, activity_combo", "Y와 활동조합이 모두 산출된 경우 1(231,271명)", "메타"),
    ("split", "학습/시험 구분", "household_key", "분석표본을 가구 단위 GroupShuffleSplit(20%, seed=42)로 분할", "메타"),
]
OUTPUT_COLS = [m[0] for m in VARIABLE_META]


def _valid(s: pd.Series, codes) -> pd.Series:
    """지정한 유효 코드 외에는 결측 처리."""
    return s.where(s.isin(codes))


def _binary_yes_no(s: pd.Series) -> pd.Series:
    return s.map({1: 1.0, 2: 0.0})


def build_identifiers(raw: pd.DataFrame) -> pd.DataFrame:
    keys = raw[["CTPRVN_CODE", "PBHLTH_CODE", "SPOT_NO", "HSHLD_CODE"]].astype(str)
    out = pd.DataFrame(index=raw.index)
    out["exmprs_no"] = raw["exmprs_no"]
    out["spot_key"] = keys["CTPRVN_CODE"] + "_" + keys["PBHLTH_CODE"] + "_" + keys["SPOT_NO"]
    out["household_key"] = out["spot_key"] + "_" + keys["HSHLD_CODE"]
    out["kstrata"] = raw["kstrata"]
    out["wt_p"] = raw["wt_p"]
    return out


def build_outcome(raw: pd.DataFrame) -> pd.DataFrame:
    scores = raw[PHQ_ITEMS].where(raw[PHQ_ITEMS].isin([1, 2, 3, 4])) - 1
    total = scores.sum(axis=1, min_count=len(PHQ_ITEMS))  # 하나라도 결측이면 NaN
    y = (total >= PHQ_CUTOFF).astype(float).where(total.notna())
    return pd.DataFrame({"phq9_total": total, "Y": y})


def build_activity(raw: pd.DataFrame) -> pd.DataFrame:
    days = _valid(raw["phb_01z1"], range(0, 8))
    h, m = raw["phb_02z1"], raw["phb_03z1"]
    minutes = (h * 60 + m).where(h.between(0, 24) & m.between(0, 59))

    # 지침서 ph_b0200 로직: 0~4일이면 시간과 무관하게 미충족, 5~7일이면 시간으로 판정
    walk_ok = pd.Series(np.nan, index=raw.index)
    walk_ok[days.between(0, 4)] = 0
    five_plus = days.between(5, 7)
    walk_ok[five_plus & (minutes < 30)] = 0
    walk_ok[five_plus & (minutes >= 30)] = 1

    strength_code = _valid(raw["pha_19z1"], range(1, 7))
    strength_ok = strength_code.isin([3, 4, 5, 6]).astype(float).where(strength_code.notna())

    combo = pd.Series(np.nan, index=raw.index)
    combo[(walk_ok == 0) & (strength_ok == 0)] = 1
    combo[(walk_ok == 0) & (strength_ok == 1)] = 2
    combo[(walk_ok == 1) & (strength_ok == 0)] = 3
    combo[(walk_ok == 1) & (strength_ok == 1)] = 4

    out = pd.DataFrame({
        "walk_days": days, "walk_min": minutes, "walk_ok": walk_ok,
        "strength_code": strength_code, "strength_ok": strength_ok,
        "activity_combo": combo,
    })
    out["activity_combo_label"] = combo.map(COMBO_LABELS)
    return out


def build_contact(raw: pd.DataFrame) -> pd.DataFrame:
    out = pd.DataFrame({
        "contact_family": _valid(raw["enb_01z1"], range(1, 7)),
        "contact_neighbor": _valid(raw["enb_02z1"], range(1, 7)),
        "contact_friend": _valid(raw["enb_03z1"], range(1, 7)),
    })
    out["friend_weekly"] = (out["contact_friend"] >= 4).astype(float).where(out["contact_friend"].notna())
    return out


def build_education(raw: pd.DataFrame) -> pd.Series:
    """지침서의 educ 파생 SAS 코드를 그대로 옮김."""
    s1, s2 = raw["sob_01z1"], raw["sob_02z1"]
    grad, not_grad = s2 == 1, s2.isin([2, 3, 4])
    educ = pd.Series(np.nan, index=raw.index)
    educ[s1.isin([1, 2])] = 1
    for level, completed in [(3, 2), (4, 3), (5, 4)]:  # 초/중/고: 졸업이면 해당 단계, 미졸업이면 한 단계 아래
        educ[(s1 == level) & grad] = completed
        educ[(s1 == level) & not_grad] = completed - 1
    educ[s1.isin([6, 7]) & grad] = 5
    educ[s1.isin([6, 7]) & not_grad] = 4
    educ[(s1 == 8) & s2.isin([1, 2, 3, 4])] = 5
    return educ


def build_income(raw: pd.DataFrame) -> pd.DataFrame:
    basis = raw["fma_12z1"]
    annual = pd.Series(np.nan, index=raw.index)
    source = pd.Series(np.nan, index=raw.index)

    is_year, is_month = basis == 1, basis == 2
    annual[is_year] = raw.loc[is_year, "fma_13z1"]
    annual[is_month] = raw.loc[is_month, "fma_14z1"] * 12
    source[is_year], source[is_month] = 1, 2

    band = raw["fma_24z2"].map(INCOME_BAND_MID)
    use_band = annual.isna() & band.notna()
    annual[use_band] = band[use_band] * 12
    source[use_band] = 3

    hh_size = raw["mbhld_co"]
    equiv = annual / np.sqrt(hh_size)
    return pd.DataFrame({
        "hh_size": hh_size, "income_annual": annual, "income_source": source,
        "income_equiv": equiv, "log_income_equiv": np.log1p(equiv),
    })


def build_body(raw: pd.DataFrame) -> pd.DataFrame:
    height = raw["oba_02z1"].where(raw["oba_02z1"].between(50, 210))
    weight = raw["oba_03z1"].where(raw["oba_03z1"].between(20, 180))
    bmi = weight / (height / 100) ** 2
    bmi = bmi.where((bmi >= 10) & (bmi < 50))
    return pd.DataFrame({"height_cm": height, "weight_kg": weight, "bmi": bmi})


def build_controls(raw: pd.DataFrame) -> pd.DataFrame:
    out = pd.DataFrame({
        "age": raw["age"],
        "sex": raw["sex"],
        "educ": build_education(raw),
        "econ_active": _binary_yes_no(raw["soa_01z1"]),
        "marital": _valid(raw["sod_02z3"], range(1, 6)),
        "hh_type": _valid(raw["fma_19z3"], range(1, 8)),
        "htn": _binary_yes_no(raw["hya_04z1"]),
        "dm": _binary_yes_no(raw["dia_04z1"]),
        "osteo": _binary_yes_no(raw["osa_04z1"]),
    })
    return pd.concat([out, build_income(raw), build_body(raw)], axis=1)


def assign_split(df: pd.DataFrame) -> pd.Series:
    """분석표본을 가구 단위로 80/20 분할(동일 가구원이 train/test에 섞이지 않도록)."""
    split = pd.Series(pd.NA, index=df.index, dtype="object")
    sample = df.index[df["in_analysis"] == 1]
    gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=SEED)
    tr, te = next(gss.split(sample, groups=df.loc[sample, "household_key"]))
    split[sample[tr]] = "train"
    split[sample[te]] = "test"
    return split


def validate_raw(raw: pd.DataFrame) -> None:
    """섹션 1·5.1: 원시자료 구조와 소득 분기 로직 검증."""
    assert raw.shape == (231615, 201), f"원시자료 크기 불일치: {raw.shape}"
    upper = [c for c in raw.columns if c != c.lower()]
    assert upper == UPPERCASE_COLS, f"대문자 컬럼 목록 불일치: {upper}"
    assert raw["exmprs_no"].nunique() == 231615, "응답자 ID 고유성 불일치"

    # 소득 분기: fma_24z2는 fma_12z1 거부(7)·모름(9) 응답자에게만 질문됨
    assert (raw["fma_12z1"] == 7).sum() == 1608, "fma_12z1 거부 카운트 불일치"
    assert (raw["fma_12z1"] == 9).sum() == 2191, "fma_12z1 모름 카운트 불일치"
    fma12_missing = raw["fma_12z1"].isin([7, 9])
    fma24z2_asked = raw["fma_24z2"] != 88
    assert fma12_missing.sum() == 3799 and fma24z2_asked.sum() == 3799, "소득 분기 로직 불일치"
    assert (fma12_missing == fma24z2_asked).all(), "fma_24z2 질문 대상이 fma_12z1 거부·모름과 개인 단위로 불일치"

    # 걷기 시간 88(비해당)은 정확히 걷기 0일 응답자
    assert ((raw["phb_02z1"] == 88) == (raw["phb_01z1"] == 0)).all(), "걷기 시간 비해당 분기 불일치"


def validate_derived(df: pd.DataFrame) -> None:
    """섹션 3·4·7: 파생변수 검증 수치."""
    pos, neg = EXPECTED_OUTCOME_COUNTS
    assert (df["Y"] == 1).sum() == pos, "PHQ-9 양성 카운트 불일치"
    assert (df["Y"] == 0).sum() == neg, "PHQ-9 음성 카운트 불일치"
    valid = df['phq9_total'].notna()
    assert df.loc[valid, 'Y'].eq(df.loc[valid, 'phq9_total'].ge(PHQ_CUTOFF)).all()
    assert df["Y"].isna().sum() == 325, "PHQ-9 결측 카운트 불일치"
    assert df["household_key"].nunique() == 136845, "가구 복합키 고유성 불일치"

    # 활동조합: 지침서 ph_b0200 로직 적용 시 연구설계 docx 사전확인값과 N·Y=1 모두 정확히 일치
    sample = df[df["in_analysis"] == 1]
    assert len(sample) == 231271, f"분석표본 크기 불일치: {len(sample)}"
    expected = {1: (96409, 5210), 2: (21534, 494), 3: (80468, 2376), 4: (32860, 624)}
    for code, (n, n_pos) in expected.items():
        grp = sample[sample["activity_combo"] == code]
        assert len(grp) == n, f"활동조합 {COMBO_LABELS[code]} N 불일치: {len(grp)} != {n}"
        if PHQ_CUTOFF == 10:
            assert (grp["Y"] == 1).sum() == n_pos, f"활동조합 {COMBO_LABELS[code]} Y=1 불일치"

    # Y 유효 & 활동조합 결측 19명 = 걷기 판정 불가(일수 77/99 또는 5일 이상인데 시간 77/99)
    assert (df["Y"].notna() & df["activity_combo"].isna()).sum() == 19

    # 소득 산출 경로별 인원
    src = df["income_source"].value_counts()
    assert src[1] == 35003 and src[2] == 192813 and src[3] == 3355, f"소득 경로 불일치: {src.to_dict()}"
    assert df["income_annual"].isna().sum() == 444, "소득 최종 결측 불일치(fma_24z2 77/99 = 279+165)"

    # 분할: 같은 가구가 train/test 양쪽에 존재하지 않음
    tr = set(df.loc[df["split"] == "train", "household_key"])
    te = set(df.loc[df["split"] == "test", "household_key"])
    assert not (tr & te), "가구 단위 분할 누수"


def build_analysis_table(raw: pd.DataFrame) -> pd.DataFrame:
    df = pd.concat([
        build_identifiers(raw), build_outcome(raw), build_activity(raw),
        build_contact(raw), build_controls(raw),
    ], axis=1)
    df["in_analysis"] = (df["Y"].notna() & df["activity_combo"].notna()).astype(int)
    df["split"] = assign_split(df)
    return df[OUTPUT_COLS]


def main() -> None:
    raw = load_raw()
    print(f"원시자료 로딩: {raw.shape[0]:,}행 × {raw.shape[1]}열")
    print("대문자 컬럼:", [c for c in raw.columns if c != c.lower()])
    validate_raw(raw)
    print("원시자료 검증 통과")

    df = build_analysis_table(raw)
    validate_derived(df)
    print("파생변수 검증 통과")

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    df.to_csv(ANALYSIS_TABLE, index=False, encoding="utf-8-sig")
    sample = df[df["in_analysis"] == 1]
    print(f"저장: {ANALYSIS_TABLE} ({df.shape[0]:,}행 × {df.shape[1]}열)")
    print(f"분석표본 {len(sample):,}명 / train {(df['split'] == 'train').sum():,} / test {(df['split'] == 'test').sum():,}")
    print(sample.groupby(["activity_combo", "activity_combo_label"])["Y"].agg(["size", "sum", "mean"]))


if __name__ == "__main__":
    main()
