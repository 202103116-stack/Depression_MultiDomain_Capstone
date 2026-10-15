"""v2 전처리 — 우울 증상(PHQ-9 ≥ 10)의 다차원 요인 분석용 테이블.

실행: python src/v2/preprocess_v2.py
산출: data/processed/v2/analysis_table_v2.csv

- 1차(src/preprocess.py)의 검증된 함수(Y, 걷기·근력, 연락, 교육, 소득, BMI, 식별자)를 그대로 재사용한다.
- 새 변수는 지침서 코드표·분기와 원시자료를 대조해 확인했다(docs/v2/data_dictionary_v2.md).
- 공식 지표 정의가 있는 변수(현재흡연 sm_a0100, 고위험음주 dr_a0500, 중강도 이상 신체활동 ph_a0500)는
  지침서 SAS 코드를 그대로 옮겼다.
- VARIABLE_META_V2가 변수 설명·영역·수정 가능 여부·모형 투입 형태의 단일 출처다.
"""
from __future__ import annotations

import zlib

import numpy as np
import pandas as pd

import common  # noqa: F401  (src 경로 등록)
from common import V2_PROCESSED, V2_TABLE
from preprocess import (_binary_yes_no, _valid, build_activity, build_contact, build_controls, build_identifiers,
                        build_outcome, validate_raw)
from utils import ANALYSIS_TABLE, COMBO_LABELS, load_raw

# ---------------------------------------------------------------------------
# 변수 메타데이터
# (name, 한글 설명, 영역, 투입 형태 num/cat/None(모형 미투입), 수정가능, 원본, 파생 로직)
# 영역: demo econ phys behav social env care proximal / 그 외: id design outcome meta
# ---------------------------------------------------------------------------
M = []


def meta(name, label, domain, kind, modifiable, source, logic):
    M.append(dict(name=name, label=label, domain=domain, kind=kind, modifiable=modifiable, source=source, logic=logic))


# 식별·설계·결과
meta("exmprs_no", "응답자 ID", "id", None, None, "exmprs_no", "원본")
meta("household_key", "가구 복합키", "id", None, None, "CTPRVN_CODE·PBHLTH_CODE·SPOT_NO·HSHLD_CODE", "1차와 동일")
meta("spot_key", "표본지점(집락) 키", "design", None, None, "CTPRVN_CODE·PBHLTH_CODE·SPOT_NO", "1차와 동일")
meta("kstrata", "층화 변수", "design", None, None, "kstrata", "원본")
meta("wt_p", "개인 가중치", "design", None, None, "wt_p", "원본")
meta("phq9_total", "PHQ-9 총점", "outcome", None, None, "mtb_07a1~i1", "1차와 동일")
meta("Y", "우울 증상 기준 충족(PHQ-9 ≥ 10)", "outcome", None, None, "phq9_total", "1차와 동일")
# 인구
meta("age", "만 나이", "demo", "num", False, "age", "원본")
meta("sex", "성별", "demo", "cat", False, "sex", "1=남, 2=여")
meta("educ", "교육수준 5분류", "demo", "cat", False, "sob_01z1, sob_02z1", "지침서 educ SAS 로직(1차와 동일)")
meta("marital", "혼인상태", "demo", "cat", False, "sod_02z3", "1=배우자 동거 … 5=미혼")
meta("hh_type", "세대유형", "demo", "cat", False, "fma_19z3", "7분류")
# 경제
meta("log_income_equiv", "log(1+균등화 가구 연소득)", "econ", "num", True, "fma_12/13/14z1, fma_24z2, mbhld_co",
     "1차 2단계 소득 산출 ÷ √가구원수, log1p")
meta("livelihood", "기초생활수급", "econ", "cat", True, "fma_04z1", "1=현재 수급, 2=과거 수급, 3=아님")
meta("food_insecurity", "가구 식품안정성", "econ", "num", True, "nue_01z1",
     "1=양·종류 충분, 2=양 충분·종류 부족, 3=가끔 부족, 4=자주 부족(클수록 불안정)")
