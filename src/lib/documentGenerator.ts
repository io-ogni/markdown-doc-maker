import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';

interface TextSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

interface ParsedElement {
  type: 'heading1' | 'heading2' | 'heading3' | 'heading4' | 'paragraph' | 'list-item' | 'code' | 'blockquote' | 'blockquote-list-item' | 'table';
  content: string;
  segments?: TextSegment[];
  tableData?: string[][];
}

function parseMarkdown(markdown: string): ParsedElement[] {
  const lines = markdown.split('\n');
  const elements: ParsedElement[] = [];
  let i = 0;

  while (i < lines.length) {
    let line = lines[i];
    const trimmedLine = line.trim();
    
    if (!trimmedLine) {
      i++;
      continue;
    }

    // Check for table (line contains | and next line is separator)
    if (trimmedLine.includes('|') && i + 1 < lines.length) {
      const nextLine = lines[i + 1]?.trim() || '';
      // Check if next line is a separator row (contains |, -, and optionally :)
      if (nextLine.match(/^\|?[\s\-:]+\|[\s\-:|]+\|?$/)) {
        const tableData: string[][] = [];
        
        // Parse header row - preserve empty cells for proper column alignment
        const rawHeaderCells = trimmedLine.split('|').map(cell => cell.trim());
        // Remove leading/trailing empty strings from split (caused by leading/trailing |)
        const headerCells = rawHeaderCells.slice(
          rawHeaderCells[0] === '' ? 1 : 0,
          rawHeaderCells[rawHeaderCells.length - 1] === '' ? -1 : undefined
        );
        const colCount = headerCells.length;
        tableData.push(headerCells);
        
        i += 2; // Skip header and separator
        
        // Parse data rows - preserve empty cells
        while (i < lines.length) {
          const dataLine = lines[i]?.trim() || '';
          if (!dataLine.includes('|') || dataLine === '') break;
          
          const rawDataCells = dataLine.split('|').map(cell => cell.trim());
          // Remove leading/trailing empty strings from split
          const dataCells = rawDataCells.slice(
            rawDataCells[0] === '' ? 1 : 0,
            rawDataCells[rawDataCells.length - 1] === '' ? -1 : undefined
          );
          // Pad or trim to match header column count
          while (dataCells.length < colCount) dataCells.push('');
          if (dataCells.length > colCount) dataCells.length = colCount;
          
          tableData.push(dataCells);
          i++;
        }
        
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
      const listContent = trimmedLine.slice(2);
      elements.push({ type: 'list-item', content: listContent, segments: parseInlineFormatting(listContent) });
    } else if (trimmedLine.match(/^\d+\.\s/)) {
      const listContent = trimmedLine.replace(/^\d+\.\s/, '');
      elements.push({ type: 'list-item', content: listContent, segments: parseInlineFormatting(listContent) });
    } else if (trimmedLine.startsWith('>')) {
      // Handle blockquotes - extract content after '>' (may be empty or have space)
      const blockquoteContent = trimmedLine.slice(1).trim();
      // Skip empty blockquote lines (just ">")
      if (blockquoteContent) {
        // Check if the blockquote content is a list item
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
      // Multi-line code block
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
    .replace(/`(.*?)`/g, '$1');
}

function parseInlineFormatting(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  // First, replace markdown links [text](url) with just text
  const preprocessed = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  // Regex to match **bold**, *italic*, ***bold+italic***, or plain text
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|[^*`]+)/g;
  let match;
  
  while ((match = regex.exec(preprocessed)) !== null) {
    const fullMatch = match[0];
    if (match[2]) {
      // ***bold+italic***
      segments.push({ text: match[2], bold: true, italic: true });
    } else if (match[3]) {
      // **bold**
      segments.push({ text: match[3], bold: true });
    } else if (match[4]) {
      // *italic*
      segments.push({ text: match[4], italic: true });
    } else if (match[5]) {
      // `code` - treat as plain for now
      segments.push({ text: match[5] });
    } else {
      // Plain text
      segments.push({ text: fullMatch });
    }
  }
  
  return segments.length > 0 ? segments : [{ text: preprocessed }];
}

export async function generateWordDocument(markdown: string, filename: string): Promise<void> {
  const elements = parseMarkdown(markdown);
  const children: (Paragraph | Table)[] = [];

  for (const element of elements) {
    if (element.type === 'table' && element.tableData) {
      const tableRows = element.tableData.map((row, rowIndex) => {
        return new TableRow({
          children: row.map(cell => {
            return new TableCell({
              children: [new Paragraph({
                children: [new TextRun({
                  text: cleanInlineFormatting(cell),
                  bold: rowIndex === 0,
                })],
              })],
              width: { size: 100 / row.length, type: WidthType.PERCENTAGE },
            });
          }),
        });
      });

      children.push(new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      }));
      
      // Add spacing after table
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
      case 'list-item':
        if (element.segments && element.segments.length > 0) {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: '• ' }),
              ...element.segments.map(seg => new TextRun({
                text: seg.text,
                bold: seg.bold,
                italics: seg.italic,
              })),
            ],
            spacing: { before: 100, after: 100 },
            indent: { left: 720 },
          }));
        } else {
          children.push(new Paragraph({
            children: [new TextRun({ text: `• ${cleanContent}` })],
            spacing: { before: 100, after: 100 },
            indent: { left: 720 },
          }));
        }
        break;
      case 'blockquote':
        if (element.segments && element.segments.length > 0) {
          children.push(new Paragraph({
            children: element.segments.map(seg => new TextRun({
              text: seg.text,
              bold: seg.bold,
              italics: true,
            })),
            spacing: { before: 120, after: 120 },
            indent: { left: 720 },
          }));
        } else {
          children.push(new Paragraph({
            children: [new TextRun({ text: cleanContent, italics: true })],
            spacing: { before: 120, after: 120 },
            indent: { left: 720 },
          }));
        }
        break;
      case 'blockquote-list-item':
        if (element.segments && element.segments.length > 0) {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: '• ', italics: true }),
              ...element.segments.map(seg => new TextRun({
                text: seg.text,
                bold: seg.bold,
                italics: true,
              })),
            ],
            spacing: { before: 60, after: 60 },
            indent: { left: 1440 },
          }));
        } else {
          children.push(new Paragraph({
            children: [new TextRun({ text: `• ${cleanContent}`, italics: true })],
            spacing: { before: 60, after: 60 },
            indent: { left: 1440 },
          }));
        }
        break;
      case 'code':
        const codeLines = cleanContent.split('\n');
        for (const codeLine of codeLines) {
          children.push(new Paragraph({
            children: [new TextRun({ text: codeLine, font: 'Courier New', size: 20 })],
            spacing: { before: 40, after: 40 },
            shading: { fill: 'f5f5f5' },
          }));
        }
        break;
      default:
        if (element.segments && element.segments.length > 0) {
          children.push(new Paragraph({
            children: element.segments.map(seg => new TextRun({ 
              text: seg.text, 
              bold: seg.bold,
              italics: seg.italic,
            })),
            spacing: { before: 100, after: 100 },
          }));
        } else {
          children.push(new Paragraph({
            children: [new TextRun({ text: cleanContent })],
            spacing: { before: 100, after: 100 },
          }));
        }
    }
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children: children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename}.docx`);
}

export async function generatePDFDocument(markdown: string, filename: string): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let yPosition = margin;

  const elements = parseMarkdown(markdown);

  const checkPageBreak = (requiredHeight: number) => {
    if (yPosition + requiredHeight > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
    }
  };

  for (const element of elements) {
    // Handle tables
    if (element.type === 'table' && element.tableData) {
      const tableData = element.tableData;
      if (tableData.length === 0) continue;

      const colCount = Math.max(...tableData.map(row => row.length));
      const colWidth = maxWidth / colCount;
      const cellPadding = 2;
      const cellLineHeight = 4.5;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');

      for (let rowIdx = 0; rowIdx < tableData.length; rowIdx++) {
        const row = tableData[rowIdx];
        const isHeader = rowIdx === 0;

        // Calculate row height based on wrapped text
        pdf.setFont('helvetica', isHeader ? 'bold' : 'normal');
        let maxLines = 1;
        const cellWrappedLines: string[][] = [];
        for (let colIdx = 0; colIdx < row.length; colIdx++) {
          const cellText = cleanInlineFormatting(row[colIdx] || '');
          const wrappedLines = pdf.splitTextToSize(cellText, colWidth - cellPadding * 2);
          cellWrappedLines.push(wrappedLines);
          maxLines = Math.max(maxLines, wrappedLines.length);
        }
        const rowHeight = maxLines * cellLineHeight + 4;

        checkPageBreak(rowHeight);

        // Draw row background for header
        if (isHeader) {
          pdf.setFillColor(240, 240, 240);
          pdf.rect(margin, yPosition - 1, maxWidth, rowHeight, 'F');
        }

        // Draw cell borders
        pdf.setDrawColor(200, 200, 200);
        for (let colIdx = 0; colIdx < colCount; colIdx++) {
          pdf.rect(margin + colIdx * colWidth, yPosition - 1, colWidth, rowHeight);
        }

        // Draw wrapped text
        pdf.setFont('helvetica', isHeader ? 'bold' : 'normal');
        for (let colIdx = 0; colIdx < cellWrappedLines.length; colIdx++) {
          const lines = cellWrappedLines[colIdx];
          for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            pdf.text(lines[lineIdx], margin + colIdx * colWidth + cellPadding, yPosition + 4 + lineIdx * cellLineHeight);
          }
        }

        yPosition += rowHeight;
      }

      yPosition += 5;
      continue;
    }

    const cleanContent = cleanInlineFormatting(element.content);

    let fontSize = 12;
    let fontStyle: 'normal' | 'bold' | 'italic' = 'normal';
    let lineHeight = 7;
    let prefix = '';

    switch (element.type) {
      case 'heading1':
        fontSize = 24;
        fontStyle = 'bold';
        lineHeight = 14;
        yPosition += 5;
        break;
      case 'heading2':
        fontSize = 18;
        fontStyle = 'bold';
        lineHeight = 11;
        yPosition += 4;
        break;
      case 'heading3':
        fontSize = 14;
        fontStyle = 'bold';
        lineHeight = 9;
        yPosition += 3;
        break;
      case 'heading4':
        fontSize = 12;
        fontStyle = 'bold';
        lineHeight = 8;
        yPosition += 2;
        break;
      case 'list-item':
        prefix = '• ';
        break;
      case 'blockquote':
        fontStyle = 'italic';
        break;
      case 'code':
        pdf.setFont('courier', 'normal');
        fontSize = 10;
        break;
    }

    if (element.type !== 'code') {
      pdf.setFont('helvetica', fontStyle);
    }
    pdf.setFontSize(fontSize);

    const text = prefix + cleanContent;
    const lines = pdf.splitTextToSize(text, maxWidth);

    for (const line of lines) {
      checkPageBreak(lineHeight);
      pdf.text(line, margin, yPosition);
      yPosition += lineHeight;
    }

    yPosition += 2;
  }

  pdf.save(`${filename}.pdf`);
}
