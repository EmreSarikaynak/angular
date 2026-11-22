"use client";
import type { DayRow } from "./stats";
import type { BodyMeasurement, FoodEntry } from "./types";

export function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** CSV: Excel'in Türkçe karakterleri doğru açması için UTF-8 BOM ve noktalı virgül ayırıcı. */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): Blob {
  const esc = (v: string | number | null | undefined) => {
    if (v == null) return "";
    const s = typeof v === "number" ? String(v).replace(".", ",") : String(v);
    // Formül enjeksiyonuna karşı: =, +, -, @ ile başlayan metinlerin önüne tek tırnak.
    const safe = typeof v === "string" && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = [header, ...rows].map((r) => r.map(esc).join(";"));
  return new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function summaryCsv(rows: DayRow[], weights: BodyMeasurement[], h: Record<string, string>): Blob {
  const w = new Map(weights.filter((b) => b.weight_kg != null).map((b) => [b.entry_date, b.weight_kg]));
  return toCsv(
    [h.date, h.kcal, h.protein, h.carbs, h.fat, h.sugar, h.fiber, h.salt, h.alcohol, h.water, h.burned, h.steps, h.sleep, h.sleepQuality, h.mood, h.energy, h.stress, h.weight],
    rows.map((r) => [
      r.date,
      Math.round(r.intake.kcal),
      r1(r.intake.protein_g),
      r1(r.intake.carbs_g),
      r1(r.intake.fat_g),
      r1(r.intake.sugar_g),
      r1(r.intake.fiber_g),
      r1(r.intake.salt_g),
      r1(r.intake.alcohol_g),
      r.water_ml,
      r.burned_kcal,
      r.steps || null,
      r.daily?.sleep_hours,
      r.daily?.sleep_quality,
      r.daily?.mood,
      r.daily?.energy,
      r.daily?.stress,
      w.get(r.date) ?? null,
    ]),
  );
}

export function entriesCsv(food: FoodEntry[], h: Record<string, string>, mealName: (m: string) => string): Blob {
  return toCsv(
    [h.date, h.time, h.meal, h.name, h.amount, h.kcal, h.protein, h.carbs, h.fat, h.sugar, h.fiber, h.salt, h.alcohol, h.source, h.estimated],
    food.map((f) => [
      f.entry_date,
      new Date(f.consumed_at).toTimeString().slice(0, 5),
      mealName(f.meal),
      f.name,
      f.volume_ml ?? f.grams,
      Math.round(f.kcal),
      f.protein_g,
      f.carbs_g,
      f.fat_g,
      f.sugar_g,
      f.fiber_g,
      f.salt_g,
      f.alcohol_g,
      f.source,
      f.is_estimated ? h.yes : h.no,
    ]),
  );
}

async function fontBase64(path: string): Promise<string> {
  const buf = new Uint8Array(await (await fetch(path)).arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

export interface PdfInput {
  title: string;
  subtitle: string;
  generated: string;
  summary: [string, string][];
  adherenceTitle: string;
  adherence: [string, string][];
  topTitle: string;
  topHead: string[];
  top: (string | number)[][];
  dailyTitle: string;
  dailyHead: string[];
  daily: (string | number)[][];
  disclaimer: string;
}

/** PDF raporu. Türkçe karakterler için DejaVu Sans yazı tipi belgeye gömülür. */
export async function reportPdf(input: PdfInput): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }, regular, bold] = await Promise.all([import("jspdf"), import("jspdf-autotable"), fontBase64("/fonts/DejaVuSans.ttf"), fontBase64("/fonts/DejaVuSans-Bold.ttf")]);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.addFileToVFS("DejaVuSans.ttf", regular);
  doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
  doc.addFileToVFS("DejaVuSans-Bold.ttf", bold);
  doc.addFont("DejaVuSans-Bold.ttf", "DejaVu", "bold");
  doc.setFont("DejaVu", "bold");
  doc.setFontSize(18);
  doc.text(input.title, 40, 50);
  doc.setFont("DejaVu", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(input.subtitle, 40, 68);
  doc.text(input.generated, 40, 82);
  doc.setTextColor(0);

  const base = { styles: { font: "DejaVu", fontSize: 9, cellPadding: 4 }, headStyles: { font: "DejaVu", fontStyle: "bold" as const, fillColor: [31, 157, 118] as [number, number, number] }, margin: { left: 40, right: 40 } };
  const section = (title: string, y: number) => {
    doc.setFont("DejaVu", "bold");
    doc.setFontSize(12);
    doc.text(title, 40, y);
    doc.setFont("DejaVu", "normal");
  };
  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  autoTable(doc, { ...base, startY: 98, body: input.summary, theme: "plain", columnStyles: { 0: { textColor: 100, cellWidth: 220 } } });
  section(input.adherenceTitle, lastY() + 24);
  autoTable(doc, { ...base, startY: lastY() + 32, body: input.adherence, theme: "plain", columnStyles: { 0: { textColor: 100, cellWidth: 220 } } });
  if (input.top.length) {
    section(input.topTitle, lastY() + 24);
    autoTable(doc, { ...base, startY: lastY() + 32, head: [input.topHead], body: input.top, theme: "striped" });
  }
  if (input.daily.length) {
    section(input.dailyTitle, lastY() + 24);
    autoTable(doc, { ...base, startY: lastY() + 32, head: [input.dailyHead], body: input.daily, theme: "striped", styles: { ...base.styles, fontSize: 8 } });
  }
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(doc.splitTextToSize(input.disclaimer, 515), 40, Math.min(lastY() + 28, 800));
  return doc.output("blob");
}
