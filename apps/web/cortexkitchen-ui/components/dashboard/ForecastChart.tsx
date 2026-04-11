// components/dashboard/ForecastChart.tsx
// Hourly demand bar chart for the Friday rush window.
// Reads from forecast recommendation — gracefully hides if no hourly data exists.

"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface HourlyPoint {
  hour:            string;
  expected_covers: number;
}

interface Props {
  forecast: Record<string, unknown> | null;
}

// Pull hourly data out of wherever the forecast agent put it
function extractHourlyData(forecast: Record<string, unknown> | null): HourlyPoint[] {
  if (!forecast) return [];

  // Try common keys the forecast service might use
  const candidates = [
    forecast.hourly_covers,
    forecast.hourly,
    forecast.rush_window,
    (forecast.data as Record<string, unknown>)?.hourly_covers,
    (forecast.data as Record<string, unknown>)?.hourly,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate as HourlyPoint[];
    }
    if (candidate && typeof candidate === "object") {
      // Object like { "18:00": 42, "19:00": 67 }
      return Object.entries(candidate as Record<string, number>).map(
        ([hour, expected_covers]) => ({ hour, expected_covers })
      );
    }
  }

  return [];
}

const RUSH_HOURS = ["18:00", "19:00", "20:00", "21:00"];

export default function ForecastChart({ forecast }: Props) {
  const data = extractHourlyData(forecast);

  if (data.length === 0) return null;

  const peak = Math.max(...data.map((d) => d.expected_covers));

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">⏱</span>
        <h3 className="text-sm font-semibold text-gray-800">Rush Window — Hourly Demand</h3>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 12, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              fontSize: "12px",
            }}
            formatter={(value: unknown) => [`${value} covers`, "Expected"]}
          />
          <Bar dataKey="expected_covers" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.hour}
                fill={
                  entry.expected_covers === peak
                    ? "#7c3aed"                                      // peak hour — violet
                    : RUSH_HOURS.includes(entry.hour)
                    ? "#a78bfa"                                      // rush window — light violet
                    : "#e5e7eb"                                      // off-peak — gray
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className="text-xs text-gray-400 mt-2">
        Peak hour highlighted · Rush window (18:00–21:00) in violet
      </p>
    </div>
  );
}