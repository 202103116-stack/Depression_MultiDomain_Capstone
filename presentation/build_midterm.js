/**
 * 중간발표 통합본 — 연구 1(다차원 요인) + 연구 2(경제적 불리함과 생활요인 축적의 역전점)
 * 실행: node presentation/build_midterm.js && python -X utf8 presentation/embed_fonts.py
 * 산출: presentation/midterm_integrated.pptx
 * 구성: 팀 Canva 구조안(우울연구 자체제작.pptx)의 순서와 주석 요청을 따른다.
 * 디자인: presentation/design/BRAND_midterm.md
 * 수치: 연구 1 = paper/paper_data.json, 연구 2 = presentation/v3_report_data.json(v3-econ-reversal 브랜치 report_v3/report_data.json 사본)
 * 결과변수는 실제 분석 기준인 PHQ-9 ≥ 10으로 적고, PHQ-9 ≥ 5 전환은 피드백 반영 결정으로만 적는다(수치 없음).
 */
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require(path.join(__dirname, "apply_theme.js"));

const ROOT = path.resolve(__dirname, "..");
const D = JSON.parse(fs.readFileSync(path.join(ROOT, "paper", "paper_data.json"), "utf-8"));
const V = JSON.parse(fs.readFileSync(path.join(__dirname, "v3_report_data.json"), "utf-8"));
const N = D.n;
const OUT = path.join(__dirname, "midterm_integrated.pptx");
const P = (...a) => path.join(__dirname, ...a);

// ---------------------------------------------------------------- 브랜드 토큰 (BRAND_midterm.md)
const F = { disp: "강한놈소프트보일드", body: "210 디딤고딕", bodyB: "210 디딤고딕 Bold", small: "JASO Sans", page: "Poppins Medium", num: "Nanum Square Ultra-Bold" };
const C = {
  brand: "3A59D1", light: "5271FF", s1: "0025CC", s2: "00BF63", ink: "222222", muted: "5B6472", rule: "C9CED6",
  bg: "F5F5F5", white: "FFFFFF", tint: "EEF1FC", tintG: "E6F8EF", risk: "E8603C", badge: "1D2430", soft: "A9B2C0",
};
const THEME = {
  name: "Depression Midterm", headFontFace: F.disp, bodyFontFace: F.body,
  colors: { dk1: C.ink, lt1: C.white, dk2: C.badge, lt2: C.bg, accent1: C.brand, accent2: C.s2, accent3: C.light, accent4: C.risk, accent5: C.muted, accent6: C.s1, hlink: C.brand, folHlink: C.muted },
};

const pres = new pptxgen();
pres.defineLayout({ name: "CANVA", width: 20, height: 11.25 });
pres.layout = "CANVA";
pres.theme = { headFontFace: F.disp, bodyFontFace: F.body };
pres.title = "성인 우울 증상의 다차원적 관련 요인 분석 — 중간발표";
pres.author = "Depression_MultiDomain_Capstone";
const MX = 0.8, R = 19.2, CW = R - MX;

const f = (x, k = 1) => Number(x).toFixed(k);
const pct = (x, k = 1) => `${Number(x).toFixed(k)}%`;
const n0 = (x) => Number(x).toLocaleString("en-US");
const pp = (x, k = 1) => `${x > 0 ? "+" : "−"}${Math.abs(x).toFixed(k)}`;

// ---------------------------------------------------------------- 틀
pres.defineSlideMaster({
  title: "BRAND", background: { color: C.bg },
  objects: [
    { rect: { x: 0, y: 0, w: 20, h: 0.1, fill: { color: C.brand }, line: { color: C.brand } } },
    { rect: { x: 0, y: 11.15, w: 20, h: 0.1, fill: { color: C.brand }, line: { color: C.brand } } },
  ],
});

let PAGE = 0;
// 위쪽 목차 탭: 지금 진행 중인 장만 강조하고 나머지는 흐리게(표지·목차 장은 생략, 부록은 모두 흐리게)
const TABS = [["01 연구 배경", "01 연구 배경"], ["02 선행연구·이론", "02 선행연구·이론"], ["03 연구 목적·질문", "03 목적·질문"], ["04 연구 모형·방법", "04 모형·자료·방법"], ["05 예비 분석", "05 예비 분석"], ["06 핵심 결과·의의", "06 결과·의의"]];
const tabs = (s, section) => {
  const w = (CW - 0.1 * (TABS.length - 1)) / TABS.length;
  TABS.forEach(([sec, label], i) => {
    const on = sec === section;
    s.addText(label, { isTextBox: true, shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.08, x: MX + i * (w + 0.1), y: 0.2, w, h: 0.36, align: "center", valign: "middle", margin: 0,
      fontFace: on ? F.bodyB : F.body, bold: on, fontSize: 12.5, color: on ? C.white : "9AA3B2", fill: { color: on ? C.brand : "E6E9F0" }, line: { color: on ? C.brand : "E6E9F0" } });
  });
};
const slide = (section, notes) => {
  const s = pres.addSlide({ masterName: "BRAND", sectionTitle: section });
  PAGE += 1;
  if (section !== "표지·목차") tabs(s, section);
  s.addShape(pres.shapes.RIGHT_TRIANGLE, { x: 17.75, y: 10.45, w: 0.7, h: 0.72, flipH: true, fill: { color: C.brand }, line: { color: C.brand } });
  s.addText(`PAGE ${String(PAGE).padStart(2, "0")}`, { isTextBox: true, shape: pres.shapes.RECTANGLE, x: 18.43, y: 10.45, w: 1.57, h: 0.72, fill: { color: C.brand }, line: { color: C.brand },
    fontFace: F.page, fontSize: 15, color: C.white, align: "center", valign: "middle", margin: 0 });
  if (notes) s.addNotes(notes);
  return s;
};
const T = (s, t, o = {}) => s.addText(t, { isTextBox: true, margin: 0, fontFace: F.body, fontSize: 16, color: C.ink, valign: "top", ...o });
const B = (t, o = {}) => ({ text: t, options: { fontFace: F.bodyB, bold: true, ...o } });
const box = (s, x, y, w, h, o = {}) => s.addShape(o.rect ? pres.shapes.RECTANGLE : pres.shapes.ROUNDED_RECTANGLE, {
  x, y, w, h, rectRadius: o.rect ? undefined : (o.r ?? 0.12), fill: { color: o.fill || C.white }, line: { color: o.line || o.fill || C.white, width: o.lw ?? 1.5, dashType: o.dash || "solid" } });
const card = (s, x, y, w, h, col = C.light, fill = C.white) => box(s, x, y, w, h, { fill, line: col, lw: 1.5 });
const line = (s, x1, y1, x2, y2, o = {}) => s.addShape(pres.shapes.LINE, {
  x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1) || 0.001, h: Math.abs(y2 - y1) || 0.001,
  flipV: (y2 < y1) !== (x2 < x1), line: { color: o.color || C.rule, width: o.w || 1, endArrowType: o.arrow, dashType: o.dash || "solid" } });
const arrow = (s, x1, y1, x2, y2, col = C.brand) => line(s, x1, y1, x2, y2, { color: col, w: 2.25, arrow: "triangle" });
const pill = (s, text, x, y, o = {}) => s.addText(text, { isTextBox: true, shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.2,
  x, y, w: o.w || Math.max(1, text.length * 0.2 + 0.5), h: o.h || 0.42, align: "center", valign: "middle", margin: 0,
  fontFace: F.bodyB, bold: true, fontSize: o.size || 14, color: o.color || C.white, fill: { color: o.fill || C.brand }, line: { color: o.line || o.fill || C.brand, width: 1.25 } });
const num = (s, n, x, y, d = 0.5, fill = C.brand) => s.addText(String(n), { isTextBox: true, shape: pres.shapes.OVAL, x, y, w: d, h: d,
  align: "center", valign: "middle", margin: 0, fontFace: F.num, fontSize: d > 0.45 ? 18 : 14, color: C.white, fill: { color: fill }, line: { color: fill } });
const sub = (s, t, x, y, w, col = C.light, size = 24) => T(s, t, { x, y, w, h: 0.5, fontFace: F.disp, fontSize: size, color: col, valign: "middle" });
const readBar = (s, label, text, y = 9.75, x = MX, w = CW) => {
  box(s, x, y, w, 0.55, { fill: C.tint, line: C.tint });
  T(s, [B(`${label}   `, { color: C.brand }), { text, options: { color: C.ink } }], { x: x + 0.25, y, w: w - 0.5, h: 0.55, fontSize: 14, valign: "middle" });
};
const foot = (s, t, y = 10.62) => T(s, t, { x: MX, y, w: 16.6, h: 0.34, fontFace: F.small, fontSize: 11.5, color: C.muted, valign: "middle" });
const PRE1 = "예비 분석: 결과변수 PHQ-9 ≥ 10 기준 결과. 피드백에 따라 본분석은 PHQ-9 ≥ 5로 진행";
const PRE2 = "예비 분석: 결과변수 PHQ-9 ≥ 10, 생활요인 7개(이전 정의) 기준 결과. 본분석은 PHQ-9 ≥ 5와 연구 1의 생활요인 선정 기준으로 진행";

// 장 제목: ✓ + 제목 + 구분선. rq가 있으면 제목 오른쪽에 RQ 배지와 질문
const title = (s, t, o = {}) => {
  s.addImage({ path: P("assets", "user_image6.png"), x: MX, y: 1.0, w: 0.42, h: 0.32, altText: "체크 표시" });
  T(s, t, { x: 1.4, y: 0.68, w: o.w || 12, h: 0.95, fontFace: F.disp, fontSize: 40, valign: "middle" });
  if (o.rq) {
    pill(s, `RQ${o.rq}`, o.rqx || 5.0, 0.93, { w: 1.05, h: 0.45, fill: C.badge, size: 15 });
    T(s, RQS[o.rq], { x: (o.rqx || 5.0) + 1.25, y: 0.93, w: 9.6, h: 0.45, fontSize: 16, color: C.muted, valign: "middle" });
  }
  if (o.study) {
    const [t2, col, fill] = o.study === 1 ? ["연구 1  다차원 요인", C.s1, C.white] : ["연구 2  경제적 격차·역전점", C.s2, C.white];
    pill(s, t2, R - (o.study === 1 ? 2.9 : 3.6), 0.93, { w: o.study === 1 ? 2.9 : 3.6, h: 0.45, fill, line: col, color: col, size: 14 });
  }
  line(s, MX, 1.7, R, 1.7, { color: C.rule, w: 1 });
};
const headline = (s, t, y = 1.8, x = MX, w = CW, size = 24) => T(s, t, { x, y: y + 0.05, w, h: 0.6, fontFace: F.bodyB, bold: true, fontSize: size, valign: "middle" });

