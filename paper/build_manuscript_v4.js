/*
 * 논문 v4 원고 생성 — 중간발표 피드백 반영(스포츠 연관성, PHQ-9 ≥ 5). APA 7판 학생 논문 형식, STROBE + TRIPOD+AI.
 * 실행: node paper/build_manuscript_v4.js   (paper/build_paper_data_v4.py 실행 후)
 * 산출: paper/manuscript_v4.docx (v2·v2.1 원고는 그대로 보존)
 * 원칙: 본문 수치는 paper_data_v4.json에서만 가져온다. 탐색 세트 결과는 확인 세트 결과와 구분해 서술한다.
 */
const fs = require("fs");
const path = require("path");
const H = require("./apa_helpers.js");
const { n0, f, pct, ci, FONT, SIZE, P, PL, center, H1, H2, H3, bullet, pageBreak, HL, apaTable, apaFigure, refPara } = H;
const { Document, Packer, Paragraph, TextRun, Header, PageNumber, AlignmentType } = H.docx;

const D = JSON.parse(fs.readFileSync(path.join(__dirname, "paper_data_v4.json"), "utf-8"));

// ---------------------------------------------------------------- 값 찾기
const pp1 = (x, d = 1) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(d)}%p`;
const abs = (x, d = 1) => Math.abs(x).toFixed(d);
const neg = (x, d = 1) => `${x < 0 ? "−" : ""}${Math.abs(x).toFixed(d)}`;
const cpp = (lo, hi, d = 1) => `[${neg(lo, d)}, ${neg(hi, d)}]`;
const pv = (p) => (p < 0.001 ? "< .001" : `= ${p.toFixed(3).replace(/^0/, "")}`);
const one = (arr, pred, what) => { const x = arr.find(pred); if (!x) throw new Error(`없음: ${what}`); return x; };
const out = (k) => one(D.outcomes, (o) => o.outcome === k, k);
const y5 = out("y5"), ym = out("y_mood"), y10 = out("y10");
const rank = (a, b, st = "전체", y = "y5") => one(D.c1_rank, (r) => r.outcome === y && r.stratum === st && r.a === a && r.b === b, `${a}|${b}|${st}|${y}`);
const pat = (h, s, y = "y5") => one(D.c1_patterns, (r) => r.hypothesis.startsWith(h) && r.outcome === y && r.sport === s, `${h}|${s}|${y}`);
const conf = (y) => D.c1_confirm.filter((r) => r.outcome === y);
const inter = (ind, main = true) => one(D.e2_inter, (r) => r.indicator === ind && r.spec.startsWith(main ? "주" : "민감"), ind);
const cell = (ind, g, b) => one(D.e2_cells, (r) => r.indicator === ind && r.spec.startsWith("주") && r.group === g && r.bin === b, `${ind}|${g}|${b}`);
const rev = (ind, b, comp) => one(D.e2_reversal, (r) => r.indicator === ind && r.spec.startsWith("주") && r.dis_bin === b && r.compare_to === comp, `${ind}|${b}`);
const dec = (ind) => one(D.e2_dec, (r) => r.indicator === ind && r.spec.startsWith("주") && r.method === "연령 표준화 분포", ind);
const orF = (name, level) => one(D.e1_or, (r) => r.name === name && r.level === level, `${name}=${level}`);
const orT = (o) => `OR ${f(o.OR, 2)}, 95% CI ${ci(o.OR_low, o.OR_high, 2)}`;
const cross = (tr, ev) => one(D.c2_cross, (r) => r.train_target === tr && r.eval_target === ev, `${tr}>${ev}`);
const imb = (t, m) => one(D.c2_imbalance, (r) => r.target === t && r.method === m, `${t}|${m}`);
const combo = (p) => one(D.e1_combos, (r) => r.partner === p, p);
const cnt5 = one(D.e1_count_summary, (r) => r.score === "주 분석", "count");
const SPORT = { walk: "걷기 실천", aerobic: "중강도 이상 유산소 신체활동", strength: "근력운동 주 2일 이상", pa_guide: "신체활동 권고 충족" };
const LIFE = { tobacco: "담배제품 미사용", alcohol: "고위험음주 아님", breakfast: "아침식사 주 5회 이상", social: "사회적 연결", brushing: "저녁 후·잠자기 전 칫솔질" };
const SPORTS = Object.keys(SPORT), LIVES = Object.keys(LIFE);

const ws = rank("walk", "social"), wsLow = rank("walk", "social", "소득 하위 20%"), wsHigh = rank("walk", "social", "소득 상위 20%");
const wsMood = rank("walk", "social", "전체", "y_mood"), ws10 = rank("walk", "social", "전체", "y10");
const p2w = pat("P2", "walk"), p2w10 = pat("P2", "walk", "y10"), p2wm = pat("P2", "walk", "y_mood");
const p2others = ["aerobic", "strength", "pa_guide"].map((s) => pat("P2", s));
const p1 = SPORTS.map((s) => pat("P1", s));
const c5 = conf("y5"), bestC = [...c5].sort((a, b) => a.p - b.p)[0];
const c10best = conf("y10").find((r) => r.stratum === bestC.stratum && r.sport === bestC.sport && r.x === bestC.x);
const inc = inter("income"), liv = inter("livelihood"), foo = inter("food");
const xA = cross("y5", "y_mood"), xB = cross("y_mood", "y5"), xAA = cross("y5", "y5"), xBB = cross("y_mood", "y_mood");
const so = D.c2_shap_overlap;
const walkRank = LIVES.map((x) => rank("walk", x)).sort((a, b) => a.joint - b.joint);
// 보충: 1:1 조합 30쌍(전체 표본) — 전체 순위, 생활요인별 짝 순위, 소득 계층별 순위
const RP = D.r_pairs.filter((r) => r.outcome === "y5").sort((a, b) => a.rank_all - b.rank_all);
const bestSportPair = RP.find((r) => r.kind === "운동+일반");
const nGenBefore = RP.filter((r) => r.rank_all < bestSportPair.rank_all).length;
const RBF = D.r_by_factor.filter((r) => r.outcome === "y5" && r.rank_in_x != null);
const RBFm = D.r_by_factor.filter((r) => r.outcome === "y_mood" && r.rank_in_x != null);
const sportBest = (rows, x) => Math.min(...rows.filter((r) => r.x === x && r.partner_is_sport).map((r) => r.rank_in_x));
const sportBestRanks = LIVES.map((x) => sportBest(RBF, x)), sportBestRanksM = LIVES.map((x) => sportBest(RBFm, x));
const bfTest = (x) => one(D.r_by_factor, (r) => r.outcome === "y5" && r.x === x && r.rank_in_x == null && String(r.partner_label).startsWith("운동 최고"), x);
const bfDiffs = LIVES.map((x) => bfTest(x).joint);
const walkTie = one(D.r_by_factor, (r) => r.outcome === "y5" && r.x === "walk" && String(r.partner_label).includes("2위"), "walk tie");
const RI = D.r_income.filter((r) => r.outcome === "y5").sort((a, b) => a.gap - b.gap);
const RIm = D.r_income.filter((r) => r.outcome === "y_mood").sort((a, b) => a.gap - b.gap);
const nSportTop7 = RI.slice(0, 7).filter((r) => r.kind === "운동+일반").length;
const nSportTop7m = RIm.slice(0, 7).filter((r) => r.kind === "운동+일반").length;
const wsI = one(RI, (r) => r.a === "walk" && r.b === "social", "walk+social income");
const topLow = [...RI].sort((a, b) => a.low_joint - b.low_joint)[0];
const tGap = one(D.r_income_tests, (t) => t.outcome === "y5" && t.measure.startsWith("소득") && t.other === wsI.pair, "gap test");
const tLow = one(D.r_income_tests, (t) => t.outcome === "y5" && t.measure.startsWith("하위") && t.other === wsI.pair, "low test");
const meanBy = (rows, kind, col) => { const q = rows.filter((r) => r.kind === kind); return q.reduce((a, r) => a + r[col], 0) / q.length; };
const PV = (k) => one(D.r_prev, (r) => r.factor === k, k);
const SPORTKEYS = ["walk", "aerobic", "strength", "pa_guide"];
const partnersOf = (rows, x) => rows.filter((r) => r.a === x || r.b === x).map((r) => ({ ...r, partner: r.a === x ? r.b : r.a }));
const avg = (q, col) => q.reduce((a, r) => a + r[col], 0) / q.length;
const socP = partnersOf(RI, "social").sort((a, b) => a.gap - b.gap);
const gapSportSoc = avg(socP.filter((r) => SPORTKEYS.includes(r.partner)), "gap"), gapGenSoc = avg(socP.filter((r) => !SPORTKEYS.includes(r.partner)), "gap");
const NM = { ...SPORT, ...LIFE, walk: "걷기", pa_guide: "권고 충족", strength: "근력", aerobic: "유산소", tobacco: "담배 미사용", alcohol: "절주", breakfast: "아침식사", brushing: "칫솔질" };

// 단계 D·E-2(있으면)
const C3 = D.c3_models || null;
const ML = D.e1_ml_domains || null;
const c3txt = () => {
  if (!C3) return null;
  const m1 = C3.find((m) => m.model.startsWith("M1")), m2 = C3.find((m) => m.model.startsWith("M2")), m3 = C3.find((m) => m.model.startsWith("M3"));
  const inc0 = (m) => m.dAP_vs_M1_lo <= 0 && m.dAP_vs_M1_hi >= 0;
  return { m0: C3.find((m) => m.model.startsWith("M0")), m1, m2, m3, flat: inc0(m2) && inc0(m3) };
};
const c3 = c3txt();

// ---------------------------------------------------------------- 참고문헌 (APA 7, 모두 서지 확인 완료)
const REFS = [
  "질병관리청. (2025). 지역사회건강조사 2025년 원시자료 이용지침서. 질병관리청.",
  "Engel, G. L. (1977). The need for a new medical model: A challenge for biomedicine. Science, 196(4286), 129–136. https://doi.org/10.1126/science.847460",
  "Gordon, B. R., McDowell, C. P., Hallgren, M., Meyer, J. D., Lyons, M., & Herring, M. P. (2018). Association of efficacy of resistance exercise training with depressive symptoms: Meta-analysis and meta-regression analysis of randomized clinical trials. JAMA Psychiatry, 75(6), 566–576. https://doi.org/10.1001/jamapsychiatry.2018.0572",
  "Holtermann, A., Krause, N., van der Beek, A. J., & Straker, L. (2018). The physical activity paradox: Six reasons why occupational physical activity (OPA) does not confer the cardiovascular health benefits that leisure time physical activity does. British Journal of Sports Medicine, 52(3), 149–150. https://doi.org/10.1136/bjsports-2017-097965",
  "Kroenke, K., Spitzer, R. L., & Williams, J. B. W. (2001). The PHQ-9: Validity of a brief depression severity measure. Journal of General Internal Medicine, 16(9), 606–613. https://doi.org/10.1046/j.1525-1497.2001.016009606.x",
  "Link, B. G., & Phelan, J. (1995). Social conditions as fundamental causes of disease. Journal of Health and Social Behavior, (Extra Issue), 80–94.",
  "Lorant, V., Deliège, D., Eaton, W., Robert, A., Philippot, P., & Ansseau, M. (2003). Socioeconomic inequalities in depression: A meta-analysis. American Journal of Epidemiology, 157(2), 98–112. https://doi.org/10.1093/aje/kwf182",
  "Lumley, T. (2004). Analysis of complex survey samples. Journal of Statistical Software, 9(8), 1–19. https://doi.org/10.18637/jss.v009.i08",
  "Lundberg, S. M., Erion, G., Chen, H., DeGrave, A., Prutkin, J. M., Nair, B., Katz, R., Himmelfarb, J., Bansal, N., & Lee, S.-I. (2020). From local explanations to global understanding with explainable AI for trees. Nature Machine Intelligence, 2(1), 56–67. https://doi.org/10.1038/s42256-019-0138-9",
  "Noetel, M., Sanders, T., Gallardo-Gómez, D., Taylor, P., del Pozo Cruz, B., van den Hoek, D., Smith, J. J., Mahoney, J., Spathis, J., Moresi, M., Pagano, R., Pagano, L., Vasconcellos, R., Arnott, H., Varley, B., Parker, P., Biddle, S., & Lonsdale, C. (2024). Effect of exercise for depression: Systematic review and network meta-analysis of randomised controlled trials. BMJ, 384, e075847. https://doi.org/10.1136/bmj-2023-075847",
  "Pearce, M., Garcia, L., Abbas, A., Strain, T., Schuch, F. B., Golubic, R., Kelly, P., Khan, S., Utukuri, M., Laird, Y., Mok, A., Smith, A., Tainio, M., Brage, S., & Woodcock, J. (2022). Association between physical activity and risk of depression: A systematic review and meta-analysis. JAMA Psychiatry, 79(6), 550–559. https://doi.org/10.1001/jamapsychiatry.2022.0609",
  "Prokhorenkova, L., Gusev, G., Vorobev, A., Dorogush, A. V., & Gulin, A. (2018). CatBoost: Unbiased boosting with categorical features. In Advances in Neural Information Processing Systems 31 (pp. 6638–6648).",
  "Ross, C. E., & Mirowsky, J. (2006). Sex differences in the effect of education on depression: Resource multiplication or resource substitution? Social Science & Medicine, 63(5), 1400–1413.",
  "Schuch, F. B., Vancampfort, D., Firth, J., Rosenbaum, S., Ward, P. B., Silva, E. S., Hallgren, M., Ponce De Leon, A., Dunn, A. L., Deslandes, A. C., Fleck, M. P., Carvalho, A. F., & Stubbs, B. (2018). Physical activity and incident depression: A meta-analysis of prospective cohort studies. American Journal of Psychiatry, 175(7), 631–648. https://doi.org/10.1176/appi.ajp.2018.17111194",
  "van den Goorbergh, R., van Smeden, M., Timmerman, D., & Van Calster, B. (2022). The harm of class imbalance corrections for risk prediction models: Illustration and simulation using logistic regression. Journal of the American Medical Informatics Association, 29(9), 1525–1534. https://doi.org/10.1093/jamia/ocac093",
  "VanderWeele, T. J., & Knol, M. J. (2014). A tutorial on interaction. Epidemiologic Methods, 3(1), 33–72. https://doi.org/10.1515/em-2013-0005",
  "von Elm, E., Altman, D. G., Egger, M., Pocock, S. J., Gøtzsche, P. C., Vandenbroucke, J. P., & STROBE Initiative. (2007). The Strengthening the Reporting of Observational Studies in Epidemiology (STROBE) statement: Guidelines for reporting observational studies. PLoS Medicine, 4(10), e296. https://doi.org/10.1371/journal.pmed.0040296",
  "World Health Organization. (2020). WHO guidelines on physical activity and sedentary behaviour. World Health Organization.",
  "Zhang, Y.-B., Chen, C., Pan, X.-F., Guo, J., Li, Y., Franco, O. H., Liu, G., & Pan, A. (2021). Associations of healthy lifestyle and socioeconomic status with mortality and incident cardiovascular disease: Two prospective cohort studies. BMJ, 373, n604. https://doi.org/10.1136/bmj.n604",
  "Zhao, Y., Yang, L., Sahakian, B. J., Langley, C., Zhang, W., Kuo, K., Li, Z., Gan, Y., Li, Y., Zhao, Y., Yu, J., Feng, J., & Cheng, W. (2023). The brain structure, immunometabolic and genetic mechanisms underlying the association between lifestyle and depression. Nature Mental Health, 1(10), 736–750. https://doi.org/10.1038/s44220-023-00120-1",
];

// ================================================================ 본문
const C = [];
const TITLE = "운동과 함께할 때 더 낮은 우울 증상";
const SUB = "— 2025 지역사회건강조사로 본 운동 × 생활요인 조합, 경제적 역전점, 그리고 예측 모델의 일반화 —";

// ---- 표지
C.push(new Paragraph({ spacing: { before: 2400 }, children: [] }));
C.push(center([{ t: TITLE, b: true }]));
C.push(center([{ t: SUB, b: true }]));
C.push(center([{ t: "Lower Depressive Symptoms When Exercise Is Combined With Other Healthy Habits: Exercise–Lifestyle Combinations, Economic Reversal, and Generalizable Risk Models in the 2025 Korea Community Health Survey", i: true }]));
C.push(center([""]));
C.push(center([HL("[저자명 1], [저자명 2], [저자명 3]")]));
C.push(center(["한국외국어대학교 ", HL("[학과명]")]));
C.push(center(["S01418201 스포츠융합산업프로젝트실습"]));
C.push(center(["박성희 교수 외 팀티칭"]));
C.push(center([HL("[제출일: 2026년 ○월 ○일]")]));
C.push(new Paragraph({ spacing: { before: 1200 }, children: [] }));
C.push(center([{ t: "저자 노트", b: true }]));
C.push(P(["이 원고는 중간 발표(2026년 10월 29일)의 피드백(스포츠 분야와의 관련성 강화, 결과변수 PHQ-9 5점 기준)을 반영한 v4이다. 연구비: ", HL("[기재]"),
  " 이해상충: ", HL("[기재]"), " 생성형 AI 활용: ", HL("[예: 분석 코드와 원고 초안 작성에 Anthropic Claude를 활용하였으며 저자가 모든 결과와 문장을 검토·수정하였다]"),
  " 교신저자: ", HL("[이름, 이메일]")], { noIndent: true }));
C.push(pageBreak());

// ---- 국문 초록
C.push(H1("국문 초록"));
C.push(PL([{ t: "목적: ", b: true }, "운동은 우울 증상과 관련된 대표적 생활요인이지만, 실제 생활에서는 다른 생활습관과 함께 실천된다. 이 연구는 (1) 운동을 어떤 생활요인과 함께할 때 우울 증상 비율이 가장 낮은지, (2) 그 효과가 경제적으로 불리한 집단에서 더 큰지, (3) 우울 위험 예측 모델이 특정 설문 척도가 아닌 우울 위험 자체를 학습하는지를 검토하였다."], { noIndent: true }));
C.push(PL([{ t: "방법: ", b: true }, `2025년 지역사회건강조사의 성인 ${n0(y5.n)}명을 분석한 횡단면 연구이다. 주 결과는 PHQ-9 5점 이상(가중 ${pct(y5.weighted_pct)})이며, 별도 문항인 최근 1년 우울감 경험(${pct(ym.weighted_pct)})으로 교차 검증하였다. 운동 요인 4개(걷기, 중강도 이상 유산소, 근력운동, 신체활동 권고)와 생활요인 5개(담배제품 미사용, 고위험음주 아님, 아침식사, 사회적 연결, 칫솔질)의 쌍마다 조사설계 로지스틱 회귀로 4칸 조정 유병률을 추정하였다. 가구 단위로 나눈 탐색 세트에서 운동 정의·층·결과를 넓게 시도해 후보를 고르고(${n0(D.c1_n_specs)}개 명세), 확인 세트에서 Holm 보정으로 검정하였다. 예측은 CatBoost로 교차 결과 예측, 불균형 보정, 스포츠 조합 가중 모델을 비교하였다.`], { noIndent: true }));
C.push(PL([{ t: "결과: ", b: true }, `걷기와 사회적 연결을 함께 충족한 사람의 조정 유병률은 ${pct(ws.p11)}로, 둘 다 충족하지 않은 사람(${pct(ws.p00)})보다 ${abs(ws.joint)}%p 낮았다(확인 세트). 이 감소 폭은 소득 하위 20%에서 ${abs(wsLow.joint)}%p, 상위 20%에서 ${abs(wsHigh.joint)}%p였다(차이 ${neg(p2w.contrast)}%p, 95% CI ${cpp(p2w.lo, p2w.hi)}, Holm p ${pv(p2w.p_holm)}). 1:1 조합 30쌍 중 운동이 포함된 조합은 전체 감소 폭으로는 최고 ${bestSportPair.rank_all}위로 금연·사회적 연결·아침식사·칫솔질끼리의 조합보다 작았고, "운동과 짝지을 때만 특히 커지는" 생활요인도 확인되지 않았다. 소득 하위와 상위 20%의 감소 폭 차이는 사회적 연결·아침식사를 포함한 조합에서 컸고, 이 두 요인의 짝으로는 운동(걷기·권고 충족·근력)이 금연·절주·칫솔질보다 차이가 컸다(차이 상위 7개 중 ${nSportTop7}개가 운동 + 사회적 연결·아침식사). 생활요인을 5개 이상 충족한 소득 하위 집단의 유병률은 생활요인이 적은 상위 집단보다 낮았다(역전). 다른 결과로 학습한 모델도 자기 결과 모델 AP의 ${f(xA.AP_retained_pct, 0)}~${f(xB.AP_retained_pct, 0)}%를 회복했고, 불균형 보정은 성능을 높이지 못하였다.`], { noIndent: true }));
C.push(PL([{ t: "결론: ", b: true }, "운동은 다른 생활요인보다 강한 짝은 아니었지만, 다른 요인과 겹치지 않고 더해졌다. 취약계층에서 감소 폭이 커지는 핵심은 사회적 연결과 규칙적 식사였고, 운동은 이들과 함께할 때 소득 간 차이를 키우는 짝이었다. 따라서 운동의 가치는 단독 효과의 크기보다, 사회적 연결과 묶여 취약계층의 우울 격차를 좁힐 가능성에 있다. 걷기에 사람을 묶는 저비용 프로그램(함께 걷기)을 취약 집단에 우선 제공하는 것을 제언한다. 횡단면 자료이므로 인과로 해석할 수 없다."], { noIndent: true }));
C.push(PL([{ t: "주요어: ", b: true }, "우울 증상, PHQ-9, 걷기, 사회적 연결, 생활요인 조합, 경제적 불리, 머신러닝, 지역사회건강조사"], { noIndent: true }));
C.push(pageBreak());

// ---- 영문 초록
C.push(H1("Abstract"));
C.push(PL([{ t: "Objective: ", b: true }, "We examined which healthy habits, when combined with exercise, are associated with the lowest prevalence of depressive symptoms, whether these associations are larger among economically disadvantaged adults, and whether machine-learning risk models generalize beyond a single questionnaire."], { noIndent: true }));
C.push(PL([{ t: "Methods: ", b: true }, `Cross-sectional analysis of ${n0(y5.n)} adults in the 2025 Korea Community Health Survey. The primary outcome was PHQ-9 ≥ 5 (weighted ${pct(y5.weighted_pct)}); a separate item on persistent depressed mood (${pct(ym.weighted_pct)}) served as a cross-check. For each pair of four exercise factors and five lifestyle factors, survey-weighted logistic models gave adjusted prevalences in four cells. Candidates were searched broadly in an exploration set (${n0(D.c1_n_specs)} specifications) and tested once in a household-separated confirmation set with Holm correction. CatBoost models assessed cross-outcome prediction, class-imbalance corrections, and exercise-combination weighting.`], { noIndent: true }));
C.push(PL([{ t: "Results: ", b: true }, `Meeting both walking and social-connection criteria was associated with ${abs(ws.joint)} percentage points lower prevalence than meeting neither (${pct(ws.p11)} vs ${pct(ws.p00)}). This difference was ${abs(wsLow.joint)} points in the lowest income quintile and ${abs(wsHigh.joint)} in the highest (difference ${neg(p2w.contrast)}, 95% CI ${cpp(p2w.lo, p2w.hi)}, Holm p ${pv(p2w.p_holm)}). Among 30 one-to-one combinations, exercise-containing pairs ranked no higher than ${bestSportPair.rank_all}th in overall reduction and no exercise-specific synergy was confirmed, while low- versus high-income differences were largest for pairs involving social connection or regular breakfast, where exercise partners (walking, guideline, strength) showed larger differences than smoking, alcohol, or tooth-brushing partners. Disadvantaged adults meeting five or more healthy factors had lower prevalence than advantaged adults meeting few. Models trained on one outcome recovered ${f(xA.AP_retained_pct, 0)}–${f(xB.AP_retained_pct, 0)}% of the other outcome's own-model AP; imbalance corrections did not help.`], { noIndent: true }));
C.push(PL([{ t: "Conclusion: ", b: true }, "Exercise was not the strongest partner habit, but it added independently. Social connection and regular meals drove the larger reductions in low-income adults, and exercise amplified them as a partner, supporting low-cost group-walking programs targeted to disadvantaged communities. Causal inference is not possible with cross-sectional data."], { noIndent: true }));
C.push(pageBreak());

