// v3 연구보고서 docx 생성: node make_report_v3.js → 건강생활요인_경제적불리_역전점_보고서.docx
// 양식: 4주차 14조 보고서 템플릿(styles.js·cover.js)을 스포츠융합산업프로젝트실습에 맞게 고쳐 씀.
// 수치: report_data.json(src/v3/build_report_data.py) 하나에서만 가져온다 — 손으로 옮겨 적지 않음.
// 이어서: python postprocess.py <docx> (제목 자동 번호) → finalize.ps1 (목차·필드 갱신, 글꼴 포함, PDF)
const fs = require('fs');
const path = require('path');
const { Document, Packer, AlignmentType, Paragraph, TextRun, PageBreak } = require('docx');
const S = require('./styles');
const { cover, toc } = require('./cover');
const { H, P, B, NOTE, SOURCE, REF, HL, table, tableCaption, figureCaption, runs } = S;
const C = AlignmentType.CENTER, L = AlignmentType.LEFT, R = AlignmentType.RIGHT;

const D = JSON.parse(fs.readFileSync(path.join(__dirname, 'report_data.json'), 'utf8'));
const OUT = process.argv[2] || '건강생활요인_경제적불리_역전점_보고서.docx';
const RUNNING = '스포츠융합산업프로젝트실습 연구보고서  |  건강 생활요인과 경제적 불리함';
const SRC = '자료: 질병관리청 지역사회건강조사 2025 원시자료, 연구진 분석';

// ── 수치 형식 ─────────────────────────────────────────
const MINUS = '−';
const num = (x, d = 1) => (x < 0 ? MINUS : '') + Math.abs(x).toFixed(d);
const sgn = (x, d = 1) => (x > 0 ? '+' : x < 0 ? MINUS : '') + Math.abs(x).toFixed(d);
const pct = (p, d = 1) => (p * 100).toFixed(d) + '%';
const n0 = (x) => Math.round(x).toLocaleString('en-US');
const pv = (p) => (p < 0.001 ? 'p < .001' : 'p = ' + p.toFixed(3).replace(/^0/, ''));
const ci = (e, lo, hi, d = 1) => `${sgn(e, d)}%p [${sgn(lo, d)}, ${sgn(hi, d)}]`;
const pci = (e, lo, hi, d = 1) => `${(e * 100).toFixed(d)}% [${(lo * 100).toFixed(d)}, ${(hi * 100).toFixed(d)}]`;
const orci = (o, lo, hi) => `${o.toFixed(2)} [${lo.toFixed(2)}, ${hi.toFixed(2)}]`;

// ── 데이터 조회 ───────────────────────────────────────
const IND = {
  income: { label: '균등화 소득', dis: '하위(1분위)', adv: '상위(5분위)', disT: '소득 하위 20%', advT: '소득 상위 20%' },
  livelihood: { label: '기초생활수급', dis: '현재 수급', adv: '비수급', disT: '기초생활수급자', advT: '비수급자' },
  food: { label: '가구 식품안정성', dis: '불안정', adv: '안정', disT: '식품 불안정 가구', advT: '식품 안정 가구' },
};
const KEYS = Object.keys(IND);
const BINS = ['0~2개', '3개', '4개', '5개', '6~7개'];
const cell = (k, g, b) => D.cells.find((r) => r.indicator === k && r.group === g && r.bin === b);
const rev = (k, b, comp) => D.reversal.find((r) => r.indicator === k && r.dis_bin === b && r.compare_to === comp);
const inter = (k) => D.interaction.find((r) => r.indicator === k);
const dec = (k, m = '연령 표준화 분포') => D.decomposition.find((r) => r.indicator === k && r.method === m);
const sens = (spec, sub = '전체', k = 'income') => D.sensitivity.find((r) => r.spec === spec && r.subgroup === sub && r.indicator === k);
const rate = (k, g, f) => D.factor_rates.find((r) => r.indicator === k && r.group === g && r.factor === f);
const s1std = (k, g, e) => D.s1_std.find((r) => r.indicator === k && r.group === g && r.ex === e);
const s1step = (k, g, st) => D.s1_steps.find((r) => r.indicator === k && r.group === g && r.step === st);
const s1slope = (k) => D.s1_slope.find((r) => r.indicator === k);
const s2 = (k, c, g, model = '상호 조정') => D.s2.find((r) => r.indicator === k && r.component === c && r.group === g && r.model === model);
const prevE = (lab, lv) => D.prev_by_econ.find((r) => r.indicator === lab && r.level === lv);
const t1 = (v, lv) => D.table1.find((r) => r.var === v && (lv === undefined || r.level === lv));
const adjP = (k, g, b) => pct(cell(k, g, b).adj_prev);
const revTxt = (r) => ci(r.diff_pp, r.low_pp, r.high_pp);
const DIFF = '차이(불리−유리)';

// ── 표·그림 번호(본문에서 먼저 참조하므로 순서를 미리 정함) ──
const TABS = ['vars', 'factors', 't1', 'cells', 'revinc', 'summary', 'dec', 'sens', 's1', 's2', 'appRev', 'appS1', 'strobe'];
const FIGS = ['flow', 'prev', 'life', 'lines', 'heat', 'dec', 'sens', 's1', 's1nb', 'c9', 's2'];
const tn = (k) => `[표 ${TABS.indexOf(k) + 1}]`;
const fn = (k) => `[그림 ${FIGS.indexOf(k) + 1}]`;
const usedT = [], usedF = [];
const tcap = (k, title) => { usedT.push(k); return tableCaption(title); };
const fig = (k, file, title, w = 165) => { usedF.push(k); return [S.figure(fs.readFileSync(path.join(__dirname, 'figures', file)), w), figureCaption(title)]; };
const W = S.CONTENT_WIDTH;

// 핵심 수치 미리 뽑기
const I = Object.fromEntries(KEYS.map((k) => [k, inter(k)]));
const inc = IND.income;
const r1inc = I.income.reversal_1, r2inc = I.income.reversal_2;
const sameTop = (k) => rev(k, '6~7개', '유리 집단 같은 단계');
const first1 = (k) => rev(k, I[k].reversal_1, '유리 집단 0~2개');
const first2 = (k) => (I[k].reversal_2 === '없음' ? null : rev(k, I[k].reversal_2, '유리 집단 전체 평균'));
const decI = dec('income'), decIc = dec('income', '조율 분포');
const s1tot = (k) => (k === 'income' ? '0개→3개' : '0개→2~3개');
const sensAdj = sens('① +식품안정성·수급 조정'), sensBeh = sens('② 행동 요인 4개만');
const walkDis = s2('income', 'walk_ok', inc.dis), walkAdv = s2('income', 'walk_ok', inc.adv), walkD = s2('income', 'walk_ok', DIFF);
const aerDis = s2('income', 'aerobic_ok', inc.dis), aerAdv = s2('income', 'aerobic_ok', inc.adv), aerD = s2('income', 'aerobic_ok', DIFF);
const strDis = s2('income', 'strength_ok', inc.dis), strAdv = s2('income', 'strength_ok', inc.adv), strD = s2('income', 'strength_ok', DIFF);
const cnt = (k, g) => rate(k, g, 'count7_mean');
const miss = KEYS.map((k) => (1 - I[k].n_model / D.n.analysis) * 100);
const missRange = `${Math.min(...miss).toFixed(1)}~${Math.max(...miss).toFixed(1)}%`;

// ── 표지 ─────────────────────────────────────────────
const COVER = {
  kicker: 'S01418201 스포츠융합산업프로젝트실습 · 연구보고서',
  title: '건강 생활요인은 경제적 불리함을 상쇄하는가',
  subtitle: '2025 지역사회건강조사로 본 생활요인 축적과 우울 증상 격차의 역전점, 그리고 운동 요인의 추가 효과',
  info: [
    ['과 목', 'S01418201 스포츠융합산업프로젝트실습'],
    ['담당교수', '박성희 교수 외 팀티칭'],
    ['자 료', '2025 지역사회건강조사 원시자료 (질병관리청)'],
    ['팀 원', [HL('[팀원 이름·학번 기재]')]],
  ],
  date: '2026. 10.',
  team: '한국외국어대학교',
  mark: fs.readFileSync(path.join(__dirname, 'assets', 'hufs_watermark.png')),
};

const body = [];
const add = (...xs) => xs.flat().forEach((x) => body.push(x));
const PB = () => new Paragraph({ children: [new PageBreak()] });

// ── 요약 ─────────────────────────────────────────────
add(H(1, '요약'));
add(B('**연구 질문**: 경제적으로 불리한 사람이 건강 생활요인을 많이 지키면, 생활요인을 적게 지키는 경제적으로 유리한 사람보다 우울 증상 비율이 낮아지는 지점(역전점)이 있는가? 그리고 운동은 다른 생활습관 위에 추가로 도움이 되는가?'));
add(B(`**자료·방법**: 2025 지역사회건강조사 성인 ${n0(D.n.analysis)}명. 우울 증상은 PHQ-9 10점 이상. 경제 불리 지표 3종(균등화 소득 하위 20%, 기초생활수급, 가구 식품 불안정)과 건강 생활요인 7개(신체활동 권고 충족, 친구와 주 1회 이상 연락, 이웃 신뢰, 비흡연, 고위험음주 아님, 아침식사 주 5회 이상, 동네 안전 인식)의 충족 개수를 교차해, 가중치·층·집락을 반영한 로지스틱 회귀로 조정 유병률을 추정함`));
add(B('**주요 결과**'));
add(B(`소득 하위 20%의 조정 유병률은 생활요인 0~2개 ${adjP('income', inc.dis, '0~2개')}에서 6~7개 ${adjP('income', inc.dis, '6~7개')}로 낮아져, 소득 상위 20%의 감소 폭(${adjP('income', inc.adv, '0~2개')} → ${adjP('income', inc.adv, '6~7개')})보다 컸음(감소 폭 차이 ${ci(I.income.additive_pp, I.income.additive_low, I.income.additive_high)})`, 1));
add(B(`역전점: 소득 하위 20%는 생활요인 **${r1inc}**부터 생활요인이 적은(0~2개) 소득 상위 20%보다 유의하게 낮았고, **${r2inc}**에서는 소득 상위 20% 전체 평균(${pct(I.income.adv_avg_prev)})보다도 낮았음. 6~7개에서 같은 단계의 소득 격차는 ${revTxt(sameTop('income'))}로 유의하지 않았음`, 1));
add(B(`기초생활수급·식품 불안정처럼 더 깊은 박탈에서는 역전점 ①만 나타나고(각각 ${I.livelihood.reversal_1}, ${I.food.reversal_1}), 생활요인을 모두 지켜도 같은 단계 격차가 남았음(${revTxt(sameTop('livelihood'))}, ${revTxt(sameTop('food'))})`, 1));
add(B(`격차 분해: 불리 집단이 유리 집단만큼 생활요인을 충족한다고 가정하면 소득 격차의 약 ${(decI.share_explained * 100).toFixed(0)}%(연령 표준화 기준)가 줄어듦 — 나머지는 생활요인 밖의 구조적 격차`, 1));
add(B(`운동 요인: 운동 외 생활요인 수준을 같게 맞춘 뒤에도 운동 요인(걷기·유산소·근력)을 0개에서 3개로 늘리면 소득 하위 20%의 유병률이 ${ci(s1step('income', inc.dis, '0개→3개').diff_pp, s1step('income', inc.dis, '0개→3개').low_pp, s1step('income', inc.dis, '0개→3개').high_pp)} 더 낮았음. 운동 종류 중 **걷기**가 소득 하위 집단에서 가장 큰 차이(${ci(walkDis.diff_pp, walkDis.low_pp, walkDis.high_pp)})를 보였고 이는 소득 상위 집단보다 유의하게 컸음`, 1));
add(B('**시사점**: 건강 생활요인, 특히 비용이 적게 드는 걷기는 경제적 불리 집단에서 우울 증상 격차를 줄이는 방향과 관련됨. 다만 깊은 박탈의 격차는 생활요인만으로 메워지지 않아 소득·식품 지원과 병행해야 하며, 횡단면 자료이므로 인과 효과는 중재연구로 확인해야 함'));

