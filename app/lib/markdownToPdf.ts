/**
 * markdownToPdf.ts
 * Markdown → PDF converter, entirely client-side.
 *
 * marked's lexer() produces a block-token tree (heading, paragraph, list,
 * table, code, blockquote, hr, plus inline tokens like strong/em/codespan
 * nested inside text-bearing blocks). This module walks that tree and lays
 * it out onto pdf-lib pages by hand — pdf-lib has no text-flow/wrapping
 * engine of its own, so word-wrap, line height, and page-break placement are
 * all computed here from real glyph widths (font.widthOfTextAtSize).
 *
 * Deliberately NOT implemented: clickable link annotations (links render as
 * "text (https://…)", plain but always visible even if printed), nested list
 * indstaggering beyond a flat per-level indent, and inline images (rendered
 * as an "[image: alt text]" placeholder — embedding remote/relative image
 * data is a separate, larger feature).
 */

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, RGB } from "pdf-lib";
import { marked, type Token, type Tokens } from "marked";

export type PageSize = "a4" | "letter";

const PAGE_DIMENSIONS: Record<PageSize, { width: number; height: number }> = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
};

export interface ConvertMarkdownToPdfOptions {
  pageSize?: PageSize;
}

const MARGIN = 50;
const BODY_SIZE = 11;
const LINE_HEIGHT = 15;
const HEADING_SIZES: Record<number, number> = { 1: 24, 2: 20, 3: 16, 4: 14, 5: 12, 6: 11 };
const CODE_SIZE = 10;
const GRAY = rgb(0.5, 0.5, 0.5);
const LIGHT_GRAY_BG = rgb(0.95, 0.95, 0.95);
const BORDER_GRAY = rgb(0.75, 0.75, 0.75);
const BLACK = rgb(0.08, 0.08, 0.08);

interface Run {
  text: string;
  bold: boolean;
  italic: boolean;
  code: boolean;
  strike: boolean;
}

interface FontSet {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
  mono: PDFFont;
}

/** Flatten marked's nested inline-token tree into a flat list of styled runs. */
function flattenInline(
  tokens: Token[],
  style: { bold: boolean; italic: boolean; code: boolean; strike: boolean } = {
    bold: false,
    italic: false,
    code: false,
    strike: false,
  }
): Run[] {
  const runs: Run[] = [];
  for (const t of tokens as any[]) {
    switch (t.type) {
      case "text":
      case "escape":
        // Some "text" tokens carry their own nested tokens (e.g. an emphasis
        // run inside a table cell); recurse into those, otherwise use .text.
        if (t.tokens?.length) runs.push(...flattenInline(t.tokens, style));
        else runs.push({ text: t.text, ...style });
        break;
      case "strong":
        runs.push(...flattenInline(t.tokens ?? [{ type: "text", text: t.text }], { ...style, bold: true }));
        break;
      case "em":
        runs.push(...flattenInline(t.tokens ?? [{ type: "text", text: t.text }], { ...style, italic: true }));
        break;
      case "del":
        runs.push(...flattenInline(t.tokens ?? [{ type: "text", text: t.text }], { ...style, strike: true }));
        break;
      case "codespan":
        runs.push({ text: t.text, ...style, code: true });
        break;
      case "link":
        runs.push(...flattenInline(t.tokens ?? [{ type: "text", text: t.text }], style));
        runs.push({ text: ` (${t.href})`, ...style });
        break;
      case "image":
        runs.push({ text: `[image: ${t.text || t.href}]`, ...style, italic: true });
        break;
      case "br":
        runs.push({ text: "\n", ...style });
        break;
      default:
        if (typeof t.text === "string") runs.push({ text: t.text, ...style });
    }
  }
  return runs;
}

function pickFont(fonts: FontSet, run: Run): PDFFont {
  if (run.code) return fonts.mono;
  if (run.bold && run.italic) return fonts.boldItalic;
  if (run.bold) return fonts.bold;
  if (run.italic) return fonts.italic;
  return fonts.regular;
}

interface Word {
  text: string;
  font: PDFFont;
  size: number;
  width: number;
  strike: boolean;
  /** A hard line break (from <br> or an explicit newline) after this word. */
  breakAfter: boolean;
}

/** Split runs into individually-measured words, ready for word-wrap. */
function wordsFromRuns(runs: Run[], fonts: FontSet, size: number): Word[] {
  const words: Word[] = [];
  for (const run of runs) {
    const segments = run.text.split("\n");
    segments.forEach((segment, i) => {
      const font = pickFont(fonts, run);
      const pieces = segment.split(/\s+/).filter((p) => p.length > 0);
      for (const piece of pieces) {
        words.push({ text: piece, font, size, width: font.widthOfTextAtSize(piece, size), strike: run.strike, breakAfter: false });
      }
      if (i < segments.length - 1 && words.length > 0) words[words.length - 1].breakAfter = true;
    });
  }
  return words;
}

