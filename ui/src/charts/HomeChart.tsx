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
      <p className="mb-2 font-mono text-[12px]">
        <span className="text-steel">Away</span>
        <span className="mx-2 text-quiet">/</span>
        <span className="text-signal">Home</span>
      </p>
      <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#d5cec2" vertical={false} />
          <XAxis
            dataKey="band"
            tick={{ fill: "#17191c", fontSize: 11, fontFamily: "IBM Plex Mono, monospace" }}
            axisLine={{ stroke: "#17191c" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 0.6]}
            tickFormatter={(value: number) => pct(value, 0)}
            tick={{ fill: "#17191c", fontSize: 11, fontFamily: "IBM Plex Mono, monospace" }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            formatter={(value) => pct(Number(value), 1)}
            contentStyle={{
              background: "#f3f0e8",
              border: "1px solid #17191c",
              borderRadius: 0,
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 12,
            }}
          />
          <Line type="monotone" dataKey="Away" stroke="#1e3a5f" strokeWidth={1.75} dot={{ r: 3, fill: "#1e3a5f" }} />
          <Line type="monotone" dataKey="Home" stroke="#9f1d14" strokeWidth={1.75} dot={{ r: 3, fill: "#9f1d14" }} />
        </LineChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
