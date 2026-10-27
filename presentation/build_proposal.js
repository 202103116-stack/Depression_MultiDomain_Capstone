/**
 * 중간 프로포절 발표자료 — 우울 증상의 다차원 요인 분석 (v2.1)
 * 실행: python -X utf8 presentation/make_figures.py && node presentation/build_proposal.js   (paper/build_paper_data.py 실행 후)
 * 산출: presentation/proposal_v2.pptx
 * 구성: docs/v2/proposal_outline.md (연구 질문 RQ1~RQ4가 뼈대). 수치는 paper/paper_data.json에서만 읽는다.
 * 디자인: presentation/design/DESIGN.md
 */
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require(path.join(__dirname, "apply_theme.js"));

const ROOT = path.resolve(__dirname, "..");
const D = JSON.parse(fs.readFileSync(path.join(ROOT, "paper", "paper_data.json"), "utf-8"));
const N = D.n;
const OUT = path.join(__dirname, "proposal_v2.pptx");
const FIG = (name) => path.join(__dirname, "figures", name);

// ---------------------------------------------------------------- 테마 (DESIGN.md)
const THEME = {
  name: "Depression MultiDomain",
  headFontFace: "맑은 고딕",
  bodyFontFace: "맑은 고딕",
  colors: {
    dk1: "1D2430", lt1: "FFFFFF", dk2: "2A3342", lt2: "F3F5F8",
    accent1: "2F5FB3", accent2: "1F8A5B", accent3: "C2412D", accent4: "A86400", accent5: "5B6472", accent6: "A9B2C0",
    hlink: "2F5FB3", folHlink: "5B6472",
  },
};
const C = {
  ink: "1D2430", ink2: "2A3342", muted: "5B6472", soft: "A9B2C0", rule: "E3E6EA", canvas: "FFFFFF", panel: "F3F5F8",
  ml: "2F5FB3", mlT: "E3ECFB", reg: "1F8A5B", regT: "DDF3E8", risk: "C2412D", riskT: "FBE0DA", note: "A86400", noteT: "FDEBC8", mint: "5BC596",
};

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "우울 증상의 다차원 요인 분석 — 중간 프로포절";
pres.author = "Depression_MultiDomain_Capstone";
const MX = 0.6, CW = 12.133, R = MX + CW;

const f = (x, k = 3) => Number(x).toFixed(k);
const pct = (x, k = 1) => `${Number(x).toFixed(k)}%`;
const n0 = (x) => Number(x).toLocaleString("en-US");

// ---------------------------------------------------------------- 레이아웃
const FOOT = `자료: 2025 지역사회건강조사 원시자료, 만 19세 이상 성인 ${n0(N.analysis)}명`;
const frame = (name, dark, titleSize = 26) => pres.defineSlideMaster({
  title: name,
  background: { color: dark ? C.ink : C.canvas },
  margin: [0.4, MX, 0.6, MX],
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: MX, y: 0.82, w: CW, h: 0.8, fontSize: titleSize, bold: true, color: dark ? C.canvas : C.ink, align: "left", valign: "middle", margin: 0 }, text: "" } },
    { text: { text: FOOT, options: { x: MX, y: 7.0, w: 9.0, h: 0.3, fontSize: 10, color: dark ? C.soft : C.muted, margin: 0 } } },
  ],
  slideNumber: { x: 12.23, y: 7.0, w: 0.5, h: 0.3, fontSize: 10, color: dark ? C.soft : C.muted, align: "right" },
});
frame("LIGHT", false);
frame("DARK", true);
frame("APPX", false, 24);
pres.defineSlideMaster({ title: "COVER", background: { color: C.ink }, objects: [] });

// ---------------------------------------------------------------- 그리기 도구
const slide = (master, section, title, notes) => {
  const s = pres.addSlide({ masterName: master, sectionTitle: section });
  if (title) s.addText(title, { placeholder: "title" });
  if (notes) s.addNotes(notes);
  return s;
};
const T = (s, t, o) => s.addText(t, { isTextBox: true, margin: 0, fontSize: 14, color: C.ink, valign: "top", ...o });
const box = (s, x, y, w, h, fill, o = {}) => s.addShape(o.rect ? pres.shapes.RECTANGLE : pres.shapes.ROUNDED_RECTANGLE, {
  x, y, w, h, rectRadius: o.rect ? undefined : 0.1, fill: { color: fill }, line: { color: o.line || fill, width: o.lineW || 0.75, dashType: o.dash || "solid" }, objectName: o.name });
const pill = (s, text, x, y, fill, color, o = {}) => s.addText(text, { isTextBox: true, shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.16,
  x, y, w: o.w || Math.max(0.9, text.length * 0.165 + 0.42), h: o.h || 0.34, align: "center", valign: "middle", fontSize: o.size || 12, bold: true, margin: 0,
  fill: { color: fill }, color, line: { color: fill } });
const line = (s, x1, y1, x2, y2, color, o = {}) => s.addShape(pres.shapes.LINE, {
  x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1) || 0.001, h: Math.abs(y2 - y1) || 0.001,
  flipV: (y2 < y1) !== (x2 < x1), line: { color, width: o.w || 1.25, endArrowType: o.arrow, dashType: o.dash || "solid" } });
const readBar = (s, label, text, y = 6.3) => {
  box(s, MX, y, CW, 0.5, C.noteT);
  T(s, [{ text: `${label}   `, options: { bold: true, color: C.note } }, { text, options: { color: C.ink } }],
    { x: MX + 0.25, y, w: CW - 0.5, h: 0.5, fontSize: 13, valign: "middle" });
};
const fig = (s, name, x, y, w, h, alt) => s.addImage({ path: FIG(name), x, y, w, h, altText: alt });

// 위쪽 띠: 왼쪽은 이 장이 답하는 연구 질문(또는 묶음 이름), 오른쪽은 결과를 낸 방법(렌즈)
const RQ = {
  1: "어느 영역이 우울에 대한 정보를 가장 많이 갖는가",
  2: "그중 바꿀 수 있는 위험 요인은 무엇인가",
  3: "연령대마다 핵심 영역이 다른가",
  4: "신체활동은 어떤 생활요인과 함께할 때 유리한가",
};
const LENS = { ml: ["머신러닝", C.mlT, C.ml], reg: ["조사설계 회귀", C.regT, C.reg] };
const strip = (s, left, lens, dark) => {
  if (typeof left === "number") {
    pill(s, `RQ${left}`, MX, 0.32, dark ? C.canvas : C.ink, dark ? C.ink : C.canvas, { w: 0.78 });
    T(s, RQ[left], { x: MX + 0.92, y: 0.32, w: 8, h: 0.34, fontSize: 13, color: dark ? C.soft : C.muted, valign: "middle" });
  } else {
    T(s, left, { x: MX, y: 0.32, w: 8, h: 0.34, fontSize: 13, bold: true, color: dark ? C.soft : C.muted, valign: "middle" });
  }
  let x = R;
  [].concat(lens || []).reverse().forEach((k) => {
    const [t, bg, col] = LENS[k], w = t.length * 0.165 + 0.42;
    x -= w;
    pill(s, t, x, 0.32, bg, col, { w });
    x -= 0.12;
  });
};
const CHART = {
  catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", dataLabelFontFace: "+mn-lt", legendFontFace: "+mn-lt", titleFontFace: "+mn-lt",
  catAxisLabelColor: C.ink, valAxisLabelColor: C.muted, dataLabelColor: C.ink, catAxisLabelFontSize: 13, valAxisLabelFontSize: 11,
  dataLabelFontSize: 12, legendFontSize: 12, valGridLine: { color: C.rule, size: 0.5 }, catGridLine: { style: "none" },
  catAxisLineShow: false, valAxisLineShow: false,
};