meta("occupation", "직업분류", "econ", "cat", True, "soa_06z2", "1~10 직업군, 0=비경제활동(원래 비해당 88)")
meta("emp_status", "종사상 지위", "econ", "cat", True, "soa_07z1", "1=고용주·자영업, 2=임금근로, 3=무급가족, 0=비경제활동(88)")
# 신체건강
meta("bmi", "체질량지수", "phys", "num", True, "oba_02z1, oba_03z1", "1차와 동일(지침서 범위 규칙)")
meta("body_image", "본인 인지 체형", "phys", "cat", True, "oba_01z1", "1=매우 마름 … 5=매우 비만")
meta("htn", "고혈압 진단 경험", "phys", "cat", False, "hya_04z1", "1=예, 0=아니오")
meta("dm", "당뇨병 진단 경험", "phys", "cat", False, "dia_04z1", "1=예, 0=아니오")
meta("osteo", "골다공증 진단", "phys", "cat", False, "osa_04z1", "1=예, 0=아니오")
meta("oral_health", "주관적 구강건강", "phys", "num", True, "ora_01z1", "1=매우 좋음 … 5=매우 나쁨")
meta("chewing", "저작불편", "phys", "num", True, "orb_01z1", "1=매우 불편 … 5=전혀 불편하지 않음")
meta("fall", "연간 낙상 경험", "phys", "cat", True, "irb_01z1", "1=예, 0=아니오")
meta("injury", "연간 사고·중독 경험", "phys", "cat", True, "ira_01z1", "1=예, 0=아니오")
# 건강행태 — 신체활동
meta("walk_days", "주간 걷기 일수", "behav", "num", True, "phb_01z1", "0~7(1차와 동일)")
meta("strength_code", "근력운동 일수 코드", "behav", "num", True, "pha_19z1", "1=안 함, 2=1일 … 6=5일 이상")
meta("vig_days", "고강도 신체활동 일수", "behav", "num", True, "pha_04z1", "0~7")
meta("mod_days", "중강도 신체활동 일수", "behav", "num", True, "pha_07z1", "0~7")
meta("log_met_min", "log(1+주간 신체활동량 MET-분)", "behav", "num", True, "pha_04~09z1, phb_01~03z1",
     "8×고강도 + 4×중강도 + 3.3×걷기(일수×1일 분, 1일 최대 180분, IPAQ 규칙), log1p")
meta("walk_ok", "걷기 실천(주5일·30분)", "behav", None, True, "phb_01~03z1", "1차와 동일(지침서 ph_b0200)")
meta("strength_ok", "근력운동 실천(주 2일 이상)", "behav", None, True, "pha_19z1", "코드 3~6")
meta("aerobic_ok", "중강도 이상 신체활동 실천", "behav", None, True, "pha_04~09z1",
     "지침서 ph_a0500: 고강도 20분×주3일 또는 중강도 30분×주5일")
meta("pa_guideline", "신체활동 권고 충족(유산소+근력)", "behav", None, True, "walk_ok, aerobic_ok, strength_ok",
     "(걷기 실천 또는 중강도 이상 실천) 그리고 근력운동 주 2일 이상")
meta("activity_combo", "활동조합 4분류(1차)", "behav", None, True, "walk_ok, strength_ok", "1차와 동일 — 비교용")
# 건강행태 — 흡연·음주·식생활
meta("smoking_status", "흡연 상태", "behav", "cat", True, "smf_01z1, sma_01z1, sma_03z2",
     "0=비흡연(평생 5갑 미만 포함), 1=과거흡연, 2=현재흡연(지침서 sm_a0100)")
meta("ecig_current", "전자담배 현재 사용", "behav", "cat", True, "sma_36/37z1, sma_08z1, sma_11z2",
     "궐련형 현재 사용(sm_a2700) 또는 액상형 최근 1달 사용(sm_a1000) = 1")
