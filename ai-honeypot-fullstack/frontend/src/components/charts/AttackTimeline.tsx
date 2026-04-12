import React, { useMemo } from "react";

type TimelineEvent = {
  id: string | number;
  timestamp: string;
  severity: "high" | "medium" | "low";
  score: number;
  event_type: string;
  ip: string;
  country?: string;
  mitre_tactic?: string;
  mitre_technique?: string;
};

type AttackTimelineProps = {
  events: TimelineEvent[];
  height?: number;
  showDetails?: boolean;
  onEventClick?: (event: TimelineEvent) => void;
};

const severityColors = {
  high: "#f85149",
  medium: "#d29922",
  low: "#3fb950",
};

const severityOrder = { high: 3, medium: 2, low: 1 };

export function AttackTimeline({
  events,
  height = 200,
  showDetails = true,
  onEventClick,
}: AttackTimelineProps) {
  const { timelineData, timeRange } = useMemo(() => {
    if (!events || events.length === 0) {
      return { timelineData: [], timeRange: { start: 0, end: 0 } };
    }

    // Sort events by timestamp
    const sorted = [...events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Calculate time range
    const timestamps = sorted.map((e) => new Date(e.timestamp).getTime());
    const startTime = Math.min(...timestamps);
    const endTime = Math.max(...timestamps);
    const timeSpan = endTime - startTime || 1; // Avoid division by zero

    // Map events to timeline positions
    const timelineData = sorted.map((event, index) => {
      const timestamp = new Date(event.timestamp).getTime();
      const x = ((timestamp - startTime) / timeSpan) * 100;
      const y = severityOrder[event.severity] * 25; // 25, 50, 75 for low, medium, high

      return {
        ...event,
        x,
        y,
        index,
      };
    });

    return { timelineData, timeRange: { start: startTime, end: endTime } };
  }, [events]);

  if (!events || events.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-muted text-sm">No events to display</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <svg width="100%" height={height} className="overflow-visible">
        {/* Time axis */}
        <line x1="0" y1={height - 20} x2="100%" y2={height - 20} stroke="#334155" strokeWidth="1" />

        {/* Severity labels */}
        <text x="5" y="30" fill="#3fb950" fontSize="10">Low</text>
        <text x="5" y="55" fill="#d29922" fontSize="10">Medium</text>
        <text x="5" y="80" fill="#f85149" fontSize="10">High</text>

        {/* Severity bands */}
        <rect x="40" y="20" width="100%" height="20" fill="rgba(63, 185, 80, 0.05)" />
        <rect x="40" y="45" width="100%" height="20" fill="rgba(210, 153, 34, 0.05)" />
        <rect x="40" y="70" width="100%" height="20" fill="rgba(248, 81, 73, 0.05)" />

        {/* Event points */}
        {timelineData.map((event) => (
          <g key={event.id}>
            {/* Vertical line to time axis */}
            <line
              x1={`${event.x}%`}
              y1={event.y}
              x2={`${event.x}%`}
              y2={height - 20}
              stroke={severityColors[event.severity]}
              strokeWidth={1}
              opacity={0.3}
            />

            {/* Event point */}
            <circle
              cx={`${event.x}%`}
              cy={event.y}
              r={6}
              fill={severityColors[event.severity]}
              style={{ cursor: onEventClick ? "pointer" : "default" }}
              onClick={() => onEventClick?.(event)}
              className="transition-transform hover:scale-125"
            />

            {/* Event label */}
            {showDetails && timelineData.length <= 20 && (
              <text
                x={`${event.x}%`}
                y={event.y - 10}
                fill="#e6edf3"
                fontSize="9"
                textAnchor="middle"
                style={{ pointerEvents: "none" }}
              >
                {event.event_type}
              </text>
            )}
          </g>
        ))}

        {/* Time labels */}
        <text x="0" y={height - 5} fill="#8ca0b6" fontSize="9">
          {new Date(timeRange.start).toLocaleTimeString()}
        </text>
        <text x="100%" y={height - 5} fill="#8ca0b6" fontSize="9" textAnchor="end">
          {new Date(timeRange.end).toLocaleTimeString()}
        </text>
      </svg>

      {/* Legend */}
      <div className="flex gap-4 mt-2 text-xs text-muted">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: severityColors.high }} />
          <span>High Severity</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: severityColors.medium }} />
          <span>Medium Severity</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: severityColors.low }} />
          <span>Low Severity</span>
        </div>
      </div>
    </div>
  );
}