/** Mutable page/cursor state threaded through every draw* helper below. */
class Layout {
  doc: PDFDocument;
  page: PDFPage;
  pageWidth: number;
  pageHeight: number;
  cursorY: number;
  readonly contentWidth: number;

  constructor(doc: PDFDocument, pageSize: PageSize) {
    this.doc = doc;
    const { width, height } = PAGE_DIMENSIONS[pageSize];
    this.pageWidth = width;
    this.pageHeight = height;
    this.contentWidth = width - MARGIN * 2;
    this.page = doc.addPage([width, height]);
    this.cursorY = height - MARGIN;
  }

  /** Call before drawing a line/block chunk of the given height. */
  ensureSpace(height: number) {
    if (this.cursorY - height < MARGIN) {
      this.page = this.doc.addPage([this.pageWidth, this.pageHeight]);
      this.cursorY = this.pageHeight - MARGIN;
    }
  }

  advance(amount: number) {
    this.cursorY -= amount;
  }
}

/**
 * Word-wrap and draw a run of styled words, indented by `indent` from the
 * left margin, starting at `startX` (for a bullet/number prefix on the first
 * line). Returns nothing — draws directly via the layout's current page,
 * paginating as needed.
 */
function drawWrappedWords(
  layout: Layout,
  words: Word[],
  opts: { indent: number; lineHeight?: number; firstLineExtraIndent?: number } = { indent: 0 }
) {
  const lineHeight = opts.lineHeight ?? LINE_HEIGHT;
  const indent = opts.indent;
  const maxWidth = layout.contentWidth - indent;
  const spaceWidth = words[0]?.font.widthOfTextAtSize(" ", words[0].size) ?? 3;

  let line: Word[] = [];
  let lineWidth = 0;
  let isFirstLine = true;

  const flush = () => {
    if (line.length === 0) {
      isFirstLine = false;
      return;
    }
    layout.ensureSpace(lineHeight);
    let x = MARGIN + indent + (isFirstLine ? opts.firstLineExtraIndent ?? 0 : 0);
    for (const w of line) {
      layout.page.drawText(w.text, { x, y: layout.cursorY, size: w.size, font: w.font, color: BLACK });
      if (w.strike) {
        const strikeY = layout.cursorY + w.size * 0.32;
        layout.page.drawLine({ start: { x, y: strikeY }, end: { x: x + w.width, y: strikeY }, thickness: 0.6, color: BLACK });
      }
      x += w.width + spaceWidth;
    }
    layout.advance(lineHeight);
    line = [];
    lineWidth = 0;
    isFirstLine = false;
  };

  for (const word of words) {
    const wordWidth = word.width + (line.length > 0 ? spaceWidth : 0);
    if (line.length > 0 && lineWidth + wordWidth > maxWidth) flush();
    line.push(word);
    lineWidth += word.width + (line.length > 1 ? spaceWidth : 0);
    if (word.breakAfter) flush();
  }
  flush();
}

function drawHeading(layout: Layout, fonts: FontSet, token: Tokens.Heading) {
  const size = HEADING_SIZES[token.depth] ?? 11;
  const runs = flattenInline(token.tokens, { bold: true, italic: false, code: false, strike: false });
  const words = wordsFromRuns(runs, fonts, size);
  layout.ensureSpace(size * 1.6 + 6);
  layout.advance(6); // space before
  drawWrappedWords(layout, words, { indent: 0, lineHeight: size * 1.25 });
  layout.advance(4); // space after
}

function drawParagraph(layout: Layout, fonts: FontSet, token: Tokens.Paragraph) {
  const runs = flattenInline(token.tokens);
  const words = wordsFromRuns(runs, fonts, BODY_SIZE);
  drawWrappedWords(layout, words, { indent: 0 });
  layout.advance(6);
}

function drawBlockquote(layout: Layout, fonts: FontSet, token: Tokens.Blockquote) {
  const runs = flattenInline(token.tokens, { bold: false, italic: true, code: false, strike: false });
  const words = wordsFromRuns(runs, fonts, BODY_SIZE);
  const startY = layout.cursorY;
  drawWrappedWords(layout, words, { indent: 16 });
  // Left border bar spanning the quote's height, drawn after so we know how
  // far the cursor moved.
  const endY = layout.cursorY;
  layout.page.drawLine({
    start: { x: MARGIN + 4, y: startY + LINE_HEIGHT * 0.8 },
    end: { x: MARGIN + 4, y: endY + LINE_HEIGHT * 0.3 },
    thickness: 2,
    color: BORDER_GRAY,
  });
  layout.advance(4);
}