const cb = D.algos.catboost.full;
const first = D.counts[0], last = D.counts[D.counts.length - 1];
const combos = D.combos.filter((c) => !c.proximal);

// ================================================================ 1. 표지
pres.addSection({ title: "도입" });
{
  const s = slide("COVER", "도입", null,
    "1차 연구에서는 걷기·근력운동과 친구 연락만 보았습니다. 교수님께서 우울을 복합적으로 보라고 하셔서, 같은 조사의 문항을 8개 생활 영역으로 넓혀 네 가지 질문을 세웠습니다. 오늘은 이 네 질문에 대한 중간 결과를 말씀드리겠습니다.");
  T(s, "스포츠융합산업프로젝트실습  중간 프로포절", { x: MX, y: 0.8, w: 10, h: 0.4, fontSize: 15, color: C.soft });
  T(s, [{ text: "한국 성인의 우울 증상을", options: { breakLine: true } }, { text: "여러 생활 영역에서 함께 본다" }], { x: MX, y: 1.3, w: CW, h: 1.6, fontSize: 40, bold: true, color: C.canvas, valign: "middle" });
  T(s, `2025 지역사회건강조사 성인 ${n0(N.analysis)}명을 8개 영역 ${N.n_features}개 변수로 분석했다`, { x: MX, y: 3.0, w: CW, h: 0.45, fontSize: 19, color: C.panel });
  [1, 2, 3, 4].forEach((k, i) => {
    const x = MX + i * 3.06;
    box(s, x, 3.95, 2.89, 1.3, C.ink2);
    T(s, `RQ${k}`, { x: x + 0.22, y: 4.1, w: 1, h: 0.32, fontSize: 13, bold: true, color: C.mint });
    T(s, RQ[k], { x: x + 0.22, y: 4.45, w: 2.6, h: 0.7, fontSize: 13, color: C.canvas });
  });
  T(s, [{ text: "[팀명]   ", options: { bold: true, color: C.canvas } }, { text: "[발표자]", options: { color: C.panel } }], { x: MX, y: 5.8, w: 8, h: 0.45, fontSize: 18 });
  T(s, "결과는 횡단면 자료의 관련성이며 인과 효과가 아니다. PHQ-9 10점 이상은 임상 진단이 아니라 우울 증상 기준 충족이다.", { x: MX, y: 6.6, w: CW, h: 0.35, fontSize: 11, color: C.soft });
}

// ================================================================ 2. 배경 — 선행연구의 빈틈
{
  const s = slide("LIGHT", "도입", "선행연구는 요인을 하나씩 보았고, 영역끼리 비교하지 않았다",
    `한국 성인의 ${pct(N.prev_w, 2)}가 PHQ-9 기준으로 우울 증상을 보입니다. 운동, 식품 불안정, 구강 건강, 사회적 관계가 각각 우울과 관련된다는 연구는 많습니다. 하지만 대부분 한두 요인만 따로 검증해서, 여러 영역을 한 모형에 넣었을 때 어느 영역이 독립적으로 얼마나 기여하는지는 알 수 없습니다. 같은 조사를 쓴 최근 예측 연구는 스트레스와 주관적 건강을 가장 큰 위험요인으로 꼽았는데, 두 변수는 PHQ-9 문항과 겹쳐 우울로 우울을 설명하는 셈이 됩니다.`);
  strip(s, "배경");
  const nodes = [["운동", "걷기·요가·근력운동이 우울 완화 (Noetel 등, 2024)"], ["식품 불안정", "우울 위험 증가와 관련 (Pourmotabbed 등, 2020)"],
    ["구강 건강", "우울·불안 장애와 치아 상실 (Kisely 등, 2016)"], ["사회적 연결망", "노인의 연결망·동네 만족과 우울 (Lee 등, 2025)"]];
  const cx = 6.0, cy = 3.98;
  nodes.forEach(([h, b], i) => {
    const y = 1.95 + i * 1.05;
    box(s, MX, y, 3.9, 0.88, C.panel);
    T(s, h, { x: MX + 0.22, y: y + 0.1, w: 3.5, h: 0.32, fontSize: 15, bold: true });
    T(s, b, { x: MX + 0.22, y: y + 0.45, w: 3.6, h: 0.36, fontSize: 11, color: C.muted });
    line(s, MX + 3.9, y + 0.44, cx - 0.72, cy, C.soft, { arrow: "triangle" });
  });
  s.addShape(pres.shapes.OVAL, { x: cx - 0.72, y: cy - 0.72, w: 1.44, h: 1.44, fill: { color: C.ink }, line: { color: C.ink } });
  T(s, "우울 증상", { x: cx - 0.72, y: cy - 0.72, w: 1.44, h: 1.44, fontSize: 15, bold: true, color: C.canvas, align: "center", valign: "middle" });
  const gaps = [["빈틈 1", "영역끼리 비교한 연구가 드물다", "한 요인의 관련이 다른 영역 요인 때문인지 가릴 수 없다"],
    ["빈틈 2", "우울과 겹치는 변수로 우울을 설명한다", "Han & Park(2025): 스트레스 OR 9.65, 주관적 건강 OR 3.38 — PHQ-9 수면·피로 문항과 개념이 겹친다"]];
  gaps.forEach(([t, h, b], i) => {
    const y = 1.95 + i * 2.12;
    box(s, 7.45, y, 5.28, 1.92, C.canvas, { line: C.rule, lineW: 1.25 });
    pill(s, t, 7.7, y + 0.22, C.riskT, C.risk, { w: 0.95 });
    T(s, h, { x: 7.7, y: y + 0.68, w: 4.85, h: 0.4, fontSize: 17, bold: true });
    T(s, b, { x: 7.7, y: y + 1.12, w: 4.85, h: 0.65, fontSize: 13, color: C.muted });
  });
  readBar(s, "현황", `한국 성인 ${pct(N.prev_w, 2)}가 우울 증상 기준 충족(PHQ-9 10점 이상, 가중) — 이 연구의 결과변수`);
}

// ================================================================ 3. 연구 질문과 방법 지도
{
  const s = slide("LIGHT", "도입", "그래서 네 가지를 묻고, 질문마다 맞는 방법으로 답한다",
    "질문은 네 가지입니다. 어느 영역이 정보를 가장 많이 갖는지, 그중 바꿀 수 있는 위험 요인이 무엇인지, 연령대마다 다른지, 신체활동이 어떤 생활요인과 함께할 때 유리한지입니다. 앞의 질문 셋 중 영역과 연령 질문은 머신러닝이, 요인과 조합 질문은 조사설계 회귀가 주로 답하고, 다른 방법으로 한 번 더 확인합니다.");
  strip(s, "연구 질문");
  const cell = (t, kind) => {
    if (!t) return { text: "", options: { fill: { color: C.canvas } } };
    const [bg, col] = kind === "ml" ? [C.mlT, C.ml] : [C.regT, C.reg];
    return { text: t, options: { fill: { color: bg }, color: col, bold: true } };
  };
  const sub = (t) => ({ text: t, options: { fill: { color: C.canvas }, color: C.muted } });
  const rows = [
    [1, cell("영역 추가·제거 ΔAP, SHAP", "ml"), sub("변수별 결합검정으로 확인")],
    [2, sub("SHAP으로 확인"), cell("조정 OR + 수정 유형 A/B", "reg")],
    [3, cell("연령대별 재학습 ΔAP", "ml"), sub("")],
    [4, sub(""), cell("조합·점수별 조정 유병률", "reg")],
  ].map(([k, a, b]) => [{ text: `RQ${k}`, options: { bold: true, color: C.canvas, fill: { color: C.ink }, align: "center" } },
    { text: RQ[k], options: { bold: true, fill: { color: C.canvas } } }, a, b]);
  const hd = (t, col) => ({ text: t, options: { bold: true, color: col, fill: { color: C.canvas } } });
  s.addTable([[hd("", C.muted), hd("질문", C.muted), hd("머신러닝 — 정보량", C.ml), hd("조사설계 회귀 — 조정 연관", C.reg)], ...rows], {
    x: MX, y: 1.95, w: CW, colW: [0.9, 5.0, 3.1, 3.133], rowH: [0.5, 0.82, 0.82, 0.82, 0.82], fontSize: 15, fontFace: "맑은 고딕", valign: "middle", color: C.ink,
    border: { type: "solid", pt: 3, color: C.canvas } });
  readBar(s, "원칙", `PHQ-9와 개념이 겹치는 증상근접 변수 ${N.n_features - N.n_main_features}개(스트레스·수면·주관적 건강 등)는 두 방법 모두 주 분석에서 뺀다`);
}