add(H(2, 'Abstract'));
add(P(`This study examined whether healthy lifestyle factors offset the excess burden of depressive symptoms associated with economic disadvantage among ${n0(D.n.analysis)} Korean adults in the 2025 Korea Community Health Survey. Depressive symptoms were defined as a PHQ-9 score of 10 or higher. Three disadvantage indicators (lowest equivalized income quintile, current basic livelihood security, household food insecurity) were crossed with the number of seven healthy lifestyle factors, and survey-weighted logistic regression yielded adjusted prevalences. Among low-income adults, prevalence fell from ${adjP('income', inc.dis, '0~2개')} with 0–2 factors to ${adjP('income', inc.dis, '6~7개')} with 6–7 factors, a steeper decline than among high-income adults (difference in declines ${sgn(I.income.additive_pp)} percentage points). Low-income adults with ${r1inc.replace('개', '')} or more factors had lower prevalence than high-income adults with 0–2 factors, and those with 6–7 factors were below the high-income average. For deeper deprivation (livelihood security, food insecurity), a gap remained even at the highest lifestyle level. Beyond non-exercise factors, each additional exercise component was associated with further reductions, and walking showed the largest benefit in the low-income group. The pattern is consistent with resource substitution but is cross-sectional and should not be interpreted causally.`));
add(P('**Keywords**: depressive symptoms, socioeconomic inequality, healthy lifestyle, resource substitution, walking, physical activity, Korea Community Health Survey'));
add(PB());

// ── Ⅰ. 서론 ──────────────────────────────────────────
add(H(1, '서론'));
add(H(2, '연구 배경'));
add(P(`우울 증상은 사회경제적 지위가 낮을수록 더 흔하다. 51개 유병률 연구를 종합한 메타분석에서 사회경제적 지위가 낮은 집단의 우울 위험은 높은 집단보다 약 1.8배 높았다(Lorant et al., 2003). 이 연구의 자료에서도 균등화 소득 하위 20% 집단의 가중 유병률은 ${pct(prevE('균등화 소득 5분위', '1분위(하)').prev_w)}로 상위 20%(${pct(prevE('균등화 소득 5분위', '5분위(상)').prev_w)})의 약 ${(prevE('균등화 소득 5분위', '1분위(하)').prev_w / prevE('균등화 소득 5분위', '5분위(상)').prev_w).toFixed(1)}배였고, 기초생활수급자(${pct(prevE('기초생활수급', '현재 수급').prev_w)})와 식품이 자주 부족한 가구(${pct(prevE('가구 식품안정성', '자주 부족').prev_w)})에서는 격차가 더 컸다.`));
add(P('한편 신체활동, 사회적 교류, 금연, 절주, 규칙적인 식사 같은 건강 생활요인은 우울 증상과 일관되게 관련된다. 영국 바이오뱅크 자료에서는 건강한 생활습관을 많이 지킬수록 우울증 위험이 단계적으로 낮았고(Zhao et al., 2023), 운동은 무작위 대조시험에서 우울 증상을 줄이는 중재로 확인되었다(Noetel et al., 2024). 그렇다면 경제적으로 불리한 사람에게 건강 생활요인은 어떤 의미를 가질까? 생활요인이 경제적 불리함과 관련된 추가 위험을 얼마나 상쇄할 수 있는지는 정책적으로 중요한 질문이다. 소득을 단기간에 바꾸기는 어렵지만, 걷기나 사회적 교류처럼 비용이 적게 드는 생활요인은 지역사회 프로그램으로 지원할 수 있기 때문이다.'));
add(H(2, '연구의 필요성'));
add(P('기존 연구는 대부분 사회경제적 지위와 생활요인을 각각의 위험요인으로 보고 서로를 통제변수로 다루었다. 그러나 두 요인이 결합될 때의 모습, 즉 "경제적으로 불리하지만 생활습관이 좋은 사람"과 "경제적으로 유리하지만 생활습관이 나쁜 사람" 중 누가 더 우울 증상이 많은지를 직접 비교한 연구는 드물다. 사망과 심혈관질환에 대해서는 이런 결합 분석이 보고되었으나(Zhang et al., 2021), 한국 성인의 우울 증상에 대해 대규모 조사 자료로 확인한 연구는 찾기 어렵다. 또한 신체활동을 하나의 묶음으로만 다루면 걷기, 유산소 활동, 근력운동 중 무엇이 불리 집단에 특히 도움이 되는지 알 수 없다. 스포츠·운동 프로그램을 설계하려면 이 구분이 필요하다.'));
add(H(2, '연구 질문과 가설'));
add(P('이 연구는 다음 질문에 답하고자 하였다. 가설 H1~H4는 경제 불리 지표 3종 각각에 대해 검토하며, 주 지표는 균등화 소득이다.'));
add(B('**H1 (격차)**: 경제적 불리 집단의 우울 증상 조정 유병률은 유리 집단보다 높다.'));
add(B('**H2 (기울기)**: 충족한 건강 생활요인이 많을수록 두 집단 모두 조정 유병률이 낮다.'));
add(B('**H3 (자원 대체)**: 생활요인 충족에 따른 유병률 감소 폭(가법 척도)은 불리 집단에서 더 크다.'));
add(B('**H4 (역전)**: 생활요인을 많이 충족한 불리 집단의 유병률은 생활요인을 적게 충족한 유리 집단보다 낮다. 나아가 유리 집단 전체 평균보다도 낮은 지점이 있는지 확인한다.'));
add(B('**RQ5 (격차 분해)**: 경제적 격차 가운데 두 집단의 생활요인 분포 차이에 해당하는 몫은 얼마인가?'));
add(B('**RQ6 (운동 요인 누적, S1)**: 운동 외 생활요인 수준이 같을 때, 운동 요인(걷기·중강도 이상 유산소·근력운동)을 하나씩 더하면 유병률이 추가로 낮아지는가? 그 추가 감소는 불리 집단에서 더 큰가?'));
add(B('**RQ7 (운동 종류, S2)**: 세 운동 가운데 불리 집단에서 유병률 차이가 가장 큰 것은 무엇인가?'));