meta("drinking_freq", "음주 빈도", "behav", "num", True, "dra_01z1, drb_01z3",
     "0=최근 1년 안 마심(평생 비음주 포함), 1=월1회 미만 … 5=주4회 이상")
meta("binge_freq", "폭음 빈도", "behav", "num", True, "drb_04z1(남), drb_05z1(여)",
     "0=최근 1년 음주 안 함, 1=폭음 전혀 없음 … 5=거의 매일 (남 7잔·여 5잔 기준)")
meta("high_risk_drinking", "고위험음주", "behav", None, True, "dra_01z1, drb_01z3, drb_03z1",
     "지침서 dr_a0500: 주 2회 이상 & 1회 남 7잔·여 5잔 이상")
meta("breakfast", "아침식사 빈도", "behav", "num", True, "nua_01z2", "1=주5~7회 … 4=거의 안 함")
meta("weight_control", "체중조절 노력", "behav", "cat", True, "obb_01z1", "1=감량, 2=유지, 3=증량, 4=노력 안 함")
meta("brushing_lunch", "점심 후 칫솔질", "behav", "cat", True, "ord_01d2", "1=예, 2=아니오, 3=점심 안 먹음")
# 사회관계
meta("contact_family", "친척과 연락 빈도", "social", "cat", True, "enb_01z1", "1=월1회 미만 … 6=주4회 이상(1차와 동일)")
meta("contact_neighbor", "이웃과 연락 빈도", "social", "cat", True, "enb_02z1", "1~6")
meta("contact_friend", "친구와 연락 빈도", "social", "cat", True, "enb_03z1", "1~6")
meta("friend_weekly", "친구와 주 1회 이상 연락", "social", None, True, "enb_03z1", "1차와 동일 — 조합 분석용")
meta("neighbor_trust", "이웃 간 신뢰", "social", "cat", True, "ena_01a1", "1=예, 2=아니오, 9=모름(별도 범주)")
meta("neighbor_events", "이웃 경조사 참여", "social", "cat", True, "ena_01b1", "1=예, 2=아니오, 9=모름")
meta("dementia_care", "치매환자 가족", "social", "cat", False, "fma_27z1, fma_26z1",
     "0=해당 없음, 1=치매환자 가족(비동거), 2=치매환자와 동거")