function drawCode(layout: Layout, fonts: FontSet, token: Tokens.Code) {
  const lines = token.text.split("\n");
  const padding = 8;
  const blockHeight = lines.length * (CODE_SIZE + 4) + padding * 2;
  layout.ensureSpace(blockHeight);
  const top = layout.cursorY + CODE_SIZE * 0.3;
  layout.page.drawRectangle({
    x: MARGIN,
    y: top - blockHeight,
    width: layout.contentWidth,
    height: blockHeight,
    color: LIGHT_GRAY_BG,
  });
  layout.advance(padding);
  for (const line of lines) {
    layout.ensureSpace(CODE_SIZE + 4);
    layout.page.drawText(line, { x: MARGIN + padding, y: layout.cursorY, size: CODE_SIZE, font: fonts.mono, color: BLACK });
    layout.advance(CODE_SIZE + 4);
  }
  layout.advance(padding);
  layout.advance(6);
}

function drawHr(layout: Layout) {
  layout.ensureSpace(16);
  layout.advance(8);
  layout.page.drawLine({
    start: { x: MARGIN, y: layout.cursorY },
    end: { x: layout.pageWidth - MARGIN, y: layout.cursorY },
    thickness: 1,
    color: BORDER_GRAY,
  });
  layout.advance(8);
}

function drawList(layout: Layout, fonts: FontSet, token: Tokens.List, depth = 0) {
  let index = typeof token.start === "number" ? token.start : 1;
  for (const item of token.items) {
    const indent = 18 * (depth + 1);
    const prefix = token.ordered ? `${index}.` : "•";
    index++;

    // A task-list checkbox token sits first among the item's inline tokens.
    const checkboxToken = (item.tokens as any[]).find((t) => t.type === "checkbox");
    const prefixText = checkboxToken ? (checkboxToken.checked ? "[x]" : "[ ]") : prefix;

    // Render the item's own text as one wrapped block, with the bullet/number
    // drawn in the indent gutter of the first line.
    const inlineTokens = (item.tokens as any[]).filter((t) => t.type !== "checkbox" && t.type !== "list");
    const runs = flattenInline(inlineTokens as Token[]);
    const words = wordsFromRuns(runs, fonts, BODY_SIZE);

    const prefixWidth = fonts.regular.widthOfTextAtSize(prefixText + " ", BODY_SIZE);
    layout.ensureSpace(LINE_HEIGHT);
    // Draw the bullet/number/checkbox at the current cursor before the
    // wrapped text consumes it (drawWrappedWords may paginate internally,
    // but the first line always starts at the position we're about to draw).
    layout.page.drawText(prefixText, { x: MARGIN + indent - prefixWidth, y: layout.cursorY, size: BODY_SIZE, font: fonts.regular, color: BLACK });
    drawWrappedWords(layout, words, { indent });

    // Nested sub-lists (marked nests them as a "list" token inside the item).
    const nested = (item.tokens as any[]).find((t) => t.type === "list") as Tokens.List | undefined;
    if (nested) drawList(layout, fonts, nested, depth + 1);
  }
  layout.advance(4);
}

/** Word-wrap a table cell's runs into lines that fit `colWidth`, without drawing. */
function wrapCellLines(runs: Run[], fonts: FontSet, size: number, colWidth: number): { text: string; font: PDFFont }[][] {
  const words = wordsFromRuns(runs, fonts, size);
  const spaceWidth = fonts.regular.widthOfTextAtSize(" ", size);
  const lines: { text: string; font: PDFFont }[][] = [];
  let line: { text: string; font: PDFFont }[] = [];
  let lineWidth = 0;

  const flush = () => {
    if (line.length > 0) lines.push(line);
    line = [];
    lineWidth = 0;
  };

  for (const word of words) {
    const addWidth = word.width + (line.length > 0 ? spaceWidth : 0);
    if (line.length > 0 && lineWidth + addWidth > colWidth) flush();
    line.push({ text: word.text, font: word.font });
    lineWidth += word.width + (line.length > 1 ? spaceWidth : 0);
  }
  flush();
  if (lines.length === 0) lines.push([]);
  return lines;
}