// ── Ⅱ. 이론적 배경 ────────────────────────────────────
add(H(1, '이론적 배경'));
add(H(2, '사회경제적 지위와 우울'));
add(P('사회경제적 지위와 우울의 관계는 여러 나라와 측정 방식에서 반복 확인되었다. Lorant 등(2003)의 메타분석에서 낮은 사회경제적 지위와 우울의 관련은 새로 발생하는 우울(OR 1.24)보다 지속되는 우울(OR 2.06)에서 더 강했고, 소득과 교육에서 용량-반응 관계가 관찰되었다. 근본 원인 이론(Link & Phelan, 1995)은 사회경제적 지위가 돈, 지식, 권력, 사회적 관계 같은 자원에 대한 접근을 통해 여러 경로로 건강에 영향을 주기 때문에, 특정 위험요인 하나를 바꾸어도 격차가 다른 경로로 다시 나타난다고 설명한다. 식품 불안정은 소득과 구분되는 박탈 지표로, 메타분석에서 우울 위험 증가와 관련되었다(Pourmotabbed et al., 2020).'));
add(H(2, '건강 생활요인과 우울'));
add(P('신체활동은 우울 발생 위험 감소와 관련되며, 이 관련은 연령과 지역에 관계없이 나타났다(Schuch et al., 2018). 신체활동량과 우울 위험의 관계는 곡선형으로, 활동이 전혀 없는 상태에서 조금 늘릴 때 위험 감소가 가장 컸다(Pearce et al., 2022). 사회적 관계망과 교류는 정서적 지지와 소속감을 통해 정신건강과 관련되고(Berkman et al., 2000), 한국 노인에서도 사회적 관계망과 동네 만족도가 우울 증상과 관련되었다(Lee et al., 2025). 흡연, 고위험음주, 결식 같은 건강행태도 우울과 함께 나타나는 경우가 많다. Zhao 등(2023)은 신체활동, 사회적 교류, 흡연, 음주, 식사, 수면, 좌식행동 7개 요인의 개수가 많을수록 우울 위험이 낮아짐을 보였다. 이 연구는 이 접근을 따라 생활요인을 개수로 묶되, 지역사회건강조사 문항으로 측정할 수 있는 7개 요인을 사용하였다.'));
add(H(2, '자원 대체 가설과 자원 증폭 가설'));
add(P('경제적 자원과 다른 건강 자원이 함께 작용하는 방식에 대해서는 두 가지 가설이 있다(Ross & Mirowsky, 2006). **자원 대체 가설**은 한 가지 자원이 부족한 사람일수록 다른 자원에 더 의존하므로, 다른 자원의 효과가 불리 집단에서 더 크다고 본다. 반대로 **자원 증폭 가설**은 이미 자원이 많은 사람이 추가 자원으로부터 더 큰 이득을 얻어 격차가 벌어진다고 본다. Ross와 Mirowsky(2006)는 교육이 여성의 우울을 남성보다 더 크게 낮춘다는 결과로 자원 대체 가설을 지지하였다. 이 연구는 이 틀을 경제적 자원과 건강 생활요인에 적용한다. 생활요인 충족에 따른 유병률 감소가 불리 집단에서 더 크다면 자원 대체와, 유리 집단에서 더 크다면 자원 증폭과 일치한다.'));
add(P('두 가설의 판단은 효과를 재는 척도에 따라 달라질 수 있다. 기저 유병률이 높은 불리 집단에서는 같은 오즈비라도 절대 감소 폭(%p)이 더 크게 나타나기 때문이다. 공중보건 관점에서 "몇 명의 우울 증상을 줄일 수 있는가"는 가법 척도가 직접 답하므로, 이 연구는 가법 척도(유병률 차이)를 주로 보고 승법 척도(오즈비)를 함께 보고하였다(VanderWeele & Knol, 2014).'));
add(H(2, '생활습관과 사회경제적 지위의 결합 연구'));
add(P('Zhang 등(2021)은 미국 NHANES와 영국 바이오뱅크 자료에서 사회경제적 지위와 생활습관을 결합해 사망·심혈관질환 위험을 비교하였다. 사회경제적 지위가 낮고 생활습관이 가장 나쁜 집단의 위험이 가장 높았고, 건강한 생활습관은 모든 사회경제적 집단에서 낮은 위험과 관련되었다. 그러나 생활습관이 설명하는 사회경제적 격차는 일부에 그쳤다. 이 결과는 생활습관 개선이 격차를 줄이는 데 의미가 있지만 구조적 격차를 대체하지는 못한다는 점을 보여 준다. 이 연구는 같은 결합 설계를 우울 증상에 적용하고, 나아가 불리 집단의 선이 유리 집단의 기준선 아래로 내려가는 "역전점"을 명시적으로 정의해 검토한다.'));
add(H(2, '운동의 종류·양과 우울'));
add(P('운동 종류별로 보면 걷기와 조깅, 요가, 근력운동이 우울 증상 감소에 효과적이었고(Noetel et al., 2024), 근력운동만 따로 모은 메타분석에서도 우울 증상이 중간 크기로 감소하였다(Gordon et al., 2018). 세계보건기구는 성인에게 주 150~300분의 중강도 유산소 신체활동과 주 2일 이상의 근력운동을 권고한다(World Health Organization, 2020). 다만 업무 중 신체활동은 여가 신체활동과 같은 건강 효과를 주지 않을 수 있다는 "신체활동 역설"이 보고되어 있다(Holtermann et al., 2018). 지역사회건강조사의 신체활동 문항은 일과 여가를 구분하지 않으므로, 육체노동 비중이 높은 저소득 집단에서는 유산소 활동의 의미가 다를 수 있다. 이 점은 S2의 해석에서 함께 고려한다.'));

// ── Ⅲ. 연구 방법 ──────────────────────────────────────
add(H(1, '연구 방법'));
add(H(2, '자료와 연구 대상'));
add(P(`2025년 지역사회건강조사 원시자료를 이용한 횡단면 연구이다. 지역사회건강조사는 질병관리청이 전국 시·군·구 단위로 만 19세 이상 성인을 표본 추출해 조사원이 직접 면접하는 조사로, 층화 집락 표본 설계와 가중치를 제공한다(질병관리청, 2025). 원시자료 ${n0(D.n.raw)}명 중 PHQ-9 9문항에 모두 응답해 결과변수를 산출할 수 있는 ${n0(D.n.analysis)}명을 분석 대상으로 하였다. 각 모형은 해당 경제 지표, 생활요인 7개, 조정변수가 모두 있는 사람을 사용하였다(${fn('flow')}). 결측으로 빠진 비율은 지표별 ${missRange}였다.`));
add(fig('flow', 'fig_v3_01_flow.png', '연구 대상 선정 흐름', 120));
add(H(2, '변수'));
add(H(3, '결과변수: 우울 증상'));
add(P('PHQ-9(Kroenke et al., 2001) 9문항 총점(0~27점)이 10점 이상이면 우울 증상 기준 충족(1), 미만이면 0으로 정의하였다. 9문항 중 하나라도 무응답이면 결측으로 처리하였다.'));
add(H(3, '경제 불리 지표'));
add(P(`경제적 불리함은 한 가지 지표로 다 잡히지 않으므로 성격이 다른 세 지표를 사용하였다(${tn('vars')}). 균등화 소득은 가구 소득을 가구원 수의 제곱근으로 나눈 값을 가중 5분위로 나누어, 1분위(하위 20%)를 불리 집단, 5분위(상위 20%)를 유리 집단으로 비교하였다. 2~4분위는 모형에 포함하되 그림에서 회색 선으로만 보였다. 기초생활수급은 현재 수급을 불리 집단으로, 과거 수급과 비수급을 유리 집단으로 묶었다. 가구 식품안정성은 "가끔" 또는 "자주" 먹을 것이 부족했던 가구를 불리 집단으로 보았다. 주 지표는 표본이 크고 해석이 직관적인 균등화 소득으로 미리 정하였다.`));
add(tcap('vars', '경제 불리 지표의 정의'));
add(table(['지표', '불리 집단', '유리 집단(비교 기준)', '성격'], [
  ['균등화 소득', '가중 5분위 중 1분위(하위 20%)', '5분위(상위 20%) · 2~4분위는 별도 범주', '상대적 소득 수준'],
  ['기초생활수급', '현재 수급', '비수급(과거 수급 포함)', '제도적으로 확인된 빈곤'],
  ['가구 식품안정성', '가끔 또는 자주 먹을 것이 부족', '충분(다양 또는 단조)', '기본 욕구의 박탈'],
], [1700, 2600, 3200, 2138]));
add(SOURCE('주: 균등화 소득 = 가구 월소득 ÷ √가구원 수. 분위는 조사 가중치를 반영해 나눔.'));
add(H(3, '건강 생활요인과 운동 요인'));
add(P(`건강 생활요인은 지역사회건강조사의 공식 지표 정의를 따라 7개를 이분화하고, 충족한 개수(0~7개)를 셌다(${tn('factors')}). 칸 크기를 확보하기 위해 개수를 0~2개, 3개, 4개, 5개, 6~7개의 5단계로 묶었다. 신체활동 권고 충족은 세계보건기구 권고(World Health Organization, 2020)에 맞추어 "걷기 실천 또는 중강도 이상 신체활동 실천" 그리고 "근력운동 주 2일 이상"을 모두 만족하는 경우로 정의하였다. 운동 요인 분석(S1·S2)에서는 이 묶음을 걷기 실천, 중강도 이상 유산소 실천, 근력운동 주 2일 이상의 세 구성요소로 나누어 사용하였다.`));
add(tcap('factors', '건강 생활요인 7개와 운동 요인 3개의 정의'));
add(table(['구분', '요인', '충족 기준(원시자료 문항)'], [
  ['생활요인 7개', '신체활동 권고 충족', '(걷기 실천 또는 중강도 이상 실천) 그리고 근력운동 주 2일 이상'],
  ['', '친구와 주 1회 이상 연락', '친구와 연락(만남·전화·문자 등) 빈도 주 1회 이상'],
  ['', '이웃을 신뢰함', '"동네 사람들을 믿을 수 있다"에 그렇다'],
  ['', '비흡연', '현재 흡연 아님(공식 지표 sm_a0100)'],
  ['', '고위험음주 아님', '고위험음주 기준 미해당(공식 지표 dr_a0500)'],
  ['', '아침식사 주 5회 이상', '최근 1년 아침식사 주 5~7회'],
  ['', '동네 안전 인식', '"동네가 전반적으로 안전하다"에 그렇다'],
  ['운동 요인 3개 (S1·S2)', '걷기 실천', '최근 1주 1회 10분 이상, 1일 30분 이상 걷기를 주 5일 이상'],
  ['', '중강도 이상 유산소 실천', '고강도 주 3일·20분 이상 또는 중강도 주 5일·30분 이상(공식 지표 ph_a0500)'],
  ['', '근력운동 주 2일 이상', '최근 1주 근력운동 2일 이상'],
], [2000, 2400, 5238]));
add(SOURCE('주: S1의 "운동 외 생활요인"은 신체활동 권고를 뺀 나머지 6개. 지표 정의는 질병관리청(2025) 이용지침서를 따름.'));
add(H(3, '조정변수'));
add(P('인구학적 특성(연령 7구간, 성별, 교육수준, 혼인상태, 세대유형)과 신체건강(BMI, 인지 체형, 고혈압, 당뇨병, 골다공증, 주관적 구강건강, 저작불편, 낙상, 사고·중독 경험)을 조정하였다. 경제 지표를 서로 비교하는 분석이므로 다른 경제 변수는 주 분석에서 조정하지 않았고, 민감도 분석에서 추가 조정하였다. 생활요인과 개념이 겹치는 심리·증상 근접 변수(스트레스, 수면 등)는 결과의 일부일 수 있어 조정하지 않았다.'));
add(H(2, '통계 분석'));
add(H(3, '조사설계를 반영한 교차 범주 모형'));
add(P(`모든 추정에 가중치(wt_p), 층(kstrata), 집락(조사구)을 반영하였다. 로지스틱 회귀는 가중 최대우도로 적합하고, 분산은 테일러 선형화로 추정하였으며 설계 자유도 ${n0(D.n.design_df)}를 사용하였다(Lumley, 2004). 주 모형은 경제 집단과 생활요인 단계를 교차한 범주(예: 소득 3집단 × 5단계 = 15칸)를 지시변수로 넣은 모형이다. 각 칸의 조정 유병률은 분석 대상 전체의 조정변수 분포를 유지한 채 모든 사람을 해당 칸에 배정했을 때의 가중 평균 예측확률(예측 주변값)이며, 95% 신뢰구간은 델타법으로 구하였다.`));
add(H(3, '역전점의 정의'));
add(P('불리 집단의 생활요인 단계별 조정 유병률을 세 가지 기준과 비교하였다. ① 유리 집단 중 생활요인 0~2개, ② 유리 집단 전체 평균(유리 집단의 실제 생활요인 분포로 각 단계의 조정 유병률을 가중 평균), ③ 유리 집단의 같은 단계이다. 차이(불리 − 기준)의 95% 신뢰구간 상한이 0보다 작은 가장 낮은 단계를 "역전점"으로 정의하였다. ③은 역전이 아니라 "같은 노력을 할 때 격차가 남는가"를 본다.'));
add(H(3, '상호작용'));
add(P('가법 상호작용은 생활요인 0~2개에서 6~7개로 갈 때의 유병률 변화가 불리·유리 집단 간에 다른지를 "차이의 차이"로 추정하였다. 두 변화가 모두 음수이므로, 값이 음수이면 불리 집단의 감소 폭이 더 크다는 뜻이다. 승법 상호작용은 주효과와 곱항으로 모수화한 모형에서 경제 × 생활요인 단계 곱항의 결합 Wald 검정(설계 기반 F)으로 검정하였다. 보조로 생활요인 개수를 연속형으로 넣어 1개당 오즈비를 집단별로 구하였다.'));
add(H(3, '격차 분해'));
add(P('불리 집단의 단계별 조정 유병률을 유리 집단의 생활요인 분포로 가중 평균한 반사실 유병률을 구하고, 실제 격차 가운데 이 반사실에서 줄어드는 몫을 "생활요인 분포 차이의 몫"으로 정의하였다. 소득 하위 집단은 고령층 비중이 커서 연령 구성이 생활요인 분포에 섞이므로, 두 집단의 생활요인 분포를 전체 대상자의 연령 분포로 직접 표준화한 결과를 주 결과로, 조율 분포 결과를 보조로 제시하였다.'));
add(H(3, '민감도 분석'));
add(P('① 소득 분석에 식품안정성과 기초생활수급을 추가 조정, ② 사회·환경 인식 요인(친구 연락, 이웃 신뢰, 동네 안전)은 우울 증상 자체의 영향을 받을 수 있으므로 행동 요인 4개(신체활동 권고, 비흡연, 고위험음주 아님, 아침식사)만 센 개수로 재분석, ③ 성별과 연령대(19~39세, 40~64세, 65세 이상)별 층화 분석(칸 크기 때문에 생활요인 단계를 0~3, 4, 5, 6~7개로 묶음), ④ 소득 비교 기준을 1분위 대 2~5분위로 변경하였다.'));
add(H(3, '운동 요인 분석(S1·S2)'));
add(P('S1에서는 경제 집단 × 운동 외 생활요인 단계(0~2, 3, 4, 5~6개) × 운동 요인 개수(0~3개)의 교차 범주 모형을 적합하고, 운동 외 단계를 전체 대상자 분포로 표준화한 운동 개수별 조정 유병률을 구하였다. 이렇게 하면 "다른 생활습관이 같은 사람끼리 비교할 때 운동을 하나 더 하는 것"의 차이를 볼 수 있다. 운동 요인을 하나씩 더할 때의 변화와 0개 대비 최대 개수의 변화, 그리고 그 변화의 불리 − 유리 차이를 델타법으로 추정하였다. 기초생활수급과 식품안정성은 불리 집단이 작아 운동 외 단계를 0~4, 5~6개로, 운동 개수를 0, 1, 2~3개로 묶었다. S2에서는 세 운동을 한 모형에 서로 조정해 넣고 각각에 경제 집단과의 곱항을 두어, 집단별 실천 대 미실천 유병률 차이와 그 차이의 차를 추정하였다(운동 외 생활요인 단계와 조정변수 포함). 각 운동만 넣은 단독 모형도 함께 적합하였다.'));
add(P('분석은 Python 3.11로 수행하였고, 조사설계 로지스틱 회귀와 예측 주변값은 연구진이 구현한 코드로 계산하였다. 모든 결과는 집계값이며 개인 단위 정보는 보고하지 않았다. 다중 비교(3개 지표 × 5단계 × 3기준)가 많아 신뢰구간 끝이 0에 가까운 결과는 보수적으로 해석하였다.'));
add(H(2, '연구 윤리'));
body.push(new Paragraph({ children: [...runs('질병관리청 원시자료 이용 절차에 따라 자료를 제공받았으며, 개인을 식별할 수 없는 자료만 사용하였다. 원시자료와 개인 단위 결과는 외부에 공유하지 않았다. '), HL('[생명윤리위원회 심의 면제 여부·승인번호 기재]')] }));

