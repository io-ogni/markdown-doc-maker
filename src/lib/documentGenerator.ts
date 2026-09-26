import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, TableLayoutType, WidthType, BorderStyle, ExternalHyperlink, FootnoteReferenceRun } from 'docx';
import { saveAs } from 'file-saver';

interface TextSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  href?: string; // set for link segments
  footnoteId?: string; // set for [^id] footnote references
}

// Maps a markdown footnote id (e.g. "1", "note") to its sequential Word footnote
// number. Set at the start of each generateWordDocument run, read by buildWordRuns.
let footnoteNumbers: Record<string, number> = {};

// Pull footnote definitions ("[^id]: text") out of the markdown so they don't
// render as literal lines, and assign each a sequential number in order of first use.
function extractFootnotes(markdown: string): { body: string; defs: { num: number; text: string }[] } {
  const defText: Record<string, string> = {};
  const bodyLines: string[] = [];
  for (const line of markdown.split('\n')) {
    const m = line.match(/^\[\^([^\]]+)\]:\s?(.*)$/);
    if (m) { defText[m[1]] = m[2]; continue; }
    bodyLines.push(line);
  }
  const body = bodyLines.join('\n');

  // Number footnotes by order of reference in the body (Word convention).
  const order: string[] = [];
  const refRe = /\[\^([^\]]+)\]/g;
  let rm;
  while ((rm = refRe.exec(body)) !== null) {
    if (defText[rm[1]] !== undefined && !order.includes(rm[1])) order.push(rm[1]);
  }

  footnoteNumbers = {};
  const defs = order.map((id, idx) => {
    footnoteNumbers[id] = idx + 1;
    return { num: idx + 1, text: defText[id] };
  });
  return { body, defs };
}

interface ParsedElement {
  type: 'heading1' | 'heading2' | 'heading3' | 'heading4' | 'paragraph' | 'list-item' | 'nested-list-item' | 'code' | 'blockquote' | 'blockquote-list-item' | 'table' | 'horizontal-rule' | 'image';
  content: string;
  segments?: TextSegment[];
  tableData?: string[][];
  indent?: number; // nesting level for lists
  imageUrl?: string;
  imageAlt?: string;
  ordered?: boolean; // ordered (numbered) list item
  ordinal?: number; // the number to render for ordered items
}