// ================================================================ 4. 자료
pres.addSection({ title: "자료와 방법" });
{
  const DL = D.domain_labels;
  const cnt = (k) => D.variables.filter((v) => v.domain === k).length;
  const s = slide("LIGHT", "자료와 방법", `성인 ${n0(Math.round(N.analysis / 10000))}만 명을 8개 영역 ${N.n_features}개 변수로 보았다`,
    `2025년 지역사회건강조사 원시자료의 성인 ${n0(N.raw)}명 중 PHQ-9 응답이 없는 ${n0(N.y_missing)}명을 빼고 ${n0(N.analysis)}명을 분석했습니다. 우울 증상 기준을 충족한 사람은 ${n0(N.y1)}명입니다. 같은 가구원이 학습과 시험에 섞이지 않게 가구 단위로 나눴습니다. 변수는 8개 영역 ${N.n_features}개이고, 그중 PHQ-9와 겹치는 증상근접 ${N.n_features - N.n_main_features}개는 비교용으로만 씁니다.`);
  strip(s, "자료와 방법");
  const flow = [[n0(N.raw), "조사 응답 성인(만 19세 이상)", C.panel, C.ink], [n0(N.analysis), `분석 대상 (PHQ-9 결측 ${n0(N.y_missing)}명 제외)`, C.ink, C.canvas]];
  flow.forEach(([v, l, bg, col], i) => {
    const y = 1.95 + i * 1.3;
    box(s, MX, y, 4.3, 1.0, bg);
    T(s, [{ text: v, options: { fontSize: 26, bold: true, breakLine: true } }, { text: l, options: { fontSize: 12, color: i ? C.soft : C.muted } }], { x: MX + 0.25, y: y + 0.1, w: 3.9, h: 0.85, color: col });
    if (!i) line(s, MX + 2.15, y + 1.0, MX + 2.15, y + 1.3, C.soft, { arrow: "triangle" });
  });
  line(s, MX + 2.15, 4.25, MX + 2.15, 4.5, C.soft, { arrow: "triangle" });
  [[n0(N.train), `학습 · 우울 ${n0(N.train_y1)}명`], [n0(N.test), `시험 · 우울 ${n0(N.test_y1)}명`]].forEach(([v, l], i) => {
    const x = MX + i * 2.2;
    box(s, x, 4.5, 2.1, 0.95, C.canvas, { line: C.rule, lineW: 1.25 });
    T(s, [{ text: v, options: { fontSize: 18, bold: true, breakLine: true } }, { text: l, options: { fontSize: 11, color: C.muted } }], { x: x + 0.18, y: 4.58, w: 1.85, h: 0.8 });
  });
  T(s, `가구 단위 분할 ${n0(N.train_hh)} / ${n0(N.test_hh)}가구`, { x: MX, y: 5.55, w: 4.3, h: 0.3, fontSize: 11, color: C.muted });
  const ex = { demo: "나이, 성별, 교육, 혼인, 세대유형", econ: "소득, 수급, 식품안정성, 직업", phys: "구강, 저작, 낙상, 체형, 만성질환", behav: "신체활동, 흡연, 음주, 아침식사",
    social: "친구·친척·이웃 연락, 이웃 신뢰", env: "동네 안전·환경 만족, 지역", care: "미충족 의료·치과, 건강정보 이해", proximal: "스트레스, 수면, 주관적 건강, EQ-5D" };
  ["demo", "econ", "phys", "behav", "social", "env", "care", "proximal"].forEach((k, i) => {
    const x = 5.25 + (i % 2) * 3.78, y = 1.95 + Math.floor(i / 2) * 0.98, prox = k === "proximal";
    box(s, x, y, 3.62, 0.84, prox ? C.canvas : C.panel, prox ? { line: C.soft, lineW: 1.25, dash: "dash" } : {});
    T(s, [{ text: DL[k], options: { bold: true, color: prox ? C.muted : C.ink } }, { text: `  ${cnt(k)}개`, options: { color: C.muted, fontSize: 12 } }], { x: x + 0.2, y: y + 0.08, w: 3.3, h: 0.36, fontSize: 15 });
    T(s, prox ? "스트레스, 수면, 주관적 건강 — 주 분석 제외" : ex[k], { x: x + 0.2, y: y + 0.45, w: 3.3, h: 0.32, fontSize: 11, color: C.muted });
  });
  readBar(s, "결과변수", `PHQ-9 총점 10점 이상 = 우울 증상 기준 충족 · ${n0(N.y1)}명 (가중 ${pct(N.prev_w, 2)})`);
}

// ================================================================ 5. 두 렌즈
{
  const fi = D.or_modifiable[0], fiRank = D.shap_top.findIndex((x) => x.feature === "food_insecurity") + 1;
  const s = slide("LIGHT", "자료와 방법", "두 방법은 같은 변수를 보면서도 서로 다른 것을 잰다",
    `머신러닝은 모형이 예측할 때 어떤 영역과 변수에 얼마나 기대는지를 잽니다. 영역은 하나씩 더하고 빼며 AP 변화를 보고, 변수는 SHAP으로 예측값을 변수별 몫으로 나눕니다. 조사설계 회귀는 다른 요인을 모두 고정했을 때 변수의 응답에 따라 우울 가능성이 몇 배가 되는지를 기준범주와 비교합니다. 예를 들어 식품 불안정은 해당하는 사람이 적어 SHAP 순위는 ${fiRank}위지만, 해당자의 조정 오즈는 ${f(fi.or, 2)}배로 가장 큽니다.`);
  strip(s, "자료와 방법", ["ml", "reg"]);
  const cols = [["ml", "모형이 이 영역·변수에 얼마나 기대나", [["단위", "영역(ΔAP) · 변수(SHAP)"], ["방법", "영역 추가·제거 후 재학습, 예측값을 변수별 몫으로 분해"], ["결과", "AP 증가량, 평균 |SHAP| — 크기만 있음"], ["강점", "비선형 관계와 상호작용까지 반영"]]],
    ["reg", "다른 요인을 고정해도 관련이 남나", [["단위", "변수의 응답 수준(기준범주와 비교)"], ["방법", `주 분석 ${N.n_main_features}개 동시 투입, 가중치·층·집락 반영`], ["결과", "조정 OR + 95% CI — 방향과 크기"], ["강점", "모집단 추론과 불확실성"]]]];
  cols.forEach(([k, h, rows], i) => {
    const [t, bg, col] = LENS[k], x = MX + i * 6.18;
    box(s, x, 1.95, 5.95, 3.95, bg);
    T(s, t, { x: x + 0.3, y: 2.12, w: 3, h: 0.32, fontSize: 13, bold: true, color: col });
    T(s, h, { x: x + 0.3, y: 2.48, w: 5.4, h: 0.5, fontSize: 20, bold: true });
    rows.forEach(([a, b], j) => {
      const y = 3.2 + j * 0.64;
      T(s, a, { x: x + 0.3, y, w: 0.8, h: 0.5, fontSize: 13, bold: true, color: col, valign: "middle" });
      T(s, b, { x: x + 1.15, y, w: 4.6, h: 0.5, fontSize: 14, valign: "middle" });
    });
  });
  readBar(s, "예", `식품 불안정 — 해당자가 적어 SHAP ${fiRank}위, 그러나 해당자의 조정 오즈는 ${f(fi.or, 2)}배(가장 큼). 그래서 두 결과를 함께 본다`);
}