# 생활환경
meta("env_safety", "동네 안전 만족", "env", "cat", True, "ena_01c1", "1=예, 2=아니오, 9=모름")
meta("env_nature", "동네 자연환경 만족", "env", "cat", True, "ena_01d1", "1=예, 2=아니오, 9=모름")
meta("env_living", "동네 생활환경 만족", "env", "cat", True, "ena_01e1", "1=예, 2=아니오, 9=모름")
meta("env_transport", "동네 대중교통 만족", "env", "cat", True, "ena_01f1", "1=예, 2=아니오, 9=모름")
meta("env_medical", "동네 의료서비스 만족", "env", "cat", True, "ena_01g1", "1=예, 2=아니오, 9=모름")
meta("urban_type", "동/읍·면", "env", "cat", False, "DONG_TY_CODE", "1=동, 2=읍·면")
meta("housing", "주택유형", "env", "cat", False, "HOUSE_TY_CODE", "1=일반주택, 2=아파트")
meta("region", "시도", "env", "cat", False, "CTPRVN_CODE", "17개 시도 코드")
# 의료접근·건강정보
meta("unmet_medical", "연간 미충족 의료", "care", "cat", True, "sra_01z3", "1=있음, 2=없음, 3=진료 필요 없었음")
meta("unmet_dental", "연간 미충족 치과의료", "care", "cat", True, "ore_02z2", "1=있음, 2=없음, 3=필요 없었음")
meta("checkup", "최근 2년 건강검진", "care", "cat", True, "scb_01z1", "1=예, 0=아니오")
meta("flu_vax", "연간 독감 예방접종", "care", "cat", True, "sca_01z1", "1=예, 0=아니오")
meta("public_health_use", "보건기관 이용", "care", "cat", True, "hma_01z3", "1=예, 0=아니오")
meta("hl_explain", "의료진 설명 이해 어려움", "care", "num", True, "hia_01z1", "1=아주 쉽다 … 4=매우 어렵다")
meta("hl_written", "글로 된 건강정보 이해", "care", "cat", True, "hia_02z1", "1~4 쉬움→어려움, 5=주의를 기울이지 않음")
meta("hl_seek", "건강정보 찾기 어려움", "care", "cat", True, "hia_03z1", "1~4 쉬움→어려움, 5=찾지 않음")
# 심리·증상근접 (주 분석 제외, 별도 블록)
meta("stress", "주관적 스트레스", "proximal", "num", True, "mta_01z1", "1=대단히 많이 … 4=거의 느끼지 않음")
meta("sleep_weekday", "주중 하루 수면시간", "proximal", "num", True, "mtc_17z1", "시간(1~24), 77/99 결측")
meta("sleep_weekend", "주말 하루 수면시간", "proximal", "num", True, "mtc_18z1", "시간(1~24)")
meta("self_rated_health", "주관적 건강수준", "proximal", "num", True, "qoa_01z1", "1=매우 좋음 … 5=매우 나쁨")
meta("eq_mobility", "EQ-5D 운동능력", "proximal", "num", False, "qoc_01z1", "1=문제 없음 … 3=심함")
meta("eq_selfcare", "EQ-5D 자기관리", "proximal", "num", False, "qoc_02z1", "1~3")
meta("eq_usual", "EQ-5D 일상활동", "proximal", "num", False, "qoc_03z1", "1~3")
meta("eq_pain", "EQ-5D 통증·불편", "proximal", "num", False, "qoc_04z1", "1~3")
meta("happiness", "행복감 지수", "proximal", "num", True, "qoc_07z1", "0~10")
meta("bedridden", "최근 1달 침상와병", "proximal", "cat", False, "qoa_02z1", "1=예, 0=아니오")
meta("internet_interf", "인터넷·게임·스마트폰 일상 지장", "proximal", "cat", True, "mtg_01z1",
     "1=이용 안 함, 2=전혀 없음 … 6=거의 매일")
meta("gambling_interf", "도박으로 인한 일상 지장", "proximal", "cat", True, "mti_01z1", "1=도박 안 함, 2=전혀 없음 … 6=거의 매일")
meta("cognitive_decline", "인지장애(기억력 감소) 경험", "proximal", "cat", False, "mtj_05z2",
     "1=예, 0=아니오, 8=비해당(40세 미만에게는 묻지 않음)")
# 메타
meta("split", "학습/시험 구분", "meta", None, None, "household_key", "1차 분할을 가구 단위로 그대로 승계")

VARIABLE_META_V2 = pd.DataFrame(M)
FEATURES = VARIABLE_META_V2[VARIABLE_META_V2["kind"].notna()]


def domain_features(domains) -> tuple[list[str], list[str]]:
    sub = FEATURES[FEATURES["domain"].isin(domains)]
    return list(sub.loc[sub["kind"] == "num", "name"]), list(sub.loc[sub["kind"] == "cat", "name"])


# ---------------------------------------------------------------------------
# 파생 함수
# ---------------------------------------------------------------------------
def _yn9(s: pd.Series) -> pd.Series:
    """1=예, 2=아니오, 9=모름 유지, 7(거부) → 결측."""
    return s.where(s.isin([1, 2, 9]))


def _minutes(h: pd.Series, m: pd.Series) -> pd.Series:
    return (h * 60 + m).where(h.between(0, 24) & m.between(0, 59))


