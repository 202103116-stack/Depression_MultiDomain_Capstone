/**
 * 중간 프로포절 발표자료 — 우울 증상의 다차원 요인 분석 (v2.1)
 * 실행: node presentation/build_proposal.js   (paper/build_paper_data.py 실행 후)
 * 산출: presentation/proposal_v2.pptx
 * 구성: docs/v2/proposal_outline.md. 수치는 paper/paper_data.json에서만 읽는다.
 */
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require(process.env.PPTX_SKILL_DIR
  ? path.join(process.env.PPTX_SKILL_DIR, "scripts", "apply_theme.js")
  : path.join(__dirname, "apply_theme.js"));

const ROOT = path.resolve(__dirname, "..");
const D = JSON.parse(fs.readFileSync(path.join(ROOT, "paper", "paper_data.json"), "utf-8"));
const N = D.n;
const OUT = path.join(__dirname, "proposal_v2.pptx");

// ---------------------------------------------------------------- 테마
const THEME = {
  name: "Depression Multidomain",
  headFontFace: "맑은 고딕",
  bodyFontFace: "맑은 고딕",
  colors: {
    dk1: "1C2B33", lt1: "FFFFFF", dk2: "1F4E5A", lt2: "EEF3F2",
    accent1: "1F4E5A", accent2: "E07A5F", accent3: "81B29A", accent4: "8A979E", accent5: "3D7D8C", accent6: "F2CC8F",
    hlink: "3D7D8C", folHlink: "6B7A80",
  },
};
const HEX = THEME.colors;
const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "우울 증상의 다차원 요인 분석 — 중간 프로포절";
pres.author = "Depression_MultiDomain_Capstone";
const C = pres.SchemeColor;
const W = 13.333, MX = 0.6, CW = W - 2 * MX;

// 숫자 형식
const f = (x, k = 3) => Number(x).toFixed(k);
const pct = (x, k = 1) => `${Number(x).toFixed(k)}%`;
const n0 = (x) => Number(x).toLocaleString("en-US");
const tint = (hex, t) => { // hex를 흰색과 섞는다(t=0 원색, 1 흰색)
  const c = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return c.map((v) => Math.round(v + (255 - v) * t).toString(16).padStart(2, "0")).join("").toUpperCase();
};

// ---------------------------------------------------------------- 레이아웃
const FOOTER = "우울 증상의 다차원 요인 분석 · 중간 프로포절";
pres.defineSlideMaster({
  title: "DARK",
  background: { color: C.text2 },
  objects: [
    { placeholder: { options: { name: "kicker", type: "body", x: MX, y: 1.55, w: CW, h: 0.4, fontSize: 14, bold: true, color: C.accent6 }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: MX, y: 2.0, w: 11.2, h: 1.9, fontSize: 36, bold: true, color: C.background1, valign: "top", align: "left" }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: MX, y: 4.1, w: 11.2, h: 2.2, fontSize: 16, color: tint(HEX.lt2, 0), valign: "top" }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: C.background1 },
  margin: [0.4, MX, 0.6, MX],
  objects: [
    { placeholder: { options: { name: "kicker", type: "body", x: MX, y: 0.35, w: CW, h: 0.35, fontSize: 12, bold: true, color: C.accent2, margin: 0 }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: MX, y: 0.7, w: CW, h: 0.95, fontSize: 28, bold: true, color: C.text2, valign: "top", align: "left", margin: 0 }, text: "" } },
    { text: { text: FOOTER, options: { x: MX, y: 7.0, w: 8, h: 0.3, fontSize: 10, color: C.accent4, margin: 0 } } },
  ],
  slideNumber: { x: 12.15, y: 7.0, w: 0.6, h: 0.3, fontSize: 10, color: C.accent4, align: "right" },
});

const content = (section, kicker, title, notes) => {
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: section });
  s.addText(kicker, { placeholder: "kicker" });
  s.addText(title, { placeholder: "title" });
  if (notes) s.addNotes(notes);
  return s;
};
const text = (s, t, o) => s.addText(t, { isTextBox: true, margin: 0, fontSize: 14, color: C.text1, valign: "top", ...o });
const card = (s, x, y, w, h, fill, name) =>
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: fill }, rectRadius: 0.08, objectName: name });
const CHART_TXT = { catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", dataLabelFontFace: "+mn-lt", legendFontFace: "+mn-lt",
  titleFontFace: "+mn-lt", catAxisLabelColor: HEX.dk1, valAxisLabelColor: HEX.accent4, dataLabelColor: HEX.dk1,
  catAxisLabelFontSize: 12, valAxisLabelFontSize: 11, dataLabelFontSize: 11, legendFontSize: 12 };

// ================================================================ 1. 표지
pres.addSection({ title: "도입" });
{
  const s = pres.addSlide({ masterName: "DARK", sectionTitle: "도입" });
  s.addText("스포츠융합산업프로젝트실습 · 중간 프로포절", { placeholder: "kicker" });
  s.addText("한국 성인의 우울 증상,\n여러 영역이 함께 관련된다", { placeholder: "title" });
  s.addText([
    { text: `2025 지역사회건강조사 성인 ${n0(N.analysis)}명 · 8개 영역 ${N.n_features}개 변수`, options: { breakLine: true } },
    { text: "머신러닝 영역 기여도 분석과 조사설계 기반 회귀분석", options: { breakLine: true } },
    { text: " ", options: { breakLine: true } },
    { text: "[팀명 · 발표자]   |   2026. 10.", options: { fontSize: 14 } },
  ], { placeholder: "body" });
  s.addNotes("2차 방향으로 전환한 연구의 중간 보고입니다. 교수님 피드백대로 우울을 심리·신체·사회·경제·환경의 여러 영역에서 함께 보았고, 오늘은 무엇을 물었고 어떻게 분석했으며 지금까지 무엇을 확인했는지 말씀드리겠습니다.");
}

