/*
 * 논문 원고 생성 — APA 7판 학생 논문 형식, STROBE(횡단면) + TRIPOD+AI 보고 항목 반영.
 * 실행: node paper/build_manuscript.js   (paper/build_paper_data.py 실행 후)
 * 산출: paper/manuscript_v2.1.docx (v2 초안은 manuscript_v2.docx로 보존)
 * 원칙: 본문 수치는 paper_data.json에서만 가져온다. 저자·IRB 등 확인되지 않은 정보는 노란 자리표시자로 남긴다.
 */
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType,
  ImageRun, Header, PageNumber, PageBreak, HeadingLevel, VerticalAlign, TableLayoutType,
} = require("docx");

const DIR = __dirname;
const D = JSON.parse(fs.readFileSync(path.join(DIR, "paper_data.json"), "utf-8"));
const N = D.n;
const DL = D.domain_labels;

// ---------------------------------------------------------------- 숫자 형식
const n0 = (x) => Number(x).toLocaleString("en-US");
const f = (x, d = 3) => Number(x).toFixed(d);
const pct = (x, d = 1) => `${Number(x).toFixed(d)}%`;
const pp = (frac, d = 1) => `${(frac * 100).toFixed(d)}%`; // 비율(0~1) → %
const ci = (lo, hi, d = 3) => `[${f(lo, d)}, ${f(hi, d)}]`;
const signed = (x, d = 3) => (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(d);

// ---------------------------------------------------------------- 서식
const FONT = { ascii: "Times New Roman", hAnsi: "Times New Roman", eastAsia: "바탕", cs: "Times New Roman" };
const SIZE = 22; // 11pt
const BODY = { line: 480 }; // APA: 이중 줄간격
const TIGHT = { line: 276, before: 0, after: 0 };

function runs(parts, base = {}) {
  // parts: 문자열 또는 {t, b, i, hl, sup}
  return (Array.isArray(parts) ? parts : [parts]).map((p) => {
    if (typeof p === "string") return new TextRun({ text: p, font: FONT, size: base.size || SIZE, bold: base.bold, italics: base.italics });
    return new TextRun({
      text: p.t, font: FONT, size: p.size || base.size || SIZE, bold: p.b || base.bold, italics: p.i || base.italics,
      highlight: p.hl ? "yellow" : undefined, superScript: p.sup,
    });
  });
}
const PL = (parts, opt = {}) => P(parts, { ...opt, align: AlignmentType.LEFT });
const P = (parts, opt = {}) => new Paragraph({
  children: runs(parts, opt), alignment: opt.align || AlignmentType.JUSTIFIED,
  spacing: opt.spacing || BODY, indent: opt.noIndent ? undefined : { firstLine: opt.firstLine ?? 720 },
  keepNext: opt.keepNext,
});
const center = (parts, opt = {}) => P(parts, { ...opt, align: AlignmentType.CENTER, noIndent: true });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: BODY, keepNext: true,
  children: [new TextRun({ text: t, font: FONT, size: SIZE, bold: true })] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: BODY, keepNext: true,
  children: [new TextRun({ text: t, font: FONT, size: SIZE, bold: true })] });
const H3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: BODY, keepNext: true,
  children: [new TextRun({ text: t, font: FONT, size: SIZE, bold: true, italics: true })] });
const bullet = (parts) => new Paragraph({ children: runs(["• ", ...[].concat(parts)]), spacing: BODY,
  indent: { left: 720, hanging: 360 }, alignment: AlignmentType.LEFT });
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });
const HL = (t) => ({ t, hl: true });

// ---------------------------------------------------------------- APA 표
const LINE = { style: BorderStyle.SINGLE, size: 6, color: "000000" };
const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const TABLE_W = 9026; // A4 본문 폭(DXA)
let tableNo = 0, figNo = 0;

function apaTable({ title, head, rows, widths, note, small = true, label }) {
  if (!label) tableNo += 1;
  const num = label || `표 ${tableNo}`;
  const sz = small ? 18 : SIZE;
  const total = widths.reduce((a, b) => a + b, 0);
  const W = widths.map((w) => Math.round((w / total) * TABLE_W));
  const cell = (txt, i, isHead, isLast, opts = {}) => new TableCell({
    width: { size: W[i], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    borders: {
      top: isHead ? LINE : NONE, bottom: isHead || isLast ? LINE : NONE, left: NONE, right: NONE,
    },
    children: [new Paragraph({
      spacing: TIGHT, alignment: i === 0 || opts.left ? AlignmentType.LEFT : AlignmentType.CENTER,
      indent: opts.indent ? { left: 240 } : undefined,
      children: runs([].concat(txt).map((t) => (typeof t === "string" ? t : t)), { size: sz, bold: isHead || opts.bold, italics: opts.italic }),
    })],
  });
  const headRow = new TableRow({ tableHeader: true, children: head.map((h, i) => cell(h, i, true, false)) });
  const body = rows.map((r, ri) => {
    const isLast = ri === rows.length - 1;
    const cells = r.cells || r;
    return new TableRow({ cantSplit: true, children: cells.map((c, i) => cell(c, i, false, isLast, { bold: r.bold, indent: r.indent && i === 0, italic: r.italic })) });
  });
  const out = [
    new Paragraph({ spacing: { before: 240, after: 0, line: 276 }, keepNext: true, children: runs([{ t: num, b: true }]) }),
    new Paragraph({ spacing: { before: 0, after: 120, line: 276 }, keepNext: true, children: runs([{ t: title, i: true }]) }),
    new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: W, layout: TableLayoutType.FIXED, rows: [headRow, ...body] }),
  ];
  if (note) out.push(new Paragraph({ spacing: { before: 80, after: 240, line: 276 }, children: runs([{ t: "주. ", i: true, size: 18 }, { t: note, size: 18 }]) }));
  return out;
}

// ---------------------------------------------------------------- APA 그림
function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
function apaFigure({ file, title, note, widthIn = 6.2, label }) {
  figNo += label ? 0 : 1;
  const num = label || `그림 ${figNo}`;
  const full = path.join(DIR, "figures", file);
  const { w, h } = pngSize(full);
  const width = Math.round(widthIn * 96);
  const height = Math.round((width * h) / w);
  const out = [
    new Paragraph({ spacing: { before: 240, after: 0, line: 276 }, keepNext: true, children: runs([{ t: num, b: true }]) }),
    new Paragraph({ spacing: { before: 0, after: 120, line: 276 }, keepNext: true, children: runs([{ t: title, i: true }]) }),
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: !!note, spacing: TIGHT,
      children: [new ImageRun({ type: "png", data: fs.readFileSync(full), transformation: { width, height } })] }),
  ];
  if (note) out.push(new Paragraph({ spacing: { before: 80, after: 240, line: 276 }, children: runs([{ t: "주. ", i: true, size: 18 }, { t: note, size: 18 }]) }));
  return out;
}

// ---------------------------------------------------------------- 자주 쓰는 값
const cb = D.algos.catboost, lg = D.algos.logistic, lgb = D.algos.lightgbm, mlp = D.algos.mlp, rf = D.algos.random_forest;
const dom = D.domains;
const add = (d, a = "catboost") => dom[d][a].add;
const drop = (d, a = "catboost") => dom[d][a].drop;
const prox = dom.proximal.catboost.proximal;
const orFind = (name, level) => {
  const o = D.or_all.find((x) => x.name === name && x.level === level);
  if (!o) throw new Error(`회귀 결과에 없음: ${name}=${level}`);
  return o;
};
const orTxt = (o) => `OR ${f(o.or, 2)}, 95% CI ${ci(o.lo, o.hi, 2)}`;
const comboBy = (p) => D.combos.find((c) => c.partner === p);
const cnt = (k) => D.counts.find((c) => c.k === k);
const cnt0 = D.counts[0], cntMax = D.counts[D.counts.length - 1];
const ageD = (g, d) => D.age[g][d].d;
const sg = (name) => D.subgroup.find((x) => x.subgroup === name);
const ADD_ORDER = ["phys", "care", "econ", "social", "behav", "env"];
const MAIN_ORDER = ["demo", "econ", "phys", "behav", "social", "env", "care"];
const best = [...D.combos].filter((c) => !c.proximal).sort((a, b) => a.prev_both - b.prev_both);
const largestJoint = [...D.combos].filter((c) => !c.proximal).sort((a, b) => a.joint_diff - b.joint_diff)[0];
const food = orFind("식품안정성", "자주 부족"), chew = orFind("저작불편", "매우 불편"), unmet = orFind("미충족 의료", "있음");
const friend = orFind("친구 연락", "월 1회 미만"), smoke = orFind("흡연", "현재흡연"), bf = orFind("아침식사", "거의 안 함");
const fall = orFind("낙상", "예"), obese = orFind("인지 체형", "매우 비만"), thin = orFind("인지 체형", "매우 마름");
const walk = orFind("걷기 실천", "아니오"), strength = orFind("근력운동 주2일+", "아니오"), aerobic = orFind("중강도 이상 신체활동", "아니오");
const nodrink = orFind("음주 빈도", "안 마심"), hrd = orFind("고위험음주", "예"), female = orFind("성별", "여");
const hl = orFind("의료진 설명 이해", "매우 어려움"), safe = orFind("동네 안전", "아니오"), trust = orFind("이웃 신뢰", "아니오");
const ecig = orFind("전자담배", "예");
const foodCrude = D.crude_top.find((c) => c.label === "가구 식품안정성");