def build_physical_activity(raw: pd.DataFrame, act: pd.DataFrame) -> pd.DataFrame:
    vig_days = _valid(raw["pha_04z1"], range(0, 8))
    mod_days = _valid(raw["pha_07z1"], range(0, 8))
    vig_min = _minutes(raw["pha_05z1"], raw["pha_06z1"])
    mod_min = _minutes(raw["pha_08z1"], raw["pha_09z1"])

    # 지침서 ph_a0200 / ph_a0400 / ph_a0500
    vig_ok = pd.Series(np.nan, index=raw.index)
    vig_ok[vig_days.between(0, 2)] = 0
    v37 = vig_days.between(3, 7)
    vig_ok[v37 & (vig_min < 20)] = 0
    vig_ok[v37 & (vig_min >= 20)] = 1
    mod_ok = pd.Series(np.nan, index=raw.index)
    mod_ok[mod_days.between(0, 4)] = 0
    m57 = mod_days.between(5, 7)
    mod_ok[m57 & (mod_min < 30)] = 0
    mod_ok[m57 & (mod_min >= 30)] = 1
    aerobic_ok = pd.Series(np.nan, index=raw.index)
    aerobic_ok[(vig_ok == 0) & (mod_ok == 0)] = 0
    aerobic_ok[(vig_ok == 1) | (mod_ok == 1)] = 1

    # IPAQ식 주간 MET-분: 일수 0이면 0, 1일 시간은 180분 상한
    def part(days, minutes, met):
        val = met * days * minutes.clip(upper=180)
        return val.where(days != 0, 0.0)

    met = part(vig_days, vig_min, 8.0) + part(mod_days, mod_min, 4.0) + part(act["walk_days"], act["walk_min"], 3.3)

    aerobic_any = pd.Series(np.nan, index=raw.index)
    aerobic_any[(act["walk_ok"] == 0) & (aerobic_ok == 0)] = 0
    aerobic_any[(act["walk_ok"] == 1) | (aerobic_ok == 1)] = 1
    pa_guideline = (aerobic_any * act["strength_ok"]).where(aerobic_any.notna() & act["strength_ok"].notna())

    return pd.DataFrame({
        "vig_days": vig_days, "mod_days": mod_days, "aerobic_ok": aerobic_ok,
        "log_met_min": np.log1p(met), "pa_guideline": pa_guideline,
    })


def build_smoking(raw: pd.DataFrame) -> pd.DataFrame:
    smf, s01, s03 = raw["smf_01z1"], raw["sma_01z1"], raw["sma_03z2"]
    status = pd.Series(np.nan, index=raw.index)
    status[smf == 2] = 0
    status[(smf == 1) & s01.isin([1, 3])] = 0
    status[(smf == 1) & (s01 == 2) & (s03 == 3)] = 1
    status[(smf == 1) & (s01 == 2) & s03.isin([1, 2])] = 2

    heated = pd.Series(np.nan, index=raw.index)  # sm_a2700
    heated[(raw["sma_36z1"] == 1) & raw["sma_37z1"].isin([1, 2])] = 1
    heated[(raw["sma_36z1"] == 1) & (raw["sma_37z1"] == 3)] = 0
    heated[(raw["sma_36z1"] == 2) | (smf == 2)] = 0
    liquid = pd.Series(np.nan, index=raw.index)  # sm_a1000
    liquid[(raw["sma_08z1"] == 1) & raw["sma_11z2"].between(1, 31)] = 1
    liquid[(raw["sma_08z1"] == 1) & (raw["sma_11z2"] == 0)] = 0
    liquid[(raw["sma_08z1"] == 2) | (smf == 2)] = 0
    ecig = pd.Series(np.nan, index=raw.index)
    ecig[(heated == 0) & (liquid == 0)] = 0
    ecig[(heated == 1) | (liquid == 1)] = 1
    return pd.DataFrame({"smoking_status": status, "ecig_current": ecig})


