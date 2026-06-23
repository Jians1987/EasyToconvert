"use client";

import React, { useState } from "react";
import ToolLayout from "@/components/ToolLayout";
import Dropzone from "@/components/Dropzone";
import { useConversions } from "@/app/providers";
import { ocrImage } from "@/app/lib/ocr";
import { PDFDocument, degrees, rgb, StandardFonts } from "pdf-lib";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, ImageRun } from "docx";
import * as XLSX from "xlsx";
import { FileText, Star, AlertTriangle, Download, Image as ImageIcon, Type, FileSpreadsheet, Sparkles } from "lucide-react";

// Cloud-AI table extraction (opt-in). Sends a page image to Claude (vision) and
// returns a reconstructed grid. Calls the Messages API directly from the browser
// with the user's own key (no backend; the official SDK can't be bundled client-side).
const extractTableWithClaude = async (apiKey: string, pngBase64: string): Promise<string[][]> => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system:
        "You extract tables from page images into a JSON grid with maximum accuracy. Preserve the original row and column structure and reading order. Use an empty string for blank cells. Never invent or omit data. Respond with JSON only.",
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/png", data: pngBase64 } },
            {
              type: "text",
              text:
                'Extract all tabular data on this page as one combined grid. Respond with ONLY a JSON object of the form {"rows": [["cell", ...], ...]} and no other text.',
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const textBlock = (data.content || []).find((b: any) => b.type === "text");
  const raw = (textBlock?.text ?? "").trim();
  const stripped = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  const slice = start >= 0 && end >= 0 ? stripped.slice(start, end + 1) : stripped;
  const parsed = JSON.parse(slice);
  const rows = Array.isArray(parsed?.rows) ? parsed.rows : [];
  return rows.map((r: any) => (Array.isArray(r) ? r.map((c: any) => String(c ?? "")) : [String(r ?? "")]));
};

type PdfMode = "merge" | "split" | "rotate" | "protect" | "to-doc" | "to-image" | "edit" | "to-excel";

interface TextItem {
  str: string;
  x: number;
  y: number;
}

// Reconstruct a table grid (array of rows of cells) from positioned PDF text items
// by clustering items into rows (similar Y) and columns (similar X).
const reconstructTable = (items: TextItem[]): string[][] => {
  const cleaned = items.filter((i) => i.str && i.str.trim());
  if (cleaned.length === 0) return [];

  // Group into rows (top → bottom) using a small Y tolerance.
  const yTol = 4;
  const byTop = [...cleaned].sort((a, b) => b.y - a.y);
  const rows: { y: number; items: TextItem[] }[] = [];
  for (const it of byTop) {
    let row = rows.find((r) => Math.abs(r.y - it.y) <= yTol);
    if (!row) {
      row = { y: it.y, items: [] };
      rows.push(row);
    }
    row.items.push(it);
  }

  // Derive column anchors from the left edges of every item.
  const xTol = 12;
  const anchors: number[] = [];
  for (const x of cleaned.map((i) => i.x).sort((a, b) => a - b)) {
    if (!anchors.some((a) => Math.abs(a - x) <= xTol)) anchors.push(x);
  }
  anchors.sort((a, b) => a - b);

  // Place each item into its nearest column.
  return rows.map((row) => {
    const cells = new Array(anchors.length).fill("");
    for (const it of [...row.items].sort((a, b) => a.x - b.x)) {
      let ci = 0;
      let best = Infinity;
      anchors.forEach((a, idx) => {
        const d = Math.abs(a - it.x);
        if (d < best) {
          best = d;
          ci = idx;
        }
      });
      cells[ci] = cells[ci] ? `${cells[ci]} ${it.str}` : it.str;
    }
    return cells;
  });
};

// Crude table reconstruction from OCR plain text — split lines on runs of 2+ spaces.
const tableFromOcrText = (text: string): string[][] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s{2,}/));

// A piece of text the user has stamped onto a page in the editor.
interface TextAnnotation {
  id: string;
  page: number; // 1-indexed
  xRatio: number; // 0..1 across page width
  yRatio: number; // 0..1 down from page top
  text: string;
  size: number;
  color: string; // hex
}

// Shared PDF.js loader to avoid duplicate code
const loadPdfJs = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && (window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve((window as any).pdfjsLib);
    };
    script.onerror = () => reject(new Error("Failed to load PDF.js engine."));
    document.head.appendChild(script);
  });
};

