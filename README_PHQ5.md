# PHQ-9 ≥5 주 분석 재분석

원본 `202103116-stack/Depression_MultiDomain_Capstone`의 `v2-multidomain` 커밋 `26b6a2064c69461edae1c8ceb37277643cd16cdc`에서 분기했다. 원본의 ≥10 결과를 ≥5 결과로 다시 이름 붙이지 않고 전처리·모형 적합부터 반복한다.

## 연구목적

2025년 지역사회건강조사에서 경도 이상 우울 증상(PHQ-9 ≥5)과 관련된 생활영역의 정보를 ML로 비교하고, 조사설계 회귀로 건강 생활요인 충족 개수의 관련성을 살펴본다. 경제적 수준별 차이는 심층 탐색으로 검토한다. 현재 증상의 분류이며 미래 발병 예측·임상 진단·개입 효과 추정이 아니다.

≥5는 경도 이상, ≥10은 중등도 이상 증상을 포함한다. ≥5가 사건 수를 늘리지만 기준 변경은 분석 대상의 의미도 바꾼다. 변경 이력과 탐색적 성격을 기록하고 ≥10으로 민감도 분석을 실시한다. 원저: Kroenke et al. (2001), https://doi.org/10.1046/j.1525-1497.2001.016009606.x

## 결과와 캐시 분리

|구분|주 분석|민감도|
|---|---|---|
|환경변수|`PHQ_CUTOFF=5` (기본값)|`PHQ_CUTOFF=10`|
|전처리·개인 예측|`data/processed/phq5/`|`data/processed/phq10/`|
|v2 집계표·그림|`outputs/phq5/v2/`|`outputs/phq10/v2/`|
|유효9문항 중 양성|37,030 / 231,290 (비가중16.01%)|8,704 / 231,290 (비가중3.76%)|

기존 `outputs/v2/`, `outputs/figures/`, `paper/`에는 원본 ≥10 결과가 남아 있다. 새 ≥5 결과로 해석하지 않는다. 9문항 중 하나라도 유효하지 않으면 총점과 Y를 결측으로 처리한다(325명). 소득·행동·가구 분할 등 다른 정의는 우선 원본을 재현한다.

## 실행

전용 가상환경에서 `requirements-phq-reanalysis.lock.txt`로 실행 환경을 재현한다. 원자료는 로컬에 두며, 저장소에 넣지 않는다. SAS 파일은 기본 `data/raw/chs25_all.sas7bdat`, 원본 201열 CSV를 쓰면 `CHS_RAW_PATH`로 지정한다. CSV의 SAS 문자형 바이트 리터럴은 숫자로 변환하지 않고 복원해 선행 0과 가구키를 유지한다.

```powershell
$env:CHS_RAW_PATH='로컬 원자료 절대경로'
$env:PYTHONIOENCODING='utf-8'
$env:OPENBLAS_NUM_THREADS='4'
.venv/Scripts/python -m unittest discover -s tests -v
foreach ($cutoff in @(5,10)) {
    $env:PHQ_CUTOFF=[string]$cutoff
    .venv/Scripts/python src/preprocess.py
    .venv/Scripts/python src/v2/preprocess_v2.py
    .venv/Scripts/python src/v2/eda_v2.py
    .venv/Scripts/python src/v2/run_lgbm_core.py
    .venv/Scripts/python src/v2/survey_regression_v2.py
    .venv/Scripts/python src/v2/h1_score6.py
    .venv/Scripts/python src/v2/economic_lifestyle.py
}
.venv/Scripts/python src/v2/audit_reanalysis.py
foreach ($cutoff in @(5,10)) {
    $env:PHQ_CUTOFF=[string]$cutoff
    .venv/Scripts/python src/v2/finalize_reanalysis.py
}
```

민감도는 `PHQ_CUTOFF='10'`으로 바꾸어 같은 명령을 실행한다. 원본의 학습184,762/시험46,528명 가구 분할을 유지한다. `audit_reanalysis.py`는 두 기준의 전처리가 모두 끝난 뒤 실행한다. `run_lgbm_core.py`는 전체 표본, LightGBM 500회, 가구5-fold CV, 모든 영역 추가·제거, 전체 시험표본 TreeSHAP, 가구1000회 부트스트랩을 사용한다. 추가로 `--catboost-full`을 주면 전체53변수 CatBoost600회·5fold 비교도 수행한다(계산시간이 길다). 이번 실행에서는 ≥5 CatBoost 전체 모형까지 완료했다. 원본의 모든6알고리즘·CatBoost 모든 영역 비교를 완료한 것은 아니다.

원본 전체 파이프라인은 `train_v2.py`로 보존했다. 그 명령의 `--primary-only`는 전체 표본·CatBoost600회·로지스틱 비교를 수행하며 표본 축소 옵션이 아니다. `--quick`는 축소 스모크 테스트이므로 논문 주 결과로 사용하지 않는다. 발표용 주 영역 비교 알고리즘은 계산 가능성을 고려해 LightGBM으로 명시했다. 알고리즘 선택 변경을 성능 우월성 주장으로 해석하지 않는다.

## 경제적 수준별 심층 분석

`h1_score6.py`는 H1을 새 연구모형과 같은 K범주·보정 집합으로 적합한다. 기본보정은 연령·성별·교육·혼인상태+소득5분위이며 신체건강을 추가한 모형을 병행한다. 주≥5 OR는0.773[0.760,0.786], 민감도≥10 OR는0.692[0.670,0.714]다. `reg_v2_*`는 원고의 기존 조정 집합·0~1개 범주를 그대로 재현한 별도 결과로, ≥5 OR0.779와≥10 OR0.700이다. 두 분석을 섞지 않는다.

`economic_lifestyle.py`는 현재 여섯 요인의 합계(신체활동·담배 미사용·비고위험음주·아침식사·사회적 연결·저녁 후 또는 취침 전 칫솔질)를 사용한다. 범주는0~2/3/4/5/6개다. 소득5분위를 모두 적합하고 주 비교는1·5분위다. 연령·성별·교육·혼인상태 보정과 신체건강 추가 보정을 나눠 보고한다. 사회적 연결 점수에 1인가구가 포함되므로 세대유형을 다시 보정하지 않는다.

K×소득 상호작용을 공동검정하고 공통 보정변수 분포에서 표준화한 조정 비율을 비교한다. 역전은 소득5분위의 0~2개 범주 또는 소득5분위 평균과의 차이로 탐색한다. 점별95% CI와 함께, 보정 집합별 2개 비교 기준×5개 K범주의 총10개 비교에 대한 Holm 보정 p값을 보고한다. 같은 K의 집단 차이 및 절대 격차 변화 대비도 별도로 산출한다. 탐색 결과이며 개인의 변화·경제적 불리함의 인과적 상쇄로 해석하지 않는다. 기존7요인 경제분석의 역전점을 그대로 사용하지 않는다.

사회적 연결은 개인 행동만으로 구성되지 않고, 여섯 항목 전체도 공인 척도가 아니다. 조작적 정의·대리측정·자기보고·횡단면·잔여 교란의 한계를 명시한다. 생활요인 점수는 같은 시점에서 충족한 개수이며 종단적 축적 과정이 아니다.

## 공유 범위

원자료·가공된 개인별 행·가구키·개인 예측값은 `data/`에만 보관한다. 공개할 수 있는 산출물은 코드와 집계표·그림으로 제한한다. 공유 문서는 읽기만 수행했으며 편집하지 않았다.
