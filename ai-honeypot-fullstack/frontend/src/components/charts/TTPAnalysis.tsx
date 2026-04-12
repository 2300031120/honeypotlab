import React, { useMemo } from "react";

type TTPEvent = {
  id: string | number;
  mitre_tactic?: string;
  mitre_technique?: string;
  severity: "high" | "medium" | "low";
  score: number;
  event_type: string;
  timestamp: string;
};

type TTPAnalysisProps = {
  events: TTPEvent[];
  height?: number;
  onTacticClick?: (tactic: string, events: TTPEvent[]) => void;
};

// MITRE ATT&CK Tactics with colors
const tacticColors: Record<string, string> = {
  "Reconnaissance": "#3fb950",
  "Resource Development": "#42b8ff",
  "Initial Access": "#f85149",
  "Execution": "#d29922",
  "Persistence": "#a371f7",
  "Privilege Escalation": "#f97316",
  "Defense Evasion": "#ec4899",
  "Credential Access": "#f85149",
  "Discovery": "#3fb950",
  "Lateral Movement": "#d29922",
  "Collection": "#a371f7",
  "Command and Control": "#42b8ff",
  "Exfiltration": "#f97316",
  "Impact": "#ec4899",
};

export function TTPAnalysis({
  events,
  height = 300,
  onTacticClick,
}: TTPAnalysisProps) {
  const { tacticData, techniqueData, timeline } = useMemo(() => {
    if (!events || events.length === 0) {
      return { tacticData: [], techniqueData: [], timeline: [] };
    }

    // Group by tactic
    const tacticMap = new Map<string, TTPEvent[]>();
    events.forEach((event) => {
      const tactic = event.mitre_tactic || "Unknown";
      if (!tacticMap.has(tactic)) {
        tacticMap.set(tactic, []);
      }
      tacticMap.get(tactic)!.push(event);
    });

    // Convert to array and sort
    const tacticData = Array.from(tacticMap.entries())
      .map(([tactic, tacticEvents]) => ({
        tactic,
        events: tacticEvents,
        count: tacticEvents.length,
        avgScore: tacticEvents.reduce((sum, e) => sum + e.score, 0) / tacticEvents.length,
        techniques: [...new Set(tacticEvents.map((e) => e.mitre_technique || "Unknown"))],
      }))
      .sort((a, b) => b.count - a.count);

    // Group by technique
    const techniqueMap = new Map<string, TTPEvent[]>();
    events.forEach((event) => {
      const technique = event.mitre_technique || "Unknown";
      if (!techniqueMap.has(technique)) {
        techniqueMap.set(technique, []);
      }
      techniqueMap.get(technique)!.push(event);
    });

    const techniqueData = Array.from(techniqueMap.entries())
      .map(([technique, techniqueEvents]) => ({
        technique,
        events: techniqueEvents,
        count: techniqueEvents.length,
        tactic: techniqueEvents[0]?.mitre_tactic || "Unknown",
      }))
      .sort((a, b) => b.count - a.count);

    // Create timeline of tactic progression
    const sortedEvents = [...events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const timeline = sortedEvents.map((event, index) => ({
      index,
      tactic: event.mitre_tactic || "Unknown",
      technique: event.mitre_technique || "Unknown",
      severity: event.severity,
      score: event.score,
    }));

    return { tacticData, techniqueData, timeline };
  }, [events]);

  const maxTacticCount = Math.max(...tacticData.map((t) => t.count), 1);
  const maxTechniqueCount = Math.max(...techniqueData.map((t) => t.count), 1);

  if (!events || events.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-muted text-sm">No TTP data to display</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Tactic Distribution Bar Chart */}
      <div>
        <h4 className="text-sm font-semibold mb-2">Attack Tactics Distribution</h4>
        <div className="space-y-2">
          {tacticData.slice(0, 8).map((data) => {
            const barWidth = (data.count / maxTacticCount) * 100;
            const color = tacticColors[data.tactic] || "#8ca0b6";
            
            return (
              <div key={data.tactic} className="flex items-center gap-2">
                <div className="w-32 text-xs text-right text-muted truncate" title={data.tactic}>
                  {data.tactic}
                </div>
                <div className="flex-1 h-6 bg-surface rounded overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: color,
                      cursor: onTacticClick ? "pointer" : "default",
                    }}
                    onClick={() => onTacticClick?.(data.tactic, data.events)}
                    title={`${data.count} events, Avg Score: ${data.avgScore.toFixed(1)}`}
                  />
                </div>
                <div className="w-12 text-xs text-muted">{data.count}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Technique Breakdown */}
      <div>
        <h4 className="text-sm font-semibold mb-2">Top Techniques</h4>
        <div className="space-y-1">
          {techniqueData.slice(0, 10).map((data) => {
            const barWidth = (data.count / maxTechniqueCount) * 100;
            const tacticColor = tacticColors[data.tactic] || "#8ca0b6";
            
            return (
              <div key={data.technique} className="flex items-center gap-2 text-xs">
                <div className="w-24 text-muted truncate" title={data.technique}>
                  {data.technique}
                </div>
                <div className="flex-1 h-4 bg-surface rounded overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: tacticColor,
                    }}
                  />
                </div>
                <div className="w-8 text-muted">{data.count}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Attack Chain Timeline */}
      <div>
        <h4 className="text-sm font-semibold mb-2">Attack Chain Timeline</h4>
        <div className="flex gap-1 overflow-x-auto pb-2">
          {timeline.slice(0, 20).map((item) => {
            const color = tacticColors[item.tactic] || "#8ca0b6";
            
            return (
              <div
                key={item.index}
                className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center text-xs font-bold text-white"
                style={{
                  backgroundColor: color,
                  opacity: item.severity === "high" ? 1 : item.severity === "medium" ? 0.8 : 0.6,
                }}
                title={`${item.tactic}: ${item.technique}`}
              >
                {item.index + 1}
              </div>
            );
          })}
          {timeline.length > 20 && (
            <div className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center text-xs text-muted bg-surface">
              +{timeline.length - 20}
            </div>
          )}
        </div>
        <div className="flex gap-4 mt-2 text-xs text-muted">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: tacticColors["Initial Access"] }} />
            <span>Initial Access</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: tacticColors["Credential Access"] }} />
            <span>Credential Access</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: tacticColors["Discovery"] }} />
            <span>Discovery</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: tacticColors["Execution"] }} />
            <span>Execution</span>
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-3 gap-4 p-4 bg-surface rounded">
        <div className="text-center">
          <div className="text-2xl font-bold">{tacticData.length}</div>
          <div className="text-xs text-muted">Unique Tactics</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">{techniqueData.length}</div>
          <div className="text-xs text-muted">Unique Techniques</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">
            {tacticData.reduce((sum, t) => sum + t.avgScore, 0) / tacticData.length || 0}
          </div>
          <div className="text-xs text-muted">Avg Tactic Score</div>
        </div>
      </div>
    </div>
  );
}