// ---------------------------------------------------------------- 참고문헌 (APA 7, 모두 서지 확인 완료)
const REFS = [
  "보건복지부. (2026). 제6차 국민건강증진종합계획(Health Plan 2030, 2026~2030). https://www.mohw.go.kr/menu.es?mid=a10706010100",
  "질병관리청. (2025). 지역사회건강조사 2025년 원시자료 이용지침서. 질병관리청.",
  "Berkman, L. F., Glass, T., Brissette, I., & Seeman, T. E. (2000). From social integration to health: Durkheim in the new millennium. Social Science & Medicine, 51(6), 843–857. https://doi.org/10.1016/S0277-9536(00)00065-4",
  "Collins, G. S., Moons, K. G. M., Dhiman, P., Riley, R. D., Beam, A. L., Van Calster, B., Ghassemi, M., Liu, X., Reitsma, J. B., van Smeden, M., Boulesteix, A.-L., Camaradou, J. C., Celi, L. A., Denaxas, S., Denniston, A. K., Glocker, B., Golub, R. M., Harvey, H., Heinze, G., . . . Logullo, P. (2024). TRIPOD+AI statement: Updated guidance for reporting clinical prediction models that use regression or machine learning methods. BMJ, 385, e078378. https://doi.org/10.1136/bmj-2023-078378",
  "Engel, G. L. (1977). The need for a new medical model: A challenge for biomedicine. Science, 196(4286), 129–136. https://doi.org/10.1126/science.847460",
  "Grinsztajn, L., Oyallon, E., & Varoquaux, G. (2022). Why do tree-based models still outperform deep learning on typical tabular data? In Advances in Neural Information Processing Systems 35. https://doi.org/10.48550/arXiv.2207.08815",
  "Han, J.-T., & Park, I.-S. (2025). Development of a depression risk prediction model in Korea using machine learning-based feature selection. Journal of the Korean Data & Information Science Society, 36(1), 163–177. https://doi.org/10.7465/jkdi.2025.36.1.163",
  "IPAQ Research Committee. (2005). Guidelines for data processing and analysis of the International Physical Activity Questionnaire (IPAQ): Short and long forms. https://biobank.ctsu.ox.ac.uk/ukb/ukb/docs/ipaq_analysis.pdf",
  "Ke, G., Meng, Q., Finley, T., Wang, T., Chen, W., Ma, W., Ye, Q., & Liu, T.-Y. (2017). LightGBM: A highly efficient gradient boosting decision tree. In Advances in Neural Information Processing Systems 30.",
  "Kim, A.-Y., Nam, S.-A., Roh, S.-Y., & Kim, G.-K. (2025). Patterns of physical activity and depressive symptoms among Korean adults: A descriptive cross-sectional analysis of the 2023 Korea Community Health Survey. Healthcare, 13(24), 3221. https://doi.org/10.3390/healthcare13243221",
  "Kisely, S., Sawyer, E., Siskind, D., & Lalloo, R. (2016). The oral health of people with anxiety and depressive disorders: A systematic review and meta-analysis. Journal of Affective Disorders, 200, 119–132. https://doi.org/10.1016/j.jad.2016.04.040",
  "Kroenke, K., Spitzer, R. L., & Williams, J. B. W. (2001). The PHQ-9: Validity of a brief depression severity measure. Journal of General Internal Medicine, 16(9), 606–613. https://doi.org/10.1046/j.1525-1497.2001.016009606.x",
  "Lee, J., Lee, J.-E., Kim, S., Min, H. S., & Lee, K.-S. (2025). Social network, perceived satisfaction with neighborhoods and depressive symptoms among older adults in Korea. Scientific Reports, 15, 42319. https://doi.org/10.1038/s41598-025-26332-2",
  "Lee, Y., & Park, S. (2021). Understanding of physical activity in social ecological perspective: Application of multilevel model. Frontiers in Psychology, 12, 622929. https://doi.org/10.3389/fpsyg.2021.622929",
  "Lumley, T. (2004). Analysis of complex survey samples. Journal of Statistical Software, 9(8), 1–19. https://doi.org/10.18637/jss.v009.i08",
  "Lundberg, S. M., Erion, G., Chen, H., DeGrave, A., Prutkin, J. M., Nair, B., Katz, R., Himmelfarb, J., Bansal, N., & Lee, S.-I. (2020). From local explanations to global understanding with explainable AI for trees. Nature Machine Intelligence, 2(1), 56–67. https://doi.org/10.1038/s42256-019-0138-9",
  "McLeroy, K. R., Bibeau, D., Steckler, A., & Glanz, K. (1988). An ecological perspective on health promotion programs. Health Education Quarterly, 15(4), 351–377. https://doi.org/10.1177/109019818801500401",
  "Noetel, M., Sanders, T., Gallardo-Gómez, D., Taylor, P., del Pozo Cruz, B., van den Hoek, D., Smith, J. J., Mahoney, J., Spathis, J., Moresi, M., Pagano, R., Pagano, L., Vasconcellos, R., Arnott, H., Varley, B., Parker, P., Biddle, S., & Lonsdale, C. (2024). Effect of exercise for depression: Systematic review and network meta-analysis of randomised controlled trials. BMJ, 384, e075847. https://doi.org/10.1136/bmj-2023-075847",
  "Pourmotabbed, A., Moradi, S., Babaei, A., Ghavami, A., Mohammadi, H., Jalili, C., Symonds, M. E., & Miraghajani, M. (2020). Food insecurity and mental health: A systematic review and meta-analysis. Public Health Nutrition, 23(10), 1778–1790. https://doi.org/10.1017/S136898001900435X",
  "Prokhorenkova, L., Gusev, G., Vorobev, A., Dorogush, A. V., & Gulin, A. (2018). CatBoost: Unbiased boosting with categorical features. In Advances in Neural Information Processing Systems 31 (pp. 6638–6648).",
  "Shaper, A. G., Wannamethee, G., & Walker, M. (1988). Alcohol and mortality in British men: Explaining the U-shaped curve. The Lancet, 2(8623), 1267–1273. https://doi.org/10.1016/S0140-6736(88)92890-5",
  "von Elm, E., Altman, D. G., Egger, M., Pocock, S. J., Gøtzsche, P. C., Vandenbroucke, J. P., & STROBE Initiative. (2007). The Strengthening the Reporting of Observational Studies in Epidemiology (STROBE) statement: Guidelines for reporting observational studies. PLoS Medicine, 4(10), e296. https://doi.org/10.1371/journal.pmed.0040296",
  "World Health Organization. (2020). WHO guidelines on physical activity and sedentary behaviour. World Health Organization.",
  "Zhao, Y., Yang, L., Sahakian, B. J., Langley, C., Zhang, W., Kuo, K., Li, Z., Gan, Y., Li, Y., Zhao, Y., Yu, J., Feng, J., & Cheng, W. (2023). The brain structure, immunometabolic and genetic mechanisms underlying the association between lifestyle and depression. Nature Mental Health, 1(10), 736–750. https://doi.org/10.1038/s44220-023-00120-1",
];
const refPara = (t) => new Paragraph({ children: runs([t]), spacing: BODY, indent: { left: 720, hanging: 720 }, alignment: AlignmentType.LEFT });

// ================================================================ 본문
const C = []; // 문서 내용

// ---- 표지 (APA 학생 논문)
C.push(new Paragraph({ spacing: { before: 2400 }, children: [] }));
C.push(center([{ t: "한국 성인의 우울 증상과 관련된 다차원 요인", b: true }]));
C.push(center([{ t: "— 2025 지역사회건강조사 자료의 머신러닝 영역 기여도 분석과 조사설계 기반 회귀분석 —", b: true }]));
C.push(center([{ t: "Multidimensional Correlates of Depressive Symptoms Among Korean Adults: Domain-Level Machine Learning and Survey-Weighted Regression Analyses of the 2025 Korea Community Health Survey", i: true }]));
C.push(center([""]));
C.push(center([HL("[저자명 1], [저자명 2], [저자명 3]")]));
C.push(center(["한국외국어대학교 ", HL("[학과명]")]));
C.push(center(["S01418201 스포츠융합산업프로젝트실습"]));
C.push(center(["박성희 교수 외 팀티칭"]));
C.push(center([HL("[제출일: 2026년 ○월 ○일]")]));
C.push(new Paragraph({ spacing: { before: 1200 }, children: [] }));
C.push(center([{ t: "저자 노트", b: true }]));
C.push(P(["연구비: ", HL("[연구비 지원 여부와 지원 기관을 기재]"), " 이해상충: ", HL("[이해상충 여부를 기재]"),
  " 생성형 AI 활용: ", HL("[예: 분석 코드와 원고 초안 작성에 Anthropic Claude를 활용하였으며 저자가 모든 결과와 문장을 검토·수정하였다 — 학교·학술지 규정에 맞게 수정]"),
  " 교신저자: ", HL("[이름, 이메일]")], { noIndent: true }));
C.push(pageBreak());

// ---- 국문 초록
C.push(H1("국문 초록"));
C.push(PL([{ t: "목적: ", b: true }, "이 연구는 한국 성인의 우울 증상을 단일 요인이 아니라 인구·경제·신체건강·건강행태·사회관계·생활환경·의료접근의 다차원 관점에서 분석하여, 어떤 영역과 요인이 우울 증상과 가장 강하게 관련되는지, 그리고 신체활동이 다른 생활요인과 함께할 때 어떤 조합에서 우울 증상 비율이 가장 낮은지를 확인하고자 하였다."], { noIndent: true }));
C.push(PL([{ t: "방법: ", b: true }, `2025년 지역사회건강조사 원시자료의 만 19세 이상 성인 ${n0(N.analysis)}명을 분석한 횡단면 연구이다. 결과변수는 PHQ-9 총점 10점 이상(우울 증상 기준 충족)으로 정의하였다. 원시자료 문항을 8개 영역 ${N.n_features}개 변수로 구성하고, 우울 증상과 개념이 겹치는 심리·증상근접 영역은 주 분석에서 분리하였다. 가구 단위로 학습셋과 시험셋을 나누어 CatBoost를 포함한 6개 알고리즘을 비교하였고, 영역을 하나씩 추가·제거하는 실험과 SHAP으로 영역·변수 기여도를 평가하였다. 또한 가중치·층·집락을 반영한 로지스틱 회귀로 조정 오즈비와 신체활동·생활요인 조합별 조정 유병률을 추정하였다. 바꿀 수 있는 요인은 국가 건강증진계획에, 생활요인은 선행연구의 건강 생활 영역에 대응시켜 미리 정한 기준으로 선정하였다.`], { noIndent: true }));
C.push(PL([{ t: "결과: ", b: true }, `우울 증상 기준 충족률은 ${pct(N.prev_w, 2)}(가중)였다. 주 분석 모형(CatBoost)의 시험셋 average precision(AP)은 ${f(cb.full.ap)}(ROC-AUC ${f(cb.full.auc)})로, 인구 정보만 쓴 모형(${f(D.sets.base.catboost.ap)})보다 높았다. 모든 영역이 단독으로도, 다른 영역을 모두 포함한 뒤에도 유의한 정보를 더했으며, 신체건강 영역의 기여가 가장 컸다(ΔAP ${signed(add("phys").d)}). 바꿀 수 있는 요인 중에서는 식품 불안정(${orTxt(food)}), 저작불편(${orTxt(chew)}), 미충족 의료(${orTxt(unmet)}), 친구와의 연락 단절(${orTxt(friend)}), 현재흡연(${orTxt(smoke)}), 아침 결식(${orTxt(bf)}), 걷기 미실천(${orTxt(walk)}), 근력운동 주 2일 미만(${orTxt(strength)})이 우울 증상과 관련되었다. 신체활동 권고 충족과 다른 건강 생활요인을 함께 충족한 개수가 많을수록 조정 유병률은 ${pct(cnt0.prev)}(${cnt0.k})에서 ${pct(cntMax.prev)}(${cntMax.k})로 단계적으로 낮아졌다.`], { noIndent: true }));
C.push(PL([{ t: "결론: ", b: true }, "우울 증상은 여러 영역의 요인이 독립적으로 함께 관련되는 복합 현상이다. 신체활동은 사회적 교류, 식생활, 금연 등 다른 생활요인과 함께 실천할 때 우울 증상 비율이 가장 낮았다. 횡단면 자료이므로 인과적 효과로 해석해서는 안 되며, 운동과 사회적 교류를 결합한 프로그램의 효과는 중재연구로 검증할 필요가 있다."], { noIndent: true }));
C.push(PL([{ t: "주요어: ", b: true }, "우울 증상, PHQ-9, 다차원 요인, 신체활동, 머신러닝, SHAP, 지역사회건강조사"], { noIndent: true }));
C.push(pageBreak());