// ================================================================ 6. 모형 신뢰성
{
  const base = N.test_y1 / N.test, s80 = D.operating_points.find((o) => o.rule === "민감도 80%"), p = s80.per10k;
  const tn = 10000 - p.flagged - p.fn;
  const s = slide("LIGHT", "자료와 방법", "모형은 실제 신호를 학습했다 — 다만 개인 선별 도구는 아니다",
    `AP는 위험이 높다고 본 순서대로 찍어 갈 때 찍힌 사람 중 실제 우울 비율의 평균입니다. 아무 정보 없이 찍으면 유병률인 ${f(base)}가 나오는데, 이 모형은 ${f(cb.ap)}로 약 ${Math.round(cb.ap / base)}배입니다. 예측 확률도 실제와 잘 맞았습니다. 그래서 영역 비교를 믿을 수 있습니다. 하지만 우울군의 80%를 잡으려면 1만 명 중 ${n0(p.flagged)}명을 고위험으로 찍어야 하고 그중 ${n0(p.fp)}명은 헛경보입니다. 결과변수가 PHQ-9 자체이므로 개인 판정은 9문항을 직접 묻는 편이 낫습니다. 모형의 역할은 영역 비교입니다.`);
  strip(s, "자료와 방법", "ml");
  T(s, "AP (평균 정밀도)", { x: MX, y: 1.95, w: 4, h: 0.32, fontSize: 14, bold: true });
  const W = 5.6, maxv = 0.3;
  [["이 모형 (CatBoost)", cb.ap, C.ml], ["정보 없이 찍기", base, C.soft]].forEach(([l, v, col], i) => {
    const y = 2.45 + i * 0.72;
    T(s, l, { x: MX, y, w: 1.9, h: 0.5, fontSize: 13, color: C.muted, valign: "middle" });
    box(s, MX + 2.0, y + 0.07, (W - 2.0) * v / maxv, 0.36, col, { rect: true });
    T(s, f(v), { x: MX + 2.1 + (W - 2.0) * v / maxv, y, w: 1, h: 0.5, fontSize: 18, bold: true, color: col, valign: "middle" });
  });
  [[f(cb.auc), "ROC-AUC"], [f(cb.slope, 2), "보정 기울기 (1 = 완벽)"], [f(cb.oe, 2), "관측/기대 비 (1 = 완벽)"]].forEach(([v, l], i) => {
    const x = MX + i * 1.95;
    T(s, v, { x, y: 4.05, w: 1.8, h: 0.55, fontSize: 24, bold: true });
    T(s, l, { x, y: 4.6, w: 1.85, h: 0.3, fontSize: 11, color: C.muted });
  });
  T(s, `민감도 80%로 1만 명에게 적용하면`, { x: 6.85, y: 1.95, w: 5.9, h: 0.32, fontSize: 14, bold: true });
  const segs = [[p.tp, C.reg, "실제 우울을 잡음"], [p.fp, C.risk, "헛경보"], [p.fn, C.note, "놓친 우울"], [tn, C.rule, "정상으로 판정"]];
  let x = 6.85; const BW = 5.88;
  segs.forEach(([v, col]) => { const w = BW * v / 10000; box(s, x, 2.5, Math.max(w, 0.02), 0.62, col, { rect: true }); x += w; });
  line(s, 6.85, 3.25, 6.85 + BW * p.flagged / 10000, 3.25, C.ink, { w: 1.5 });
  T(s, `고위험 판정 ${n0(p.flagged)}명`, { x: 6.85, y: 3.32, w: 3, h: 0.3, fontSize: 12, bold: true });
  segs.forEach(([v, col, l], i) => {
    const y = 3.85 + i * 0.42;
    box(s, 6.85, y + 0.07, 0.26, 0.26, col, { rect: true });
    T(s, [{ text: n0(v), options: { bold: true } }, { text: `  ${l}`, options: { color: C.muted } }], { x: 7.25, y, w: 5, h: 0.4, fontSize: 14, valign: "middle" });
  });
  readBar(s, "판정", "영역 간 정보량을 비교하기엔 충분히 정확하다. 개인 선별은 PHQ-9 9문항을 직접 묻는 편이 더 싸고 정확하다", 5.85);
}

// ================================================================ 7. RQ1 영역
pres.addSection({ title: "결과" });
{
  const dom = D.domains, DL = D.domain_labels, order = ["phys", "care", "econ", "social", "behav", "env"];
  const mainDom = Object.keys(dom).filter((k) => k !== "proximal"), sig = mainDom.filter((k) => dom[k].catboost.drop.lo > 0).length;
  const s = slide("LIGHT", "결과", "모든 영역이 고유한 정보를 더하고, 신체건강이 가장 크다",
    `인구 정보만 쓴 모형의 AP는 ${f(D.sets.base.catboost.ap)}입니다. 여기에 영역을 하나씩 더하면 신체건강이 가장 크게 올렸습니다. 반대로 전부 넣은 모형에서 하나씩 빼도 ${mainDom.length}개 영역 모두에서 성능이 유의하게 떨어졌습니다. 어느 영역도 다른 영역으로 대체되지 않는다는 뜻입니다. 신체건강 1위, 생활환경 최하위는 알고리즘을 바꾸고 SHAP과 순열 중요도로 봐도 같았습니다.`);
  strip(s, 1, "ml");
  s.addChart(pres.charts.BAR, [
    { name: "단독 정보량 (인구 + 이 영역)", labels: order.map((d) => DL[d]), values: order.map((d) => dom[d].catboost.add.d) },
    { name: "고유 기여 (전체 − 이 영역)", labels: order.map((d) => DL[d]), values: order.map((d) => dom[d].catboost.drop.d) },
  ], { x: MX, y: 1.85, w: 8.1, h: 4.3, barDir: "bar", barGrouping: "clustered", barGapWidthPct: 50, chartColors: [C.ml, "9DB5E6"],
    catAxisOrientation: "maxMin", valAxisMinVal: 0, valAxisMaxVal: 0.1, valAxisLabelFormatCode: "0.00",
    showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "+0.000", showLegend: true, legendPos: "t", ...CHART });
  T(s, "신체건강 단독 정보량", { x: 9.15, y: 1.95, w: 3.6, h: 0.32, fontSize: 13, color: C.muted });
  T(s, [{ text: `+${f(dom.phys.catboost.add.d)}`, options: { fontSize: 48, bold: true, color: C.ml } }, { text: "  ΔAP", options: { fontSize: 16, color: C.muted } }], { x: 9.15, y: 2.3, w: 3.6, h: 0.9 });
  T(s, `인구만 쓴 모형 ${f(D.sets.base.catboost.ap)}에서 출발`, { x: 9.15, y: 3.2, w: 3.6, h: 0.3, fontSize: 12, color: C.muted });
  line(s, 9.15, 3.75, R, 3.75, C.rule);
  T(s, [{ text: `${sig} / ${mainDom.length}`, options: { fontSize: 36, bold: true, breakLine: true } }, { text: "빼면 성능이 떨어지는 영역 (95% CI > 0)", options: { fontSize: 12, color: C.muted } }], { x: 9.15, y: 3.95, w: 3.6, h: 1.4 });
  readBar(s, "읽는 법", "단독 = 인구 정보에 이 영역만 더했을 때 오른 AP. 고유 = 전부 넣은 모형에서 이 영역만 뺐을 때 떨어진 AP");
}

