import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import site from "../data/site.json";
import { pct } from "../lib/format";

export function CoverageChart({ year }: { year: number }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={site.coverage} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#d5cec2" vertical={false} />
          <XAxis
            dataKey="year"
            ticks={[1950, 1970, 1990, 2000, 2010, 2024]}
            tick={{ fill: "#17191c", fontSize: 11, fontFamily: "IBM Plex Mono, monospace" }}
            axisLine={{ stroke: "#17191c" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 1]}
            ticks={[0, 0.5, 1]}
            tickFormatter={(value: number) => pct(value, 0)}
            tick={{ fill: "#17191c", fontSize: 11, fontFamily: "IBM Plex Mono, monospace" }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            formatter={(value) => pct(Number(value), 1)}
            labelFormatter={(label) => String(label)}
            contentStyle={{
              background: "#f3f0e8",
              border: "1px solid #17191c",
              borderRadius: 0,
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 12,
            }}
          />
          <ReferenceLine x={year} stroke="#9f1d14" strokeWidth={1.5} />
          <Line type="monotone" dataKey="coverage" stroke="#1e3a5f" strokeWidth={1.75} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