// ================================================================ 2. 문제와 질문
{
  const s = content("도입", "문제와 연구 질문", "우울은 단일 요인으로 설명되지 않는다 — 그래서 네 가지를 물었다",
    "1차 연구는 걷기·근력운동과 친구 연락만 보았습니다. 교수님께서 우울을 복합적으로 보라고 하셔서, 같은 조사의 가능한 문항을 8개 영역으로 넓혔습니다. 23만 명 가운데 가중 3.76%가 PHQ-9 10점 이상이었고, 이 결과를 네 가지 질문으로 나누어 분석했습니다.");
  const stats = [[n0(N.analysis), "분석 대상 성인(명)"], [pct(N.prev_w, 2), "우울 증상 기준 충족\nPHQ-9 ≥ 10, 가중"], [`${N.n_features}개`, "8개 영역 분석 변수"]];
  stats.forEach(([v, l], i) => {
    const x = MX + i * 2.0, y = 2.05;
    text(s, v, { x, y, w: 1.9, h: 0.7, fontSize: 30, bold: true, color: C.text2 });
    text(s, l, { x, y: y + 0.72, w: 1.9, h: 0.8, fontSize: 12, color: C.accent4 });
  });
  text(s, "교수 피드백: 우울을 심리·신체·사회·경제·환경을 아우르는 복합적 시각에서 보라", { x: MX, y: 3.9, w: 5.6, h: 1.0, fontSize: 15, italic: true, color: C.text2 });
  const qs = [
    ["어떤 영역·요인이 우울과 가장 관련되는가", "ML 영역 기여도와 조정 OR의 일치"],
    ["그중 바꿀 수 있는 요인은 무엇인가", "수정 유형 A·B·C 기준으로 판정"],
    ["신체활동과 함께할 때 유리한 생활요인은", "미리 정한 규칙으로 고른 생활요인"],
    ["연령대에 따라 핵심 영역이 다른가", "19~39세 · 40~64세 · 65세 이상"],
  ];
  qs.forEach(([q, sub], i) => {
    const y = 1.95 + i * 1.2, x = 7.0;
    card(s, x, y, 5.73, 1.05, C.background2, `q${i + 1}`);
    text(s, String(i + 1), { x: x + 0.25, y: y + 0.18, w: 0.5, h: 0.7, fontSize: 26, bold: true, color: C.accent2 });
    text(s, q, { x: x + 0.85, y: y + 0.17, w: 4.7, h: 0.45, fontSize: 15, bold: true, color: C.text1 });
    text(s, sub, { x: x + 0.85, y: y + 0.6, w: 4.7, h: 0.35, fontSize: 12, color: C.accent4 });
  });
}

// ================================================================ 3. 데이터와 변수
pres.addSection({ title: "데이터와 방법" });
{
  const s = content("데이터와 방법", "데이터와 변수 구성", `조사 201개 변수에서 8개 영역 ${N.n_features}개 분석 변수를 골랐다`,
    "원시자료는 19개 조사영역, 201개 변수입니다. 그중 103개를 어떤 식으로든 사용했고, 모형에는 원시변수 86개를 66개 분석변수로 다듬어 넣었습니다. 우울 문항과 직접 겹치는 4개는 아예 뺐고, 스트레스·수면·주관적 건강처럼 PHQ-9와 개념이 겹치는 13개는 주 분석에서 분리해 비교용으로만 썼습니다. 나머지 미사용 문항은 대부분 해당자에게만 묻는 하위문항이나 지식 문항입니다.");
  // 흐름: 원시자료 → 사용 → 분석 변수 → 주 분석 / 비교
  // (201·103·86·98·4는 2026-10-26 원시자료 열 분류 결과 — docs/v2/data_dictionary_v2.md 8절의 제외 기준)
  const steps = [
    ["201개 변수", "지역사회건강조사 2025\n19개 조사영역 · 169개 문항"],
    ["86개 원시변수", "모형에 투입한 문항\n(설계·결과 문항 포함 사용 103개)"],
    [`${N.n_features}개 분석 변수`, "파생·재코딩 후\n8개 영역으로 구성"],
  ];
  steps.forEach(([big, small], i) => {
    const x = MX + i * 3.15, y = 2.05;
    card(s, x, y, 2.75, 1.9, i === 2 ? C.text2 : C.background2, `step${i + 1}`);
    text(s, big, { x: x + 0.25, y: y + 0.25, w: 2.3, h: 0.6, fontSize: 22, bold: true, color: i === 2 ? C.background1 : C.text2 });
    text(s, small, { x: x + 0.25, y: y + 0.95, w: 2.3, h: 0.8, fontSize: 12, color: i === 2 ? C.background2 : C.text1 });
    if (i < 2) s.addShape(pres.shapes.RIGHT_ARROW, { x: x + 2.82, y: y + 0.78, w: 0.28, h: 0.34, fill: { color: C.accent4 }, line: { color: C.accent4 } });
  });
  const x0 = MX + 3 * 3.15;
  card(s, x0, 2.05, 2.7, 0.88, C.accent1, "main");
  text(s, `주 분석 ${N.n_main_features}개`, { x: x0 + 0.2, y: 2.15, w: 2.4, h: 0.4, fontSize: 18, bold: true, color: C.background1 });
  text(s, "7개 영역", { x: x0 + 0.2, y: 2.55, w: 2.4, h: 0.3, fontSize: 12, color: C.background2 });
  card(s, x0, 3.07, 2.7, 0.88, tint(HEX.accent2, 0.75), "proximal");
  text(s, `증상근접 ${N.n_features - N.n_main_features}개`, { x: x0 + 0.2, y: 3.17, w: 2.4, h: 0.4, fontSize: 18, bold: true, color: C.text1 });
  text(s, "비교용으로만 사용", { x: x0 + 0.2, y: 3.57, w: 2.4, h: 0.3, fontSize: 12, color: C.text1 });
  s.addShape(pres.shapes.RIGHT_ARROW, { x: x0 - 0.33, y: 2.83, w: 0.28, h: 0.34, fill: { color: C.accent4 }, line: { color: C.accent4 } });
  // 제외 기준
  text(s, "쓰지 않은 문항과 이유", { x: MX, y: 4.45, w: 6, h: 0.4, fontSize: 16, bold: true, color: C.text2 });
  const ex = [["결과변수와 겹침 4개", "우울감 경험·상담, 스트레스 상담, EQ-5D 불안·우울 → 누수 방지"],
    ["하위·세부 문항", "고혈압·당뇨 치료·교육, 흡연량 등 → 상위 문항(진단·흡연 상태)으로 대표"],
    ["지식·인지 문항", "뇌졸중·심근경색 조기증상 인지 등 → 교육·건강정보 이해능력으로 대표"],
    ["영역 전체 제외 3개", "안전의식 · 개인위생 · 여성건강 → 우울과의 경로 근거가 약함"]];
  ex.forEach(([h, b], i) => {
    const x = MX + (i % 2) * 6.1, y = 4.95 + Math.floor(i / 2) * 0.95;
    text(s, h, { x, y, w: 5.9, h: 0.35, fontSize: 14, bold: true, color: C.text1 });
    text(s, b, { x, y: y + 0.36, w: 5.9, h: 0.5, fontSize: 12, color: C.accent4 });
  });
}

