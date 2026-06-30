"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import ToolLayout from "@/components/ToolLayout";
import Dropzone from "@/components/Dropzone";
import { useConversions } from "@/app/providers";
import { ocrImage } from "@/app/lib/ocr";
import { extractTables, type PdfTextItem } from "@/app/lib/tableExtractor";
import { PDFDocument, degrees, rgb, StandardFonts } from "pdf-lib";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, ImageRun } from "docx";
import * as XLSX from "xlsx";
import { 
  FileText, Star, AlertTriangle, Download, Image as ImageIcon, Type, FileSpreadsheet, Sparkles,
  Trash2, RotateCw, ArrowUp, ArrowDown, Plus, Square, Circle as CircleIcon, PenTool, Edit3,
  Paintbrush, ChevronsUpDown, MousePointer, Check, ArrowRight, Upload, Signature
} from "lucide-react";

// Cloud-AI table extraction (opt-in). Sends a page image to Claude (vision) and
// returns a reconstructed grid. Calls the Messages API directly from the browser
// with the user's own key.
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

type PdfMode = "merge" | "split" | "rotate" | "protect" | "to-doc" | "to-excel" | "to-image" | "edit";

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

  const xTol = 12;
  const anchors: number[] = [];
  for (const x of cleaned.map((i) => i.x).sort((a, b) => a - b)) {
    if (!anchors.some((a) => Math.abs(a - x) <= xTol)) anchors.push(x);
  }
  anchors.sort((a, b) => a - b);

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

const tableFromOcrText = (text: string): string[][] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s{2,}/));

// Render a PDF page to a canvas and return canvas-space text items (top-left origin)
// suitable for Microsoft Table Transformer cell-mapping in tableExtractor.ts.
async function renderPageForTatr(
  page: any,
  scale = 2.0
): Promise<{ canvas: HTMLCanvasElement; textItems: PdfTextItem[] }> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (ctx) await page.render({ canvasContext: ctx, viewport }).promise;

  const content = await page.getTextContent();
  const textItems: PdfTextItem[] = [];
  for (const item of content.items as any[]) {
    if (!item.str?.trim()) continue;
    const [, , , , tx, ty] = item.transform as number[];
    const x = tx * scale;
    const h = Math.max((item.height ?? item.fontSize ?? 10) * scale, 4);
    // PDF.js origin is bottom-left; flip to canvas top-left.
    const y = canvas.height - ty * scale - h;
    const w = Math.max((item.width ?? 0) * scale, 4);
    textItems.push({ text: item.str, x, y, width: w, height: h });
  }
  return { canvas, textItems };
}

// Advanced PDF Editor Annotation Layer
interface Annotation {
  id: string;
  page: number; // 1-indexed (relative to pageLayout list)
  type: "text" | "draw" | "highlight" | "rect" | "circle" | "line" | "arrow" | "signature" | "image";
  x: number; // 0..1000 scale-independent coordinate
  y: number;
  width?: number;
  height?: number;
  text?: string;
  size?: number; // text font size or stroke size
  color?: string; // hex color
  points?: { x: number; y: number }[]; // for freehand pencil/highlight
  dataUrl?: string; // base64 representation of signature or image stamp
}

interface PageLayoutItem {
  id: string;
  originalIndex: number; // -1 for blank page
  rotation: number; // 0, 90, 180, 270
}

// Shared PDF.js loader
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

const hexToUnit = (hex: string) => {
  const h = hex.replace("#", "");
  return {
    r: (parseInt(h.substring(0, 2), 16) || 0) / 255,
    g: (parseInt(h.substring(2, 4), 16) || 0) / 255,
    b: (parseInt(h.substring(4, 6), 16) || 0) / 255,
  };
};

