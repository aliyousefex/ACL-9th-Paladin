import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import site from "../data/site.json";
import { pct } from "../lib/format";

export function CoverageChart({ year }: { year: number }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={site.coverage} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#2c3138" vertical={false} />
          <XAxis
            dataKey="year"
            ticks={[1950, 1970, 1990, 2000, 2010, 2024]}
            tick={{ fill: "#c5cad1", fontSize: 12, fontFamily: "Barlow Condensed, sans-serif" }}
            axisLine={{ stroke: "#2c3138" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 1]}
            ticks={[0, 0.5, 1]}
            tickFormatter={(value: number) => pct(value, 0)}
            tick={{ fill: "#c5cad1", fontSize: 12, fontFamily: "Barlow Condensed, sans-serif" }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            formatter={(value) => pct(Number(value), 1)}
            labelFormatter={(label) => String(label)}
            contentStyle={{
              background: "#07080a",
              border: "1px solid #2c3138",
              borderRadius: 0,
              color: "#f4f4f2",
              fontFamily: "Barlow Condensed, sans-serif",
              fontSize: 14,
            }}
          />
          <ReferenceLine x={year} stroke="#e10600" strokeWidth={1.5} />
          <Line type="monotone" dataKey="coverage" stroke="#f4f4f2" strokeWidth={1.75} dot={false} activeDot={{ r: 4, fill: "#e10600" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