// ---- 영문 초록
C.push(H1("Abstract"));
C.push(PL([{ t: "Objective: ", b: true }, "This study examined depressive symptoms among Korean adults from a multidimensional perspective covering demographic, economic, physical health, health behavior, social, environmental, and healthcare access domains, to identify which domains and factors are most strongly associated with depressive symptoms and which combinations of physical activity and other lifestyle factors show the lowest prevalence."], { noIndent: true }));
C.push(PL([{ t: "Methods: ", b: true }, `In this cross-sectional study of ${n0(N.analysis)} adults aged 19 years or older from the 2025 Korea Community Health Survey, depressive symptoms were defined as a PHQ-9 score of 10 or higher. We constructed ${N.n_features} variables in eight domains and separated a symptom-proximal psychological domain from the main analysis. Six algorithms, including CatBoost, were compared using a household-level train–test split; domain contributions were assessed with add-one-domain and leave-one-domain-out experiments and SHAP values. Survey-weighted logistic regression accounting for strata and clusters estimated adjusted odds ratios and adjusted prevalences by combinations of physical activity and lifestyle factors. Modifiable factors and lifestyle factors were selected by prespecified rules mapped to the national health promotion plan and to established healthy lifestyle domains.`], { noIndent: true }));
C.push(PL([{ t: "Results: ", b: true }, `The weighted prevalence of depressive symptoms was ${pct(N.prev_w, 2)}. The main CatBoost model achieved a test average precision of ${f(cb.full.ap)} (ROC-AUC ${f(cb.full.auc)}) compared with ${f(D.sets.base.catboost.ap)} for demographics alone. Every domain added significant information both alone and after all other domains were included, with physical health contributing most. Among modifiable factors, food insecurity (OR ${f(food.or, 2)}), chewing difficulty (OR ${f(chew.or, 2)}), unmet medical needs (OR ${f(unmet.or, 2)}), infrequent contact with friends (OR ${f(friend.or, 2)}), current smoking (OR ${f(smoke.or, 2)}), skipping breakfast (OR ${f(bf.or, 2)}), not walking regularly (OR ${f(walk.or, 2)}), and muscle-strengthening activity on fewer than 2 days a week (OR ${f(strength.or, 2)}) were associated with depressive symptoms. The adjusted prevalence decreased stepwise from ${pct(cnt0.prev)} to ${pct(cntMax.prev)} as the number of healthy lifestyle factors met alongside physical activity increased.`], { noIndent: true }));
C.push(PL([{ t: "Conclusions: ", b: true }, "Depressive symptoms are a multifactorial phenomenon jointly associated with multiple domains. Physical activity combined with social connection, regular meals, and non-smoking was associated with the lowest prevalence. Given the cross-sectional design, these associations should not be interpreted causally; integrated exercise and social programs warrant evaluation in intervention studies."], { noIndent: true }));
C.push(PL([{ t: "Keywords: ", b: true }, "depressive symptoms, PHQ-9, multidimensional determinants, physical activity, machine learning, SHAP, Korea Community Health Survey"], { noIndent: true }));
C.push(pageBreak());

// ---- 서론
C.push(center([{ t: "한국 성인의 우울 증상과 관련된 다차원 요인", b: true }]));
C.push(H1("서론"));
C.push(P(["우울은 개인의 기능과 삶의 질을 떨어뜨리는 대표적인 정신건강 문제이다. 우울 증상과 관련된 요인은 하나의 영역에 국한되지 않는다. Engel(1977)은 질병을 생물학적 요인만으로 설명하는 의학 모형의 한계를 지적하고 심리·사회적 측면을 함께 보는 생물심리사회 모형을 제안하였다. McLeroy 등(1988)의 사회생태 모형은 개인 특성뿐 아니라 대인관계, 조직, 지역사회, 정책 수준의 요인을 건강행동의 결정요인으로 함께 다룬다. Berkman 등(2000)은 사회적 연결망이 사회적 지지, 사회적 영향, 사회적 참여, 자원 접근의 경로로 건강에 작용한다고 정리하였다."]));
C.push(P(["국내외 선행연구는 개별 요인과 우울의 관계를 보고해 왔다. 운동 중재의 무작위 대조시험을 종합한 네트워크 메타분석에서는 걷기·조깅, 요가, 근력운동이 우울 증상 완화에 효과적인 운동으로 나타났다(Noetel et al., 2024). 식품 불안정은 우울 위험 증가와 관련되었고(Pourmotabbed et al., 2020), 우울·불안 장애가 있는 사람은 치아 우식과 치아 상실이 더 많았다(Kisely et al., 2016). 국내에서는 지역사회건강조사를 활용하여 신체활동과 우울 증상의 인구집단별 양상을 기술한 연구(Kim et al., 2025), 노인의 사회적 연결망과 동네 만족이 우울 증상과 관련됨을 보인 연구(Lee et al., 2025), 이웃 연결망과 생활환경이 신체활동과 관련됨을 보인 연구(Lee & Park, 2021)가 있다. 영국 바이오뱅크 코호트에서는 신체활동, 수면, 금연, 사회적 연결 등 7개 생활요인을 함께 지킬수록 우울 위험이 낮았다(Zhao et al., 2023)."]));
C.push(P(["그러나 대부분의 연구는 소수의 요인을 중심으로 관계를 검증하였고, 여러 영역의 요인을 한 모형에서 함께 비교하여 어느 영역이 얼마나 독립적인 정보를 갖는지 보여준 연구는 드물다. 머신러닝은 많은 변수 사이의 비선형 관계와 상호작용을 유연하게 다룰 수 있어 영역별 기여도를 비교하는 데 적합하지만, 예측 기여만으로는 연관의 방향과 크기, 모집단 추정의 불확실성을 알 수 없다. 따라서 이 연구는 머신러닝의 영역 기여도 분석과 조사설계를 반영한 회귀분석을 함께 사용하였다."]));
C.push(P(["이 연구의 목적은 2025년 지역사회건강조사 자료를 이용하여 한국 성인의 우울 증상과 관련된 다차원 요인을 분석하는 것이다. 연구 질문은 다음과 같다. 첫째, 어떤 영역과 요인이 우울 증상과 가장 강하게 관련되는가. 둘째, 그중 개인이나 지역사회가 바꿀 수 있는 요인은 무엇인가. 셋째, 신체활동이 다른 생활요인과 함께할 때 우울 증상 비율이 가장 낮은 조합은 무엇인가. 넷째, 연령대에 따라 관련 영역이 달라지는가."]));

// ---- 연구방법
C.push(H1("연구방법"));
C.push(H2("연구설계와 자료"));
C.push(P([`이 연구는 질병관리청의 2025년 지역사회건강조사 원시자료를 이차 분석한 횡단면 연구이다(질병관리청, 2025). 지역사회건강조사는 통·반·리의 주거용 주택(아파트, 일반주택)에 거주하는 만 19세 이상 성인을 조사모집단으로, 동·읍·면과 주택유형에 따라 층화한 뒤 표본지점과 가구를 계통추출하는 복합표본 조사이며, 보건소별 평균 900명을 목표로 한다. 2025년 조사는 2025년 5월 16일부터 7월 31일까지 훈련된 조사원이 표본가구를 방문하여 1:1 면접조사로 수행되었다(질병관리청, 2025). 이 연구의 자료에는 ${n0(N.strata)}개 층과 ${n0(N.psu)}개 표본지점(집락)이 포함되었다. 보고는 관찰연구 보고 지침인 STROBE(von Elm et al., 2007)와 예측모형 보고 지침인 TRIPOD+AI(Collins et al., 2024)를 따랐으며, 항목별 대응은 부록에 정리하였다.`]));
C.push(H2("연구대상"));
C.push(P([`원시자료의 응답자는 ${n0(N.raw)}명이었다. 이 중 PHQ-9 9개 문항 가운데 하나 이상을 거부하거나 모름으로 응답하여 결과변수를 산출할 수 없는 ${n0(N.y_missing)}명을 제외한 ${n0(N.analysis)}명(${n0(N.households)}가구)을 분석하였다(그림 1).`]));
C.push(...apaFigure({ file: "fig1_flow.png", title: "연구대상 선정과 분석 흐름", widthIn: 5.6,
  note: "PHQ-9 = Patient Health Questionnaire-9. 머신러닝의 학습·시험 분할은 같은 가구의 구성원이 한쪽에만 속하도록 가구 단위로 수행하였다." }));