// ---- 서론
C.push(H1(TITLE));
C.push(H2("연구 배경"));
C.push(P("우울은 단일 원인보다 신체·심리·사회·경제 조건이 함께 관련되는 복합 현상이다(Engel, 1977). 그중 신체활동은 우울 발생 위험 감소와 일관되게 관련되며(Schuch et al., 2018), 활동이 전혀 없는 상태에서 조금 늘릴 때 위험 감소가 가장 크다(Pearce et al., 2022). 운동 종류별로는 걷기, 근력운동, 요가 등이 우울 증상을 줄였다(Gordon et al., 2018; Noetel et al., 2024)."));
C.push(P("그러나 사람들은 운동만 따로 하지 않는다. 흡연·음주·식생활·사회적 연결 같은 다른 생활습관을 함께 실천하거나 함께 놓친다. 건강 생활요인을 많이 실천할수록 우울 위험이 낮다는 결합 연구(Zhao et al., 2023)는 있지만, 운동을 어떤 생활요인과 함께할 때 특히 유리한지를 비교한 연구는 드물다. 또한 사회경제적 지위가 낮을수록 우울이 흔하므로(Lorant et al., 2003), 같은 생활습관 조합의 효과가 경제 집단에 따라 다른지도 공중보건과 스포츠 정책에서 중요한 질문이다(Ross & Mirowsky, 2006; Zhang et al., 2021)."));
C.push(P("이 연구는 중간 발표에서 받은 두 가지 피드백, 즉 스포츠 분야와의 관련성 강화와 PHQ-9 5점 기준 적용을 반영한다. 앞선 다차원 요인 분석(연구 1)과 경제적 역전점 분석(연구 2)을 PHQ-9 5점 기준으로 갱신하고, 두 연구를 운동 × 생활요인 조합이라는 축으로 잇는다."));
C.push(H2("연구 질문"));
C.push(bullet(["RQ1. 어느 생활 영역이 우울 증상과 가장 관련되는가?"]));
C.push(bullet(["RQ2. 운동과 짝지을 때 특히 효과가 큰 생활요인이 있는가? 운동마다 가장 좋은 짝은 무엇인가?"]));
C.push(bullet(["RQ3. 운동 조합의 효과는 경제적으로 불리한 집단에서 더 큰가? 불리 집단이 생활요인을 많이 실천하면 유리 집단보다 낮아지는가(역전)?"]));
C.push(bullet(["RQ4. 예측 모델은 특정 설문 척도가 아니라 우울 위험을 학습하는가? 스포츠 조합에 가중치를 주면 예측이 나아지는가?"]));