function parseMarkdown(markdown: string): ParsedElement[] {
  const lines = markdown.split('\n');
  const elements: ParsedElement[] = [];
  let i = 0;
  // Sequential counters per indent level for ordered lists, so numbering
  // matches what the preview (marked/GFM) shows regardless of typed numbers.
  let orderedCounters: number[] = [];

  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    if (!trimmedLine) {
      i++;
      continue;
    }

    // Horizontal rule
    if (trimmedLine.match(/^(-{3,}|\*{3,}|_{3,})$/)) {
      orderedCounters = [];
      elements.push({ type: 'horizontal-rule', content: '' });
      i++;
      continue;
    }

    // Image: ![alt](url)
    const imageMatch = trimmedLine.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      orderedCounters = [];
      elements.push({ type: 'image', content: '', imageAlt: imageMatch[1], imageUrl: imageMatch[2] });
      i++;
      continue;
    }

    // Check for table (line contains | and next line is separator)
    if (trimmedLine.includes('|') && i + 1 < lines.length) {
      const nextLine = lines[i + 1]?.trim() || '';
      if (nextLine.match(/^\|?[\s\-:]+\|[\s\-:|]+\|?$/)) {
        const tableData: string[][] = [];
        const rawHeaderCells = trimmedLine.split('|').map(cell => cell.trim());
        const headerCells = rawHeaderCells.slice(
          rawHeaderCells[0] === '' ? 1 : 0,
          rawHeaderCells[rawHeaderCells.length - 1] === '' ? -1 : undefined
        );
        const colCount = headerCells.length;
        tableData.push(headerCells);
        i += 2;
        while (i < lines.length) {
          const dataLine = lines[i]?.trim() || '';
          if (!dataLine.includes('|') || dataLine === '') break;
          const rawDataCells = dataLine.split('|').map(cell => cell.trim());
          const dataCells = rawDataCells.slice(
            rawDataCells[0] === '' ? 1 : 0,
            rawDataCells[rawDataCells.length - 1] === '' ? -1 : undefined
          );
          while (dataCells.length < colCount) dataCells.push('');
          if (dataCells.length > colCount) dataCells.length = colCount;
          tableData.push(dataCells);
          i++;
        }
        orderedCounters = [];
        elements.push({ type: 'table', content: '', tableData });
        continue;
      }
    }

    if (trimmedLine.startsWith('#### ')) {
      elements.push({ type: 'heading4', content: trimmedLine.slice(5) });
    } else if (trimmedLine.startsWith('### ')) {
      elements.push({ type: 'heading3', content: trimmedLine.slice(4) });
    } else if (trimmedLine.startsWith('## ')) {
      elements.push({ type: 'heading2', content: trimmedLine.slice(3) });
    } else if (trimmedLine.startsWith('# ')) {
      elements.push({ type: 'heading1', content: trimmedLine.slice(2) });
    } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
      // Calculate indent level from leading whitespace
      const leadingSpaces = line.length - line.trimStart().length;
      const indentLevel = Math.floor(leadingSpaces / 2);
      const listContent = trimmedLine.slice(2);
      // A bullet ends any ordered run at this level and deeper.
      orderedCounters = orderedCounters.slice(0, indentLevel);
      if (indentLevel > 0) {
        elements.push({ type: 'nested-list-item', content: listContent, segments: parseInlineFormatting(listContent), indent: indentLevel });
      } else {
        elements.push({ type: 'list-item', content: listContent, segments: parseInlineFormatting(listContent) });
      }
    } else if (trimmedLine.match(/^\d+\.\s/)) {
      const leadingSpaces = line.length - line.trimStart().length;
      const indentLevel = Math.floor(leadingSpaces / 2);
      const listContent = trimmedLine.replace(/^\d+\.\s/, '');
      // Drop any deeper levels, then increment this level's running count.
      orderedCounters.length = indentLevel + 1;
      orderedCounters[indentLevel] = (orderedCounters[indentLevel] || 0) + 1;
      const ordinal = orderedCounters[indentLevel];
      if (indentLevel > 0) {
        elements.push({ type: 'nested-list-item', content: listContent, segments: parseInlineFormatting(listContent), indent: indentLevel, ordered: true, ordinal });
      } else {
        elements.push({ type: 'list-item', content: listContent, segments: parseInlineFormatting(listContent), ordered: true, ordinal });
      }
    } else if (trimmedLine.startsWith('>')) {
      const blockquoteContent = trimmedLine.slice(1).trim();
      if (blockquoteContent) {
        if (blockquoteContent.startsWith('- ') || blockquoteContent.startsWith('* ')) {
          const listContent = blockquoteContent.slice(2);
          elements.push({ type: 'blockquote-list-item', content: listContent, segments: parseInlineFormatting(listContent) });
        } else if (blockquoteContent.match(/^\d+\.\s/)) {
          const listContent = blockquoteContent.replace(/^\d+\.\s/, '');
          elements.push({ type: 'blockquote-list-item', content: listContent, segments: parseInlineFormatting(listContent) });
        } else {
          elements.push({ type: 'blockquote', content: blockquoteContent, segments: parseInlineFormatting(blockquoteContent) });
        }
      }
    } else if (trimmedLine.startsWith('```')) {
      i++;
      let codeContent = '';
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeContent += (codeContent ? '\n' : '') + lines[i];
        i++;
      }
      if (codeContent) {
        elements.push({ type: 'code', content: codeContent });
      }
    } else if (trimmedLine.startsWith('`') && trimmedLine.endsWith('`')) {
      elements.push({ type: 'code', content: trimmedLine.slice(1, -1) });
    } else {
      elements.push({ type: 'paragraph', content: trimmedLine, segments: parseInlineFormatting(trimmedLine) });
    }

    // Any non-list block ends the current ordered run (list arms keep/adjust
    // their own counters above; blank lines `continue` before reaching here).
    const last = elements[elements.length - 1];
    if (last && last.type !== 'list-item' && last.type !== 'nested-list-item') {
      orderedCounters = [];
    }

    i++;
  }

  return elements;
}

