import React, { useId, useMemo } from 'react';

type GlobePoint = {
  lat: number;
  lng: number;
  size: number;
  color: string;
  intensity: number;
};

interface CyberGlobeProps {
  width?: number;
  height?: number;
  data?: GlobePoint[];
  interactive?: boolean;
  onPointClick?: (point: GlobePoint) => void;
}

type ProjectedPoint = GlobePoint & {
  id: string;
  x: number;
  y: number;
  depth: number;
  radius: number;
  opacity: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function projectPoint(lat: number, lng: number, width: number, height: number) {
  const radius = Math.min(width * 0.31, height * 0.44);
  const centerX = width * 0.5;
  const centerY = height * 0.53;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;

  return {
    x: centerX + radius * Math.cos(latRad) * Math.sin(lngRad),
    y: centerY - radius * Math.sin(latRad),
    depth: Math.cos(latRad) * Math.cos(lngRad),
  };
}

export const CyberGlobe: React.FC<CyberGlobeProps> = ({
  width = 800,
  height = 600,
  data = [],
  interactive = true,
  onPointClick,
}) => {
  const gradientId = useId();

  const points = useMemo<ProjectedPoint[]>(() => {
    return data
      .map((point, index) => {
        const projection = projectPoint(Number(point.lat || 0), Number(point.lng || 0), width, height);
        return {
          ...point,
          id: `cyber-point-${index}`,
          x: projection.x,
          y: projection.y,
          depth: projection.depth,
          radius: clamp(Number(point.size || 0.2) * 22, 5, 18),
          opacity: clamp(0.25 + ((projection.depth + 1) / 2) * 0.6, 0.25, 0.9),
        };
      })
      .sort((a, b) => a.depth - b.depth);
  }, [data, height, width]);

  const rings = [0.36, 0.52, 0.7, 0.86];

  return (
    <div
      className="cyber-globe-container relative overflow-hidden rounded-xl"
      style={{
        width,
        height,
        position: 'relative',
        background:
          'radial-gradient(circle at 50% 18%, rgba(56, 189, 248, 0.18), transparent 30%), linear-gradient(180deg, rgba(2, 8, 18, 0.98) 0%, rgba(6, 18, 34, 0.98) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.12)',
      }}
    >
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" role="img" aria-label="Cyber threat globe">
        <defs>
          <radialGradient id={gradientId} cx="50%" cy="46%" r="58%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.24" />
            <stop offset="48%" stopColor="#0f172a" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#020617" stopOpacity="1" />
          </radialGradient>
          <filter id={`${gradientId}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <ellipse
          cx={width * 0.5}
          cy={height * 0.53}
          rx={Math.min(width * 0.31, height * 0.44)}
          ry={Math.min(width * 0.31, height * 0.44)}
          fill={`url(#${gradientId})`}
          stroke="rgba(56, 189, 248, 0.18)"
          strokeWidth="1.3"
        />

        {rings.map((ratio) => (
          <ellipse
            key={`ring-${ratio}`}
            cx={width * 0.5}
            cy={height * 0.53}
            rx={Math.min(width * 0.31, height * 0.44)}
            ry={Math.min(width * 0.31, height * 0.44) * ratio}
            fill="none"
            stroke="rgba(56, 189, 248, 0.08)"
            strokeWidth="1"
          />
        ))}

        {points.map((point) => (
          <g key={point.id} filter={`url(#${gradientId}-glow)`}>
            <circle cx={point.x} cy={point.y} r={point.radius} fill={point.color} fillOpacity={point.opacity * 0.16} />
            <circle
              cx={point.x}
              cy={point.y}
              r={Math.max(2.4, point.radius * 0.38)}
              fill={point.color}
              fillOpacity={point.opacity}
              onClick={interactive && onPointClick ? () => onPointClick(point) : undefined}
              style={interactive && onPointClick ? { cursor: 'pointer' } : undefined}
            />
          </g>
        ))}
      </svg>

      {!points.length && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/35 backdrop-blur-sm rounded-xl">
          <div className="text-center">
            <div className="mx-auto mb-2 h-8 w-8 rounded-full border border-cyan-400/40 bg-cyan-400/12" />
            <p className="text-cyan-300">Initializing threat mesh...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CyberGlobe;