// ---- 방법
C.push(H1("방법"));
C.push(H2("자료와 대상"));
C.push(P(`2025년 지역사회건강조사 원시자료(질병관리청, 2025)에서 PHQ-9 총점을 산출할 수 있는 만 19세 이상 성인 ${n0(y5.n)}명을 분석하였다. 분석은 층(kstrata), 집락(조사지점), 개인 가중치를 반영하였고, 학습·시험 분할은 가구 단위로 나눈 기존 분할(학습 184,762명, 시험 46,528명)을 그대로 썼다. 보고는 STROBE(von Elm et al., 2007)를 따랐다.`));
C.push(H2("결과변수"));
C.push(P(`주 결과는 PHQ-9 총점 5점 이상(경도 이상 우울 증상; Kroenke et al., 2001)이다. 교차 검증 결과로 "최근 1년 동안 2주 이상 연속으로 일상생활에 지장이 있을 정도의 슬픔이나 절망감을 경험했는가"(우울감 경험, mtb_01z1)를 썼다. 원자료에는 우울증 진단 문항이 없어, PHQ-9와 다른 문항으로 측정한 이 지표를 택하였다. 기존 기준인 PHQ-9 10점 이상은 민감도 분석에 썼다. 세 결과의 가중 유병률은 ${pct(y5.weighted_pct)}, ${pct(ym.weighted_pct)}, ${pct(y10.weighted_pct)}였고, PHQ-9 5점 이상과 우울감 경험의 일치도는 κ = ${f(D.kappa["y5×y_mood"], 2)}로 서로 겹치지만 다른 것을 재었다.`));
C.push(H2("운동 요인과 생활요인"));
C.push(P("운동 요인은 걷기 실천(주 5일 이상, 1일 30분 이상), 중강도 이상 유산소 신체활동(지침서 정의), 근력운동 주 2일 이상, 신체활동 권고 충족(유산소와 근력 모두; World Health Organization, 2020)의 4개다. 생활요인은 개인 행동이면서 공식 충족 기준이 있는 5개(담배제품 미사용, 고위험음주 아님, 아침식사 주 5회 이상, 사회적 연결, 저녁식사 후 또는 잠자기 전 칫솔질)다. 사회적 연결은 1인 가구, 친척·친구 연락 월 1회 이하, 이웃 경조사 불참 중 0~1개에 해당하는 경우로 정의하였다(Zhao et al., 2023)."));
C.push(H2("분석"));
C.push(H3("조합 분석(RQ2)"));
C.push(P("두 요인 A, B의 쌍마다 결과 ~ A + B + A×B + 인구·경제·신체건강 변수의 조사설계 로지스틱 회귀를 적합하고, 표본 전체의 공변량 분포로 표준화한 4칸(둘 다, A만, B만, 둘 다 아님)의 조정 유병률을 구하였다. 결합 감소는 둘 다 충족과 둘 다 아님의 차이, 시너지는 가법 상호작용(차이의 차이; VanderWeele & Knol, 2014)이다. \"운동과 짝지을 때 특히 효과가 큰\" 생활요인 X는 운동 s와 X의 시너지에서 X와 다른 일반 생활요인 쌍들의 평균 시너지를 뺀 대비가 음수인 경우로 정의하였다. 서로 다른 모형에 걸친 대비의 분산은 각 모형 추정량의 영향함수를 집락 단위로 합산해 층 안에서 중심화한 테일러 선형화로 구하였다(Lumley, 2004)."));
C.push(H3("탐색과 확인"));
C.push(P(`분석 정의의 선택이 결과를 좌우하지 않도록, 학습셋을 탐색 세트, 시험셋을 확인 세트로 썼다. 탐색 세트에서는 운동 정의 7개(주 정의 4개 + 주 600 MET-분, 걷기 주 3일, 근력운동 주 1일), 생활요인 8개(주 5개 + 수면, 이웃 신뢰, 동네 안전), 층 9개(전체, 성별, 연령대 3개, 소득 집단 3개), 결과 2개를 조합한 ${n0(D.c1_n_specs)}개 대비를 모두 계산해 기록하였다. 미리 정한 규칙(PHQ-9 5점 대비 < 0, p < .05, 우울감 경험에서도 같은 방향)을 통과한 것 중 p가 작은 5개를 확인 세트에서 한 번 검정하고 Holm 보정하였다. 탐색 중 관찰한 패턴 두 가지(운동 쌍과 생활요인 쌍의 시너지 차이, 운동 + 사회적 연결의 소득 집단 차이)도 같은 방식으로 확인 세트에서 검정하였다.`));
C.push(H3("경제적 역전점(RQ3)"));
C.push(P("경제 불리 지표 3개(균등화 소득 하위 20% 대 상위 20%, 기초생활수급, 가구 식품 불안정)와 생활요인 개수(신체활동 권고 + 생활요인 5개, 0~2/3/4/5/6개)의 교차 칸 조정 유병률을 구하였다. 역전 ①은 불리 집단이 생활요인 0~2개인 유리 집단보다 유의하게 낮아지는 첫 단계, 역전 ②는 유리 집단 전체 평균보다 유의하게 낮아지는 첫 단계다. 가법 상호작용(0~2개에서 6개로의 감소 폭 차이)과 연령 표준화 격차 분해를 함께 보고하였다(Link & Phelan, 1995)."));
C.push(H3("예측 모델(RQ1·RQ4)"));
C.push(P("CatBoost(Prokhorenkova et al., 2018)를 고정 하이퍼파라미터로 주 분석 53개 변수에 학습하였다. 입력에는 PHQ 문항과 증상근접 변수(스트레스, 수면, 주관적 건강 등)가 없다. RQ1은 인구 정보에 각 영역을 더하거나 전체에서 빼서 시험셋 AP 변화(ΔAP)를 보았다. RQ4에서는 PHQ-9 5점과 우울감 경험으로 각각 학습한 모델을 두 결과 모두로 평가하였고, 불균형 처리(보정 없음, 클래스 가중치, SMOTE-NC)를 학습셋에만 적용해 비교하였다(van den Goorbergh et al., 2022). 스포츠 조합 가중 모델은 탐색 세트에서 결합 감소가 큰 운동 × 생활요인 2쌍을 골라, 조합 지시변수를 넣는 방법과 CatBoost 특성 가중치로 운동·짝 변수의 분할 선택 가중을 높이는 방법을 비교하였다. 비교는 시험셋 가구 부트스트랩 ΔAP 95% CI와 보정으로 하였고, 변수 기여와 상호작용은 SHAP으로 보았다(Lundberg et al., 2020)."));