function cleanInlineFormatting(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`(.*?)`/g, '$1');
}

function parseInlineFormatting(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  // Order matters: links first, then bold/italic/strike/code, then plain runs,
  // then a single leftover special char (so a stray '[' or '`' isn't dropped).
  const regex = /\[\^([^\]]+)\]|\[([^\]]+)\]\(([^)]+)\)|\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|`(.+?)`|[^*~`[]+|[*~`[]/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[1] !== undefined) {
      // [^id] footnote reference — only treat as one if a definition exists,
      // otherwise fall back to literal text so stray brackets aren't dropped.
      if (footnoteNumbers[match[1]] !== undefined) {
        segments.push({ text: '', footnoteId: match[1] });
      } else {
        segments.push({ text: match[0] });
      }
    } else if (match[2] !== undefined) {
      segments.push({ text: match[2], href: match[3] });
    } else if (match[4]) {
      segments.push({ text: match[4], bold: true, italic: true });
    } else if (match[5]) {
      segments.push({ text: match[5], bold: true });
    } else if (match[6]) {
      segments.push({ text: match[6], italic: true });
    } else if (match[7]) {
      segments.push({ text: match[7], strikethrough: true });
    } else if (match[8]) {
      segments.push({ text: match[8] });
    } else {
      segments.push({ text: match[0] });
    }
  }

  return segments.length > 0 ? segments : [{ text }];
}

// Build Word runs from parsed segments, rendering links as real hyperlinks.
function buildWordRuns(segments: TextSegment[], forceItalic = false): (TextRun | ExternalHyperlink | FootnoteReferenceRun)[] {
  return segments.map(seg => {
    if (seg.footnoteId && footnoteNumbers[seg.footnoteId] !== undefined) {
      return new FootnoteReferenceRun(footnoteNumbers[seg.footnoteId]);
    }
    if (seg.href) {
      return new ExternalHyperlink({
        children: [new TextRun({
          text: seg.text,
          bold: seg.bold,
          italics: seg.italic || forceItalic,
          strike: seg.strikethrough,
          style: 'Hyperlink',
        })],
        link: seg.href,
      });
    }
    return new TextRun({
      text: seg.text,
      bold: seg.bold,
      italics: seg.italic || forceItalic,
      strike: seg.strikethrough,
    });
  });
}