// ── Ⅳ. 연구 결과 ──────────────────────────────────────
add(H(1, '연구 결과'));
add(H(2, '표본 특성'));
add(P(`분석 대상 ${n0(D.n.analysis)}명의 우울 증상 가중 유병률은 ${pct(D.n.prev_w, 2)}였다. 소득 하위 20%는 가중 평균 연령이 ${Number(t1('연령')[inc.dis]).toFixed(1)}세로 상위 20%(${Number(t1('연령')['상위(5분위)']).toFixed(1)}세)보다 많았고, 1인 가구와 사별, 기초생활수급, 식품 부족 비율이 높았다(${tn('t1')}).`));
add(tcap('t1', '균등화 소득 집단별 표본 특성(가중 %)'));
const T1ROWS = [['n(비가중)', ''], ['우울 증상(PHQ-9≥10)', '가중 %'], ['연령', '가중 평균(세)'], ['성별', '여'],
  ['연령', '19-29세'], ['연령', '30대'], ['연령', '40대'], ['연령', '50대'], ['연령', '60대'], ['연령', '70대'], ['연령', '80세+'],
  ['교육수준', '초졸'], ['교육수준', '무학'], ['교육수준', '대졸+'], ['혼인상태', '배우자 동거'], ['혼인상태', '사별'], ['세대유형', '1인'],
  ['기초생활수급', '현재 수급'], ['식품안정성', '가끔 부족'], ['식품안정성', '자주 부족'], ['직업', '비경제활동'], ['고혈압', '예'], ['당뇨병', '예'], ['동/읍면', '읍·면']];
add(table(['변수', '수준', '전체', '소득 하위 20%', '중위(2~4분위)', '소득 상위 20%'],
  T1ROWS.map(([v, lv]) => {
    const row = D.table1.find((r) => r.var === v && (r.level === lv || (lv === '' && (r.level === null || r.level === ''))));
    const vals = ['전체', inc.dis, '중위(2~4분위)', inc.adv].map((c) => (v === 'n(비가중)' ? n0(row[c]) : Number(row[c]).toFixed(1)));
    return [v, lv, ...vals];
  }), [1900, 1800, 1400, 1550, 1450, 1538], { align: [L, L, R, R, R, R], size: 18 }));
add(SOURCE(SRC + '. 주: 비율은 조사 가중치를 반영한 열 %. 일부 수준만 제시.'));

add(H(2, '경제 집단별 우울 증상과 생활요인 분포'));
add(P(`비조정 가중 유병률은 소득 5분위가 높아질수록 단조롭게 낮아졌고(${prevE('균등화 소득 5분위', '1분위(하)').prev_w > prevE('균등화 소득 5분위', '2분위').prev_w ? '1분위 ' + pct(prevE('균등화 소득 5분위', '1분위(하)').prev_w) + ' → 5분위 ' + pct(prevE('균등화 소득 5분위', '5분위(상)').prev_w) : ''}), 기초생활수급자는 비수급자의 약 ${(prevE('기초생활수급', '현재 수급').prev_w / prevE('기초생활수급', '아님').prev_w).toFixed(1)}배, 식품이 자주 부족한 가구는 충분·다양한 가구의 약 ${(prevE('가구 식품안정성', '자주 부족').prev_w / prevE('가구 식품안정성', '충분·다양').prev_w).toFixed(0)}배였다(${fn('prev')}).`));
add(fig('prev', 'fig_v3_02_prev_by_econ.png', '경제 지표별 우울 증상 가중 유병률(비조정)'));
add(P(`생활요인 충족 현황은 연령 구성의 영향을 크게 받았다(${fn('life')}). 소득 하위 20%는 고령층이 많아 비흡연, 고위험음주 아님, 아침식사의 조율이 높았고, 그 결과 생활요인 개수의 조율 평균(${cnt('income', inc.dis).crude.toFixed(2)}개)이 상위 20%(${cnt('income', inc.adv).crude.toFixed(2)}개)와 비슷하였다. 그러나 연령을 표준화하면 하위 20%의 평균은 ${cnt('income', inc.dis).age_std.toFixed(2)}개로 상위 20%(${cnt('income', inc.adv).age_std.toFixed(2)}개)보다 적었다. 특히 신체활동 권고 충족(연령 표준화 ${pct(rate('income', inc.dis, 'pa_guideline').age_std)} 대 ${pct(rate('income', inc.adv, 'pa_guideline').age_std)}), 근력운동(${pct(rate('income', inc.dis, 'strength_ok').age_std)} 대 ${pct(rate('income', inc.adv, 'strength_ok').age_std)}), 이웃 신뢰, 비흡연에서 격차가 뚜렷하였다. 기초생활수급자와 식품 불안정 가구는 연령을 표준화하지 않아도 생활요인 0~2개 비율이 비수급·식품 안정 가구의 약 2배였다.`));
add(fig('life', 'fig_v3_03_lifestyle_by_econ.png', '경제 집단별 건강 생활요인 충족률과 개수 분포'));