def build_drinking(raw: pd.DataFrame) -> pd.DataFrame:
    dra, d01, d03, sex = raw["dra_01z1"], raw["drb_01z3"], raw["drb_03z1"], raw["sex"]
    freq = pd.Series(np.nan, index=raw.index)
    freq[dra == 2] = 0
    freq[dra == 1] = d01[dra == 1].map({1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5})

    # 지침서 dr_a0500
    hr = pd.Series(np.nan, index=raw.index)
    hr[dra == 2] = 0
    hr[(dra == 1) & (d01 == 1)] = 0
    drinker = (dra == 1) & d01.isin([2, 3, 4, 5, 6])
    hr[drinker & d01.isin([2, 3, 4])] = 0
    often = drinker & d01.isin([5, 6])
    hr[often & (sex == 1) & d03.isin([1, 2, 3])] = 0
    hr[often & (sex == 1) & d03.isin([4, 5])] = 1
    hr[often & (sex == 2) & d03.isin([1, 2])] = 0
    hr[often & (sex == 2) & d03.isin([3, 4, 5])] = 1

    binge_src = raw["drb_04z1"].where(sex == 1, raw["drb_05z1"])
    binge = _valid(binge_src, range(1, 6))
    binge[freq == 0] = 0
    return pd.DataFrame({"drinking_freq": freq, "high_risk_drinking": hr, "binge_freq": binge})


def build_new_domains(raw: pd.DataFrame) -> pd.DataFrame:
    occ = raw["soa_06z2"]
    emp = raw["soa_07z1"]
    dem = pd.Series(np.nan, index=raw.index)
    dem[raw["fma_27z1"] == 2] = 0
    dem[(raw["fma_27z1"] == 1) & (raw["fma_26z1"] == 2)] = 1
    dem[(raw["fma_27z1"] == 1) & (raw["fma_26z1"] == 1)] = 2
    cog = raw["mtj_05z2"].map({1: 1, 2: 0, 8: 8})
    return pd.DataFrame({
        # 경제
        "livelihood": _valid(raw["fma_04z1"], [1, 2, 3]),
        "food_insecurity": _valid(raw["nue_01z1"], [1, 2, 3, 4]),
        "occupation": occ.where(occ.between(1, 10)).fillna(occ.map({88: 0})),
        "emp_status": emp.where(emp.between(1, 3)).fillna(emp.map({8: 0})),
        # 신체건강
        "body_image": _valid(raw["oba_01z1"], range(1, 6)),
        "oral_health": _valid(raw["ora_01z1"], range(1, 6)),
        "chewing": _valid(raw["orb_01z1"], range(1, 6)),
        "fall": _binary_yes_no(raw["irb_01z1"]),
        "injury": _binary_yes_no(raw["ira_01z1"]),
        # 건강행태(식생활 등)
        "breakfast": _valid(raw["nua_01z2"], range(1, 5)),
        "weight_control": _valid(raw["obb_01z1"], range(1, 5)),
        "brushing_lunch": _valid(raw["ord_01d2"], [1, 2, 3]),
        # 사회관계
        "neighbor_trust": _yn9(raw["ena_01a1"]),
        "neighbor_events": _yn9(raw["ena_01b1"]),
        "dementia_care": dem,
        # 생활환경
        "env_safety": _yn9(raw["ena_01c1"]),
        "env_nature": _yn9(raw["ena_01d1"]),
        "env_living": _yn9(raw["ena_01e1"]),
        "env_transport": _yn9(raw["ena_01f1"]),
        "env_medical": _yn9(raw["ena_01g1"]),
        "urban_type": raw["DONG_TY_CODE"].astype(int),
        "housing": raw["HOUSE_TY_CODE"].astype(int),
        "region": raw["CTPRVN_CODE"].astype(int),
        # 의료접근·건강정보
        "unmet_medical": _valid(raw["sra_01z3"], [1, 2, 3]),
        "unmet_dental": _valid(raw["ore_02z2"], [1, 2, 3]),
        "checkup": _binary_yes_no(raw["scb_01z1"]),
        "flu_vax": _binary_yes_no(raw["sca_01z1"]),
        "public_health_use": _binary_yes_no(raw["hma_01z3"]),
        "hl_explain": _valid(raw["hia_01z1"], range(1, 5)),
        "hl_written": _valid(raw["hia_02z1"], range(1, 6)),
        "hl_seek": _valid(raw["hia_03z1"], range(1, 6)),
        # 심리·증상근접
        "stress": _valid(raw["mta_01z1"], range(1, 5)),
        "sleep_weekday": raw["mtc_17z1"].where(raw["mtc_17z1"].between(1, 24)),
        "sleep_weekend": raw["mtc_18z1"].where(raw["mtc_18z1"].between(1, 24)),
        "self_rated_health": _valid(raw["qoa_01z1"], range(1, 6)),
        "eq_mobility": _valid(raw["qoc_01z1"], [1, 2, 3]),
        "eq_selfcare": _valid(raw["qoc_02z1"], [1, 2, 3]),
        "eq_usual": _valid(raw["qoc_03z1"], [1, 2, 3]),
        "eq_pain": _valid(raw["qoc_04z1"], [1, 2, 3]),
        "happiness": _valid(raw["qoc_07z1"], range(0, 11)),
        "bedridden": _binary_yes_no(raw["qoa_02z1"]),
        "internet_interf": _valid(raw["mtg_01z1"], range(1, 7)),
        "gambling_interf": _valid(raw["mti_01z1"], range(1, 7)),
        "cognitive_decline": cog,
    })


