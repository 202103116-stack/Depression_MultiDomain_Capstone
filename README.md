# PHQ-9 ≥5 주 분석을 위한 재분석 포크

현재 작업은 **PHQ-9 ≥5 주 분석 / ≥10 민감도 분석**이다. 실행 방법·연구목적·결과 경로·분석 범위는 [README_PHQ5.md](README_PHQ5.md)에 정리했다. 아래 내용과 기존 `outputs/v2/`, `paper/`는 원본의 ≥10 분석 기록이다. 새 ≥5 결과와 구분한다.

---

# 원본 연구 기록: 한국 성인의 걷기와 근력운동 유형 조합에 따른 우울 증상 차이 및 사회적 연결망의 역할

2025 지역사회건강조사(KCHS) 원시자료로 **걷기·근력운동 실천 조합(4분류)** 과 **우울 증상 기준 충족(PHQ-9 ≥ 10)** 의 관계가
나이·소득·신체건강을 고려한 뒤에도 남는지, 그 관계가 **친구와의 연락 빈도** 에 따라 달라지는지를 살펴보고,
활동·연락 정보가 우울 증상 분류 성능을 높이는지 머신러닝으로 비교하는 캡스톤 프로젝트.

## 빠른 시작

```powershell
py -3.11 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
$env:PYTHONIOENCODING = "utf-8"

.venv\Scripts\python src\preprocess.py        # 로딩 → 파생변수 → 검증 assert → data/processed/analysis_table.csv
.venv\Scripts\python src\describe_dataset.py  # docs/dataset_description.md, outputs/reports/dataset_profile.csv
.venv\Scripts\python src\eda.py               # outputs/figures/eda_*.png
.venv\Scripts\python src\train_models.py --sensitivity   # M0~M3 × 6개 알고리즘 (약 2~3시간, 절전 해제 권장)
.venv\Scripts\python src\compare_blocks.py    # 인접 블록 간 개선량 95% CI (약 10분)
.venv\Scripts\python src\survey_regression.py # H1·H2 설계 기반 조정 회귀 (수 분)
```

- 원시자료 `chs25_all.sas7bdat`는 `data/raw/`에 직접 두어야 한다(저장소에 포함하지 않음 — 이용 규정).
- 이 PC에서는 Windows 스마트 앱 컨트롤 때문에 scikit-learn 1.6.1로 고정했다(`docs/decision_log.md` D-01).
- `train_models.py`는 조합별 결과를 `data/processed/model_runs/`에 캐시한다. 설정을 바꿨다면 캐시를 지우고 다시 실행.

## 폴더 구조

```
├── data/
│   ├── raw/                    chs25_all.sas7bdat (원본, 수정 금지)
│   └── processed/              analysis_table.csv, model_runs/(캐시·개인 단위 예측 — 공유 금지)
├── docs/
│   ├── WORKFLOW.md             CRISP-DM 단계별 진행 기록과 결과 요약
│   ├── decision_log.md         변수·모델링 판단과 근거
│   ├── data_dictionary.md      지침서와 대조해 확인한 변수별 사실
│   ├── dataset_description.md  분석용 데이터셋 설명서(자동 생성)
│   └── reference/              이용지침서 PDF, 연구설계 docx
├── src/
│   ├── utils.py                경로·상수·로딩·그림 스타일
│   ├── preprocess.py           파생변수 + 검증 assert + 변수 메타데이터(단일 출처)
│   ├── describe_dataset.py     데이터셋 설명서 자동 생성
│   ├── eda.py                  기초/이변량/심화 EDA
│   ├── modeling.py             정보 블록, 파이프라인, 알고리즘, 분할, 지표
│   ├── train_models.py         M0~M3 × 알고리즘 학습·평가·그림
│   ├── survey_regression.py    조사설계 반영 조정 로지스틱 회귀(H1·H2)
│   └── compare_blocks.py       인접 블록 간 개선량(M1−M0, M2−M1, M3−M2) 부트스트랩
├── outputs/
│   ├── figures/                eda_*.png, model_*.png, reg_*.png
│   └── reports/                dataset_profile.csv, model_comparison.csv, model_block_steps.csv, model_sensitivity.csv, reg_*.csv, eda_*.csv, *_log.txt
├── requirements.txt
└── SETUP_PROMPT.md             프로젝트 세팅 지시문(원본)
```

