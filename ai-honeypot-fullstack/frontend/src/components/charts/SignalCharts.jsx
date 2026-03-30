import React, { useMemo } from "react";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function polarToCartesian(cx, cy, radius, angleDeg) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

function describeArc(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function toChartData(data, fallbackLabel = "No data", fallbackColor = "#334155") {
  const normalized = Array.isArray(data)
    ? data
        .map((item) => ({
          name: String(item?.name || item?.label || fallbackLabel),
          value: Number(item?.value || 0),
          color: item?.color || fallbackColor,
        }))
        .filter((item) => item.value > 0)
    : [];

  if (normalized.length === 0) {
    return [{ name: fallbackLabel, value: 1, color: fallbackColor }];
  }
  return normalized;
}

function buildAreaPaths(points, baselineY) {
  if (!points.length) {
    return { linePath: "", areaPath: "" };
  }

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${baselineY.toFixed(2)} L ${points[0].x.toFixed(2)} ${baselineY.toFixed(2)} Z`;
  return { linePath, areaPath };
}

function DonutChart({
  data,
  size = 220,
  strokeWidth = 24,
  centerLabel,
  centerValue,
  legend = true,
  legendFormatter,
}) {
  const radius = size / 2 - strokeWidth * 1.1;
  const center = size / 2;
  const normalized = toChartData(data);
  const total = normalized.reduce((sum, item) => sum + item.value, 0);
  let currentAngle = 0;

  const segments = normalized.map((item) => {
    const angle = (item.value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;
    return {
      ...item,
      path: describeArc(center, center, radius, startAngle, endAngle),
    };
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: legend ? "minmax(0, 1fr) minmax(120px, 160px)" : "1fr", gap: "16px", alignItems: "center", height: "100%" }}>
      <div style={{ position: "relative", display: "grid", placeItems: "center", width: "100%", height: "100%" }}>
        <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" style={{ maxWidth: size, maxHeight: size }}>
          <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(30, 41, 59, 0.85)" strokeWidth={strokeWidth} />
          {segments.map((segment) => (
            <path
              key={segment.name}
              d={segment.path}
              fill="none"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
          ))}
        </svg>
        <div style={{ position: "absolute", textAlign: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: "10px", color: "#64748b", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {centerLabel}
          </div>
          <div style={{ fontSize: "22px", color: "#f8fafc", fontWeight: "900", marginTop: "4px" }}>
            {centerValue}
          </div>
        </div>
      </div>

      {legend ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {segments.map((segment) => (
            <div key={segment.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "999px", background: segment.color, flexShrink: 0 }} />
                <span style={{ color: "#cbd5e1", fontSize: "11px", fontWeight: "700", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {segment.name}
                </span>
              </div>
              <span style={{ color: "#94a3b8", fontSize: "11px", fontWeight: "800", flexShrink: 0 }}>
                {legendFormatter ? legendFormatter(segment) : segment.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function MitreDonutChart({ mitreData = [] }) {
  const colors = ["#1f6feb", "#58a6ff", "#2ea043", "#f85149", "#d29922", "#8b5cf6"];
  const data = toChartData(mitreData, "None", "#334155").map((item, index) => ({
    ...item,
    color: colors[index % colors.length],
  }));
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <DonutChart
      data={data}
      centerLabel="Signals"
      centerValue={total}
      legendFormatter={(item) => `${item.value}`}
    />
  );
}

export function SeverityDonutChart({ severityData = [] }) {
  const colors = {
    Critical: "#f85149",
    Medium: "#d29922",
    Low: "#3fb950",
  };
  const data = toChartData(severityData, "None", "#334155").map((item) => ({
    ...item,
    color: colors[item.name] || "#58a6ff",
  }));
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <DonutChart
      data={data}
      size={190}
      strokeWidth={20}
      centerLabel="Events"
      centerValue={total}
      legend={false}
    />
  );
}

export function AreaTrendChart({
  data = [],
  valueKey = "value",
  labelKey = "label",
  minValue = 0,
  maxValue,
  color = "#0ea5e9",
  height = 180,
  showFooter = true,
  emptyLabel = "No trend data available yet.",
}) {
  const width = 560;
  const padding = { top: 18, right: 16, bottom: 24, left: 16 };
  const values = data.map((item) => Number(item?.[valueKey] || 0));
  const computedMax = Number.isFinite(Number(maxValue))
    ? Number(maxValue)
    : Math.max(minValue + 1, ...values, 1);
  const safeRange = Math.max(computedMax - minValue, 1);
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const points = useMemo(() => {
    if (!data.length) {
      return [];
    }
    const step = data.length === 1 ? plotWidth / 2 : plotWidth / (data.length - 1);
    return data.map((item, index) => {
      const rawValue = Number(item?.[valueKey] || 0);
      const normalized = clamp((rawValue - minValue) / safeRange, 0, 1);
      return {
        id: `${index}-${item?.[labelKey] || "point"}`,
        x: padding.left + step * index,
        y: padding.top + plotHeight - normalized * plotHeight,
        value: rawValue,
        label: item?.[labelKey] ?? index + 1,
        meta: item?.cmd || item?.name || item?.event_type || "",
      };
    });
  }, [data, labelKey, minValue, plotHeight, plotWidth, safeRange, valueKey]);

  const { linePath, areaPath } = buildAreaPaths(points, padding.top + plotHeight);
  const footer = points.length
    ? {
        peak: Math.max(...points.map((point) => point.value)),
        latest: points[points.length - 1].value,
        first: points[0].value,
      }
    : null;

  return (
    <div style={{ display: "grid", gridTemplateRows: "1fr auto", height: "100%" }}>
      <div style={{ position: "relative", height }}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
          {[0.25, 0.5, 0.75].map((ratio) => {
            const y = padding.top + plotHeight * ratio;
            return (
              <line
                key={ratio}
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="rgba(51, 65, 85, 0.6)"
                strokeDasharray="4 6"
              />
            );
          })}

          {areaPath ? <path d={areaPath} fill={color} fillOpacity="0.16" /> : null}
          {linePath ? <path d={linePath} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /> : null}

          {points.map((point) => (
            <g key={point.id}>
              <circle cx={point.x} cy={point.y} r="4.2" fill={color} fillOpacity="0.25" />
              <circle cx={point.x} cy={point.y} r="2.4" fill={color}>
                <title>{`${point.label}: ${point.value}${point.meta ? ` | ${point.meta}` : ""}`}</title>
              </circle>
            </g>
          ))}
        </svg>

        {!points.length ? (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#64748b", fontSize: "12px" }}>
            {emptyLabel}
          </div>
        ) : null}
      </div>

      {showFooter && footer ? (
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", paddingTop: "8px", fontSize: "11px" }}>
          <span style={{ color: "#64748b" }}>
            First <strong style={{ color: "#cbd5e1" }}>{footer.first}</strong>
          </span>
          <span style={{ color: "#64748b" }}>
            Peak <strong style={{ color: "#f8fafc" }}>{footer.peak}</strong>
          </span>
          <span style={{ color: "#64748b" }}>
            Latest <strong style={{ color }}>{footer.latest}</strong>
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function ForecastSparkChart({ forecast = [] }) {
  const normalized = Array.isArray(forecast)
    ? forecast.map((item, index) => ({
        hour: item?.hour ?? index + 1,
        predicted_volume: Number(item?.predicted_volume || 0),
      }))
    : [];

  return (
    <AreaTrendChart
      data={normalized}
      valueKey="predicted_volume"
      labelKey="hour"
      minValue={0}
      color="#3fb950"
      height={140}
      emptyLabel="Forecast engine is waiting for more telemetry."
    />
  );
}
