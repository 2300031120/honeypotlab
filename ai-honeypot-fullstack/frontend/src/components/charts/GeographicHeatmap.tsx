import React, { useMemo } from "react";

type GeoEvent = {
  id: string | number;
  country: string;
  severity: "high" | "medium" | "low";
  score: number;
  event_type: string;
  ip: string;
};

type GeographicHeatmapProps = {
  events: GeoEvent[];
  height?: number;
  onCountryClick?: (country: string, events: GeoEvent[]) => void;
};

// Simplified country coordinates (lat, lng) for visualization
const countryCoordinates: Record<string, { lat: number; lng: number }> = {
  "United States": { lat: 37.0902, lng: -95.7129 },
  "China": { lat: 35.8617, lng: 104.1954 },
  "Russia": { lat: 61.5240, lng: 105.3188 },
  "Brazil": { lat: -14.2350, lng: -51.9253 },
  "Germany": { lat: 51.1657, lng: 10.4515 },
  "India": { lat: 20.5937, lng: 78.9629 },
  "United Kingdom": { lat: 55.3781, lng: -3.4360 },
  "France": { lat: 46.2276, lng: 2.2137 },
  "Japan": { lat: 36.2048, lng: 138.2529 },
  "Canada": { lat: 56.1304, lng: -106.3468 },
  "Australia": { lat: -25.2744, lng: 133.7751 },
  "Netherlands": { lat: 52.3676, lng: 4.9041 },
  "Singapore": { lat: 1.3521, lng: 103.8198 },
  "South Korea": { lat: 35.9078, lng: 127.7669 },
  "Italy": { lat: 41.8719, lng: 12.5674 },
  "Spain": { lat: 40.4637, lng: -3.7492 },
  "Mexico": { lat: 23.6345, lng: -102.5528 },
  "Indonesia": { lat: -0.7893, lng: 113.9213 },
  "Turkey": { lat: 38.9637, lng: 35.2433 },
  "Saudi Arabia": { lat: 23.8859, lng: 45.0792 },
};

const severityColors = {
  high: "#f85149",
  medium: "#d29922",
  low: "#3fb950",
};

export function GeographicHeatmap({
  events,
  height = 300,
  onCountryClick,
}: GeographicHeatmapProps) {
  const { countryData, maxEvents } = useMemo(() => {
    if (!events || events.length === 0) {
      return { countryData: [], maxEvents: 0 };
    }

    // Group events by country
    const countryMap = new Map<string, GeoEvent[]>();
    events.forEach((event) => {
      const country = event.country || "Unknown";
      if (!countryMap.has(country)) {
        countryMap.set(country, []);
      }
      countryMap.get(country)!.push(event);
    });

    // Convert to array and sort by event count
    const countryData = Array.from(countryMap.entries())
      .map(([country, countryEvents]) => ({
        country,
        events: countryEvents,
        count: countryEvents.length,
        coords: countryCoordinates[country] || { lat: 0, lng: 0 },
        avgSeverity: countryEvents.reduce((sum, e) => {
          const severityScore = e.severity === "high" ? 3 : e.severity === "medium" ? 2 : 1;
          return sum + severityScore;
        }, 0) / countryEvents.length,
      }))
      .sort((a, b) => b.count - a.count);

    const maxEvents = Math.max(...countryData.map((c) => c.count), 1);

    return { countryData, maxEvents };
  }, [events]);

  if (!events || events.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-muted text-sm">No geographic data to display</p>
      </div>
    );
  }

  // Map coordinates to SVG coordinates (simple equirectangular projection)
  const mapToSvg = (lat: number, lng: number) => {
    const x = ((lng + 180) / 360) * 100;
    const y = ((-lat + 90) / 180) * 100;
    return { x, y };
  };

  return (
    <div className="w-full">
      <svg width="100%" height={height} viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet">
        {/* World map outline (simplified) */}
        <rect x="0" y="0" width="100" height="60" fill="#010409" />
        
        {/* Grid lines */}
        {[0, 20, 40, 60, 80].map((x) => (
          <line key={`v-${x}`} x1={x} y1="0" x2={x} y2="60" stroke="#1e293b" strokeWidth="0.2" />
        ))}
        {[0, 15, 30, 45].map((y) => (
          <line key={`h-${y}`} x1="0" y1={y} x2="100" y2={y} stroke="#1e293b" strokeWidth="0.2" />
        ))}

        {/* Country circles with size based on event count */}
        {countryData.map((data) => {
          const { x, y } = mapToSvg(data.coords.lat, data.coords.lng);
          const radius = Math.max(2, (data.count / maxEvents) * 8);
          const color = data.avgSeverity >= 2.5 ? severityColors.high : 
                       data.avgSeverity >= 1.5 ? severityColors.medium : severityColors.low;
          
          return (
            <g key={data.country}>
              {/* Glow effect */}
              <circle
                cx={x}
                cy={y}
                r={radius + 2}
                fill={color}
                opacity={0.2}
              />
              {/* Main circle */}
              <circle
                cx={x}
                cy={y}
                r={radius}
                fill={color}
                style={{ cursor: onCountryClick ? "pointer" : "default" }}
                onClick={() => onCountryClick?.(data.country, data.events)}
                className="transition-opacity hover:opacity-80"
              />
              {/* Country label for top countries */}
              {data.count >= maxEvents * 0.3 && (
                <text
                  x={x}
                  y={y - radius - 2}
                  fill="#e6edf3"
                  fontSize="1.5"
                  textAnchor="middle"
                  style={{ pointerEvents: "none" }}
                >
                  {data.country.substring(0, 3).toUpperCase()}
                </text>
              )}
            </g>
          );
        })}

        {/* Legend */}
        <g transform="translate(2, 52)">
          <text x="0" y="0" fill="#8ca0b6" fontSize="1.5">High</text>
          <circle cx="8" cy="3" r="2" fill={severityColors.high} />
          
          <text x="15" y="0" fill="#8ca0b6" fontSize="1.5">Med</text>
          <circle cx="23" cy="3" r="2" fill={severityColors.medium} />
          
          <text x="30" y="0" fill="#8ca0b6" fontSize="1.5">Low</text>
          <circle cx="38" cy="3" r="2" fill={severityColors.low} />
        </g>
      </svg>

      {/* Country statistics table */}
      <div className="mt-4">
        <h4 className="text-sm font-semibold mb-2">Top Attack Sources</h4>
        <div className="space-y-1">
          {countryData.slice(0, 5).map((data) => (
            <div
              key={data.country}
              className="flex items-center justify-between text-xs p-2 rounded hover:bg-surface cursor-pointer"
              onClick={() => onCountryClick?.(data.country, data.events)}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: data.avgSeverity >= 2.5 ? severityColors.high :
                                     data.avgSeverity >= 1.5 ? severityColors.medium : severityColors.low
                  }}
                />
                <span>{data.country}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-muted">{data.count} events</span>
                <span className="text-muted">Avg: {data.avgSeverity.toFixed(1)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
