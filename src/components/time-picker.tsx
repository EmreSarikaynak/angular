"use client";
import { Select } from "@/components/ui";
import { formatHHMM, parseHHMM, quarterTimes } from "@/lib/bkn/schedule";

const OPTIONS = quarterTimes();

/**
 * 15 dakikalık adımlarla saat seçici (00:00, 00:15 … 23:45). Mobil tarayıcılar `<input type="time" step>` değerini
 * yok saydığı için seçim listesi kullanılır. Eski bir değer ızgarada değilse (ör. 19:07) kaybolmaz, listeye eklenir.
 */
export function TimePicker15({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const norm = value ? formatHHMM(parseHHMM(value)) : "00:00";
  const options = OPTIONS.includes(norm) ? OPTIONS : [...OPTIONS, norm].sort();
  return (
    <Select value={norm} aria-label={label} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </Select>
  );
}