C.push(H2("변수"));
C.push(H3("결과변수"));
C.push(P(["결과변수는 우울 증상 기준 충족 여부이다. PHQ-9은 최근 2주 동안의 우울 증상 9개 문항에 각 0~3점을 부여하여 합산하며(0~27점), 10점 이상을 우울 증상 기준 충족으로 정의하였다. 10점 기준은 주요우울장애에 대해 민감도와 특이도가 각각 88%로 보고된 절단점이다(Kroenke et al., 2001). 9개 문항이 모두 유효할 때만 총점을 산출하였다. PHQ-9 기준 충족은 임상 진단이 아니므로 이 연구에서는 \"우울 증상 기준 충족\"으로 표기하였다."]));
C.push(H3("독립변수"));
C.push(P([`이용지침서의 변수설계표에서 원시자료 201개 열의 문항과 코드표를 모두 확인한 뒤, 생물심리사회 모형과 사회생태 모형에 따라 우울 증상과 관련될 수 있는 문항을 8개 영역 ${N.n_features}개 변수로 구성하였다(표 1, 부록 표 S1). 각 변수는 수정 가능성에 따라 세 유형으로 분류하였다. A(개인 행동)는 본인이 선택하는 행동(신체활동, 흡연, 음주, 식생활, 칫솔질, 사회적 교류, 검진·예방접종 등), B(서비스·정책·환경)는 개인의 노력만으로는 바꾸기 어렵지만 제도나 지역사회 개입으로 개선할 수 있는 현재 상태(소득·식품안정성·경제활동, 체중·구강건강·낙상, 미충족 의료, 건강정보 이해능력, 동네 환경과 이웃 신뢰 등), C(바꿀 수 없음)는 고정된 속성, 과거의 진단, 거주 구조(나이, 성별, 교육, 혼인, 세대유형, 만성질환 진단, 지역 등)이다. 분류는 제6차 국민건강증진종합계획의 분야(건강생활 실천, 비감염성 질환 예방관리, 건강친화적 환경 구축)와 대응시켜 정하였으며(보건복지부, 2026), A와 B를 “바꿀 수 있는 요인”으로 보았다. 같은 변수 안에서도 “모름”, “진료가 필요 없었음”, 직업군 세부 범주처럼 행동으로 옮길 수 없는 수준은 바꿀 수 있는 요인의 목록에서 제외하였다. 현재흡연, 고위험음주, 중강도 이상 신체활동은 이용지침서의 지표 산출 코드를 그대로 적용하였다. 신체활동은 걷기·근력운동·고강도·중강도 활동 일수와 함께 IPAQ 채점 지침의 MET 가중치(고강도 8.0, 중강도 4.0, 걷기 3.3)와 1일 180분 상한 규칙으로 산출한 주간 신체활동량을 사용하였다(IPAQ Research Committee, 2005). 조합 분석에서는 걷기 실천(주 5일 이상, 1일 30분 이상) 또는 중강도 이상 신체활동 실천과 근력운동 주 2일 이상을 모두 충족한 경우를 신체활동 권고 충족으로 정의하였다(World Health Organization, 2020).`]));
const domRows = [
  ["인구", "5", "0", "나이, 성별, 교육수준, 혼인상태, 세대유형"],
  ["경제", "5", "5", "균등화 가구소득, 기초생활수급, 가구 식품안정성, 직업, 종사상 지위"],
  ["신체건강", "9", "6", "BMI, 인지 체형, 고혈압·당뇨병·골다공증 진단, 주관적 구강건강, 저작불편, 낙상, 사고·중독"],
  ["건강행태", "12", "12", "걷기·근력운동·고강도·중강도 신체활동 일수, 주간 신체활동량, 흡연, 전자담배, 음주 빈도, 폭음, 아침식사, 체중조절, 점심 후 칫솔질"],
  ["사회관계", "6", "5", "친척·이웃·친구와 연락 빈도, 이웃 간 신뢰, 이웃 경조사 참여, 치매환자 가족"],
  ["생활환경", "8", "5", "동네 안전·자연환경·생활환경·대중교통·의료서비스 만족, 동/읍·면, 주택유형, 시도"],
  ["의료접근·건강정보", "8", "8", "미충족 의료, 미충족 치과의료, 건강검진, 독감 예방접종, 보건기관 이용, 건강정보 이해능력 3문항"],
  ["심리·증상근접 (주 분석 제외)", "13", "7", "주관적 스트레스, 주중·주말 수면시간, 주관적 건강, EQ-5D 4개 차원, 행복감, 침상와병, 인터넷·도박으로 인한 일상 지장, 인지장애 경험"],
];
const modCnt = (lab) => {
  const k = Object.keys(DL).find((d) => lab.startsWith(DL[d]));
  const vs = D.variables.filter((v) => v.domain === k);
  return ["A", "B", "C"].map((t) => vs.filter((v) => v.mod_type === t).length).join(" / ");
};
C.push(...apaTable({ title: "영역별 독립변수 구성", head: ["영역", "변수 수", "A / B / C", "변수"], widths: [2.2, 0.8, 1.1, 6.3],
  rows: domRows.map((r) => [r[0], r[1], modCnt(r[0]), r[3]]), note: "A = 개인 행동, B = 서비스·정책·환경으로 개선 가능, C = 바꿀 수 없음으로 분류한 변수의 수(분류 기준은 본문). 변수별 원본 문항, 코딩, 수정 유형, 결측률은 부록 표 S1에 제시하였다." }));
C.push(P(["심리·증상근접 영역은 PHQ-9 문항(수면, 피로, 흥미, 집중)과 개념이 겹치거나 우울 증상의 결과일 가능성이 커서 주 분석에서 제외하고, 포함했을 때의 결과를 별도로 보고하였다. PHQ-9 문항 자체, 우울감 경험, 우울로 인한 상담, EQ-5D 불안·우울 차원은 결과변수와 직접 겹치므로 모든 분석에서 제외하였다. 질문 분기에 따른 비해당 응답(예: 걷기 0일인 경우의 걷기 시간)은 원시자료에서 상위 문항 응답과 개인 단위로 일치하는지 확인한 뒤 해당 범주로 처리하였다."]));
C.push(H3("결측 처리"));
C.push(P([`응답 거부와 모름은 결측으로 처리하였다. 동네 인식 문항의 \"모름\" 응답은 이웃과의 접촉 부족을 반영할 수 있어 별도 범주로 두었다. 분석 변수의 결측률은 최대 ${f(N.max_missing_pct, 2)}%(BMI)였다. 머신러닝에서는 학습 데이터에서만 대치값을 적합하여 수치형 변수는 중앙값과 결측 지시변수로, 범주형 변수는 최빈값으로 대치하였고, CatBoost는 내장 방식으로 처리하였다. 회귀분석은 완전 사례 ${n0(N.reg)}명(분석표본의 ${f(N.reg_pct, 1)}%)을 분석하였다.`]));
C.push(H2("통계분석"));
C.push(H3("기술통계와 조사설계 기반 회귀분석"));
C.push(P(["모집단 수준의 비율은 개인 가중치를 적용하였다. 조사설계 기반 로지스틱 회귀는 가중치, 층, 집락을 반영하고 분산은 테일러 선형화로 추정하였다(Lumley, 2004). 설계 자유도는 표본지점 수에서 층 수를 뺀 값을 사용하였다. 주 분석 7개 영역의 변수를 동시에 투입하여 조정 오즈비와 95% 신뢰구간을 추정하였고, 해석을 위해 연령, 소득, BMI는 범주화하였다. 범주형 변수의 기준범주는 건강하거나 바람직한 상태(예: 신체활동 실천, 비흡연, 식품 충분)로 두어 위험 쪽 수준의 오즈비가 1보다 크게 나타나도록 하였다. BMI는 임상 정상범위(18.5–23)를 기준으로 하였다. 다범주 변수는 수정 Wald F 검정으로 결합 유의성을 평가하였다. 신체활동 조합 분석에서는 인구·경제·신체건강 변수를 조정한 상태에서 신체활동 권고 충족과 각 생활요인의 2×2 조합별 조정 유병률(예측 주변값)을 추정하고, 가법 척도와 승법 척도의 상호작용을 모두 검정하였다. 생활요인의 선정 기준과 건강 생활요인 점수의 정의는 다음 절에 제시하였다."]));
C.push(H3("생활요인 선정과 건강 생활요인 점수"));
C.push(P(["신체활동과 함께 살펴볼 생활요인은 사전에 정한 다섯 가지 기준을 모두 충족하는 문항으로 선정하였다. 첫째, 수정 유형이 A(개인 행동)일 것, 둘째, 우울과 관련된 건강 생활요인으로 정의된 7개 영역(신체활동, 흡연, 음주, 식생활, 수면, 좌식행동, 사회적 연결; Zhao et al., 2023)이나 국민건강증진종합계획의 건강생활 실천 분야(금연, 절주, 영양, 신체활동, 구강건강; 보건복지부, 2026)에 속할 것, 셋째, 이용지침서의 지표나 공중보건 권고로 충족 기준이 정해져 있을 것, 넷째, 영역마다 대표 문항 하나만 사용할 것, 다섯째, PHQ-9와 개념이 겹치는 심리·증상근접 변수는 민감도 분석에만 사용할 것이다. 두 틀을 합친 8개 영역 가운데 흡연, 음주, 식생활, 사회적 연결, 구강건강 영역에서 각각 담배제품 현재 미사용, 고위험음주 아님, 아침식사 주 5회 이상, 사회적 연결, 저녁식사 후 또는 잠자기 전 칫솔질을 사용하였다(표 2). 수면(주중 7~9시간)은 민감도 분석으로 보고하였고, 좌식행동은 2025년 조사에 해당 문항이 없어 제외하였다. 사회적 연결은 Zhao 등(2023)이 사용한 사회적 고립 지수(혼자 삶, 친구·가족과 월 1회 이하 만남, 여가·사회활동 없음)를 1인 가구, 친척·친구와의 연락 빈도, 이웃 경조사 참여로 대응시켜 0~1점이면 연결된 것으로 정의하였다. 이웃 신뢰와 동네 안전은 생활습관이 아니라 사회·환경 맥락(수정 유형 B)이므로 같은 방식의 조합 결과를 부록에만 제시하였다."]));
C.push(P(["건강 생활요인 점수는 신체활동 권고 충족과 위 5개 생활요인 가운데 충족한 개수(0~6점)를 비가중으로 합산한 값이다. 요인을 정해진 순서대로 하나씩 더해 가는 방식이 아니라 응답자마다 충족한 요인의 수를 센 것이므로 요인 사이에 순서는 없다(Zhao et al., 2023). 점수별 조정 유병률과 함께 1점 증가당 오즈비(선형 추세)를 추정하였고, 양 끝 점수의 인원이 1,000명 미만이면 안쪽 점수와 합치기로 미리 정하였다. 특정 요인 하나가 결과를 이끄는지 확인하기 위해 요인을 하나씩 뺀 점수 6종과 수면을 더한 0~7점 점수로 민감도 분석을 하였다."]));
const LF = D.lifestyle_prev;
C.push(...apaTable({ title: "생활요인 선정 기준에 따른 문항 대응", head: ["생활 영역", "사용 문항", "충족 기준", "기준의 근거", "충족률(가중 %)"],
  widths: [1.4, 2.0, 3.2, 2.6, 1.2],
  rows: [
    ["신체활동", "신체활동 권고 충족(기준축)", "(걷기 실천 또는 중강도 이상 신체활동 실천) 그리고 근력운동 주 2일 이상", "WHO 신체활동 지침의 유산소·근력 권고, 이용지침서 지표", f(LF["신체활동 권고 충족"], 1)],
    ["흡연", "담배제품 현재 미사용", "궐련 현재흡연도, 궐련형·액상형 전자담배 현재 사용도 아님", "이용지침서 현재흡연율·전자담배 현재사용률", f(LF["담배제품 미사용"], 1)],
    ["음주", "고위험음주 아님", "주 2회 이상이면서 1회 남 7잔·여 5잔 이상 음주가 아님", "이용지침서 고위험음주율", f(LF["고위험음주 아님"], 1)],
    ["식생활", "아침식사 주 5회 이상", "최근 1년 동안 주 5~7회 아침식사", "이용지침서 아침식사 실천율(식품군 섭취 문항이 없어 대리 지표)", f(LF["아침식사 주 5회 이상"], 1)],
    ["사회적 연결", "사회적 연결", "고립 지수(1인 가구 + 친척·친구 모두 월 1회 이하 연락 + 이웃 경조사 불참) 0~1점", "Zhao 등(2023)의 사회적 고립 지수", f(LF["사회적 연결"], 1)],
    ["구강건강", "저녁 후·잠자기 전 칫솔질", "어제 저녁식사 후 또는 잠자기 전 칫솔질 실천", "이용지침서 저녁식사 후 또는 잠자기 전 칫솔질 실천율(HP2030 구강건강 분야)", f(LF["저녁 후·잠자기 전 칫솔질"], 1)],
    ["수면", "주중 수면 7~9시간 (민감도)", "주중 하루 평균 수면 7~9시간", "심리·증상근접 변수(PHQ-9 수면 문항과 겹침)", f(LF["주중 수면 7~9시간"], 1)],
    ["좌식행동", "–", "–", "2025년 조사에 문항 없음", "–"],
  ],
  note: "생활 영역은 Zhao 등(2023)의 7개 건강 생활요인과 국민건강증진종합계획의 건강생활 실천 분야를 합친 8개 영역이다. 선정 기준: 수정 유형 A, 8개 영역 중 하나, 충족 기준이 정해짐, 영역당 1개 문항, 심리·증상근접 변수는 민감도 분석에만 사용. 충족률은 분석표본의 가중 비율이다." }));