def inherit_split(df: pd.DataFrame) -> pd.Series:
    """1차 분할을 가구 단위로 승계. 1차 표본에 없던 가구(걷기 판정 불가 19명 등)는 가구키 해시로 20%를 시험셋에 배정."""
    v1 = pd.read_csv(ANALYSIS_TABLE, usecols=["household_key", "split"], dtype={"household_key": str})
    hh_split = v1.dropna(subset=["split"]).drop_duplicates("household_key").set_index("household_key")["split"]
    split = df["household_key"].map(hh_split)
    missing = split.isna() & df["Y"].notna()
    split[missing] = df.loc[missing, "household_key"].map(
        lambda k: "test" if zlib.crc32(k.encode()) % 5 == 0 else "train")
    return split.where(df["Y"].notna())


# ---------------------------------------------------------------------------
# 검증
# ---------------------------------------------------------------------------
def validate_branches(raw: pd.DataFrame) -> None:
    """신규 변수의 분기(비해당) 구조가 지침서 설명과 개인 단위로 일치하는지 확인."""
    eq = lambda a, b, msg: None if (a == b).all() else (_ for _ in ()).throw(AssertionError(msg))
    eq(raw["pha_05z1"] == 88, raw["pha_04z1"] == 0, "고강도 시간 비해당 ≠ 고강도 0일")
    eq(raw["pha_08z1"] == 88, raw["pha_07z1"] == 0, "중강도 시간 비해당 ≠ 중강도 0일")
    eq(raw["sma_01z1"] == 8, raw["smf_01z1"] == 2, "궐련 평생흡연 비해당 ≠ 담배제품 평생 미사용")
    eq(raw["sma_03z2"] == 8, (raw["smf_01z1"] == 2) | (raw["sma_01z1"] == 3), "궐련 현재흡연 비해당 분기 불일치")
    eq(raw["drb_01z3"] == 8, raw["dra_01z1"] == 2, "음주빈도 비해당 ≠ 평생 비음주")
    eq(raw["drb_03z1"] == 8, (raw["dra_01z1"] == 2) | (raw["drb_01z3"] == 1), "음주량 비해당 분기 불일치")
    eq(raw["soa_06z2"] == 88, raw["soa_01z1"] == 2, "직업 비해당 ≠ 비경제활동")
    eq(raw["soa_07z1"] == 8, raw["soa_01z1"] == 2, "종사상지위 비해당 ≠ 비경제활동")
    eq(raw["fma_26z1"] == 8, raw["fma_27z1"] == 2, "치매 동거 비해당 ≠ 치매가족 아님")
    eq(raw["irb_02z1"] == 8, raw["irb_01z1"] == 2, "낙상 건수 비해당 ≠ 낙상 없음")
    eq(raw["mtj_05z2"] == 8, raw["age"] < 40, "인지장애 비해당 ≠ 40세 미만")
    # 폭음: 남자 문항은 여자와 최근 1년 비음주 남자에게 비해당
    male_nondrink = (raw["sex"] == 1) & ((raw["dra_01z1"] == 2) | (raw["drb_01z3"] == 1))
    eq(raw["drb_04z1"] == 8, (raw["sex"] == 2) | male_nondrink, "남자 폭음 문항 분기 불일치")
    female_nondrink = (raw["sex"] == 2) & ((raw["dra_01z1"] == 2) | (raw["drb_01z3"] == 1))
    eq(raw["drb_05z1"] == 8, (raw["sex"] == 1) | female_nondrink, "여자 폭음 문항 분기 불일치")


