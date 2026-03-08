import React from "react";
import {
  Area,
  AreaChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

const MITRE_COLORS = ["#1f6feb", "#58a6ff", "#2ea043", "#f85149", "#d29922"];
const SEVERITY_COLORS = ["#f85149", "#d29922", "#3fb950"];

export function MitrePieChart({ mitreData = [] }) {
  const data = mitreData.length > 0 ? mitreData : [{ name: "None", value: 1 }];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={5}
          dataKey="value"
          stroke="none"
        >
          {data.map((entry, index) => (
            <Cell key={`${entry.name}-${index}`} fill={MITRE_COLORS[index % MITRE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "rgba(22, 27, 34, 0.95)",
            border: "1px solid #30363d",
            borderRadius: "12px",
            fontSize: "12px",
            backdropFilter: "blur(10px)",
          }}
        />
        <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: "10px", fontWeight: "800" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function RiskPieChart({ severityData = [] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={severityData}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={70}
          paddingAngle={8}
          dataKey="value"
          stroke="none"
        >
          {severityData.map((entry, index) => (
            <Cell key={`${entry.name}-${index}`} fill={SEVERITY_COLORS[index % SEVERITY_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "rgba(22, 27, 34, 0.95)",
            border: "1px solid #30363d",
            borderRadius: "12px",
            fontSize: "11px",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ForecastAreaChart({ forecast = [] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={forecast}>
        <XAxis dataKey="hour" hide />
        <Tooltip
          contentStyle={{
            background: "#161b22",
            border: "1px solid #30363d",
            borderRadius: "8px",
            fontSize: "10px",
          }}
        />
        <Area
          type="monotone"
          dataKey="predicted_volume"
          stroke="#3fb950"
          fill="#3fb950"
          fillOpacity={0.1}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default {
  MitrePieChart,
  RiskPieChart,
  ForecastAreaChart,
};