// ---- 결과
C.push(H1("결과"));
C.push(...apaTable({
  title: "결과변수의 분포",
  head: ["결과", "n", "사례", "가중 유병률", "학습 / 시험"],
  rows: D.outcomes.map((o) => [o.label, n0(o.n), n0(o.events), pct(o.weighted_pct, 2), `${pct(o.train_weighted_pct)} / ${pct(o.test_weighted_pct)}`]),
  widths: [3, 1.4, 1.2, 1.4, 1.8],
  note: `PHQ-9 5점 이상과 우울감 경험의 κ = ${f(D.kappa["y5×y_mood"], 2)}. PHQ-9 5점 이상인 사람 중 우울감 경험 ${pct(100 * D.p_mood_given_y5)}, 우울감 경험자 중 PHQ-9 5점 이상 ${pct(100 * D.p_y5_given_mood)}.`,
}));

C.push(H2("RQ1. 생활 영역별 관련"));
if (ML) {
  const solo = ML.filter((m) => m.kind === "단독").sort((a, b) => b.dAP - a.dAP);
  const uniq = ML.filter((m) => m.kind === "고유").sort((a, b) => b.dAP - a.dAP);
  const full = ML.find((m) => m.kind === "전체"), base = ML.find((m) => m.kind === "기준");
  C.push(P(`PHQ-9 5점 기준 CatBoost 전체 모형의 시험셋 AP는 ${f(full.AP)}(유병률 ${f(full.prevalence)}의 ${f(full.AP_lift, 1)}배, ROC-AUC ${f(full.ROC_AUC)})로, 인구 정보만 쓴 모형(${f(base.AP)})보다 높았다. 단독 기여가 가장 큰 영역은 ${solo[0].domain_label}(ΔAP ${f(solo[0].dAP)}), ${solo[1].domain_label}(${f(solo[1].dAP)}) 순이었고, 고유 기여도 ${uniq[0].domain_label}(${f(uniq[0].dAP)})이 가장 컸다. ${uniq.every((u) => u.dAP_lo > 0) ? "모든 영역의 고유 기여 신뢰구간이 0보다 커서, 각 영역이 다른 영역으로 대체되지 않는 정보를 더하였다." : "일부 영역은 고유 기여 신뢰구간이 0을 포함하였다."}`));
  C.push(...apaFigure({ file: "v4/fig_v4_08_domains_y5.png", title: "영역별 예측 기여(PHQ-9 5점 이상)", note: "단독 = (인구 + 영역) − 인구, 고유 = 전체 − (전체 − 영역). 시험셋 가구 부트스트랩 95% CI." }));
}
const vt = D.e1_variable_tests;
C.push(P(`조사설계 회귀에서 변수별 결합 검정 F가 큰 변수는 ${vt.slice(0, 6).map((v) => v.name).join(", ")} 순이었다. 바꿀 수 있는 요인 중에서는 저작불편 "매우 불편"(${orT(orF("저작불편", "매우 불편"))}), 미충족 의료(${orT(orF("미충족 의료", "있음"))}), 식품 "자주 부족"(${orT(orF("식품안정성", "자주 부족"))})의 관련이 컸다. 결과 기준이 낮아져 오즈비는 PHQ-9 10점 기준보다 1에 가까워졌지만 순서는 거의 같았다. 신체활동 권고와 생활요인 5개의 충족 수가 하나 늘 때마다 오즈는 ${f(cnt5.trend_OR, 2)}배(95% CI ${ci(cnt5.trend_low, cnt5.trend_high, 2)})였다.`));