C.push(H3("머신러닝"));
C.push(P([`머신러닝 모형은 개인을 선별하는 도구가 아니라, 영역별로 우울 증상 구분에 기여하는 정보의 양을 비교하기 위한 분석 도구로 사용하였다. 분석표본을 가구 단위로 학습셋 ${n0(N.train)}명(우울 증상 기준 충족 ${n0(N.train_y1)}명)과 시험셋 ${n0(N.test)}명(${n0(N.test_y1)}명)으로 나누었다. 알고리즘은 L2 정규화 로지스틱 회귀(나이는 3차 스플라인), CatBoost(Prokhorenkova et al., 2018), LightGBM(Ke et al., 2017), 랜덤포레스트, 다층 퍼셉트론(MLP), 사전확률만 쓰는 기준 모형을 비교하였다. 표 형식 자료에서는 트리 기반 모형이 딥러닝보다 우수한 경우가 많아(Grinsztajn et al., 2022) MLP는 비교군으로 두었다. 영역 간 비교를 공정하게 하기 위해 하이퍼파라미터는 사전에 고정하였고, 클래스 불균형 보정은 확률 보정을 해치므로 적용하지 않았다. 학습셋 안에서 가구 단위 층화 5-fold 교차검증을 수행한 뒤 학습셋 전체로 다시 학습하여 시험셋에서 한 번 평가하였다.`]));
C.push(P(["양성 비율이 낮으므로 주 평가지표는 average precision(AP, 정밀도-재현율 곡선 아래 면적)으로 하고, ROC-AUC, Brier 점수, 예측 위험 상위 10%의 정밀도와 재현율을 함께 보고하였다. 영역 기여도는 두 가지 실험으로 평가하였다. 영역 추가 실험은 인구 영역에 다른 영역을 하나씩 더했을 때의 AP 증가(단독 정보량)를, 영역 제거 실험은 주 분석 전체 모형에서 영역을 하나씩 뺐을 때의 AP 감소(다른 영역과 겹치지 않는 고유 기여)를 측정한다. 모형 간 AP 차이의 95% 신뢰구간은 같은 시험셋에서 가구 단위 부트스트랩 1,000회로 추정하였다. 변수 수준의 기여는 CatBoost의 SHAP 값으로 평가하였고(Lundberg et al., 2020), 영역별 SHAP 합계 비중과 영역 단위 순열 중요도를 함께 산출하였다. 연령대별(19~39세, 40~64세, 65세 이상)로는 해당 연령대 안에서 모형을 다시 학습하여 영역 추가 실험을 반복하였다. 모형 성능이 집단에 따라 달라지는지 확인하기 위해 성별과 연령대별 하위집단 성능(AP, ROC-AUC, 보정)도 평가하였다. 모형은 위험 확률을 출력하며, 특정 분류 임계값은 정하지 않고 예측 위험 상위 10%의 정밀도와 재현율을 보조 지표로 보고하였다. 분석에는 Python 3.11(pandas, scikit-learn 1.6.1, CatBoost 1.2.10, LightGBM 4.7.0)을 사용하였다."]));
C.push(H2("연구윤리"));
C.push(P(["이 연구는 개인을 식별할 수 없도록 처리된 공개 원시자료를 질병관리청의 원시자료 이용 절차에 따라 분석하였다. ", HL("[소속 기관생명윤리위원회의 심의면제 확인 여부, 기관명과 번호를 기재]"), " 원시자료와 개인 단위 분석 결과는 자료 이용 규정에 따라 외부에 공유하지 않으며, 분석 코드는 ", HL("[공개 여부·제공 방법을 기재]"), "."]));

// ---- 연구결과
C.push(H1("연구결과"));
C.push(H2("연구대상자의 특성"));
C.push(P([`분석표본 ${n0(N.analysis)}명 중 우울 증상 기준 충족자는 ${n0(N.y1)}명이었고, 가중 유병률은 ${pct(N.prev_w, 2)}였다(표 3). 비조정 분석에서 수준 간 유병률 격차가 가장 큰 주 분석 변수는 가구 식품안정성으로, 먹을 것이 자주 부족한 가구에서 ${pct(foodCrude.max)}, 충분한 가구에서 ${pct(foodCrude.min)}였다.`]));
const t1rows = [];
for (const r of D.table1) {
  if (r.type === "header") t1rows.push({ cells: [r.name + (r.missing ? ` (결측 ${n0(r.missing)})` : ""), "", "", "", ""], bold: true });
  else t1rows.push({ cells: [r.level, `${n0(r.all_n)} (${f(r.all_pct, 1)})`, `${n0(r.y0_n)} (${f(r.y0_pct, 1)})`, `${n0(r.y1_n)} (${f(r.y1_pct, 1)})`, f(r.prev_w, 2)], indent: true });
}
C.push(...apaTable({ title: "연구대상자의 특성과 특성별 우울 증상 기준 충족률",
  head: ["특성", "전체 n (가중 %)", "비충족 n (가중 %)", "충족 n (가중 %)", "가중 유병률(%)"],
  widths: [3.4, 1.7, 1.7, 1.5, 1.3], rows: t1rows,
  note: `전체 N = ${n0(N.analysis)}, 비충족 n = ${n0(N.y0)}, 충족 n = ${n0(N.y1)}. n은 비가중 인원, %는 개인 가중치를 적용한 열 백분율이다. 가중 유병률은 해당 수준 안에서 우울 증상 기준을 충족한 가중 비율이다. 신체활동 권고 충족 = (걷기 실천 또는 중강도 이상 신체활동 실천) 그리고 근력운동 주 2일 이상.` }));

C.push(H2("머신러닝 모형의 분류 성능"));
C.push(P([`주 분석 7개 영역을 사용한 모형의 시험셋 AP는 CatBoost ${f(cb.full.ap)}, 로지스틱 회귀 ${f(lg.full.ap)}, LightGBM ${f(lgb.full.ap)}, MLP ${f(mlp.full.ap)}, 랜덤포레스트 ${f(rf.full.ap)}였다(표 4). 상위 세 알고리즘의 차이는 ${f(cb.full.ap - lgb.full.ap)} 이내로 작았다. 인구 영역만 사용한 CatBoost의 AP는 ${f(D.sets.base.catboost.ap)}였다. 학습셋과 시험셋의 양성률은 각각 ${pct(N.train_prev, 2)}와 ${pct(N.test_prev, 2)}로 비슷하였다. CatBoost의 시험셋 AP의 95% 신뢰구간은 ${ci(cb.full.ap_lo, cb.full.ap_hi)}였고, 예측 위험 상위 10%에 실제 우울 증상 기준 충족자의 ${pct(cb.full.rec10)}가 포함되었다. 보정 기울기는 ${f(cb.full.slope, 2)}, 관측 대 예측 비는 ${f(cb.full.oe, 2)}로 예측 확률이 실제 비율과 잘 맞았으며, 랜덤포레스트만 보정 기울기가 ${f(rf.full.slope, 2)}로 예측이 덜 극단적이었다. 하위집단별 AP는 남성 ${f(sg("남자").AP)}, 여성 ${f(sg("여자").AP)}, 19~39세 ${f(sg("19~39세").AP)}, 40~64세 ${f(sg("40~64세").AP)}, 65세 이상 ${f(sg("65세 이상").AP)}로 청년층에서 가장 낮았다(부록 표 S3). 심리·증상근접 영역을 추가하면 AP가 ${f(cb["full+proximal"].ap)}로 높아졌다(ΔAP ${signed(prox.d)}, 95% CI ${ci(prox.lo, prox.hi)}). 인구 영역과 심리·증상근접 영역만 사용해도 AP가 ${f(D.sets["base+proximal"].catboost.ap)}에 이르러, 이 영역이 우울 증상과 개념적으로 많이 겹친다는 점을 보여주었다.`]));
const algoRow = (name, a, s) => [name, a[s].cv_ap == null ? "–" : `${f(a[s].cv_ap)} (${f(a[s].cv_ap_sd)})`,
  `${f(a[s].ap)} ${ci(a[s].ap_lo, a[s].ap_hi)}`, `${f(a[s].auc)} ${ci(a[s].auc_lo, a[s].auc_hi)}`, f(a[s].brier, 4),
  name.startsWith("기준") ? "–" : f(a[s].slope, 2), pct(a[s].rec10)];
const algoList = [["CatBoost", cb], ["로지스틱 회귀", lg], ["LightGBM", lgb], ["MLP", mlp], ["랜덤포레스트", rf], ["기준 모형(사전확률)", D.algos.dummy]];
C.push(...apaTable({ title: "알고리즘별 분류 성능", head: ["알고리즘", "교차검증 AP (SD)", "시험 AP [95% CI]", "ROC-AUC [95% CI]", "Brier", "보정 기울기", "상위 10% 재현율"],
  widths: [2.2, 1.5, 1.9, 1.9, 0.9, 0.9, 1.0],
  rows: [{ cells: ["주 분석 (7개 영역)", "", "", "", "", "", ""], bold: true }, ...algoList.map(([nm, a]) => ({ cells: algoRow(nm, a, "full"), indent: true })),
    { cells: ["주 분석 + 심리·증상근접", "", "", "", "", "", ""], bold: true }, ...algoList.map(([nm, a]) => ({ cells: algoRow(nm, a, "full+proximal"), indent: true }))],
  note: `AP = average precision. 교차검증은 학습셋(n = ${n0(N.train)}) 안의 가구 단위 층화 5-fold, 시험 지표는 시험셋(n = ${n0(N.test)}, 양성 ${n0(N.test_y1)}명)에서 1회 평가한 값이다. 무작위 분류의 AP 기준값은 시험셋 양성률(${f(N.test_y1 / N.test)})이다. 신뢰구간은 가구 단위 부트스트랩 1,000회. 보정 기울기 = 예측 확률의 로짓에 대한 관측 결과의 로지스틱 회귀 기울기(1에 가까울수록 보정이 좋음).` }));

