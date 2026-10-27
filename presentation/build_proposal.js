/**
 * 중간 프로포절 발표자료 — 우울 증상의 다차원 요인 분석 (v2.1)
 * 실행: node presentation/build_proposal.js   (paper/build_paper_data.py 실행 후)
 * 산출: presentation/proposal_v2.pptx
 * 구성: docs/v2/proposal_outline.md. 수치는 paper/paper_data.json에서만 읽는다.
 * 디자인: 4주차 14조 미션D 발표자료의 체계(장 표시 알약, 둥근 카드, 파스텔 강조, 맑은 고딕)를 따른다.
 */
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require(path.join(__dirname, "apply_theme.js"));

const ROOT = path.resolve(__dirname, "..");
const D = JSON.parse(fs.readFileSync(path.join(ROOT, "paper", "paper_data.json"), "utf-8"));
const N = D.n;
const OUT = path.join(__dirname, "proposal_v2.pptx");

// ---------------------------------------------------------------- 테마 (미션D 발표자료와 같은 팔레트)
const THEME = {
  name: "Mission D Clean",
  headFontFace: "맑은 고딕",
  bodyFontFace: "맑은 고딕",
  colors: {
    dk1: "1D2430", lt1: "FFFFFF", dk2: "2A3342", lt2: "F3F5F8",
    accent1: "1F8A5B", accent2: "2F5FB3", accent3: "A86400", accent4: "C2412D", accent5: "5B6472", accent6: "7A8699",
    hlink: "2F5FB3", folHlink: "7A8699",
  },
};
const H = THEME.colors;
// 파스텔 배경·보조색(테마 밖 보조 톤)
const P = { green: "DDF3E8", blue: "E3ECFB", amber: "FDEBC8", red: "FBE0DA", line: "E3E6EA", muted: "6B7280", soft: "A9B2C0", dot: "F2B04C", mint: "5BC596" };

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "우울 증상의 다차원 요인 분석 — 중간 프로포절";
pres.author = "Depression_MultiDomain_Capstone";
const MX = 0.6, CW = 12.133;

const f = (x, k = 3) => Number(x).toFixed(k);
const pct = (x, k = 1) => `${Number(x).toFixed(k)}%`;
const n0 = (x) => Number(x).toLocaleString("en-US");

// ---------------------------------------------------------------- 레이아웃
const CHAPTERS = ["1  무엇을 물었나", "2  무엇을 찾았나", "3  그래서 무엇인가"];
const FOOT = "스포츠융합산업프로젝트실습 · 중간 프로포절 · 2025 지역사회건강조사 원시자료(성인 231,290명)";
const pill = (text, x, active, dark) => ({
  text: { text, options: {
    shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.18, x, y: 0.32, w: 2.1, h: 0.36, align: "center", valign: "middle",
    fontSize: 12, bold: active, margin: 0,
    fill: { color: active ? (dark ? H.lt1 : H.dk1) : (dark ? H.dk2 : H.lt2) },
    color: active ? (dark ? H.dk1 : H.lt1) : (dark ? P.soft : H.accent5),
    line: { color: active ? (dark ? H.lt1 : H.dk1) : (dark ? H.dk2 : H.lt2) } } },
});
const chapterLayout = (name, active, dark) => pres.defineSlideMaster({
  title: name,
  background: { color: dark ? H.dk1 : H.lt1 },
  margin: [0.4, MX, 0.6, MX],
  objects: [
    ...CHAPTERS.map((c, i) => pill(c, MX + i * 2.2, i === active, dark)),
    { text: { text: "중간 프로포절", options: { x: 9.73, y: 0.32, w: 3.0, h: 0.36, align: "right", valign: "middle", fontSize: 12, color: dark ? P.soft : H.accent5, margin: 0 } } },
    { placeholder: { options: { name: "title", type: "title", x: MX, y: 0.86, w: CW, h: 0.8, fontSize: 28, bold: true, color: dark ? H.lt1 : H.dk1, align: "left", valign: "middle", margin: 0 }, text: "" } },
    { text: { text: FOOT, options: { x: MX, y: 7.02, w: 9.0, h: 0.3, fontSize: 10, color: dark ? P.soft : P.muted, margin: 0 } } },
  ],
  slideNumber: { x: 12.23, y: 7.02, w: 0.5, h: 0.3, fontSize: 10, color: dark ? P.soft : P.muted, align: "right" },
});
chapterLayout("CH1", 0, false);
chapterLayout("CH2", 1, false);
chapterLayout("CH3", 2, false);
chapterLayout("CH3_DARK", 2, true);
pres.defineSlideMaster({
  title: "APPX", background: { color: H.lt1 }, margin: [0.4, MX, 0.6, MX],
  objects: [
    { text: { text: "부록", options: { shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.18, x: MX, y: 0.32, w: 1.2, h: 0.36, align: "center", valign: "middle", fontSize: 12, bold: true, margin: 0, fill: { color: H.lt2 }, color: H.accent5, line: { color: H.lt2 } } } },
    { text: { text: "질의응답 대비 자료", options: { x: 9.73, y: 0.32, w: 3.0, h: 0.36, align: "right", valign: "middle", fontSize: 12, color: H.accent5, margin: 0 } } },
    { placeholder: { options: { name: "title", type: "title", x: MX, y: 0.86, w: CW, h: 0.8, fontSize: 26, bold: true, color: H.dk1, align: "left", valign: "middle", margin: 0 }, text: "" } },
    { text: { text: FOOT, options: { x: MX, y: 7.02, w: 9.0, h: 0.3, fontSize: 10, color: P.muted, margin: 0 } } },
  ],
  slideNumber: { x: 12.23, y: 7.02, w: 0.5, h: 0.3, fontSize: 10, color: P.muted, align: "right" },
});
pres.defineSlideMaster({ title: "COVER", background: { color: H.dk1 }, objects: [] });

// ---------------------------------------------------------------- 그리기 도구
const slide = (master, section, title, notes) => {
  const s = pres.addSlide({ masterName: master, sectionTitle: section });
  if (title) s.addText(title, { placeholder: "title" });
  if (notes) s.addNotes(notes);
  return s;
};
const T = (s, t, o) => s.addText(t, { isTextBox: true, margin: 0, fontSize: 14, color: H.dk1, valign: "top", ...o });
const box = (s, x, y, w, h, fill, o = {}) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  x, y, w, h, rectRadius: 0.1, fill: { color: fill }, line: { color: o.line || fill, width: o.lineW || 0.75 }, objectName: o.name });
const tag = (s, text, x, y, fill, color, w) => s.addText(text, { isTextBox: true, shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.15,
  x, y, w: w || Math.max(0.9, text.length * 0.17 + 0.4), h: 0.32, align: "center", valign: "middle", fontSize: 12, bold: true, margin: 0,
  fill: { color: fill }, color, line: { color: fill } });
const circleNum = (s, n, x, y, fill, color, d = 0.42) => s.addText(String(n), { isTextBox: true, shape: pres.shapes.OVAL, x, y, w: d, h: d,
  align: "center", valign: "middle", fontSize: 14, bold: true, margin: 0, fill: { color: fill }, color, line: { color: fill } });