C.push(H2("RQ2. 운동과 함께할 때 효과가 큰 생활요인"));
C.push(P(`확인 세트에서 걷기와 짝을 이룬 생활요인의 결합 감소는 ${walkRank.map((r) => `${LIFE[r.b]} ${neg(r.joint)}%p`).join(", ")} 순이었다(그림 ${ML ? 2 : 1}). 걷기와 사회적 연결을 함께 충족한 사람은 ${pct(ws.both_pct, 0)}였고, 이들의 조정 유병률은 ${pct(ws.p11)}로 둘 다 아닌 사람(${pct(ws.p00)})보다 ${abs(ws.joint)}%p(결합 감소 95% CI ${cpp(ws.joint_lo, ws.joint_hi)}) 낮았다. 이 감소는 우울감 경험(${neg(wsMood.joint)}%p, ${cpp(wsMood.joint_lo, wsMood.joint_hi)})과 PHQ-9 10점 기준(${neg(ws10.joint)}%p, ${cpp(ws10.joint_lo, ws10.joint_hi)})에서도 재현되었다. 상위 세 짝(사회적 연결, 칫솔질, 담배 미사용)의 크기는 비슷해(전체 표본에서 1위와 2위의 차이 ${neg(walkTie.joint)}%p, p ${pv(walkTie.p)}) 걷기의 최고 짝을 하나로 정할 수는 없었다. 시너지는 모두 0 근처로 운동과 생활요인의 효과는 대체로 독립적으로 더해졌다.`));
C.push(...apaFigure({ file: "v4/fig_v4_01_joint_heatmap.png", title: "운동 × 생활요인을 함께 충족할 때의 우울 증상 감소(확인 세트, PHQ-9 5점 이상)",
  note: "칸 값 = 둘 다 충족한 사람과 둘 다 아닌 사람의 조정 유병률 차이(%p). 인구·경제·신체건강 변수를 조정하였다." }));