// ================================================================ 8. RQ1 변수 수준 — 두 렌즈
{
  const vt = Object.fromEntries(D.variable_tests.map((v) => [v.var, v]));
  const rank = Object.fromEntries([...D.variable_tests].sort((a, b) => b.F - a.F).map((v, i) => [v.var, i + 1]));
  const top = D.shap_top.filter((x) => vt[x.feature]).slice(0, 10), both = top.filter((x) => rank[x.feature] <= 10);
  const s = slide("LIGHT", "결과", "변수 수준에서도 두 방법이 같은 요인을 가리킨다",
    `왼쪽은 머신러닝이 많이 기댄 변수 상위 10개, 오른쪽은 같은 변수가 회귀에서 다른 요인을 고정한 뒤에도 얼마나 강하게 남는지입니다. 10개 중 ${both.length}개가 회귀에서도 상위 10위 안에 들었습니다. 낙상과 식품 불안정, 체형처럼 두 방법이 함께 가리키는 요인은 해석을 더 믿을 수 있습니다. 아침식사와 이웃 연락처럼 회귀 순위가 낮은 변수는 흔해서 SHAP이 커진 경우로, 해당자 한 명의 관련 강도는 중간 정도입니다.`);
  strip(s, 1, ["ml", "reg"]);
  fig(s, "rq1_two_lenses.png", MX, 1.8, 8.3, 4.45, "SHAP 상위 10개 변수와 회귀 결합검정 F 비교");
  box(s, 9.2, 1.95, 3.53, 4.1, C.panel);
  T(s, [{ text: `${both.length}`, options: { fontSize: 44, bold: true, color: C.ink } }, { text: " / 10", options: { fontSize: 20, color: C.muted } }], { x: 9.45, y: 2.1, w: 3.1, h: 0.85 });
  T(s, "회귀에서도 상위 10위인 변수", { x: 9.45, y: 2.95, w: 3.1, h: 0.55, fontSize: 12, color: C.muted });
  const lab = (x) => ({ food_insecurity: "식품 불안정", body_image: "인지 체형", contact_friend: "친구 연락", fall: "낙상" }[x.feature] || x.label.replace("연간 ", ""));
  T(s, both.map((x, i) => ({ text: `${lab(x)}  회귀 ${rank[x.feature]}위`, options: { breakLine: i < both.length - 1 } })), { x: 9.45, y: 3.6, w: 3.1, h: 2.3, fontSize: 14, paraSpaceAfter: 4 });
  readBar(s, "읽는 법", "SHAP은 모형이 기댄 정도라 흔한 변수일수록 커진다. F는 다른 변수를 고정한 뒤 남는 관련의 강도다");
}

// ================================================================ 9. RQ2 바꿀 수 있는 위험 요인
{
  const fi = D.or_modifiable[0];
  const s = slide("LIGHT", "결과", "바꿀 수 있는 위험 요인 중 식품 불안정과 구강 문제가 가장 크다",
    `회귀에서 다른 요인을 모두 고정한 조정 오즈비입니다. 바꿀 수 있는 요인을 국민건강증진종합계획의 분야에 맞춰 미리 두 유형으로 나눴습니다. 위쪽 네모는 서비스나 정책으로 개선할 수 있는 상태로, 식품이 자주 부족한 가구의 오즈가 ${f(fi.or, 2)}배였고 씹기가 매우 불편한 경우가 뒤를 이었습니다. 아래쪽 동그라미는 개인이 바꿀 수 있는 행동으로, 친구와 월 1회 미만 연락, 흡연, 아침 결식이 위험 쪽이었습니다.`);
  strip(s, 2, "reg");
  fig(s, "rq2_forest.png", MX, 1.8, 8.3, 4.45, "바꿀 수 있는 요인의 조정 오즈비와 95% 신뢰구간");
  T(s, "식품이 자주 부족한 가구", { x: 9.2, y: 1.95, w: 3.5, h: 0.32, fontSize: 13, color: C.muted });
  T(s, [{ text: f(fi.or, 2), options: { fontSize: 48, bold: true, color: C.risk } }, { text: " 배", options: { fontSize: 18, color: C.muted } }], { x: 9.2, y: 2.3, w: 3.5, h: 0.9 });
  T(s, `95% CI ${f(fi.lo, 2)}~${f(fi.hi, 2)}, 충분·다양 대비`, { x: 9.2, y: 3.2, w: 3.5, h: 0.3, fontSize: 12, color: C.muted });
  line(s, 9.2, 3.75, R, 3.75, C.rule);
  T(s, "유형 판정 기준 (분석 전에 정함)", { x: 9.2, y: 3.95, w: 3.5, h: 0.3, fontSize: 12, bold: true, color: C.muted });
  T(s, [{ text: "□  B 서비스·정책·환경", options: { bold: true, breakLine: true } }, { text: "식품 지원, 치과 진료, 의료 접근", options: { color: C.muted, fontSize: 12, breakLine: true } },
    { text: " ", options: { fontSize: 6, breakLine: true } },
    { text: "●  A 개인 행동", options: { bold: true, breakLine: true } }, { text: "연락, 금연, 아침식사", options: { color: C.muted, fontSize: 12 } }], { x: 9.2, y: 4.35, w: 3.5, h: 1.7, fontSize: 14 });
  readBar(s, "읽는 법", `조정 OR = 주 분석 ${N.n_main_features}개 변수를 동시에 고정했을 때의 오즈 배수. 기준은 건강한 상태, 변수마다 위험이 가장 큰 수준, 모두 p < .05`);
}

// ================================================================ 10. RQ3 연령대
{
  const ad = (a, d) => f(D.age[a][d].d);
  const s = slide("LIGHT", "결과", "연령대마다 우울과 가장 관련된 영역이 다르다",
    `연령대 안에서 모형을 다시 학습해 영역별 단독 정보량을 비교했습니다. 진한 칸일수록 그 연령대에서 정보가 많은 영역입니다. 19~39세는 건강행태가 신체건강만큼 컸고 경제는 작았습니다. 40~64세는 경제가 가장 컸고, 65세 이상은 신체건강과 의료접근이 두드러졌습니다. 제언을 연령대별로 달리해야 하는 근거입니다.`);
  strip(s, 3, "ml");
  fig(s, "rq3_age_heat.png", MX, 1.8, 7.2, 4.35, "연령대별 영역 단독 정보량 히트맵");
  [["19~39세", "건강행태 ≈ 신체건강", `운동·식사·흡연 같은 생활습관 +${ad("19-39", "behav")}, 경제는 +${ad("19-39", "econ")}`],
    ["40~64세", "경제", `소득·식품안정성·경제활동 +${ad("40-64", "econ")}`],
    ["65세 이상", "신체건강, 의료접근", `구강·낙상 +${ad("65+", "phys")}, 미충족 의료 +${ad("65+", "care")}`]].forEach(([a, b, c], i) => {
    const y = 1.95 + i * 1.38;
    pill(s, a, 8.2, y, C.mlT, C.ml, { w: 1.3 });
    T(s, b, { x: 8.2, y: y + 0.45, w: 4.5, h: 0.42, fontSize: 19, bold: true });
    T(s, c, { x: 8.2, y: y + 0.88, w: 4.5, h: 0.32, fontSize: 12, color: C.muted });
  });
  readBar(s, "읽는 법", "칸의 값 = 인구 영역에 그 영역을 더했을 때 오른 AP(연령대별 재학습). 굵은 글씨 = 그 연령대의 최대");
}