const readBar = (s, label, text, y = 6.28) => {
  box(s, MX, y, CW, 0.52, P.amber);
  T(s, [{ text: `${label}   `, options: { bold: true, color: H.accent3 } }, { text, options: { color: H.dk1 } }],
    { x: MX + 0.25, y, w: CW - 0.5, h: 0.52, fontSize: 13, valign: "middle" });
};
const CHART = {
  catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", dataLabelFontFace: "+mn-lt", legendFontFace: "+mn-lt", titleFontFace: "+mn-lt",
  catAxisLabelColor: H.dk1, valAxisLabelColor: H.accent5, dataLabelColor: H.dk1, catAxisLabelFontSize: 12, valAxisLabelFontSize: 11,
  dataLabelFontSize: 11, legendFontSize: 12, valGridLine: { color: P.line, size: 0.5 }, catGridLine: { style: "none" },
  catAxisLineShow: false, valAxisLineShow: false,
};

// ================================================================ 1. 표지
pres.addSection({ title: "도입" });
{
  const s = slide("COVER", "도입", null, "2차 방향으로 전환한 연구의 중간 보고입니다. 교수님 피드백대로 우울을 심리·신체·사회·경제·환경 여러 영역에서 함께 보았고, 무엇을 물었는지, 무엇을 찾았는지, 그래서 무엇을 제안하는지 세 묶음으로 말씀드리겠습니다.");
  T(s, "스포츠융합산업프로젝트실습 · 중간 프로포절", { x: MX, y: 0.75, w: 10, h: 0.4, fontSize: 15, color: P.soft });
  T(s, [{ text: "한국 성인의 우울 증상,", options: { breakLine: true } }, { text: "여러 영역이 함께 관련된다" }], { x: MX, y: 1.2, w: CW, h: 1.55, fontSize: 40, bold: true, color: H.lt1, valign: "middle" });
  T(s, `2025 지역사회건강조사 성인 ${n0(N.analysis)}명 · 8개 영역 ${N.n_features}개 변수 · 머신러닝과 조사설계 회귀`, { x: MX, y: 2.9, w: CW, h: 0.5, fontSize: 20, color: H.lt2 });
  [["무엇을 물었나", "문제 · 데이터 · 설계"], ["무엇을 찾았나", "영역 · 요인 · 연령 · 생활요인"], ["그래서 무엇인가", "차별점 · 제언 · 한계"]].forEach(([a, b], i) => {
    const x = MX + i * 3.95;
    box(s, x, 3.85, 3.7, 1.35, H.dk2);
    circleNum(s, i + 1, x + 0.35, 4.12, H.lt1, H.dk1);
    T(s, a, { x: x + 0.95, y: 4.05, w: 2.6, h: 0.45, fontSize: 20, bold: true, color: H.lt1 });
    T(s, b, { x: x + 0.95, y: 4.52, w: 2.6, h: 0.4, fontSize: 13, color: P.soft });
  });
  T(s, [{ text: "[팀명]   ", options: { bold: true, color: H.lt1 } }, { text: "[발표자]", options: { color: H.lt2 } }], { x: MX, y: 5.75, w: 8, h: 0.45, fontSize: 18 });
  T(s, "결과는 횡단면 자료의 관련성이며 인과 효과가 아닙니다. PHQ-9 10점 이상은 임상 진단이 아니라 우울 증상 기준 충족입니다.", { x: MX, y: 6.55, w: CW, h: 0.35, fontSize: 11, color: P.soft });
}

// ================================================================ 2. 문제와 질문
pres.addSection({ title: "1 무엇을 물었나" });
{
  const s = slide("CH1", "1 무엇을 물었나", "우울은 한 가지 원인으로 설명되지 않는다",
    "1차 연구는 걷기·근력운동과 친구 연락만 보았습니다. 교수님께서 우울을 복합적으로 보라고 하셔서 같은 조사의 문항을 8개 영역으로 넓혔고, 질문을 네 가지로 나눴습니다. 분석 전에 두 가지 원칙을 정했습니다. PHQ-9와 겹치는 변수는 주 분석에서 빼고, 결과는 인과가 아니라 관련성으로만 말합니다.");
  box(s, MX, 1.9, 6.0, 1.95, H.lt2);
  T(s, "출발점", { x: MX + 0.25, y: 2.05, w: 3, h: 0.3, fontSize: 12, bold: true, color: H.accent5 });
  [["1차 연구", "걷기·근력운동 조합 × 친구 연락"], ["교수 피드백", "심리·신체·사회·경제·환경의 복합적 시각"], ["2차 방향", `8개 영역 ${N.n_features}개 변수를 한 번에 비교`]].forEach(([a, b], i) => {
    T(s, a, { x: MX + 0.25, y: 2.45 + i * 0.42, w: 1.4, h: 0.35, fontSize: 14, bold: true, color: H.accent5 });
    T(s, b, { x: MX + 1.7, y: 2.45 + i * 0.42, w: 4.2, h: 0.35, fontSize: 14 });
  });
  [[P.blue, H.accent2, "분석 대상", n0(N.analysis), "명 · 만 19세 이상 성인"], [P.green, H.accent1, "우울 증상 기준 충족", pct(N.prev_w, 2), "가중 · PHQ-9 10점 이상"]].forEach(([bg, col, lab, big, sub], i) => {
    const x = MX + i * 3.1;
    box(s, x, 4.05, 2.9, 2.0, bg);
    tag(s, lab, x + 0.25, 4.25, H.lt1, col);
    T(s, big, { x: x + 0.25, y: 4.75, w: 2.5, h: 0.65, fontSize: 30, bold: true, color: col });
    T(s, sub, { x: x + 0.25, y: 5.45, w: 2.5, h: 0.4, fontSize: 12, color: H.accent5 });
  });
  box(s, 6.85, 1.9, 5.88, 2.9, H.lt1, { line: P.line, lineW: 1.25 });
  T(s, "연구 질문", { x: 7.1, y: 2.05, w: 3, h: 0.3, fontSize: 12, bold: true, color: H.accent5 });
  ["어떤 영역·요인이 우울과 가장 관련되는가", "그중 바꿀 수 있는 요인은 무엇인가", "신체활동과 함께할 때 유리한 생활요인은", "연령대마다 핵심 영역이 다른가"].forEach((q, i) => {
    circleNum(s, i + 1, 7.1, 2.5 + i * 0.55, H.dk1, H.lt1, 0.36);
    T(s, q, { x: 7.6, y: 2.5 + i * 0.55, w: 5.0, h: 0.36, fontSize: 15, bold: true, valign: "middle" });
  });
  box(s, 6.85, 4.95, 5.88, 1.1, P.amber);
  T(s, "미리 정한 원칙", { x: 7.1, y: 5.05, w: 4, h: 0.3, fontSize: 12, bold: true, color: H.accent3 });
  T(s, "PHQ-9와 겹치는 증상근접 변수는 주 분석에서 분리하고, 결과는 인과가 아닌 관련성으로 서술한다", { x: 7.1, y: 5.38, w: 5.45, h: 0.6, fontSize: 13 });
}