C.push(P(`탐색 세트의 PHQ-9 5점 대비 ${n0(D.c1_n_specs_y5)}개 중 ${n0(D.c1_n_rule_pass)}개가 후보 규칙을 통과했고, 상위 5개는 모두 걷기(또는 유산소)와 아침식사·담배 미사용의 시너지 대비였다. 그러나 확인 세트에서는 5개 모두 신뢰구간이 0을 포함하였다. 가장 강한 후보인 ${bestC.stratum} 층의 ${SPORT[bestC.sport] || bestC.sport_label} + ${LIFE[bestC.x] || bestC.x_label} 대비는 ${neg(bestC.contrast)}%p(95% CI ${cpp(bestC.lo, bestC.hi)}, Holm p ${pv(bestC.p_holm)})였다${c10best ? `(PHQ-9 10점 기준에서는 ${neg(c10best.contrast)}%p, ${cpp(c10best.lo, c10best.hi)})` : ""}. 운동 쌍의 평균 시너지가 일반 생활요인 쌍보다 작다는 탐색 패턴도 확인되지 않았다(모든 p > ${f(Math.min(...p1.map((x) => x.p)), 2).replace(/^0/, "")}). 따라서 "운동과 짝지을 때만 특히 커지는" 생활요인은 이 자료에서 확인되지 않았고, 탐색 후보로만 보고한다.`));
C.push(H3("운동 짝의 상대 순위"));
C.push(P(`운동을 일반 생활요인과 직접 비교하기 위해, 운동 4개와 일반 생활요인 5개로 만들 수 있는 1:1 조합 30쌍(운동끼리는 정의가 겹쳐 제외)의 결합 감소를 전체 표본에서 비교하였다. 1~${nGenBefore}위는 모두 일반 생활요인끼리의 조합이었고(1위 ${RP[0].a_label} + ${RP[0].b_label} ${neg(RP[0].joint)}%p), 운동이 포함된 조합의 최고 순위는 ${bestSportPair.rank_all}위(${bestSportPair.a_label} + ${bestSportPair.b_label}, ${neg(bestSportPair.joint)}%p)였다. 일반 생활요인 하나를 기준으로 8개 짝(일반 4개, 운동 4개)을 비교하면, 운동 짝의 최고 순위는 ${Math.min(...sportBestRanks)}~${Math.max(...sportBestRanks)}위였고 각 생활요인의 1위 짝보다 결합 감소가 ${f(Math.min(...bfDiffs), 1)}~${f(Math.max(...bfDiffs), 1)}%p 작았다(모두 p ≤ .001). 운동이 이긴 일반 생활요인은 효과가 가장 약한 고위험음주 아님뿐이었다. 우울감 경험에서도 운동 짝의 최고 순위는 ${Math.min(...sportBestRanksM)}~${Math.max(...sportBestRanksM)}위였다. 운동 사이에서는 신체활동 권고 충족(유산소 + 근력) > 근력운동 > 걷기 > 중강도 이상 유산소 순이었다. 결합 감소는 두 요인 각각의 관련을 더한 값에 가까우므로, 이 순위는 운동 변수 하나와 우울의 관련이 금연·사회적 연결·칫솔질보다 작다는 뜻이다. 다만 도달 범위는 달랐다. 걷기 실천은 성인의 ${f(PV("walk")["전체"], 1)}%였으나 신체활동 권고 충족은 ${f(PV("pa_guide")["전체"], 1)}%에 그쳤다.`));
C.push(...apaTable({
  title: "일반 생활요인별 짝 순위(1:1 조합, 결합 감소 기준, PHQ-9 5점 이상)",
  head: ["기준 생활요인", "1위 짝", "2위", "3위", "4위", "운동 짝 최고 순위", "1위 대비 차이"],
  rows: LIVES.map((x) => {
    const r = RBF.filter((q) => q.x === x).sort((a, b) => a.rank_in_x - b.rank_in_x);
    const nm = (q) => `${q.partner_label}${q.partner_is_sport ? "*" : ""} ${neg(q.joint)}`;
    const t = bfTest(x);
    return [LIFE[x], nm(r[0]), nm(r[1]), nm(r[2]), nm(r[3]), `${sportBest(RBF, x)}위`, `${neg(t.joint)} ${cpp(t.joint_lo, t.joint_hi)}`];
  }),
  widths: [2, 2, 2, 2, 2, 1.2, 1.8],
  note: "* = 운동 요인. 값은 둘 다 충족과 둘 다 아님의 조정 유병률 차이(%p, 전체 표본). 1위 대비 차이 = 운동 짝 최고 − 1위 짝(양수 = 운동 짝의 감소가 작음).",
}));
C.push(...apaFigure({ file: "v4/fig_v4_02_spec_curve.png", title: "스포츠 특이 시너지 대비의 명세 곡선(탐색)과 후보의 확인 세트 추정",
  note: "(a) 탐색 세트에서 시도한 PHQ-9 5점 대비 전체. 파란색 = 95% CI가 0을 포함하지 않음. (b) 미리 정한 규칙으로 고른 후보 5개의 확인 세트 추정." }));

C.push(H2("RQ3. 경제적 불리와 운동 조합, 역전점"));
C.push(P(`걷기와 사회적 연결의 결합 감소는 소득 하위 20%에서 ${abs(p2w.value_1)}%p, 상위 20%에서 ${abs(p2w.value_2)}%p로, 하위 집단에서 ${abs(p2w.contrast)}%p(차이 95% CI ${cpp(p2w.lo, p2w.hi)}, Holm p ${pv(p2w.p_holm)}) 더 컸다. PHQ-9 10점 기준에서도 같은 차이가 유의하였고(${neg(p2w10.contrast)}%p, ${cpp(p2w10.lo, p2w10.hi)}), 우울감 경험에서는 같은 방향이지만 유의하지 않았다(${neg(p2wm.contrast)}%p, ${cpp(p2wm.lo, p2wm.hi)}). 유산소, 근력운동, 신체활동 권고와 사회적 연결의 조합도 같은 방향이었으나 보정 후 유의하지 않았다(차이 ${p2others.map((x) => neg(x.contrast)).join(", ")}%p).`));
C.push(...apaFigure({ file: "v4/fig_v4_03_income_link.png", title: "운동 + 사회적 연결의 결합 감소: 소득 하위 20% 대 상위 20%(확인 세트)" }));
C.push(P(`이 패턴이 운동 조합에 특징적인지 보기 위해 30쌍 모두를 소득 하위·상위 20%에서 추정하였다(전체 표본, 탐색적). 하위 20%의 결합 감소 자체는 ${topLow.pair}(${neg(topLow.low_joint)}%p)이 가장 컸고 걷기 + 사회적 연결은 ${wsI.rank_low}위(${neg(wsI.low_joint)}%p; 1위와 차이 ${neg(tLow.diff)}%p, p ${pv(tLow.p)})였다. 그러나 하위와 상위의 감소 폭 차이로 순위를 매기면, 1위 ${RI[0].pair}(${neg(RI[0].gap)}%p) 다음으로 걷기 + 사회적 연결이 ${wsI.rank_gap}위(${neg(wsI.gap)}%p; 1위와 차이 ${neg(tGap.diff)}%p, p ${pv(tGap.p)})였고, 상위 7개 중 ${nSportTop7}개가 운동 조합이었다. 다만 이 순위는 운동 조합 전체의 특징이 아니었다. 운동 조합 20쌍의 소득 간 차이 평균은 ${neg(meanBy(RI, "운동+일반", "gap"))}%p로 일반 조합 10쌍(${neg(meanBy(RI, "일반+일반", "gap"))}%p)과 비슷했다. 차이를 만든 것은 짝이었다. 사회적 연결이나 아침식사를 포함한 조합은 짝이 운동이든 일반 생활요인이든 소득 간 차이가 컸고, 담배 미사용·칫솔질·절주와의 조합은 작았다. 사회적 연결의 짝을 소득 간 차이 순으로 보면 ${socP.map((r) => `${NM[r.partner]} ${neg(r.gap)}`).join(", ")}였다(운동 짝 평균 ${neg(gapSportSoc)}, 일반 짝 평균 ${neg(gapGenSoc)}%p). 즉 운동은 아침식사 다음으로, 금연·절주·칫솔질보다 큰 차이를 보이는 짝이었다. 우울감 경험에서도 소득 차이 상위 7개 중 ${nSportTop7m}개가 운동 조합이었다. 한편 소득 하위층은 운동 실천율이 낮았다(근력운동 ${f(PV("strength")["소득 하위 20%"], 1)}% 대 ${f(PV("strength")["소득 상위 20%"], 1)}%, 신체활동 권고 충족 ${f(PV("pa_guide")["소득 하위 20%"], 1)}% 대 ${f(PV("pa_guide")["소득 상위 20%"], 1)}%, 사회적 연결 ${f(PV("social")["소득 하위 20%"], 1)}% 대 ${f(PV("social")["소득 상위 20%"], 1)}%). 즉 취약계층에서 감소 폭이 큰 조합은 그 계층이 현재 덜 실천하는 조합이기도 하다.`));
C.push(...apaTable({
  title: "소득 하위·상위 20%의 감소 폭 차이가 큰 조합(상위 10쌍, PHQ-9 5점 이상)",
  head: ["순위", "조합", "유형", "하위 20%", "상위 20%", "차이(하위 − 상위) [95% CI]"],
  rows: RI.slice(0, 10).map((r) => ({ bold: r.a === "walk" && r.b === "social",
    cells: [String(r.rank_gap), r.pair, r.kind === "운동+일반" ? "운동" : "일반", neg(r.low_joint), neg(r.high_joint), `${neg(r.gap)} ${cpp(r.gap_lo, r.gap_hi)}`] })),
  widths: [0.8, 3.4, 0.9, 1.2, 1.2, 2.4],
  note: `값은 둘 다 충족과 둘 다 아님의 조정 유병률 차이(%p, 전체 표본, 탐색적). 굵은 행(걷기 + 사회적 연결)은 확인 세트에서 별도로 검증되었다(차이 ${neg(p2w.contrast)}%p, Holm p ${pv(p2w.p_holm)}). 1위와 2위의 차이는 ${neg(tGap.diff)}%p(p ${pv(tGap.p)})로 유의하지 않다. 운동 조합 20쌍 전체의 평균 차이는 ${neg(meanBy(RI, "운동+일반", "gap"))}%p로 일반 조합(${neg(meanBy(RI, "일반+일반", "gap"))}%p)과 비슷하다.`,
}));
C.push(...apaFigure({ file: "v4/fig_v4_09_pair_ranks.png", title: "1:1 생활요인 조합 30쌍: 전체 감소 순위와 소득 계층 간 차이 순위", widthIn: 6.4,
  note: "주황 = 운동 포함 조합, 파랑 = 일반 생활요인끼리의 조합. (b) 채운 점 = 소득 하위 20%, 빈 점 = 상위 20%. 전체 표본 기술 분석이며, 걷기 + 사회적 연결의 소득 차이만 확인 세트에서 별도 검증되었다." }));
