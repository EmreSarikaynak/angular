"use client";
import { fontBase64 } from "../export";

export interface PerfTable {
  title: string;
  subtitle: string;
  tagline: string;
  footer: string;
  columns: string[];
  /** İlk hücre satır adı, sonrakiler dönem değerleri. */
  rows: string[][];
  /** Dönemlerin BKN skorları (0–100) — üstteki halkalar için. */
  scores: (number | null)[];
  scoreLabel: string;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Paylaşılabilir PNG özet kartı (1080 px genişlik), tarayıcıda canvas ile çizilir. */
export async function performancePng(t: PerfTable): Promise<Blob> {
  const W = 1080;
  const pad = 56;
  const rowH = 58;
  const tableTop = 470;
  const H = tableTop + 70 + t.rows.length * rowH + 110;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  const font = (size: number, weight = 400) => `${weight} ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  const green = "#1f9d76";

  ctx.fillStyle = "#f6f8f7";
  ctx.fillRect(0, 0, W, H);

  // Logo
  ctx.fillStyle = green;
  roundRect(ctx, pad, pad, 108, 108, 26);
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = "rgba(255,255,255,.3)";
  ctx.beginPath();
  ctx.arc(pad + 54, pad + 54, 38, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#fff";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(pad + 54, pad + 54, 38, -Math.PI / 2, Math.PI * 1.1);
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = font(27, 800);
  ctx.textAlign = "center";
  ctx.fillText("BKN", pad + 54, pad + 64);

  ctx.textAlign = "left";
  ctx.fillStyle = "#17211d";
  ctx.font = font(46, 800);
  ctx.fillText(t.title, pad + 136, pad + 50);
  ctx.fillStyle = green;
  ctx.font = font(26, 600);
  ctx.fillText(t.tagline, pad + 136, pad + 92);
  ctx.fillStyle = "#65736d";
  ctx.font = font(24);
  ctx.fillText(t.subtitle, pad, pad + 150);

  // Skor halkaları
  const colW = (W - pad * 2) / t.columns.length;
  t.columns.forEach((name, i) => {
    const cx = pad + colW * i + colW / 2;
    const cy = 330;
    const score = t.scores[i];
    ctx.lineWidth = 14;
    ctx.strokeStyle = "#e1e7e4";
    ctx.beginPath();
    ctx.arc(cx, cy, 58, 0, Math.PI * 2);
    ctx.stroke();
    if (score != null && score > 0) {
      ctx.strokeStyle = green;
      ctx.beginPath();
      ctx.arc(cx, cy, 58, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * Math.min(100, score)) / 100);
      ctx.stroke();
    }
    ctx.textAlign = "center";
    ctx.fillStyle = "#17211d";
    ctx.font = font(34, 800);
    ctx.fillText(score == null ? "–" : String(score), cx, cy + 12);
    ctx.fillStyle = "#65736d";
    ctx.font = font(21, 600);
    ctx.fillText(name, cx, cy + 100);
  });
  ctx.textAlign = "left";
  ctx.fillStyle = "#17211d";
  ctx.font = font(22, 700);
  ctx.fillText(t.scoreLabel, pad, 256);

  // Tablo
  const labelW = 300;
  const cellW = (W - pad * 2 - labelW) / t.columns.length;
  ctx.fillStyle = "#fff";
  roundRect(ctx, pad - 16, tableTop, W - pad * 2 + 32, 62 + t.rows.length * rowH + 14, 24);
  ctx.fill();
  ctx.font = font(20, 700);
  ctx.fillStyle = green;
  t.columns.forEach((c, i) => {
    ctx.textAlign = "right";
    ctx.fillText(c, pad + labelW + cellW * (i + 1) - 8, tableTop + 42);
  });
  t.rows.forEach((row, r) => {
    const y = tableTop + 62 + r * rowH;
    if (r % 2 === 0) {
      ctx.fillStyle = "#f3f6f5";
      ctx.fillRect(pad - 16, y, W - pad * 2 + 32, rowH);
    }
    ctx.textAlign = "left";
    ctx.fillStyle = "#65736d";
    ctx.font = font(22);
    ctx.fillText(row[0], pad, y + 37);
    ctx.fillStyle = "#17211d";
    ctx.font = font(22, 600);
    ctx.textAlign = "right";
    row.slice(1).forEach((v, i) => ctx.fillText(v, pad + labelW + cellW * (i + 1) - 8, y + 37));
  });

  ctx.textAlign = "left";
  ctx.fillStyle = "#93a39c";
  ctx.font = font(18);
  ctx.fillText(t.footer, pad, H - 44);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png_failed"))), "image/png"));
}

export async function performancePdf(t: PerfTable): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }, regular, bold] = await Promise.all([import("jspdf"), import("jspdf-autotable"), fontBase64("/fonts/DejaVuSans.ttf"), fontBase64("/fonts/DejaVuSans-Bold.ttf")]);
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  doc.addFileToVFS("DejaVuSans.ttf", regular);
  doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
  doc.addFileToVFS("DejaVuSans-Bold.ttf", bold);
  doc.addFont("DejaVuSans-Bold.ttf", "DejaVu", "bold");
  doc.setFillColor(31, 157, 118);
  doc.roundedRect(40, 32, 44, 44, 10, 10, "F");
  doc.setFont("DejaVu", "bold");
  doc.setTextColor(255);
  doc.setFontSize(13);
  doc.text("BKN", 62, 59, { align: "center" });
  doc.setTextColor(0);
  doc.setFontSize(18);
  doc.text(t.title, 96, 50);
  doc.setFont("DejaVu", "normal");
  doc.setFontSize(10);
  doc.setTextColor(31, 157, 118);
  doc.text(t.tagline, 96, 66);
  doc.setTextColor(100);
  doc.text(t.subtitle, 40, 96);
  autoTable(doc, {
    startY: 112,
    head: [["", ...t.columns]],
    body: [[t.scoreLabel, ...t.scores.map((s) => (s == null ? "–" : `${s} / 100`))], ...t.rows],
    styles: { font: "DejaVu", fontSize: 10, cellPadding: 6 },
    headStyles: { font: "DejaVu", fontStyle: "bold", fillColor: [31, 157, 118], halign: "right" },
    columnStyles: { 0: { textColor: 90, cellWidth: 190 }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    theme: "striped",
    margin: { left: 40, right: 40 },
  });
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(t.footer, 40, 560);
  return doc.output("blob");
}
