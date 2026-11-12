# 팀원용 안내 — 두 시점의 코드를 받아 각자 분석하기

저장소: https://github.com/202103116-stack/Depression_MultiDomain_Capstone (공개 저장소라 로그인 없이 받을 수 있음)

## 1. 어느 시점을 받을까

| 이름 | 시점 | 이럴 때 받으세요 |
|---|---|---|
| `midterm-2026-10` (태그) | **중간 프로포절까지 — 연구 1(다차원 요인)** 코드와 중간발표 자료, 결과변수 PHQ-9 ≥ 10 | 피드백 반영 전 연구 1에서 새 아이디어를 시험할 때 |
| `v3-econ-reversal` (브랜치) | **중간 프로포절까지 — 연구 2(경제적 역전점)** 코드와 보고서 | 피드백 반영 전 연구 2에서 시험할 때 |
| `v4-sport-feedback` (태그) | **이번 피드백 반영 직후** — 연구 1·2가 합쳐져 있고 PHQ-9 ≥ 5, 운동 조합·교차 결과 ML·가중 모델 추가 | 최신 분석 위에 이어서 할 때(대부분 이것을 추천) |

- 중간 프로포절 때는 연구 1과 연구 2를 따로 작업했습니다. 그래서 "중간까지" 시점은 두 곳에 나뉘어 있습니다. 두 연구가 한 폴더에 모두 들어 있는 것은 `v4-sport-feedback`입니다.
- 태그와 브랜치는 "그 시점의 사진"입니다. 받아서 고쳐도 원본은 바뀌지 않으니 마음껏 실험해도 됩니다.

## 2-A. 가장 쉬운 방법: ZIP으로 받기 (git 몰라도 됨)

1. 아래 링크 중 하나를 누르면 ZIP이 바로 내려받아집니다.
   - 중간 프로포절까지(연구 1): https://github.com/202103116-stack/Depression_MultiDomain_Capstone/archive/refs/tags/midterm-2026-10.zip
   - 중간 프로포절까지(연구 2): https://github.com/202103116-stack/Depression_MultiDomain_Capstone/archive/refs/heads/v3-econ-reversal.zip
   - 피드백 반영 직후: https://github.com/202103116-stack/Depression_MultiDomain_Capstone/archive/refs/tags/v4-sport-feedback.zip
2. 압축을 풀고 폴더를 VS Code로 엽니다. 두 시점을 모두 받았다면 폴더 이름을 다르게 둡니다(예: `우울_중간`, `우울_v4`).
3. 아래 3번(환경 준비)으로 넘어갑니다.

ZIP으로 받은 폴더는 GitHub와 연결되지 않습니다. 내 작업을 팀 저장소에 올릴 필요가 없다면 이 방법으로 충분합니다.

## 2-B. git으로 받기 (내 작업 기록을 남기거나 올리고 싶을 때)

처음 한 번만: https://git-scm.com 에서 Git을 설치합니다(설치 중 선택지는 기본값).

VS Code에서 `터미널 → 새 터미널`을 열고 한 줄씩 입력합니다.

```powershell
# 1) 저장소 받기 (원하는 폴더에서)
git clone https://github.com/202103116-stack/Depression_MultiDomain_Capstone.git
cd Depression_MultiDomain_Capstone

# 2) 시작 시점을 골라 내 브랜치 만들기 — 둘 중 하나
git switch -c 이름-아이디어 v4-sport-feedback          # 피드백 반영 직후에서 시작(추천)
git switch -c 이름-아이디어 midterm-2026-10            # 중간 프로포절 시점, 연구 1
git switch -c 이름-아이디어 origin/v3-econ-reversal    # 중간 프로포절 시점, 연구 2
#   예: git switch -c minsu-sleep v4-sport-feedback

# 3) 작업하다가 저장(기록)하기
git add -A
git commit -m "무엇을 했는지 한 줄"
```

- 브랜치는 "내 전용 작업 공간"입니다. 다른 사람의 작업과 섞이지 않습니다.
- 지금 어느 브랜치에 있는지 확인: `git branch` (별표 `*`가 현재 위치)
- 다른 시점으로 바꾸기 전에는 먼저 `git commit`으로 저장하세요.
- **팀 저장소에 올리기(push)**: 저장소 주인(202103116-stack)이 GitHub의 `Settings → Collaborators`에서 내 GitHub 아이디를 초대해야 합니다. 초대를 수락한 뒤 `git push -u origin 이름-아이디어`로 올리면 됩니다. 올리기 전에 4번의 주의사항을 꼭 확인하세요.

## 3. 환경 준비 (두 방법 공통, 폴더마다 한 번)

1. **Python 3.11 설치**: https://www.python.org/downloads/ 에서 3.11.x를 받습니다. 설치 첫 화면에서 "Add python.exe to PATH"를 체크합니다.
2. **원자료 넣기**: 질병관리청에서 받은 `chs25_all.sas7bdat`를 폴더 안 `data/raw/`에 넣습니다. 저장소에는 원자료가 없습니다.
3. **가상환경과 패키지 설치**: VS Code 터미널에서 실행합니다.

```powershell
py -3.11 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
$env:PYTHONIOENCODING = "utf-8"
```

4. **분석표 만들기**: 받은 시점에 따라 순서대로 실행합니다(전체 약 5분).

```powershell
.venv\Scripts\python src\preprocess.py          # 1차 분석표(분할 정보의 출처)
.venv\Scripts\python src\v2\preprocess_v2.py    # 연구 1·2가 쓰는 분석표
.venv\Scripts\python src\v4\outcomes_v4.py      # (v4-sport-feedback만) PHQ-9 ≥ 5·우울감 경험 결과변수 추가
```

이제 각 시점의 분석 코드를 그대로 돌리거나 고쳐서 내 아이디어를 시험할 수 있습니다.

## 4. 꼭 지킬 것

- **원자료와 개인 단위 결과는 절대 올리거나 공유하지 않습니다**(지역사회건강조사 이용 규정). `data/` 폴더는 GitHub에 올라가지 않도록 이미 설정되어 있습니다. 그러니 원자료나 개인별 표를 `data/` 밖으로 옮기지 마세요.
- 공유는 집계 결과(표·그림)만 합니다.
- 내 분석 기록은 `docs/` 안에 나만의 메모 파일(예: `docs/ideas/이름.md`)로 남기면 나중에 합치기 쉽습니다.

## 5. 어디를 보면 되나

| 알고 싶은 것 | 파일 |
|---|---|
| 연구 1(다차원 요인) 진행과 결과 | `docs/v2/WORKFLOW_v2.md` |
| 연구 2(경제적 역전점) 진행과 결과 | `docs/v3/WORKFLOW_v3.md` |
| 이번 피드백 반영 계획과 결과 | `docs/v4/REQUEST_v4.md`, `docs/v4/WORKFLOW_v4.md` |
| 왜 그렇게 정했는지 | `docs/decision_log.md` |
| 변수 정의 | `docs/v2/data_dictionary_v2.md` |
