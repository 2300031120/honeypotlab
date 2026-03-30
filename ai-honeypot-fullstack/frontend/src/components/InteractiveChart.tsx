import React, { useEffect, useMemo, useRef, useState } from 'react';

interface InteractiveChartProps {
  data: Array<{
    time: string;
    attacks: number;
    severity?: 'low' | 'medium' | 'high';
  }>;
  type?: 'line' | 'area' | 'bar';
  width?: number;
  height?: number;
  interactive?: boolean;
  realtime?: boolean;
}

type ChartPoint = InteractiveChartProps['data'][number];

type RenderPoint = ChartPoint & {
  x: number;
  y: number;
  color: string;
  timestamp: number;
};

const SEVERITY_COLORS: Record<NonNullable<ChartPoint['severity']>, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildLinePath(points: RenderPoint[]) {
  if (!points.length) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function buildAreaPath(points: RenderPoint[], baselineY: number) {
  if (!points.length) return '';
  const line = buildLinePath(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
}

function formatTimeLabel(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const InteractiveChart: React.FC<InteractiveChartProps> = ({
  data,
  type = 'area',
  width = 600,
  height = 300,
  interactive = true,
  realtime = false,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<RenderPoint | null>(null);
  const [selectedRange, setSelectedRange] = useState<[number, number] | null>(null);
  const selectionStartRef = useRef<number | null>(null);

  const margin = { top: 20, right: 24, bottom: 34, left: 44 };
  const innerWidth = Math.max(width - margin.left - margin.right, 40);
  const innerHeight = Math.max(height - margin.top - margin.bottom, 40);

  const normalizedPoints = useMemo(() => {
    const parsed = data
      .map((point, index) => {
        const timestamp = new Date(point.time).getTime();
        return {
          ...point,
          timestamp: Number.isFinite(timestamp) ? timestamp : index,
        };
      })
      .sort((left, right) => left.timestamp - right.timestamp);

    if (!parsed.length) return [] as RenderPoint[];

    const timestamps = parsed.map((point) => point.timestamp);
    const values = parsed.map((point) => point.attacks);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const timeSpan = Math.max(maxTime - minTime, 1);
    const maxValue = Math.max(...values, 1);

    return parsed.map((point) => ({
      ...point,
      x: margin.left + (((point.timestamp - minTime) / timeSpan) * innerWidth),
      y: margin.top + innerHeight - ((point.attacks / maxValue) * innerHeight),
      color: point.severity ? SEVERITY_COLORS[point.severity] : '#3b82f6',
    }));
  }, [data, innerHeight, innerWidth, margin.left, margin.top]);

  const timeRange = useMemo(() => {
    if (!normalizedPoints.length) {
      const now = Date.now();
      return { min: now, max: now + 1 };
    }
    return {
      min: normalizedPoints[0].timestamp,
      max: normalizedPoints[normalizedPoints.length - 1].timestamp,
    };
  }, [normalizedPoints]);

  const maxValue = useMemo(
    () => Math.max(...normalizedPoints.map((point) => point.attacks), 1),
    [normalizedPoints]
  );

  const yTicks = useMemo(
    () => Array.from({ length: 5 }, (_, index) => Math.round((maxValue * (4 - index)) / 4)),
    [maxValue]
  );

  const timeTicks = useMemo(() => {
    const tickCount = Math.min(Math.max(normalizedPoints.length, 2), 5);
    const span = Math.max(timeRange.max - timeRange.min, 1);
    return Array.from({ length: tickCount }, (_, index) => {
      const ratio = tickCount === 1 ? 0 : index / (tickCount - 1);
      const timestamp = timeRange.min + (span * ratio);
      return {
        label: formatTimeLabel(timestamp),
        x: margin.left + (innerWidth * ratio),
      };
    });
  }, [innerWidth, margin.left, normalizedPoints.length, timeRange.max, timeRange.min]);

  const linePath = useMemo(() => buildLinePath(normalizedPoints), [normalizedPoints]);
  const areaPath = useMemo(
    () => buildAreaPath(normalizedPoints, margin.top + innerHeight),
    [innerHeight, margin.top, normalizedPoints]
  );

  const resolveTimestampFromClientX = (clientX: number, element: SVGSVGElement) => {
    const rect = element.getBoundingClientRect();
    const x = clamp(clientX - rect.left, margin.left, rect.width - margin.right);
    const ratio = rect.width <= margin.left + margin.right ? 0 : (x - margin.left) / (rect.width - margin.left - margin.right);
    return timeRange.min + ((timeRange.max - timeRange.min) * clamp(ratio, 0, 1));
  };

  const handleSelectionStart = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!interactive || !normalizedPoints.length) return;
    selectionStartRef.current = resolveTimestampFromClientX(event.clientX, event.currentTarget);
  };

  const handleSelectionEnd = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!interactive || selectionStartRef.current == null) return;
    const end = resolveTimestampFromClientX(event.clientX, event.currentTarget);
    setSelectedRange([Math.min(selectionStartRef.current, end), Math.max(selectionStartRef.current, end)]);
    selectionStartRef.current = null;
  };

  return (
    <div className="relative">
      <svg
        width={width}
        height={height}
        className="overflow-visible"
        onMouseDown={handleSelectionStart}
        onMouseUp={handleSelectionEnd}
        onMouseLeave={() => {
          setHoveredPoint(null);
          selectionStartRef.current = null;
        }}
      >
        <defs>
          <linearGradient id="interactiveChartArea" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.06" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width={width} height={height} fill="#020617" rx="10" opacity="0.02" />

        {yTicks.map((tick) => {
          const y = margin.top + innerHeight - ((tick / maxValue) * innerHeight);
          return (
            <g key={`tick-${tick}`}>
              <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} stroke="#334155" strokeOpacity="0.22" />
              <text x={margin.left - 10} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="12">
                {tick}
              </text>
            </g>
          );
        })}

        <line x1={margin.left} x2={margin.left} y1={margin.top} y2={margin.top + innerHeight} stroke="#475569" strokeOpacity="0.7" />
        <line x1={margin.left} x2={width - margin.right} y1={margin.top + innerHeight} y2={margin.top + innerHeight} stroke="#475569" strokeOpacity="0.7" />

        {timeTicks.map((tick) => (
          <text key={tick.label + tick.x} x={tick.x} y={height - 10} textAnchor="middle" fill="#94a3b8" fontSize="12">
            {tick.label}
          </text>
        ))}

        {(type === 'area' || type === 'line') && areaPath && type === 'area' && (
          <path d={areaPath} fill="url(#interactiveChartArea)" />
        )}

        {(type === 'area' || type === 'line') && linePath && (
          <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {type === 'bar' &&
          normalizedPoints.map((point) => {
            const barWidth = Math.max((innerWidth / Math.max(normalizedPoints.length, 1)) * 0.72, 10);
            return (
              <rect
                key={`bar-${point.timestamp}`}
                x={point.x - (barWidth / 2)}
                y={point.y}
                width={barWidth}
                height={(margin.top + innerHeight) - point.y}
                rx={3}
                fill={point.color}
                opacity={hoveredPoint?.timestamp === point.timestamp ? 0.82 : 1}
                onMouseEnter={() => interactive && setHoveredPoint(point)}
                onMouseLeave={() => interactive && setHoveredPoint(null)}
              />
            );
          })}

        {(type === 'area' || type === 'line') &&
          normalizedPoints.map((point) => (
            <circle
              key={`point-${point.timestamp}`}
              cx={point.x}
              cy={point.y}
              r={hoveredPoint?.timestamp === point.timestamp ? 5 : 3.5}
              fill={point.color}
              stroke="#0f172a"
              strokeWidth="1.5"
              onMouseEnter={() => interactive && setHoveredPoint(point)}
              onMouseLeave={() => interactive && setHoveredPoint(null)}
            />
          ))}

        {hoveredPoint && interactive && (
          <g transform={`translate(${clamp(hoveredPoint.x + 12, margin.left, width - 128)}, ${clamp(hoveredPoint.y - 44, 10, height - 42)})`}>
            <rect width="112" height="34" rx="6" fill="rgba(2,6,23,0.88)" stroke="rgba(59,130,246,0.32)" />
            <text x="10" y="15" fill="#e2e8f0" fontSize="12" fontWeight="700">
              {hoveredPoint.attacks} attacks
            </text>
            <text x="10" y="27" fill="#94a3b8" fontSize="10">
              {formatTimeLabel(hoveredPoint.timestamp)}
            </text>
          </g>
        )}
      </svg>

      {realtime && (
        <div className="absolute top-2 right-2 flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-green-400">LIVE</span>
        </div>
      )}
      {selectedRange && (
        <div className="absolute bottom-2 left-2 text-xs text-blue-400">
          Range: {formatTimeLabel(selectedRange[0])} - {formatTimeLabel(selectedRange[1])}
        </div>
      )}
    </div>
  );
};

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 1000,
  className = ''
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime = 0;
    let animationFrame = 0;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      setDisplayValue(Math.floor(progress * value));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [value, duration]);

  return (
    <span className={className}>
      {displayValue.toLocaleString()}
    </span>
  );
};

interface ParticleSystemProps {
  count?: number;
  colors?: string[];
  className?: string;
}

export const ParticleSystem: React.FC<ParticleSystemProps> = ({
  count = 50,
  colors = ['#3b82f6', '#06b6d4', '#8b5cf6'],
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame = 0;

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    resizeCanvas();

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      life: number;
      maxLife: number;
    }> = [];

    const createParticle = () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      size: Math.random() * 3 + 1,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 0,
      maxLife: Math.random() * 100 + 50
    });

    for (let i = 0; i < count; i += 1) {
      particles.push(createParticle());
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((particle, index) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life += 1;

        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        const alpha = 1 - (particle.life / particle.maxLife);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (particle.life >= particle.maxLife) {
          particles[index] = createParticle();
        }
      });

      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    window.addEventListener('resize', resizeCanvas);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [count, colors]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ width: '100%', height: '100%' }}
    />
  );
};