// 그림: 원본 비율을 지켜 (x, y, maxW, maxH) 안에 맞추고 실제 크기를 돌려준다
const pngSize = (file) => { const b = fs.readFileSync(file); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const fig = (s, rel, x, y, maxW, maxH, alt, align = "left") => {
  const file = P(...rel.split("/")), [pw, ph] = pngSize(file), r = pw / ph;
  let w = maxW, h = w / r;
  if (h > maxH) { h = maxH; w = h * r; }
  const xx = align === "center" ? x + (maxW - w) / 2 : align === "right" ? x + maxW - w : x;
  s.addImage({ path: file, x: xx, y, w, h, altText: alt });
  return { x: xx, y, w, h };
};
const TBL = { fontFace: F.body, fontSize: 13, color: C.ink, valign: "middle", border: { type: "solid", pt: 0.75, color: C.rule } };
const HD = (t, fill = C.brand, color = C.white, al = "center") => ({ text: t, options: { fontFace: F.bodyB, bold: true, fill: { color: fill }, color, align: al } });
const CELL = (t, o = {}) => ({ text: t, options: { fill: { color: o.fill || C.white }, fontFace: o.b ? F.bodyB : F.body, bold: !!o.b, color: o.color || C.ink, align: o.al || "left" } });

const RQS = {
  1: "우울 증상과 관련된 주요 요인과 영역별 추가 예측 기여는 무엇인가",
  2: "그중 바꿀 수 있는 요인은 무엇인가",
  3: "건강 생활요인 충족과 우울 증상의 관련은 경제적 수준에 따라 달라지는가",
  4: "불리 집단이 생활요인을 많이 충족하면 우울 비율이 유리 집단보다 낮아지는가",
};

// ---------------------------------------------------------------- 연구 2 수치
const IND = { income: "균등화 소득", livelihood: "기초생활수급", food: "가구 식품안정성" };
const GRP = { income: ["하위 20%", "상위 20%"], livelihood: ["현재 수급", "비수급"], food: ["불안정", "안정"] };
const inter = Object.fromEntries(V.interaction.map((r) => [r.indicator, r]));
const sens = (ind, sub = "전체", spec = "주 분석") => V.sensitivity.find((r) => r.indicator === ind && r.subgroup === sub && r.spec === spec);
const cell = (ind, grpIdx, bin) => {
  const g = V.cells.filter((c) => c.indicator === ind && c.spec === "주 분석");
  const groups = [...new Set(g.map((c) => c.group))];
  const name = grpIdx === 0 ? groups[0] : groups[groups.length - 1];
  return g.find((c) => c.group === name && c.bin === bin);
};
const prevEcon = (ind, level) => V.prev_by_econ.find((r) => r.indicator === ind && r.level === level).prev_w * 100;
const rate = (group, factor) => V.factor_rates.find((r) => r.indicator === "income" && r.group === group && r.factor === factor);
const decomp = (ind) => V.decomposition.find((r) => r.indicator === ind && r.method === "연령 표준화 분포");
const s2 = (comp, group) => V.s2.find((r) => r.indicator === "income" && r.model === "상호 조정" && r.component === comp && r.group === group);
// 연령 표준화 생활요인 평균 개수(4.30 vs 4.69)와 조율 평균(4.63 vs 4.56)은 집계표에 없어 docs/v3/WORKFLOW_v3.md 3절 값을 쓴다
const V3_TEXT = { meanCrude: [4.63, 4.56], meanStd: [4.30, 4.69] };

const cb = D.algos.catboost.full;

// ================================================================ 1. 표지
pres.addSection({ title: "표지·목차" });
{
  const s = slide("표지·목차", "안녕하십니까. 저희 팀은 2025년 지역사회건강조사로 성인 우울 증상의 다차원적 관련 요인을 분석했고, 그 결과에서 출발해 경제적으로 불리한 집단에서 건강 생활요인을 많이 지키면 우울 증상 비율이 어떻게 달라지는지를 후속 연구로 살펴보았습니다. 두 연구를 이어서 말씀드리겠습니다.");
  T(s, "성인 우울 증상의 다차원적 관련 요인 분석", { x: 0.7, y: 1.35, w: 18.6, h: 1.25, fontFace: F.disp, fontSize: 62, valign: "middle" });
  T(s, "경제적 불리함에 따른 우울 유병률 역전 가능성의 탐색", { x: 0.7, y: 2.75, w: 18.6, h: 1.1, fontFace: F.disp, fontSize: 48, color: C.brand, valign: "middle" });
  [["연구 1", "다차원 요인 탐색", "8개 영역 66개 변수, 머신러닝 + 조사설계 회귀", C.s1], ["연구 2", "경제적 격차와 역전점", "경제 지표 3개 × 건강 생활요인 충족 개수", C.s2]].forEach(([a, b, c, col], i) => {
    const x = 0.9 + i * 6.5;
    card(s, x, 4.6, 5.9, 1.55, col);
    T(s, [B(`${a}  `, { color: col, fontSize: 20 }), { text: b, options: { fontFace: F.bodyB, fontSize: 20 } }], { x: x + 0.3, y: 4.75, w: 5.4, h: 0.5 });
    T(s, c, { x: x + 0.3, y: 5.35, w: 5.4, h: 0.6, fontSize: 15, color: C.muted });
  });
  arrow(s, 6.9, 5.375, 7.3, 5.375);
  T(s, "2025년 지역사회건강조사 자료 활용", { x: 1.1, y: 7.1, w: 10, h: 0.45, fontSize: 18 });
  T(s, "김대영, 이예람, 정승엽, 채연지, 최재훈", { x: 1.1, y: 7.6, w: 10, h: 0.55, fontFace: F.bodyB, fontSize: 22 });
}

// ================================================================ 2. 목차
{
  const s = slide("표지·목차", "발표는 여섯 부분입니다. 연구 배경, 선행연구와 이론, 연구 목적과 질문, 연구 모형과 자료·방법, 예비 분석 결과, 그리고 핵심 결과와 의의 순서입니다.");
  s.addImage({ path: P("assets", "user_image1.png"), x: 1.12, y: 0.65, w: 8.1, h: 4.56, altText: "목차 사진 1" });
  s.addImage({ path: P("assets", "user_image2.png"), x: 1.12, y: 5.27, w: 8.1, h: 4.56, altText: "목차 사진 2" });
  T(s, [{ text: "Table of", options: { breakLine: true } }, { text: "Contents" }], { x: 9.85, y: 1.0, w: 5.6, h: 2.3, fontFace: F.disp, fontSize: 66, color: C.brand, valign: "middle" });
  T(s, "목차", { x: 15.3, y: 2.25, w: 2.5, h: 0.9, fontFace: F.disp, fontSize: 44, valign: "middle" });
  [["01", "연구 배경 및 필요성", 3], ["02", "선행연구 및 이론적 배경", 4], ["03", "연구 목적 및 질문", 6], ["04", "연구 모형 및 가설", 7], ["05", "예비 분석", 10], ["06", "핵심 결과 및 연구 의의", 16]].forEach(([n, t, p], i) => {
    const y = 4.0 + i * 0.93;
    T(s, n, { x: 10.0, y, w: 0.8, h: 0.55, fontFace: F.disp, fontSize: 22, color: C.brand, valign: "middle" });
    T(s, t, { x: 10.75, y, w: 5.3, h: 0.55, fontFace: F.disp, fontSize: 26, valign: "middle" });
    line(s, 16.3, y + 0.28, 18.7, y + 0.28, { color: C.rule });
    T(s, `${p}p`, { x: 18.85, y, w: 0.9, h: 0.55, fontFace: F.disp, fontSize: 20, color: C.muted, valign: "middle" });
  });
}

// ================================================================ 3. 연구 배경 및 필요성
pres.addSection({ title: "01 연구 배경" });
{
  const s = slide("01 연구 배경", `우울증으로 진료받은 사람은 2021년 91만 명에서 2025년 114만 명으로 4년 사이 25% 늘었습니다. 2025년 지역사회건강조사에서도 성인의 ${pct(N.prev_w, 2)}가 PHQ-9 기준 우울 증상을 보였습니다. 우울은 신체건강, 경제, 사회관계, 환경 같은 여러 조건과 함께 관련되기 때문에, 연구 1에서 여러 영역을 한 번에 비교했습니다. 그 결과 경제 영역과 건강 생활요인이 모두 독립적으로 관련되어, 연구 2에서 둘의 관계를 구체적으로 물었습니다.`);
  title(s, "연구 배경 & 필요성");
  headline(s, "왜 우울 증상에 관심을 가졌는가 — 늘어나는 우울, 하나의 원인으로 설명되지 않는 구조");
  // ① 주제 선정 배경
  card(s, MX, 2.55, 7.4, 3.6);
  num(s, 1, MX + 0.3, 2.75); sub(s, "주제 선정 배경", MX + 0.95, 2.75, 5);
  T(s, "우울증 진료 환자 수", { x: MX + 0.3, y: 3.4, w: 4, h: 0.4, fontFace: F.bodyB, fontSize: 17 });
  s.addChart(pres.charts.BAR, [{ name: "진료 환자 수", labels: ["2021년", "2025년"], values: [910785, 1138230] }], {
    x: MX + 0.2, y: 3.8, w: 4.2, h: 1.9, barDir: "col", chartColors: [C.soft, C.brand], barGapWidthPct: 45, valAxisHidden: true, valGridLine: { style: "none" },
    catGridLine: { style: "none" }, showValue: false,
    catAxisLabelFontFace: F.body, catAxisLabelFontSize: 13, catAxisLabelColor: C.ink, valAxisMinVal: 0, valAxisMaxVal: 1300000, catAxisLineShow: false, showLegend: false });
  T(s, "25% ↑", { x: MX + 4.5, y: 3.9, w: 2.8, h: 1.0, fontFace: F.disp, fontSize: 48, color: C.brand, valign: "middle" });
  T(s, [{ text: "2021년 910,785명", options: { breakLine: true } }, { text: "2025년 1,138,230명" }], { x: MX + 4.5, y: 4.95, w: 2.8, h: 0.75, fontSize: 14 });
  T(s, "출처: 건강보험심사평가원 2021~2025 청구 현황(최보윤 의원실, 2026)", { x: MX + 0.3, y: 5.75, w: 6.9, h: 0.3, fontFace: F.small, fontSize: 11, color: C.muted });
  // ② 다양한 조건
  card(s, MX, 6.35, 7.4, 3.3);
  num(s, 2, MX + 0.3, 6.55); sub(s, "우울 증상은 다양한 조건과 관련", MX + 0.95, 6.55, 6);
  [["신체·행동", "신체건강, 신체활동, 건강습관"], ["사회·경제", "소득, 고용, 사회관계"], ["환경·접근성", "생활환경, 의료접근"]].forEach(([a, b], i) => {
    const x = MX + 0.3 + i * 2.3;
    box(s, x, 7.2, 2.15, 1.05, { fill: C.tint, line: C.light, lw: 1, r: 0.06 });
    T(s, a, { x: x + 0.1, y: 7.28, w: 1.95, h: 0.4, fontFace: F.bodyB, fontSize: 14, align: "center" });
    T(s, b, { x: x + 0.1, y: 7.68, w: 1.95, h: 0.5, fontSize: 11.5, color: C.muted, align: "center" });
  });
  arrow(s, MX + 3.7, 8.32, MX + 3.7, 8.6);
  T(s, [B("본 연구의 출발점  ", { color: C.brand }), { text: "여러 생활영역을 함께 고려하고, 경제적 조건에 따른 차이를 검토한다" }], { x: MX + 0.3, y: 8.65, w: 6.9, h: 0.85, fontSize: 15, valign: "middle", align: "center" });
  // ③ 연구 목적
  card(s, 8.55, 2.55, R - 8.55, 7.1);
  num(s, 3, 8.85, 2.75); sub(s, "연구 목적 및 필요성", 9.5, 2.75, 8);
  T(s, "우울 증상의 다차원적 관련성을 확인하고, 이를 경제적 격차 분석으로 구체화한다", { x: 8.85, y: 3.4, w: 10.1, h: 0.5, fontFace: F.bodyB, fontSize: 18 });
  const block = (y, col, tint, lab, q, items) => {
    box(s, 8.85, y, 10.05, 2.35, { fill: tint, line: tint, r: 0.08 });
    T(s, lab, { x: 9.1, y: y + 0.15, w: 9.6, h: 0.5, fontFace: F.disp, fontSize: 24, color: col, valign: "middle" });
    T(s, q, { x: 9.1, y: y + 0.7, w: 9.6, h: 0.45, fontFace: F.bodyB, fontSize: 17 });
    T(s, items.map((t, i) => ({ text: t, options: { bullet: { indent: 18 }, breakLine: i < items.length - 1 } })), { x: 9.1, y: y + 1.2, w: 9.6, h: 1.05, fontSize: 15, paraSpaceAfter: 3 });
  };
  block(4.05, C.s1, C.tint, "연구 1  다차원적 탐색", "어떤 영역과 요인이 우울 증상과 관련되는가?", ["우울 증상과 관련된 주요 요인과 영역별 추가 예측 정보 기여도", "그중 바꿀 수 있는(수정 가능한) 요인"]);
  arrow(s, 13.85, 6.45, 13.85, 6.85, C.muted);
  T(s, "경제 영역과 건강 생활요인이 모두 독립적으로 관련 → 둘의 관계를 다음 질문으로", { x: 14.05, y: 6.42, w: 5, h: 0.45, fontFace: F.small, fontSize: 11.5, color: C.muted, valign: "middle" });
  block(6.95, C.s2, C.tintG, "연구 2  경제적 격차 분석", "생활요인 충족에 따른 유병률 감소는 경제적 조건과 어떻게 관련되는가?", ["경제적 수준(소득·수급·식품안정성)별 생활요인 충족 개수와 우울 증상", "경제 집단 간 우울 유병률 격차와 역전 가능성 검토"]);
  foot(s, `2025 지역사회건강조사: 성인 ${pct(N.prev_w, 2)}가 우울 증상 기준 충족(PHQ-9 ≥ 10, 가중)`);
}

// ================================================================ 4. 이론적 배경
pres.addSection({ title: "02 선행연구·이론" });
{
  const s = slide("02 선행연구·이론", "이론적 배경은 두 갈래입니다. 연구 1은 생물심리사회 모형과 사회생태학적 관점을 근거로 신체·심리·사회·환경 영역을 함께 넣었습니다. 연구 2는 자원 대체와 자원 증폭이라는 서로 반대 방향의 가설, 그리고 근본 원인 이론을 근거로 합니다. 생활요인의 관련이 불리 집단에서 더 크면 자원 대체, 유리 집단에서 더 크면 자원 증폭입니다. 방향은 미리 정하지 않고 두 가설을 함께 검토했습니다.");
  title(s, "선행연구 및 이론적 배경");
  const panel = (x, w, n, head, col, cols, apply, note) => {
    card(s, x, 1.95, w, 8.55, col);
    num(s, n, x + 0.3, 2.15); sub(s, head, x + 0.95, 2.15, w - 1.2, col);
    const cw = (w - 0.6 - (cols.length - 1) * 0.3) / cols.length;
    cols.forEach(([h, body, expect, cite], i) => {
      const cx = x + 0.3 + i * (cw + 0.3);
      if (i) line(s, cx - 0.15, 2.95, cx - 0.15, 6.55);
      T(s, h, { x: cx, y: 2.9, w: cw, h: 0.5, fontFace: F.disp, fontSize: 21, color: col, valign: "middle" });
      T(s, body, { x: cx, y: 3.45, w: cw, h: 1.3, fontSize: 15 });
      if (expect) { box(s, cx, 4.85, cw, 1.15, { fill: col === C.s2 ? C.tintG : C.tint, line: col === C.s2 ? C.tintG : C.tint, r: 0.06 }); T(s, expect, { x: cx + 0.12, y: 4.9, w: cw - 0.24, h: 1.05, fontSize: 13.5, valign: "middle" }); }
      T(s, cite, { x: cx, y: 6.1, w: cw, h: 0.4, fontFace: F.small, fontSize: 12, color: C.muted });
    });
    arrow(s, x + w / 2, 6.7, x + w / 2, 7.15, col);
    box(s, x + 0.3, 7.25, w - 0.6, 2.15, { fill: col === C.s2 ? C.tintG : C.tint, line: col, lw: 1, r: 0.08 });
    T(s, apply[0], { x: x + 0.55, y: 7.35, w: w - 1.1, h: 0.45, fontFace: F.disp, fontSize: 21, color: col, valign: "middle" });
    T(s, apply[1], { x: x + 0.55, y: 7.85, w: w - 1.1, h: 1.45, fontSize: 15 });
    T(s, note, { x: x + 0.3, y: 9.5, w: w - 0.6, h: 0.8, fontFace: F.small, fontSize: 12, color: C.muted, valign: "middle" });
  };
  panel(MX, 8.6, 1, "다차원적 관련 요인", C.s1, [
    ["생물심리사회 모형", "질병을 생물학적 요인만으로 보지 않고 심리적·사회적 조건을 함께 고려", "적용: 신체건강과 함께 심리·사회 영역을 넣되, 우울과 겹치는 증상근접 변수는 분리", "Engel (1977)"],
    ["사회생태학적 관점", "개인 행동과 대인관계·조직·지역사회·정책 수준의 환경을 함께 고려", "적용: 건강행태(개인)·사회관계(대인)·생활환경(지역)·의료접근(제도)을 영역으로 구성", "McLeroy 등 (1988), Berkman 등 (2000)"]],
    ["연구 1에 적용", "인구·경제·신체건강·건강행태·사회관계·생활환경·의료접근 7개 주 영역을 한 모형에 넣어 영역마다 고유한 정보와 독립적 관련을 비교한다"],
    "이론은 영역 선정의 관점으로 쓰며, 모형 전체나 정책 효과를 직접 검증하지 않는다");
  panel(9.75, R - 9.75, 2, "경제적 자원과 생활요인", C.s2, [
    ["자원 대체", "다른 자원이 부족할수록 남은 자원(건강 생활요인)의 중요성이 커진다", "예상: 생활요인과 낮은 우울의 관련이 경제적 불리 집단에서 더 크다", "Ross & Mirowsky (2006)"],
    ["자원 증폭", "자원이 많을수록 다른 자원의 이점을 더 잘 활용한다", "예상: 생활요인과 낮은 우울의 관련이 경제적 유리 집단에서 더 크다", "Ross & Mirowsky (2006)"],
    ["근본 원인", "사회경제적 조건은 개별 위험요인을 고려해도 건강 격차를 계속 만든다", "예상: 생활요인을 모두 충족해도 경제적 격차가 남을 수 있다", "Link & Phelan (1995)"]],
    ["연구 2에 적용", "경제 집단별로 생활요인 개수에 따른 우울 유병률 감소 폭을 비교하고(대체 vs 증폭), 생활요인을 충분히 충족했을 때 격차가 사라지거나 뒤집히는지(역전점)를 검토한다"],
    "관련성 차이의 방향을 미리 단정하지 않고 두 가설을 함께 검토한다");
}

// ================================================================ 5. 선행연구 정리
{
  const s = slide("02 선행연구·이론", "선행연구를 두 묶음으로 정리했습니다. 해외 코호트 연구는 생활요인 점수와 우울, 그리고 사회경제적 수준과의 상호작용을 보고했지만, 경제 집단끼리 생활요인 단계별 절대 유병률을 비교해 역전을 본 연구는 찾기 어려웠습니다. 국내 지역사회건강조사 연구는 요인을 하나씩 보거나, 스트레스·주관적 건강처럼 우울과 겹치는 변수를 핵심 예측변수로 썼습니다. 이 세 가지 빈틈을 연구 1과 연구 2가 각각 메웁니다.");
  title(s, "선행연구 및 이론적 배경");
  headline(s, "선행연구는 요인을 하나씩 보았고, 영역끼리도 경제 집단끼리도 비교하지 않았다");
  const gapTag = (g) => ({ text: g, options: { fontFace: F.bodyB, color: C.risk, align: "center", fill: { color: C.white } } });
  const tbl = (y, head, rows, col) => {
    T(s, head, { x: MX, y, w: 12.4, h: 0.45, fontFace: F.disp, fontSize: 21, color: col, valign: "middle" });
    s.addTable([[HD("연구", col), HD("자료 및 접근", col), HD("주요 내용", col), HD("빈틈", col)], ...rows.map((r) => [CELL(r[0], { b: true }), CELL(r[1]), CELL(r[2]), gapTag(r[3])])],
      { ...TBL, x: MX, y: y + 0.5, w: 12.4, colW: [2.35, 3.7, 5.4, 0.95], rowH: 0.56, fontSize: 12.5 });
  };
  tbl(2.5, "선행연구 1. 복합 생활요인과 경제적 수준", [
    ["Zhao 등 (2023)", "UK Biobank 287,282명, 7개 생활요인 점수", "생활요인을 많이 지킬수록 우울 발생 위험이 낮음", "③"],
    ["J. Wang 등 (2025)", "UK Biobank 299,310명, 박탈 지수 × 생활요인", "낮은 SES의 우울 위험 HR 1.49, 생활요인이 일부 매개·상호작용", "③"],
    ["Y. Wang 등 (2024)", "24개국 5개 코호트, 50세 이상", "낮은 SES의 우울 위험 HR 1.34, 사회활동·외로움은 일부만 매개", "③"],
    ["Zhang 등 (2021)", "UK Biobank·NHANES, 생활요인 × SES", "건강한 생활습관이 SES 격차(사망·심혈관)를 일부만 줄임", "③"],
  ], C.s2);
  tbl(6.0, "선행연구 2. 국내 지역사회건강조사·다차원 분석", [
    ["Han & Park (2025)", "2022년 자료, ML 변수 선별 + 가중 회귀", "스트레스 OR 9.65, 주관적 건강 OR 3.38을 핵심 위험요인으로 보고", "②"],
    ["G. M. Kim 등 (2025)", "2023년 다문화가족 2,568명, ML·SHAP", "스트레스·극심한 슬픔·주관적 건강이 상위 예측변수", "②"],
    ["Jeong 등 (2023)", "2017년 216,765명, PHQ-9 ≥ 10", "도시·농촌 우울 격차가 저소득 가구에서 더 큼", "①"],
    ["A.-Y. Kim 등 (2025)", "2023년 성인, 신체활동 유형 × 우울 증상", "신체활동 한 영역의 기술 분석", "①"],
  ], C.s1);
  T(s, "단일 요인 근거: 운동(Noetel 등, 2024), 식품 불안정(Pourmotabbed 등, 2020), 구강 건강(Kisely 등, 2016), 노인의 사회 연결망(Lee 등, 2025)", { x: MX, y: 9.45, w: 12.4, h: 0.4, fontFace: F.small, fontSize: 12, color: C.muted, valign: "middle" });
  const gaps = [["빈틈 ①", "영역끼리 비교한 연구가 드물다", "요인을 따로 검증해 한 요인의 관련이 다른 영역 요인 때문인지 가릴 수 없다", "연구 1: 8개 영역 동시 비교"],
    ["빈틈 ②", "우울과 겹치는 변수로 우울을 설명한다", "스트레스·주관적 건강은 PHQ-9 수면·피로 문항과 개념이 겹친다", "연구 1: 증상근접 13개 분리"],
    ["빈틈 ③", "경제 집단 간 '역전'은 보지 않았다", "상호작용·매개는 보고됐지만, 불리 집단이 생활요인을 많이 지킬 때 유리 집단보다 낮아지는지는 검토되지 않았다", "연구 2: 역전점 검토"]];
  gaps.forEach(([t, h, b, a], i) => {
    const y = 2.5 + i * 2.5;
    card(s, 13.6, y, 5.6, 2.3, C.light);
    pill(s, t, 13.85, y + 0.18, { w: 1.25, h: 0.38, fill: "FBE5DD", line: "FBE5DD", color: C.risk, size: 13 });
    T(s, h, { x: 13.85, y: y + 0.62, w: 5.15, h: 0.45, fontFace: F.bodyB, fontSize: 16 });
    T(s, b, { x: 13.85, y: y + 1.05, w: 5.15, h: 0.75, fontSize: 12.5, color: C.muted });
    T(s, `→ ${a}`, { x: 13.85, y: y + 1.8, w: 5.15, h: 0.38, fontFace: F.bodyB, fontSize: 13.5, color: i < 2 ? C.s1 : C.s2, valign: "middle" });
  });
  arrow(s, 13.25, 4.2, 13.55, 4.2, C.risk); arrow(s, 13.25, 7.6, 13.55, 7.6, C.risk);
}

// ================================================================ 6. 연구 목적 및 질문
pres.addSection({ title: "03 연구 목적·질문" });
{
  const s = slide("03 연구 목적·질문", "연구 목적은 우울 증상과 관련된 요인을 여러 생활 영역에서 함께 파악하고, 건강 생활요인을 많이 충족할 때 우울 증상이 줄어드는 정도가 경제적 수준에 따라 다른지 검토하는 것입니다. 질문 1과 2는 연구 1, 질문 3과 4는 연구 2가 답합니다. 오른쪽 표는 질문마다 어떤 방법으로 답하는지 정리한 것입니다.");
  title(s, "연구 목적 및 연구 질문");
  box(s, MX, 1.95, 8.5, 1.75, { fill: C.tint, line: C.light, lw: 1.25 });
  T(s, "연구 목적", { x: MX + 0.3, y: 2.05, w: 3, h: 0.45, fontFace: F.disp, fontSize: 21, color: C.brand, valign: "middle" });
  T(s, "우울 증상과 관련된 요인을 여러 생활 영역에서 함께 파악하고, 건강 생활요인을 많이 충족할수록 우울 증상이 줄어드는 정도가 경제적 수준에 따라 다른지 검토한다", { x: MX + 0.3, y: 2.55, w: 7.9, h: 1.1, fontFace: F.bodyB, fontSize: 16.5 });
  const rqs = [[1, C.s1, "우울 증상과 관련된 주요 요인은 무엇이며, 각 영역은 예측 정보를 얼마나 더하는가?"], [2, C.s1, "그중 바꿀 수 있는(수정 가능한) 요인은 무엇인가?"],
    [3, C.s2, "건강 생활요인 충족 개수와 우울 증상의 관련은 경제적 수준에 따라 달라지는가?"], [4, C.s2, "경제적으로 불리한 집단이 생활요인을 많이 충족하면, 생활요인이 적은 유리 집단보다 우울 증상 비율이 낮아지는 지점(역전점)이 있는가?"]];
  [["연구 1  다차원 요인", C.s1, 3.95], ["연구 2  경제적 격차·역전점", C.s2, 6.85]].forEach(([t, col, y]) => T(s, t, { x: MX, y, w: 8.5, h: 0.45, fontFace: F.disp, fontSize: 20, color: col, valign: "middle" }));
  rqs.forEach(([k, col, q], i) => {
    const y = [4.5, 5.6, 7.4, 8.5][i];
    pill(s, `RQ${k}`, MX, y + 0.05, { w: 1.0, h: 0.42, fill: C.badge, size: 14 });
    T(s, q, { x: MX + 1.2, y, w: 7.3, h: 1.0, fontSize: 16 });
  });
  line(s, 9.75, 2.0, 9.75, 10.2, { color: C.badge, w: 2 });
  s.addShape(pres.shapes.OVAL, { x: 9.65, y: 1.9, w: 0.2, h: 0.2, fill: { color: C.badge }, line: { color: C.badge } });
  s.addShape(pres.shapes.OVAL, { x: 9.65, y: 10.1, w: 0.2, h: 0.2, fill: { color: C.badge }, line: { color: C.badge } });
  T(s, "질문마다 맞는 방법으로 답한다", { x: 10.2, y: 1.95, w: 9, h: 0.5, fontFace: F.bodyB, fontSize: 20, valign: "middle" });
  const ml = (t) => CELL(t, { fill: "E3ECFB", color: "2F5FB3", b: true }), rg = (t) => CELL(t, { fill: "DDF3E8", color: "1F8A5B", b: true }), sb = (t) => CELL(t, { color: C.muted });
  const rq = (k, col) => ({ text: `RQ${k}`, options: { fontFace: F.bodyB, color: C.white, fill: { color: C.badge }, align: "center" } });
  s.addTable([
    [HD("", C.bg, C.ink), HD("머신러닝 — 정보량", "2F5FB3"), HD("조사설계 회귀 — 조정 연관", "1F8A5B")],
    [rq(1), ml("영역 추가·제거 ΔAP, SHAP"), sb("변수별 결합검정으로 확인")],
    [rq(2), sb("SHAP으로 확인"), rg("조정 OR + 수정 유형 A/B")],
    [rq(3), sb("—"), rg("경제 집단 × 생활요인 개수 조정 유병률, 가법·승법 상호작용")],
    [rq(4), sb("—"), rg("역전점 ①② 판정(집단 간 차이 95% CI), 격차 분해")],
  ], { ...TBL, x: 10.2, y: 2.65, w: 9.0, colW: [1.0, 3.6, 4.4], rowH: [0.6, 1.05, 1.05, 1.25, 1.25], fontSize: 14.5, border: { type: "solid", pt: 3, color: C.bg } });
  readBar(s, "읽는 법", "머신러닝은 '모형이 어느 영역·변수에 기대는가', 회귀는 '다른 요인을 고정해도 관련이 남는가, 어느 방향으로 얼마나'", 8.75, 10.2, 9.0);
  T(s, "연구 2는 모집단 추정이 핵심이라 조사설계 회귀만 쓴다", { x: 10.2, y: 9.45, w: 9.0, h: 0.4, fontFace: F.small, fontSize: 12, color: C.muted, valign: "middle" });
}

// ================================================================ 7. 연구 모형 및 가설
pres.addSection({ title: "04 연구 모형·방법" });
{
  const s = slide("04 연구 모형·방법", "연구 모형입니다. 연구 1은 넓게 탐색합니다. 8개 영역 변수를 머신러닝과 조사설계 회귀에 함께 넣어 영역 기여와 바꿀 수 있는 요인을 찾았습니다. 여기서 경제 영역과 건강 생활요인이 모두 독립적으로 관련된다는 결과가 나와, 연구 2에서 경제적 불리함과 생활요인 충족 개수가 우울 증상에 함께 어떻게 관련되는지를 네 가지 가설로 구체화했습니다.");
  title(s, "연구 모형 및 가설");
  // 위 흐름 띠
  [["연구 1", "넓게 탐색", C.s1], ["전환", "경제 영역과 건강 생활요인에 주목", C.brand], ["연구 2", "구체적인 연구문제로 발전", C.s2]].forEach(([a, b, col], i) => {
    const x = MX + i * 6.3;
    box(s, x, 1.85, 5.8, 0.75, { fill: C.white, line: col, lw: 1.5 });
    T(s, [B(`${a}  `, { color: col }), { text: b, options: { fontFace: F.bodyB } }], { x: x + 0.2, y: 1.85, w: 5.4, h: 0.75, fontSize: 17, align: "center", valign: "middle" });
    if (i < 2) arrow(s, x + 5.85, 2.225, x + 6.25, 2.225);
  });
  // 연구 1 흐름도 (왼쪽)
  card(s, MX, 2.9, 8.3, 7.5, C.s1);
  sub(s, "연구 1  다차원 요인 탐색", MX + 0.3, 3.0, 7.5, C.s1, 21);
  const fb = (x, y, w, h, t, o = {}) => { box(s, x, y, w, h, { fill: o.fill || C.white, line: o.line || C.rule, lw: 1, r: 0.06 }); T(s, t, { x: x + 0.12, y, w: w - 0.24, h, fontSize: o.size || 13.5, align: "center", valign: "middle", color: o.color || C.ink, fontFace: o.b ? F.bodyB : F.body }); };
  fb(MX + 1.3, 3.65, 5.7, 0.8, `2025 지역사회건강조사 성인 ${n0(N.analysis)}명`, { b: true });
  arrow(s, MX + 4.15, 4.45, MX + 4.15, 4.75);
  fb(MX + 0.6, 4.75, 7.1, 0.9, `X: 8개 영역 ${N.n_features}개 변수 (주 분석 ${N.n_main_features}개, 증상근접 ${N.n_features - N.n_main_features}개는 비교용)`, { fill: C.tint, line: C.light });
  arrow(s, MX + 2.3, 5.65, MX + 2.3, 6.05); arrow(s, MX + 6.0, 5.65, MX + 6.0, 6.05);
  fb(MX + 0.4, 6.05, 3.6, 1.35, "머신러닝\n가구 단위 분할, 영역 추가·제거 ΔAP, SHAP");
  fb(MX + 4.3, 6.05, 3.6, 1.35, "조사설계 회귀\n53개 동시 조정, 조정 OR, 수정 유형 A/B");
  arrow(s, MX + 2.2, 7.4, MX + 2.2, 7.8); arrow(s, MX + 6.1, 7.4, MX + 6.1, 7.8);
  fb(MX + 0.4, 7.8, 3.6, 1.0, "RQ1 영역 기여·주요 요인", { b: true, color: C.s1 });
  fb(MX + 4.3, 7.8, 3.6, 1.0, "RQ2 바꿀 수 있는 요인", { b: true, color: C.s1 });
  fb(MX + 0.4, 9.05, 7.5, 1.05, "Y: PHQ-9 총점 기준 우울 증상 충족 여부(이진)", { fill: C.badge, line: C.badge, color: C.white, b: true });
  // 가운데 화살표
  arrow(s, 9.2, 6.3, 9.95, 6.3, C.brand);
  T(s, "경제·생활요인\n모두 독립적 관련", { x: 8.95, y: 6.45, w: 1.3, h: 0.9, fontFace: F.small, fontSize: 10.5, color: C.muted, align: "center" });
  // 연구 2 모형 (오른쪽)
  card(s, 10.3, 2.9, R - 10.3, 7.5, C.s2);
  sub(s, "연구 2  경제적 불리함 × 건강 생활요인 → 우울 증상", 10.6, 3.0, 8.4, C.s2, 21);
  fb(10.6, 3.75, 3.4, 1.55, "경제적 불리\n소득 하위 20% · 기초생활수급 · 식품 불안정", { fill: "FBE5DD", line: C.risk, b: true, size: 13 });
  fb(10.6, 5.6, 3.4, 1.55, "건강 생활요인 충족 개수\n0~2 / 3 / 4 / 5 / 6~7개", { fill: C.tintG, line: C.s2, b: true, size: 13 });
  fb(16.0, 4.65, 2.9, 1.55, "우울 증상\nPHQ-9 기준", { fill: C.badge, line: C.badge, color: C.white, b: true, size: 15 });
  arrow(s, 14.0, 4.5, 16.0, 5.1, C.risk); arrow(s, 14.0, 6.4, 16.0, 5.75, C.s2);
  line(s, 15.0, 4.8, 15.0, 6.05, { color: C.brand, w: 1.5, dash: "dash" });
  T(s, "H1", { x: 14.3, y: 4.15, w: 0.6, h: 0.35, fontFace: F.bodyB, fontSize: 13, color: C.risk });
  T(s, "H2", { x: 14.3, y: 6.3, w: 0.6, h: 0.35, fontFace: F.bodyB, fontSize: 13, color: C.s2 });
  T(s, "H3·H4\n조절", { x: 15.1, y: 5.05, w: 0.9, h: 0.7, fontFace: F.bodyB, fontSize: 12, color: C.brand });
  T(s, "조정변수: 인구 5개 + 신체건강 9개", { x: 10.6, y: 7.25, w: 8.3, h: 0.35, fontFace: F.small, fontSize: 12, color: C.muted });
  [["H1", "격차", "경제적 불리 집단의 우울 증상 유병률이 더 높다"], ["H2", "기울기", "생활요인을 많이 충족할수록 두 집단 모두 유병률이 낮다"],
    ["H3", "자원 대체", "감소 폭은 불리 집단에서 더 크다(대립: 자원 증폭)"], ["H4", "역전", "불리 집단이 생활요인을 많이 충족하면, 생활요인이 적은 유리 집단보다 낮다"]].forEach(([h, a, b], i) => {
    const y = 7.7 + i * 0.64;
    pill(s, h, 10.6, y + 0.06, { w: 0.75, h: 0.4, fill: C.s2, size: 13 });
    T(s, [B(`${a}  `, { color: C.s2 }), { text: b }], { x: 11.5, y, w: 7.5, h: 0.52, fontSize: 14, valign: "middle" });
  });
}

// ================================================================ 8. 연구 자료
{
  const DL = D.domain_labels, cnt = (k) => D.variables.filter((v) => v.domain === k).length;
  const s = slide("04 연구 모형·방법", `원자료는 19개 조사영역, 169개 문항, 201개 변수입니다. 그중 103개를 사용했고 원시변수 86개를 66개 분석변수로 다듬었습니다. 오른쪽은 설명변수 X와 결과변수 Y를 나눈 것입니다. 연구 1의 X는 8개 영역 66개 변수, 연구 2의 X는 경제 지표 세 가지와 생활요인 충족 개수입니다. Y는 지금 예비 분석에서는 PHQ-9 10점 이상이고, 피드백에 따라 본분석은 5점 이상으로 바꿉니다.`);
  title(s, "연구 자료 및 분석 방법");
  headline(s, `성인 ${n0(Math.round(N.analysis / 10000))}만 명, 원자료 201개 변수에서 8개 영역 ${N.n_features}개 분석 변수로`);
  // 왼쪽: 원자료 구성
  card(s, MX, 2.55, 7.6, 7.85);
  sub(s, "원자료는 어떻게 구성되어 있었나", MX + 0.3, 2.65, 7, C.light, 20);
  const steps = [["201", "원시변수", "19개 조사영역 · 169개 문항"], ["103", "사용한 변수", "원시변수 86개를 분석에 투입"], [String(N.n_features), "분석 변수", "파생·재코딩 후 8개 영역"]];
  steps.forEach(([v, a, b], i) => {
    const y = 3.3 + i * 1.32;
    box(s, MX + 0.3, y, 3.4, 1.05, { fill: i === 2 ? C.badge : C.tint, line: i === 2 ? C.badge : C.tint, r: 0.08 });
    T(s, [B(v, { fontSize: 28, color: i === 2 ? C.white : C.brand }), { text: `  ${a}`, options: { fontFace: F.bodyB, fontSize: 14, color: i === 2 ? C.white : C.ink } }], { x: MX + 0.5, y: y + 0.05, w: 3.1, h: 0.6, valign: "middle" });
    T(s, b, { x: MX + 0.5, y: y + 0.62, w: 3.1, h: 0.38, fontSize: 11.5, color: i === 2 ? C.soft : C.muted });
    if (i < 2) arrow(s, MX + 2.0, y + 1.05, MX + 2.0, y + 1.32);
  });
  const ex = [["결과변수와 겹침", "우울감 경험·상담, EQ-5D 불안·우울 등 4개"], ["하위문항", "해당자만 묻는 세부 문항 → 상위 문항으로 대표"], ["지식 문항", "조기증상 인지 등 → 건강정보 이해로 대표"], ["영역 제외", "안전의식·개인위생·여성건강(경로 근거 약함)"]];
  T(s, "쓰지 않은 문항", { x: MX + 4.0, y: 3.3, w: 3.3, h: 0.4, fontFace: F.bodyB, fontSize: 14, color: C.muted });
  ex.forEach(([a, b], i) => {
    const y = 3.75 + i * 0.85;
    T(s, a, { x: MX + 4.0, y, w: 3.3, h: 0.35, fontFace: F.bodyB, fontSize: 13 });
    T(s, b, { x: MX + 4.0, y: y + 0.33, w: 3.3, h: 0.45, fontSize: 11, color: C.muted });
  });
  line(s, MX + 0.3, 7.35, MX + 7.3, 7.35);
  T(s, "대상자", { x: MX + 0.3, y: 7.45, w: 3, h: 0.4, fontFace: F.bodyB, fontSize: 14, color: C.muted });
  [[n0(N.raw), "조사 응답 성인"], [n0(N.analysis), `분석 대상(PHQ-9 결측 ${n0(N.y_missing)}명 제외)`]].forEach(([v, l], i) => {
    const x = MX + 0.3 + i * 3.55;
    T(s, [B(v, { fontSize: 22, breakLine: true }), { text: l, options: { fontSize: 11.5, color: C.muted } }], { x, y: 7.9, w: 3.4, h: 0.9 });
    if (!i) arrow(s, x + 2.85, 8.2, x + 3.4, 8.2);
  });
  T(s, `연구 1 머신러닝: 가구 단위 분할 학습 ${n0(N.train)}명 / 시험 ${n0(N.test)}명. 회귀: 완전 사례 ${n0(N.reg)}명. 연구 2: 지표별 완전 사례 약 22.8만 명`, { x: MX + 0.3, y: 8.9, w: 7.0, h: 0.9, fontSize: 12.5, color: C.muted });
  // 오른쪽: X와 Y
  const X0 = 8.75, XW = R - X0;
  box(s, X0, 2.55, XW, 1.25, { fill: C.badge, line: C.badge });
  T(s, [B("결과변수 Y   ", { color: C.s2, fontSize: 19 }), B(`PHQ-9 총점 10점 이상 = 우울 증상 기준 충족  ${n0(N.y1)}명 (가중 ${pct(N.prev_w, 2)})`, { color: C.white, fontSize: 17 })], { x: X0 + 0.3, y: 2.6, w: XW - 0.6, h: 0.6, valign: "middle" });
  T(s, "피드백 반영: 양성 비율이 낮아 불균형이 크다 → 본분석은 PHQ-9 5점 이상(경도 이상)으로 바꾼다", { x: X0 + 0.3, y: 3.2, w: XW - 0.6, h: 0.5, fontSize: 14, color: C.soft, valign: "middle" });
  T(s, "설명변수 X", { x: X0, y: 3.95, w: 4, h: 0.45, fontFace: F.disp, fontSize: 21, color: C.brand, valign: "middle" });
  T(s, "연구 1  8개 영역", { x: X0, y: 4.45, w: 6, h: 0.4, fontFace: F.bodyB, fontSize: 15, color: C.s1, valign: "middle" });
  const exd = { demo: "나이, 성별, 교육, 혼인, 세대유형", econ: "소득, 수급, 식품안정성, 직업", phys: "구강, 저작, 낙상, 체형, 만성질환", behav: "신체활동, 흡연, 음주, 아침식사",
    social: "친구·친척·이웃 연락, 이웃 신뢰", env: "동네 안전·환경 만족, 지역", care: "미충족 의료·치과, 건강정보 이해", proximal: "스트레스, 수면, 주관적 건강 — 주 분석 제외" };
  ["demo", "econ", "phys", "behav", "social", "env", "care", "proximal"].forEach((k, i) => {
    const w = (XW - 0.45) / 4, x = X0 + (i % 4) * (w + 0.15), y = 4.9 + Math.floor(i / 4) * 1.18, prox = k === "proximal";
    box(s, x, y, w, 1.05, { fill: prox ? C.bg : C.white, line: prox ? C.soft : C.light, lw: 1, dash: prox ? "dash" : "solid", r: 0.06 });
    T(s, [B(DL[k], { color: prox ? C.muted : C.ink }), { text: `  ${cnt(k)}개`, options: { fontSize: 12, color: C.muted } }], { x: x + 0.12, y: y + 0.06, w: w - 0.2, h: 0.4, fontSize: 14 });
    T(s, exd[k], { x: x + 0.12, y: y + 0.45, w: w - 0.2, h: 0.55, fontSize: 11, color: C.muted });
  });
  T(s, "연구 2  경제 지표 + 생활요인 개수", { x: X0, y: 7.4, w: 8, h: 0.4, fontFace: F.bodyB, fontSize: 15, color: C.s2, valign: "middle" });
  s.addTable([
    [HD("구분", C.s2, C.white), HD("정의", C.s2, C.white, "left")],
    [CELL("경제 지표 3개", { b: true }), CELL("균등화 소득 가중 5분위(하위 20% vs 상위 20%), 기초생활수급(현재 vs 비수급), 가구 식품안정성(불안정 vs 안정)")],
    [CELL("생활요인 7개", { b: true }), CELL("신체활동 권고, 친구 주 1회 연락, 이웃 신뢰, 비흡연, 고위험음주 아님, 아침식사 주 5회+, 동네 안전 → 0~2/3/4/5/6~7개")],
    [CELL("조정변수", { b: true }), CELL("인구 5개 + 신체건강 9개 (다른 경제 지표는 민감도에서 추가)")],
  ], { ...TBL, x: X0, y: 7.85, w: XW, colW: [1.9, XW - 1.9], rowH: [0.42, 0.72, 0.72, 0.5], fontSize: 12.5 });
}

// ================================================================ 9. 분석 방법
{
  const s = slide("04 연구 모형·방법", "분석 방법입니다. 공통으로 조사 가중치와 층, 집락을 반영했습니다. 연구 1은 머신러닝으로 영역별 정보량을, 회귀로 다른 요인을 고정한 조정 오즈비를 구했습니다. 연구 2는 경제 집단과 생활요인 개수별 조정 유병률을 구하고, 불리 집단과 유리 집단의 감소 폭 차이로 상호작용을, 두 가지 기준으로 역전점을 판정했습니다. 아래 상자는 피드백을 반영해 결과변수를 PHQ-9 5점 이상으로 바꾸는 결정입니다.");
  title(s, "연구 자료 및 분석 방법");
  headline(s, "두 방법은 같은 변수를 보면서도 서로 다른 것을 재고, 연구 2는 그중 조사설계 회귀를 확장한다");
  const col = (x, w, head, colr, tint, rows) => {
    box(s, x, 2.55, w, 0.6, { fill: colr, line: colr, r: 0.06 });
    T(s, head, { x: x + 0.2, y: 2.55, w: w - 0.4, h: 0.6, fontFace: F.bodyB, fontSize: 17, color: C.white, valign: "middle" });
    rows.forEach(([a, b], i) => {
      const y = 3.3 + i * 0.86;
      T(s, a, { x, y, w: 1.55, h: 0.78, fontFace: F.bodyB, fontSize: 13.5, color: colr, valign: "middle" });
      T(s, b, { x: x + 1.6, y, w: w - 1.6, h: 0.78, fontSize: 13, valign: "middle" });
      line(s, x, y + 0.82, x + w, y + 0.82, { color: "E3E6EA" });
    });
  };
  col(MX, 5.75, "연구 1 — 머신러닝 (정보량)", "2F5FB3", C.tint, [
    ["재는 것", "모형이 어느 영역·변수에 얼마나 기대나"], ["분할", `가구 단위 학습 ${n0(N.train)} / 시험 ${n0(N.test)}명`], ["모형", "CatBoost 등 6개, 하이퍼파라미터 사전 고정"],
    ["영역", "인구 + 영역 추가 ΔAP, 전체 − 영역 제거 ΔAP"], ["변수", "SHAP 평균 |값|, 순열 중요도"], ["불확실성", "가구 부트스트랩 95% CI, 연령대별 재학습"]]);
  line(s, 6.85, 2.6, 6.85, 8.5, { color: C.rule });
  col(7.05, 5.75, "연구 1 — 조사설계 회귀 (조정 연관)", "1F8A5B", C.tintG, [
    ["재는 것", "다른 요인을 고정해도 관련이 남나, 방향과 크기"], ["설계", `가중치·층 ${n0(N.strata)}개·집락 ${n0(N.psu)}개, 테일러 선형화`], ["모형", `주 분석 ${N.n_main_features}개 동시 투입 → 조정 OR`],
    ["기준범주", "건강한 상태(위험 쪽 OR > 1)"], ["수정 유형", "A 개인 행동 / B 서비스·정책 / C 불가(HP2030)"], ["검정", "변수별 결합 Wald F 검정"]]);
  line(s, 13.1, 2.6, 13.1, 8.5, { color: C.rule });
  col(13.3, 5.9, "연구 2 — 경제 집단 × 생활요인", C.s2, C.tintG, [
    ["조정 유병률", "경제 집단 × 생활요인 개수 칸별 예측 주변화"], ["가법", "불리 집단 감소 폭 − 유리 집단 감소 폭"], ["승법", "경제 × 개수 상호작용 Wald 검정"],
    ["역전 ①", "불리 k개 < 유리 0~2개 (차이 95% CI < 0)"], ["역전 ②", "불리 k개 < 유리 집단 전체 평균"], ["격차 분해·민감도", "연령 표준화 분포 반사실, 4종 민감도·운동 요인"]]);
  box(s, MX, 8.75, CW, 1.6, { fill: "FFF4E0", line: "E0A33A", lw: 1.5 });
  T(s, [B("피드백 반영  ", { color: "A86400", fontSize: 18 }), B("결과변수를 PHQ-9 ≥ 5(경도 이상)로 변경", { fontSize: 18 })], { x: MX + 0.3, y: 8.85, w: CW - 0.6, h: 0.5, valign: "middle" });
  T(s, `현재 예비 분석의 PHQ-9 ≥ 10은 양성이 ${pct(N.prev_w, 1)}로 불균형이 크다. 경도 이상 기준으로 바꿔 양성 사례를 늘리고, 예측 성능(AP)과 경제 집단 비교의 안정성을 다시 확인한다. 이 발표의 결과는 PHQ-9 ≥ 10 예비 분석 결과다.`, { x: MX + 0.3, y: 9.35, w: CW - 0.6, h: 0.9, fontSize: 14 });
}

// ================================================================ 10. RQ1
pres.addSection({ title: "05 예비 분석" });
{
  const vt = Object.fromEntries(D.variable_tests.map((v) => [v.var, v]));
  const rank = Object.fromEntries([...D.variable_tests].sort((a, b) => b.F - a.F).map((v, i) => [v.var, i + 1]));
  const top = D.shap_top.filter((x) => vt[x.feature]).slice(0, 10), both = top.filter((x) => rank[x.feature] <= 10);
  const dom = D.domains;
  const s = slide("05 예비 분석", `왼쪽은 영역 기여입니다. 인구 정보만 쓴 모형 AP ${f(D.sets.base.catboost.ap, 3)}에 영역을 하나씩 더하면 신체건강이 ${f(dom.phys.catboost.add.d, 3)}로 가장 크게 올렸고, 전부 넣은 모형에서 어느 영역을 빼도 성능이 떨어졌습니다. 오른쪽은 변수 수준입니다. 머신러닝 SHAP 상위 10개 중 ${both.length}개가 회귀에서도 상위 10위 안에 들어, 두 방법이 같은 요인을 가리켰습니다.`);
  title(s, "예비 분석", { rq: 1, study: 1 });
  headline(s, "모든 영역이 고유한 정보를 더하고, 신체건강이 가장 크다", 1.8, MX, 8.6, 21);
  headline(s, "변수 수준에서도 두 방법이 같은 요인을 가리킨다", 1.8, 9.85, 9.35, 21);
  const g2 = fig(s, "../paper/figures/fig2_domain_contribution.png", MX, 2.5, 8.6, 3.4, "영역별 단독·고유 기여(ΔAP)");
  T(s, "알고리즘 비교: 6개 모형의 AP·ROC-AUC(시험셋)", { x: MX, y: g2.y + g2.h + 0.15, w: 8.6, h: 0.35, fontFace: F.bodyB, bold: true, fontSize: 13, color: C.s1, valign: "middle" });
  fig(s, "../paper/figures/figS1_algorithms.png", MX, g2.y + g2.h + 0.55, 8.6, 9.55 - (g2.y + g2.h + 0.55), "알고리즘별 성능 비교");
  line(s, 9.6, 2.0, 9.6, 10.3);
  fig(s, "figures/rq1_two_lenses.png", 9.85, 2.5, 6.6, 3.6, "SHAP 상위 10개와 회귀 결합검정 F 비교");
  box(s, 16.7, 2.5, 2.5, 3.55, { fill: C.white, line: C.light });
  T(s, [B(`${both.length}`, { fontSize: 46 }), { text: " / 10", options: { fontSize: 20, color: C.muted } }], { x: 16.9, y: 2.6, w: 2.2, h: 0.95 });
  T(s, "회귀에서도 상위 10위인 변수", { x: 16.9, y: 3.5, w: 2.2, h: 0.55, fontSize: 12, color: C.muted });
  const lab = (x) => ({ food_insecurity: "식품 불안정", body_image: "인지 체형", contact_friend: "친구 연락", fall: "낙상" }[x.feature] || x.label.replace("연간 ", ""));
  T(s, both.map((x, i) => ({ text: `${lab(x)}  ${rank[x.feature]}위`, options: { breakLine: i < both.length - 1 } })), { x: 16.9, y: 4.05, w: 2.2, h: 1.95, fontSize: 12.5 });
  [[`+${f(dom.phys.catboost.add.d, 3)}`, "신체건강 단독 ΔAP (1위)"], [`${Object.keys(dom).filter((k) => k !== "proximal" && dom[k].catboost.drop.lo > 0).length} / 7`, "빼면 성능이 떨어지는 영역"], [f(cb.ap, 3), `AP (무작위 ${f(N.test_y1 / N.test, 3)}의 약 ${Math.round(cb.ap / (N.test_y1 / N.test))}배)`], [f(cb.auc, 3), "ROC-AUC"]].forEach(([v, l], i) => {
    const x = 9.85 + i * 2.36;
    box(s, x, 6.35, 2.2, 1.55, { fill: C.tint, line: C.tint });
    T(s, v, { x: x + 0.15, y: 6.45, w: 1.9, h: 0.75, fontFace: F.bodyB, fontSize: 26, color: C.s1, valign: "middle" });
    T(s, l, { x: x + 0.15, y: 7.2, w: 1.95, h: 0.6, fontSize: 11.5, color: C.muted });
  });
  T(s, "SHAP은 모형이 기댄 정도라 흔한 변수일수록 커진다(아침식사·이웃 연락). 회귀 F는 다른 변수를 고정한 뒤 남는 관련의 강도다. 둘 다 높은 변수(낙상·식품 불안정·체형·저작불편)는 해석을 더 믿을 수 있다.", { x: 9.85, y: 8.1, w: 9.35, h: 1.3, fontSize: 13.5 });
  readBar(s, "읽는 법", "단독 = 인구 정보에 이 영역만 더했을 때 오른 AP, 고유 = 전부 넣은 모형에서 이 영역만 뺐을 때 떨어진 AP");
  foot(s, PRE1);
}

// ================================================================ 11. RQ2
{
  const fi = D.or_modifiable[0];
  const orOf = (name, level) => D.or_all.find((o) => o.name === name && o.level === level);
  const A = [["친구 연락", "월 1회 미만", "친구 연락 월 1회 미만"], ["흡연", "현재흡연", "현재 흡연"], ["아침식사", "거의 안 함", "아침식사 거의 안 함"], ["전자담배", "예", "전자담배 현재 사용"], ["걷기 실천", "아니오", "걷기 미실천"]].map(([n, l, t]) => ({ ...orOf(n, l), t }));
  const s = slide("05 예비 분석", `회귀에서 다른 요인을 모두 고정한 조정 오즈비입니다. 바꿀 수 있는 요인을 국민건강증진종합계획 분야에 맞춰 개인 행동 A와 서비스·정책으로 개선 가능한 B로 미리 나눴습니다. 식품이 자주 부족한 가구의 오즈가 ${f(fi.or, 2)}배로 가장 컸고, 씹기가 매우 불편한 경우, 미충족 의료가 뒤를 이었습니다. 개인 행동에서는 친구와의 연락 단절, 흡연, 아침 결식이 위험 쪽이었습니다.`);
  title(s, "예비 분석", { rq: 2, study: 1 });
  headline(s, "바꿀 수 있는 위험 요인 중 식품 불안정과 구강 문제의 연관이 가장 크다");
  fig(s, "figures/rq2_forest.png", MX, 2.55, 10.6, 6.9, "바꿀 수 있는 요인의 조정 오즈비");
  line(s, 11.75, 2.6, 11.75, 9.5);
  T(s, "식품이 자주 부족한 가구", { x: 12.1, y: 2.55, w: 7, h: 0.4, fontSize: 15, color: C.muted });
  T(s, [B(f(fi.or, 2), { fontSize: 60, color: C.risk }), { text: " 배", options: { fontSize: 24, color: C.muted } }], { x: 12.1, y: 2.95, w: 7, h: 1.2, valign: "middle" });
  T(s, `95% CI ${f(fi.lo, 2)}~${f(fi.hi, 2)}, 충분·다양 대비`, { x: 12.1, y: 4.15, w: 7, h: 0.4, fontSize: 14, color: C.muted });
  line(s, 12.1, 4.75, R, 4.75);
  T(s, "유형 판정 기준 (분석 전에 정함, HP2030 대응)", { x: 12.1, y: 4.9, w: 7, h: 0.4, fontFace: F.bodyB, fontSize: 14, color: C.muted });
  [["□ B 서비스·정책·환경", "식품 지원, 치과 진료, 의료 접근, 건강정보 이해", C.brand], ["● A 개인 행동", "연락, 금연, 아침식사, 걷기", C.s1]].forEach(([a, b, col], i) => {
    const y = 5.4 + i * 0.95;
    T(s, a, { x: 12.1, y, w: 7, h: 0.4, fontFace: F.bodyB, fontSize: 16, color: col });
    T(s, b, { x: 12.1, y: y + 0.42, w: 7, h: 0.4, fontSize: 13.5, color: C.muted });
  });
  s.addTable([[HD("개인 행동 (A)", C.s1), HD("조정 OR [95% CI]", C.s1)], ...A.map((o) => [CELL(o.t), CELL(`${f(o.or, 2)} [${f(o.lo, 2)}, ${f(o.hi, 2)}]`, { al: "center" })])],
    { ...TBL, x: 12.1, y: 7.4, w: 7.1, colW: [3.6, 3.5], rowH: 0.36, fontSize: 12.5 });
  readBar(s, "읽는 법", `조정 OR = 주 분석 ${N.n_main_features}개 변수를 동시에 고정했을 때의 오즈 배수. 기준은 건강한 상태, 변수마다 위험이 가장 큰 수준, 모두 p < .05`);
  foot(s, PRE1);
}

// ================================================================ 12. RQ3-a
{
  const lo = prevEcon("균등화 소득 5분위", "1분위(하)"), hi = prevEcon("균등화 소득 5분위", "5분위(상)");
  const pa = [rate("하위(1분위)", "pa_guideline").age_std * 100, rate("상위(5분위)", "pa_guideline").age_std * 100];
  const s = slide("05 예비 분석", `연구 2의 출발점입니다. 소득 하위 20%의 우울 증상 유병률은 ${pct(lo)}로 상위 20% ${pct(hi)}의 약 ${f(lo / hi, 1)}배였고, 기초생활수급과 식품 불안정에서는 격차가 더 컸습니다. 생활요인 충족 개수의 평균은 하위 집단이 오히려 비슷하거나 약간 높았는데, 이는 고령층이 많아 비흡연과 아침식사 충족률이 높기 때문입니다. 연령을 맞추면 하위 집단의 충족 개수가 더 적었고, 특히 신체활동 권고 충족률의 격차가 컸습니다.`);
  title(s, "예비 분석", { rq: 3, study: 2 });
  headline(s, "경제적으로 불리할수록 우울 유병률이 높고, 연령을 맞추면 생활요인 충족도 적다");
  const a = fig(s, "figures/v3/fig_v3_02_prev_by_econ.png", MX, 2.5, 13.0, 3.7, "경제 지표별 우울 증상 가중 유병률");
  fig(s, "figures/v3/fig_v3_03_lifestyle_by_econ.png", MX, a.y + a.h + 0.2, 13.0, 9.55 - (a.y + a.h + 0.2), "경제 집단별 생활요인 충족 현황", "center");
  line(s, 14.05, 2.6, 14.05, 9.5);
  const stat = (y, v, l, col) => { T(s, v, { x: 14.35, y, w: 4.85, h: 0.75, fontFace: F.bodyB, fontSize: 32, color: col, valign: "middle" }); T(s, l, { x: 14.35, y: y + 0.72, w: 4.85, h: 0.45, fontSize: 13, color: C.muted }); };
  stat(2.5, `${pct(lo)} vs ${pct(hi)}`, `소득 하위 20% vs 상위 20% (약 ${f(lo / hi, 1)}배)`, C.risk);
  stat(3.75, `${pct(prevEcon("기초생활수급", "현재 수급"))} · ${pct(prevEcon("가구 식품안정성", "자주 부족"))}`, "현재 수급 · 식품 자주 부족 가구의 유병률", C.risk);
  line(s, 14.35, 5.05, R, 5.05);
  T(s, "생활요인 충족 개수 평균 (하위 vs 상위)", { x: 14.35, y: 5.2, w: 4.85, h: 0.4, fontFace: F.bodyB, fontSize: 14 });
  s.addTable([[HD("기준", C.s2), HD("하위 20%", C.s2), HD("상위 20%", C.s2)],
    [CELL("조율(실제)"), CELL(f(V3_TEXT.meanCrude[0], 2), { al: "center" }), CELL(f(V3_TEXT.meanCrude[1], 2), { al: "center" })],
    [CELL("연령 표준화", { b: true }), CELL(f(V3_TEXT.meanStd[0], 2), { al: "center", b: true, color: C.risk }), CELL(f(V3_TEXT.meanStd[1], 2), { al: "center", b: true })]],
    { ...TBL, x: 14.35, y: 5.65, w: 4.85, colW: [1.85, 1.5, 1.5], rowH: 0.42, fontSize: 13 });
  T(s, `신체활동 권고 충족(연령 표준화): ${pct(pa[0])} vs ${pct(pa[1])}`, { x: 14.35, y: 7.1, w: 4.85, h: 0.45, fontFace: F.bodyB, fontSize: 14 });
  T(s, "하위 집단은 고령층이 많아 비흡연·아침식사 충족률이 높게 보인다 → 비교는 연령을 맞춰서 본다", { x: 14.35, y: 7.55, w: 4.85, h: 1.0, fontSize: 13, color: C.muted });
  readBar(s, "읽는 법", "왼쪽 위는 비조정 가중 유병률, 아래는 생활요인별 충족률(채운 점 = 연령 표준화, 빈 점 = 조율)");
  foot(s, PRE2);
}

// ================================================================ 13. RQ3-b
{
  const I = inter.income;
  const s = slide("05 예비 분석", `생활요인 충족 개수별 조정 유병률입니다. 세 경제 지표 모두 생활요인을 많이 충족할수록 유병률이 낮았습니다. 감소 폭은 불리 집단에서 더 컸습니다. 소득 하위 20%는 0~2개에서 6~7개로 가며 ${f(Math.abs(I.drop_dis_pp))}%p, 상위 20%는 ${f(Math.abs(I.drop_adv_pp))}%p 낮아져, 차이의 차이가 ${pp(I.additive_pp)}%p였습니다. 자원 대체 가설과 일치하는 패턴입니다.`);
  title(s, "예비 분석", { rq: 3, study: 2 });
  headline(s, "생활요인을 많이 충족할수록 모든 집단에서 낮아지고, 감소 폭은 불리 집단에서 더 크다");
  const a = fig(s, "figures/v3/fig_v3_04_reversal_lines.png", MX, 2.45, CW, 5.0, "경제 집단별 생활요인 개수에 따른 조정 유병률", "center");
  const y0 = a.y + a.h + 0.2;
  const rows = ["income", "livelihood", "food"].map((k) => {
    const r = inter[k];
    return [CELL(IND[k], { b: true }), CELL(`${pp(r.drop_dis_pp)}%p`, { al: "center", color: C.risk, b: true }), CELL(`${pp(r.drop_adv_pp)}%p`, { al: "center" }),
      CELL(`${pp(r.additive_pp)} [${pp(r.additive_low)}, ${pp(r.additive_high)}]`, { al: "center", b: true }), CELL(r.mult_p < 0.001 ? "< .001" : f(r.mult_p, 3).replace(/^0/, ""), { al: "center" }),
      CELL(`${f(r.or_per_factor_dis, 2)} / ${f(r.or_per_factor_adv, 2)}`, { al: "center" })];
  });
  s.addTable([[HD("경제 지표", C.s2), HD("불리 집단 감소 폭", C.s2), HD("유리 집단 감소 폭", C.s2), HD("가법 상호작용 (%p, 95% CI)", C.s2), HD("승법 p", C.s2), HD("1개당 OR 불리 / 유리", C.s2)], ...rows],
    { ...TBL, x: MX, y: y0, w: 13.2, colW: [2.1, 2.15, 2.15, 3.1, 1.3, 2.4], rowH: 0.42, fontSize: 13 });
  box(s, 14.3, y0, R - 14.3, 9.55 - y0, { fill: C.tintG, line: C.s2, lw: 1.25 });
  T(s, [B("H3 자원 대체와 일치", { color: C.s2, fontSize: 17, breakLine: true }), { text: "감소 폭이 세 지표 모두 불리 집단에서 더 크다(가법 상호작용 < 0). 소득 1개당 OR도 불리 집단이 더 낮다.", options: { fontSize: 13.5 } }],
    { x: 14.55, y: y0 + 0.1, w: R - 14.8, h: 9.45 - y0 - 0.2, valign: "middle" });
  readBar(s, "읽는 법", "감소 폭 = 생활요인 0~2개 → 6~7개의 조정 유병률 변화. 가법 상호작용 = 불리 집단 감소 폭 − 유리 집단 감소 폭(음수면 불리 집단에서 더 크게 감소)");
  foot(s, PRE2);
}

// ================================================================ 14. RQ4-a
{
  const lo02 = cell("income", 0, "0~2개"), hi02 = cell("income", 1, "0~2개"), lo5 = cell("income", 0, "5개");
  const dc = decomp("income");
  const s = slide("05 예비 분석", `역전점입니다. 기준은 두 가지입니다. 기준 1은 불리 집단이 생활요인 k개일 때 생활요인이 0~2개인 유리 집단보다 유의하게 낮은지, 기준 2는 유리 집단 전체 평균보다도 낮은지입니다. 소득 하위 20%는 5개부터 기준 1, 6~7개에서 기준 2를 넘었습니다. 반면 기초생활수급과 식품 불안정은 기준 2를 넘지 못했고, 6~7개를 모두 충족해도 같은 단계의 유리 집단보다 높았습니다. 격차 분해에서도 생활요인 분포 차이로 설명되는 몫은 약 ${Math.round(dc.share_explained * 100)}%였습니다.`);
  title(s, "예비 분석", { rq: 4, study: 2 });
  headline(s, "소득 하위 20%는 생활요인 5개부터 '생활요인이 적은 상위 20%'보다 낮아진다 — 깊은 박탈은 격차가 남는다", 1.8, MX, CW, 21);
  const a = fig(s, "figures/v3/fig_v3_05_reversal_heatmap.png", MX, 2.45, CW, 4.0, "경제 집단 × 생활요인 개수별 조정 유병률 히트맵", "center");
  const y0 = a.y + a.h + 0.2;
  const rows = ["income", "livelihood", "food"].map((k) => {
    const r = sens(k);
    return [CELL(IND[k], { b: true }), CELL(r.reversal_1, { al: "center", b: true, color: r.reversal_1 === "없음" ? C.muted : C.s2 }), CELL(r.reversal_2, { al: "center", b: true, color: r.reversal_2 === "없음" ? C.risk : C.s2 }),
      CELL(`${pp(r.same_top_pp)} [${pp(r.same_top_low)}, ${pp(r.same_top_high)}]`, { al: "center" })];
  });
  s.addTable([[HD("경제 지표", C.s2), HD("역전 ① vs 유리 0~2개", C.s2), HD("역전 ② vs 유리 평균", C.s2), HD("6~7개 같은 단계 격차 (%p)", C.s2)], ...rows],
    { ...TBL, x: MX, y: y0, w: 9.8, colW: [2.2, 2.3, 2.3, 3.0], rowH: 0.45, fontSize: 13.5 });
  T(s, `예: 소득 하위 20%·5개 ${pct(lo5.adj_prev * 100)} < 상위 20%·0~2개 ${pct(hi02.adj_prev * 100)} (하위 0~2개는 ${pct(lo02.adj_prev * 100)})`, { x: MX, y: y0 + 1.9, w: 9.8, h: 0.4, fontFace: F.bodyB, fontSize: 13.5, color: C.s2 });
  line(s, 10.85, y0, 10.85, 9.55);
  fig(s, "figures/v3/fig_v3_06_decomposition.png", 11.1, y0, R - 11.1, 9.5 - y0, "격차 분해", "center");
  readBar(s, "읽는 법", "역전 ① = 불리 집단 k개가 유리 집단 0~2개보다 유의하게 낮은 첫 단계, ② = 유리 집단 전체 평균보다 낮은 첫 단계. 분해 = 불리 집단이 유리 집단만큼 생활요인을 충족했다면");
  foot(s, PRE2);
}

// ================================================================ 15. RQ4-b
{
  const w = [s2("walk_ok", "하위(1분위)"), s2("walk_ok", "상위(5분위)")];
  const s = slide("05 예비 분석", `역전 판정이 분석 방식에 따라 흔들리는지 확인했습니다. 식품·수급을 추가로 조정하거나 행동 요인만 세어도, 소득 하위 20%의 감소 폭이 더 크다는 결과는 유지되었습니다. 다만 19~39세와 65세 이상은 신뢰구간이 넓어 조심해서 읽어야 합니다. 수업과 연결해 운동 요인도 따로 보았습니다. 다른 생활습관이 같을 때 걷기를 실천하면 소득 하위 20%에서 ${f(Math.abs(w[0].diff_pp))}%p, 상위 20%에서 ${f(Math.abs(w[1].diff_pp))}%p 낮아, 걷기의 관련이 불리 집단에서 더 컸습니다.`);
  title(s, "예비 분석", { rq: 4, study: 2 });
  headline(s, "역전 패턴은 민감도 분석에서도 대체로 유지되고, 운동 중에서는 걷기가 불리 집단에서 두드러진다", 1.8, MX, CW, 21);
  const cap = (x, y, t) => T(s, t, { x, y, w: 9, h: 0.38, fontFace: F.bodyB, fontSize: 14, color: C.s2, valign: "middle" });
  cap(MX, 2.45, "① 민감도 분석(소득): 가법 상호작용과 역전점");
  fig(s, "figures/v3/fig_v3_07_sensitivity.png", MX, 2.85, 8.95, 3.6, "민감도 분석");
  cap(10.25, 2.45, "② 운동 요인을 따로 센 확장 개수(0~9개)");
  fig(s, "figures/v3/fig_v3_10_count9.png", 10.25, 2.85, 8.95, 3.6, "확장 생활요인 개수와 조정 유병률");
  line(s, MX, 6.6, R, 6.6);
  cap(MX, 6.7, "③ 운동 누적(S1): 운동 외 생활요인을 같게 맞춘 뒤");
  fig(s, "figures/v3/fig_v3_08_exercise_stack.png", MX, 7.1, 9.6, 2.55, "운동 요인 누적 효과");
  cap(10.75, 6.7, "④ 운동 종류(S2): 세 운동 상호 조정");
  fig(s, "figures/v3/fig_v3_11_exercise_types.png", 10.75, 7.1, 5.6, 2.55, "운동 종류별 유병률 차이");
  box(s, 16.55, 7.1, R - 16.55, 2.55, { fill: C.tintG, line: C.s2, lw: 1.25 });
  T(s, [B("걷기", { color: C.s2, fontSize: 18, breakLine: true }), { text: `하위 ${pp(w[0].diff_pp)}%p vs 상위 ${pp(w[1].diff_pp)}%p`, options: { fontFace: F.bodyB, fontSize: 14, breakLine: true } },
    { text: "비용·시설 없이 할 수 있어 불리 집단에서 의미가 크다. 근력운동은 두 집단에서 비슷했다.", options: { fontSize: 12, color: C.muted } }], { x: 16.75, y: 7.2, w: R - 16.95, h: 2.35, valign: "middle" });
  foot(s, PRE2);
}

// ================================================================ 16. 핵심 결과
pres.addSection({ title: "06 핵심 결과·의의" });
{
  const I = inter.income, dc = decomp("income"), fi = D.or_modifiable[0];
  const s = slide("06 핵심 결과·의의", "네 가지 질문에 대한 답을 정리합니다. 우울 증상은 여러 생활 영역과 독립적으로 관련되었고, 신체건강의 기여가 가장 컸습니다. 바꿀 수 있는 요인으로는 식품 불안정, 구강 문제, 미충족 의료, 사회적 단절, 흡연, 아침 결식이 있었습니다. 연구 2에서는 생활요인을 많이 충족할수록 우울 비율이 낮았고 그 폭이 불리 집단에서 더 컸으며, 소득에서는 역전이 나타났지만 깊은 박탈에서는 격차가 남았습니다.");
  title(s, "핵심 결과");
  headline(s, "우울 증상은 여러 생활영역과 관련되었으며, 경제적 조건에 따라 건강 생활요인 축적과의 관련도 달랐다");
  const rows = [
    [1, C.s1, "모든 영역이 고유한 정보를 더하고, 신체건강의 기여가 가장 크다. 두 방법이 같은 요인(낙상·식품 불안정·저작불편)을 가리켰다", `+${f(D.domains.phys.catboost.add.d, 3)}`, "신체건강 ΔAP"],
    [2, C.s1, "바꿀 수 있는 위험 요인: 식품 불안정, 구강 문제(저작불편), 미충족 의료, 사회적 단절(친구 연락), 흡연, 아침 결식", `OR ${f(fi.or, 2)}`, "식품 자주 부족"],
    [3, C.s2, "생활요인을 많이 충족할수록 모든 경제 집단에서 우울 비율이 낮고, 감소 폭은 불리 집단에서 더 크다(자원 대체와 일치)", `${pp(I.additive_pp)}%p`, "소득 가법 상호작용"],
    [4, C.s2, `소득 하위 20%는 5개부터 생활요인이 적은 상위 20%보다 낮고, 6~7개에서는 상위 평균보다도 낮다. 수급·식품 불안정은 모두 충족해도 격차가 남는다(생활요인으로 설명되는 몫 약 ${Math.round(dc.share_explained * 100)}%)`, "5개", "소득 역전 ①"],
  ];
  rows.forEach(([k, col, t, v, l], i) => {
    const y = 2.6 + i * 1.75;
    box(s, MX, y, CW, 1.55, { fill: "2A3342", line: "2A3342" });
    T(s, `RQ${k}`, { x: MX + 0.35, y, w: 1.3, h: 1.55, fontFace: F.bodyB, fontSize: 22, color: k <= 2 ? "8FA8FF" : "5BC596", valign: "middle" });
    T(s, t, { x: MX + 1.75, y, w: 12.5, h: 1.55, fontSize: 17, color: C.white, valign: "middle" });
    line(s, 15.05, y + 0.25, 15.05, y + 1.3, { color: "5B6472" });
    T(s, [B(v, { fontSize: 28, color: C.white, breakLine: true }), { text: l, options: { fontSize: 12, color: C.soft } }], { x: 15.3, y, w: 3.7, h: 1.55, valign: "middle" });
  });
  foot(s, "연구 1·2 모두 PHQ-9 ≥ 10 기준 예비 분석. 횡단면 자료이므로 모든 결과는 관련성이며 인과 효과가 아니다");
}

// ================================================================ 17. 기대효과·의의 + 한계
{
  const s = slide("06 핵심 결과·의의", "학술적으로는 여러 영역을 한 모형에서 비교하고, 그 결과를 경제적 격차라는 구체적 질문으로 이어 갔다는 점이 의의입니다. 실무적으로는 걷기처럼 접근성이 높은 운동과 생활습관을 묶은 프로그램이 불리 집단에서 의미가 클 수 있다는 근거를 제시합니다. 다만 횡단면 자료이고, 연구 2는 이전 생활요인 정의를 쓴 예비 분석이라는 한계가 있습니다.");
  title(s, "기대 효과 및 연구 의의");
  const panel = (y, tag, head, body) => {
    card(s, MX, y, 9.3, 2.7);
    pill(s, tag, MX + 0.3, y + 0.22, { w: 1.6, h: 0.42, size: 14 });
    T(s, head, { x: MX + 0.3, y: y + 0.75, w: 8.7, h: 0.5, fontFace: F.bodyB, fontSize: 18 });
    T(s, body.map((t, i) => ({ text: t, options: { bullet: { indent: 18 }, breakLine: i < body.length - 1 } })), { x: MX + 0.3, y: y + 1.3, w: 8.7, h: 1.3, fontSize: 14.5, paraSpaceAfter: 3 });
  };
  panel(1.95, "학술적 의의", "다차원 탐색 → 경제적 격차 심층 분석", ["8개 영역을 한 모형에서 비교하고 우울과 겹치는 변수를 분리해 순환 해석을 줄였다", "머신러닝과 조사설계 회귀가 같은 요인을 가리키는지 교차 확인했다", "경제 집단 간 '역전점'이라는 새 질문을 한국 성인 대표 자료로 검토했다"]);
  arrow(s, MX + 4.65, 4.7, MX + 4.65, 5.0);
  panel(5.05, "실무적 의의", "취약 집단을 위한 건강증진 전략", ["걷기처럼 비용·시설 부담이 적은 운동과 생활습관을 묶은 프로그램의 근거", "식품 지원·치과 진료·의료 접근을 정신건강 사업과 연계할 근거", "생활체육 시설·동호회는 운동과 사회적 연결을 함께 제공하는 장이 될 수 있다"]);
  box(s, MX, 8.05, 9.3, 1.7, { fill: "FFF4E0", line: "E0A33A", lw: 1.25 });
  T(s, [B("단, ", { color: "A86400" }), { text: `생활요인만으로 설명되지 않는 격차(소득 약 ${Math.round((1 - decomp("income").share_explained) * 100)}%)와 깊은 박탈의 잔존 격차는 경제적·사회적 지원이 함께 필요하다. 프로그램 효과는 종단·중재 연구로 확인해야 한다.` }], { x: MX + 0.3, y: 8.1, w: 8.7, h: 1.6, fontSize: 15, valign: "middle" });
  line(s, 10.55, 2.0, 10.55, 10.3);
  T(s, "한계", { x: 10.9, y: 1.95, w: 4, h: 0.6, fontFace: F.disp, fontSize: 28, valign: "middle" });
  [["횡단면 자료", "역인과·선택 가능성 → 모든 결과를 '관련'과 '일치하는 패턴'으로 서술"], ["자기보고 측정", "PHQ-9 기준 충족은 임상 진단이 아님, 생활요인도 자기보고"],
    ["결과변수의 불균형", `PHQ-9 ≥ 10 양성 ${pct(N.prev_w, 1)} → 본분석은 PHQ-9 ≥ 5로 전환`], ["연구 2는 예비 분석", "생활요인 7개(이웃 신뢰·동네 안전 포함)의 이전 정의 → 연구 1 기준으로 재분석"],
    ["탐색적·다중 비교", "가설이 연구 1 결과를 본 뒤 구체화됨, 경계선 결과는 보수적으로 해석"], ["작은 칸과 측정 공백", "65세 이상 상위 20% 칸이 작음, 좌식행동 문항 없음, 식생활은 아침식사로 대리"]].forEach(([h, b], i) => {
    const y = 2.75 + i * 1.25;
    box(s, 10.9, y + 0.05, 0.1, 1.0, { fill: C.risk, line: C.risk, rect: true });
    T(s, h, { x: 11.25, y, w: 7.95, h: 0.45, fontFace: F.bodyB, fontSize: 17 });
    T(s, b, { x: 11.25, y: y + 0.48, w: 7.95, h: 0.6, fontSize: 13.5, color: C.muted });
  });
}

// ================================================================ 18. 추후 계획
{
  const s = slide("06 핵심 결과·의의", "남은 계획입니다. 연구 1의 분석과 논문 초안, 연구 2의 예비 분석은 끝났습니다. 다음으로 피드백에 따라 결과변수를 PHQ-9 5점 이상으로 바꿔 두 연구를 본분석하고, 연구 2는 연구 1에서 정한 생활요인 선정 기준으로 다시 계산합니다. 이후 두 연구를 하나의 원고로 묶어 최종 발표를 준비하겠습니다.");
  title(s, "추후 계획");
  headline(s, "피드백을 반영해 결과변수와 생활요인 기준을 통일한 본분석으로 마무리한다");
  const steps = [["완료", "연구 1 분석·논문 초안", "8개 영역 ML·회귀, 논문 v2.1", C.s2, true], ["완료", "연구 2 예비 분석", "경제 집단 × 생활요인, 역전점·민감도·운동 요인", C.s2, true],
    ["다음", "PHQ-9 ≥ 5 본분석", "연구 1·2 모두 재분석, 성능(AP)·영역 순위·역전점 비교", C.brand, false], ["다음", "생활요인 기준 통일", "연구 1의 선정 규칙(신체활동 + 5개)으로 재계산", C.brand, false],
    ["다음", "통합 원고 정리", "IRB 심의면제, 코드 공개, 참고문헌 정리", C.brand, false], ["최종", "최종 제출·발표", "통합 논문 제출과 최종 발표", C.badge, false]];
  const x0 = MX + 0.3, gap = (CW - 0.6) / steps.length;
  line(s, x0 + 0.25, 3.35, x0 + gap * (steps.length - 1) + 0.25, 3.35, { color: C.rule, w: 3 });
  steps.forEach(([t, h, b, col, done], i) => {
    const x = x0 + i * gap;
    s.addShape(pres.shapes.OVAL, { x, y: 3.1, w: 0.5, h: 0.5, fill: { color: done ? col : C.white }, line: { color: col, width: 2.5 } });
    T(s, t, { x: x - 0.2, y: 3.75, w: gap - 0.2, h: 0.4, fontFace: F.bodyB, fontSize: 15, color: col });
    T(s, h, { x: x - 0.2, y: 4.2, w: gap - 0.25, h: 0.85, fontFace: F.bodyB, fontSize: 16 });
    T(s, b, { x: x - 0.2, y: 5.05, w: gap - 0.25, h: 1.1, fontSize: 13, color: C.muted });
  });
  card(s, MX, 6.3, CW, 3.4, C.light);
  sub(s, "본분석에서 확인할 것", MX + 0.3, 6.45, 10, C.light, 22);
  [["1", "PHQ-9 ≥ 5에서도 영역 순위(신체건강 1위)와 수정 가능 요인이 유지되는가"], ["2", "양성 비율이 늘었을 때 예측 성능(AP)과 보정이 어떻게 달라지는가"],
    ["3", "연구 1 기준 생활요인(신체활동 + 5개)으로 셌을 때 역전점과 감소 폭 차이가 유지되는가"], ["4", "65세 이상 등 작은 칸의 추정이 안정되는가"]].forEach(([n, t], i) => {
    const x = MX + 0.3 + (i % 2) * 9.1, y = 7.25 + Math.floor(i / 2) * 1.1;
    num(s, n, x, y, 0.45);
    T(s, t, { x: x + 0.65, y: y - 0.05, w: 8.3, h: 0.6, fontSize: 15, valign: "middle" });
  });
}

// ================================================================ 19. 참고문헌
{
  const refs = [
    "건강보험심사평가원. (2026). 2021~2025년 우울증 및 정신질환 청구 현황 [국회 보건복지위원회 최보윤 의원실 제출 자료]. 머니투데이(2026. 3. 3.) 보도.",
    "보건복지부. (2026). 제6차 국민건강증진종합계획(Health Plan 2030, 2026~2030).",
    "질병관리청. (2025). 지역사회건강조사 2025년 원시자료 이용지침서.",
    "Berkman, L. F., Glass, T., Brissette, I., & Seeman, T. E. (2000). From social integration to health: Durkheim in the new millennium. Social Science & Medicine, 51(6), 843–857.",
    "Engel, G. L. (1977). The need for a new medical model: A challenge for biomedicine. Science, 196(4286), 129–136.",
    "Han, J.-T., & Park, I.-S. (2025). Development of a depression risk prediction model in Korea using machine learning-based feature selection. Journal of the Korean Data & Information Science Society, 36(1), 163–177.",
    "Jeong, J. A., Kim, S. A., Yang, J. H., & Shin, M. H. (2023). Urban-rural differences in the prevalence of depressive symptoms in Korean adults. Chonnam Medical Journal, 59(2), 128–133.",
    "Kim, A.-Y., Nam, S.-A., Roh, S.-Y., & Kim, G.-K. (2025). Patterns of physical activity and depressive symptoms among Korean adults. Healthcare, 13(24), 3221.",
    "Kim, G. M., Cha, S., Jung, M., & Kim, S. (2025). Machine learning prediction of depression in culturally diverse families: Findings from the Korea Community Health Survey. Frontiers in Public Health, 13, 1666084.",
    "Kisely, S., Sawyer, E., Siskind, D., & Lalloo, R. (2016). The oral health of people with anxiety and depressive disorders. Journal of Affective Disorders, 200, 119–132.",
    "Kroenke, K., Spitzer, R. L., & Williams, J. B. W. (2001). The PHQ-9: Validity of a brief depression severity measure. Journal of General Internal Medicine, 16(9), 606–613.",
    "Lee, J., Lee, J.-E., Kim, S., Min, H. S., & Lee, K.-S. (2025). Social network, perceived satisfaction with neighborhoods and depressive symptoms among older adults in Korea. Scientific Reports, 15, 42319.",
    "Link, B. G., & Phelan, J. (1995). Social conditions as fundamental causes of disease. Journal of Health and Social Behavior, (Extra Issue), 80–94.",
    "Lundberg, S. M., Erion, G., Chen, H., et al. (2020). From local explanations to global understanding with explainable AI for trees. Nature Machine Intelligence, 2(1), 56–67.",
    "McLeroy, K. R., Bibeau, D., Steckler, A., & Glanz, K. (1988). An ecological perspective on health promotion programs. Health Education Quarterly, 15(4), 351–377.",
    "Noetel, M., Sanders, T., Gallardo-Gómez, D., et al. (2024). Effect of exercise for depression: Systematic review and network meta-analysis of randomised controlled trials. BMJ, 384, e075847.",
    "Pourmotabbed, A., Moradi, S., Babaei, A., et al. (2020). Food insecurity and mental health: A systematic review and meta-analysis. Public Health Nutrition, 23(10), 1778–1790.",
    "Ross, C. E., & Mirowsky, J. (2006). Sex differences in the effect of education on depression: Resource multiplication or resource substitution? Social Science & Medicine, 63(5), 1400–1413.",
    "Wang, J., Xu, M., Fan, Z., Yin, X., Xia, W., & Gong, Y. (2025). Lifestyles' role in the relationship between socioeconomic deprivation and depression. Journal of Affective Disorders, 389, 119597.",
    "Wang, Y., Liu, M., Yang, F., Chen, H., Wang, Y., & Liu, J. (2024). The associations of socioeconomic status, social activities, and loneliness with depressive symptoms in adults aged 50 years and older across 24 countries. The Lancet Healthy Longevity, 5(9), 100618.",
    "Zhang, Y.-B., Chen, C., Pan, X.-F., et al. (2021). Associations of healthy lifestyle and socioeconomic status with mortality and incident cardiovascular disease. BMJ, 373, n604.",
    "Zhao, Y., Yang, L., Sahakian, B. J., et al. (2023). The brain structure, immunometabolic and genetic mechanisms underlying the association between lifestyle and depression. Nature Mental Health, 1(10), 736–750.",
  ];
  const s = slide("06 핵심 결과·의의", "참고문헌입니다.");
  title(s, "참고 문헌");
  const half = Math.ceil(refs.length / 2);
  [refs.slice(0, half), refs.slice(half)].forEach((col, i) => {
    T(s, col.map((r, j) => ({ text: r, options: { breakLine: j < col.length - 1, indentLevel: 0 } })), { x: MX + i * 9.35, y: 1.95, w: 9.0, h: 8.35, fontSize: 13, paraSpaceAfter: 8, lineSpacingMultiple: 1.05 });
  });
}

// ================================================================ 20. 부록
pres.addSection({ title: "부록" });
{
  const s = slide("부록", "부록입니다. 연구 2의 분석 대상 흐름과, 운동 외 생활요인 단계별로 본 운동 요인 개수와 유병률을 덧붙였습니다.");
  title(s, "부록 — 연구 2 분석 흐름과 운동 요인 보충", { w: 17, study: 2 });
  T(s, "A. 연구 2 분석 대상 흐름", { x: MX, y: 1.85, w: 7, h: 0.45, fontFace: F.bodyB, fontSize: 16, color: C.s2, valign: "middle" });
  fig(s, "figures/v3/fig_v3_01_flow.png", MX, 2.35, 6.6, 7.6, "연구 2 분석 대상 흐름");
  line(s, 7.7, 2.0, 7.7, 10.2);
  T(s, "B. 운동 외 생활요인 단계별 운동 요인 개수와 조정 유병률(소득)", { x: 8.0, y: 1.85, w: 11.2, h: 0.45, fontFace: F.bodyB, fontSize: 16, color: C.s2, valign: "middle" });
  const g9 = fig(s, "figures/v3/fig_v3_09_exercise_by_nonex.png", 8.0, 2.35, 11.2, 5.5, "운동 외 생활요인 단계별 운동 요인 개수", "center");
  T(s, "운동 외 생활요인이 적은 단계일수록 운동 요인의 관련이 크고, 생활요인 5~6개 단계에서는 두 소득 집단이 거의 만난다. 0~2개 단계는 칸이 작아 신뢰구간이 넓다.", { x: 8.0, y: g9.y + g9.h + 0.3, w: 11.2, h: 1.0, fontSize: 15, color: C.muted });
  foot(s, PRE2);
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("생성:", OUT, `(${PAGE}장)`);
})();
