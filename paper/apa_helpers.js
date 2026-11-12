/* APA 7 원고 서식 도우미 — build_manuscript.js(v2.1)의 서식 함수를 v4 원고(build_manuscript_v4.js)에서 함께 쓰려고 옮겨 둔 사본. */
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType,
  ImageRun, Header, PageNumber, PageBreak, HeadingLevel, VerticalAlign, TableLayoutType,
} = require("docx");

const DIR = __dirname;
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
const refPara = (t) => new Paragraph({ children: runs([t]), spacing: BODY, indent: { left: 720, hanging: 720 }, alignment: AlignmentType.LEFT });
module.exports = { n0, f, pct, pp, ci, signed, FONT, SIZE, BODY, TIGHT, runs, P, PL, center, H1, H2, H3, bullet, pageBreak, HL, apaTable, apaFigure, refPara, docx: require("docx") };