// ================================================================ 4. 분석 설계
{
  const s = content("데이터와 방법", "분석 설계", "두 가지 방법이 같은 질문을 서로 다른 각도에서 검증한다",
    "결과변수는 PHQ-9 10점 이상 하나입니다. 머신러닝은 영역을 하나씩 더하거나 빼며 어느 영역이 정보를 많이 갖는지 재고, 조사설계 회귀는 다른 요인을 모두 고정했을 때 연관의 방향과 크기를 모집단 기준으로 추정합니다. 두 방법이 같은 요인을 가리키는지가 결과의 신뢰도를 높입니다.");
  card(s, 3.67, 1.95, 6.0, 0.75, C.text2, "outcome");
  text(s, "결과변수  PHQ-9 총점 ≥ 10 (우울 증상 기준 충족)", { x: 3.67, y: 2.1, w: 6.0, h: 0.45, fontSize: 16, bold: true, color: C.background1, align: "center" });
  const cols = [
    ["머신러닝: 어느 영역이 정보를 많이 갖나", [
      "CatBoost 등 6개 알고리즘 비교", "가구 단위 학습·시험 분할(같은 가구 섞임 방지)",
      "영역 추가·제거 실험의 ΔAP + 가구 부트스트랩 95% CI", "SHAP·영역 순열 중요도로 교차 확인"]],
    ["조사설계 회귀: 다른 요인을 고정해도 남나", [
      "가중치 · 층 · 집락 반영(테일러 선형화)", `주 분석 ${N.n_main_features}개 변수 동시 조정 → 조정 OR`,
      "기준범주 = 건강한 상태(위험 쪽 OR > 1)", "신체활동 × 생활요인 조합별 조정 유병률"]],
  ];
  cols.forEach(([h, items], i) => {
    const x = MX + i * 6.2;
    card(s, x, 3.05, 5.9, 2.85, C.background2, `track${i + 1}`);
    text(s, h, { x: x + 0.3, y: 3.25, w: 5.3, h: 0.45, fontSize: 17, bold: true, color: C.text2 });
    text(s, items.map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < items.length - 1 } })),
      { x: x + 0.3, y: 3.85, w: 5.3, h: 1.9, fontSize: 14, paraSpaceAfter: 6, color: C.text1 });
  });
  text(s, "증상근접 13개 변수는 두 방법 모두 주 분석에서 빼고 넣었을 때의 변화만 따로 보고 → 순환 추론 방지",
    { x: MX, y: 6.15, w: CW, h: 0.5, fontSize: 14, color: C.accent2, bold: true });
}

// ================================================================ 5. 영역 기여
pres.addSection({ title: "주요 결과" });
{
  const dom = D.domains, DL = D.domain_labels;
  const order = ["phys", "care", "econ", "social", "behav", "env"];
  const s = content("주요 결과", "결과 ① 영역별 기여", "모든 영역이 고유한 정보를 더하고, 신체건강의 기여가 가장 크다",
    `인구 정보만 넣은 모형의 AP는 ${f(D.sets.base.catboost.ap)}입니다. 여기에 영역을 하나씩 더하면 신체건강이 +${f(dom.phys.catboost.add.d)}로 가장 크게 올렸고, 전부 넣은 모형에서 하나씩 빼도 모든 영역에서 성능이 유의하게 떨어졌습니다. 즉 어느 영역도 다른 영역으로 대체되지 않습니다. 신체건강 1위, 생활환경 최하위는 네 가지 지표에서 모두 같았습니다.`);
  s.addChart(pres.charts.BAR, [
    { name: "단독 정보량 (인구 + 영역)", labels: order.map((d) => DL[d]), values: order.map((d) => dom[d].catboost.add.d) },
    { name: "고유 기여 (전체 − 영역)", labels: order.map((d) => DL[d]), values: order.map((d) => dom[d].catboost.drop.d) },
  ], {
    x: MX, y: 1.9, w: 8.1, h: 4.9, barDir: "bar", barGrouping: "clustered", barGapWidthPct: 60,
    chartColors: [HEX.accent1, HEX.accent3], catAxisOrientation: "maxMin", valAxisMinVal: 0, valAxisMaxVal: 0.1,
    valAxisLabelFormatCode: "0.00", showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "+0.000",
    valGridLine: { color: tint(HEX.accent4, 0.75), size: 0.5 }, catGridLine: { style: "none" },
    showLegend: true, legendPos: "b", showTitle: true, title: "ΔAP (CatBoost, 시험셋)", titleFontSize: 13, titleColor: HEX.dk1, ...CHART_TXT,
  });
  const callouts = [[`+${f(dom.phys.catboost.add.d)}`, "신체건강 단독 정보량\n4가지 지표 모두 1위"], ["7 / 7", "모든 영역이 빠지면\n성능이 유의하게 떨어짐(95% CI > 0)"],
    [`${f(D.algos.catboost.full.ap)}`, `주 분석 AP (인구만 ${f(D.sets.base.catboost.ap)})`]];
  callouts.forEach(([v, l], i) => {
    const y = 2.0 + i * 1.6;
    text(s, v, { x: 9.2, y, w: 3.5, h: 0.65, fontSize: 30, bold: true, color: i === 0 ? C.accent2 : C.text2 });
    text(s, l, { x: 9.2, y: y + 0.66, w: 3.5, h: 0.75, fontSize: 13, color: C.accent4 });
  });
}