add(H(2, '생활요인 단계별 조정 유병률과 역전점'));
add(P(`세 지표 모두에서 생활요인을 많이 충족할수록 조정 유병률이 단계적으로 낮아졌고(H2 지지), 모든 단계에서 불리 집단의 유병률이 유리 집단보다 높거나 비슷하였다(H1 지지)(${tn('cells')}, ${fn('lines')}). 소득 하위 20%의 조정 유병률은 0~2개 ${pci(cell('income', inc.dis, '0~2개').adj_prev, cell('income', inc.dis, '0~2개').low, cell('income', inc.dis, '0~2개').high)}에서 6~7개 ${pci(cell('income', inc.dis, '6~7개').adj_prev, cell('income', inc.dis, '6~7개').low, cell('income', inc.dis, '6~7개').high)}로 낮아졌고, 소득 상위 20%는 ${adjP('income', inc.adv, '0~2개')}에서 ${adjP('income', inc.adv, '6~7개')}로 낮아졌다.`));
add(tcap('cells', '경제 집단 × 생활요인 단계별 조정 유병률(%, 95% CI)'));
const cellRows = [];
KEYS.forEach((k) => {
  const groups = [...new Set(D.cells.filter((r) => r.indicator === k).map((r) => r.group))];
  groups.forEach((g, gi) => cellRows.push([gi === 0 ? IND[k].label : '', g, ...BINS.map((b) => {
    const c = cell(k, g, b);
    return `${(c.adj_prev * 100).toFixed(1)}\n[${(c.low * 100).toFixed(1)}, ${(c.high * 100).toFixed(1)}]`;
  })]));
});
add(table(['지표', '집단', ...BINS], cellRows, [1500, 1600, 1300, 1300, 1300, 1300, 1338], { align: [L, L, C, C, C, C, C], size: 17 }));
add(SOURCE(SRC + '. 주: 인구·신체건강 조정 예측 주변값. 칸별 비가중 n은 부록 참조(모든 칸 n ≥ 500).'));
add(fig('lines', 'fig_v3_04_reversal_lines.png', '경제 집단별 생활요인 개수에 따른 조정 유병률과 역전 기준선'));
add(P(`역전점을 보면(${tn('revinc')}), 소득 하위 20%는 생활요인 ${r1inc}부터 생활요인 0~2개인 소득 상위 20%보다 유의하게 낮았다(${revTxt(first1('income'))}). 6~7개에서는 소득 상위 20% 전체 평균(${pct(I.income.adv_avg_prev)})보다도 ${revTxt(first2('income'))} 낮아, 두 번째 역전 기준도 충족하였다(H4 지지). 같은 단계끼리 비교하면 0~2개에서 ${revTxt(rev('income', '0~2개', '유리 집단 같은 단계'))}였던 소득 격차가 6~7개에서는 ${revTxt(sameTop('income'))}로 줄어 통계적으로 구분되지 않았다.`));
add(tcap('revinc', '소득 하위 20%의 생활요인 단계별 비교(조정 유병률 차이, %p, 95% CI)'));
add(table(['소득 하위 20%의 단계', '① vs 상위 20% · 0~2개', '② vs 상위 20% 전체 평균', '③ vs 상위 20% 같은 단계'],
  BINS.map((b) => [b, ...['유리 집단 0~2개', '유리 집단 전체 평균', '유리 집단 같은 단계'].map((cp) => {
    const r = rev('income', b, cp);
    return r.significantly_lower ? `**${revTxt(r)}**` : revTxt(r);
  })]), [2000, 2546, 2546, 2546], { align: [C, C, C, C], size: 18 }));
add(SOURCE('주: 굵은 글씨 = 95% CI 상한 < 0(유의하게 낮음). 음수 = 소득 하위 20%의 유병률이 더 낮음.'));
add(P(`기초생활수급과 식품안정성에서도 역전점 ①은 나타났다(각각 ${I.livelihood.reversal_1}, ${I.food.reversal_1}). 그러나 유리 집단 전체 평균보다 낮아지는 단계는 없었고, 생활요인을 6~7개 충족해도 같은 단계의 격차가 남았다(${tn('summary')}). 즉 소득 수준의 차이는 생활요인을 충분히 충족하면 통계적으로 구분되지 않을 만큼 좁혀졌지만, 기초생활수급이나 식품 불안정처럼 더 깊은 박탈은 생활요인만으로 메워지지 않았다.`));
add(fig('heat', 'fig_v3_05_reversal_heatmap.png', '경제 집단 × 생활요인 개수별 조정 유병률(히트맵)'));

add(H(2, '생활요인 효과의 집단 간 차이(상호작용)'));
add(P(`생활요인 0~2개에서 6~7개로 갈 때의 조정 유병률 감소 폭은 세 지표 모두 불리 집단에서 더 컸다(${tn('summary')}). 소득 하위 20%는 ${ci(I.income.drop_dis_pp, I.income.drop_dis_low, I.income.drop_dis_high)} 감소해 상위 20%(${ci(I.income.drop_adv_pp, I.income.drop_adv_low, I.income.drop_adv_high)})보다 ${ci(I.income.additive_pp, I.income.additive_low, I.income.additive_high)} 더 줄었다. 가법 척도에서 H3(자원 대체)를 지지하는 결과이다. 승법 척도에서도 소득은 상호작용이 유의하였고(${pv(I.income.mult_p)}), 생활요인 1개당 오즈비는 하위 20% ${orci(I.income.or_per_factor_dis, I.income.or_dis_low, I.income.or_dis_high)}, 상위 20% ${orci(I.income.or_per_factor_adv, I.income.or_adv_low, I.income.or_adv_high)}였다. 기초생활수급(${pv(I.livelihood.mult_p)})과 식품안정성(${pv(I.food.mult_p)})의 승법 상호작용은 경계 수준이었다.`));
add(tcap('summary', '경제 지표별 역전점과 상호작용 요약'));
add(table(['구분', IND.income.label, IND.livelihood.label, IND.food.label], [
  ['비교', `${inc.dis} vs ${inc.adv}`, `${IND.livelihood.dis} vs ${IND.livelihood.adv}`, `${IND.food.dis} vs ${IND.food.adv}`],
  ['모형 n', ...KEYS.map((k) => n0(I[k].n_model))],
  ['역전점 ① (vs 유리 0~2개)', ...KEYS.map((k) => `**${I[k].reversal_1}**\n${revTxt(first1(k))}`)],
  ['역전점 ② (vs 유리 전체 평균)', ...KEYS.map((k) => (first2(k) ? `**${I[k].reversal_2}**\n${revTxt(first2(k))}` : '없음'))],
  ['같은 단계 격차(6~7개)', ...KEYS.map((k) => revTxt(sameTop(k)))],
  ['0~2→6~7개 감소: 불리', ...KEYS.map((k) => ci(I[k].drop_dis_pp, I[k].drop_dis_low, I[k].drop_dis_high))],
  ['0~2→6~7개 감소: 유리', ...KEYS.map((k) => ci(I[k].drop_adv_pp, I[k].drop_adv_low, I[k].drop_adv_high))],
  ['가법 상호작용(차이의 차이)', ...KEYS.map((k) => `${ci(I[k].additive_pp, I[k].additive_low, I[k].additive_high)}\n${pv(I[k].additive_p)}`)],
  ['승법 상호작용(결합 Wald)', ...KEYS.map((k) => `F = ${I[k].mult_F.toFixed(2)}, ${pv(I[k].mult_p)}`)],
  ['생활요인 1개당 OR: 불리', ...KEYS.map((k) => orci(I[k].or_per_factor_dis, I[k].or_dis_low, I[k].or_dis_high))],
  ['생활요인 1개당 OR: 유리', ...KEYS.map((k) => orci(I[k].or_per_factor_adv, I[k].or_adv_low, I[k].or_adv_high))],
], [2500, 2380, 2380, 2378], { align: [L, C, C, C], size: 17 }));
add(SOURCE(SRC + '. 주: 차이의 단위는 %p(조정 유병률). 가법 상호작용이 음수 = 불리 집단에서 감소 폭이 더 큼.'));

add(H(2, '격차 분해'));
const dI = decI;
add(P(`불리 집단이 유리 집단과 같은 생활요인 분포를 가진다고 가정한 반사실 유병률을 구하였다(${tn('dec')}, ${fn('dec')}). 연령 표준화 분포 기준으로 소득 격차 ${ci(dI.gap_total * 100, dI.gap_total_low * 100, dI.gap_total_high * 100)} 가운데 ${(dI.share_explained * 100).toFixed(0)}% [${(dI.share_explained_low * 100).toFixed(0)}, ${(dI.share_explained_high * 100).toFixed(0)}]가 생활요인 분포 차이에 해당하였고, 기초생활수급은 ${(dec('livelihood').share_explained * 100).toFixed(0)}%, 식품안정성은 ${(dec('food').share_explained * 100).toFixed(0)}%였다. 연령을 표준화하지 않은 조율 분포로 계산하면 소득의 몫은 ${(decIc.share_explained * 100).toFixed(0)}%로, 오히려 하위 20%가 생활요인을 약간 더 충족하는 것으로 나타났다. 이는 고령층이 많은 소득 하위 집단의 연령 구성 때문이며, 같은 연령끼리 비교하면 하위 집단이 생활요인을 덜 충족한다는 뜻이다. 어느 방식이든 격차의 대부분(약 3분의 2 이상)은 생활요인 분포로 설명되지 않았다.`));
add(tcap('dec', '격차 분해: 불리 집단이 유리 집단의 생활요인 분포를 가진다면'));
add(table(['지표', '분포 기준', '유리 집단', '불리 집단(실제)', '불리 집단(반사실)', '분포 차이의 몫'],
  KEYS.flatMap((k) => ['연령 표준화 분포', '조율 분포'].map((m, mi) => {
    const r = dec(k, m);
    return [mi === 0 ? IND[k].label : '', m, pct(r.adv_actual), pct(r.dis_actual), pct(r.dis_counterfactual),
      `${(r.share_explained * 100).toFixed(0)}% [${(r.share_explained_low * 100).toFixed(0)}, ${(r.share_explained_high * 100).toFixed(0)}]`];
  })), [1600, 1700, 1400, 1600, 1638, 1700], { align: [L, L, R, R, R, C], size: 18 }));
add(SOURCE('주: 몫 = (실제 격차 − 반사실 격차) ÷ 실제 격차. 음수 = 불리 집단이 생활요인을 더 많이 충족(조율 기준).'));
add(fig('dec', 'fig_v3_06_decomposition.png', '격차 분해(연령 표준화 분포 기준)', 150));

