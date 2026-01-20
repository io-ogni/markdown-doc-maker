import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { marked } from 'marked';
import jsPDF from 'jspdf';

interface ParsedElement {
  type: 'heading1' | 'heading2' | 'heading3' | 'paragraph' | 'list-item' | 'code' | 'blockquote';
  content: string;
  bold?: boolean;
  italic?: boolean;
}

function parseMarkdown(markdown: string): ParsedElement[] {
  const lines = markdown.split('\n');
  const elements: ParsedElement[] = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    if (line.startsWith('### ')) {
      elements.push({ type: 'heading3', content: line.slice(4) });
    } else if (line.startsWith('## ')) {
      elements.push({ type: 'heading2', content: line.slice(3) });
    } else if (line.startsWith('# ')) {
      elements.push({ type: 'heading1', content: line.slice(2) });
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push({ type: 'list-item', content: line.slice(2) });
    } else if (line.startsWith('> ')) {
      elements.push({ type: 'blockquote', content: line.slice(2) });
    } else if (line.startsWith('```') || line.startsWith('`')) {
      elements.push({ type: 'code', content: line.replace(/`/g, '') });
    } else {
      elements.push({ type: 'paragraph', content: line });
    }
  }

  return elements;
}

function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let remaining = text;

  // Simple regex for bold and italic
  const boldItalicRegex = /\*\*\*(.*?)\*\*\*/g;
  const boldRegex = /\*\*(.*?)\*\*/g;
  const italicRegex = /\*(.*?)\*/g;

  // Replace patterns and track formatting
  remaining = remaining.replace(boldItalicRegex, '<<<BI>>>$1<<</BI>>>');
  remaining = remaining.replace(boldRegex, '<<<B>>>$1<<<B>>>');
  remaining = remaining.replace(italicRegex, '<<<I>>>$1<<<I>>>');

  // For simplicity, just return plain text with basic parsing
  const cleanText = text
    .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1');

  runs.push(new TextRun({ text: cleanText }));
  return runs;
}

export async function generateWordDocument(markdown: string, filename: string): Promise<void> {
  const elements = parseMarkdown(markdown);
  const children: Paragraph[] = [];

  for (const element of elements) {
    const cleanContent = element.content
      .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1');

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
      case 'list-item':
        children.push(new Paragraph({
          children: [new TextRun({ text: `• ${cleanContent}` })],
          spacing: { before: 100, after: 100 },
          indent: { left: 720 },
        }));
        break;
      case 'blockquote':
        children.push(new Paragraph({
          children: [new TextRun({ text: cleanContent, italics: true })],
          spacing: { before: 200, after: 200 },
          indent: { left: 720 },
        }));
        break;
      case 'code':
        children.push(new Paragraph({
          children: [new TextRun({ text: cleanContent, font: 'Courier New' })],
          spacing: { before: 100, after: 100 },
        }));
        break;
      default:
        children.push(new Paragraph({
          children: [new TextRun({ text: cleanContent })],
          spacing: { before: 100, after: 100 },
        }));
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

  for (const element of elements) {
    const cleanContent = element.content
      .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1');

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
      case 'list-item':
        prefix = '• ';
        break;
      case 'blockquote':
        fontStyle = 'italic';
        break;
      case 'code':
        pdf.setFont('courier', 'normal');
        break;
    }

    if (element.type !== 'code') {
      pdf.setFont('helvetica', fontStyle);
    }
    pdf.setFontSize(fontSize);

    const text = prefix + cleanContent;
    const lines = pdf.splitTextToSize(text, maxWidth);

    for (const line of lines) {
      if (yPosition + lineHeight > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.text(line, margin, yPosition);
      yPosition += lineHeight;
    }

    yPosition += 2;
  }

  pdf.save(`${filename}.pdf`);
}