// ================================================================ 6. 바꿀 수 있는 요인
{
  const pick = (t) => {
    const seen = new Set(), out = [];
    for (const o of D.or_modifiable) if (o.mod_type === t && !seen.has(o.name)) { seen.add(o.name); out.push(o); }
    return out.slice(0, 5);
  };
  const LBL = { "식품안정성": "식품 불안정", "인지 체형": "인지 체형", "점심 후 칫솔질": "점심 결식" };
  const lab = (o) => o.label || `${LBL[o.name] || o.name}: ${o.level}`;
  const orOf = (name, level) => D.or_all.find((o) => o.name === name && o.level === level);
  const B = pick("B");
  const A = [["친구 연락", "월 1회 미만", "친구 연락: 월 1회 미만"], ["흡연", "현재흡연", "흡연: 현재흡연"], ["아침식사", "거의 안 함", "아침식사: 거의 안 함"],
    ["전자담배", "예", "전자담배: 현재 사용"], ["걷기 실천", "아니오", "걷기: 미실천"]].map(([n, l, t]) => ({ ...orOf(n, l), label: t }));
  const s = content("주요 결과", "결과 ② 바꿀 수 있는 요인", "바꿀 수 있는 요인 중 식품 불안정과 구강 문제의 연관이 가장 크다",
    "모든 변수를 동시에 조정한 회귀에서, 바꿀 수 있는 요인을 두 유형으로 나눠 보았습니다. 왼쪽은 서비스·정책·환경으로 개선할 수 있는 상태로, 식품이 자주 부족한 가구의 오즈가 3배를 넘었습니다. 오른쪽은 개인이 직접 바꿀 수 있는 행동으로, 친구와의 연락 단절, 흡연, 아침 결식이 위험 쪽이었습니다. 이 유형 구분은 제6차 국민건강증진종합계획의 분야에 맞춰 미리 정한 기준입니다.");
  const panel = (rows, x, title, color) => {
    s.addChart(pres.charts.BAR, [{ name: "조정 OR", labels: rows.map(lab), values: rows.map((o) => o.or) }], {
      x, y: 1.9, w: 6.0, h: 4.55, barDir: "bar", catAxisOrientation: "maxMin", chartColors: [color], barGapWidthPct: 55,
      valAxisMinVal: 1, valAxisMaxVal: rows[0].or > 2.5 ? 3.5 : 2.0, valAxisLabelFormatCode: "0.0",
      showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00",
      valGridLine: { color: tint(HEX.accent4, 0.75), size: 0.5 }, catGridLine: { style: "none" }, showLegend: false,
      showTitle: true, title, titleFontSize: 14, titleColor: HEX.dk1, ...CHART_TXT,
    });
  };
  panel(B, MX, "B 서비스·정책·환경으로 개선 가능 — 조정 OR", HEX.accent1);
  panel(A, MX + 6.15, "A 개인 행동 — 조정 OR", HEX.accent2);
  text(s, "OR은 7개 영역 53개 변수를 동시에 조정한 조사설계 기반 로지스틱 회귀 값(기준범주 = 건강한 상태, 모두 p < .05). B는 변수마다 위험이 가장 큰 수준, A는 대표 행동 5개",
    { x: MX, y: 6.5, w: CW, h: 0.4, fontSize: 11, color: C.accent4 });
}

// ================================================================ 7. 연령대
{
  const DL = D.domain_labels, order = ["phys", "care", "econ", "behav", "social", "env"];
  const ages = [["19-39", "19~39세"], ["40-64", "40~64세"], ["65+", "65세 이상"]];
  const s = content("주요 결과", "결과 ③ 연령대별 차이", "연령대마다 우울과 가장 관련된 영역이 다르다",
    "연령대 안에서 모형을 다시 학습해 영역별 단독 정보량을 비교했습니다. 진한 칸이 그 연령대에서 정보가 많은 영역입니다. 청년층은 건강행태가 신체건강만큼 중요했고 경제는 작았습니다. 중장년층은 경제가 가장 컸고, 65세 이상은 신체건강과 의료접근이 압도적이었습니다. 제언을 연령대별로 달리해야 하는 근거입니다.");
  const vmax = Math.max(...ages.flatMap(([k]) => order.map((d) => D.age[k][d].d)));
  const head = [{ text: "영역", options: { bold: true, color: HEX.lt1, fill: { color: HEX.dk2 }, align: "left" } },
    ...ages.map(([, l]) => ({ text: l, options: { bold: true, color: HEX.lt1, fill: { color: HEX.dk2 }, align: "center" } }))];
  const rows = order.map((d) => [{ text: DL[d], options: { bold: true, align: "left", fill: { color: HEX.lt1 } } },
    ...ages.map(([k]) => {
      const v = D.age[k][d].d, top = Math.max(...order.map((dd) => D.age[k][dd].d)) === v;
      return { text: `+${f(v)}`, options: { align: "center", bold: top, color: v / vmax > 0.6 ? HEX.lt1 : HEX.dk1, fill: { color: tint(HEX.accent1, 1 - v / vmax * 0.92) } } };
    })]);
  s.addTable([head, ...rows], { x: MX, y: 1.95, w: 7.6, colW: [2.5, 1.7, 1.7, 1.7], rowH: 0.62, fontSize: 15, fontFace: "맑은 고딕",
    border: { type: "solid", pt: 1, color: HEX.lt1 }, valign: "middle" });
  text(s, "인구 영역에 각 영역을 더했을 때의 AP 증가(LightGBM, 연령대별 재학습). 굵은 글씨 = 그 연령대의 최대", { x: MX, y: 6.4, w: 7.6, h: 0.4, fontSize: 11, color: C.accent4 });
  const msg = [["19~39세", "건강행태 ≈ 신체건강", "운동·식사·흡연 같은 생활습관이 핵심"], ["40~64세", "경제", "소득·식품안정성·경제활동이 가장 큼"], ["65세 이상", "신체건강 · 의료접근", "구강·낙상·미충족 의료가 압도적"]];
  msg.forEach(([a, b, c], i) => {
    const y = 1.95 + i * 1.5;
    card(s, 8.6, y, 4.13, 1.3, C.background2, `age${i}`);
    text(s, a, { x: 8.85, y: y + 0.15, w: 3.7, h: 0.35, fontSize: 13, color: C.accent4, bold: true });
    text(s, b, { x: 8.85, y: y + 0.47, w: 3.7, h: 0.4, fontSize: 17, bold: true, color: C.text2 });
    text(s, c, { x: 8.85, y: y + 0.87, w: 3.7, h: 0.35, fontSize: 12, color: C.text1 });
  });
}