## 핵심 정의

| 항목 | 정의 |
|---|---|
| Y | PHQ-9(`mtb_07a1`~`i1`) 총점 ≥ 10 → 1. 9문항 모두 유효할 때만 산출 (Y=1 8,704 / Y=0 222,586 / 결측 325) |
| 걷기 실천 | 주 5일 이상 & 1일 30분 이상 (`phb_01z1~03z1`, 지침서 `ph_b0200` 로직) |
| 근력운동 실천 | 주 2일 이상 (`pha_19z1` 3~6) |
| 활동조합 | 둘 다 미충족 / 근력운동만 / 걷기만 / 둘 다 충족 |
| 주 조절변수 | 친구와 연락 빈도 `enb_03z1` (친척 `enb_01z1`·이웃 `enb_02z1`은 민감도 분석) |
| 정보 블록 | M0 통제변수 → M1 +활동조합 → M2 +친구 연락 → M3 +활동조합×친구 연락 |
| 분할 | 가구(`household_key`) 단위 80/20, 학습셋 내 가구 단위 층화 5-fold |
| 주 지표 | Average Precision (PR-AUC) |
| 설명 모형 | 가중치 `wt_p`, 층 `kstrata`, 집락 `spot_no` 반영 로지스틱 회귀(테일러 선형화) |

## 2차 방향 (v2): 우울 증상의 다차원 요인 분석 — 브랜치 `v2-multidomain`

교수 피드백에 따라 8개 영역 66개 변수로 확장했다. 1차 결과는 태그 `v1-activity-network`로 동결했다.

```powershell
.venv\Scripts\python src2\preprocess_v2.py        # 변수 구성·분기 검증 → data/processed/v2/
.venv\Scripts\python src2\describe_v2.py          # docs/v2/dataset_description_v2.md
.venv\Scripts\python src2\eda_v2.py               # outputs/v2/figures/eda_v2_*
.venv\Scripts\python src2	rain_v2.py             # ML 영역 기여도·SHAP (2~3시간, 절전 해제)
.venv\Scripts\python src2\survey_regression_v2.py # 조사설계 회귀·신체활동 조합
.venv\Scripts\python src2\performance_v2.py       # 성능 CI·보정·하위집단
.venv\Scripts\python paperuild_paper_data.py      # 논문 수치 JSON
cd paper; npm install; node build_manuscript.js       # paper/manuscript_v2.docx
cd ..; .venv\Scripts\python paperender_check.py paper\manuscript_v2.docx; .venv\Scripts\python paper\section_pages.py
cd paper; node build_checklist.js                     # paper/strobe_tripod_checklist.docx
```

진행 기록은 `docs/v2/WORKFLOW_v2.md`, 변수 검증은 `docs/v2/data_dictionary_v2.md`에 있다.

## 1차 결과 요약 (2026-10-12)

| 가설 | 결과 | 판정 |
|---|---|---|
| H1 둘 다 충족 < 둘 다 미충족 (조정 후) | 조정 OR 0.48 [0.43, 0.53], 조정 유병률 2.42% vs 4.83% | 지지 |
| H2 활동조합 차이가 친구 연락에 따라 다름 | 승법 상호작용 p=0.41, 가법 +1.24%p [0.69, 1.79] (연락 드문 집단에서 절대 차이 큼) | 부분 지지(가법 척도) |
| H3 활동·연락 정보가 분류 성능을 높임 | ΔAP(M2−M0) +0.020~0.026, 최고 AP 0.148 / ROC-AUC 0.756 | 지지(개선 폭 작음) |

자세한 내용은 `docs/WORKFLOW.md` 6절.

## 데이터 이용 유의사항

질병관리청 원시자료 이용 규정에 따라 원시자료와 개인 단위 결과(예측값 등)는 외부에 공유하지 않는다.
보고서·노션에는 집계표와 그림만 사용하고, 산출물에는 출처(질병관리청 지역사회건강조사 2025)를 표기한다.