C.push(H2("영역별 기여도"));
C.push(P([`모든 영역은 인구 영역에 단독으로 더했을 때와 주 분석 전체 모형에서 뺐을 때 모두 AP 변화의 95% 신뢰구간이 0을 포함하지 않았다(표 5, 그림 2). 단독 정보량은 신체건강(ΔAP ${signed(add("phys").d)}), 의료접근·건강정보(${signed(add("care").d)}), 경제(${signed(add("econ").d)}), 사회관계(${signed(add("social").d)}), 건강행태(${signed(add("behav").d)}), 생활환경(${signed(add("env").d)}) 순이었다. 다른 영역을 모두 포함한 뒤의 고유 기여도 신체건강이 가장 컸다(${signed(drop("phys").d)}). 상위 세 영역과 최하위 영역의 순위는 LightGBM과 로지스틱 회귀에서도 같았다. SHAP 합계 비중은 신체건강 ${pct(dom.phys.shap_share)}, 건강행태 ${pct(dom.behav.shap_share)}, 인구 ${pct(dom.demo.shap_share)}, 사회관계 ${pct(dom.social.shap_share)}, 경제 ${pct(dom.econ.shap_share)}, 의료접근·건강정보 ${pct(dom.care.shap_share)}, 생활환경 ${pct(dom.env.shap_share)}였다.`]));
C.push(...apaTable({ title: "영역별 기여도 (CatBoost)", head: ["영역", "단독 정보량 ΔAP [95% CI]", "고유 기여 ΔAP [95% CI]", "순열 중요도", "SHAP 비중"],
  widths: [2.4, 2.4, 2.4, 1.3, 1.2],
  rows: ["phys", "care", "econ", "social", "behav", "env", "demo"].map((d) => [DL[d],
    d === "demo" ? "기준 영역" : `${signed(add(d).d)} ${ci(add(d).lo, add(d).hi)}`,
    `${signed(drop(d).d)} ${ci(drop(d).lo, drop(d).hi)}`, f(dom[d].perm), pct(dom[d].shap_share)]),
  note: "단독 정보량 = (인구 + 해당 영역) 모형과 인구 모형의 시험셋 AP 차이. 고유 기여 = 주 분석 전체 모형과 해당 영역을 뺀 모형의 AP 차이. 신뢰구간은 가구 단위 부트스트랩 1,000회. 순열 중요도 = 영역 안의 변수를 함께 무작위로 섞었을 때의 AP 감소(3회 평균). SHAP 비중 = 영역에 속한 변수의 평균 |SHAP| 합의 비율." }));
C.push(...apaFigure({ file: "fig2_domain_contribution.png", title: "영역별 단독 정보량과 고유 기여",
  note: "막대는 CatBoost의 ΔAP와 95% 신뢰구간, 점은 LightGBM과 로지스틱 회귀의 값이다." }));

C.push(H2("변수 수준의 관련 요인"));
const shapTop10 = D.shap_top.slice(0, 10).map((s) => s.label).join(", ");
C.push(P([`CatBoost의 평균 |SHAP| 상위 10개 변수는 ${shapTop10}였다(그림 3). 7개 영역을 동시에 조정한 조사설계 기반 회귀에서 바꿀 수 있는 요인 가운데 연관이 큰 수준은 표 6과 그림 4에 제시하였다. 가구 식품 불안정(자주 부족, ${orTxt(food)}), 저작불편(매우 불편, ${orTxt(chew)}), 본인 인지 체형의 양극단(매우 비만 ${orTxt(obese)}; 매우 마름 ${orTxt(thin)}), 미충족 의료(${orTxt(unmet)}), 의료진 설명 이해의 어려움(${orTxt(hl)}), 낙상(${orTxt(fall)}), 친구와 월 1회 미만 연락(${orTxt(friend)}), 현재흡연(${orTxt(smoke)}), 아침 결식(${orTxt(bf)}), 전자담배 사용(${orTxt(ecig)}), 동네 안전 불만족(${orTxt(safe)}), 이웃 불신(${orTxt(trust)})이 우울 증상 기준 충족과 관련되었다. 신체활동 가운데 걷기 미실천(${orTxt(walk)})과 근력운동 주 2일 미만(${orTxt(strength)})은 다른 모든 변수를 조정한 뒤에도 높은 오즈와 관련되었으나, 중강도 이상 신체활동 미실천은 관련이 없었다(${orTxt(aerobic)}). 비음주자는 월 1회 이하 음주자보다 오즈가 높았고(${orTxt(nodrink)}), 고위험음주는 유의하지 않았다(${orTxt(hrd)}). 여성의 오즈는 남성보다 높았다(${orTxt(female)}).`]));
C.push(...apaFigure({ file: "fig3_shap_top.png", title: "변수별 SHAP 기여도 상위 25개 (CatBoost 주 분석, 시험셋)",
  note: "★ = 바꿀 수 있는 요인. 색은 영역을 나타낸다." }));
const orRows = D.or_modifiable.map((o) => [`${o.name}: ${o.level} (기준: ${o.ref})`, DL[o.domain], o.mod_type, f(o.or, 2), ci(o.lo, o.hi, 2)]);
const paRows = [walk, strength, aerobic].map((o) => [`${o.name}: ${o.level} (기준: ${o.ref})`, DL.behav, "A", f(o.or, 2), ci(o.lo, o.hi, 2)]);
C.push(...apaTable({ title: "바꿀 수 있는 요인의 조정 오즈비 (조사설계 기반 로지스틱 회귀)", head: ["요인: 수준 (기준범주)", "영역", "유형", "조정 OR", "95% CI"],
  widths: [4.8, 1.9, 0.7, 1.0, 1.6],
  rows: [{ cells: ["연관이 큰 20개 수준 (p < .05, |log OR| 순)", "", "", "", ""], bold: true }, ...orRows.map((c) => ({ cells: c, indent: true })),
    { cells: ["신체활동", "", "", "", ""], bold: true }, ...paRows.map((c) => ({ cells: c, indent: true }))],
  note: `n = ${n0(N.reg)}(완전 사례). 7개 영역의 모든 변수를 동시에 투입하였고, 가중치·층·집락을 반영하였다(테일러 선형화). 기준범주는 건강하거나 바람직한 상태이며(신체활동은 실천, 구강건강은 \"좋음\"), 행동으로 바꿀 수 없는 수준(모름, 진료가 필요 없었음, 직업군)은 목록에서 제외하였다. 유형 A = 개인 행동, B = 서비스·정책·환경으로 개선 가능. 전체 계수와 변수별 결합 검정은 부록 표 S2에 제시하였다.` }));
C.push(...apaFigure({ file: "fig4_forest_modifiable.png", title: "바꿀 수 있는 요인의 조정 오즈비", widthIn: 5.8,
  note: "p < .05인 수준 가운데 |log OR| 상위 30개를 연관이 큰 순서(위에서 아래)로 배열하였다. 기준범주는 건강하거나 바람직한 상태이며, 행동으로 바꿀 수 없는 수준(모름, 진료가 필요 없었음, 직업군)은 제외하였다. BMI는 임상 정상범위(18.5–23)를 기준으로 하였으며, 본인 인지 체형을 함께 조정한 결과 높은 BMI의 OR이 1보다 작게 나타났다." }));

C.push(H2("연령대별 차이"));
C.push(P([`연령대 안에서 다시 학습한 영역 추가 실험에서 19~39세는 건강행태(ΔAP ${signed(ageD("19-39", "behav"))})와 신체건강(${signed(ageD("19-39", "phys"))})의 정보량이 비슷하게 컸고 경제(${signed(ageD("19-39", "econ"))})는 작았다. 40~64세는 경제(${signed(ageD("40-64", "econ"))})가 가장 컸으며, 65세 이상은 신체건강(${signed(ageD("65+", "phys"))})과 의료접근·건강정보(${signed(ageD("65+", "care"))})가 두드러졌다(표 7, 그림 5).`]));
C.push(...apaTable({ title: "연령대별 영역 단독 정보량 (LightGBM, ΔAP)", head: ["영역", "19~39세", "40~64세", "65세 이상"], widths: [3, 2, 2, 2],
  rows: ADD_ORDER.map((d) => [DL[d], ...["19-39", "40-64", "65+"].map((g) => `${signed(D.age[g][d].d)} ${ci(D.age[g][d].lo, D.age[g][d].hi)}`)]),
  note: `각 연령대의 학습셋으로 다시 학습하고 같은 연령대의 시험셋에서 평가하였다(시험셋 n = ${n0(D.age["19-39"].phys.n)}, ${n0(D.age["40-64"].phys.n)}, ${n0(D.age["65+"].phys.n)}). 신뢰구간은 가구 단위 부트스트랩 200회.` }));
C.push(...apaFigure({ file: "fig5_age_groups.png", title: "연령대별 영역 기여" }));

C.push(H2("신체활동과 생활요인의 조합"));
const b0 = best[0];
const CS = D.count_summary, cMain = CS["주 분석"], cSleep = CS["수면 포함"];
const looTrend = Object.entries(CS).filter(([k]) => k.endsWith("제외")).map(([, v]) => v.trend_or);
const ctxBy = (p) => D.context_combos.find((c) => c.partner === p);
const maxAddP = Math.min(...D.combos.filter((c) => !c.proximal).map((c) => c.add_p));
C.push(P([`인구·경제·신체건강을 조정한 상태에서 신체활동 권고 충족과 각 생활요인을 함께 충족한 집단의 조정 유병률은 ${best.map((c) => `${c.partner} ${pp(c.prev_both, 2)}`).join(", ")}였다(표 8, 그림 6). 둘 다 충족하지 않은 집단과의 차이는 ${largestJoint.partner}에서 가장 컸다(${(largestJoint.joint_diff * 100).toFixed(1)}%p). 5개 생활요인 모두 가법·승법 상호작용이 유의하지 않아(가법 p ≥ ${f(maxAddP, 2)}), 신체활동과 각 생활요인의 관련성은 서로 독립적으로 더해지는 양상이었다. 심리·증상근접 변수인 주중 수면 7~9시간과의 조합은 ${pp(comboBy("주중 수면 7~9시간").prev_both, 2)}였다.`]));
C.push(P([`건강 생활요인 점수가 높을수록 조정 유병률은 ${D.counts.map((c) => `${c.k} ${pct(c.prev)}`).join(", ")}로 단계적으로 낮아졌고(결합 검정 p = ${D.count_p}), 1점 증가당 오즈비는 ${f(cMain.trend_or, 2)}(95% CI ${ci(cMain.trend_lo, cMain.trend_hi, 2)})였다. 요인을 하나씩 뺀 6개 점수에서도 같은 단계적 감소가 유지되었으며(1점당 OR ${f(Math.min(...looTrend), 2)}~${f(Math.max(...looTrend), 2)}, 부록 표 S4), 수면을 더한 점수의 1점당 오즈비는 ${f(cSleep.trend_or, 2)}였다. 사회·환경 맥락 요인인 이웃 신뢰와 동네 안전도 신체활동과 함께 충족한 집단의 조정 유병률이 각각 ${pp(ctxBy("이웃을 신뢰함").prev_both, 2)}, ${pp(ctxBy("동네가 안전하다고 느낌").prev_both, 2)}로 낮았다(부록 표 S5).`]));
const comboRows = [...D.combos].sort((a, b) => a.prev_both - b.prev_both).map((c) => [c.partner + (c.proximal ? " (증상근접)" : ""), pp(c.prev_both, 2), pp(c.prev_neither, 2),
  `${(c.joint_diff * 100).toFixed(2)} [${(c.joint_low * 100).toFixed(2)}, ${(c.joint_high * 100).toFixed(2)}]`, `${(c.additive_interaction * 100).toFixed(2)}`, f(c.add_p, 3), f(c.mult_interaction_p, 3)]);