// ================================================================ 11. RQ4 조합
{
  const sc = combos.find((c) => c.partner === "사회적 연결"), noInt = combos.filter((c) => c.add_p >= 0.05 && c.mult_interaction_p >= 0.05).length;
  const s = slide("LIGHT", "결과", "신체활동과 생활요인을 함께 지키면 우울 비율이 가장 낮다",
    `신체활동 권고 충족 여부와 생활요인 하나씩을 묶어 네 집단의 조정 유병률을 비교했습니다. 다섯 쌍 모두 둘 다 지키는 집단(초록)이 가장 낮고 둘 다 안 지키는 집단(흰 원)이 가장 높았습니다. 예를 들어 신체활동과 사회적 연결을 함께 충족하면 ${pct(sc.prev_both * 100)}, 둘 다 아니면 ${pct(sc.prev_neither * 100)}였습니다. 상호작용은 다섯 쌍 모두 유의하지 않았습니다. 함께할 때 특별한 시너지가 생긴다기보다 각자의 관련이 그대로 더해진다는 뜻입니다.`);
  strip(s, 4, "reg");
  fig(s, "rq4_combos.png", MX, 1.85, 8.3, 4.2, "신체활동과 생활요인 조합별 조정 유병률");
  T(s, "신체활동 + 사회적 연결", { x: 9.2, y: 1.95, w: 3.5, h: 0.32, fontSize: 13, color: C.muted });
  T(s, [{ text: pct(sc.prev_both * 100), options: { fontSize: 40, bold: true, color: C.reg } }], { x: 9.2, y: 2.3, w: 3.5, h: 0.8 });
  T(s, `둘 다 아닐 때 ${pct(sc.prev_neither * 100)}의 절반 이하`, { x: 9.2, y: 3.1, w: 3.5, h: 0.3, fontSize: 12, color: C.muted });
  line(s, 9.2, 3.65, R, 3.65, C.rule);
  T(s, [{ text: `${noInt} / ${combos.length}`, options: { fontSize: 36, bold: true, breakLine: true } }, { text: "상호작용이 없는 쌍 (가법·승법 모두 p ≥ .05)", options: { fontSize: 12, color: C.muted, breakLine: true } },
    { text: " ", options: { fontSize: 6, breakLine: true } }, { text: "→ 각 요인의 관련이 독립적으로 더해진다", options: { fontSize: 13, bold: true } }], { x: 9.2, y: 3.85, w: 3.5, h: 2.1 });
  readBar(s, "읽는 법", "인구·경제·신체건강을 조정한 조사설계 회귀의 조정 유병률. 생활요인은 미리 정한 규칙으로 선정(다음 장)");
}

// ================================================================ 12. RQ4 점수
{
  const cm = D.count_summary["주 분석"];
  const loo = Object.entries(D.count_summary).filter(([k]) => k.endsWith("제외")).map(([, v]) => v.trend_or);
  const s = slide("LIGHT", "결과", "함께 지키는 생활요인이 많을수록 우울 비율이 단계적으로 낮다",
    `생활요인은 결과를 보고 고르지 않았습니다. 개인 행동이면서 우울 관련 건강 생활 연구와 국가 건강증진계획의 생활 영역에 속하고, 공식 충족 기준이 있으며, 영역당 하나만 쓰는 규칙으로 정했습니다. 점수는 순서대로 더한 것이 아니라 여섯 가지 중 몇 개를 충족했는지 센 값입니다. ${first.k} ${pct(first.prev)}에서 ${last.k} ${pct(last.prev)}로 낮아졌고, 1개 늘 때마다 오즈가 약 ${Math.round((1 - cm.trend_or) * 100)}% 낮았습니다. 어느 요인 하나를 빼고 다시 세도 같았습니다.`);
  strip(s, 4, "reg");
  T(s, "선정 규칙 — 분석 전에 정함", { x: MX, y: 1.95, w: 4.6, h: 0.32, fontSize: 13, bold: true, color: C.muted });
  ["개인이 바꿀 수 있는 행동(유형 A)", "선행연구·국가 계획의 생활 영역", "공식 지표로 충족 기준이 있음", "영역당 대표 문항 1개", "PHQ-9와 겹치는 수면은 민감도로만"].forEach((r, i) => {
    T(s, [{ text: `${i + 1}  `, options: { bold: true, color: C.reg } }, { text: r }], { x: MX, y: 2.35 + i * 0.4, w: 4.6, h: 0.34, fontSize: 13.5, valign: "middle" });
  });
  T(s, "선정된 여섯 가지", { x: MX, y: 4.5, w: 4.6, h: 0.32, fontSize: 13, bold: true, color: C.muted });
  ["신체활동 권고", "담배제품 미사용", "고위험음주 아님", "아침식사 주 5회+", "사회적 연결", "잠자기 전 칫솔질"].forEach((c, i) => {
    pill(s, c, MX + (i % 2) * 2.3, 4.9 + Math.floor(i / 2) * 0.44, i === 0 ? C.ink : C.regT, i === 0 ? C.canvas : C.reg, { w: 2.2, size: 12 });
  });
  fig(s, "rq4_score.png", 5.5, 1.8, 7.2, 4.1, "충족한 건강 생활요인 수별 조정 유병률");
  readBar(s, "결과", `1개 늘 때마다 OR ${f(cm.trend_or, 2)} [${f(cm.trend_lo, 2)}, ${f(cm.trend_hi, 2)}], 요인 하나씩 빼도 ${f(Math.min(...loo), 2)}~${f(Math.max(...loo), 2)}. 0점이 1,000명 미만이라 0~1개로 합침`);
}