const dataUrlToUint8Array = (dataUrl: string): Uint8Array => {
  const base64 = dataUrl.substring(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

// Helper for drawing SVG path points
const pointsToPath = (points?: { x: number; y: number }[]) => {
  if (!points || points.length === 0) return "";
  return `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ");
};

// Helper to compute bounding box of any annotation type
const getAnnBounds = (ann: Annotation) => {
  if (ann.type === "draw" || ann.type === "highlight") {
    if (!ann.points || ann.points.length === 0) return { x: ann.x, y: ann.y, w: 20, h: 20 };
    const xs = ann.points.map(p => p.x);
    const ys = ann.points.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, w: Math.max(10, maxX - minX), h: Math.max(10, maxY - minY) };
  }
  const w = ann.width ?? (ann.type === "text" ? Math.max(20, (ann.text ?? "").length * (ann.size ?? 16) * 0.6) : 100);
  const h = ann.height ?? (ann.type === "text" ? (ann.size ?? 16) * 1.2 : 50);
  return { x: ann.x, y: ann.y, w, h };
};

export function PdfPageClient() {
  const [mode, setMode] = useState<PdfMode>("merge");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [pdfPassword, setPdfPassword] = useState("");
  const [inputPassword, setInputPassword] = useState("");
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [rotateAngle, setRotateAngle] = useState(90);
  const [splitPages, setSplitPages] = useState("1");
  const [totalPages, setTotalPages] = useState(0);
  const [docFidelity, setDocFidelity] = useState<"layout" | "text">("layout");
  const [cloudEnhance, setCloudEnhance] = useState(false);
  const [cloudApiKey, setCloudApiKey] = useState("");
  // Engine selector for PDF → Excel. "tatr" = Microsoft Table Transformer (on-device DETR);
  // "cluster" = legacy X/Y text-position clustering.
  const [tableEngine, setTableEngine] = useState<"tatr" | "cluster">("tatr");
  const [tatrProgressLabel, setTatrProgressLabel] = useState("");
  const [tatrProgressPct, setTatrProgressPct] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [imagePages, setImagePages] = useState<{ url: string; page: number }[]>([]);

  // Advanced PDF Editor toolbar states
  const [toolMode, setToolMode] = useState<
    "select" | "text" | "draw" | "highlight" | "rect" | "circle" | "line" | "arrow" | "signature" | "image"
  >("select");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null);

  // Styling properties
  const [editColor, setEditColor] = useState("#d9230f");
  const [editSize, setEditSize] = useState(18);
  const [editText, setEditText] = useState("Tap to edit");

  // Page layout and reordering organizer
  const [pageLayout, setPageLayout] = useState<PageLayoutItem[]>([]);

  // Drag and draw states
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState<{ x: number; y: number }[]>([]);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragAction, setDragAction] = useState<"move" | "resize" | null>(null);

  const [shapeStart, setShapeStart] = useState<{ x: number; y: number } | null>(null);
  const [shapeCurrent, setShapeCurrent] = useState<{ x: number; y: number } | null>(null);

  // Signature modal states
  const [showSigModal, setShowSigModal] = useState(false);
  const [sigDrawType, setSigDrawType] = useState<"draw" | "type">("draw");
  const [typedSigText, setTypedSigText] = useState("Signature");
  const [typedSigFont, setTypedSigFont] = useState("font-cursive");
  const [currentSignatureUrl, setCurrentSignatureUrl] = useState<string | null>(null);

  // Image stamp states
  const [imageStampData, setImageStampData] = useState<string | null>(null);

  // Refs for signature pad drawing
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sigDrawing, setSigDrawing] = useState(false);

  const { addHistoryItem, favorites, toggleFavorite } = useConversions();

  const handleFilesSelected = async (files: File[]) => {
    setSelectedFiles(files);
    setDownloadUrl(null);
    setImagePages([]);
    setAnnotations([]);
    setSelectedAnnId(null);
    setCurrentSignatureUrl(null);
    setImageStampData(null);

    // Reset encryption state for new file
    setIsEncrypted(false);
    setInputPassword("");

    if (files.length > 0 && (mode === "split" || mode === "to-image")) {
      try {
        const arrayBuffer = await files[0].arrayBuffer();
        const doc = await PDFDocument.load(arrayBuffer, { password: inputPassword } as any);
        const count = doc.getPageCount();
        setTotalPages(count);
        setSplitPages(`1-${count}`);
      } catch (e: any) {
        if (e?.message?.includes("password") || e?.message?.includes("encrypt")) {
          setIsEncrypted(true);
        }
        setTotalPages(0);
      }
    }

    if (files.length > 0 && mode === "edit") {
      try {
        const arrayBuffer = await files[0].arrayBuffer();
        const pdfjsLib = await loadPdfJs();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer), password: inputPassword }).promise;
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

        // Initialize page layout organizer
        const layout = Array.from({ length: pdf.numPages }, (_, i) => ({
          id: `page-${i + 1}`,
          originalIndex: i,
          rotation: 0
        }));
        setPageLayout(layout);
      } catch (e: any) {
        if (e?.message?.includes("password") || e?.message?.includes("encrypt") || e?.name === "PasswordException") {
          setIsEncrypted(true);
        } else {
          console.error("Editor preview rendering failed:", e);
          alert("Could not render the PDF for editing. Check your connection or try another file.");
        }
      }
    }
  };

  // Page reordering sidebar methods
  const rotatePage = (index: number) => {
    setPageLayout(prev => prev.map((p, idx) => idx === index ? { ...p, rotation: (p.rotation + 90) % 360 } : p));
  };

  const deletePage = (index: number) => {
    if (pageLayout.length <= 1) {
      alert("A PDF must contain at least one page.");
      return;
    }
    setPageLayout(prev => prev.filter((_, idx) => idx !== index));
    // Remove annotations on the deleted page index
    setAnnotations(prev => prev.filter(a => a.page !== index + 1).map(a => {
      // Re-map page index down if it is greater than the deleted page
      if (a.page > index + 1) return { ...a, page: a.page - 1 };
      return a;
    }));
  };

  const movePageUp = (index: number) => {
    if (index === 0) return;
    setPageLayout(prev => {
      const next = [...prev];
      [next[index], next[index - 1]] = [next[index - 1], next[index]];
      return next;
    });
    // Swap annotations
    setAnnotations(prev => prev.map(a => {
      if (a.page === index + 1) return { ...a, page: index };
      if (a.page === index) return { ...a, page: index + 1 };
      return a;
    }));
  };

  const movePageDown = (index: number) => {
    if (index === pageLayout.length - 1) return;
    setPageLayout(prev => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
    // Swap annotations
    setAnnotations(prev => prev.map(a => {
      if (a.page === index + 1) return { ...a, page: index + 2 };
      if (a.page === index + 2) return { ...a, page: index + 1 };
      return a;
    }));
  };

  const insertBlankPage = (index: number) => {
    const newId = `blank-${Date.now()}`;
    setPageLayout(prev => {
      const next = [...prev];
      next.splice(index + 1, 0, { id: newId, originalIndex: -1, rotation: 0 });
      return next;
    });
    // Push page numbers of annotations that occur after the inserted page index
    setAnnotations(prev => prev.map(a => {
      if (a.page > index + 1) return { ...a, page: a.page + 1 };
      return a;
    }));
  };

  // Convert client click to SVG 0..1000 grid coordinates
  const getSvgCoords = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 1000;
    const y = ((e.clientY - rect.top) / rect.height) * 1000;
    return { x: Math.round(x), y: Math.round(y) };
  };

  // Mouse handlers for annotation drawing
  const handleSvgMouseDown = (pageNum: number, e: React.MouseEvent<SVGSVGElement>) => {
    const coords = getSvgCoords(e);

    if (toolMode === "select") {
      // Clear selection unless clicking on active boundary elements
      const target = e.target as SVGElement;
      if (target.tagName === "svg") {
        setSelectedAnnId(null);
      }
      return;
    }

    if (toolMode === "text") {
      const newAnn: Annotation = {
        id: Math.random().toString(36).substring(2, 9),
        page: pageNum,
        type: "text",
        x: coords.x,
        y: coords.y,
        text: editText,
        size: editSize,
        color: editColor
      };
      setAnnotations(prev => [...prev, newAnn]);
      setSelectedAnnId(newAnn.id);
      setToolMode("select");
      return;
    }

    if (toolMode === "draw" || toolMode === "highlight") {
      setIsDrawing(true);
      setDrawPoints([coords]);
      return;
    }

    if (["rect", "circle", "line", "arrow"].includes(toolMode)) {
      setShapeStart(coords);
      setShapeCurrent(coords);
      return;
    }

    if (toolMode === "signature") {
      if (!currentSignatureUrl) {
        setShowSigModal(true);
        return;
      }
      const newAnn: Annotation = {
        id: Math.random().toString(36).substring(2, 9),
        page: pageNum,
        type: "signature",
        x: coords.x - 100,
        y: coords.y - 40,
        width: 200,
        height: 80,
        dataUrl: currentSignatureUrl
      };
      setAnnotations(prev => [...prev, newAnn]);
      setSelectedAnnId(newAnn.id);
      setToolMode("select");
      return;
    }

    if (toolMode === "image") {
      if (!imageStampData) {
        alert("Upload a stamp image in the editor settings panel first.");
        return;
      }
      const newAnn: Annotation = {
        id: Math.random().toString(36).substring(2, 9),
        page: pageNum,
        type: "image",
        x: coords.x - 100,
        y: coords.y - 100,
        width: 200,
        height: 200,
        dataUrl: imageStampData
      };
      setAnnotations(prev => [...prev, newAnn]);
      setSelectedAnnId(newAnn.id);
      setToolMode("select");
      return;
    }
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const coords = getSvgCoords(e);

    if (isDrawing && drawPoints.length > 0) {
      const lastPoint = drawPoints[drawPoints.length - 1];
      const dist = Math.hypot(coords.x - lastPoint.x, coords.y - lastPoint.y);
      if (dist > 4) {
        setDrawPoints(prev => [...prev, coords]);
      }
      return;
    }

    if (shapeStart) {
      setShapeCurrent(coords);
      return;
    }

    if (dragStart && dragAction && selectedAnnId) {
      const dx = coords.x - dragStart.x;
      const dy = coords.y - dragStart.y;
      
      setAnnotations(prev => prev.map(a => {
        if (a.id === selectedAnnId) {
          if (dragAction === "move") {
            if (a.type === "draw" || a.type === "highlight") {
              return { ...a, points: a.points?.map(p => ({ x: p.x + dx, y: p.y + dy })) };
            }
            return { ...a, x: a.x + dx, y: a.y + dy };
          } else if (dragAction === "resize") {
            return {
              ...a,
              width: Math.max(10, (a.width ?? 100) + dx),
              height: Math.max(10, (a.height ?? 50) + dy)
            };
          }
        }
        return a;
      }));
      setDragStart(coords);
    }
  };

  const handleSvgMouseUp = (pageNum: number) => {
    if (isDrawing && drawPoints.length > 1) {
      const newAnn: Annotation = {
        id: Math.random().toString(36).substring(2, 9),
        page: pageNum,
        type: toolMode === "highlight" ? "highlight" : "draw",
        x: 0,
        y: 0,
        size: editSize,
        color: editColor,
        points: drawPoints
      };
      setAnnotations(prev => [...prev, newAnn]);
      setIsDrawing(false);
      setDrawPoints([]);
      setToolMode("select");
      setSelectedAnnId(newAnn.id);
    }

    if (shapeStart && shapeCurrent) {
      const x = Math.min(shapeStart.x, shapeCurrent.x);
      const y = Math.min(shapeStart.y, shapeCurrent.y);
      const width = Math.max(10, Math.abs(shapeStart.x - shapeCurrent.x));
      const height = Math.max(10, Math.abs(shapeStart.y - shapeCurrent.y));
      
      const newAnn: Annotation = {
        id: Math.random().toString(36).substring(2, 9),
        page: pageNum,
        type: "shape" as any,
        shapeType: toolMode as any,
        x: toolMode === "line" || toolMode === "arrow" ? shapeStart.x : x,
        y: toolMode === "line" || toolMode === "arrow" ? shapeStart.y : y,
        width: toolMode === "line" || toolMode === "arrow" ? shapeCurrent.x - shapeStart.x : width,
        height: toolMode === "line" || toolMode === "arrow" ? shapeCurrent.y - shapeStart.y : height,
        size: Math.max(2, Math.round(editSize / 2)),
        color: editColor
      };
      
      setAnnotations(prev => [...prev, newAnn]);
      setShapeStart(null);
      setShapeCurrent(null);
      setToolMode("select");
      setSelectedAnnId(newAnn.id);
    }

    setDragStart(null);
    setDragAction(null);
  };

  // Signature canvas handlers
  const handleSigCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 3;
    ctx.strokeStyle = editColor;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setSigDrawing(true);
  };

  const handleSigCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!sigDrawing) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleSigCanvasMouseUp = () => {
    setSigDrawing(false);
  };

  const clearSigCanvas = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const saveSignature = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 160;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (sigDrawType === "draw") {
      const srcCanvas = sigCanvasRef.current;
      if (srcCanvas) {
        ctx.drawImage(srcCanvas, 0, 0, 400, 160);
      }
    } else {
      ctx.fillStyle = "rgba(0,0,0,0)";
      ctx.fillRect(0, 0, 400, 160);
      ctx.font = `italic 46px ${typedSigFont === "font-cursive" ? "'Dancing Script', cursive" : typedSigFont === "font-serif" ? "'Great Vibes', serif" : "'Reenie Beanie', cursive"}`;
      ctx.fillStyle = editColor;
      ctx.fillText(typedSigText, 25, 95);
    }

    const dataUrl = canvas.toDataURL("image/png");
    setCurrentSignatureUrl(dataUrl);
    setToolMode("signature");
    setShowSigModal(false);
  };

  // Image stamp file upload
  const handleImageStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImageStampData(event.target.result as string);
          setToolMode("image");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const parsePageRange = (rangeStr: string, maxPages: number): number[] => {
    const pages: Set<number> = new Set();
    const parts = rangeStr.split(",").map((s) => s.trim());
    for (const part of parts) {
      if (part.includes("-")) {
        const [startStr, endStr] = part.split("-").map((s) => s.trim());
        const start = Math.max(1, parseInt(startStr) || 1);
        const end = Math.min(maxPages, parseInt(endStr) || maxPages);
        for (let i = start; i <= end; i++) pages.add(i - 1);
      } else {
        const num = parseInt(part);
        if (!isNaN(num) && num >= 1 && num <= maxPages) pages.add(num - 1);
      }
    }
    return Array.from(pages).sort((a, b) => a - b);
  };

  // PDF Processor
  const processPdf = async () => {
    if (selectedFiles.length === 0) return;
    setProcessing(true);
    setDownloadUrl(null);

    try {
      if (mode === "merge") {
        const mergedPdf = await PDFDocument.create();
        for (const file of selectedFiles) {
          const arrayBuffer = await file.arrayBuffer();
          const doc = await PDFDocument.load(arrayBuffer, { password: inputPassword } as any);
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
        const doc = await PDFDocument.load(arrayBuffer, { password: inputPassword } as any);
        const pageCount = doc.getPageCount();
        const pageIndices = parsePageRange(splitPages, pageCount);

        if (pageIndices.length === 0) {
          alert("No valid pages selected.");
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
          fileName: `split_${targetFile.name}`,
          fileSize: blob.size,
          toolType: "pdf-split",
          status: "success",
          downloadUrl: url,
        });
      } else if (mode === "rotate") {
        const targetFile = selectedFiles[0];
        const arrayBuffer = await targetFile.arrayBuffer();
        const doc = await PDFDocument.load(arrayBuffer, { password: inputPassword } as any);
        doc.getPages().forEach((page) => {
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
        const doc = await PDFDocument.load(arrayBuffer, { password: inputPassword } as any);
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
          const pdfjsLib = await loadPdfJs();
          const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer), password: inputPassword }).promise;
          const sectionChildren: any[] = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              await page.render({ canvasContext: ctx, viewport }).promise;
              const imgData = canvas.toDataURL("image/png");
              const imgBytes = dataUrlToUint8Array(imgData);
              sectionChildren.push(
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: imgBytes,
                      transformation: { width: 570, height: 750 },
                    }),
                  ],
                })
              );
            }
          }
          doc = new Document({
            sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children: sectionChildren }],
          });
        } else {
          let paragraphs: Paragraph[] = [];
          const pdfjsLib = await loadPdfJs();
          const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer), password: inputPassword }).promise;
          
          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: `Converted: ${targetFile.name}`, bold: true, size: 32 })],
              heading: HeadingLevel.HEADING_1,
              spacing: { after: 200 },
            })
          );

          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const items = textContent.items;
            
            paragraphs.push(
              new Paragraph({
                children: [new TextRun({ text: `Page ${i}`, bold: true, size: 26, color: "4f46e5" })],
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 400, after: 200 },
                border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "e5e7eb" } },
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
                  paragraphs.push(
                    new Paragraph({
                      children: [new TextRun({ text: currentLine.trim(), bold: lastFontSize > 14, size: Math.min(Math.max(lastFontSize * 2, 18), 48) })],
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
                  children: [new TextRun({ text: currentLine.trim(), size: Math.min(Math.max(lastFontSize * 2, 18), 48) })],
                  spacing: { after: 100 },
                })
              );
            }

            if (sortedItems.length === 0 || !sortedItems.some((item: any) => item.str?.trim())) {
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
                }
              } catch (e) {
                console.error("OCR fallback failed:", e);
              }
            }
          }
          doc = new Document({ sections: [{ children: paragraphs }] });
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
        const pdfjsLib = await loadPdfJs();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer), password: inputPassword }).promise;
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
            renderedPages.push({ url: canvas.toDataURL("image/jpeg", 0.92), page: i });
          }
        }
        setImagePages(renderedPages);
        if (renderedPages.length > 0) {
          setDownloadUrl(renderedPages[0].url);
          addHistoryItem({
            fileName: `${targetFile.name.split(".")[0]}_pages.jpg`,
            fileSize: 102400 * numPages,
            toolType: "pdf-to-image",
            status: "success",
            downloadUrl: renderedPages[0].url,
          });
        }
      } else if (mode === "to-excel") {
        const targetFile = selectedFiles[0];
        const arrayBuffer = await targetFile.arrayBuffer();
        const pdfjsLib = await loadPdfJs();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer), password: inputPassword }).promise;
        const numPages = pdf.numPages;
        const wb = XLSX.utils.book_new();
        const useCloud = cloudEnhance && cloudApiKey.trim().length > 0;
        const useTatr = !useCloud && tableEngine === "tatr";
        let cloudFailures = 0;
        setTatrProgressLabel("");
        setTatrProgressPct(0);

        const renderPage = async (page: any) => {
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (ctx) await page.render({ canvasContext: ctx, viewport }).promise;
          return canvas;
        };

        // Legacy cluster-based fallback (used when TATR finds no tables, or when engine = "cluster").
        const clusterGrid = async (page: any, items: TextItem[]) => {
          if (items.length > 0) return reconstructTable(items);
          const canvas = await renderPage(page);
          return tableFromOcrText((await ocrImage(canvas)).text);
        };

        // Sheet-name dedupe within Excel's 31-char limit.
        const usedSheetNames = new Set<string>();
        const safeSheetName = (raw: string) => {
          const base = raw.replace(/[\\/?*[\]:]/g, "").slice(0, 31);
          let name = base || "Sheet";
          let n = 2;
          while (usedSheetNames.has(name)) {
            const suffix = ` (${n})`;
            name = `${base.slice(0, 31 - suffix.length)}${suffix}`;
            n++;
          }
          usedSheetNames.add(name);
          return name;
        };

        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const items: TextItem[] = textContent.items
            .map((it: any) => ({ str: it.str, x: it.transform[4], y: it.transform[5] }))
            .filter((it: TextItem) => it.str && it.str.trim());

          if (useCloud) {
            // Cloud-Claude path: one sheet per page.
            let grid: string[][];
            try {
              const canvas = await renderPage(page);
              const b64 = canvas.toDataURL("image/png").split(",")[1] || "";
              grid = await extractTableWithClaude(cloudApiKey.trim(), b64);
              if (grid.length === 0) grid = await clusterGrid(page, items);
            } catch (e) {
              cloudFailures++;
              grid = await clusterGrid(page, items);
            }
            if (grid.length === 0) grid = [["(no tabular data detected)"]];
            const ws = XLSX.utils.aoa_to_sheet(grid);
            XLSX.utils.book_append_sheet(wb, ws, safeSheetName(`Page ${i}`));
          } else if (useTatr) {
            // Microsoft Table Transformer path: one sheet per detected table.
            const { canvas, textItems } = await renderPageForTatr(page, 2.0);
            const pageOffset = ((i - 1) / numPages) * 100;
            const pageSpan = (1 / numPages) * 100;
            try {
              const result = await extractTables(canvas, textItems, (label, pct) => {
                setTatrProgressLabel(`Page ${i}/${numPages} · ${label}`);
                setTatrProgressPct(Math.min(100, Math.round(pageOffset + (pct / 100) * pageSpan)));
              });
              if (result.tables.length === 0) {
                // No tables detected on this page – fall back to clustering so we still emit something.
                const grid = await clusterGrid(page, items);
                const ws = XLSX.utils.aoa_to_sheet(
                  grid.length ? grid : [["(no tables detected on this page)"]]
                );
                XLSX.utils.book_append_sheet(wb, ws, safeSheetName(`P${i} (no table)`));
              } else {
                result.tables.forEach((t, tIdx) => {
                  const grid = t.grid.length ? t.grid : [[""]];
                  const ws = XLSX.utils.aoa_to_sheet(grid);
                  const name = result.tables.length === 1
                    ? `P${i}`
                    : `P${i}-T${tIdx + 1}`;
                  XLSX.utils.book_append_sheet(wb, ws, safeSheetName(name));
                });
              }
            } catch (e) {
              console.error(`TATR failed on page ${i}:`, e);
              let grid = await clusterGrid(page, items);
              if (grid.length === 0) grid = [["(table-transformer error – fell back to text clustering, no data found)"]];
              const ws = XLSX.utils.aoa_to_sheet(grid);
              XLSX.utils.book_append_sheet(wb, ws, safeSheetName(`Page ${i}`));
            }
          } else {
            // Legacy clustering engine (user explicitly chose Fast mode).
            let grid = await clusterGrid(page, items);
            if (grid.length === 0) grid = [["(no tabular data detected)"]];
            const ws = XLSX.utils.aoa_to_sheet(grid);
            XLSX.utils.book_append_sheet(wb, ws, safeSheetName(`Page ${i}`));
          }
        }

        const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
        const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
        setTatrProgressLabel("");
        setTatrProgressPct(0);

        if (useCloud && cloudFailures > 0) {
          console.warn(`Cloud extraction failed on ${cloudFailures} page(s); fell back to on-device for those pages.`);
        }

        addHistoryItem({
          fileName: `${targetFile.name.split(".")[0]}.xlsx`,
          fileSize: blob.size,
          toolType: "pdf-to-excel",
          status: "success",
          downloadUrl: url,
        });
      } else if (mode === "edit") {
        // ── ADVANCED PDF EDITOR COMPILATION ──
        const targetFile = selectedFiles[0];
        const arrayBuffer = await targetFile.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer, { password: inputPassword } as any);
        const outputDoc = await PDFDocument.create();
        const helveticaFont = await outputDoc.embedFont(StandardFonts.Helvetica);

        // Reconstruct pages based on Organizer pageLayout
        for (let i = 0; i < pageLayout.length; i++) {
          const item = pageLayout[i];
          let page: any;
          if (item.originalIndex >= 0) {
            const [copiedPage] = await outputDoc.copyPages(pdfDoc, [item.originalIndex]);
            page = outputDoc.addPage(copiedPage);
            page.setRotation(degrees((page.getRotation().angle + item.rotation) % 360));
          } else {
            page = outputDoc.addPage([595.28, 841.89]); // blank A4 page
          }

          const { width, height } = page.getSize();
          const pageAnns = annotations.filter((a) => a.page === i + 1);

          for (const ann of pageAnns) {
            const x_pdf = (ann.x / 1000) * width;
            const y_pdf = (1 - (ann.y / 1000)) * height;
            const w_pdf = ((ann.width ?? 100) / 1000) * width;
            const h_pdf = ((ann.height ?? 50) / 1000) * height;
            const { r, g, b } = hexToUnit(ann.color || "#000000");

            if (ann.type === "text") {
              const fontSize = (ann.size ?? 18) * 0.75;
              const lines = (ann.text || "").split("\n");
              lines.forEach((line, idx) => {
                page.drawText(line, {
                  x: x_pdf,
                  y: y_pdf - fontSize * (idx + 1),
                  size: fontSize,
                  font: helveticaFont,
                  color: rgb(r, g, b),
                });
              });
            } else if (ann.type === "rect") {
              const thick = ((ann.size ?? 4) / 1000) * width;
              page.drawRectangle({
                x: x_pdf,
                y: y_pdf - h_pdf,
                width: w_pdf,
                height: h_pdf,
                borderColor: rgb(r, g, b),
                borderWidth: thick,
                fill: undefined
              });
            } else if (ann.type === "circle") {
              const thick = ((ann.size ?? 4) / 1000) * width;
              page.drawEllipse({
                x: x_pdf + w_pdf / 2,
                y: y_pdf - h_pdf / 2,
                xScale: w_pdf / 2,
                yScale: h_pdf / 2,
                borderColor: rgb(r, g, b),
                borderWidth: thick
              });
            } else if (ann.type === "line") {
              const thick = ((ann.size ?? 4) / 1000) * width;
              page.drawLine({
                start: { x: x_pdf, y: y_pdf },
                end: { x: x_pdf + w_pdf, y: y_pdf - h_pdf },
                thickness: thick,
                color: rgb(r, g, b)
              });
            } else if (ann.type === "arrow") {
              const thick = ((ann.size ?? 4) / 1000) * width;
              const startX = x_pdf;
              const startY = y_pdf;
              const endX = x_pdf + w_pdf;
              const endY = y_pdf - h_pdf;
              page.drawLine({
                start: { x: startX, y: startY },
                end: { x: endX, y: endY },
                thickness: thick,
                color: rgb(r, g, b)
              });
              // Draw head arrow segments
              const angle = Math.atan2(endY - startY, endX - startX);
              const headLen = 15;
              const arrowAngle = Math.PI / 6;
              const ax1 = endX - headLen * Math.cos(angle - arrowAngle);
              const ay1 = endY - headLen * Math.sin(angle - arrowAngle);
              const ax2 = endX - headLen * Math.cos(angle + arrowAngle);
              const ay2 = endY - headLen * Math.sin(angle + arrowAngle);
              page.drawLine({ start: { x: endX, y: endY }, end: { x: ax1, y: ay1 }, thickness: thick, color: rgb(r, g, b) });
              page.drawLine({ start: { x: endX, y: endY }, end: { x: ax2, y: ay2 }, thickness: thick, color: rgb(r, g, b) });
            } else if (ann.type === "signature" || ann.type === "image") {
              if (ann.dataUrl) {
                const imgBytes = dataUrlToUint8Array(ann.dataUrl);
                const isPng = ann.dataUrl.includes("image/png");
                const embeddedImage = isPng
                  ? await outputDoc.embedPng(imgBytes)
                  : await outputDoc.embedJpg(imgBytes);
                page.drawImage(embeddedImage, {
                  x: x_pdf,
                  y: y_pdf - h_pdf,
                  width: w_pdf,
                  height: h_pdf
                });
              }
            } else if (ann.type === "draw" || ann.type === "highlight") {
              const points = ann.points || [];
              const thick = ((ann.size ?? 6) / 1000) * width;
              const opacity = ann.type === "highlight" ? 0.45 : 1.0;
              for (let pIdx = 0; pIdx < points.length - 1; pIdx++) {
                const p1 = points[pIdx];
                const p2 = points[pIdx + 1];
                page.drawLine({
                  start: { x: (p1.x / 1000) * width, y: (1 - (p1.y / 1000)) * height },
                  end: { x: (p2.x / 1000) * width, y: (1 - (p2.y / 1000)) * height },
                  thickness: ann.type === "highlight" ? thick * 2.5 : thick,
                  color: rgb(r, g, b),
                  opacity
                });
              }
            }
          }
        }

        const pdfBytes = await outputDoc.save();
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
      }
    } catch (error) {
      console.error(error);
      alert("Error processing PDF document.");
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
      <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Great+Vibes&family=Reenie+Beanie&display=swap" rel="stylesheet" />

      <div className="space-y-6">
        {/* Navigation tabs */}
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
                  setSelectedAnnId(null);
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

        {/* Info alerts */}
        {mode === "protect" && (
          <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-50/50 dark:bg-red-950/10 flex items-start space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-red-700 dark:text-red-400 space-y-1">
              <span className="font-bold block">⚠ No Real Encryption — Metadata Tag Only</span>
              <span>The password label you enter below is stored as a metadata keyword tag. Do not use for confidential files.</span>
            </div>
          </div>
        )}

        {mode === "to-excel" && (
          <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/10 flex items-start space-x-2.5">
            <FileSpreadsheet className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-emerald-700 dark:text-emerald-400 space-y-1">
              <span className="font-bold block">Smart Table Extraction → .xlsx</span>
              <span>
                Default engine: <b>Microsoft Table Transformer</b> (DETR) — detects each table on
                the page and rebuilds its row/column structure on-device via ONNX Runtime Web.
                Each detected table is exported as its own sheet. First run downloads the model
                (~110&nbsp;MB) once and caches it.
              </span>
            </div>
          </div>
        )}

        {/* Dropzone */}
        {selectedFiles.length === 0 && (
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
                : "Drag & drop a PDF file to process"
            }
          />
        )}

        {/* Password-protected PDF unlock banner */}
        {selectedFiles.length > 0 && isEncrypted && (
          <div className="p-4 rounded-xl border border-amber-400/40 bg-amber-50/60 dark:bg-amber-950/20 flex flex-col space-y-3">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m8-6V9a6 6 0 00-12 0v2M5 21h14a2 2 0 002-2v-5a2 2 0 00-2-2H5a2 2 0 00-2 2v5a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">Password-Protected PDF Detected</span>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-500">Enter the PDF password to unlock and process it. All decryption happens locally in your browser.</p>
            <div className="flex space-x-2 max-w-sm">
              <input
                type="password"
                placeholder="Enter PDF password..."
                className="flex-grow glass-input text-xs py-2"
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    // Re-trigger file loading with the entered password
                    handleFilesSelected(selectedFiles);
                  }
                }}
              />
              <button
                onClick={() => handleFilesSelected(selectedFiles)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-all"
              >
                Unlock
              </button>
            </div>
          </div>
        )}

        {/* Configurations (Non-editor modes) */}
        {selectedFiles.length > 0 && mode !== "edit" && (
          <div className="space-y-4 pt-2">
            {mode === "split" && (
              <div className="space-y-2 max-w-md">
                <label className="text-[10px] uppercase font-bold text-slate-400">
                  Page Range to Extract {totalPages > 0 && `(Total: ${totalPages} pages)`}
                </label>
                <input
                  type="text"
                  className="w-full glass-input text-xs"
                  placeholder="e.g. 1-3, 5, 7-9"
                  value={splitPages}
                  onChange={(e) => setSplitPages(e.target.value)}
                />
              </div>
            )}

            {mode === "rotate" && (
              <div className="space-y-2 max-w-md">
                <label className="text-[10px] uppercase font-bold text-slate-400">Rotation Angle</label>
                <select
                  className="w-full glass-input text-xs"
                  value={rotateAngle}
                  onChange={(e) => setRotateAngle(Number(e.target.value))}
                >
                  <option value={90}>90° Clockwise</option>
                  <option value={180}>180° Flip</option>
                  <option value={270}>90° Counter-Clockwise</option>
                </select>
              </div>
            )}

            {mode === "protect" && (
              <div className="space-y-2 max-w-md">
                <label className="text-[10px] uppercase font-bold text-slate-400">Password Label Tag</label>
                <input
                  type="text"
                  className="w-full glass-input text-xs"
                  placeholder="Password tag string..."
                  value={pdfPassword}
                  onChange={(e) => setPdfPassword(e.target.value)}
                />
              </div>
            )}

            {mode === "to-doc" && (
              <div className="space-y-3">
                <label className="text-[10px] uppercase font-bold text-slate-400">Conversion Quality Mode</label>
                <div className="grid grid-cols-2 gap-4 max-w-md">
                  <button
                    onClick={() => setDocFidelity("layout")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      docFidelity === "layout"
                        ? "border-indigo-600 bg-indigo-50/10 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                        : "border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                    }`}
                  >
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 font-sans">Exact Layout (Image)</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">Keeps original structure by embedding page scans. Best for signing.</span>
                  </button>
                  <button
                    onClick={() => setDocFidelity("text")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      docFidelity === "text"
                        ? "border-indigo-600 bg-indigo-50/10 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                        : "border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                    }`}
                  >
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Editable Text</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">Fully selectable & editable text layout reconstruction.</span>
                  </button>
                </div>
              </div>
            )}

            {mode === "to-excel" && (
              <div className="space-y-3 max-w-xl">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block">
                    Extraction Engine
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTableEngine("tatr")}
                      disabled={cloudEnhance}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        tableEngine === "tatr" && !cloudEnhance
                          ? "border-emerald-600 bg-emerald-50/10 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300"
                          : "border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                      } ${cloudEnhance ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                        Microsoft Table Transformer
                      </span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">
                        On-device DETR. Detects every table, recovers rows & columns. One sheet per table.
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableEngine("cluster")}
                      disabled={cloudEnhance}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        tableEngine === "cluster" && !cloudEnhance
                          ? "border-indigo-600 bg-indigo-50/10 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300"
                          : "border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                      } ${cloudEnhance ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                        Fast Clustering (legacy)
                      </span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">
                        X/Y text-position clustering. No model download. Best for very clean grids.
                      </span>
                    </button>
                  </div>
                </div>

                <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded text-indigo-500 focus:ring-indigo-500/50"
                    checked={cloudEnhance}
                    onChange={(e) => setCloudEnhance(e.target.checked)}
                  />
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Override: Enhance with Claude (Cloud AI) — for complex layouts</span>
                </label>
                {cloudEnhance && (
                  <div className="space-y-2 p-3 rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/10">
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                      Sends page screenshots to Anthropic. Requires your own API key. Bypasses the on-device engine.
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

                {processing && tableEngine === "tatr" && !cloudEnhance && (
                  <div className="space-y-1.5 p-3 rounded-xl border border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/10">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                      <span className="truncate pr-2">{tatrProgressLabel || "Starting Table Transformer…"}</span>
                      <span>{tatrProgressPct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-emerald-100 dark:bg-emerald-900/40 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${tatrProgressPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={processPdf}
              disabled={processing || (mode === "protect" && !pdfPassword) || (mode === "to-excel" && cloudEnhance && !cloudApiKey.trim())}
              className="px-6 py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-all flex items-center space-x-1.5 shadow-md"
            >
              <span>{processing ? "Processing..." : `Convert & Apply`}</span>
            </button>
          </div>
        )}

        {/* ── ADVANCED PDF EDITOR WORKSPACE ── */}
        {mode === "edit" && selectedFiles.length > 0 && imagePages.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start pt-2">
            
            {/* Left Sidebar: Page Organizer */}
            <aside className="lg:col-span-1 border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white/40 dark:bg-slate-900/20 max-h-[80vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Page Organizer</span>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20 px-2 py-0.5 rounded-full">
                  {pageLayout.length} Pages
                </span>
              </div>

              <div className="space-y-3">
                {pageLayout.map((item, idx) => {
                  const origPage = item.originalIndex >= 0 ? imagePages.find((img) => img.page === item.originalIndex + 1) : null;
                  return (
                    <div key={item.id} className="relative p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 shadow-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400">Position {idx + 1}</span>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => movePageUp(idx)}
                            disabled={idx === 0}
                            title="Move Up"
                            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                          >
                            <ArrowUp className="w-3 h-3 text-slate-500" />
                          </button>
                          <button
                            onClick={() => movePageDown(idx)}
                            disabled={idx === pageLayout.length - 1}
                            title="Move Down"
                            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                          >
                            <ArrowDown className="w-3 h-3 text-slate-500" />
                          </button>
                        </div>
                      </div>

                      <div className="aspect-[3/4] rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-center overflow-hidden relative">
                        {origPage ? (
                          <img
                            src={origPage.url}
                            alt={`Preview ${idx + 1}`}
                            className="w-full h-full object-cover transition-transform"
                            style={{ transform: `rotate(${item.rotation}deg)` }}
                          />
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold uppercase">Blank Page</span>
                        )}
                        <span className="absolute bottom-1 right-1 text-[9px] font-bold text-slate-500 bg-white/80 dark:bg-slate-950/80 px-1.5 py-0.5 rounded shadow-sm">
                          {item.originalIndex >= 0 ? `Orig: P.${item.originalIndex + 1}` : "Blank"}
                        </span>
                      </div>

                      {/* Toolbar under each page */}
                      <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                        <button
                          onClick={() => rotatePage(idx)}
                          title="Rotate 90° Clockwise"
                          className="p-1 rounded text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-1 text-[9px]"
                        >
                          <RotateCw className="w-3 h-3" />
                          <span>Rotate</span>
                        </button>
                        <button
                          onClick={() => insertBlankPage(idx)}
                          title="Insert Blank Page Below"
                          className="p-1 rounded text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-1 text-[9px]"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Insert</span>
                        </button>
                        <button
                          onClick={() => deletePage(idx)}
                          disabled={pageLayout.length <= 1}
                          title="Delete Page"
                          className="p-1 rounded text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-1 text-[9px] disabled:opacity-30"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>

            {/* Central Editor Viewport Canvas */}
            <main className="lg:col-span-2 space-y-6 max-h-[80vh] overflow-y-auto pr-2">
              {pageLayout.map((item, idx) => {
                const origPage = item.originalIndex >= 0 ? imagePages.find((img) => img.page === item.originalIndex + 1) : null;
                const pageNum = idx + 1;
                return (
                  <div key={item.id} className="space-y-1.5 bg-slate-100/50 dark:bg-slate-900/40 p-3 rounded-xl border">
                    <span className="text-[10px] font-black text-slate-500">Page {pageNum} (Viewport)</span>
                    
                    <div className="relative inline-block w-full rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-white select-none">
                      {origPage ? (
                        <img
                          src={origPage.url}
                          alt={`Page ${pageNum}`}
                          className="w-full h-auto block select-none pointer-events-none"
                          style={{ transform: `rotate(${item.rotation}deg)` }}
                          draggable={false}
                        />
                      ) : (
                        <div className="w-full aspect-[1/1.414] bg-white flex items-center justify-center text-slate-300 uppercase font-black tracking-wide text-xs">
                          Blank Page
                        </div>
                      )}

                      {/* SVG Interactive Overlay Layer */}
                      <svg
                        viewBox="0 0 1000 1000"
                        className={`absolute top-0 left-0 w-full h-full ${
                          toolMode === "select"
                            ? "cursor-default"
                            : toolMode === "text"
                            ? "cursor-text"
                            : "cursor-crosshair"
                        }`}
                        onMouseDown={(e) => handleSvgMouseDown(pageNum, e)}
                        onMouseMove={handleSvgMouseMove}
                        onMouseUp={() => handleSvgMouseUp(pageNum)}
                      >
                        {/* Render shapes/rectangles/circles */}
                        {annotations
                          .filter((a) => a.page === pageNum)
                          .map((ann) => {
                            const isSel = ann.id === selectedAnnId;
                            const bounds = getAnnBounds(ann);

                            return (
                              <g
                                key={ann.id}
                                onPointerDown={(e) => {
                                  if (toolMode === "select") {
                                    e.stopPropagation();
                                    setSelectedAnnId(ann.id);
                                    setDragStart(getSvgCoords(e as any));
                                    setDragAction("move");
                                  }
                                }}
                              >
                                {ann.type === "text" && (
                                  <text
                                    x={ann.x}
                                    y={ann.y}
                                    fill={ann.color}
                                    fontSize={ann.size}
                                    dominantBaseline="hanging"
                                    fontFamily="Helvetica"
                                    fontWeight="bold"
                                  >
                                    {ann.text}
                                  </text>
                                )}

                                {ann.type === "rect" && (
                                  <rect
                                    x={ann.x}
                                    y={ann.y}
                                    width={ann.width}
                                    height={ann.height}
                                    stroke={ann.color}
                                    strokeWidth={ann.size}
                                    fill="none"
                                  />
                                )}

                                {ann.type === "circle" && (
                                  <ellipse
                                    cx={ann.x + (ann.width ?? 0) / 2}
                                    cy={ann.y + (ann.height ?? 0) / 2}
                                    rx={(ann.width ?? 0) / 2}
                                    ry={(ann.height ?? 0) / 2}
                                    stroke={ann.color}
                                    strokeWidth={ann.size}
                                    fill="none"
                                  />
                                )}

                                {ann.type === "line" && (
                                  <line
                                    x1={ann.x}
                                    y1={ann.y}
                                    x2={ann.x + (ann.width ?? 0)}
                                    y2={ann.y + (ann.height ?? 0)}
                                    stroke={ann.color}
                                    strokeWidth={ann.size}
                                  />
                                )}

                                {ann.type === "arrow" && (
                                  <>
                                    <defs>
                                      <marker
                                        id={`arrow-${ann.id}`}
                                        viewBox="0 0 10 10"
                                        refX="5"
                                        refY="5"
                                        markerWidth="6"
                                        markerHeight="6"
                                        orient="auto-start-reverse"
                                      >
                                        <path d="M 0 0 L 10 5 L 0 10 z" fill={ann.color} />
                                      </marker>
                                    </defs>
                                    <line
                                      x1={ann.x}
                                      y1={ann.y}
                                      x2={ann.x + (ann.width ?? 0)}
                                      y2={ann.y + (ann.height ?? 0)}
                                      stroke={ann.color}
                                      strokeWidth={ann.size}
                                      markerEnd={`url(#arrow-${ann.id})`}
                                    />
                                  </>
                                )}

                                {(ann.type === "signature" || ann.type === "image") && ann.dataUrl && (
                                  <image
                                    href={ann.dataUrl}
                                    x={ann.x}
                                    y={ann.y}
                                    width={ann.width}
                                    height={ann.height}
                                    preserveAspectRatio="none"
                                  />
                                )}

                                {(ann.type === "draw" || ann.type === "highlight") && (
                                  <path
                                    d={pointsToPath(ann.points)}
                                    stroke={ann.color}
                                    strokeWidth={ann.type === "highlight" ? (ann.size ?? 6) * 2.5 : ann.size}
                                    fill="none"
                                    opacity={ann.type === "highlight" ? 0.45 : 1}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                )}

                                {/* Selected Bounding Box overlay handles */}
                                {isSel && toolMode === "select" && (
                                  <g>
                                    <rect
                                      x={bounds.x - 6}
                                      y={bounds.y - 6}
                                      width={bounds.w + 12}
                                      height={bounds.h + 12}
                                      fill="none"
                                      stroke="#3b82f6"
                                      strokeWidth="3"
                                      strokeDasharray="5 3"
                                    />
                                    {/* Delete handle */}
                                    <circle
                                      cx={bounds.x + bounds.w + 12}
                                      cy={bounds.y - 12}
                                      r="14"
                                      fill="#ef4444"
                                      className="cursor-pointer"
                                      onPointerDown={(e) => {
                                        e.stopPropagation();
                                        setAnnotations(prev => prev.filter(a => a.id !== ann.id));
                                        setSelectedAnnId(null);
                                      }}
                                    />
                                    <text
                                      x={bounds.x + bounds.w + 7}
                                      y={bounds.y - 7}
                                      fill="#ffffff"
                                      fontSize="14"
                                      fontWeight="bold"
                                      className="pointer-events-none select-none"
                                    >
                                      ✕
                                    </text>
                                    {/* Resize handle (only for sizing bounds) */}
                                    {ann.type !== "draw" && ann.type !== "highlight" && (
                                      <rect
                                        x={bounds.x + bounds.w + 2}
                                        y={bounds.y + bounds.h + 2}
                                        width="12"
                                        height="12"
                                        fill="#3b82f6"
                                        className="cursor-se-resize"
                                        onPointerDown={(e) => {
                                          e.stopPropagation();
                                          setSelectedAnnId(ann.id);
                                          setDragStart(getSvgCoords(e as any));
                                          setDragAction("resize");
                                        }}
                                      />
                                    )}
                                  </g>
                                )}
                              </g>
                            );
                          })}

                        {/* Rendering shape/pencil drawing currently active segment */}
                        {isDrawing && drawPoints.length > 0 && (
                          <path
                            d={pointsToPath(drawPoints)}
                            stroke={editColor}
                            strokeWidth={toolMode === "highlight" ? editSize * 2.5 : editSize}
                            fill="none"
                            opacity={toolMode === "highlight" ? 0.45 : 1}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}

                        {shapeStart && shapeCurrent && (
                          <>
                            {toolMode === "rect" && (
                              <rect
                                x={Math.min(shapeStart.x, shapeCurrent.x)}
                                y={Math.min(shapeStart.y, shapeCurrent.y)}
                                width={Math.abs(shapeStart.x - shapeCurrent.x)}
                                height={Math.abs(shapeStart.y - shapeCurrent.y)}
                                stroke={editColor}
                                strokeWidth={Math.max(2, Math.round(editSize / 2))}
                                fill="none"
                              />
                            )}
                            {toolMode === "circle" && (
                              <ellipse
                                cx={shapeStart.x + (shapeCurrent.x - shapeStart.x) / 2}
                                cy={shapeStart.y + (shapeCurrent.y - shapeStart.y) / 2}
                                rx={Math.abs(shapeCurrent.x - shapeStart.x) / 2}
                                ry={Math.abs(shapeCurrent.y - shapeStart.y) / 2}
                                stroke={editColor}
                                strokeWidth={Math.max(2, Math.round(editSize / 2))}
                                fill="none"
                              />
                            )}
                            {toolMode === "line" && (
                              <line
                                x1={shapeStart.x}
                                y1={shapeStart.y}
                                x2={shapeCurrent.x}
                                y2={shapeCurrent.y}
                                stroke={editColor}
                                strokeWidth={Math.max(2, Math.round(editSize / 2))}
                              />
                            )}
                            {toolMode === "arrow" && (
                              <line
                                x1={shapeStart.x}
                                y1={shapeStart.y}
                                x2={shapeCurrent.x}
                                y2={shapeCurrent.y}
                                stroke={editColor}
                                strokeWidth={Math.max(2, Math.round(editSize / 2))}
                              />
                            )}
                          </>
                        )}
                      </svg>
                    </div>
                  </div>
                );
              })}
            </main>

            {/* Right Sidebar: Settings & Toolbar */}
            <aside className="lg:col-span-1 border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white/40 dark:bg-slate-900/20 space-y-5">
              
              {/* Tool selector grid */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Toolbar Actions</span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "select", icon: MousePointer, label: "Select" },
                    { id: "text", icon: Type, label: "Text" },
                    { id: "draw", icon: PenTool, label: "Pencil" },
                    { id: "highlight", icon: Paintbrush, label: "Highlight" },
                    { id: "rect", icon: Square, label: "Rect" },
                    { id: "circle", icon: CircleIcon, label: "Circle" },
                    { id: "line", icon: ChevronsUpDown, label: "Line" },
                    { id: "arrow", icon: ArrowRight, label: "Arrow" },
                    { id: "signature", icon: Signature, label: "Sign" },
                  ].map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          setToolMode(t.id as any);
                          setSelectedAnnId(null);
                        }}
                        className={`p-2 rounded-lg border text-center flex flex-col items-center justify-center transition-all ${
                          toolMode === t.id
                            ? "bg-indigo-600 border-indigo-600 text-white shadow"
                            : "border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-[9px] font-semibold mt-1 block">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Upload Image Stamp */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Image Stamp</span>
                <div className="flex items-center gap-2">
                  <label className="flex-grow p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-[10px] font-semibold cursor-pointer text-slate-500 hover:bg-slate-50 flex items-center justify-center space-x-1">
                    <Upload className="w-3 h-3" />
                    <span>Upload Stamp</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageStampUpload}
                      className="hidden"
                    />
                  </label>
                  {imageStampData && (
                    <div className="w-9 h-9 rounded border overflow-hidden flex-shrink-0 bg-slate-50">
                      <img src={imageStampData} alt="Stamp preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              {/* Style controls */}
              <div className="space-y-3.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Styling Settings</span>
                
                {toolMode === "text" && (
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Content</label>
                    <input
                      type="text"
                      className="w-full glass-input text-xs"
                      placeholder="Text value..."
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Color</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      className="w-8 h-8 rounded border bg-transparent cursor-pointer block"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                    />
                    <span className="text-xs font-mono text-slate-500">{editColor}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">
                    Size ({editSize}px)
                  </label>
                  <input
                    type="range"
                    min={toolMode === "text" ? 8 : 2}
                    max={toolMode === "text" ? 72 : 30}
                    className="w-full accent-indigo-500"
                    value={editSize}
                    onChange={(e) => setEditSize(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Save PDF Actions */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <button
                  onClick={processPdf}
                  disabled={processing}
                  className="w-full py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-all flex items-center justify-center space-x-1.5 shadow"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{processing ? "Baking PDF..." : "Export & Download"}</span>
                </button>
         
              </div>
            </aside>
          </div>
        )}

        {/* Signature Pad Drawing Modal */}
        {showSigModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Stamp Signature Creator</span>
                <button onClick={() => setShowSigModal(false)} className="text-slate-400 hover:text-slate-600 text-sm">x</button>
              </div>

              <div className="flex space-x-2">
                {["draw", "type"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setSigDrawType(t as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                      sigDrawType === t
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {t === "draw" ? "Draw Pad" : "Type Name"}
                  </button>
                ))}
              </div>

              {sigDrawType === "draw" ? (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 overflow-hidden">
                  <canvas
                    ref={sigCanvasRef}
                    width={400}
                    height={160}
                    className="w-full bg-slate-50 cursor-crosshair block"
                    onMouseDown={handleSigCanvasMouseDown}
                    onMouseMove={handleSigCanvasMouseMove}
                    onMouseUp={handleSigCanvasMouseUp}
                    onMouseLeave={handleSigCanvasMouseUp}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="text"
                    maxLength={24}
                    placeholder="Enter signing name..."
                    className="w-full glass-input text-xs"
                    value={typedSigText}
                    onChange={(e) => setTypedSigText(e.target.value)}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "font-cursive", label: "Cursive" },
                      { id: "font-serif", label: "Serif Elegant" },
                      { id: "font-hand", label: "Handwriting" }
                    ].map((fontItem) => (
                      <button
                        key={fontItem.id}
                        onClick={() => setTypedSigFont(fontItem.id)}
                        className={`p-2 rounded-lg border text-center text-xs transition-all ${
                          typedSigFont === fontItem.id
                            ? "border-indigo-600 bg-indigo-50/10 text-indigo-600"
                            : "border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        {fontItem.label}
                      </button>
                    ))}
                  </div>
                  <div className="p-4 rounded-xl border border-dashed text-center bg-slate-50 text-slate-800 min-h-[70px] flex items-center justify-center">
                    <span className={`text-4xl ${
                      typedSigFont === "font-cursive" ? "family-cursive" : typedSigFont === "font-serif" ? "family-serif" : "family-hand"
                    }`} style={{ color: editColor, fontFamily: typedSigFont === "font-cursive" ? "Dancing Script" : typedSigFont === "font-serif" ? "Great Vibes" : "Reenie Beanie" }}>
                      {typedSigText || "Signature"}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between border-t pt-3">
                {sigDrawType === "draw" ? (
                  <button
                    onClick={clearSigCanvas}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    Clear Canvas
                  </button>
                ) : <div />}
                <button
                  onClick={saveSignature}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow flex items-center space-x-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirm Stamp</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Gallery previews for to-image output */}
        {mode === "to-image" && imagePages.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              All Pages Rendered ({imagePages.length} pages)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {imagePages.map((img) => (
                <div
                  key={img.page}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 group"
                >
                  <img src={img.url} alt={`Page ${img.page}`} className="w-full h-auto" />
                  <div className="p-2.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-semibold text-slate-500">Page {img.page}</span>
                    <a
                      href={img.url}
                      download={`page_${img.page}.jpg`}
                      className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 flex items-center space-x-1"
                    >
                      <Download className="w-3.5 h-3.5" />
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
                    ? `${imagePages.length} pages rendered. Click Download to save page 1.`
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
 