// Convert "#rrggbb" into 0..1 channel values for pdf-lib's rgb().
const hexToUnit = (hex: string) => {
  const h = hex.replace("#", "");
  return {
    r: (parseInt(h.substring(0, 2), 16) || 0) / 255,
    g: (parseInt(h.substring(2, 4), 16) || 0) / 255,
    b: (parseInt(h.substring(4, 6), 16) || 0) / 255,
  };
};

// Decode a "data:image/png;base64,...." URL into raw bytes for docx embedding
const dataUrlToUint8Array = (dataUrl: string): Uint8Array => {
  const base64 = dataUrl.substring(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export default function PdfTools() {
  const [mode, setMode] = useState<PdfMode>("merge");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [pdfPassword, setPdfPassword] = useState("");
  const [rotateAngle, setRotateAngle] = useState(90);
  const [splitPages, setSplitPages] = useState("1");
  const [totalPages, setTotalPages] = useState(0);
  const [docFidelity, setDocFidelity] = useState<"layout" | "text">("layout");
  const [cloudEnhance, setCloudEnhance] = useState(false);
  const [cloudApiKey, setCloudApiKey] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [imagePages, setImagePages] = useState<{ url: string; page: number }[]>([]);

  // PDF Editor state
  const [annotations, setAnnotations] = useState<TextAnnotation[]>([]);
  const [editText, setEditText] = useState("Sample text");
  const [editSize, setEditSize] = useState(24);
  const [editColor, setEditColor] = useState("#e11d48");

  const { addHistoryItem, favorites, toggleFavorite } = useConversions();

  const handleFilesSelected = async (files: File[]) => {
    setSelectedFiles(files);
    setDownloadUrl(null);
    setImagePages([]);
    setAnnotations([]);

    // If split mode, read page count immediately
    if (files.length > 0 && (mode === "split" || mode === "to-image")) {
      try {
        const arrayBuffer = await files[0].arrayBuffer();
        const doc = await PDFDocument.load(arrayBuffer);
        const count = doc.getPageCount();
        setTotalPages(count);
        setSplitPages(`1-${count}`);
      } catch {
        setTotalPages(0);
      }
    }

    // In editor mode, render page previews immediately so the user can click to place text
    if (files.length > 0 && mode === "edit") {
      try {
        const arrayBuffer = await files[0].arrayBuffer();
        const pdfjsLib = await loadPdfJs();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        const rendered: { url: string; page: number }[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport }).promise;
            rendered.push({ url: canvas.toDataURL("image/jpeg", 0.85), page: i });
          }
        }
        setImagePages(rendered);
        setTotalPages(pdf.numPages);
      } catch (e) {
        console.error("Editor preview rendering failed:", e);
        alert("Could not render the PDF for editing. Check your connection (the render engine loads from a CDN) or try another file.");
      }
    }
  };

  const addAnnotation = (pageNum: number, e: React.MouseEvent<HTMLImageElement>) => {
    if (!editText.trim()) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const yRatio = (e.clientY - rect.top) / rect.height;
    setAnnotations((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        page: pageNum,
        xRatio,
        yRatio,
        text: editText,
        size: editSize,
        color: editColor,
      },
    ]);
  };

  const removeAnnotation = (id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  };

  // Parse page range string like "1-3, 5, 7-9" into array of 0-indexed page numbers
  const parsePageRange = (rangeStr: string, maxPages: number): number[] => {
    const pages: Set<number> = new Set();
    const parts = rangeStr.split(",").map((s) => s.trim());
    for (const part of parts) {
      if (part.includes("-")) {
        const [startStr, endStr] = part.split("-").map((s) => s.trim());
        const startNum = parseInt(startStr);
        const endNum = parseInt(endStr);
        if (isNaN(startNum) || isNaN(endNum)) continue; // skip invalid ranges
        const start = Math.max(1, startNum);
        const end = Math.min(maxPages, endNum);
        for (let i = start; i <= end; i++) {
          pages.add(i - 1); // 0-indexed
        }
      } else {
        const num = parseInt(part);
        if (!isNaN(num) && num >= 1 && num <= maxPages) {
          pages.add(num - 1);
        }
      }
    }
    return Array.from(pages).sort((a, b) => a - b);
  };

  const processPdf = async () => {
    if (selectedFiles.length === 0) return;
    setProcessing(true);
    setDownloadUrl(null);
    setImagePages([]);

    try {
      if (mode === "merge") {
        const mergedPdf = await PDFDocument.create();
        for (const file of selectedFiles) {
          const arrayBuffer = await file.arrayBuffer();
          const doc = await PDFDocument.load(arrayBuffer);
          const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
          copiedPages.forEach((page) => mergedPdf.addPage(page));
        }
        const pdfBytes = await mergedPdf.save();
        const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);

        addHistoryItem({
          fileName: `merged_${Date.now()}.pdf`,
          fileSize: blob.size,
          toolType: "pdf-merge",
          status: "success",
          downloadUrl: url,
        });
      } else if (mode === "split") {
        const targetFile = selectedFiles[0];
        const arrayBuffer = await targetFile.arrayBuffer();
        const doc = await PDFDocument.load(arrayBuffer);
        const pageCount = doc.getPageCount();
        const pageIndices = parsePageRange(splitPages, pageCount);

        if (pageIndices.length === 0) {
          alert("No valid pages selected. Please enter valid page numbers.");
          setProcessing(false);
          return;
        }

        const splitDoc = await PDFDocument.create();
        const copiedPages = await splitDoc.copyPages(doc, pageIndices);
        copiedPages.forEach((page) => splitDoc.addPage(page));

        const pdfBytes = await splitDoc.save();
        const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);

        addHistoryItem({
          fileName: `split_pages_${splitPages.replace(/\s/g, "")}_${targetFile.name}`,
          fileSize: blob.size,
          toolType: "pdf-split",
          status: "success",
          downloadUrl: url,
        });
      } else if (mode === "rotate") {
        const targetFile = selectedFiles[0];
        const arrayBuffer = await targetFile.arrayBuffer();
        const doc = await PDFDocument.load(arrayBuffer);
        const pages = doc.getPages();
        pages.forEach((page) => {
          page.setRotation(degrees((page.getRotation().angle + rotateAngle) % 360));
        });

        const pdfBytes = await doc.save();
        const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);

        addHistoryItem({
          fileName: `rotated_${targetFile.name}`,
          fileSize: blob.size,
          toolType: "pdf-rotate",
          status: "success",
          downloadUrl: url,
        });
      } else if (mode === "protect") {
        const targetFile = selectedFiles[0];
        const arrayBuffer = await targetFile.arrayBuffer();
        const doc = await PDFDocument.load(arrayBuffer);

        // pdf-lib does not support native encryption; we set metadata tags
        doc.setKeywords(["protected", pdfPassword]);
        doc.setSubject("Protected via Easytoconvert");

        const pdfBytes = await doc.save();
        const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);

        addHistoryItem({
          fileName: `protected_${targetFile.name}`,
          fileSize: blob.size,
          toolType: "pdf-protect",
          status: "success",
          downloadUrl: url,
        });
      } else if (mode === "to-doc") {
        const targetFile = selectedFiles[0];
        const arrayBuffer = await targetFile.arrayBuffer();

        let doc: Document;

        if (docFidelity === "layout") {
          // ── EXACT LAYOUT MODE ──
          // Render every page to a high-resolution image and embed it full-width
          // so the Word document visually matches the PDF exactly (fonts, images,
          // tables, columns, colours — everything is preserved as rendered).
          const pdfjsLib = await loadPdfJs();
          const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
          const pageCount = pdf.numPages;

          // Word Letter page (8.5in) minus 0.5in margins each side → 7.5in usable.
          // docx ImageRun transformation is in pixels at 96dpi → 7.5in * 96 = 720px.
          const USABLE_WIDTH_PX = 720;
          const sectionChildren: Paragraph[] = [];

          for (let i = 1; i <= pageCount; i++) {
            const page = await pdf.getPage(i);
            const baseViewport = page.getViewport({ scale: 1 });
            const aspect = baseViewport.height / baseViewport.width;

            // Render at ~2x the display size for crisp text (≈192 dpi).
            const renderScale = (USABLE_WIDTH_PX * 2) / baseViewport.width;
            const viewport = page.getViewport({ scale: renderScale });
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) continue;

            // White background so transparent PDFs don't render black in Word.
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: ctx, viewport }).promise;

            const pngBytes = dataUrlToUint8Array(canvas.toDataURL("image/png"));

            sectionChildren.push(
              new Paragraph({
                pageBreakBefore: i > 1,
                children: [
                  new ImageRun({
                    type: "png",
                    data: pngBytes,
                    transformation: {
                      width: USABLE_WIDTH_PX,
                      height: Math.round(USABLE_WIDTH_PX * aspect),
                    },
                  }),
                ],
              })
            );
          }

          doc = new Document({
            sections: [
              {
                properties: {
                  page: {
                    margin: { top: 720, bottom: 720, left: 720, right: 720 }, // 0.5in in twips
                  },
                },
                children: sectionChildren,
              },
            ],
          });
        } else {
          // ── EDITABLE TEXT MODE ──
          // Reflow the extracted text into editable paragraphs. Layout is approximate
          // but the resulting text is fully selectable and editable in Word.
          let paragraphs: Paragraph[] = [];
          let pageCount = 0;

          try {
            const pdfjsLib = await loadPdfJs();
            const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
            pageCount = pdf.numPages;

            paragraphs.push(
              new Paragraph({
                children: [new TextRun({ text: `Converted: ${targetFile.name}`, bold: true, size: 32 })],
                heading: HeadingLevel.HEADING_1,
                spacing: { after: 200 },
              })
            );
            paragraphs.push(
              new Paragraph({
                children: [new TextRun({ text: `Total Pages: ${pageCount} | File Size: ${(targetFile.size / 1024).toFixed(1)} KB`, size: 20, color: "666666" })],
                spacing: { after: 300 },
              })
            );

            for (let i = 1; i <= pageCount; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const items = textContent.items;

              paragraphs.push(
                new Paragraph({
                  children: [new TextRun({ text: `Page ${i}`, bold: true, size: 26, color: "4f46e5" })],
                  heading: HeadingLevel.HEADING_2,
                  spacing: { before: 400, after: 200 },
                  border: {
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: "e5e7eb" },
                  },
                })
              );

              const sortedItems = [...items].sort((a: any, b: any) => {
                const yDiff = b.transform[5] - a.transform[5];
                if (Math.abs(yDiff) > 5) return yDiff;
                return a.transform[4] - b.transform[4];
              });

              let currentLine = "";
              let lastY = -1;
              let lastFontSize = 12;

              for (const item of sortedItems) {
                const y = item.transform[5];
                const text = (item as any).str;
                if (!text || !text.trim()) continue;

                const fontSize = Math.round(Math.abs((item as any).transform[3]) || 12);

                if (lastY === -1) {
                  currentLine = text;
                  lastY = y;
                  lastFontSize = fontSize;
                } else if (Math.abs(lastY - y) > 5) {
                  if (currentLine.trim()) {
                    const isBold = lastFontSize > 14;
                    paragraphs.push(
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: currentLine.trim(),
                            bold: isBold,
                            size: Math.min(Math.max(lastFontSize * 2, 18), 48),
                          }),
                        ],
                        spacing: { after: 100 },
                      })
                    );
                  }
                  currentLine = text;
                  lastY = y;
                  lastFontSize = fontSize;
                } else {
                  currentLine += " " + text;
                }
              }

              if (currentLine.trim()) {
                paragraphs.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: currentLine.trim(),
                        size: Math.min(Math.max(lastFontSize * 2, 18), 48),
                      }),
                    ],
                    spacing: { after: 100 },
                  })
                );
              }

              if (sortedItems.length === 0 || !sortedItems.some((item: any) => item.str?.trim())) {
                // Scanned page — recognize text locally with OCR for precise extraction.
                try {
                  const viewport = page.getViewport({ scale: 2.0 });
                  const canvas = document.createElement("canvas");
                  canvas.width = viewport.width;
                  canvas.height = viewport.height;
                  const ctx = canvas.getContext("2d");
                  let ocrText = "";
                  if (ctx) {
                    await page.render({ canvasContext: ctx, viewport }).promise;
                    ocrText = (await ocrImage(canvas)).text;
                  }
                  if (ocrText.trim()) {
                    ocrText.split("\n").forEach((line) => {
                      if (line.trim()) {
                        paragraphs.push(
                          new Paragraph({
                            children: [new TextRun({ text: line.trim(), size: 22 })],
                            spacing: { after: 80 },
                          })
                        );
                      }
                    });
                  } else {
                    paragraphs.push(
                      new Paragraph({
                        children: [new TextRun({ text: "[Scanned page — OCR found no readable text]", italics: true, color: "999999", size: 20 })],
                        spacing: { after: 200 },
                      })
                    );
                  }
                } catch (ocrErr) {
                  console.error("OCR fallback failed:", ocrErr);
                  paragraphs.push(
                    new Paragraph({
                      children: [new TextRun({ text: "[Scanned page — text could not be recognized]", italics: true, color: "999999", size: 20 })],
                      spacing: { after: 200 },
                    })
                  );
                }
              }
            }
          } catch (e) {
            console.error("PDF.js extraction failed:", e);
            const fallbackDoc = await PDFDocument.load(arrayBuffer);
            pageCount = fallbackDoc.getPageCount();
            paragraphs = [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `PDF text extraction failed. The document has ${pageCount} pages. The PDF may contain scanned images instead of selectable text — try Exact Layout mode.`,
                    size: 22,
                  }),
                ],
              }),
            ];
          }

          doc = new Document({
            sections: [{ children: paragraphs }],
          });
        }

        const docBlob = await Packer.toBlob(doc);
        const url = URL.createObjectURL(docBlob);
        setDownloadUrl(url);

        addHistoryItem({
          fileName: `${targetFile.name.split(".")[0]}.docx`,
          fileSize: docBlob.size,
          toolType: "pdf-to-doc",
          status: "success",
          downloadUrl: url,
        });
      } else if (mode === "to-image") {
        const targetFile = selectedFiles[0];
        const arrayBuffer = await targetFile.arrayBuffer();

        try {
          const pdfjsLib = await loadPdfJs();
          const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
          const numPages = pdf.numPages;
          const renderedPages: { url: string; page: number }[] = [];

          for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext("2d");

            if (ctx) {
              await page.render({ canvasContext: ctx, viewport }).promise;
              const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
              renderedPages.push({ url: dataUrl, page: i });
            }
          }

          setImagePages(renderedPages);

          if (renderedPages.length > 0) {
            setDownloadUrl(renderedPages[0].url);

            const firstDataUrl = renderedPages[0].url;
            const strLength = firstDataUrl.length - (firstDataUrl.indexOf(",") + 1);
            const estSize = Math.round((strLength * 3) / 4);

            addHistoryItem({
              fileName: `${targetFile.name.split(".")[0]}_${numPages}_pages.jpg`,
              fileSize: estSize * numPages,
              toolType: "pdf-to-image",
              status: "success",
              downloadUrl: renderedPages[0].url,
            });
          }
        } catch (e) {
          console.error("PDF to Image rendering failed:", e);
          alert("Error rendering PDF to image. Please check if the file is secure or corrupted.");
        }
      } else if (mode === "edit") {
        const targetFile = selectedFiles[0];
        if (annotations.length === 0) {
          alert("Add at least one text item by clicking on a page before applying.");
          setProcessing(false);
          return;
        }

        const arrayBuffer = await targetFile.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const pages = pdfDoc.getPages();

        for (const ann of annotations) {
          const page = pages[ann.page - 1];
          if (!page) continue;
          const { width, height } = page.getSize();
          const { r, g, b } = hexToUnit(ann.color);
          // Convert top-left ratio to pdf-lib's bottom-left coordinate space.
          const x = ann.xRatio * width;
          const yTop = (1 - ann.yRatio) * height;
          const lines = ann.text.split("\n");
          lines.forEach((line, idx) => {
            page.drawText(line, {
              x,
              y: yTop - ann.size * (idx + 1),
              size: ann.size,
              font,
              color: rgb(r, g, b),
            });
          });
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);

        addHistoryItem({
          fileName: `edited_${targetFile.name}`,
          fileSize: blob.size,
          toolType: "pdf-edit",
          status: "success",
          downloadUrl: url,
        });
      } else if (mode === "to-excel") {
        const targetFile = selectedFiles[0];
        const arrayBuffer = await targetFile.arrayBuffer();
        const pdfjsLib = await loadPdfJs();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        const numPages = pdf.numPages;

        const wb = XLSX.utils.book_new();
        const useCloud = cloudEnhance && cloudApiKey.trim().length > 0;
        let cloudFailures = 0;

        // Render a page to a PNG canvas (reused for cloud AI and OCR fallback).
        const renderPage = async (page: any) => {
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (ctx) await page.render({ canvasContext: ctx, viewport }).promise;
          return canvas;
        };

        const onDeviceGrid = async (page: any, items: TextItem[]) => {
          if (items.length > 0) return reconstructTable(items);
          const canvas = await renderPage(page);
          return tableFromOcrText((await ocrImage(canvas)).text);
        };

        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const items: TextItem[] = textContent.items
            .map((it: any) => ({ str: it.str, x: it.transform[4], y: it.transform[5] }))
            .filter((it: TextItem) => it.str && it.str.trim());

          let grid: string[][];
          if (useCloud) {
            try {
              const canvas = await renderPage(page);
              const b64 = canvas.toDataURL("image/png").split(",")[1] || "";
              grid = await extractTableWithClaude(cloudApiKey.trim(), b64);
              if (grid.length === 0) grid = await onDeviceGrid(page, items);
            } catch (e) {
              console.error(`Cloud AI extraction failed on page ${i}, using on-device:`, e);
              cloudFailures++;
              grid = await onDeviceGrid(page, items);
            }
          } else {
            grid = await onDeviceGrid(page, items);
          }

          if (grid.length === 0) grid = [["(no tabular data detected on this page)"]];
          const ws = XLSX.utils.aoa_to_sheet(grid);
          XLSX.utils.book_append_sheet(wb, ws, `Page ${i}`.slice(0, 31));
        }

        if (useCloud && cloudFailures === numPages) {
          alert("Cloud AI extraction failed for every page (check your API key, billing, and connection). Used on-device extraction instead.");
        } else if (useCloud && cloudFailures > 0) {
          alert(`Cloud AI extraction failed on ${cloudFailures} of ${numPages} page(s); those pages used on-device extraction.`);
        }

        const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
        const blob = new Blob([out], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);

        addHistoryItem({
          fileName: `${targetFile.name.split(".")[0]}.xlsx`,
          fileSize: blob.size,
          toolType: "pdf-to-excel",
          status: "success",
          downloadUrl: url,
        });
      }
    } catch (error) {
      console.error(error);
      alert("Error processing PDF document. Ensure the file is not corrupted or password protected.");
    } finally {
      setProcessing(false);
    }
  };

  const isPinned = favorites.includes("pdf-suite");

  return (
    <ToolLayout
      title="PDF Suite Tools"
      description="Merge multiple PDFs, split documents, rotate orientations, or convert to Word/Image entirely in your browser."
      category="pdf"
    >
      <div className="space-y-6">
        {/* Toggle Pin & Tabs */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex space-x-2 overflow-x-auto scrollbar-none pb-1">
            {[
              { id: "merge", label: "Merge PDF" },
              { id: "split", label: "Split PDF" },
              { id: "rotate", label: "Rotate PDF" },
              { id: "protect", label: "Protect PDF" },
              { id: "to-doc", label: "PDF to Word" },
              { id: "to-excel", label: "PDF to Excel" },
              { id: "to-image", label: "PDF to Image" },
              { id: "edit", label: "PDF Editor" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setMode(t.id as PdfMode);
                  setDownloadUrl(null);
                  setSelectedFiles([]);
                  setImagePages([]);
                  setTotalPages(0);
                  setAnnotations([]);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  mode === t.id
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => toggleFavorite("pdf-suite")}
            className={`p-1.5 rounded-lg border transition-all ${
              isPinned
                ? "border-amber-200/50 bg-amber-500/10 text-amber-500"
                : "border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            }`}
            title={isPinned ? "Unpin tool" : "Pin tool"}
          >
            <Star className={`w-4 h-4 ${isPinned ? "fill-amber-500" : ""}`} />
          </button>
        </div>

        {/* Protect Mode Disclaimer */}
        {mode === "protect" && (
          <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-50/50 dark:bg-red-950/10 flex items-start space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-red-700 dark:text-red-400 space-y-1">
              <span className="font-bold block">⚠ No Real Encryption — Metadata Tag Only</span>
              <span>Browser-based PDF libraries <strong>cannot apply real password encryption</strong>. The label you enter below is stored as a plain-text keyword tag in the PDF metadata — anyone can read it in any PDF viewer. <strong>Do not use this for confidential files.</strong> For true password protection, use Adobe Acrobat or a desktop PDF tool.</span>
            </div>
          </div>
        )}

        {/* PDF to Excel info */}
        {mode === "to-excel" && (
          <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/10 flex items-start space-x-2.5">
            <FileSpreadsheet className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-emerald-700 dark:text-emerald-400 space-y-1">
              <span className="font-bold block">Smart Table Extraction → .xlsx</span>
              <span>
                Tables are reconstructed by clustering the PDF&apos;s text into rows and columns; scanned pages are read with on-device OCR. Each PDF page becomes a worksheet. Accuracy depends on the document — clean digital tables convert near-perfectly, while merged cells or complex layouts may need a quick review.
              </span>
            </div>
          </div>
        )}

        {/* Optional cloud-AI enhancement for messy/scanned tables */}
        {mode === "to-excel" && (
          <div className="space-y-2.5 max-w-xl">
            <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                className="rounded text-indigo-500 focus:ring-indigo-500/50"
                checked={cloudEnhance}
                onChange={(e) => setCloudEnhance(e.target.checked)}
              />
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Enhance with cloud AI (Claude) — for messy or scanned tables</span>
            </label>
            {cloudEnhance && (
              <div className="space-y-2 p-3 rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/10">
                <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                  ⚠ This sends each page <strong>image to Anthropic&apos;s API</strong> to maximize table accuracy — your document leaves your browser. You must supply your <strong>own Anthropic API key</strong> (usage is billed to you). The key is used only in your browser for this conversion and is never stored.
                </p>
                <input
                  type="password"
                  placeholder="Anthropic API key (sk-ant-...)"
                  className="w-full glass-input text-xs"
                  value={cloudApiKey}
                  onChange={(e) => setCloudApiKey(e.target.value)}
                  autoComplete="off"
                />
              </div>
            )}
          </div>
        )}

        {/* Dropzone selection */}
        <Dropzone
          onFilesSelected={handleFilesSelected}
          accept="application/pdf"
          multiple={mode === "merge"}
          maxSizeMB={50}
          title={
            mode === "merge"
              ? "Drag & drop multiple PDFs to merge"
              : mode === "edit"
              ? "Drag & drop a PDF to edit"
              : mode === "to-excel"
              ? "Drag & drop a PDF with tables to extract"
              : "Drag & drop a PDF file to process"
          }
        />

        {/* Configurations */}
        {selectedFiles.length > 0 && (
          <div className="space-y-4 pt-2">
            {/* Split Page Range */}
            {mode === "split" && (
              <div className="space-y-2 max-w-md">
                <label className="text-[10px] uppercase font-bold text-slate-400">
                  Page Range to Extract {totalPages > 0 && `(Total: ${totalPages} pages)`}
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1-3, 5, 7-9"
                  className="w-full glass-input text-xs"
                  value={splitPages}
                  onChange={(e) => setSplitPages(e.target.value)}
                />
                <p className="text-[10px] text-slate-400">
                  Separate pages with commas, use dashes for ranges. Example: 1-3, 5, 8-10
                </p>
              </div>
            )}

            {mode === "rotate" && (
              <div className="space-y-1.5 max-w-xs">
                <label className="text-[10px] uppercase font-bold text-slate-400">Rotation Angle</label>
                <div className="flex space-x-2">
                  {[90, 180, 270].map((angle) => (
                    <button
                      key={angle}
                      onClick={() => setRotateAngle(angle)}
                      className={`flex-grow py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                        rotateAngle === angle
                          ? "border-indigo-500 text-indigo-500 bg-indigo-50/10 dark:bg-indigo-950/10"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                      }`}
                    >
                      {angle}°
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === "protect" && (
              <div className="space-y-1.5 max-w-xs">
                <label className="text-[10px] uppercase font-bold text-slate-400">Metadata Label (not a real password)</label>
                <input
                  type="text"
                  placeholder="e.g. Confidential — Internal Use"
                  className="w-full glass-input text-xs"
                  value={pdfPassword}
                  onChange={(e) => setPdfPassword(e.target.value)}
                />
              </div>
            )}

            {mode === "to-doc" && (
              <div className="space-y-2 max-w-md">
                <label className="text-[10px] uppercase font-bold text-slate-400">Conversion Fidelity</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setDocFidelity("layout")}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      docFidelity === "layout"
                        ? "border-indigo-500 bg-indigo-50/10 dark:bg-indigo-950/10"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Exact Layout</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">Pixel-perfect — preserves images, tables, fonts & columns exactly as the PDF.</span>
                  </button>
                  <button
                    onClick={() => setDocFidelity("text")}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      docFidelity === "text"
                        ? "border-indigo-500 bg-indigo-50/10 dark:bg-indigo-950/10"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Editable Text</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">Fully selectable & editable text. Layout is approximate; images are skipped.</span>
                  </button>
                </div>
              </div>
            )}

            {/* PDF Editor toolbar */}
            {mode === "edit" && (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl border border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/10 flex items-start space-x-2.5">
                  <Type className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-indigo-700 dark:text-indigo-400">
                    <span className="font-bold block">Click anywhere on a page to stamp your text</span>
                    <span>Set the text, size, and color below, then click the spot on the page where it should appear. Add as many as you like, then apply.</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1 flex-grow min-w-[200px]">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Text to add</label>
                    <input
                      type="text"
                      className="w-full glass-input text-xs"
                      placeholder="Type the text to stamp..."
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1 w-28">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Size ({editSize}px)</label>
                    <input
                      type="range"
                      min="8"
                      max="72"
                      className="w-full accent-indigo-500"
                      value={editSize}
                      onChange={(e) => setEditSize(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Color</label>
                    <input
                      type="color"
                      className="w-10 h-8 rounded cursor-pointer border bg-transparent block"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                    />
                  </div>
                </div>

                {annotations.length > 0 && (
                  <div className="text-[10px] text-slate-400">
                    {annotations.length} text item{annotations.length > 1 ? "s" : ""} placed. Click a marker on a page to remove it.
                  </div>
                )}
              </div>
            )}

            {/* Execute Button */}
            <button
              onClick={processPdf}
              disabled={
                processing ||
                (mode === "protect" && !pdfPassword) ||
                (mode === "edit" && annotations.length === 0) ||
                (mode === "to-excel" && cloudEnhance && !cloudApiKey.trim())
              }
              className="px-6 py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-all flex items-center space-x-1.5 shadow-md"
            >
              <span>
                {processing
                  ? "Processing File..."
                  : mode === "edit"
                  ? "Apply Edits & Download"
                  : mode === "to-excel"
                  ? "Convert to Excel"
                  : `Apply PDF ${mode}`}
              </span>
            </button>
          </div>
        )}

        {/* Editor canvas (for edit mode) — click a page to stamp text */}
        {mode === "edit" && imagePages.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Editor — {imagePages.length} page{imagePages.length > 1 ? "s" : ""}
            </h4>
            <div className="space-y-6">
              {imagePages.map((img) => (
                <div key={img.page} className="space-y-1.5">
                  <span className="text-[10px] font-semibold text-slate-500">Page {img.page}</span>
                  <div className="relative inline-block w-full max-w-2xl rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white">
                    <img
                      src={img.url}
                      alt={`Page ${img.page}`}
                      onClick={(e) => addAnnotation(img.page, e)}
                      className="w-full h-auto cursor-crosshair select-none"
                      draggable={false}
                    />
                    {annotations
                      .filter((a) => a.page === img.page)
                      .map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => removeAnnotation(a.id)}
                          title="Click to remove this text"
                          className="absolute group"
                          style={{
                            left: `${a.xRatio * 100}%`,
                            top: `${a.yRatio * 100}%`,
                            color: a.color,
                            fontSize: `${Math.max(8, a.size * 0.6)}px`,
                            lineHeight: 1,
                          }}
                        >
                          <span className="whitespace-pre font-semibold border border-dashed border-transparent group-hover:border-red-400 group-hover:bg-red-50/40 rounded-sm px-0.5">
                            {a.text}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Image Gallery (for to-image mode) — shown for all page counts */}
        {mode === "to-image" && imagePages.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {imagePages.length === 1 ? "Page Rendered" : `All Pages Rendered (${imagePages.length} pages)`}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {imagePages.map((img) => (
                <div
                  key={img.page}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 group"
                >
                  <img
                    src={img.url}
                    alt={`Page ${img.page}`}
                    className="w-full h-auto"
                  />
                  <div className="p-2.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-semibold text-slate-500">Page {img.page}</span>
                    <a
                      href={img.url}
                      download={`page_${img.page}.jpg`}
                      className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 flex items-center space-x-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>Save</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Download Output */}
        {downloadUrl && (
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded bg-emerald-500/10 text-emerald-500">
                {mode === "to-image" ? (
                  <ImageIcon className="w-5 h-5" />
                ) : mode === "to-excel" ? (
                  <FileSpreadsheet className="w-5 h-5" />
                ) : (
                  <FileText className="w-5 h-5" />
                )}
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Success! File Ready</span>
                <span className="text-[10px] text-slate-400">
                  {mode === "to-image" && imagePages.length > 1
                    ? `${imagePages.length} pages rendered. Download individually above or the first page below.`
                    : "Your processed file is ready for download."}
                </span>
              </div>
            </div>
            <a
              href={downloadUrl}
              download={
                mode === "merge"
                  ? `merged_${Date.now()}.pdf`
                  : mode === "to-doc"
                  ? `${selectedFiles[0]?.name.split(".")[0] || "document"}.docx`
                  : mode === "to-excel"
                  ? `${selectedFiles[0]?.name.split(".")[0] || "tables"}.xlsx`
                  : mode === "to-image"
                  ? `${selectedFiles[0]?.name.split(".")[0] || "preview"}_page1.jpg`
                  : mode === "edit"
                  ? `edited_${selectedFiles[0]?.name || "document.pdf"}`
                  : `${mode}_pdf_${Date.now()}.pdf`
              }
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-sm"
            >
              Download {mode === "to-doc" ? ".docx" : mode === "to-excel" ? ".xlsx" : mode === "to-image" ? "Page 1" : "File"}
            </a>
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