// ================================================================ 13. 선행연구 대비
pres.addSection({ title: "의의" });
{
  const op = D.operating_points.find((o) => o.rule.includes("Han & Park"));
  const s = slide("LIGHT", "의의", "같은 조사를 쓴 선행연구보다 해석의 근거를 단단하게 했다",
    `Han과 Park(2025)은 2022년 같은 조사로 우울 위험 예측모형을 만들었습니다. 저희는 PHQ-9와 겹치는 변수를 빼고도 ROC-AUC ${f(cb.auc)}로 비슷했고, 같은 비율인 18.4%를 고위험으로 판정하면 민감도 ${pct(op.sens)}, 정밀도 ${pct(op.ppv)}로 같은 수준이었습니다. 여기에 변수 범위, 가구 단위 분할, 낮은 양성 비율에 맞는 지표, 조사설계 회귀를 보완했습니다. 다만 조사 연도와 분할 방식이 달라 엄밀한 일대일 비교는 아닙니다.`);
  strip(s, "의의");
  const hd = (t, fill, col) => ({ text: t, options: { bold: true, color: col, fill: { color: fill } } });
  const rows = [
    ["자료", "지역사회건강조사 2022, 227,366명", `지역사회건강조사 2025, ${n0(N.analysis)}명`],
    ["변수", "18개 → ML 중요도로 14개 선별", `8개 영역 ${N.n_features}개, 선정 기준을 미리 정함`],
    ["스트레스·주관적 건강", "핵심 위험요인(OR 9.65, 3.38)", "PHQ-9와 겹쳐 주 분석에서 분리"],
    ["학습·시험 분할", "개인 단위 무작위 70/30 + SMOTE", "가구 단위 분할(가구원 섞임 방지)"],
    ["성능 지표", "정확도, macro F1, ROC-AUC 0.841", `AP ${f(cb.ap)}, ROC-AUC ${f(cb.auc)}, 보정 ${f(cb.slope, 2)}`],
    ["같은 판정 비율 18.4%", "민감도 약 67%, 정밀도 약 14%(역산)", `민감도 ${pct(op.sens)}, 정밀도 ${pct(op.ppv)}`],
    ["회귀", "가중 로지스틱 회귀", `가중치·층·집락 반영, ${N.n_main_features}개 동시 조정`],
  ].map((r) => [{ text: r[0], options: { bold: true, color: C.muted } }, { text: r[1] }, { text: r[2], options: { bold: true, color: C.reg, fill: { color: "F1FAF5" } } }]);
  s.addTable([[hd("", C.canvas, C.ink), hd("Han & Park (2025, JKDISS)", C.panel, C.muted), hd("이 연구 (v2.1)", C.regT, C.reg)], ...rows], {
    x: MX, y: 1.9, w: CW, colW: [2.5, 4.5, 5.133], rowH: 0.52, fontSize: 14, fontFace: "맑은 고딕", valign: "middle", color: C.ink,
    border: [{ type: "none" }, { type: "none" }, { type: "solid", pt: 0.75, color: C.rule }, { type: "none" }] });
  readBar(s, "주의", "조사 연도(2022 vs 2025)와 분할 방식이 달라 성능 수치는 엄밀한 일대일 비교가 아니다");
}

// ================================================================ 14. 제언 (어두운 장)
{
  const sc = combos.find((c) => c.partner === "사회적 연결");
  const s = slide("DARK", "의의", "제언: 운동을 사람과 생활습관에 묶는 프로그램",
    "횡단면 자료라 인과를 말할 수는 없지만, 바꿀 수 있고 관련이 큰 요인을 근거로 세 가지를 제안합니다. 첫째, 운동을 사람을 만나는 자리로 설계하는 것입니다. 둘째, 운동 하나가 아니라 생활 단위로 여러 습관을 함께 다루는 것입니다. 셋째, 연령대마다 다른 핵심 영역에 맞추는 것입니다. 생활체육 현장은 운동과 교류를 함께 제공할 수 있는 곳입니다.");
  strip(s, "의의", null, true);
  [["교류형 운동", `${pct(sc.prev_both * 100)} vs ${pct(sc.prev_neither * 100)}`, "신체활동 + 사회적 연결 / 둘 다 아님", "걷기 모임, 동호회처럼 함께하는 운동"],
    ["생활 단위 실천", `${pct(first.prev)} → ${pct(last.prev)}`, `건강 생활요인 ${first.k} → ${last.k}`, "운동에 식사, 금연, 절주, 칫솔질까지"],
    ["연령별 맞춤", "청년 · 중장년 · 노년", "생활습관 / 경제 / 신체건강과 의료접근", "치과·낙상·식품 지원을 정신건강과 연계"]].forEach(([h, big, ev, act], i) => {
    const y = 1.95 + i * 1.25;
    line(s, MX, y, R, y, C.ink2, { w: 1 });
    T(s, h, { x: MX, y: y + 0.25, w: 3.4, h: 0.6, fontSize: 24, bold: true, color: C.canvas });
    T(s, [{ text: big, options: { fontSize: 22, bold: true, color: C.mint, breakLine: true } }, { text: ev, options: { fontSize: 12, color: C.soft } }], { x: 4.2, y: y + 0.18, w: 4.6, h: 0.9 });
    T(s, act, { x: 9.0, y: y + 0.25, w: 3.73, h: 0.75, fontSize: 14, color: C.panel });
  });
  line(s, MX, 5.7, R, 5.7, C.ink2, { w: 1 });
  T(s, [{ text: "스포츠산업 시사점   ", options: { bold: true, color: C.noteT } }, { text: "생활체육 시설과 동호회는 운동을 제공하는 동시에 관계를 만드는 곳이 될 수 있다. 결합 프로그램의 효과는 중재연구로 확인할 과제다.", options: { color: C.panel } }],
    { x: MX, y: 5.9, w: CW, h: 0.8, fontSize: 14 });
}

// ================================================================ 15. 한계와 계획
pres.addSection({ title: "마무리" });
{
  const s = slide("LIGHT", "마무리", "한계를 분명히 하고, 피드백을 반영해 마무리한다",
    "가장 큰 한계는 횡단면 자료라는 점입니다. 우울해서 운동이나 교류가 줄었을 가능성을 배제할 수 없습니다. 모든 변수가 자기보고이고, 2025년 조사에는 좌식행동 문항이 없었습니다. 남은 기간에는 오늘 피드백을 반영해 분석을 확정하고 논문을 마무리하겠습니다.");
  strip(s, "마무리");
  T(s, "한계", { x: MX, y: 1.95, w: 5, h: 0.35, fontSize: 16, bold: true });
  [["횡단면 자료", "역인과 가능성 — 모든 결과를 관련 요인으로 서술"], ["자기보고 측정", "PHQ-9 기준 충족은 임상 진단이 아님"], ["측정되지 않은 요인", "좌식행동 문항 없음, 식생활은 아침식사로 대리"], ["청년층 낮은 성능", "AP가 가장 낮아 조사 밖 요인이 클 가능성"]].forEach(([h, b], i) => {
    const y = 2.45 + i * 0.9;
    box(s, MX, y + 0.05, 0.08, 0.68, C.risk, { rect: true });
    T(s, h, { x: MX + 0.3, y, w: 5.3, h: 0.36, fontSize: 15, bold: true });
    T(s, b, { x: MX + 0.3, y: y + 0.38, w: 5.3, h: 0.34, fontSize: 13, color: C.muted });
  });
  T(s, "남은 계획", { x: 6.85, y: 1.95, w: 5, h: 0.35, fontSize: 16, bold: true });
  const steps = [["완료", "분석 v2.1, 논문 초안 v2.1", true], ["다음", "오늘 피드백을 분석·원고에 반영", false], ["다음", "저자 기재 항목(IRB 심의면제, 코드 공개) 확정", false], ["최종", "논문 최종본 제출과 최종 발표", false]];
  line(s, 7.07, 2.6, 7.07, 2.6 + 3 * 0.88, C.rule, { w: 2 });
  steps.forEach(([t, b, done], i) => {
    const y = 2.45 + i * 0.88;
    s.addShape(pres.shapes.OVAL, { x: 6.92, y: y + 0.0, w: 0.3, h: 0.3, fill: { color: done ? C.reg : C.canvas }, line: { color: done ? C.reg : C.soft, width: 2 } });
    T(s, t, { x: 7.4, y: y - 0.02, w: 1, h: 0.34, fontSize: 12, bold: true, color: done ? C.reg : C.muted, valign: "middle" });
    T(s, b, { x: 8.25, y: y - 0.02, w: 4.48, h: 0.6, fontSize: 14 });
  });
}