add(H(2, '민감도 분석'));
const sv = (r) => `역전점 ① ${r.reversal_1}, ② ${r.reversal_2}, 가법 ${ci(r.additive_pp, r.additive_low, r.additive_high)}`;
add(P(`주 결과의 방향은 민감도 분석에서 대체로 유지되었다(${tn('sens')}, ${fn('sens')}). 식품안정성과 기초생활수급을 추가 조정하면 가법 상호작용은 ${ci(sensAdj.additive_pp, sensAdj.additive_low, sensAdj.additive_high)}로 약 절반이 되었지만 여전히 유의하였고, 역전점 ①은 ${sensAdj.reversal_1}로 오히려 앞당겨졌다. 사회·환경 인식 요인을 빼고 행동 요인 4개만 센 경우에도 역전점 ①(${sensBeh.reversal_1})과 가법 상호작용(${ci(sensBeh.additive_pp, sensBeh.additive_low, sensBeh.additive_high)})이 유지되어, 결과가 우울 증상의 영향을 받기 쉬운 인식 문항에만 의존하지 않음을 보여 준다. 다만 이 경우 역전점 ②는 나타나지 않았다. 층화 분석에서는 남녀와 40~64세에서 결과가 유지되었으나, 19~39세는 가법 상호작용의 신뢰구간이 0을 포함하였고, 65세 이상은 소득 상위 20%가 적어 역전점을 판정할 만큼 정밀하지 않았다.`));
add(tcap('sens', '민감도 분석 요약(균등화 소득 중심)'));
add(table(['분석', '하위집단', '지표', '모형 n', '역전점 ①', '역전점 ②', '가법 상호작용(%p, 95% CI)'],
  D.sensitivity.map((r) => [r.spec, r.subgroup, IND[r.indicator].label, n0(r.n_model), r.reversal_1, r.reversal_2, ci(r.additive_pp, r.additive_low, r.additive_high)]),
  [2200, 1050, 1250, 1050, 950, 950, 2188], { align: [L, L, L, R, C, C, C], size: 16 }));
add(SOURCE('주: ③ 층화는 생활요인 단계를 0~3, 4, 5, 6~7개로 묶어 역전점 ①의 기준이 "유리 집단 0~3개". ② 행동 요인은 0~1, 2, 3, 4개.'));
add(fig('sens', 'fig_v3_07_sensitivity.png', '민감도 분석: 가법 상호작용과 역전점(균등화 소득)', 150));

add(H(2, '운동 요인의 추가 효과(S1)'));
const st = (k, g, s) => s1step(k, g, s);
const sI = (g, e) => s1std('income', g, e);
add(P(`운동 외 생활요인 6개의 분포를 같게 맞춘 뒤 운동 요인 개수에 따른 조정 유병률을 비교하였다(${tn('s1')}, ${fn('s1')}). 소득 하위 20%의 유병률은 운동 0개 ${pct(sI(inc.dis, '0개').adj_prev)}, 1개 ${pct(sI(inc.dis, '1개').adj_prev)}, 2개 ${pct(sI(inc.dis, '2개').adj_prev)}, 3개 ${pct(sI(inc.dis, '3개').adj_prev)}였고, 상위 20%는 ${pct(sI(inc.adv, '0개').adj_prev)}, ${pct(sI(inc.adv, '1개').adj_prev)}, ${pct(sI(inc.adv, '2개').adj_prev)}, ${pct(sI(inc.adv, '3개').adj_prev)}였다. 즉 다른 생활습관이 같아도 운동 요인을 더 충족한 사람의 유병률이 낮았다(0개→3개: 하위 ${ci(st('income', inc.dis, '0개→3개').diff_pp, st('income', inc.dis, '0개→3개').low_pp, st('income', inc.dis, '0개→3개').high_pp)}, 상위 ${ci(st('income', inc.adv, '0개→3개').diff_pp, st('income', inc.adv, '0개→3개').low_pp, st('income', inc.adv, '0개→3개').high_pp)}).`));
add(P(`감소의 대부분은 운동을 전혀 하지 않다가 하나를 시작하는 단계(0개→1개)에서 나타났다(하위 ${ci(st('income', inc.dis, '0개→1개').diff_pp, st('income', inc.dis, '0개→1개').low_pp, st('income', inc.dis, '0개→1개').high_pp)}). 그 뒤 1개→2개, 2개→3개의 추가 변화는 작고 유의하지 않았다. 불리 집단의 추가 감소가 더 큰지(RQ6)를 보면, 소득에서는 0개→3개 감소의 차이가 ${ci(st('income', DIFF, '0개→3개').diff_pp, st('income', DIFF, '0개→3개').low_pp, st('income', DIFF, '0개→3개').high_pp)}로 같은 방향이었으나 신뢰구간이 0을 포함하였다. 다만 운동을 처음 시작하는 0개→1개 단계만 보면 소득에서도 불리 집단의 감소가 ${ci(st('income', DIFF, '0개→1개').diff_pp, st('income', DIFF, '0개→1개').low_pp, st('income', DIFF, '0개→1개').high_pp)} 더 컸다.기초생활수급(${ci(st('livelihood', DIFF, '0개→2~3개').diff_pp, st('livelihood', DIFF, '0개→2~3개').low_pp, st('livelihood', DIFF, '0개→2~3개').high_pp)})과 식품안정성(${ci(st('food', DIFF, '0개→2~3개').diff_pp, st('food', DIFF, '0개→2~3개').low_pp, st('food', DIFF, '0개→2~3개').high_pp)})에서는 불리 집단의 추가 감소가 유의하게 컸다. 운동 개수 1개당 오즈비도 불리 집단에서 더 낮았다(소득 ${s1slope('income').or_dis.toFixed(2)} 대 ${s1slope('income').or_adv.toFixed(2)}, ${pv(s1slope('income').p_interaction)}; 수급 ${s1slope('livelihood').or_dis.toFixed(2)} 대 ${s1slope('livelihood').or_adv.toFixed(2)}, ${pv(s1slope('livelihood').p_interaction)}; 식품 ${s1slope('food').or_dis.toFixed(2)} 대 ${s1slope('food').or_adv.toFixed(2)}, ${pv(s1slope('food').p_interaction)}).`));
add(tcap('s1', 'S1. 운동 외 생활요인을 표준화한 운동 요인 개수별 조정 유병률과 변화(균등화 소득)'));
const exl = ['0개', '1개', '2개', '3개'];
const steps = ['0개→1개', '1개→2개', '2개→3개', '0개→3개'];
add(table(['집단', ...exl.map((e) => `운동 ${e}`), ...steps.map((s) => `${s}\n(%p)`)],
  [inc.dis, '중위(2~4분위)', inc.adv, DIFF].map((g) => [g.replace('차이(불리−유리)', '차이(하위−상위)'),
    ...exl.map((e) => (s1std('income', g, e) ? pct(s1std('income', g, e).adj_prev) : '')),
    ...steps.map((s) => (st('income', g, s) ? `${sgn(st('income', g, s).diff_pp)}\n[${sgn(st('income', g, s).low_pp)}, ${sgn(st('income', g, s).high_pp)}]` : ''))]),
  [1500, 950, 950, 950, 950, 1085, 1085, 1085, 1083], { align: [L, R, R, R, R, C, C, C, C], size: 16 }));
add(SOURCE(SRC + '. 주: 운동 외 생활요인 단계(0~2, 3, 4, 5~6개)를 전체 분포로 표준화. 운동 요인 = 걷기·중강도 이상 유산소·근력운동.'));
add(fig('s1', 'fig_v3_08_exercise_stack.png', 'S1. 운동 외 생활요인이 같을 때 운동 요인 개수에 따른 조정 유병률'));
add(P(`운동 외 생활요인 단계별로 나누어 보면(${fn('s1nb')}), 운동 외 생활요인이 3~4개인 중간 단계에서 운동 요인에 따른 차이가 가장 뚜렷하였다. 운동 외 생활요인이 0~2개인 단계에서는 운동 3개 칸의 표본이 작아 추정이 불안정하였고, 5~6개 단계에서는 이미 유병률이 낮아 운동을 더해도 변화가 작았다. 사용자가 처음 구상한 방식대로 운동 요인을 따로 센 확장 개수(0~9개)로 보면, 소득 하위 20%의 유병률은 개수가 늘수록 상위 20%와의 간격을 좁히며 7개 이상에서 거의 만났다(${fn('c9')}).`.replace('사용자가 처음 구상한 방식대로 운동 요인을', '운동 요인을')));
add(fig('s1nb', 'fig_v3_09_exercise_by_nonex.png', 'S1 보충. 운동 외 생활요인 단계별 운동 요인 개수와 조정 유병률'));
add(fig('c9', 'fig_v3_10_count9.png', '확장 생활요인 개수(운동 외 6개 + 운동 3개)별 조정 유병률', 150));

add(H(2, '운동 종류별 비교(S2)'));
add(P(`세 운동을 서로 조정한 모형에서 소득 하위 20%의 실천 대 미실천 조정 유병률 차이는 걷기 ${ci(walkDis.diff_pp, walkDis.low_pp, walkDis.high_pp)}, 중강도 이상 유산소 ${ci(aerDis.diff_pp, aerDis.low_pp, aerDis.high_pp)}, 근력운동 ${ci(strDis.diff_pp, strDis.low_pp, strDis.high_pp)}로 걷기가 가장 컸다(${tn('s2')}, ${fn('s2')}). 소득 상위 20%에서는 걷기 ${ci(walkAdv.diff_pp, walkAdv.low_pp, walkAdv.high_pp)}, 유산소 ${ci(aerAdv.diff_pp, aerAdv.low_pp, aerAdv.high_pp)}, 근력운동 ${ci(strAdv.diff_pp, strAdv.low_pp, strAdv.high_pp)}였다. 두 집단의 차이를 비교하면 걷기는 하위 집단에서 ${ci(walkD.diff_pp, walkD.low_pp, walkD.high_pp)} 더 컸고(${pv(walkD.p)}), 유산소는 차이가 유의하지 않았으며(${pv(aerD.p)}), 근력운동은 두 집단에서 거의 같았다(${ci(strD.diff_pp, strD.low_pp, strD.high_pp)}).`));
add(tcap('s2', 'S2. 운동 종류별 실천 대 미실천 조정 유병률 차이(%p, 95% CI)'));
const COMPS = [['walk_ok', '걷기 실천'], ['aerobic_ok', '중강도 이상 유산소'], ['strength_ok', '근력운동 주 2일+']];
const s2rows = [];
KEYS.forEach((k) => ['상호 조정', '단독'].forEach((m) => COMPS.forEach(([c, lab], ci2) => {
  const a = s2(k, c, IND[k].dis, m), b = s2(k, c, IND[k].adv, m), dd = s2(k, c, DIFF, m);
  s2rows.push([ci2 === 0 ? `${IND[k].label}\n(${m})` : '', lab, ci(a.diff_pp, a.low_pp, a.high_pp), ci(b.diff_pp, b.low_pp, b.high_pp), `${ci(dd.diff_pp, dd.low_pp, dd.high_pp)}\n${pv(dd.p)}`]);
})));
add(table(['지표(모형)', '운동', '불리 집단', '유리 집단', '차이(불리 − 유리)'], s2rows, [1700, 1800, 2000, 2000, 2138], { align: [L, L, C, C, C], size: 16 }));
add(SOURCE(SRC + '. 주: 상호 조정 = 세 운동을 한 모형에 함께 넣음. 단독 = 해당 운동만 넣음. 모두 운동 외 생활요인 단계와 인구·신체건강 조정.'));
add(fig('s2', 'fig_v3_11_exercise_types.png', 'S2. 운동 종류별 실천과 관련된 조정 유병률 차이(균등화 소득)', 150));

