/*
 * STROBE(횡단면) + TRIPOD+AI 체크리스트 대응표 — 원고의 보고 위치(절, 쪽)를 항목별로 정리한다.
 * 실행: node paper/build_checklist.js   (render_check.py → section_pages.py 실행 후)
 * 산출: paper/strobe_tripod_checklist_v2.1.docx (manuscript_v2.1 기준)
 * 근거: STROBE 횡단면 체크리스트(strobe-statement.org), TRIPOD+AI 체크리스트(Collins et al., BMJ 2024;385:e078378, 2024-01-11판)
 */
const fs = require("fs");
const path = require("path");
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType,
  TableLayoutType, PageOrientation, VerticalAlign } = require("docx");

const DIR = __dirname;
const PG = JSON.parse(fs.readFileSync(path.join(DIR, "section_pages.json"), "utf-8"));
const FONT = { ascii: "Times New Roman", hAnsi: "Times New Roman", eastAsia: "바탕", cs: "Times New Roman" };

// 보고 위치 표기: 절 이름 배열 → "절 이름 (n쪽)"
const at = (...keys) => keys.map((k) => {
  if (!(k in PG)) throw new Error(`section_pages.json에 없음: ${k}`);
  return `${k} (${PG[k]}쪽)`;
}).join("; ");
const NA = (why) => `해당 없음 — ${why}`;

const STROBE = [
  ["1(a)", "제목 또는 초록에 연구설계를 일반적인 용어로 명시", at("국문 초록", "Abstract") + " — \"횡단면 연구\""],
  ["1(b)", "초록에 수행 내용과 결과를 균형 있게 요약", at("국문 초록", "Abstract")],
  ["2", "연구의 과학적 배경과 근거", at("서론")],
  ["3", "구체적 목적과 사전 가설", at("서론") + " — 연구 질문 4개"],
  ["4", "연구설계의 핵심 요소를 앞부분에 제시", at("연구설계와 자료")],
  ["5", "연구 장소, 지역, 자료 수집 기간 등 관련 날짜", at("연구설계와 자료") + " — 2025.5.16~7.31, 가구 방문 1:1 면접"],
  ["6(a)", "대상자 적격 기준과 선정 방법", at("연구설계와 자료", "연구대상")],
  ["7", "결과, 노출, 예측변수, 잠재적 교란변수, 효과수정변수의 정의", at("결과변수", "독립변수") + "; 표 1; 표 S1"],
  ["8", "각 변수의 자료원과 측정 방법", at("독립변수") + " — 이용지침서 코드표·분기와 대조; 표 S1"],
  ["9", "잠재적 비뚤림을 다루기 위한 노력", at("독립변수", "결측 처리", "머신러닝") + " — 증상근접 영역 분리, 가구 단위 분할"],
  ["10", "연구 규모의 결정 방법", at("연구대상") + " — 가용 원시자료 전수 사용"],
  ["11", "정량 변수의 처리와 범주화 근거", at("기술통계와 조사설계 기반 회귀분석", "독립변수") + "; 표 S1"],
  ["12(a)", "교란 통제를 포함한 모든 통계 방법", at("기술통계와 조사설계 기반 회귀분석", "머신러닝")],
  ["12(b)", "하위집단과 상호작용 분석 방법", at("기술통계와 조사설계 기반 회귀분석", "머신러닝") + " — 조합 상호작용, 연령대별"],
  ["12(c)", "결측자료 처리 방법", at("결측 처리")],
  ["12(d)", "표본추출 전략을 고려한 분석 방법", at("기술통계와 조사설계 기반 회귀분석") + " — 가중치·층·집락, 테일러 선형화"],
  ["12(e)", "민감도 분석", at("머신러닝", "머신러닝 모형의 분류 성능") + " — 증상근접 포함 모형, 3개 알고리즘 순위 비교"],
  ["13(a)", "각 단계의 대상자 수", at("연구대상", "그림 1")],
  ["13(b)", "각 단계의 비참여 사유", at("그림 1") + " — PHQ-9 산출 불가 325명"],
  ["13(c)", "흐름도 사용", at("그림 1")],
  ["14(a)", "대상자 특성과 노출·교란변수 정보", at("연구대상자의 특성") + "; 표 3"],
  ["14(b)", "변수별 결측 대상자 수", "표 3(결측 n); 표 S1(결측 %) — " + at("연구대상자의 특성", "표 S1")],
  ["15", "결과 사건 수 또는 요약 측정치", at("연구대상자의 특성") + " — 우울 증상 기준 충족 8,704명"],
  ["16(a)", "비조정 추정치와 교란 조정 추정치, 정밀도(95% CI), 조정 변수와 이유", at("연구대상자의 특성", "변수 수준의 관련 요인") + "; 표 3(비조정), 표 6(조정 OR)"],
  ["16(b)", "연속형 변수를 범주화한 경우 경계값", "표 3; 표 6 — " + at("기술통계와 조사설계 기반 회귀분석")],
  ["16(c)", "상대위험을 절대위험으로 변환", at("신체활동과 생활요인의 조합") + " — 조정 유병률(표 8)"],
  ["17", "하위집단·상호작용·민감도 등 기타 분석", at("연령대별 차이", "신체활동과 생활요인의 조합") + "; 표 S3"],
  ["18", "목적에 비춘 주요 결과 요약", at("주요 결과")],
  ["19", "비뚤림과 부정확성을 고려한 한계", at("강점과 한계")],
  ["20", "목적, 한계, 다중분석, 유사 연구를 고려한 신중한 해석", at("선행연구와의 비교", "강점과 한계")],
  ["21", "결과의 일반화 가능성(외적 타당도)", at("강점과 한계")],
  ["22", "연구비 출처와 연구비 제공자의 역할", at("저자 노트") + " — [저자 기재 필요]"],
];