C.push(P(`생활요인 개수로 보면, 소득 하위 20%의 조정 유병률은 0~2개 ${pct(100 * cell("income", "하위(1분위)", "0~2개").adj_prev)}에서 6개 ${pct(100 * cell("income", "하위(1분위)", "6개").adj_prev)}로, 상위 20%(${pct(100 * cell("income", "상위(5분위)", "0~2개").adj_prev)} → ${pct(100 * cell("income", "상위(5분위)", "6개").adj_prev)})보다 크게 낮아졌다(가법 상호작용 ${neg(inc.additive_pp)}%p, 95% CI ${cpp(inc.additive_low, inc.additive_high)}). 하위 집단은 5개부터 생활요인이 적은 상위 집단보다 낮았고(역전 ①, ${neg(rev("income", "5개", "유리 집단 0~2개").diff_pp)}%p), 6개에서는 상위 집단 전체 평균보다도 낮았다(역전 ②). 기초생활수급과 식품 불안정도 5개부터 역전 ①이 나타났지만 역전 ②는 없었다. 생활요인 분포 차이로 설명되는 격차는 소득 ${f(100 * dec("income").share_explained, 0)}%, 수급 ${f(100 * dec("livelihood").share_explained, 0)}%, 식품 ${f(100 * dec("food").share_explained, 0)}%였다.`));
C.push(...apaTable({
  title: "경제 불리 지표별 역전점과 가법 상호작용(PHQ-9 5점 이상)",
  head: ["지표", "역전 ①", "역전 ②", "감소 폭 불리 / 유리", "가법(차이의 차이)", "생활요인 몫"],
  rows: [["균등화 소득 하위 vs 상위 20%", inc], ["기초생활수급", liv], ["가구 식품 불안정", foo]].map(([n, r]) => [n, r.reversal_1, r.reversal_2,
    `${neg(r.drop_dis_pp)} / ${neg(r.drop_adv_pp)}`, `${neg(r.additive_pp)} ${cpp(r.additive_low, r.additive_high)}`,
    `${f(100 * dec(r.indicator).share_explained, 0)}%`]),
  widths: [3, 1, 1, 1.8, 2.2, 1.2],
  note: "생활요인 = 신체활동 권고 + 생활요인 5개(0~6). 감소 폭은 0~2개에서 6개로의 조정 유병률 변화(%p). 생활요인 몫 = 연령 표준화 분포로 계산한 격차 분해. 이전 정의(7개) 민감도에서도 역전 ①은 모두 5개였다.",
}));
C.push(...apaFigure({ file: "v4/fig_v4_06_reversal_y5.png", title: "경제 집단별 건강 생활요인 개수와 우울 증상 조정 유병률" }));

C.push(H2("RQ4. 예측 모델의 일반화와 스포츠 조합 가중"));
C.push(P(`PHQ-9 5점으로 학습한 모델은 우울감 경험을 AP ${f(xA.AP)}(유병률의 ${f(xA.AP_lift, 1)}배)로 예측해, 우울감 경험으로 학습한 모델 AP(${f(xBB.AP)})의 ${f(xA.AP_retained_pct, 0)}%를 회복하였다. 반대 방향도 ${f(xB.AP_retained_pct, 0)}%였다. 두 모델의 SHAP 상위 10개 변수 중 ${so.top10_overlap}개(${so.overlap_features})가 같았고 전체 순위 상관은 ${f(so.spearman_all, 2)}였다. 따라서 모델은 PHQ라는 특정 척도가 아니라 두 측정이 공유하는 우울 위험을 학습하였다.`));
C.push(...apaFigure({ file: "v4/fig_v4_04_cross_outcome.png", title: "교차 결과 예측: 학습 결과 × 평가 결과" }));
C.push(P(`불균형 보정은 판별력을 높이지 못하였다. PHQ-9 5점에서 클래스 가중치의 ΔAP는 ${f(imb("y5", "balanced").dAP_vs_none, 4)}였고 관측/예측 비가 ${f(imb("y5", "balanced").OE, 2)}로 예측 확률이 크게 부풀었다. SMOTE-NC는 AP를 낮추었다(PHQ-9 5점 ${f(imb("y5", "smotenc").dAP_vs_none, 3)}, 우울감 경험 ${f(imb("y_mood", "smotenc").dAP_vs_none, 3)}). 따라서 보정 없는 모델을 유지하고 필요한 경우 임계값으로 운영점을 정하는 것이 적절하다.`));
C.push(...apaFigure({ file: "v4/fig_v4_05_imbalance.png", title: "불균형 처리 방법별 시험셋 AP와 보정" }));
if (c3) {
  const it = (D.c3_inter_sport_top || [])[0];
  C.push(P(`탐색 세트에서 고른 스포츠 조합(${c3.m1.combos})을 넣은 모델의 시험셋 AP는 구성 변수만 넣은 모델(${f(c3.m1.AP, 4)})과 비교해 조합 지시변수 ${c3.m2.dAP_vs_M1 >= 0 ? "+" : "−"}${f(Math.abs(c3.m2.dAP_vs_M1), 4)}(95% CI ${ci(c3.m2.dAP_vs_M1_lo, c3.m2.dAP_vs_M1_hi, 4)}), 특성 가중 ${c3.m3.dAP_vs_M1 >= 0 ? "+" : "−"}${f(Math.abs(c3.m3.dAP_vs_M1), 4)}(${ci(c3.m3.dAP_vs_M1_lo, c3.m3.dAP_vs_M1_hi, 4)})였다. ${c3.flat ? "두 방법 모두 예측 성능을 바꾸지 않았다. 트리 모델은 조합을 명시하지 않아도 변수 간 상호작용을 이미 학습하므로, 조합 정보는 예측보다 실천 권고에서 의미가 있다." : "조합 정보가 예측 성능을 일부 바꾸었다."}${it ? ` SHAP 상호작용에서 운동 변수가 포함된 상위 쌍은 ${it.f1} × ${it.f2}였다.` : ""}`));
  C.push(...apaFigure({ file: "v4/fig_v4_07_weighted_models.png", title: "스포츠 조합 가중 모델의 시험셋 AP" }));
}