export async function generateWordDocument(markdown: string, filename: string): Promise<void> {
  const { body, defs } = extractFootnotes(markdown);
  const elements = parseMarkdown(body);
  const children: (Paragraph | Table)[] = [];

  for (const element of elements) {
    if (element.type === 'horizontal-rule') {
      children.push(new Paragraph({
        text: '',
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 1 } },
        spacing: { before: 200, after: 200 },
      }));
      continue;
    }

    if (element.type === 'image') {
      // Images can't be fetched client-side easily, add as text placeholder
      children.push(new Paragraph({
        children: [new TextRun({ text: `[Image: ${element.imageAlt || element.imageUrl}]`, italics: true, color: '666666' })],
        spacing: { before: 100, after: 100 },
      }));
      continue;
    }

    if (element.type === 'table' && element.tableData) {
      const rows = element.tableData;
      const colCount = Math.max(...rows.map(r => r.length));

      // Size each column to its content instead of splitting evenly: width is
      // proportional to the longest cell text in that column, so a narrow "ID"
      // column no longer gets the same width as a wide "Notes" column. (Word's
      // default was equal percentages, which is why every column looked identical.)
      const TOTAL = 9000; // ~A4 content width in twips (DXA)
      const colChars = Array.from({ length: colCount }, (_, c) => {
        let max = 3;
        for (const row of rows) {
          const len = row[c] ? cleanInlineFormatting(row[c]).length : 0;
          if (len > max) max = Math.min(len, 60); // cap so one huge cell can't dominate
        }
        return max;
      });
      const sum = colChars.reduce((a, b) => a + b, 0);
      const colWidths = colChars.map(ch => Math.max(600, Math.round((ch / sum) * TOTAL)));

      const tableRows = rows.map((row, rowIndex) => {
        return new TableRow({
          children: row.map((cell, colIndex) => {
            return new TableCell({
              children: [new Paragraph({
                children: [new TextRun({
                  text: cleanInlineFormatting(cell),
                  bold: rowIndex === 0,
                })],
              })],
              width: { size: colWidths[colIndex], type: WidthType.DXA },
            });
          }),
        });
      });

      children.push(new Table({
        rows: tableRows,
        columnWidths: colWidths,
        layout: TableLayoutType.FIXED,
        width: { size: TOTAL, type: WidthType.DXA },
      }));
      children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
      continue;
    }

    const cleanContent = cleanInlineFormatting(element.content);

    switch (element.type) {
      case 'heading1':
        children.push(new Paragraph({
          text: cleanContent,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }));
        break;
      case 'heading2':
        children.push(new Paragraph({
          text: cleanContent,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
        }));
        break;
      case 'heading3':
        children.push(new Paragraph({
          text: cleanContent,
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 240, after: 120 },
        }));
        break;
      case 'heading4':
        children.push(new Paragraph({
          text: cleanContent,
          heading: HeadingLevel.HEADING_4,
          spacing: { before: 200, after: 100 },
        }));
        break;
      case 'list-item': {
        const marker = element.ordered ? `${element.ordinal}. ` : '• ';
        const runs = element.segments && element.segments.length > 0
          ? buildWordRuns(element.segments)
          : [new TextRun({ text: cleanContent })];
        children.push(new Paragraph({
          children: [new TextRun({ text: marker }), ...runs],
          spacing: { before: 100, after: 100 },
          indent: { left: 720 },
        }));
        break;
      }
      case 'nested-list-item': {
        const indentLevel = element.indent || 1;
        const indentDxa = 720 + indentLevel * 720;
        const marker = element.ordered
          ? `${element.ordinal}. `
          : (indentLevel === 1 ? '◦ ' : '▪ ');
        const runs = element.segments && element.segments.length > 0
          ? buildWordRuns(element.segments)
          : [new TextRun({ text: cleanContent })];
        children.push(new Paragraph({
          children: [new TextRun({ text: marker }), ...runs],
          spacing: { before: 60, after: 60 },
          indent: { left: indentDxa },
        }));
        break;
      }
      case 'blockquote': {
        const runs = element.segments && element.segments.length > 0
          ? buildWordRuns(element.segments, true)
          : [new TextRun({ text: cleanContent, italics: true })];
        children.push(new Paragraph({
          children: runs,
          spacing: { before: 120, after: 120 },
          indent: { left: 720 },
        }));
        break;
      }
      case 'blockquote-list-item': {
        const runs = element.segments && element.segments.length > 0
          ? buildWordRuns(element.segments, true)
          : [new TextRun({ text: cleanContent, italics: true })];
        children.push(new Paragraph({
          children: [new TextRun({ text: '• ', italics: true }), ...runs],
          spacing: { before: 60, after: 60 },
          indent: { left: 1440 },
        }));
        break;
      }
      case 'code': {
        const codeLines = cleanContent.split('\n');
        for (const codeLine of codeLines) {
          children.push(new Paragraph({
            children: [new TextRun({ text: codeLine, font: 'Courier New', size: 20 })],
            spacing: { before: 40, after: 40 },
            shading: { fill: 'f5f5f5' },
          }));
        }
        break;
      }
      default: {
        const runs = element.segments && element.segments.length > 0
          ? buildWordRuns(element.segments)
          : [new TextRun({ text: cleanContent })];
        children.push(new Paragraph({
          children: runs,
          spacing: { before: 100, after: 100 },
        }));
      }
    }
  }

  const footnotes = defs.length
    ? Object.fromEntries(defs.map(d => [
        d.num,
        { children: [new Paragraph({ children: [new TextRun({ text: d.text })] })] },
      ]))
    : undefined;

  const doc = new Document({
    footnotes,
    sections: [{
      properties: {},
      children: children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename}.docx`);
}