// ================================================================ 8. 생활요인 점수
{
  const cm = D.count_summary["주 분석"];
  const loo = Object.entries(D.count_summary).filter(([k]) => k.endsWith("제외")).map(([, v]) => v.trend_or);
  const s = content("주요 결과", "결과 ④ 신체활동과 생활요인", "규칙으로 고른 생활요인은 함께 지킬수록 우울 비율이 낮다",
    `생활요인은 결과를 보고 고르지 않았습니다. 개인 행동이면서, 우울 관련 건강 생활요인 연구(Zhao 등, 2023)의 영역에 속하고, 공식 충족 기준이 있으며, 영역당 하나만 쓰는 규칙으로 정했습니다. 그 결과 담배제품 미사용, 고위험음주 아님, 아침식사, 사회적 연결 네 가지가 남았습니다. 점수는 순서대로 더한 것이 아니라 몇 개를 충족했는지 센 값입니다. 0개 ${pct(D.counts[0].prev)}에서 5개 ${pct(D.counts[D.counts.length - 1].prev)}로 단계적으로 낮아졌고, 1개 늘 때마다 오즈가 약 30% 낮았습니다. 어느 요인 하나를 빼고 다시 세도 같은 결과였습니다.`);
  text(s, "생활요인 선정 규칙 (사전 지정)", { x: MX, y: 1.9, w: 5.4, h: 0.4, fontSize: 16, bold: true, color: C.text2 });
  const rules = ["개인 행동(수정 유형 A)", "Zhao 등(2023)의 우울 관련 7개 생활 영역", "공식 지표·권고로 충족 기준이 정해짐", "영역당 대표 문항 1개", "PHQ-9와 겹치는 수면은 민감도로만"];
  text(s, rules.map((r, i) => ({ text: r, options: { bullet: { type: "number" }, breakLine: i < rules.length - 1 } })),
    { x: MX, y: 2.35, w: 5.4, h: 1.95, fontSize: 14, paraSpaceAfter: 4 });
  const chips = ["신체활동 권고(기준축)", "담배제품 미사용", "고위험음주 아님", "아침식사 주 5회+", "사회적 연결"];
  chips.forEach((c, i) => {
    const x = MX + (i % 2) * 2.75, y = 4.45 + Math.floor(i / 2) * 0.6;
    card(s, x, y, 2.6, 0.48, i === 0 ? C.text2 : C.background2, `chip${i}`);
    text(s, c, { x, y: y + 0.08, w: 2.6, h: 0.34, fontSize: 13, bold: true, align: "center", color: i === 0 ? C.background1 : C.text2 });
  });
  text(s, "이웃 신뢰·동네 안전은 생활습관이 아닌 맥락 요인 → 부록으로 분리", { x: MX, y: 6.3, w: 5.4, h: 0.45, fontSize: 12, color: C.accent4 });
  s.addChart(pres.charts.BAR, [{ name: "조정 유병률(%)", labels: D.counts.map((c) => c.k), values: D.counts.map((c) => c.prev) }], {
    x: 6.4, y: 1.9, w: 6.33, h: 4.0, barDir: "col", chartColors: [HEX.accent1], barGapWidthPct: 45,
    valAxisMinVal: 0, valAxisMaxVal: 10, valAxisLabelFormatCode: "0", showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0\"%\"",
    valGridLine: { color: tint(HEX.accent4, 0.75), size: 0.5 }, catGridLine: { style: "none" }, showLegend: false,
    showTitle: true, title: "충족한 건강 생활요인 수별 조정 유병률(%)", titleFontSize: 13, titleColor: HEX.dk1, ...CHART_TXT,
  });
  text(s, [{ text: `1개 늘 때마다 OR ${f(cm.trend_or, 2)}`, options: { bold: true, color: C.accent2, breakLine: true } },
    { text: `하나씩 빼고 다시 세도 ${f(Math.min(...loo), 2)}~${f(Math.max(...loo), 2)} · 인구·경제·신체건강 조정`, options: { fontSize: 12, color: C.accent4 } }],
    { x: 6.4, y: 6.0, w: 6.33, h: 0.75, fontSize: 16 });
}

// ================================================================ 9. 선행연구 대비
pres.addSection({ title: "차별점과 해석" });
{
  const op = D.operating_points.find((o) => o.rule.includes("Han & Park"));
  const cb = D.algos.catboost.full;
  const s = content("차별점과 해석", "선행연구 대비", "같은 조사를 쓴 선행연구보다 해석의 근거를 단단하게 만들었다",
    `Han과 Park(2025)은 2022년 같은 조사로 우울 위험 예측모형을 만들었고, 스트레스와 주관적 건강을 가장 큰 위험요인으로 보고했습니다. 그런데 두 변수는 PHQ-9 문항과 겹칩니다. 저희는 이런 변수를 빼고도 ROC-AUC가 ${f(cb.auc)}로 비슷했고, 선행연구와 같은 비율인 18.4%를 고위험으로 판정하면 민감도 ${pct(op.sens)}, 정밀도 ${pct(op.ppv)}로 같은 수준이었습니다. 여기에 변수 범위, 가구 단위 분할, 보정 지표, 조사설계 회귀를 보완했습니다.`);
  const H = (t) => ({ text: t, options: { bold: true, color: HEX.lt1, fill: { color: HEX.dk2 } } });
  const rows = [
    ["자료", "지역사회건강조사 2022 · 227,366명", `지역사회건강조사 2025 · ${n0(N.analysis)}명`],
    ["변수", "18개 → ML 중요도로 14개 선별", `8개 영역 ${N.n_features}개 · 선정·수정 유형 기준 사전 지정`],
    ["스트레스·주관적 건강", "핵심 위험요인으로 투입(OR 9.65, 3.38)", "PHQ-9와 겹쳐 주 분석에서 분리"],
    ["학습·시험 분할", "개인 단위 무작위 70/30 + SMOTE", "가구 단위 분할(가구원 섞임 방지)"],
    ["성능 지표", "Accuracy·macro F1·ROC-AUC 0.841", `AP ${f(cb.ap)} · ROC-AUC ${f(cb.auc)} · 보정 기울기 ${f(cb.slope, 2)}`],
    ["같은 판정 비율(18.4%)", "민감도 약 67% · 정밀도 약 14% (역산)", `민감도 ${pct(op.sens)} · 정밀도 ${pct(op.ppv)}`],
    ["회귀", "가중 로지스틱 회귀", "가중치·층·집락 반영, 53개 동시 조정"],
  ].map((r) => [{ text: r[0], options: { bold: true, fill: { color: HEX.lt2 } } }, { text: r[1] }, { text: r[2], options: { bold: true, color: HEX.dk2 } }]);
  s.addTable([[H(""), H("Han & Park (2025, JKDISS)"), H("이 연구 (v2.1)")], ...rows], {
    x: MX, y: 1.9, w: CW, colW: [2.6, 4.5, 5.03], rowH: 0.56, fontSize: 14, fontFace: "맑은 고딕", valign: "middle",
    color: HEX.dk1, border: { type: "solid", pt: 0.75, color: tint(HEX.accent4, 0.6) },
  });
  text(s, "조사 연도와 분할 방식이 달라 성능 수치는 엄밀한 일대일 비교가 아니다", { x: MX, y: 6.45, w: CW, h: 0.4, fontSize: 11, color: C.accent4 });
}

