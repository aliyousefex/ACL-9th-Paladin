import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import site from "../data/site.json";
import { pct } from "../lib/format";

export function CoverageChart({ year }: { year: number }) {
  return (
    <figure aria-labelledby="coverage-chart-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p id="coverage-chart-title" className="font-medium">Recorded qualifying-position coverage</p>
          <p className="mt-1 text-[0.92rem] text-steel">Y-axis · share of driver-race rows with qualifying data</p>
        </div>
        <p className="text-[0.92rem] text-steel">X-axis · Formula One season</p>
      </div>
      <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={site.coverage} margin={{ top: 24, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="#2c3138" vertical={false} />
          <ReferenceArea
            x1={1950}
            x2={1993}
            fill="#c5cad1"
            fillOpacity={0.06}
            strokeOpacity={0}
            label={{ value: "No qualifying rows recorded", position: "insideTop", fill: "#c5cad1", fontSize: 12 }}
          />
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
            formatter={(value) => [pct(Number(value), 1), "Rows covered"]}
            labelFormatter={(label) => `Season ${label}`}
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
      <figcaption className="mt-2 max-w-[72ch] text-[0.92rem] leading-relaxed text-steel">
        Zero means this public dataset has no recorded qualifying position for those rows. It does not mean qualifying sessions did not happen.
      </figcaption>
    </figure>
  );
}