const TRIPOD = [
  ["1", "예측모형 개발·평가 연구임을 밝히고 대상 집단과 결과를 명시", "표지(제목) — " + at("저자 노트")],
  ["2", "초록(TRIPOD+AI for Abstracts)", at("국문 초록", "Abstract")],
  ["3a", "보건의료 맥락과 모형 개발 근거, 기존 모형", at("서론")],
  ["3b", "대상 집단과 모형의 의도된 목적·사용자", at("머신러닝") + " — 개인 선별 도구가 아닌 영역별 정보량 비교 도구"],
  ["3c", "사회인구집단 간 건강 불평등", at("연구대상자의 특성") + " — 표 3(성별·연령·소득별 유병률); 표 S3"],
  ["4", "연구 목적(개발/검증 여부 포함)", at("서론")],
  ["5a", "자료원, 사용 근거, 대표성", at("연구설계와 자료")],
  ["5b", "자료 수집 기간", at("연구설계와 자료")],
  ["6a", "연구 환경(일반 인구 등)", at("연구설계와 자료")],
  ["6b", "대상자 적격 기준", at("연구대상")],
  ["6c", "치료 정보와 처리", NA("일반 인구 대상 건강조사로 치료 개입 없음")],
  ["7", "자료 전처리와 품질 점검(사회인구집단 간 유사성 포함)", at("독립변수", "결측 처리")],
  ["8a", "예측 대상 결과의 정의, 평가 방법, 선택 근거", at("결과변수")],
  ["8b", "결과 평가가 주관적 해석을 요하는 경우 평가자 특성", NA("PHQ-9 응답에 따른 점수 산출로 평가자 해석 없음")],
  ["8c", "결과 평가의 눈가림", NA("결과와 예측변수를 같은 설문에서 동시에 수집")],
  ["9a", "초기 예측변수 선택 방법과 사전 선별", at("독립변수")],
  ["9b", "모든 예측변수의 정의와 측정 시점", at("독립변수") + "; 표 1; 표 S1"],
  ["9c", "예측변수 측정이 주관적 해석을 요하는 경우 평가자 특성", NA("자기보고 응답")],
  ["10", "연구 규모 결정과 충분성", at("연구대상", "머신러닝") + " — 시험셋 양성 1,813명"],
  ["11", "결측자료 처리", at("결측 처리")],
  ["12a", "자료 사용 방식(분할 등)", at("머신러닝") + " — 가구 단위 80/20, 학습셋 내 5-fold"],
  ["12b", "예측변수 처리(함수 형태, 변환, 표준화)", at("머신러닝", "독립변수")],
  ["12c", "모형 유형, 근거, 구축 단계, 하이퍼파라미터, 내부 검증", at("머신러닝")],
  ["12d", "군집 간 이질성 처리", "검토하지 않음 — 지역(시도·표본지점)별 성능 이질성은 평가하지 않음; " + at("강점과 한계")],
  ["12e", "성능 평가 지표와 그림(판별, 보정, 임상적 유용성), 모형 비교", at("머신러닝") + "; 표 4"],
  ["12f", "평가에 따른 모형 갱신(재보정 등)", NA("모형 갱신 없음")],
  ["12g", "(평가 연구) 예측 계산 방법", NA("외부 평가 연구가 아님(개발 + 내부 시험셋)")],
  ["13", "클래스 불균형 처리 여부와 이유", at("머신러닝") + " — 보정 유지를 위해 적용하지 않음"],
  ["14", "모형 공정성 접근", at("머신러닝") + " — 성별·연령대별 성능 평가; 표 S3"],
  ["15", "모형 출력과 분류 임계값", at("머신러닝") + " — 확률 출력, 임계값 미설정, 상위 10% 보조 지표"],
  ["16", "개발·평가 자료의 차이", at("머신러닝 모형의 분류 성능") + " — 같은 모집단의 가구 단위 무작위 분할, 양성률 비교"],
  ["17", "윤리 승인과 동의", at("연구윤리") + " — [IRB 정보 기재 필요]"],
  ["18a", "연구비", at("저자 노트") + " — [기재 필요]"],
  ["18b", "이해상충", at("저자 노트") + " — [기재 필요]"],
  ["18c", "프로토콜 접근", "사전 프로토콜 미작성 — 분석 결정은 저장소 decision_log에 시점별로 기록"],
  ["18d", "연구 등록", "등록하지 않음"],
  ["18e", "자료 공개", at("연구윤리") + " — 원시자료는 질병관리청 이용 절차로만 제공"],
  ["18f", "분석 코드 공개", at("연구윤리") + " — [공개 방식 기재 필요]"],
  ["19", "환자·대중 참여", "참여 없음"],
  ["20a", "대상자 흐름(결과 유무별 수)", at("그림 1")],
  ["20b", "자료원별 대상자 특성과 결측", at("연구대상자의 특성") + "; 표 3"],
  ["20c", "(평가 연구) 개발 자료와 주요 변수 분포 비교", at("머신러닝 모형의 분류 성능") + " — 학습·시험 양성률"],
  ["21", "분석별 대상자 수와 사건 수", at("그림 1") + "; 표 4 주"],
  ["22", "전체 모형 정보(재현·제3자 평가용)", at("머신러닝", "연구윤리") + " — 설정 공개, 모형 객체·코드 제공 방식은 [기재 필요]"],
  ["23a", "성능 추정치와 95% CI(주요 하위집단 포함)", at("머신러닝 모형의 분류 성능") + "; 표 4; 표 S3"],
  ["23b", "군집 간 성능 이질성 결과", NA("검토하지 않음(12d 참조)")],
  ["24", "모형 갱신 결과", NA("모형 갱신 없음")],
  ["25", "공정성을 포함한 결과의 전반적 해석", at("주요 결과", "선행연구와의 비교")],
  ["26", "한계(비대표 표본, 과적합, 결측 등)", at("강점과 한계")],
  ["27a", "입력 자료 품질이 낮거나 없을 때의 처리", NA("임상·실무 적용용 모형이 아님(개인 선별 부적합을 한계에 명시)")],
  ["27b", "사용자 상호작용과 필요 전문성", NA("배포 모형 아님")],
  ["27c", "적용 가능성과 일반화를 위한 후속 연구", at("강점과 한계", "결론") + " — 종단·중재연구 필요"],
];

