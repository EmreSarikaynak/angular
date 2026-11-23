"use client";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const axis = { fontSize: 11, fill: "var(--muted)" };
const tooltipStyle = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12, color: "var(--text)" };

export interface Point {
  label: string;
  value: number | null;
}

export function BarSeries({ data, color = "var(--primary)", target, unit, height = 200 }: { data: Point[]; color?: string; target?: number | null; unit: string; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={48} />
          <Tooltip cursor={{ fill: "var(--surface-2)" }} contentStyle={tooltipStyle} formatter={(v) => [`${Math.round(Number(v) * 10) / 10} ${unit}`, ""]} separator="" />
          {target ? <ReferenceLine y={target} stroke="var(--muted)" strokeDasharray="5 4" /> : null}
          <Bar dataKey="value" fill={color} radius={[5, 5, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineSeries({ data, color = "var(--primary)", target, unit, height = 200 }: { data: Point[]; color?: string; target?: number | null; unit: string; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={48} domain={["auto", "auto"]} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Math.round(Number(v) * 10) / 10} ${unit}`, ""]} separator="" />
          {target ? <ReferenceLine y={target} stroke="var(--muted)" strokeDasharray="5 4" /> : null}
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color }} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Donut({ data, height = 180 }: { data: { name: string; value: number; color: string }[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="88%" paddingAngle={2} stroke="none" isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${Math.round(Number(v))}%`, String(n)]} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