C.push(...apaTable({ title: "신체활동 권고 충족과 생활요인 조합별 조정 유병률", head: ["함께 충족한 생활요인", "둘 다 충족", "둘 다 미충족", "차이 %p [95% CI]", "가법 상호작용 %p", "가법 p", "승법 p"],
  widths: [3.0, 1.1, 1.1, 2.1, 1.3, 0.8, 0.8], rows: comboRows,
  note: "조정 유병률은 인구·경제·신체건강 변수를 조정한 조사설계 기반 로지스틱 회귀의 예측 주변값이다. 가법 상호작용 = (둘 다 충족 − 신체활동만) − (생활요인만 − 둘 다 미충족). 승법 p = 신체활동 × 생활요인 곱항의 Wald 검정." }));
C.push(...apaFigure({ file: "fig6_pa_combinations.png", title: "신체활동과 생활요인 조합별, 건강 생활요인 점수별 조정 유병률",
  note: "(b)의 막대는 주 점수(신체활동 권고 + 5개 생활요인, 0~6점), 회색 선은 요인을 하나씩 뺀 점수(0~5점)의 조정 유병률이다. 양 끝 점수가 1,000명 미만이면 안쪽 점수와 합쳤다. 점수는 충족한 요인 수의 비가중 합산이다." }));

// ---- 논의
C.push(H1("논의"));
C.push(H2("주요 결과"));
C.push(P([`이 연구는 한국 성인 ${n0(N.analysis)}명의 자료에서 우울 증상과 관련된 요인을 8개 영역 ${N.n_features}개 변수로 분석하였다. 첫째, 우울 증상은 특정 영역 하나가 아니라 경제, 신체건강, 건강행태, 사회관계, 생활환경, 의료접근의 모든 영역과 독립적으로 관련되었다. 영역 제거 실험에서 어느 영역을 빼도 성능이 유의하게 떨어졌다는 것은 각 영역이 다른 영역으로 대체되지 않는 고유한 정보를 담고 있음을 뜻한다. 이는 우울을 생물심리사회적·생태학적 복합 현상으로 보는 관점(Engel, 1977; McLeroy et al., 1988)과 일치한다. 둘째, 영역 중에서는 신체건강의 기여가 가장 컸고, 바꿀 수 있는 요인으로는 식품 불안정, 저작불편, 미충족 의료, 사회적 연결 부족, 흡연, 아침 결식이 두드러졌다. 머신러닝의 SHAP 기여도와 조사설계 기반 회귀의 조정 오즈비가 대부분 같은 요인을 가리켜 결과의 일관성을 뒷받침하였다. 셋째, 신체활동은 다른 생활요인과 독립적으로 더해지는 양상을 보였고, 함께 충족한 건강 생활요인이 많을수록 우울 증상 비율이 단계적으로 낮았다. 넷째, 관련 영역은 연령대에 따라 달랐다.`]));
C.push(H2("선행연구와의 비교"));
C.push(P([`식품 불안정과 우울 증상의 연관은 메타분석에서 보고된 우울 위험 증가(Pourmotabbed et al., 2020)와 같은 방향이었으며, 이 연구에서는 다른 경제 요인과 소득을 함께 조정한 뒤에도 바꿀 수 있는 요인 중 가장 큰 오즈비를 보였다. 저작불편과 구강건강의 연관은 우울·불안 장애와 치아 상실의 관련을 보고한 메타분석(Kisely et al., 2016)과 부합한다. 걷기와 근력운동을 하지 않는 것이 조정 후에도 높은 오즈와 관련된 결과는 걷기·조깅과 근력운동을 효과적인 운동 형태로 제시한 중재연구 종합(Noetel et al., 2024)과 일치한다. 친구·이웃과의 연결과 이웃 신뢰의 관련성은 사회적 연결망의 건강 경로(Berkman et al., 2000)와 노인의 사회적 연결망이 우울 증상에 보호적이었다는 국내 연구(Lee et al., 2025)를 성인 전체로 확장한 결과이다. 여러 생활요인을 함께 충족할수록 우울 증상 비율이 낮아지는 결과는 영국 코호트에서 건강한 생활요인 점수가 높을수록 우울 위험이 낮았던 결과(Zhao et al., 2023)와 같은 양상이었다. 점수 1점 증가당 위험이 낮아지는 방향도 같았다(Zhao 등의 위험비 0.85, 이 연구의 오즈비 ${f(cMain.trend_or, 2)}).`]));
const OP = D.operating_points, opHP = OP.find((o) => o.rule.includes("Han & Park")), opY = OP[0];
C.push(P([`국내에서 같은 조사를 이용해 우울 위험 예측모형을 개발한 Han과 Park(2025)과 비교하면 이 연구는 다음 점에서 분석을 확장하였다. Han과 Park(2025)은 2022년 지역사회건강조사의 18개 변수를 랜덤포레스트 등 4개 알고리즘의 변수 중요도로 선별한 뒤 가중 로지스틱 회귀로 위험요인을 제시하였고, 주관적 스트레스(OR 9.65)와 주관적 건강(OR 3.38)을 가장 큰 위험요인으로 보고하였다. 그러나 두 변수는 PHQ-9의 수면·피로·흥미 문항과 개념이 겹치고 우울 증상의 결과일 수도 있어 순환적으로 해석될 위험이 있다. 이 연구는 이러한 심리·증상근접 변수를 주 분석에서 분리하고도 ROC-AUC ${f(cb.full.auc)}로 선행연구(0.841)와 비슷한 판별력을 보였다. 선행연구 모형이 시험셋의 약 18.4%를 고위험으로 판정한 것과 같은 비율로 맞추면 이 연구 모형의 민감도는 ${pct(opHP.sens)}, 특이도는 ${pct(opHP.spec)}, 정밀도는 ${pct(opHP.ppv)}로, 선행연구의 보고값에서 역산한 약 67%, 84%, 14%와 같은 수준이었다(부록 표 S6). 또한 이 연구는 변수를 8개 영역 ${N.n_features}개로 넓혀 식품 불안정과 저작불편처럼 선행연구에서 다루지 않은 요인을 확인하였고, 같은 가구의 구성원이 학습셋과 시험셋에 나뉘지 않도록 가구 단위로 분할하였으며, 양성 비율이 낮은 자료에 적합한 AP와 보정 지표를 함께 보고하였다. 회귀분석은 가중치뿐 아니라 층과 집락을 반영하여 모집단 수준의 연관과 불확실성을 추정하였고, 바꿀 수 있는 요인과 생활요인의 선정 기준을 미리 정해 결과에 따라 변수를 고르는 자의성을 줄였다. 다만 두 연구는 조사 연도(2022년과 2025년)와 분할 방식이 달라 성능 수치를 엄밀하게 일대일로 비교할 수는 없다.`]));
C.push(P(["비음주자의 오즈가 높게 나타난 것은 건강 문제로 술을 끊은 사람이 비음주자에 섞여 생기는 이른바 sick-quitter 효과로 해석된다(Shaper et al., 1988). 따라서 이 결과를 음주가 보호요인이라는 근거로 해석해서는 안 된다. 중강도 이상 신체활동이 조정 후 관련을 보이지 않은 것은 조사 문항이 여가 운동과 직업적 신체활동을 구분하지 않기 때문일 수 있다."]));
C.push(H2("우울 증상 극복을 위한 실천 제언"));
C.push(P(["이 연구의 결과는 인과 효과를 입증하지 않지만, 우울 증상과 관련이 크고 바꿀 수 있는 요인을 근거로 다음과 같은 실천을 제안할 수 있다."]));
C.push(bullet([{ t: "걷기와 근력운동을 함께 하기. ", b: true }, `걷기를 실천하지 않거나 근력운동을 주 2일 미만으로 하는 경우 다른 요인을 모두 고려한 뒤에도 우울 증상과 관련되었다(${orTxt(walk)}; ${orTxt(strength)}). 이는 중재연구의 근거(Noetel et al., 2024)와도 일치한다.`]));
C.push(bullet([{ t: "운동을 사람과의 교류와 묶기. ", b: true }, `신체활동과 함께 사회적 연결을 충족한 집단의 조정 유병률은 ${pp(comboBy("사회적 연결").prev_both, 2)}로 낮았고, 사회 맥락 요인인 이웃 신뢰와 함께 충족한 집단도 ${pp(ctxBy("이웃을 신뢰함").prev_both, 2)}였다. 혼자 하는 운동보다 동네 걷기 모임, 동호회처럼 교류가 있는 형태를 권한다.`]));
C.push(bullet([{ t: "여러 생활습관을 함께 지키기. ", b: true }, `한 가지보다 여러 가지를 함께 지킬수록 우울 증상 비율이 낮았다(${cnt0.k} ${pct(cnt0.prev)} → ${cntMax.k} ${pct(cntMax.prev)}). 규칙적인 운동과 함께 아침식사, 금연, 과음하지 않기, 사람들과의 정기적인 교류, 잠자기 전 칫솔질을 생활 단위로 실천하는 것이 바람직하다.`]));
C.push(bullet([{ t: "몸의 불편을 미루지 않기. ", b: true }, "저작불편, 구강 문제, 낙상 경험, 필요한 진료를 받지 못한 경험은 우울 증상과 강하게 관련되었다. 특히 65세 이상에서는 신체건강과 의료접근 영역의 정보량이 컸으므로 치과 진료, 낙상 예방, 의료 이용 지원이 정신건강 관리와 함께 고려되어야 한다."]));
C.push(bullet([{ t: "도움이 필요한 사람을 먼저 찾기. ", b: true }, "식품 불안정과 미충족 의료는 개인의 노력만으로 바꾸기 어려운 요인이다. 식품 지원과 의료 접근성 개선을 담당하는 지역사회 서비스가 우울 예방 측면에서도 의미가 있음을 시사한다(Pourmotabbed et al., 2020)."]));
C.push(bullet([{ t: "연령대에 맞추기. ", b: true }, "청년층은 생활습관, 중장년층은 경제적 안정, 노년층은 신체건강과 의료 접근을 중심으로 접근하는 것이 결과와 부합한다."]));
C.push(H2("스포츠산업 측면의 함의"));
C.push(P(["신체활동과 사회적 요인이 서로 독립적으로 더해지는 구조는 생활체육 프로그램을 설계할 때 운동 종목만이 아니라 참여자 간 교류를 함께 고려할 근거가 된다. 지역 생활체육 시설과 동호회는 걷기와 근력운동을 제공하는 동시에 이웃과 친구 관계를 형성하는 장이 될 수 있다(Lee & Park, 2021). 다만 이러한 결합 프로그램이 실제로 우울 증상을 줄이는지는 무작위 배정 중재연구로 검증해야 한다."]));
C.push(H2("강점과 한계"));
C.push(P([`이 연구의 강점은 전국 단위의 대규모 표본에서 8개 영역의 변수를 한 모형에 넣어 영역의 상대적·고유 기여를 비교했다는 점, 머신러닝과 조사설계 기반 회귀라는 서로 다른 방법이 같은 요인을 가리킨다는 점을 확인했다는 점, 가구 단위 분할과 부트스트랩 신뢰구간으로 성능 추정의 누수와 불확실성을 다뤘다는 점, 바꿀 수 있는 요인과 생활요인의 선정 기준을 선행연구와 국가 계획에 근거해 미리 정했다는 점이다. 개인 가중치와 조사설계를 반영한 추정치는 주거용 주택에 거주하는 한국 성인에게 일반화할 수 있으나, 시설 거주자 등 조사모집단에 포함되지 않은 집단에는 적용하기 어렵다.`]));
C.push(P(["한계는 다음과 같다. 첫째, 횡단면 자료이므로 우울 증상이 신체활동, 사회적 교류, 식사를 줄였을 가능성(역인과)을 배제할 수 없다. 둘째, 저작불편, 아침 결식, 체형 인식 등 일부 요인은 우울 증상의 식욕 변화나 부정적 자기평가와 겹칠 수 있다. 가장 직접적인 심리·증상근접 변수는 분리했지만 완전히 분리되었다고 보기는 어렵다. 셋째, 모든 변수가 자기보고이며 유전, 생활사건, 관계의 질 등 측정되지 않은 요인이 있다. 넷째, PHQ-9 기준 충족은 임상 진단이 아니다. 다섯째, 머신러닝 모형의 AP는 개인을 선별하는 도구로 쓰기에는 충분하지 않다. 이 연구에서 머신러닝은 영역별 정보량을 비교하는 도구로 사용되었으며, 개인 단위 판정에는 PHQ-9 자체를 사용하는 것이 적절하다. 여섯째, 분류 성능은 청년층에서 가장 낮아(부록 표 S3) 이 연령대의 우울 증상은 조사 문항으로 포착되지 않는 요인의 영향이 더 클 가능성이 있다. 일곱째, 하이퍼파라미터를 사전에 고정하여 비교의 공정성은 높였지만 각 알고리즘의 최대 성능을 보장하지는 않는다. 여덟째, 2025년 조사에는 좌식행동 문항이 없고 식생활은 아침식사만으로 대리하였으며, 사회적 연결은 원래 고립 지수의 사회활동 항목을 이웃 경조사 참여로 근사하였다."]));