// ================================================================ 3. 데이터와 변수
{
  const s = slide("CH1", "1 무엇을 물었나", `조사 201개 변수에서 8개 영역 ${N.n_features}개 분석 변수를 골랐다`,
    "원시자료는 19개 조사영역, 201개 변수입니다. 그중 103개를 사용했고, 모형에는 원시변수 86개를 66개 분석변수로 다듬어 넣었습니다. 우울 문항과 직접 겹치는 4개는 뺐고, 스트레스·수면·주관적 건강처럼 개념이 겹치는 13개는 비교용으로만 씁니다. 나머지 미사용 문항은 대부분 해당자에게만 묻는 하위문항이나 지식 문항입니다.");
  // 201·103·86·4는 원시자료 201열을 사용 여부로 분류한 결과(docs/v2/data_dictionary_v2.md 8절 제외 기준)
  const steps = [["201", "개 원시변수", "19개 조사영역 · 169개 문항", H.lt2, H.dk1, H.accent5], ["86", "개 투입 문항", "사용한 문항은 모두 103개", H.lt2, H.dk1, H.accent5],
    [String(N.n_features), "개 분석 변수", "파생·재코딩 후 8개 영역", H.dk1, H.lt1, P.soft]];
  steps.forEach(([big, unit, sub, bg, col, subc], i) => {
    const x = MX + i * 3.05;
    box(s, x, 1.95, 2.7, 1.75, bg);
    T(s, [{ text: big, options: { fontSize: 34, bold: true } }, { text: ` ${unit}`, options: { fontSize: 15, bold: true } }], { x: x + 0.25, y: 2.15, w: 2.3, h: 0.75, color: col, valign: "bottom" });
    T(s, sub, { x: x + 0.25, y: 3.0, w: 2.3, h: 0.5, fontSize: 12, color: subc });
    T(s, "→", { x: x + 2.72, y: 2.55, w: 0.33, h: 0.5, fontSize: 20, bold: true, color: P.soft, align: "center" });
  });
  box(s, 9.75, 1.95, 2.98, 0.82, P.green);
  T(s, [{ text: `주 분석 ${N.n_main_features}개`, options: { bold: true, color: H.accent1, fontSize: 17 } }, { text: "   7개 영역", options: { fontSize: 12, color: H.accent5 } }], { x: 9.95, y: 1.95, w: 2.7, h: 0.82, valign: "middle" });
  box(s, 9.75, 2.88, 2.98, 0.82, P.red);
  T(s, [{ text: `증상근접 ${N.n_features - N.n_main_features}개`, options: { bold: true, color: H.accent4, fontSize: 17 } }, { text: "   비교용", options: { fontSize: 12, color: H.accent5 } }], { x: 9.95, y: 2.88, w: 2.7, h: 0.82, valign: "middle" });
  T(s, "쓰지 않은 문항과 이유", { x: MX, y: 4.05, w: 6, h: 0.35, fontSize: 16, bold: true });
  const ex = [["누수", "결과변수와 겹침 4개", "우울감 경험·상담, 스트레스 상담, EQ-5D 불안·우울"], ["하위문항", "해당자만 묻는 세부 문항", "고혈압·당뇨 치료·교육, 흡연량 → 상위 문항으로 대표"],
    ["지식", "지식·인지 문항", "뇌졸중·심근경색 조기증상 인지 → 교육·건강정보 이해로 대표"], ["영역", "영역 전체 제외 3개", "안전의식 · 개인위생 · 여성건강 — 우울과의 경로 근거가 약함"]];
  ex.forEach(([t, h, b], i) => {
    const x = MX + (i % 2) * 6.15, y = 4.55 + Math.floor(i / 2) * 0.95;
    tag(s, t, x, y + 0.02, P.green, H.accent1, 1.05);
    T(s, h, { x: x + 1.25, y, w: 4.75, h: 0.35, fontSize: 14, bold: true });
    T(s, b, { x: x + 1.25, y: y + 0.38, w: 4.75, h: 0.4, fontSize: 12, color: H.accent5 });
  });
}

// ================================================================ 4. 분석 설계
{
  const s = slide("CH1", "1 무엇을 물었나", "두 가지 방법이 같은 질문을 서로 다른 각도에서 확인한다",
    "결과변수는 PHQ-9 10점 이상 하나입니다. 머신러닝은 영역을 하나씩 더하거나 빼며 어느 영역이 정보를 많이 갖는지 재고, 조사설계 회귀는 다른 요인을 모두 고정했을 때 연관의 방향과 크기를 모집단 기준으로 추정합니다. 두 방법이 같은 요인을 가리키는지가 결과의 신뢰도를 높입니다.");
  box(s, MX, 1.9, CW, 0.62, H.dk1);
  T(s, [{ text: "결과변수   ", options: { bold: true, color: P.mint } }, { text: `PHQ-9 총점 10점 이상 = 우울 증상 기준 충족 (가중 ${pct(N.prev_w, 2)})`, options: { bold: true, color: H.lt1 } }],
    { x: MX + 0.3, y: 1.9, w: CW - 0.6, h: 0.62, fontSize: 15, valign: "middle" });
  const cols = [["방법 ①", P.green, H.accent1, "머신러닝 — 어느 영역이 정보를 많이 갖나", [
      ["모형", "CatBoost 등 6개 알고리즘, 하이퍼파라미터 사전 고정"], ["분할", "가구 단위 학습·시험 분할(같은 가구 섞임 방지)"], ["지표", "영역 추가·제거 ΔAP + 가구 부트스트랩 95% CI"], ["확인", "SHAP · 영역 순열 중요도"]]],
    ["방법 ②", P.blue, H.accent2, "조사설계 회귀 — 다른 요인을 고정해도 남나", [
      ["설계", "가중치 · 층 · 집락 반영(테일러 선형화)"], ["조정", `주 분석 ${N.n_main_features}개 변수 동시 투입 → 조정 OR`], ["기준", "기준범주 = 건강한 상태(위험 쪽 OR > 1)"], ["조합", "신체활동 × 생활요인 조정 유병률"]]]];
  cols.forEach(([lab, bg, col, h, rows], i) => {
    const x = MX + i * 6.2;
    if (i === 1) s.addShape(pres.shapes.LINE, { x: 6.67, y: 2.8, w: 0, h: 3.25, line: { color: P.line, width: 1 } });
    tag(s, lab, x, 2.8, bg, col, 1.1);
    T(s, h, { x, y: 3.25, w: 5.9, h: 0.45, fontSize: 18, bold: true });
    rows.forEach(([k, v], j) => {
      tag(s, k, x, 3.9 + j * 0.55, bg, col, 0.8);
      T(s, v, { x: x + 1.0, y: 3.9 + j * 0.55, w: 4.9, h: 0.32, fontSize: 14, valign: "middle" });
    });
  });
  readBar(s, "원칙", "증상근접 13개는 두 방법 모두 주 분석에서 빼고, 넣었을 때의 변화만 따로 보고한다(순환 추론 방지)");
}