def validate_v2(df: pd.DataFrame) -> None:
    assert (df["Y"] == 1).sum() == 8704 and (df["Y"] == 0).sum() == 222586 and df["Y"].isna().sum() == 325
    assert df["household_key"].nunique() == 136845
    s = df[df["Y"].notna()]
    assert len(s) == 231290
    # 1차 분할 승계: 1차 표본 231,271명은 1차와 같은 split
    v1 = pd.read_csv(ANALYSIS_TABLE, usecols=["exmprs_no", "split"], dtype={"exmprs_no": str}).dropna()
    merged = v1.merge(df[["exmprs_no", "split"]], on="exmprs_no", suffixes=("_v1", "_v2"))
    assert len(merged) == 231271 and (merged["split_v1"] == merged["split_v2"]).all(), "1차 분할 승계 실패"
    tr = set(s.loc[s["split"] == "train", "household_key"])
    te = set(s.loc[s["split"] == "test", "household_key"])
    assert not (tr & te), "가구 단위 분할 누수"
    # 공식 지표 파생 결과 범위 점검
    assert set(s["smoking_status"].dropna().unique()) <= {0, 1, 2}
    assert set(s["high_risk_drinking"].dropna().unique()) <= {0, 1}
    assert s["occupation"].notna().mean() > 0.999 and (s["occupation"] == 0).sum() == (s["emp_status"] == 0).sum()
    # 모든 모형 투입 변수 결측률 5% 미만
    feats = list(FEATURES["name"])
    miss = s[feats].isna().mean()
    assert (miss < 0.05).all(), f"결측률 5% 초과: {miss[miss >= 0.05].to_dict()}"


def build_v2_table(raw: pd.DataFrame) -> pd.DataFrame:
    act = build_activity(raw)
    df = pd.concat([
        build_identifiers(raw), build_outcome(raw), act, build_contact(raw), build_controls(raw),
        build_physical_activity(raw, act), build_smoking(raw), build_drinking(raw), build_new_domains(raw),
    ], axis=1)
    df["split"] = inherit_split(df)
    return df[list(VARIABLE_META_V2["name"])]


def main() -> None:
    raw = load_raw()
    validate_raw(raw)
    validate_branches(raw)
    print("원시자료·분기 검증 통과")
    df = build_v2_table(raw)
    validate_v2(df)
    print("v2 파생변수 검증 통과")
    V2_PROCESSED.mkdir(parents=True, exist_ok=True)
    df.to_csv(V2_TABLE, index=False, encoding="utf-8-sig")
    s = df[df["Y"].notna()]
    print(f"저장: {V2_TABLE} ({df.shape[0]:,}행 × {df.shape[1]}열), 분석표본 {len(s):,}명 "
          f"(train {(s['split'] == 'train').sum():,} / test {(s['split'] == 'test').sum():,})")
    print("영역별 투입 변수 수:", FEATURES.groupby("domain", sort=False).size().to_dict())
    print("결측률 상위:", s[list(FEATURES["name"])].isna().mean().sort_values(ascending=False).head(8).round(4).to_dict())
    print("활동조합 확인:", s["activity_combo"].map(COMBO_LABELS).value_counts().to_dict())


if __name__ == "__main__":
    main()