// ---- 결론
C.push(H1("결론"));
C.push(P(["한국 성인의 우울 증상은 경제, 신체건강, 건강행태, 사회관계, 생활환경, 의료접근 영역의 요인과 독립적으로 함께 관련되는 복합 현상이었다. 신체건강 영역의 기여가 가장 컸고, 식품 불안정, 구강 문제, 미충족 의료, 사회적 연결 부족, 흡연, 아침 결식이 바꿀 수 있는 주요 관련 요인이었다. 신체활동은 사회적 교류, 식생활, 금연 등 다른 건강 생활요인과 함께 충족할수록 우울 증상 비율이 낮았다. 우울 예방 정책과 생활체육 프로그램은 단일 요인보다 여러 영역을 함께 다루는 통합적 접근을 고려할 필요가 있으며, 그 효과는 종단·중재 연구로 확인해야 한다."]));

// ---- 참고문헌
C.push(pageBreak());
C.push(H1("참고문헌"));
REFS.forEach((r) => C.push(refPara(r)));

// ---- 부록
C.push(pageBreak());
C.push(H1("부록"));
const KIND = { num: "수치형", cat: "범주형" };
C.push(...apaTable({ label: "표 S1", title: "분석 변수 목록과 코딩", head: ["영역", "변수", "원본 문항", "코딩", "모형 투입", "수정 유형", "결측(%)"],
  widths: [1.2, 1.8, 1.6, 3.2, 0.9, 1.1, 1.0],
  rows: D.variables.map((v) => [DL[v.domain], v.label, v.source, v.logic, KIND[v.kind], `${v.mod_type} ${v.mod_label}`, f(v.missing_pct, 2)]),
  note: "원본 문항은 2025 지역사회건강조사 원시자료 변수명이다. 모든 코드표와 질문 분기는 이용지침서와 원시자료를 대조하여 확인하였다." }));
C.push(...apaTable({ label: "표 S2", title: "변수별 결합 Wald 검정 (7개 영역 동시 조정 모형)", head: ["변수", "영역", "자유도", "F", "p"], widths: [3, 2, 1, 1.2, 1.4],
  rows: D.variable_tests.map((v) => [v.name, DL[v.domain], String(v.df), f(v.F, 1), v.p < 0.001 ? "< .001" : f(v.p, 3)]),
  note: "수정 Wald F 검정(설계 자유도 기반). 변수의 모든 범주 계수가 0이라는 귀무가설을 검정한다." }));
C.push(...apaTable({ label: "표 S3", title: "하위집단별 분류 성능 (CatBoost 주 분석, 시험셋)", head: ["하위집단", "n", "양성 n (%)", "AP [95% CI]", "ROC-AUC [95% CI]", "관측:예측", "보정 기울기"],
  widths: [1.6, 1.0, 1.5, 2.0, 2.0, 1.0, 1.0],
  rows: D.subgroup.map((x) => [x.subgroup, n0(x.n), `${n0(x.events)} (${f(x.prevalence * 100, 1)})`, `${f(x.AP)} ${ci(x.AP_low, x.AP_high)}`,
    `${f(x.AUC)} ${ci(x.AUC_low, x.AUC_high)}`, f(x.OE, 2), f(x.cal_slope, 2)]),
  note: "AP는 양성률의 영향을 받으므로 하위집단 간 비교에는 ROC-AUC를 함께 보아야 한다. 신뢰구간은 가구 단위 부트스트랩 500회." }));
const sensRows = [];
for (const sc of Object.keys(D.count_summary)) {
  const v = D.count_summary[sc];
  sensRows.push({ cells: [`${sc} (${v.n_factors}개 요인)`, `1점당 OR ${f(v.trend_or, 2)} ${ci(v.trend_lo, v.trend_hi, 2)}`, "", ""], bold: true });
  D.count_sens.filter((x) => x.score === sc).forEach((x) => sensRows.push({ cells: [x.k, pct(x.prev), ci(x.lo, x.hi, 1), n0(x.n)], indent: true }));
}
C.push(...apaTable({ label: "표 S4", title: "건강 생활요인 점수의 민감도 분석", head: ["점수 / 충족 수", "조정 유병률", "95% CI", "n"], widths: [3.6, 2.4, 2.0, 1.4],
  rows: sensRows, note: "주 분석 = 신체활동 권고 + 담배제품 미사용 + 고위험음주 아님 + 아침식사 주 5회 이상 + 사회적 연결 + 저녁 후·잠자기 전 칫솔질. “○○ 제외”는 해당 요인을 뺀 점수, “수면 포함”은 주중 수면 7~9시간을 더한 점수이다. 양 끝 점수가 1,000명 미만이면 안쪽 점수와 합쳤다. 인구·경제·신체건강 조정." }));
C.push(...apaTable({ label: "표 S5", title: "신체활동 권고 충족과 사회·환경 맥락 요인 조합별 조정 유병률", head: ["함께 충족한 맥락 요인", "둘 다 충족", "둘 다 미충족", "차이 %p [95% CI]", "가법 p", "승법 p"],
  widths: [3.0, 1.2, 1.2, 2.4, 0.9, 0.9],
  rows: D.context_combos.map((c) => [c.partner, pp(c.prev_both, 2), pp(c.prev_neither, 2), `${(c.joint_diff * 100).toFixed(2)} [${(c.joint_low * 100).toFixed(2)}, ${(c.joint_high * 100).toFixed(2)}]`, f(c.add_p, 3), f(c.mult_interaction_p, 3)]),
  note: "이웃 신뢰와 동네 안전은 개인의 생활습관이 아니라 사회·환경 맥락(수정 유형 B)이므로 본문의 생활요인 분석과 분리하였다. 분석 방법은 표 8과 같다." }));
C.push(...apaTable({ label: "표 S6", title: "임계값별 운영점 (CatBoost 주 분석, 시험셋)", head: ["임계값 기준", "임계 확률", "고위험 판정 %", "민감도 %", "특이도 %", "정밀도 %", "1만 명당 놓친 우울"],
  widths: [3.0, 1.0, 1.2, 1.0, 1.0, 1.0, 1.4],
  rows: D.operating_points.map((o) => [o.rule, f(o.thr, 3), f(o.flag, 1), f(o.sens, 1), f(o.spec, 1), f(o.ppv, 1), n0(o.per10k.fn)]),
  note: "시험셋을 가구 단위로 반씩 나눠 한쪽에서 임계값을 정하고 다른 쪽에서 평가한 뒤 두 결과를 평균하였다(교차 적합). Han & Park(2025)의 판정 비율 18.4%는 그 논문의 정확도, macro 재현율, 시험셋 인원에서 역산한 값이다. 이 모형은 개인 선별이 아니라 영역별 정보량 비교에 사용하였으며, 운영점은 선행연구와의 비교를 위해 제시한다." }));
C.push(...apaFigure({ label: "그림 S1", file: "figS1_algorithms.png", title: "알고리즘별 시험셋 AP와 ROC-AUC" }));
C.push(...apaFigure({ label: "그림 S2", file: "figS2_crude_overview.png", title: "변수별 비조정 우울 증상 기준 충족률 격차", widthIn: 5.2,
  note: "수준 간 최고와 최저 가중 유병률의 차이(%p). 표본 500명 이상인 수준만 비교하였다." }));

// ================================================================ 문서
const doc = new Document({
  creator: "Depression_ActivityNetwork_Capstone",
  title: "한국 성인의 우울 증상과 관련된 다차원 요인",
  styles: {
    default: { document: { run: { font: FONT, size: SIZE } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: SIZE, bold: true }, paragraph: { outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: SIZE, bold: true }, paragraph: { outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: SIZE, bold: true, italics: true }, paragraph: { outlineLevel: 2 } },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: SIZE })] })] }) },
    children: C,
  }],
});
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(path.join(DIR, "manuscript_v2.1.docx"), buf);
  console.log(`생성: paper/manuscript_v2.1.docx (표 ${tableNo}개 + 부록, 그림 ${figNo}개 + 부록, 참고문헌 ${REFS.length}편)`);
});