function drawTable(layout: Layout, fonts: FontSet, token: Tokens.Table) {
  const cols = token.header.length;
  const cellPadding = 6;
  const cellSize = BODY_SIZE - 1;

  // Column widths: proportional to each column's widest natural content,
  // scaled to fill the available width exactly.
  const naturalWidths = token.header.map((cell, ci) => {
    const headerWidth = fonts.bold.widthOfTextAtSize(cell.text, cellSize);
    const rowWidths = token.rows.map((row) => fonts.regular.widthOfTextAtSize(row[ci]?.text ?? "", cellSize));
    return Math.max(headerWidth, ...rowWidths, 30);
  });
  const totalNatural = naturalWidths.reduce((s, w) => s + w, 0);
  const colWidths = naturalWidths.map((w) => (w / totalNatural) * layout.contentWidth);

  const drawRow = (cells: Tokens.TableCell[], isHeader: boolean) => {
    const cellLines = cells.map((cell, ci) => {
      const runs = flattenInline(cell.tokens, { bold: isHeader, italic: false, code: false, strike: false });
      return wrapCellLines(runs, fonts, cellSize, colWidths[ci] - cellPadding * 2);
    });
    const rowLines = Math.max(...cellLines.map((l) => l.length));
    const rowHeight = rowLines * (cellSize + 4) + cellPadding * 2;

    layout.ensureSpace(rowHeight);
    const rowTop = layout.cursorY + cellSize * 0.3;

    if (isHeader) {
      layout.page.drawRectangle({ x: MARGIN, y: rowTop - rowHeight, width: layout.contentWidth, height: rowHeight, color: LIGHT_GRAY_BG });
    }

    let x = MARGIN;
    for (let ci = 0; ci < cols; ci++) {
      let cy = layout.cursorY;
      for (const line of cellLines[ci]) {
        let lx = x + cellPadding;
        for (const piece of line) {
          layout.page.drawText(piece.text, { x: lx, y: cy, size: cellSize, font: piece.font, color: BLACK });
          lx += piece.font.widthOfTextAtSize(piece.text, cellSize) + fonts.regular.widthOfTextAtSize(" ", cellSize);
        }
        cy -= cellSize + 4;
      }
      x += colWidths[ci];
    }

    // Vertical column separators + bottom border for this row.
    let bx = MARGIN;
    for (let ci = 0; ci <= cols; ci++) {
      layout.page.drawLine({ start: { x: bx, y: rowTop }, end: { x: bx, y: rowTop - rowHeight }, thickness: 0.5, color: BORDER_GRAY });
      if (ci < cols) bx += colWidths[ci];
    }
    layout.page.drawLine({ start: { x: MARGIN, y: rowTop - rowHeight }, end: { x: MARGIN + layout.contentWidth, y: rowTop - rowHeight }, thickness: 0.5, color: BORDER_GRAY });

    layout.cursorY = rowTop - rowHeight;
  };

  layout.page.drawLine({ start: { x: MARGIN, y: layout.cursorY + BODY_SIZE * 0.3 }, end: { x: MARGIN + layout.contentWidth, y: layout.cursorY + BODY_SIZE * 0.3 }, thickness: 0.5, color: BORDER_GRAY });
  drawRow(token.header, true);
  for (const row of token.rows) drawRow(row, false);
  layout.advance(10);
}

/**
 * Convert a Markdown string to a PDF. Runs entirely in the browser: marked
 * tokenises the text, and every block is laid out and drawn onto pdf-lib
 * pages by hand (word-wrap, page-break, and table-column-width computation
 * all measured from real glyph widths — pdf-lib has no layout engine).
 */
export async function convertMarkdownToPdf(
  markdown: string,
  options: ConvertMarkdownToPdfOptions = {}
): Promise<Uint8Array> {
  const pageSize = options.pageSize ?? "a4";
  const doc = await PDFDocument.create();
  const fonts: FontSet = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
    mono: await doc.embedFont(StandardFonts.Courier),
  };

  const layout = new Layout(doc, pageSize);
  const tokens = marked.lexer(markdown);

  // marked's Token union includes an open-ended Generic fallback (type:
  // string), so TS can't narrow it from a literal switch the way it would a
  // closed union — cast per-case once the .type check has already confirmed
  // the real shape.
  for (const token of tokens as Token[]) {
    switch (token.type) {
      case "heading":
        drawHeading(layout, fonts, token as Tokens.Heading);
        break;
      case "paragraph":
        drawParagraph(layout, fonts, token as Tokens.Paragraph);
        break;
      case "blockquote":
        drawBlockquote(layout, fonts, token as Tokens.Blockquote);
        break;
      case "code":
        drawCode(layout, fonts, token as Tokens.Code);
        break;
      case "list":
        drawList(layout, fonts, token as Tokens.List);
        break;
      case "table":
        drawTable(layout, fonts, token as Tokens.Table);
        break;
      case "hr":
        drawHr(layout);
        break;
      case "space":
        break; // blank-line separators between blocks — spacing is already baked into each drawX's trailing advance
      default:
        // html, def, and anything unrecognised: skip rather than guess.
        break;
    }
  }

  return doc.save();
}