const LINE = { style: BorderStyle.SINGLE, size: 6, color: "000000" };
const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const W = [900, 5600, 7500]; // 가로 A4 본문 폭에 맞춤
function table(rows) {
  const cell = (t, i, head, last) => new TableCell({
    width: { size: W[i], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    borders: { top: head ? LINE : NONE, bottom: head || last ? LINE : NONE, left: NONE, right: NONE },
    children: [new Paragraph({ spacing: { line: 260 }, children: [new TextRun({ text: t, font: FONT, size: 18, bold: head,
      highlight: t.includes("[") && t.includes("필요]") ? "yellow" : undefined })] })],
  });
  return new Table({
    width: { size: W.reduce((a, b) => a + b), type: WidthType.DXA }, columnWidths: W, layout: TableLayoutType.FIXED,
    rows: [new TableRow({ tableHeader: true, children: ["항목", "권고 내용(요약)", "원고 보고 위치(절, 쪽)"].map((t, i) => cell(t, i, true, false)) }),
      ...rows.map((r, k) => new TableRow({ cantSplit: true, children: r.map((t, i) => cell(t, i, false, k === rows.length - 1)) }))],
  });
}
const T = (t, opt = {}) => new Paragraph({ spacing: { before: opt.before || 120, after: 120 }, alignment: opt.center ? AlignmentType.CENTER : AlignmentType.LEFT,
  children: [new TextRun({ text: t, font: FONT, size: opt.size || 22, bold: opt.bold, italics: opt.italic })] });

const doc = new Document({
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
    children: [
      T("보고 지침 체크리스트 — 한국 성인의 우울 증상과 관련된 다차원 요인", { bold: true, size: 26, center: true }),
      T("쪽 번호는 manuscript_v2.1.docx를 MS Word로 PDF 변환했을 때의 쪽이다. 노란 표시는 저자가 채워야 할 항목이다.", { size: 18, italic: true }),
      T("1. STROBE — 횡단면 연구 체크리스트 (22개 항목; von Elm et al., 2007)", { bold: true, before: 240 }),
      table(STROBE),
      T("2. TRIPOD+AI 체크리스트 (27개 항목; Collins et al., 2024)", { bold: true, before: 360 }),
      table(TRIPOD),
      T("TRIPOD+AI의 D/E 구분: 이 연구는 모형 개발(D)과 같은 자료원의 가구 단위 내부 시험셋 평가이며, 외부 평가(E) 전용 항목은 해당 없음으로 표시하였다.", { size: 18, italic: true, before: 200 }),
    ],
  }],
});
Packer.toBuffer(doc).then((b) => {
  fs.writeFileSync(path.join(DIR, "strobe_tripod_checklist_v2.1.docx"), b);
  console.log(`생성: paper/strobe_tripod_checklist_v2.1.docx (STROBE ${STROBE.length}행, TRIPOD+AI ${TRIPOD.length}행)`);
});