// ── Ⅴ. 논의 ──────────────────────────────────────────
add(H(1, '논의'));
add(H(2, '주요 발견'));
add(P(`이 연구는 한국 성인 약 23만 명의 자료로, 건강 생활요인을 많이 충족한 경제적 불리 집단의 우울 증상 유병률이 생활요인을 적게 충족한 유리 집단보다 낮아지는 역전점이 있음을 확인하였다. 소득 하위 20%는 7개 생활요인 중 ${r1inc} 이상을 충족하면 생활요인이 적은 소득 상위 20%보다 유병률이 낮았고, 6~7개를 충족하면 소득 상위 20%의 평균보다도 낮았다. 생활요인에 따른 유병률 감소 폭은 불리 집단에서 2~3배 컸다. 이는 경제적 자원이 부족한 사람에게 다른 건강 자원이 더 큰 차이를 만든다는 자원 대체 가설(Ross & Mirowsky, 2006)과 일치한다.`));
add(P(`그러나 상쇄에는 한계가 있었다. 기초생활수급과 식품 불안정처럼 더 깊은 박탈에서는 생활요인을 모두 지켜도 같은 단계의 유리 집단보다 유병률이 ${sameTop('livelihood').diff_pp.toFixed(1)}~${sameTop('food').diff_pp.toFixed(1)}%p 높았다. 또 생활요인 분포 차이는 소득 격차의 약 3분의 1만 설명하였다. 근본 원인 이론(Link & Phelan, 1995)이 예측하듯, 경제적 박탈은 생활습관 밖의 여러 경로(만성 스트레스, 주거, 돌봄 부담 등)로도 우울과 연결된다. 사망·심혈관질환에서 생활습관이 사회경제적 격차의 일부만 설명한다는 Zhang 등(2021)의 결과와도 같은 방향이다.`));
add(H(2, '스포츠·운동 측면의 함의'));
add(P(`운동 요인은 다른 생활습관 위에 추가로 의미가 있었다. 운동 외 생활요인 수준이 같아도 운동 요인을 하나 이상 충족한 사람의 유병률이 낮았고, 그 차이는 대부분 "운동을 전혀 하지 않다가 하나를 시작하는" 단계에서 나타났다. 신체활동과 우울의 관계가 활동이 적은 구간에서 가장 가파르다는 용량-반응 메타분석(Pearce et al., 2022)과 일치하며, 정책 목표를 "더 많이"보다 "0에서 1로"에 두어야 함을 시사한다.`));
add(P(`운동 종류에서는 걷기가 소득 하위 집단에서 가장 큰 차이를 보였고, 그 차이는 소득 상위 집단보다 유의하게 컸다. 걷기는 비용과 시설이 거의 필요 없고 동네에서 바로 시작할 수 있어 경제적 제약이 큰 사람에게 접근성이 높은 운동이다. 반면 근력운동은 두 집단에서 비슷한 크기의 차이를 보였는데, 근력운동 실천율 자체는 소득 하위 집단에서 연령 표준화 후에도 ${pct(rate('income', inc.dis, 'strength_ok').age_std, 0)}로 상위 집단(${pct(rate('income', inc.adv, 'strength_ok').age_std, 0)})보다 낮았다. 근력운동의 관련성은 소득과 관계없이 나타나지만 실천 기회가 불리 집단에서 부족하다는 뜻이므로, 공공 체육시설과 프로그램 접근성을 높이는 것이 격차 완화에 도움이 될 수 있다. 중강도 이상 유산소 활동의 차이가 작았던 것은 지역사회건강조사 문항이 업무 중 신체활동을 포함하기 때문일 수 있다. 육체노동이 많은 집단에서는 높은 신체활동이 여가 운동과 같은 의미가 아닐 수 있다는 신체활동 역설(Holtermann et al., 2018)과 연결해 해석할 필요가 있다.`));
add(H(2, '정책 및 실천 제언'));
add(B('**생활요인을 묶어서 지원하는 프로그램**: 단일 행동보다 여러 생활요인을 함께 충족할 때 유병률이 단계적으로 낮아졌으므로, 저소득층 대상 건강 프로그램은 운동, 사회적 교류, 식생활, 금연·절주를 묶어 설계'));
add(B('지역 보건소·복지관의 걷기 모임처럼 운동과 사회적 교류(친구 연락)를 동시에 충족하는 형태가 효율적', 1));
add(B('**걷기를 첫 단계로**: 운동을 전혀 하지 않는 불리 집단에게 걷기 실천(주 5일·30분)을 우선 목표로 제시'));
add(B('안전한 보행 환경, 공원·산책로 접근성 개선은 동네 안전 인식과 걷기 실천을 함께 높일 수 있음', 1));
add(B('**근력운동 접근성 격차 해소**: 근력운동의 관련성은 소득과 무관했지만 실천율은 불리 집단에서 낮으므로, 공공 체육시설 이용료 감면·바우처, 기구 없이 하는 근력운동 프로그램 보급'));
add(B('**깊은 박탈에는 구조적 지원 병행**: 기초생활수급·식품 불안정 집단은 생활요인만으로 격차가 메워지지 않으므로 소득·식품 지원, 정신건강 선별과 연계'));
add(B('**효과 검증**: 이 결과는 관찰 연구이므로 저소득층 대상 걷기·근력운동 결합 프로그램의 효과를 무작위 또는 준실험 중재연구로 확인할 필요'));
add(H(2, '연구의 한계'));
add(P('첫째, 횡단면 자료이므로 인과 방향을 알 수 없다. 우울 증상이 있으면 운동, 사회적 교류, 규칙적인 식사를 하기 어려워지므로 역인과가 결과의 일부를 설명할 수 있다. 행동 요인만 센 민감도 분석에서도 결과가 유지되었지만 역인과를 배제하지는 못한다. 둘째, 불리 집단 중 생활요인을 많이 지키는 사람은 원래 심리적 자원이 많은 사람일 수 있다(선택). 셋째, 생활요인과 PHQ-9 모두 자기보고에 의존한다. 넷째, 신체활동 문항이 일과 여가를 구분하지 않아 운동 종류 비교(S2)의 해석에 제약이 있다. 다섯째, 생활요인을 같은 가중치로 더한 개수는 요인마다 다른 영향을 반영하지 못한다. 여섯째, 역전점 판정은 여러 비교를 포함하므로 경계선 결과는 우연일 수 있으며, 이 분석의 가설은 자료를 본 뒤 구체화된 부분이 있어 확증적 검정보다는 탐색적 근거로 보아야 한다. 마지막으로 65세 이상과 19~39세에서는 칸이 작거나 결과가 달라, 연령대별 결론은 추가 연구가 필요하다.'));

// ── Ⅵ. 결론 ──────────────────────────────────────────
add(H(1, '결론'));
add(P(`2025 지역사회건강조사 자료에서 건강 생활요인을 많이 충족한 경제적 불리 집단은 생활요인을 적게 충족한 유리 집단보다 우울 증상 유병률이 낮았고, 소득 하위 20%는 생활요인 6~7개에서 소득 상위 20%의 평균보다도 낮았다. 생활요인과 관련된 유병률 감소는 불리 집단에서 더 컸으며, 다른 생활습관이 같아도 운동, 특히 걷기를 실천하는 것이 불리 집단에서 낮은 유병률과 관련되었다. 건강 생활요인은 경제적 불리함과 관련된 우울 증상 격차를 상당 부분 줄이는 방향과 관련되지만, 깊은 박탈의 격차와 생활요인으로 설명되지 않는 구조적 격차는 남는다. 따라서 걷기를 출발점으로 한 생활요인 결합 프로그램과 경제적 지원을 함께 추진하고, 그 효과를 중재연구로 검증할 것을 제안한다.`));