// ---- 논의
C.push(H1("논의"));
C.push(H2("주요 결과"));
C.push(P("이 연구의 핵심은 네 가지다. 첫째, 운동은 가장 강한 짝은 아니었다. 1:1 조합에서 운동이 포함된 조합은 금연·사회적 연결·아침식사·칫솔질끼리의 조합보다 감소 폭이 작았고, 운동과 짝지을 때만 특별히 커지는 생활요인도 확인되지 않았다. 둘째, 그럼에도 운동은 다른 생활요인과 겹치지 않고 독립적으로 더해졌다(시너지 ≈ 0). 금연과 사회적 연결을 이미 실천하는 사람도 운동을 더하면 추가로 낮아질 수 있다는 뜻이다. 셋째, 운동 조합의 가치는 형평성에서 드러났다. 걷기와 사회적 연결의 조합은 소득 하위 집단에서 감소 폭이 상위 집단의 약 3배였고(확인 세트에서 검증), 30쌍 전체에서도 소득 간 차이가 큰 조합은 사회적 연결·아침식사를 포함한 조합이었고, 이 두 요인의 짝으로는 운동이 금연·절주·칫솔질보다 차이가 컸다. 운동 조합 전체의 평균 차이는 일반 조합과 비슷했으므로, 형평성의 핵심은 사회적 연결과 규칙적 식사이고 운동은 그 효과를 키우는 짝으로 보는 것이 정확하다. 이는 생활요인 개수에서 본 역전점과 가법 상호작용(자원 대체; Ross & Mirowsky, 2006)을 운동 조합 수준에서 다시 보여 주며, 운동이 사회적 관계·생활 리듬과 묶일 때 자원이 부족한 집단에서 대체 자원의 역할을 할 가능성을 시사한다. 넷째, 예측 모델은 서로 다른 두 우울 측정을 상호 예측하여, 특정 설문에 맞춰진 것이 아니라 우울 위험 자체를 학습한 것으로 보인다."));
C.push(H2("스포츠 분야에 주는 시사점"));
C.push(P("걷기는 비용과 시설이 거의 필요 없어 경제적 제약이 큰 사람도 바로 시작할 수 있는 운동이다. 이 연구에서 운동의 이점은 단독 크기보다 다른 생활요인과의 결합, 그리고 취약계층에서 커지는 효과에서 드러났다. 이를 근거로 다음을 제언한다."));
C.push(bullet(["운동을 사람과 묶기(함께 걷기): 사회적 연결의 짝 가운데 소득 간 차이가 큰 것은 아침식사 다음으로 걷기였다. 지자체 건강 걷기 사업과 생활체육 프로그램에 모임·동행 요소(걷기 동호회, 이웃 걷기 모임)를 기본으로 넣는다."]));
C.push(bullet(["취약계층 우선: 저소득층은 운동과 사회적 연결의 실천율이 낮으면서 같은 실천에서 감소 폭은 컸다. 저소득층·수급 가구가 많은 지역에 무료·근거리 프로그램을 우선 배치하면 우울 격차를 좁히는 데 기여할 수 있다."]));
C.push(bullet(["운동만 강조하지 않기: 금연·사회적 연결·규칙적 식사가 운동보다 강한 짝이었다. 운동 프로그램 안에서 식사·금연·구강 관리 안내를 함께 제공하면 효과가 서로 더해진다."]));
C.push(bullet(["유산소와 근력을 함께: 운동 중에서는 유산소와 근력을 모두 충족한 경우의 결합 감소가 가장 컸다. 다만 충족률이 낮으므로(성인 약 5명 중 1명), 걷기로 시작해 근력운동을 더하는 단계적 구성이 현실적이다."]));
C.push(H2("선행연구와의 비교"));
C.push(P("신체활동과 우울의 관련(Schuch et al., 2018; Pearce et al., 2022)과 생활요인 결합의 이점(Zhao et al., 2023)은 이 연구에서도 확인되었다. 이 연구는 여기에 더해 같은 생활요인을 운동과 짝지을 때와 다른 생활요인과 짝지을 때를 직접 비교하고, 넓게 탐색한 결과를 별도 확인 세트로 검증하였다. 사회경제적 지위에 따른 생활요인 효과 차이(Zhang et al., 2021)를 우울에서 운동 조합 단위로 보인 점도 새롭다."));
C.push(H2("한계"));
C.push(P("첫째, 횡단면 자료이므로 우울하지 않은 사람이 운동과 사회 활동을 더 잘 지키는 역인과를 배제할 수 없다. 둘째, 모든 변수가 자기보고이고, 신체활동 문항은 업무 중 활동을 포함한다(Holtermann et al., 2018). 셋째, 소득 집단 차이는 가법 척도의 비교이므로 기저 유병률이 높은 하위 집단에서 커지는 부분이 있다. 넷째, 탐색 범위가 넓었으므로 확인 세트에서 검증되지 않은 결과는 가설 생성 수준으로만 해석해야 한다. 특히 30쌍의 순위 비교는 전체 표본의 기술 분석이며, 확인 세트에서 별도로 검증된 것은 걷기 + 사회적 연결의 소득 차이다."));
C.push(H2("결론"));
C.push(P("운동은 우울 증상과 관련된 생활요인 가운데 가장 강한 요인은 아니었지만, 다른 생활습관과 겹치지 않고 더해졌다. 취약계층에서 감소 폭이 커지는 핵심은 사회적 연결과 규칙적 식사였고, 운동은 이들과 함께할 때 소득 간 차이를 키우는 짝이었다. 운동의 가치는 단독 효과의 크기보다, 사회적 연결과 묶여 취약계층과의 우울 격차를 좁힐 가능성에 있다. 걷기에 사람을 묶는 저비용 프로그램을 취약 집단에 우선 제공하는 것이 스포츠 분야가 우울 예방에 기여할 수 있는 실천적 방향이다."));

// ---- 참고문헌
C.push(pageBreak());
C.push(H1("참고문헌"));
REFS.forEach((r) => C.push(refPara(r)));

// ---- 부록
C.push(pageBreak());
C.push(H1("부록"));
C.push(...apaTable({
  label: "표 S1", title: "탐색 세트 후보와 확인 세트 결과(스포츠 특이 시너지 대비)",
  head: ["층", "운동", "생활요인", "탐색 대비", "확인 대비 [95% CI]", "Holm p", "PHQ-9 ≥ 10 확인"],
  rows: c5.map((r) => {
    const t = conf("y10").find((x) => x.stratum === r.stratum && x.sport === r.sport && x.x === r.x);
    const e = D.c1_candidates.find((x) => x.stratum === r.stratum && x.sport === r.sport && x.x === r.x);
    return [r.stratum, r.sport_label, r.x_label, neg(e.contrast, 2), `${neg(r.contrast, 2)} ${cpp(r.lo, r.hi, 2)}`, pv(r.p_holm).replace("= ", ""), t ? `${neg(t.contrast, 2)} ${cpp(t.lo, t.hi, 2)}` : "–"];
  }),
  widths: [1.2, 2, 1.6, 1.2, 2.2, 1, 2.2],
  note: `탐색 세트에서 시도한 대비는 결과 2 × 층 9 × 운동 정의 7 × 생활요인 8 × 지표 2 = ${n0(D.c1_n_specs)}개이며 모두 outputs/v4/reports/c1_specs.csv에 기록하였다.`,
}));
C.push(...apaTable({
  label: "표 S2", title: "신체활동 권고 × 생활요인 조합(전체 표본, PHQ-9 5점 이상)",
  head: ["생활요인", "둘 다 충족", "둘 다 아님", "결합 감소", "가법 상호작용 p"],
  rows: D.e1_combos.map((c) => [c.partner, pct(100 * c.prev_both), pct(100 * c.prev_neither), `${neg(100 * c.joint_diff)}%p`, f(c.add_p, 2)]),
  widths: [3, 1.4, 1.4, 1.4, 1.6],
}));

// ================================================================ 문서
const doc = new Document({
  creator: "Depression_ActivityNetwork_Capstone",
  title: TITLE,
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
  fs.writeFileSync(path.join(__dirname, "manuscript_v4.docx"), buf);
  console.log(`생성: paper/manuscript_v4.docx (참고문헌 ${REFS.length}편, 단계 D ${c3 ? "포함" : "없음"}, 영역 ML ${ML ? "포함" : "없음"})`);
});