// ================================================================ 16. 정리
{
  const s = slide("COVER", "마무리", null, "네 가지 질문에 대한 답을 한 줄씩 정리하겠습니다. 질문 주시면 부록 자료로 답변드리겠습니다.");
  T(s, "정리 — 질문 넷, 답 넷", { x: MX, y: 0.75, w: 8, h: 0.4, fontSize: 15, color: C.soft });
  T(s, "우울 증상은 여러 영역이 함께 관련되는 복합 현상이다", { x: MX, y: 1.2, w: CW, h: 0.85, fontSize: 30, bold: true, color: C.canvas, valign: "middle" });
  [[1, "모든 영역이 고유한 정보를 더하고, 신체건강의 기여가 가장 크다"], [2, "바꿀 수 있는 위험 요인: 식품 불안정, 구강 문제, 미충족 의료, 사회적 단절, 흡연, 아침 결식"],
    [3, "청년은 생활습관, 중장년은 경제, 노년은 신체건강과 의료접근"], [4, `신체활동과 생활요인을 함께 지킬수록 우울 비율이 낮다 (${first.k} ${pct(first.prev)} → ${last.k} ${pct(last.prev)})`]].forEach(([k, b], i) => {
    const y = 2.4 + i * 0.92;
    box(s, MX, y, CW, 0.78, C.ink2);
    T(s, `RQ${k}`, { x: MX + 0.3, y, w: 0.8, h: 0.78, fontSize: 15, bold: true, color: C.mint, valign: "middle" });
    T(s, b, { x: MX + 1.25, y, w: 10.7, h: 0.78, fontSize: 17, color: C.canvas, valign: "middle" });
  });
  T(s, "질의응답", { x: MX, y: 6.25, w: 4, h: 0.5, fontSize: 22, bold: true, color: C.noteT });
}

// ================================================================ 부록
pres.addSection({ title: "부록" });
const tblOpt = (colW) => ({ x: MX, y: 1.9, w: CW, colW, fontSize: 14, fontFace: "맑은 고딕", valign: "middle", color: C.ink,
  border: [{ type: "none" }, { type: "none" }, { type: "solid", pt: 0.75, color: C.rule }, { type: "none" }] });
const HD = (t, al = "center") => ({ text: t, options: { bold: true, color: C.muted, fill: { color: C.panel }, align: al } });
{
  const DL = D.domain_labels, ks = ["demo", "econ", "phys", "behav", "social", "env", "care", "proximal"];
  const s = slide("APPX", "부록", "A1. 영역별 변수 구성과 수정 유형 — 바꿀 수 있는 요인의 판정 기준",
    "수정 유형은 국민건강증진종합계획 분야와 대응시켜 정했습니다. A는 본인이 고르는 행동, B는 제도나 지역사회 개입으로 개선할 수 있는 현재 상태, C는 나이·성별·진단처럼 바꿀 수 없는 것입니다.");
  strip(s, "부록");
  const rows = ks.map((k) => { const vs = D.variables.filter((v) => v.domain === k); const c = (t) => String(vs.filter((v) => v.mod_type === t).length);
    return [{ text: DL[k], options: { bold: true, align: "left" } }, String(vs.length), c("A"), c("B"), c("C")]; });
  s.addTable([[HD("영역", "left"), HD("변수"), HD("A 개인 행동"), HD("B 서비스·정책·환경"), HD("C 바꿀 수 없음")], ...rows], { ...tblOpt([2.05, 0.75, 1.4, 1.9, 1.8]), w: 7.9, rowH: 0.47, align: "center" });
  [[C.regT, C.reg, "A 개인 행동", "신체활동, 흡연, 음주, 식생활, 칫솔질, 연락·사회활동, 검진·접종, 수면"], [C.mlT, C.ml, "B 서비스·정책·환경", "소득·식품·경제활동, 체중·구강·낙상, 미충족 의료, 건강정보 이해, 동네 환경·이웃 신뢰"],
    [C.panel, C.muted, "C 바꿀 수 없음", "나이, 성별, 교육, 혼인, 세대유형, 만성질환 진단, 치매환자 가족, 지역·주택유형"]].forEach(([bg, col, h, b], i) => {
    const y = 1.9 + i * 1.42;
    box(s, 8.75, y, 3.98, 1.27, bg);
    T(s, h, { x: 8.95, y: y + 0.12, w: 3.6, h: 0.35, fontSize: 14, bold: true, color: col });
    T(s, b, { x: 8.95, y: y + 0.48, w: 3.6, h: 0.75, fontSize: 12 });
  });
  T(s, "근거: 제6차 국민건강증진종합계획(HP2030). 건강생활 실천 → A, 비만·손상·건강정보 이해·지역사회 자원 → B", { x: MX, y: 6.35, w: CW, h: 0.3, fontSize: 11, color: C.muted });
}
{
  const LF = D.lifestyle_prev;
  const s = slide("APPX", "부록", "A2. 생활요인 선정 대응표 — 선행연구와 국가 계획의 생활 영역",
    "Zhao 등(2023)의 7개 건강 생활 영역과 국민건강증진종합계획의 건강생활 실천 분야를 합친 8개 영역에 조사 문항을 하나씩 대응시켰습니다. 좌식행동은 문항이 없어 빠졌고, 수면은 PHQ-9 수면 문항과 겹쳐 민감도 분석으로만 썼습니다.");
  strip(s, "부록");
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
  strip(s, "부록");
  const rows = Object.entries(D.count_summary).map(([k, v]) => { const r = D.count_sens.filter((x) => x.score === k);
    return [{ text: k, options: { bold: k === "주 분석", align: "left" } }, String(v.n_factors), `${f(v.trend_or, 2)} [${f(v.trend_lo, 2)}, ${f(v.trend_hi, 2)}]`,
      `${r[0].k} ${pct(r[0].prev)}`, `${r[r.length - 1].k} ${pct(r[r.length - 1].prev)}`]; });
  s.addTable([[HD("점수", "left"), HD("요인 수"), HD("1점당 OR [95% CI]"), HD("최저 점수 유병률"), HD("최고 점수 유병률")], ...rows], { ...tblOpt([3.6, 1.2, 2.9, 2.2, 2.233]), rowH: 0.48, align: "center" });
  T(s, "인구·경제·신체건강 조정 조사설계 기반 회귀. 양 끝 점수가 1,000명 미만이면 안쪽 점수와 합침", { x: MX, y: 6.4, w: CW, h: 0.3, fontSize: 11, color: C.muted });
}
{
  const s = slide("APPX", "부록", "A4. 임계값을 정하면 — 민감도와 정밀도는 맞바꾸는 관계다",
    "모형을 실제 판정에 쓴다면 목적에 따라 임계값을 정해야 합니다. 시험셋을 가구 단위로 반으로 나눠 한쪽에서 임계값을 정하고 다른 쪽에서 평가했습니다.");
  strip(s, "부록");
  const rows = D.operating_points.map((o) => [{ text: o.rule, options: { align: "left", bold: o.rule.includes("Han") } }, f(o.thr, 3), pct(o.flag), pct(o.sens), pct(o.spec), pct(o.ppv), n0(o.per10k.fn)]);
  s.addTable([[HD("임계값 기준", "left"), HD("임계 확률"), HD("고위험 판정"), HD("민감도"), HD("특이도"), HD("정밀도"), HD("놓친 우울/1만 명")], ...rows], { ...tblOpt([3.6, 1.3, 1.5, 1.3, 1.3, 1.3, 1.833]), rowH: 0.56, align: "center" });
  T(s, `CatBoost 주 분석, 시험셋 ${n0(N.test)}명. Han & Park(2025)의 판정 비율 18.4%는 그 논문의 정확도·macro 재현율·시험셋 인원에서 역산`, { x: MX, y: 6.4, w: CW, h: 0.3, fontSize: 11, color: C.muted });
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("생성:", OUT);
})();