// ================================================================ 5. 영역 기여
pres.addSection({ title: "2 무엇을 찾았나" });
{
  const dom = D.domains, DL = D.domain_labels, order = ["phys", "care", "econ", "social", "behav", "env"];
  const s = slide("CH2", "2 무엇을 찾았나", "모든 영역이 고유한 정보를 더하고, 신체건강이 가장 크다",
    `인구 정보만 쓴 모형의 AP는 ${f(D.sets.base.catboost.ap)}입니다. 여기에 영역을 하나씩 더하면 신체건강이 가장 크게 올렸고, 전부 넣은 모형에서 하나씩 빼도 모든 영역에서 성능이 유의하게 떨어졌습니다. 어느 영역도 다른 영역으로 대체되지 않는다는 뜻입니다. 신체건강 1위, 생활환경 최하위는 네 가지 지표에서 모두 같았습니다.`);
  s.addChart(pres.charts.BAR, [
    { name: "단독 정보량 (인구 + 영역)", labels: order.map((d) => DL[d]), values: order.map((d) => dom[d].catboost.add.d) },
    { name: "고유 기여 (전체 − 영역)", labels: order.map((d) => DL[d]), values: order.map((d) => dom[d].catboost.drop.d) },
  ], { x: MX, y: 1.85, w: 8.0, h: 4.3, barDir: "bar", barGrouping: "clustered", barGapWidthPct: 55, chartColors: [H.accent1, P.mint],
    catAxisOrientation: "maxMin", valAxisMinVal: 0, valAxisMaxVal: 0.1, valAxisLabelFormatCode: "0.00",
    showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "+0.000", showLegend: true, legendPos: "t", ...CHART });
  T(s, [{ text: `+${f(dom.phys.catboost.add.d)}`, options: { fontSize: 44, bold: true, color: H.accent1 } }, { text: "  ΔAP", options: { fontSize: 16, color: H.accent5 } }], { x: 8.95, y: 1.95, w: 3.8, h: 0.9 });
  T(s, "신체건강 단독 정보량 — 네 지표 모두 1위", { x: 8.95, y: 2.85, w: 3.8, h: 0.35, fontSize: 13, color: H.accent5 });
  box(s, 8.95, 3.45, 3.78, 1.15, H.lt2);
  T(s, [{ text: "7 / 7", options: { bold: true, fontSize: 22, color: H.dk1, breakLine: true } }, { text: "어느 영역을 빼도 성능 하락(95% CI > 0)", options: { fontSize: 12, color: H.accent5 } }], { x: 9.2, y: 3.55, w: 3.4, h: 1.0 });
  box(s, 8.95, 4.75, 3.78, 1.15, H.lt2);
  T(s, [{ text: f(D.algos.catboost.full.ap), options: { bold: true, fontSize: 22, color: H.dk1, breakLine: true } }, { text: `주 분석 AP · 인구만 ${f(D.sets.base.catboost.ap)}`, options: { fontSize: 12, color: H.accent5 } }], { x: 9.2, y: 4.85, w: 3.4, h: 1.0 });
  readBar(s, "읽는 법", "단독 = 인구 정보에 이 영역만 더했을 때 오른 만큼 · 고유 = 전부 넣은 모형에서 이 영역만 뺐을 때 떨어진 만큼");
}