// ── 참고문헌 ──────────────────────────────────────────
add(H(1, '참고문헌'));
[
  '질병관리청. (2025). 지역사회건강조사 2025년 원시자료 이용지침서. 질병관리청.',
  'Berkman, L. F., Glass, T., Brissette, I., & Seeman, T. E. (2000). From social integration to health: Durkheim in the new millennium. Social Science & Medicine, 51(6), 843–857. https://doi.org/10.1016/S0277-9536(00)00065-4',
  'Gordon, B. R., McDowell, C. P., Hallgren, M., Meyer, J. D., Lyons, M., & Herring, M. P. (2018). Association of efficacy of resistance exercise training with depressive symptoms: Meta-analysis and meta-regression analysis of randomized clinical trials. JAMA Psychiatry, 75(6), 566–576. https://doi.org/10.1001/jamapsychiatry.2018.0572',
  'Holtermann, A., Krause, N., van der Beek, A. J., & Straker, L. (2018). The physical activity paradox: Six reasons why occupational physical activity (OPA) does not confer the cardiovascular health benefits that leisure time physical activity does. British Journal of Sports Medicine, 52(3), 149–150. https://doi.org/10.1136/bjsports-2017-097965',
  'Kroenke, K., Spitzer, R. L., & Williams, J. B. W. (2001). The PHQ-9: Validity of a brief depression severity measure. Journal of General Internal Medicine, 16(9), 606–613. https://doi.org/10.1046/j.1525-1497.2001.016009606.x',
  'Lee, J., Lee, J.-E., Kim, S., Min, H. S., & Lee, K.-S. (2025). Social network, perceived satisfaction with neighborhoods and depressive symptoms among older adults in Korea. Scientific Reports, 15, 42319. https://doi.org/10.1038/s41598-025-26332-2',
  'Link, B. G., & Phelan, J. (1995). Social conditions as fundamental causes of disease. Journal of Health and Social Behavior, (Extra Issue), 80–94.',
  'Lorant, V., Deliège, D., Eaton, W., Robert, A., Philippot, P., & Ansseau, M. (2003). Socioeconomic inequalities in depression: A meta-analysis. American Journal of Epidemiology, 157(2), 98–112. https://doi.org/10.1093/aje/kwf182',
  'Lumley, T. (2004). Analysis of complex survey samples. Journal of Statistical Software, 9(8), 1–19. https://doi.org/10.18637/jss.v009.i08',
  'Noetel, M., Sanders, T., Gallardo-Gómez, D., Taylor, P., del Pozo Cruz, B., van den Hoek, D., Smith, J. J., Mahoney, J., Spathis, J., Moresi, M., Pagano, R., Pagano, L., Vasconcellos, R., Arnott, H., Varley, B., Parker, P., Biddle, S., & Lonsdale, C. (2024). Effect of exercise for depression: Systematic review and network meta-analysis of randomised controlled trials. BMJ, 384, e075847. https://doi.org/10.1136/bmj-2023-075847',
  'Pearce, M., Garcia, L., Abbas, A., Strain, T., Schuch, F. B., Golubic, R., Kelly, P., Khan, S., Utukuri, M., Laird, Y., Mok, A., Smith, A., Tainio, M., Brage, S., & Woodcock, J. (2022). Association between physical activity and risk of depression: A systematic review and meta-analysis. JAMA Psychiatry, 79(6), 550–559. https://doi.org/10.1001/jamapsychiatry.2022.0609',
  'Pourmotabbed, A., Moradi, S., Babaei, A., Ghavami, A., Mohammadi, H., Jalili, C., Symonds, M. E., & Miraghajani, M. (2020). Food insecurity and mental health: A systematic review and meta-analysis. Public Health Nutrition, 23(10), 1778–1790. https://doi.org/10.1017/S136898001900435X',
  'Ross, C. E., & Mirowsky, J. (2006). Sex differences in the effect of education on depression: Resource multiplication or resource substitution? Social Science & Medicine, 63(5), 1400–1413.',
  'Schuch, F. B., Vancampfort, D., Firth, J., Rosenbaum, S., Ward, P. B., Silva, E. S., Hallgren, M., Ponce De Leon, A., Dunn, A. L., Deslandes, A. C., Fleck, M. P., Carvalho, A. F., & Stubbs, B. (2018). Physical activity and incident depression: A meta-analysis of prospective cohort studies. American Journal of Psychiatry, 175(7), 631–648. https://doi.org/10.1176/appi.ajp.2018.17111194',
  'VanderWeele, T. J., & Knol, M. J. (2014). A tutorial on interaction. Epidemiologic Methods, 3(1), 33–72. https://doi.org/10.1515/em-2013-0005',
  'von Elm, E., Altman, D. G., Egger, M., Pocock, S. J., Gøtzsche, P. C., Vandenbroucke, J. P., & STROBE Initiative. (2007). The Strengthening the Reporting of Observational Studies in Epidemiology (STROBE) statement: Guidelines for reporting observational studies. PLoS Medicine, 4(10), e296. https://doi.org/10.1371/journal.pmed.0040296',
  'World Health Organization. (2020). WHO guidelines on physical activity and sedentary behaviour. World Health Organization.',
  'Zhang, Y.-B., Chen, C., Pan, X.-F., Guo, J., Li, Y., Franco, O. H., Liu, G., & Pan, A. (2021). Associations of healthy lifestyle and socioeconomic status with mortality and incident cardiovascular disease: Two prospective cohort studies. BMJ, 373, n604. https://doi.org/10.1136/bmj.n604',
  'Zhao, Y., Yang, L., Sahakian, B. J., Langley, C., Zhang, W., Kuo, K., Li, Z., Gan, Y., Li, Y., Zhao, Y., Yu, J., Feng, J., & Cheng, W. (2023). The brain structure, immunometabolic and genetic mechanisms underlying the association between lifestyle and depression. Nature Mental Health, 1(10), 736–750. https://doi.org/10.1038/s44220-023-00120-1',
].forEach((r) => add(REF(r)));

// ── 부록 ─────────────────────────────────────────────
add(H(1, '부록'));
add(H(2, '기초생활수급·식품안정성의 단계별 비교'));
add(tcap('appRev', '불리 집단의 생활요인 단계별 비교(기초생활수급·식품안정성, %p, 95% CI)'));
const appRows = [];
['livelihood', 'food'].forEach((k) => BINS.forEach((b, bi) => appRows.push([bi === 0 ? `${IND[k].label}\n(${IND[k].dis})` : '', b,
  ...['유리 집단 0~2개', '유리 집단 전체 평균', '유리 집단 같은 단계'].map((cp) => { const r = rev(k, b, cp); return r.significantly_lower ? `**${revTxt(r)}**` : revTxt(r); }),
  n0(cell(k, IND[k].dis, b).n)])));
add(table(['지표', '단계', '① vs 유리 0~2개', '② vs 유리 전체 평균', '③ vs 유리 같은 단계', '불리 칸 n'], appRows,
  [1600, 900, 2050, 2050, 2050, 988], { align: [L, C, C, C, C, R], size: 16 }));
add(SOURCE('주: 굵은 글씨 = 95% CI 상한 < 0.'));
add(H(2, '기초생활수급·식품안정성의 운동 요인 누적 효과(S1)'));
add(tcap('appS1', 'S1. 운동 요인 개수별 조정 유병률(기초생활수급·식품안정성)'));
const appS1 = [];
['livelihood', 'food'].forEach((k) => [IND[k].dis, IND[k].adv, DIFF].forEach((g, gi) => {
  const e = ['0개', '1개', '2~3개'];
  appS1.push([gi === 0 ? IND[k].label : '', g.replace('차이(불리−유리)', '차이(불리 − 유리)'),
    ...e.map((x) => (s1std(k, g, x) ? pct(s1std(k, g, x).adj_prev) : '')),
    ...['0개→1개', '1개→2~3개', '0개→2~3개'].map((s) => { const r = st(k, g, s); return `${sgn(r.diff_pp)} [${sgn(r.low_pp)}, ${sgn(r.high_pp)}]`; })]);
}));
add(table(['지표', '집단', '운동 0개', '운동 1개', '운동 2~3개', '0→1개(%p)', '1→2~3개(%p)', '0→2~3개(%p)'], appS1,
  [1350, 1300, 900, 900, 950, 1412, 1413, 1413], { align: [L, L, R, R, R, C, C, C], size: 15 }));
add(SOURCE('주: 운동 외 생활요인 0~4, 5~6개를 전체 분포로 표준화.'));
add(H(2, 'STROBE 보고 항목 대응'));
add(tcap('strobe', 'STROBE(횡단면 연구) 주요 항목과 이 보고서의 위치'));
add(table(['항목', '내용', '위치'], [
  ['1 제목·초록', '연구 설계(횡단면)와 주요 결과 요약', '표지, 요약, Abstract'],
  ['2~3 배경·목적', '이론적 근거와 가설', 'Ⅱ, Ⅲ'],
  ['4~6 설계·대상', '조사 개요, 대상 선정', 'Ⅳ-1, 그림 1'],
  ['7 변수', '결과·노출·조정변수 정의', 'Ⅳ-2, 표 1~2'],
  ['8 측정', '공식 지표 정의, PHQ-9', 'Ⅳ-2'],
  ['9 비뚤림', '역인과·선택·자기보고', 'Ⅳ-3(민감도), Ⅵ-4'],
  ['10 표본 크기', '분석 대상과 모형별 n', 'Ⅳ-1, 표 6'],
  ['12 통계 방법', '조사설계, 예측 주변값, 상호작용, 결측 처리', 'Ⅳ-3'],
  ['13~14 참여자·기술', '흐름도, 표본 특성', '그림 1, 표 3'],
  ['16~17 주요·기타 결과', '조정 유병률, 역전점, 상호작용, 민감도', 'Ⅴ'],
  ['18~21 논의', '주요 결과, 한계, 해석, 일반화', 'Ⅵ'],
  ['22 연구비', '연구비 지원 여부', '아래 저자 노트'],
], [2300, 4300, 3038], { align: [L, L, L], size: 17 }));
add(SOURCE('주: von Elm et al. (2007). 항목 번호는 STROBE 체크리스트 기준.'));
add(H(2, '재현 방법과 저자 노트'));
add(P('분석 코드는 저장소의 `src/v3/`에 있다. `eda_v3.py → reversal_v3.py → sensitivity_v3.py → exercise_v3.py → build_report_data.py` 순서로 실행하면 집계표(`outputs/v3/reports`)와 그림(`outputs/v3/figures`), 이 보고서의 수치 파일(`report_v3/report_data.json`)이 만들어지고, `report_v3/make_report_v3.js`가 이 보고서를 생성한다. 원시자료와 개인 단위 결과는 질병관리청 이용 규정에 따라 포함하지 않았다.'));
body.push(new Paragraph({ children: [...runs('**연구비**: '), HL('[연구비 지원 여부 기재]'), ...runs('  **이해상충**: '), HL('[이해상충 여부 기재]'), ...runs('  **생성형 AI 활용**: '), HL('[예: 분석 코드와 보고서 초안 작성에 Anthropic Claude를 활용하였으며 연구진이 모든 결과와 문장을 검토·수정하였다 — 수업 규정에 맞게 수정]')] }));

// 번호 순서 확인: 본문에서 미리 정한 표·그림 순서와 실제 배치 순서가 같아야 함
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
if (!same(usedT, TABS)) throw new Error('표 순서 불일치: ' + usedT.join(','));
if (!same(usedF, FIGS)) throw new Error('그림 순서 불일치: ' + usedF.join(','));

const doc = new Document({
  creator: '스포츠융합산업프로젝트실습 연구팀',
  title: '건강 생활요인은 경제적 불리함을 상쇄하는가',
  styles: S.styles,
  numbering: S.numbering,
  features: { updateFields: true },
  sections: [S.frontSection([...cover(COVER), ...toc()], RUNNING), S.bodySection(body, RUNNING)],
});
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(path.join(__dirname, OUT), buf); console.log('written', OUT); });