// ================================================================ 10. 성능 해석
{
  const cb = D.algos.catboost.full, base = N.test_y1 / N.test;
  const s80 = D.operating_points.find((o) => o.rule === "민감도 80%");
  const s = content("차별점과 해석", "모형 성능을 읽는 법", "이 모형은 개인 선별 도구가 아니라 영역별 정보량을 재는 도구다",
    `AP ${f(cb.ap)}는 아무 정보 없이 찍을 때(${f(base)})보다 약 ${Math.round(cb.ap / base)}배 높아 모형이 실제 신호를 학습했다는 뜻입니다. 그래서 영역 비교와 SHAP 해석을 믿을 수 있습니다. 하지만 선별 도구로 쓰려면 이야기가 다릅니다. 우울군의 80%를 잡으려면 1만 명 중 ${n0(s80.per10k.flagged)}명을 고위험으로 찍어야 하고, 그중 ${n0(s80.per10k.fp)}명은 헛경보입니다. 무엇보다 결과변수가 PHQ-9 자체라서, 9문항을 직접 묻는 편이 더 싸고 정확합니다.`);
  const stats = [[f(cb.ap), `AP · 무작위 찍기 ${f(base)}의 약 ${Math.round(cb.ap / base)}배`], [f(cb.auc), "ROC-AUC · 판별력 우수 구간"], [f(cb.slope, 2), "보정 기울기 · 1에 가까울수록 정확"]];
  stats.forEach(([v, l], i) => {
    const x = MX + i * 4.1;
    text(s, v, { x, y: 1.95, w: 3.8, h: 0.8, fontSize: 40, bold: true, color: C.text2 });
    text(s, l, { x, y: 2.8, w: 3.8, h: 0.5, fontSize: 13, color: C.accent4 });
  });
  text(s, `민감도 80% 기준으로 1만 명에게 적용하면 (실제 우울 약 ${n0(Math.round(base * 10000))}명)`, { x: MX, y: 3.65, w: CW, h: 0.4, fontSize: 16, bold: true, color: C.text2 });
  const flow = [[n0(s80.per10k.flagged), "고위험 판정", C.background2, C.text2], [n0(s80.per10k.tp), "실제 우울을 잡음", tint(HEX.accent3, 0.6), C.text1],
    [n0(s80.per10k.fp), "헛경보", tint(HEX.accent2, 0.75), C.text1], [n0(s80.per10k.fn), "놓친 우울", tint(HEX.accent2, 0.5), C.text1]];
  flow.forEach(([v, l, fill, col], i) => {
    const x = MX + i * 3.06;
    card(s, x, 4.2, 2.85, 1.3, fill, `flow${i}`);
    text(s, v, { x: x + 0.25, y: 4.32, w: 2.4, h: 0.6, fontSize: 28, bold: true, color: col });
    text(s, l, { x: x + 0.25, y: 4.95, w: 2.4, h: 0.4, fontSize: 13, color: col });
  });
  text(s, "결과변수가 PHQ-9 점수 자체 → 개인 판정은 PHQ-9 9문항이 더 싸고 정확. 머신러닝의 역할은 영역 간 정보량 비교",
    { x: MX, y: 5.85, w: CW, h: 0.6, fontSize: 15, bold: true, color: C.accent2 });
}

// ================================================================ 11. 제언
pres.addSection({ title: "제언과 계획" });
{
  const sc = D.combos.find((c) => c.partner === "사회적 연결");
  const s = content("제언과 계획", "제언과 스포츠산업 시사점", "운동은 사람·생활습관과 함께할 때 우울 비율이 가장 낮다",
    "횡단면 자료라 인과를 말할 수는 없지만, 바꿀 수 있고 관련이 큰 요인을 근거로 세 가지를 제안합니다. 신체활동과 사회적 연결을 함께 충족한 집단의 조정 유병률이 가장 낮은 축이었고, 상호작용이 없어 효과가 더해지는 구조였습니다. 생활체육 프로그램을 운동 종목만이 아니라 교류의 장으로 설계할 근거가 됩니다.");
  const recs = [
    ["교류형 운동", `신체활동 + 사회적 연결 동시 충족 시 조정 유병률 ${pct(sc.prev_both * 100, 2)} (둘 다 아님 ${pct(sc.prev_neither * 100, 2)})`, "동네 걷기 모임·동호회처럼 사람과 함께하는 형태"],
    ["생활 단위 실천", `건강 생활요인 0개 ${pct(D.counts[0].prev)} → 5개 ${pct(D.counts[D.counts.length - 1].prev)}`, "운동·아침식사·금연·절주를 함께"],
    ["연령별 맞춤", "청년 생활습관 · 중장년 경제 · 노년 신체건강과 의료접근", "치과 진료, 낙상 예방, 식품 지원을 정신건강과 연계"],
  ];
  recs.forEach(([h, ev, act], i) => {
    const x = MX + i * 4.1;
    card(s, x, 1.95, 3.85, 3.3, C.background2, `rec${i}`);
    text(s, String(i + 1), { x: x + 0.3, y: 2.1, w: 0.6, h: 0.6, fontSize: 28, bold: true, color: C.accent2 });
    text(s, h, { x: x + 0.3, y: 2.75, w: 3.3, h: 0.45, fontSize: 19, bold: true, color: C.text2 });
    text(s, ev, { x: x + 0.3, y: 3.3, w: 3.3, h: 0.95, fontSize: 13, color: C.text1 });
    text(s, act, { x: x + 0.3, y: 4.3, w: 3.3, h: 0.8, fontSize: 13, color: C.accent4 });
  });
  card(s, MX, 5.5, CW, 1.15, C.text2, "industry");
  text(s, [{ text: "스포츠산업 시사점  ", options: { bold: true, color: C.accent6 } },
    { text: "생활체육 시설·동호회는 운동을 제공하는 동시에 이웃·친구 관계를 만드는 장이 될 수 있다. 결합 프로그램의 효과는 중재연구로 검증할 과제", options: { color: C.background1 } }],
    { x: MX + 0.35, y: 5.68, w: CW - 0.7, h: 0.8, fontSize: 15, valign: "middle" });
}

