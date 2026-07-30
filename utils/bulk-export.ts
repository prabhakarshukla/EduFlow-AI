import jsPDF from "jspdf";
import { marked } from "marked";
import { supabase } from "../../../lib/supabase";

export type ExportFormat = "pdf" | "markdown" | "txt";

export interface ExportItem {
  id: string;
  title: string;
  content: string;
  subject?: string | null;
  created_at: string;
}

export interface BulkExportOptions {
  format: ExportFormat;
  items: ExportItem[];
  filename?: string;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  contentType: string;
}

const ALLOWED_ORIGINS = ["http://localhost:3000", "https://eduflow-ai.vercel.app"];

function getFormattedDate(): string {
  return new Date().toISOString().split("T")[0];
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 50);
}

export async function exportToMarkdown(items: ExportItem[]): Promise<ExportResult> {
  const lines: string[] = [
    `# EduFlow AI Notes Export`,
    `Date: ${getFormattedDate()}`,
    `Total Items: ${items.length}`,
    ``,
    `---`,
    ``,
  ];

  for (const item of items) {
    const date = new Date(item.created_at).toLocaleDateString();
    lines.push(
      `## ${item.title || "Untitled Note"}`,
      `*Subject: ${item.subject || "General"} | Created: ${date}*`,
      ``,
    );

    const cleanContent = item.content.replace(/<[^>]*>/g, "");
    lines.push(cleanContent, ``, `---`, ``);
  }

  const content = lines.join("\n");
  const blob = new Blob([content], { type: "text/markdown; charset=utf-8" });

  return {
    blob,
    filename: `eduflow-notes-${getFormattedDate()}.md`,
    contentType: "text/markdown",
  };
}

export async function exportToPDF(items: ExportItem[]): Promise<ExportResult> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  let yPosition = margin;

  // Title page
  doc.setFillColor(110, 231, 216);
  doc.rect(margin, yPosition, contentWidth, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("EduFlow AI", margin + 5, yPosition + 7);
  yPosition += 14;

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(18);
  doc.text("Notes Export", margin, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Date: ${getFormattedDate()} | Items: ${items.length}`, margin, yPosition);
  yPosition += 12;

  for (const item of items) {
    // Add page break if needed
    if (yPosition > 260) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setTextColor(30, 30, 30);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    const titleLines = doc.splitTextToSize(item.title || "Untitled Note", contentWidth);
    doc.text(titleLines, margin, yPosition);
    yPosition += titleLines.length * 6 + 2;

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    const meta = `Subject: ${item.subject || "General"} | Created: ${new Date(item.created_at).toLocaleDateString()}`;
    doc.text(meta, margin, yPosition);
    yPosition += 6;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 6;

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const cleanContent = item.content.replace(/<[^>]*>/g, "").trim();
    if (!cleanContent) {
      doc.setTextColor(100, 100, 100);
      doc.setFont("helvetica", "italic");
      doc.text("No content available.", margin, yPosition);
      yPosition += 8;
    } else {
      const contentLines = doc.splitTextToSize(cleanContent, contentWidth);
      let currentLine = 0;
      while (currentLine < contentLines.length) {
        if (yPosition > 260) {
          doc.addPage();
          yPosition = margin;
        }
        const line = contentLines[currentLine];
        doc.text(line, margin, yPosition);
        yPosition += 5;
        currentLine++;
      }
    }

    yPosition += 8;
  }

  const blob = doc.output("blob");
  return {
    blob,
    filename: `eduflow-notes-${getFormattedDate()}.pdf`,
    contentType: "application/pdf",
  };
}

export async function exportToTXT(items: ExportItem[]): Promise<ExportResult> {
  const lines: string[] = [
    "EduFlow AI Notes Export",
    `Date: ${getFormattedDate()}`,
    `Total Items: ${items.length}`,
    "",
    "=" .repeat(50),
    "",
  ];

  for (const item of items) {
    const date = new Date(item.created_at).toLocaleDateString();
    lines.push(
      item.title || "Untitled Note",
      `Subject: ${item.subject || "General"} | Created: ${date}`,
      "",
    );

    const cleanContent = item.content.replace(/<[^>]*>/g, "");
    lines.push(cleanContent, "", "-".repeat(30), "");
  }

  const content = lines.join("\n");
  const blob = new Blob([content], { type: "text/plain; charset=utf-8" });

  return {
    blob,
    filename: `eduflow-notes-${getFormattedDate()}.txt`,
    contentType: "text/plain",
  };
}

export async function performBulkExport({
  format,
  items,
}: BulkExportOptions): Promise<ExportResult> {
  switch (format) {
    case "pdf":
      return exportToPDF(items);
    case "markdown":
      return exportToMarkdown(items);
    case "txt":
      return exportToTXT(items);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

export function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

