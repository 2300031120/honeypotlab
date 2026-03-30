import React, { useMemo } from "react";

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 450;
const DEFAULT_TARGET = { lat: 51.5074, lng: -0.1278 };

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function projectPoint(lat, lng, width, height) {
  const radius = Math.min(width * 0.31, height * 0.44);
  const centerX = width * 0.5;
  const centerY = height * 0.53;
  const latRad = (Number(lat || 0) * Math.PI) / 180;
  const lngRad = (Number(lng || 0) * Math.PI) / 180;
  const x = centerX + radius * Math.cos(latRad) * Math.sin(lngRad);
  const y = centerY - radius * Math.sin(latRad);
  const depth = Math.cos(latRad) * Math.cos(lngRad);

  return {
    x,
    y,
    depth,
  };
}

function arcPath(start, end, lift = 40) {
  const controlX = (start.x + end.x) / 2;
  const controlY = Math.min(start.y, end.y) - lift;
  return `M ${start.x} ${start.y} Q ${controlX} ${controlY} ${end.x} ${end.y}`;
}

export default function ThreatGlobe({ globeData = [], arcsData = [], width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT }) {
  const targetPoint = useMemo(() => projectPoint(DEFAULT_TARGET.lat, DEFAULT_TARGET.lng, width, height), [width, height]);

  const points = useMemo(() => {
    return globeData
      .map((point, index) => {
        const projection = projectPoint(point.lat, point.lng, width, height);
        const intensity = clamp(Number(point.size || 0.18) * 26, 5, 16);
        return {
          id: point.id || point.label || `point-${index}`,
          color: point.color || "#58a6ff",
          opacity: clamp(0.28 + ((projection.depth + 1) / 2) * 0.62, 0.28, 0.9),
          radius: intensity,
          x: projection.x,
          y: projection.y,
          depth: projection.depth,
        };
      })
      .sort((a, b) => a.depth - b.depth);
  }, [globeData, height, width]);

  const arcs = useMemo(() => {
    return arcsData.slice(0, 18).map((arc, index) => {
      const start = projectPoint(arc.startLat, arc.startLng, width, height);
      const end = Number.isFinite(Number(arc.endLat)) && Number.isFinite(Number(arc.endLng))
        ? projectPoint(arc.endLat, arc.endLng, width, height)
        : targetPoint;
      const depthFactor = clamp((start.depth + 1) / 2, 0.2, 1);
      return {
        id: `arc-${index}`,
        path: arcPath(start, end, 24 + depthFactor * 34),
        color: arc.color || "#58a6ff",
        opacity: clamp(0.16 + depthFactor * 0.5, 0.16, 0.72),
      };
    });
  }, [arcsData, height, targetPoint, width]);

  const rings = [0.34, 0.5, 0.66, 0.82];
  const meridians = [-0.7, -0.35, 0, 0.35, 0.7];
  const activeNodes = points.length;
  const activeCorridors = arcs.length;

  return (
    <div
      aria-label="Global threat mesh"
      style={{
        position: "relative",
        width: "100%",
        height,
        borderRadius: "18px",
        overflow: "hidden",
        background:
          "radial-gradient(circle at 50% 20%, rgba(88,166,255,0.22), transparent 34%), radial-gradient(circle at 80% 100%, rgba(63,185,80,0.14), transparent 26%), linear-gradient(180deg, rgba(8,13,22,0.95) 0%, rgba(2,7,16,1) 100%)",
        border: "1px solid rgba(88,166,255,0.14)",
      }}
    >
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" role="img" aria-hidden="true">
        <defs>
          <radialGradient id="threat-mesh-fill" cx="50%" cy="48%" r="58%">
            <stop offset="0%" stopColor="rgba(88,166,255,0.24)" />
            <stop offset="55%" stopColor="rgba(14,29,48,0.9)" />
            <stop offset="100%" stopColor="rgba(4,10,18,1)" />
          </radialGradient>
          <filter id="threat-node-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width={width} height={height} fill="transparent" />
        <ellipse
          cx={width * 0.5}
          cy={height * 0.53}
          rx={Math.min(width * 0.31, height * 0.44)}
          ry={Math.min(width * 0.31, height * 0.44)}
          fill="url(#threat-mesh-fill)"
          stroke="rgba(148,163,184,0.18)"
          strokeWidth="1.2"
        />

        {rings.map((ratio) => (
          <ellipse
            key={`ring-${ratio}`}
            cx={width * 0.5}
            cy={height * 0.53}
            rx={Math.min(width * 0.31, height * 0.44)}
            ry={Math.min(width * 0.31, height * 0.44) * ratio}
            fill="none"
            stroke="rgba(88,166,255,0.08)"
            strokeWidth="1"
          />
        ))}

        {meridians.map((offset) => (
          <ellipse
            key={`meridian-${offset}`}
            cx={width * 0.5 + offset * 22}
            cy={height * 0.53}
            rx={Math.min(width * 0.31, height * 0.44) * (1 - Math.abs(offset) * 0.22)}
            ry={Math.min(width * 0.31, height * 0.44)}
            fill="none"
            stroke="rgba(88,166,255,0.07)"
            strokeWidth="1"
          />
        ))}

        {arcs.map((arc) => (
          <path
            key={arc.id}
            d={arc.path}
            fill="none"
            stroke={arc.color}
            strokeOpacity={arc.opacity}
            strokeWidth="1.6"
            strokeDasharray="5 8"
            strokeLinecap="round"
          >
            <animate attributeName="stroke-dashoffset" from="0" to="-52" dur="3.8s" repeatCount="indefinite" />
          </path>
        ))}

        <circle cx={targetPoint.x} cy={targetPoint.y} r="8" fill="#58a6ff" fillOpacity="0.95" filter="url(#threat-node-glow)" />
        <circle cx={targetPoint.x} cy={targetPoint.y} r="18" fill="none" stroke="rgba(88,166,255,0.28)" strokeWidth="1.2">
          <animate attributeName="r" values="14;20;14" dur="2.8s" repeatCount="indefinite" />
          <animate attributeName="stroke-opacity" values="0.3;0.12;0.3" dur="2.8s" repeatCount="indefinite" />
        </circle>

        {points.map((point) => (
          <g key={point.id} filter="url(#threat-node-glow)">
            <circle cx={point.x} cy={point.y} r={point.radius} fill={point.color} fillOpacity={point.opacity * 0.18} />
            <circle cx={point.x} cy={point.y} r={Math.max(2.2, point.radius * 0.4)} fill={point.color} fillOpacity={point.opacity} />
          </g>
        ))}
      </svg>

      <div
        style={{
          position: "absolute",
          right: 18,
          bottom: 18,
          display: "grid",
          gap: "10px",
          minWidth: "190px",
        }}
      >
        <div
          style={{
            border: "1px solid rgba(88,166,255,0.16)",
            background: "rgba(2,6,14,0.76)",
            borderRadius: "14px",
            padding: "12px 14px",
            backdropFilter: "blur(10px)",
          }}
        >
          <div style={{ fontSize: "10px", color: "#8b949e", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Threat Mesh
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginTop: "8px" }}>
            <div>
              <div style={{ fontSize: "11px", color: "#8b949e" }}>Tracked nodes</div>
              <strong style={{ color: "#e6edf3", fontSize: "18px" }}>{activeNodes}</strong>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "#8b949e" }}>Active corridors</div>
              <strong style={{ color: "#58a6ff", fontSize: "18px" }}>{activeCorridors}</strong>
            </div>
          </div>
        </div>
      </div>

      {points.length === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "#8b949e",
            textAlign: "center",
            padding: "24px",
          }}
        >
          <div>
            <div style={{ fontSize: "12px", letterSpacing: "0.1em", fontWeight: 800, textTransform: "uppercase", marginBottom: "6px" }}>
              Awaiting geolocated events
            </div>
            <div style={{ fontSize: "13px" }}>New attacker routes will light up here as the telemetry stream grows.</div>
          </div>
        </div>
      )}
    </div>
  );
}