// ================================================================ 12. 한계와 일정
{
  const s = content("제언과 계획", "한계와 남은 일정", "한계를 분명히 하고 피드백을 반영해 마무리한다",
    "가장 큰 한계는 횡단면 자료라는 점입니다. 우울해서 운동이나 교류가 줄었을 가능성을 배제할 수 없습니다. 모든 변수가 자기보고이고, 2025년 조사에는 좌식행동 문항이 없어 생활요인 하나를 쓰지 못했습니다. 남은 기간에는 오늘 받을 피드백을 반영해 분석을 확정하고 논문을 마무리하겠습니다.");
  const lims = [["횡단면 자료", "역인과 가능성 → 모든 결과를 '관련 요인'으로 서술"], ["자기보고 측정", "PHQ-9 기준 충족은 임상 진단이 아님"],
    ["측정되지 않은 요인", "좌식행동 문항 없음, 식생활은 아침식사로 대리"], ["청년층 낮은 성능", "AP가 가장 낮아 조사 밖 요인의 영향 가능"]];
  text(s, "한계", { x: MX, y: 1.9, w: 6, h: 0.4, fontSize: 18, bold: true, color: C.text2 });
  lims.forEach(([h, b], i) => {
    const y = 2.45 + i * 1.0;
    text(s, h, { x: MX, y, w: 5.9, h: 0.38, fontSize: 15, bold: true, color: C.text1 });
    text(s, b, { x: MX, y: y + 0.4, w: 5.9, h: 0.45, fontSize: 13, color: C.accent4 });
  });
  text(s, "남은 일정", { x: 7.0, y: 1.9, w: 5.7, h: 0.4, fontSize: 18, bold: true, color: C.text2 });
  const steps = [["완료", "분석 v2.1 · 논문 초안 v2.1 (42쪽, STROBE·TRIPOD+AI 대응표)"], ["다음", "중간 프로포절 피드백을 분석·원고에 반영"],
    ["다음", "저자 기재 항목(IRB 심의면제 확인, 코드 공개 방식) 확정"], ["최종", "논문 최종본 제출과 최종 발표"]];
  steps.forEach(([tag, b], i) => {
    const y = 2.45 + i * 1.0;
    card(s, 7.0, y, 1.05, 0.5, tag === "완료" ? C.accent3 : tag === "최종" ? C.accent2 : C.background2, `tag${i}`);
    text(s, tag, { x: 7.0, y: y + 0.09, w: 1.05, h: 0.34, fontSize: 13, bold: true, align: "center", color: tag === "다음" ? C.text2 : C.background1 });
    text(s, b, { x: 8.25, y: y + 0.08, w: 4.48, h: 0.8, fontSize: 14, color: C.text1 });
  });
}

// ================================================================ 13. 정리
{
  const s = pres.addSlide({ masterName: "DARK", sectionTitle: "제언과 계획" });
  s.addText("정리", { placeholder: "kicker" });
  s.addText("우울 증상은\n여러 영역이 함께 관련되는 복합 현상이다", { placeholder: "title" });
  s.addText([
    { text: "모든 영역이 고유한 정보를 더하며, 신체건강의 기여가 가장 크다", options: { bullet: true, breakLine: true } },
    { text: "바꿀 수 있는 요인: 식품 불안정·구강 문제·미충족 의료, 그리고 사회적 연결·흡연·아침 결식", options: { bullet: true, breakLine: true } },
    { text: "신체활동은 다른 생활습관과 함께 지킬수록 우울 증상 비율이 단계적으로 낮다", options: { bullet: true, breakLine: true } },
    { text: " ", options: { breakLine: true } },
    { text: "질의응답", options: { bold: true, color: C.accent6 } },
  ], { placeholder: "body", paraSpaceAfter: 8 });
  s.addNotes("세 문장으로 정리하겠습니다. 질문 주시면 부록 자료로 답변드리겠습니다.");
}