// ================================================================ 6. 바꿀 수 있는 요인
{
  const seen = new Set(), B = [];
  for (const o of D.or_modifiable) if (o.mod_type === "B" && !seen.has(o.name) && B.length < 5) { seen.add(o.name); B.push({ ...o }); }
  const LB = { "식품안정성": "식품 불안정" };
  B.forEach((o) => { o.label = `${LB[o.name] || o.name}: ${o.level}`; });
  const orOf = (name, level) => D.or_all.find((o) => o.name === name && o.level === level);
  const A = [["친구 연락", "월 1회 미만", "친구 연락: 월 1회 미만"], ["흡연", "현재흡연", "흡연: 현재흡연"], ["아침식사", "거의 안 함", "아침식사: 거의 안 함"],
    ["전자담배", "예", "전자담배: 현재 사용"], ["걷기 실천", "아니오", "걷기: 미실천"]].map(([n, l, t]) => ({ ...orOf(n, l), label: t }));
  const s = slide("CH2", "2 무엇을 찾았나", "바꿀 수 있는 요인 중 식품 불안정과 구강 문제의 연관이 가장 크다",
    "모든 변수를 동시에 조정한 회귀에서 바꿀 수 있는 요인을 두 유형으로 나눴습니다. 왼쪽은 서비스·정책·환경으로 개선할 수 있는 상태로, 식품이 자주 부족한 가구의 오즈가 3배를 넘었습니다. 오른쪽은 개인이 바꿀 수 있는 행동으로, 친구와의 연락 단절, 흡연, 아침 결식이 위험 쪽이었습니다. 유형 구분은 국민건강증진종합계획 분야에 맞춰 미리 정했습니다.");
  const panel = (rows, x, lab, sub, bg, col) => {
    tag(s, lab, x, 1.9, bg, col, 2.6);
    T(s, sub, { x: x + 2.75, y: 1.9, w: 3.2, h: 0.32, fontSize: 12, color: H.accent5, valign: "middle" });
    s.addChart(pres.charts.BAR, [{ name: "조정 OR", labels: rows.map((o) => o.label), values: rows.map((o) => o.or) }], {
      x, y: 2.3, w: 5.95, h: 3.8, barDir: "bar", catAxisOrientation: "maxMin", chartColors: [col], barGapWidthPct: 50,
      valAxisMinVal: 1, valAxisMaxVal: rows[0].or > 2.5 ? 3.5 : 2.0, valAxisLabelFormatCode: "0.0",
      showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00", showLegend: false, ...CHART });
  };
  panel(B, MX, "B 서비스·정책·환경", "변수마다 위험이 가장 큰 수준", P.blue, H.accent2);
  panel(A, MX + 6.18, "A 개인 행동", "대표 행동 5개", P.green, H.accent1);
  readBar(s, "읽는 법", "조정 OR = 53개 변수를 동시에 고정했을 때 오즈가 몇 배인가 · 기준은 건강한 상태 · 모두 p < .05");
}

// ================================================================ 7. 연령대
{
  const DL = D.domain_labels, order = ["phys", "care", "econ", "behav", "social", "env"];
  const ages = [["19-39", "19~39세"], ["40-64", "40~64세"], ["65+", "65세 이상"]];
  const s = slide("CH2", "2 무엇을 찾았나", "연령대마다 우울과 가장 관련된 영역이 다르다",
    "연령대 안에서 모형을 다시 학습해 영역별 단독 정보량을 비교했습니다. 진한 칸이 그 연령대에서 정보가 많은 영역입니다. 청년층은 건강행태가 신체건강만큼 중요했고 경제는 작았습니다. 중장년층은 경제가 가장 컸고, 65세 이상은 신체건강과 의료접근이 압도적이었습니다. 제언을 연령대별로 달리해야 하는 근거입니다.");
  const vmax = Math.max(...ages.flatMap(([k]) => order.map((d) => D.age[k][d].d)));
  const mix = (t) => [0x1F, 0x8A, 0x5B].map((v) => Math.round(v + (255 - v) * t).toString(16).padStart(2, "0")).join("").toUpperCase();
  const head = [{ text: "영역", options: { bold: true, color: H.accent5, fill: { color: H.lt1 }, align: "left" } },
    ...ages.map(([, l]) => ({ text: l, options: { bold: true, color: H.accent5, fill: { color: H.lt1 }, align: "center" } }))];
  const rows = order.map((d) => [{ text: DL[d], options: { bold: true, align: "left", fill: { color: H.lt1 } } },
    ...ages.map(([k]) => {
      const v = D.age[k][d].d, top = Math.max(...order.map((dd) => D.age[k][dd].d)) === v, r = v / vmax;
      return { text: `+${f(v)}`, options: { align: "center", bold: top, color: r > 0.62 ? H.lt1 : H.dk1, fill: { color: mix(1 - r * 0.9) } } };
    })]);
  s.addTable([head, ...rows], { x: MX, y: 1.9, w: 7.5, colW: [2.4, 1.7, 1.7, 1.7], rowH: 0.58, fontSize: 15, fontFace: "맑은 고딕", valign: "middle",
    border: { type: "solid", pt: 2, color: H.lt1 } });
  T(s, "인구 영역에 각 영역을 더했을 때의 AP 증가(LightGBM, 연령대별 재학습) · 굵은 글씨 = 그 연령대의 최대", { x: MX, y: 6.0, w: 7.5, h: 0.3, fontSize: 11, color: P.muted });
  [[P.green, H.accent1, "19~39세", "건강행태 ≈ 신체건강", "운동·식사·흡연 같은 생활습관이 핵심"], [P.amber, H.accent3, "40~64세", "경제", "소득·식품안정성·경제활동이 가장 큼"],
    [P.blue, H.accent2, "65세 이상", "신체건강 · 의료접근", "구강·낙상·미충족 의료가 압도적"]].forEach(([bg, col, a, b, c], i) => {
    const y = 1.9 + i * 1.42;
    box(s, 8.45, y, 4.28, 1.27, bg);
    tag(s, a, 8.7, y + 0.15, H.lt1, col, 1.3);
    T(s, b, { x: 8.7, y: y + 0.52, w: 3.9, h: 0.38, fontSize: 18, bold: true, color: col });
    T(s, c, { x: 8.7, y: y + 0.9, w: 3.9, h: 0.3, fontSize: 12, color: H.accent5 });
  });
}

// ================================================================ 8. 생활요인 점수
{
  const cm = D.count_summary["주 분석"];
  const loo = Object.entries(D.count_summary).filter(([k]) => k.endsWith("제외")).map(([, v]) => v.trend_or);
  const first = D.counts[0], last = D.counts[D.counts.length - 1];
  const s = slide("CH2", "2 무엇을 찾았나", "규칙으로 고른 생활요인은 함께 지킬수록 우울 비율이 낮다",
    `생활요인은 결과를 보고 고르지 않았습니다. 개인 행동이면서, 우울 관련 건강 생활요인 연구와 국민건강증진종합계획의 건강생활 실천 분야에 속하고, 공식 충족 기준이 있으며, 영역당 하나만 쓰는 규칙으로 정했습니다. 그 결과 신체활동과 함께 담배, 음주, 아침식사, 사회적 연결, 잠자기 전 칫솔질 다섯 가지가 남았습니다. 점수는 순서대로 더한 것이 아니라 몇 개를 충족했는지 센 값입니다. ${first.k} ${pct(first.prev)}에서 ${last.k} ${pct(last.prev)}로 단계적으로 낮아졌고, 1개 늘 때마다 오즈가 약 30% 낮았습니다. 어느 요인 하나를 빼고 다시 세도 같았습니다.`);
  box(s, MX, 1.9, 5.6, 2.5, H.lt2);
  T(s, "선정 규칙 (분석 전에 정함)", { x: MX + 0.25, y: 2.02, w: 5, h: 0.3, fontSize: 12, bold: true, color: H.accent5 });
  ["개인 행동(수정 유형 A)", "우울 관련 생활 영역(Zhao 등, 2023 + HP2030)", "공식 지표·권고로 충족 기준이 있음", "영역당 대표 문항 1개", "PHQ-9와 겹치는 수면은 민감도로만"].forEach((r, i) => {
    circleNum(s, i + 1, MX + 0.25, 2.42 + i * 0.38, H.dk1, H.lt1, 0.3);
    T(s, r, { x: MX + 0.7, y: 2.42 + i * 0.38, w: 4.8, h: 0.3, fontSize: 13, valign: "middle" });
  });
  ["신체활동 권고", "담배제품 미사용", "고위험음주 아님", "아침식사 주 5회+", "사회적 연결", "잠자기 전 칫솔질"].forEach((c, i) => {
    tag(s, c, MX + (i % 3) * 1.88, 4.6 + Math.floor(i / 3) * 0.48, i === 0 ? H.dk1 : P.green, i === 0 ? H.lt1 : H.accent1, 1.78);
  });
  T(s, "이웃 신뢰·동네 안전은 생활습관이 아닌 맥락 요인 → 부록", { x: MX, y: 5.65, w: 5.6, h: 0.3, fontSize: 12, color: P.muted });
  s.addChart(pres.charts.BAR, [{ name: "조정 유병률(%)", labels: D.counts.map((c) => c.k), values: D.counts.map((c) => c.prev) }], {
    x: 6.45, y: 1.85, w: 6.28, h: 3.55, barDir: "col", chartColors: [H.accent1], barGapWidthPct: 40, valAxisMinVal: 0, valAxisMaxVal: 10,
    valAxisLabelFormatCode: "0", showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0\"%\"", showLegend: false,
    showTitle: true, title: "충족한 건강 생활요인 수별 조정 유병률(%)", titleFontSize: 13, titleColor: H.dk1, ...CHART });
  box(s, 6.45, 5.5, 3.05, 0.62, P.green);
  T(s, [{ text: `OR ${f(cm.trend_or, 2)}`, options: { bold: true, color: H.accent1, fontSize: 18 } }, { text: "  1개 늘 때마다", options: { fontSize: 12, color: H.accent5 } }], { x: 6.65, y: 5.5, w: 2.8, h: 0.62, valign: "middle" });
  box(s, 9.65, 5.5, 3.08, 0.62, H.lt2);
  T(s, [{ text: `${f(Math.min(...loo), 2)}~${f(Math.max(...loo), 2)}`, options: { bold: true, fontSize: 18 } }, { text: "  하나씩 빼도", options: { fontSize: 12, color: H.accent5 } }], { x: 9.85, y: 5.5, w: 2.8, h: 0.62, valign: "middle" });
  readBar(s, "읽는 법", "점수 = 충족한 요인의 수(순서 없음, 비가중 합산) · 인구·경제·신체건강 조정 · 0점이 1,000명 미만이라 0~1개로 합침");
}

// ================================================================ 9. 선행연구 대비
pres.addSection({ title: "3 그래서 무엇인가" });
{
  const op = D.operating_points.find((o) => o.rule.includes("Han & Park")), cb = D.algos.catboost.full;
  const s = slide("CH3", "3 그래서 무엇인가", "같은 조사를 쓴 선행연구보다 해석의 근거를 단단하게 했다",
    `Han과 Park(2025)은 2022년 같은 조사로 우울 위험 예측모형을 만들었고, 스트레스와 주관적 건강을 가장 큰 위험요인으로 보고했습니다. 그런데 두 변수는 PHQ-9 문항과 겹칩니다. 저희는 이런 변수를 빼고도 ROC-AUC ${f(cb.auc)}로 비슷했고, 같은 비율인 18.4%를 고위험으로 판정하면 민감도 ${pct(op.sens)}, 정밀도 ${pct(op.ppv)}로 같은 수준이었습니다. 여기에 변수 범위, 가구 단위 분할, 보정 지표, 조사설계 회귀를 보완했습니다.`);
  const hd = (t, fill, col) => ({ text: t, options: { bold: true, color: col, fill: { color: fill } } });
  const rows = [
    ["자료", "지역사회건강조사 2022 · 227,366명", `지역사회건강조사 2025 · ${n0(N.analysis)}명`],
    ["변수", "18개 → ML 중요도로 14개 선별", `8개 영역 ${N.n_features}개 · 선정 기준 사전 지정`],
    ["스트레스·주관적 건강", "핵심 위험요인(OR 9.65, 3.38)", "PHQ-9와 겹쳐 주 분석에서 분리"],
    ["학습·시험 분할", "개인 단위 무작위 70/30 + SMOTE", "가구 단위 분할(가구원 섞임 방지)"],
    ["성능 지표", "Accuracy · macro F1 · ROC-AUC 0.841", `AP ${f(cb.ap)} · ROC-AUC ${f(cb.auc)} · 보정 ${f(cb.slope, 2)}`],
    ["같은 판정 비율 18.4%", "민감도 약 67% · 정밀도 약 14%(역산)", `민감도 ${pct(op.sens)} · 정밀도 ${pct(op.ppv)}`],
    ["회귀", "가중 로지스틱 회귀", "가중치·층·집락 반영, 53개 동시 조정"],
  ].map((r) => [{ text: r[0], options: { bold: true, color: H.accent5 } }, { text: r[1] }, { text: r[2], options: { bold: true, color: H.accent1, fill: { color: "F1FAF5" } } }]);
  s.addTable([[hd("", H.lt1, H.dk1), hd("Han & Park (2025, JKDISS)", H.lt2, H.accent5), hd("이 연구 (v2.1)", P.green, H.accent1)], ...rows], {
    x: MX, y: 1.9, w: CW, colW: [2.5, 4.5, 5.133], rowH: 0.52, fontSize: 14, fontFace: "맑은 고딕", valign: "middle", color: H.dk1,
    border: [{ type: "none" }, { type: "none" }, { type: "solid", pt: 0.75, color: P.line }, { type: "none" }] });
  readBar(s, "주의", "조사 연도(2022 vs 2025)와 분할 방식이 달라 성능 수치는 엄밀한 일대일 비교가 아니다");
}

// ================================================================ 10. 성능 해석
{
  const cb = D.algos.catboost.full, base = N.test_y1 / N.test, s80 = D.operating_points.find((o) => o.rule === "민감도 80%");
  const s = slide("CH3", "3 그래서 무엇인가", "이 모형은 개인 선별 도구가 아니라 영역별 정보량을 재는 도구다",
    `AP ${f(cb.ap)}는 아무 정보 없이 찍을 때(${f(base)})보다 약 ${Math.round(cb.ap / base)}배 높아 모형이 실제 신호를 학습했다는 뜻입니다. 그래서 영역 비교와 SHAP 해석을 믿을 수 있습니다. 하지만 선별 도구로 쓰기는 어렵습니다. 우울군의 80%를 잡으려면 1만 명 중 ${n0(s80.per10k.flagged)}명을 고위험으로 찍어야 하고, 그중 ${n0(s80.per10k.fp)}명은 헛경보입니다. 무엇보다 결과변수가 PHQ-9 자체라서, 9문항을 직접 묻는 편이 더 싸고 정확합니다.`);
  [[f(cb.ap), `AP · 무작위 ${f(base)}의 약 ${Math.round(cb.ap / base)}배`, H.accent1], [f(cb.auc), "ROC-AUC · 판별력 우수 구간", H.accent2], [f(cb.slope, 2), "보정 기울기 · 1에 가까울수록 정확", H.dk1]].forEach(([v, l, col], i) => {
    const x = MX + i * 2.85;
    T(s, v, { x, y: 1.9, w: 2.7, h: 0.75, fontSize: 36, bold: true, color: col });
    T(s, l, { x, y: 2.65, w: 2.7, h: 0.35, fontSize: 12, color: H.accent5 });
  });
  T(s, `민감도 80% 기준으로 1만 명에게 적용하면 (실제 우울 약 ${n0(Math.round(base * 10000))}명)`, { x: MX, y: 3.35, w: 8.3, h: 0.35, fontSize: 15, bold: true });
  [[n0(s80.per10k.flagged), "고위험 판정", H.lt2, H.dk1], [n0(s80.per10k.tp), "실제 우울을 잡음", P.green, H.accent1], [n0(s80.per10k.fp), "헛경보", P.red, H.accent4], [n0(s80.per10k.fn), "놓친 우울", P.amber, H.accent3]].forEach(([v, l, bg, col], i) => {
    const x = MX + i * 2.07;
    box(s, x, 3.85, 1.92, 1.45, bg);
    T(s, v, { x: x + 0.2, y: 4.0, w: 1.6, h: 0.6, fontSize: 26, bold: true, color: col });
    T(s, l, { x: x + 0.2, y: 4.65, w: 1.6, h: 0.35, fontSize: 12, color: H.dk1 });
  });
  box(s, 9.0, 1.9, 3.73, 3.4, H.dk1);
  T(s, "판정", { x: 9.25, y: 2.1, w: 3, h: 0.4, fontSize: 18, bold: true, color: H.lt1 });
  T(s, [{ text: "선별 도구로는 쓰지 않는다", options: { bold: true, color: P.mint, breakLine: true } },
    { text: " ", options: { breakLine: true, fontSize: 6 } },
    { text: "결과변수가 PHQ-9 점수 자체라서 개인 판정은 9문항을 직접 묻는 편이 더 싸고 정확하다. 머신러닝의 역할은 영역 간 정보량 비교다.", options: { color: H.lt2 } }],
    { x: 9.25, y: 2.6, w: 3.3, h: 2.5, fontSize: 14 });
  readBar(s, "읽는 법", "AP = 고위험 순으로 찍어 갈 때 찍힌 사람 중 실제 우울 비율의 평균 · 바닥값은 유병률(0.039)", 5.6);
}

// ================================================================ 11. 제언 (어두운 장)
{
  const sc = D.combos.find((c) => c.partner === "사회적 연결"), first = D.counts[0], last = D.counts[D.counts.length - 1];
  const s = slide("CH3_DARK", "3 그래서 무엇인가", "제언: 운동은 사람·생활습관과 함께할 때 우울 비율이 가장 낮다",
    "횡단면 자료라 인과를 말할 수는 없지만, 바꿀 수 있고 관련이 큰 요인을 근거로 세 가지를 제안합니다. 신체활동과 사회적 연결을 함께 충족한 집단의 조정 유병률이 가장 낮은 축이었고, 상호작용이 없어 효과가 더해지는 구조였습니다. 생활체육 프로그램을 운동 종목만이 아니라 교류의 장으로 설계할 근거가 됩니다.");
  [["제언 ①", "교류형 운동", `신체활동 + 사회적 연결 ${pct(sc.prev_both * 100, 2)} (둘 다 아님 ${pct(sc.prev_neither * 100, 2)})`, "동네 걷기 모임·동호회처럼 사람과 함께하는 형태"],
    ["제언 ②", "생활 단위 실천", `건강 생활요인 ${first.k} ${pct(first.prev)} → ${last.k} ${pct(last.prev)}`, "운동·아침식사·금연·절주·칫솔질을 함께"],
    ["제언 ③", "연령별 맞춤", "청년 생활습관 · 중장년 경제 · 노년 신체건강과 의료접근", "치과 진료, 낙상 예방, 식품 지원을 정신건강과 연계"]].forEach(([lab, h, ev, act], i) => {
    const x = MX + i * 4.12;
    box(s, x, 1.9, 3.89, 2.75, H.dk2);
    T(s, lab, { x: x + 0.3, y: 2.08, w: 2, h: 0.3, fontSize: 13, bold: true, color: P.mint });
    T(s, h, { x: x + 0.3, y: 2.45, w: 3.3, h: 0.55, fontSize: 24, bold: true, color: H.lt1 });
    T(s, ev, { x: x + 0.3, y: 3.1, w: 3.3, h: 0.65, fontSize: 13, color: H.lt2 });
    T(s, act, { x: x + 0.3, y: 3.85, w: 3.3, h: 0.65, fontSize: 13, color: P.soft });
  });
  box(s, MX, 4.85, CW, 0.7, H.dk2);
  T(s, [{ text: "근거   ", options: { bold: true, color: P.mint } }, { text: "신체활동과 5개 생활요인 모두 상호작용 없음 → 관련성이 서로 독립적으로 더해진다", options: { bold: true, color: H.lt1 } }],
    { x: MX + 0.3, y: 4.85, w: CW - 0.6, h: 0.7, fontSize: 15, valign: "middle" });
  T(s, "스포츠산업 시사점", { x: MX, y: 5.8, w: 4, h: 0.35, fontSize: 13, bold: true, color: P.dot });
  T(s, "생활체육 시설·동호회는 운동을 제공하는 동시에 이웃·친구 관계를 만드는 장이 될 수 있다. 결합 프로그램의 실제 효과는 중재연구로 검증할 과제다.", { x: MX, y: 6.15, w: CW, h: 0.6, fontSize: 14, color: H.lt2 });
}

// ================================================================ 12. 한계와 일정
{
  const s = slide("CH3", "3 그래서 무엇인가", "한계를 분명히 하고 피드백을 반영해 마무리한다",
    "가장 큰 한계는 횡단면 자료라는 점입니다. 우울해서 운동이나 교류가 줄었을 가능성을 배제할 수 없습니다. 모든 변수가 자기보고이고, 2025년 조사에는 좌식행동 문항이 없었습니다. 남은 기간에는 오늘 피드백을 반영해 분석을 확정하고 논문을 마무리하겠습니다.");
  T(s, "한계", { x: MX, y: 1.9, w: 6, h: 0.35, fontSize: 16, bold: true, color: H.accent3 });
  [["횡단면 자료", "역인과 가능성 → 모든 결과를 '관련 요인'으로 서술"], ["자기보고 측정", "PHQ-9 기준 충족은 임상 진단이 아님"], ["측정되지 않은 요인", "좌식행동 문항 없음, 식생활은 아침식사로 대리"], ["청년층 낮은 성능", "AP가 가장 낮아 조사 밖 요인의 영향 가능"]].forEach(([h, b], i) => {
    const y = 2.4 + i * 0.95;
    circleNum(s, i + 1, MX, y, P.dot, H.dk1);
    T(s, h, { x: MX + 0.6, y: y - 0.02, w: 5.2, h: 0.35, fontSize: 15, bold: true });
    T(s, b, { x: MX + 0.6, y: y + 0.35, w: 5.2, h: 0.35, fontSize: 13, color: H.accent5 });
  });
  box(s, 6.85, 1.9, 5.88, 4.25, H.lt2);
  T(s, "남은 일정", { x: 7.1, y: 2.05, w: 3, h: 0.35, fontSize: 16, bold: true });
  [["완료", P.green, H.accent1, "분석 v2.1 · 논문 초안 v2.1(42쪽, 보고 지침 대응표)"], ["다음", H.lt1, H.accent5, "중간 프로포절 피드백을 분석·원고에 반영"],
    ["다음", H.lt1, H.accent5, "저자 기재 항목(IRB 심의면제·코드 공개) 확정"], ["최종", P.amber, H.accent3, "논문 최종본 제출과 최종 발표"]].forEach(([t, bg, col, b], i) => {
    const y = 2.6 + i * 0.85;
    tag(s, t, 7.1, y, bg, col, 0.85);
    T(s, b, { x: 8.15, y, w: 4.4, h: 0.6, fontSize: 14 });
  });
}

// ================================================================ 13. 정리
{
  const s = slide("COVER", "3 그래서 무엇인가", null, "세 문장으로 정리하겠습니다. 질문 주시면 부록 자료로 답변드리겠습니다.");
  T(s, "정리", { x: MX, y: 0.75, w: 6, h: 0.4, fontSize: 15, color: P.soft });
  T(s, "우울 증상은 여러 영역이 함께 관련되는 복합 현상이다", { x: MX, y: 1.25, w: CW, h: 0.9, fontSize: 32, bold: true, color: H.lt1, valign: "middle" });
  [["영역", "모든 영역이 고유한 정보를 더하며, 신체건강의 기여가 가장 크다"], ["요인", "바꿀 수 있는 요인: 식품 불안정·구강 문제·미충족 의료, 사회적 연결·흡연·아침 결식"],
    ["생활요인", "신체활동은 다른 생활습관과 함께 지킬수록 우울 증상 비율이 단계적으로 낮다"]].forEach(([a, b], i) => {
    const y = 2.65 + i * 1.05;
    box(s, MX, y, CW, 0.85, H.dk2);
    circleNum(s, i + 1, MX + 0.3, y + 0.21, H.lt1, H.dk1);
    T(s, a, { x: MX + 0.95, y, w: 1.5, h: 0.85, fontSize: 15, bold: true, color: P.mint, valign: "middle" });
    T(s, b, { x: MX + 2.5, y, w: 9.4, h: 0.85, fontSize: 17, color: H.lt1, valign: "middle" });
  });
  T(s, "질의응답", { x: MX, y: 6.05, w: 4, h: 0.5, fontSize: 22, bold: true, color: P.dot });
}

// ================================================================ 부록
pres.addSection({ title: "부록" });
const tblOpt = (colW) => ({ x: MX, y: 1.9, w: CW, colW, fontSize: 14, fontFace: "맑은 고딕", valign: "middle", color: H.dk1,
  border: [{ type: "none" }, { type: "none" }, { type: "solid", pt: 0.75, color: P.line }, { type: "none" }] });
const HD = (t, al = "center") => ({ text: t, options: { bold: true, color: H.accent5, fill: { color: H.lt2 }, align: al } });
{
  const DL = D.domain_labels, ks = ["demo", "econ", "phys", "behav", "social", "env", "care", "proximal"];
  const s = slide("APPX", "부록", "A1. 영역별 변수 구성과 수정 유형 — 바꿀 수 있는 요인의 판정 기준",
    "수정 유형은 국민건강증진종합계획 분야와 대응시켜 정했습니다. A는 본인이 고르는 행동, B는 제도나 지역사회 개입으로 개선할 수 있는 현재 상태, C는 나이·성별·진단처럼 바꿀 수 없는 것입니다.");
  const rows = ks.map((k) => { const vs = D.variables.filter((v) => v.domain === k); const c = (t) => String(vs.filter((v) => v.mod_type === t).length);
    return [{ text: DL[k], options: { bold: true, align: "left" } }, String(vs.length), c("A"), c("B"), c("C")]; });
  s.addTable([[HD("영역", "left"), HD("변수"), HD("A 개인 행동"), HD("B 서비스·정책·환경"), HD("C 바꿀 수 없음")], ...rows], { ...tblOpt([2.05, 0.75, 1.4, 1.9, 1.8]), w: 7.9, rowH: 0.47, align: "center" });
  [[P.green, H.accent1, "A 개인 행동", "신체활동, 흡연, 음주, 식생활, 칫솔질, 연락·사회활동, 검진·접종, 수면"], [P.blue, H.accent2, "B 서비스·정책·환경", "소득·식품·경제활동, 체중·구강·낙상, 미충족 의료, 건강정보 이해, 동네 환경·이웃 신뢰"],
    [H.lt2, H.accent5, "C 바꿀 수 없음", "나이, 성별, 교육, 혼인, 세대유형, 만성질환 진단, 치매환자 가족, 지역·주택유형"]].forEach(([bg, col, h, b], i) => {
    const y = 1.9 + i * 1.42;
    box(s, 8.75, y, 3.98, 1.27, bg);
    T(s, h, { x: 8.95, y: y + 0.12, w: 3.6, h: 0.35, fontSize: 14, bold: true, color: col });
    T(s, b, { x: 8.95, y: y + 0.48, w: 3.6, h: 0.75, fontSize: 12 });
  });
  T(s, "근거: 제6차 국민건강증진종합계획(HP2030) — 건강생활 실천 → A, 비만·손상·건강정보 이해·지역사회 자원 → B", { x: MX, y: 6.35, w: CW, h: 0.3, fontSize: 11, color: P.muted });
}
{
  const LF = D.lifestyle_prev;
  const s = slide("APPX", "부록", "A2. 생활요인 선정 대응표 — 선행연구와 국가 계획의 생활 영역",
    "Zhao 등(2023)의 7개 건강 생활 영역과 국민건강증진종합계획의 건강생활 실천 분야를 합친 8개 영역에 조사 문항을 하나씩 대응시켰습니다. 좌식행동은 문항이 없어 빠졌고, 수면은 PHQ-9 수면 문항과 겹쳐 민감도 분석으로만 썼습니다.");
  const rows = [
    ["신체활동", "신체활동 권고 충족 (기준축)", "유산소(걷기 또는 중강도 이상) + 근력 주 2일 이상", LF["신체활동 권고 충족"]],
    ["흡연", "담배제품 현재 미사용", "궐련·전자담배 모두 현재 사용 아님", LF["담배제품 미사용"]],
    ["음주", "고위험음주 아님", "주 2회 이상 & 1회 남 7잔·여 5잔 이상이 아님", LF["고위험음주 아님"]],
    ["식생활", "아침식사 주 5회 이상", "지침서 아침식사 실천율(식품군 문항 없어 대리)", LF["아침식사 주 5회 이상"]],
    ["사회적 연결", "사회적 연결", "고립 지수 0~1점(1인 가구·드문 연락·사회활동 없음)", LF["사회적 연결"]],
    ["구강건강", "저녁 후·잠자기 전 칫솔질", "지침서 저녁식사 후 또는 잠자기 전 칫솔질 실천율", LF["저녁 후·잠자기 전 칫솔질"]],
    ["수면", "주중 7~9시간 (민감도)", "증상근접 — 주 점수에서 제외", LF["주중 수면 7~9시간"]],
    ["좌식행동", "–", "2025년 조사에 문항 없음", null],
  ].map((r) => [{ text: r[0], options: { bold: true } }, r[1], r[2], { text: r[3] == null ? "–" : pct(r[3]), options: { align: "center" } }]);
  s.addTable([[HD("생활 영역", "left"), HD("사용 문항", "left"), HD("충족 기준", "left"), HD("충족률(가중)")], ...rows], { ...tblOpt([1.8, 3.2, 5.533, 1.6]), rowH: 0.5 });
}
{
  const s = slide("APPX", "부록", "A3. 점수 민감도 — 어느 요인 하나를 빼도 단계적 감소가 유지된다",
    "특정 요인 하나가 결과를 끌고 가는지 보려고 요인을 하나씩 뺀 점수 여섯 가지와 수면을 더한 점수를 다시 계산했습니다. 1점당 오즈비가 모두 비슷했습니다.");
  const rows = Object.entries(D.count_summary).map(([k, v]) => { const r = D.count_sens.filter((x) => x.score === k);
    return [{ text: k, options: { bold: k === "주 분석", align: "left" } }, String(v.n_factors), `${f(v.trend_or, 2)} [${f(v.trend_lo, 2)}, ${f(v.trend_hi, 2)}]`,
      `${r[0].k} ${pct(r[0].prev)}`, `${r[r.length - 1].k} ${pct(r[r.length - 1].prev)}`]; });
  s.addTable([[HD("점수", "left"), HD("요인 수"), HD("1점당 OR [95% CI]"), HD("최저 점수 유병률"), HD("최고 점수 유병률")], ...rows], { ...tblOpt([3.6, 1.2, 2.9, 2.2, 2.233]), rowH: 0.48, align: "center" });
  T(s, "인구·경제·신체건강 조정 조사설계 기반 회귀. 양 끝 점수가 1,000명 미만이면 안쪽 점수와 합침", { x: MX, y: 6.4, w: CW, h: 0.3, fontSize: 11, color: P.muted });
}
{
  const s = slide("APPX", "부록", "A4. 임계값을 정하면 — 민감도와 정밀도는 맞바꾸는 관계다",
    "모형을 실제 판정에 쓴다면 목적에 따라 임계값을 정해야 합니다. 시험셋을 가구 단위로 반으로 나눠 한쪽에서 임계값을 정하고 다른 쪽에서 평가했습니다.");
  const rows = D.operating_points.map((o) => [{ text: o.rule, options: { align: "left", bold: o.rule.includes("Han") } }, f(o.thr, 3), pct(o.flag), pct(o.sens), pct(o.spec), pct(o.ppv), n0(o.per10k.fn)]);
  s.addTable([[HD("임계값 기준", "left"), HD("임계 확률"), HD("고위험 판정"), HD("민감도"), HD("특이도"), HD("정밀도"), HD("놓친 우울/1만 명")], ...rows], { ...tblOpt([3.6, 1.3, 1.5, 1.3, 1.3, 1.3, 1.833]), rowH: 0.56, align: "center" });
  T(s, "CatBoost 주 분석, 시험셋 46,528명. Han & Park(2025)의 판정 비율 18.4%는 그 논문의 정확도·macro 재현율·시험셋 인원에서 역산", { x: MX, y: 6.4, w: CW, h: 0.3, fontSize: 11, color: P.muted });
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("생성:", OUT);
})();
