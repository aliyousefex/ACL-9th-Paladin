import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import site from "../data/site.json";
import { pct } from "../lib/format";

export function HomeChart() {
  const data = site.home.map((row) => ({
    band: row.band,
    Home: row.homeRate,
    Away: row.awayRate,
  }));

  return (
    <div className="w-full">
      <p className="mb-2 text-[1rem]">
        <span className="text-steel">Away</span>
        <span className="mx-2 text-line">/</span>
        <span className="text-ink">Home</span>
      </p>
      <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#2c3138" vertical={false} />
          <XAxis
            dataKey="band"
            tick={{ fill: "#c5cad1", fontSize: 12, fontFamily: "Barlow Condensed, sans-serif" }}
            axisLine={{ stroke: "#2c3138" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 0.6]}
            tickFormatter={(value: number) => pct(value, 0)}
            tick={{ fill: "#c5cad1", fontSize: 12, fontFamily: "Barlow Condensed, sans-serif" }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            formatter={(value) => pct(Number(value), 1)}
            contentStyle={{
              background: "#07080a",
              border: "1px solid #2c3138",
              borderRadius: 0,
              color: "#f4f4f2",
              fontFamily: "Barlow Condensed, sans-serif",
              fontSize: 14,
            }}
          />
          <Line type="monotone" dataKey="Away" stroke="#c5cad1" strokeWidth={1.75} dot={{ r: 3, fill: "#c5cad1" }} activeDot={{ r: 5, fill: "#f4f4f2" }} />
          <Line type="monotone" dataKey="Home" stroke="#e10600" strokeWidth={1.75} dot={{ r: 3, fill: "#e10600" }} activeDot={{ r: 5, fill: "#e10600" }} />
        </LineChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