// ================================================================ 부록
pres.addSection({ title: "부록" });
{
  const DL = D.domain_labels, ks = ["demo", "econ", "phys", "behav", "social", "env", "care", "proximal"];
  const s = content("부록", "부록 A1", "영역별 변수 구성과 수정 유형 — 바꿀 수 있는 요인의 판정 기준",
    "수정 유형은 제6차 국민건강증진종합계획의 분야와 대응시켜 정했습니다. A는 본인이 고르는 행동, B는 제도나 지역사회 개입으로 개선할 수 있는 현재 상태, C는 나이·성별·진단처럼 바꿀 수 없는 것입니다.");
  const H = (t) => ({ text: t, options: { bold: true, color: HEX.lt1, fill: { color: HEX.dk2 }, align: "center" } });
  const rows = ks.map((k) => {
    const vs = D.variables.filter((v) => v.domain === k);
    const c = (t) => String(vs.filter((v) => v.mod_type === t).length);
    return [{ text: DL[k], options: { bold: true, align: "left" } }, String(vs.length), c("A"), c("B"), c("C")];
  });
  s.addTable([[H("영역"), H("변수"), H("A 개인 행동"), H("B 서비스·정책·환경"), H("C 바꿀 수 없음")], ...rows], {
    x: MX, y: 1.9, w: 7.9, colW: [2.05, 0.75, 1.4, 1.9, 1.8], rowH: 0.47, fontSize: 14, fontFace: "맑은 고딕", align: "center", valign: "middle",
    color: HEX.dk1, border: { type: "solid", pt: 0.75, color: tint(HEX.accent4, 0.6) },
  });
  const defs = [["A 개인 행동", "신체활동, 흡연, 음주, 식생활, 칫솔질, 연락·사회활동, 검진·접종, 수면"],
    ["B 서비스·정책·환경", "소득·식품안정성·경제활동, 체중·구강·낙상, 미충족 의료, 건강정보 이해능력, 동네 환경·이웃 신뢰"],
    ["C 바꿀 수 없음", "나이, 성별, 교육, 혼인, 세대유형, 만성질환 진단, 치매환자 가족, 지역·주택유형"]];
  defs.forEach(([h, b], i) => {
    const y = 1.95 + i * 1.45;
    text(s, h, { x: 8.9, y, w: 3.83, h: 0.4, fontSize: 15, bold: true, color: C.text2 });
    text(s, b, { x: 8.9, y: y + 0.42, w: 3.83, h: 0.9, fontSize: 13, color: C.text1 });
  });
  text(s, "근거: 제6차 국민건강증진종합계획(HP2030) — 건강생활 실천 → A, 비만·손상·건강정보 이해·지역사회 자원 → B", { x: MX, y: 6.45, w: CW, h: 0.4, fontSize: 11, color: C.accent4 });
}
{
  const LF = D.lifestyle_prev;
  const s = content("부록", "부록 A2", "생활요인 선정 대응표 — Zhao 등(2023)의 7개 건강 생활 영역",
    "선행연구가 우울과 관련된 건강 생활요인으로 정의한 7개 영역에 조사 문항을 하나씩 대응시켰습니다. 좌식행동은 문항이 없어 빠졌고, 수면은 PHQ-9 수면 문항과 겹쳐 민감도 분석으로만 썼습니다.");
  const H = (t) => ({ text: t, options: { bold: true, color: HEX.lt1, fill: { color: HEX.dk2 } } });
  const rows = [
    ["신체활동", "신체활동 권고 충족 (기준축)", "유산소(걷기 또는 중강도 이상) + 근력 주 2일 이상", LF["신체활동 권고 충족"]],
    ["흡연", "담배제품 현재 미사용", "궐련·전자담배 모두 현재 사용 아님", LF["담배제품 미사용"]],
    ["음주", "고위험음주 아님", "주 2회 이상 & 1회 남 7잔·여 5잔 이상이 아님", LF["고위험음주 아님"]],
    ["식생활", "아침식사 주 5회 이상", "지침서 아침식사 실천율(식품군 문항 없어 대리)", LF["아침식사 주 5회 이상"]],
    ["사회적 연결", "사회적 연결", "고립 지수 0~1점(1인 가구·드문 연락·사회활동 없음)", LF["사회적 연결"]],
    ["수면", "주중 7~9시간 (민감도)", "증상근접 — 주 점수에서 제외", LF["주중 수면 7~9시간"]],
    ["좌식행동", "–", "2025년 조사에 문항 없음", null],
  ].map((r) => [{ text: r[0], options: { bold: true } }, r[1], r[2], { text: r[3] == null ? "–" : pct(r[3]), options: { align: "center" } }]);
  s.addTable([[H("생활 영역"), H("사용 문항"), H("충족 기준"), H("충족률(가중)")], ...rows], {
    x: MX, y: 1.9, w: CW, colW: [1.9, 3.3, 5.33, 1.6], rowH: 0.58, fontSize: 14, fontFace: "맑은 고딕", valign: "middle",
    color: HEX.dk1, border: { type: "solid", pt: 0.75, color: tint(HEX.accent4, 0.6) },
  });
}
{
  const s = content("부록", "부록 A3", "점수 민감도 — 어느 요인 하나를 빼도 단계적 감소가 유지된다",
    "특정 요인 하나가 결과를 끌고 가는지 보려고 요인을 하나씩 뺀 점수 다섯 가지와 수면을 더한 점수를 다시 계산했습니다. 1점당 오즈비가 모두 0.65에서 0.72 사이로 비슷했습니다.");
  const H = (t) => ({ text: t, options: { bold: true, color: HEX.lt1, fill: { color: HEX.dk2 }, align: "center" } });
  const rows = Object.entries(D.count_summary).map(([k, v]) => {
    const r = D.count_sens.filter((x) => x.score === k);
    return [{ text: k, options: { bold: k === "주 분석", align: "left" } }, String(v.n_factors), `${f(v.trend_or, 2)} [${f(v.trend_lo, 2)}, ${f(v.trend_hi, 2)}]`,
      `${r[0].k} ${pct(r[0].prev)}`, `${r[r.length - 1].k} ${pct(r[r.length - 1].prev)}`];
  });
  s.addTable([[H("점수"), H("요인 수"), H("1점당 OR [95% CI]"), H("최저 점수 유병률"), H("최고 점수 유병률")], ...rows], {
    x: MX, y: 1.9, w: CW, colW: [3.3, 1.3, 2.9, 2.3, 2.33], rowH: 0.56, fontSize: 14, fontFace: "맑은 고딕", align: "center", valign: "middle",
    color: HEX.dk1, border: { type: "solid", pt: 0.75, color: tint(HEX.accent4, 0.6) },
  });
  text(s, "모두 인구·경제·신체건강 조정 조사설계 기반 회귀. 양 끝 점수가 1,000명 미만이면 안쪽 점수와 합침(수면 포함 점수의 0~1점)", { x: MX, y: 6.45, w: CW, h: 0.4, fontSize: 11, color: C.accent4 });
}
{
  const s = content("부록", "부록 A4", "임계값을 정하면 — 민감도와 정밀도는 맞바꾸는 관계다",
    "모형을 실제 판정에 쓴다면 목적에 따라 임계값을 정해야 합니다. 시험셋을 가구 단위로 반으로 나눠 한쪽에서 임계값을 정하고 다른 쪽에서 평가했습니다.");
  const H = (t) => ({ text: t, options: { bold: true, color: HEX.lt1, fill: { color: HEX.dk2 }, align: "center" } });
  const rows = D.operating_points.map((o) => [{ text: o.rule, options: { align: "left", bold: o.rule.includes("Han") } }, f(o.thr, 3), pct(o.flag),
    pct(o.sens), pct(o.spec), pct(o.ppv), n0(o.per10k.fn)]);
  s.addTable([[H("임계값 기준"), H("임계 확률"), H("고위험 판정"), H("민감도"), H("특이도"), H("정밀도"), H("놓친 우울/1만 명")], ...rows], {
    x: MX, y: 1.9, w: CW, colW: [3.6, 1.3, 1.5, 1.3, 1.3, 1.3, 1.83], rowH: 0.6, fontSize: 14, fontFace: "맑은 고딕", align: "center", valign: "middle",
    color: HEX.dk1, border: { type: "solid", pt: 0.75, color: tint(HEX.accent4, 0.6) },
  });
  text(s, "CatBoost 주 분석, 시험셋 46,528명. Han & Park(2025)의 판정 비율 18.4%는 그 논문의 정확도·macro 재현율·시험셋 인원에서 역산", { x: MX, y: 6.45, w: CW, h: 0.4, fontSize: 11, color: C.accent4 });
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("생성:", OUT);
})();
