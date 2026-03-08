import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { useSpring, animated } from 'react-spring';

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

export const InteractiveChart: React.FC<InteractiveChartProps> = ({
  data,
  type = 'area',
  width = 600,
  height = 300,
  interactive = true,
  realtime = false
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);
  const [selectedRange, setSelectedRange] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 30, bottom: 30, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(data, d => new Date(d.time)) as [Date, Date])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.attacks) as number])
      .nice()
      .range([innerHeight, 0]);

    // Color scale for severity
    const colorScale = d3.scaleOrdinal()
      .domain(['low', 'medium', 'high'])
      .range(['#10b981', '#f59e0b', '#ef4444']);

    // Axes
    const xAxis = d3.axisBottom(xScale)
      .ticks(d3.timeHour.every(2))
      .tickFormat(d3.timeFormat('%H:%M'));

    const yAxis = d3.axisLeft(yScale);

    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll('text')
      .style('fill', '#94a3b8')
      .style('font-size', '12px');

    g.append('g')
      .attr('class', 'y-axis')
      .call(yAxis)
      .selectAll('text')
      .style('fill', '#94a3b8')
      .style('font-size', '12px');

    g.selectAll('.domain, .tick line')
      .style('stroke', '#374151');

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .attr('opacity', 0.1)
      .call(d3.axisLeft(yScale)
        .tickSize(-innerWidth)
        .tickFormat(() => ''))
      .selectAll('line')
      .style('stroke', '#6b7280');

    // Render chart based on type
    if (type === 'area') {
      const area = d3.area<{time: string, attacks: number}>()
        .x(d => xScale(new Date(d.time)))
        .y0(innerHeight)
        .y1(d => yScale(d.attacks))
        .curve(d3.curveMonotoneX);

      const gradient = svg.append('defs')
        .append('linearGradient')
        .attr('id', 'areaGradient')
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%');

      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#3b82f6')
        .attr('stop-opacity', 0.3);

      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', '#3b82f6')
        .attr('stop-opacity', 0.05);

      g.append('path')
        .datum(data)
        .attr('fill', 'url(#areaGradient)')
        .attr('d', area);

      // Line on top of area
      const line = d3.line<{time: string, attacks: number}>()
        .x(d => xScale(new Date(d.time)))
        .y(d => yScale(d.attacks))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 2)
        .attr('d', line);
    } else if (type === 'bar') {
      const barWidth = innerWidth / data.length * 0.8;

      g.selectAll('.bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(new Date(d.time)) - barWidth / 2)
        .attr('y', d => yScale(d.attacks))
        .attr('width', barWidth)
        .attr('height', d => innerHeight - yScale(d.attacks))
        .attr('fill', d => d.severity ? colorScale(d.severity) : '#3b82f6')
        .attr('rx', 2)
        .style('cursor', interactive ? 'pointer' : 'default')
        .on('mouseover', function(event, d) {
          if (interactive) {
            d3.select(this)
              .transition()
              .duration(200)
              .attr('opacity', 0.8);
            setHoveredPoint(d);
          }
        })
        .on('mouseout', function() {
          if (interactive) {
            d3.select(this)
              .transition()
              .duration(200)
              .attr('opacity', 1);
            setHoveredPoint(null);
          }
        });
    }

    // Interactive elements
    if (interactive) {
      // Brush for range selection
      const brush = d3.brushX()
        .extent([[0, 0], [innerWidth, innerHeight]])
        .on('end', (event) => {
          if (event.selection) {
            const [x0, x1] = event.selection;
            const startDate = xScale.invert(x0);
            const endDate = xScale.invert(x1);
            setSelectedRange([startDate.getTime(), endDate.getTime()]);
          } else {
            setSelectedRange(null);
          }
        });

      g.append('g')
        .attr('class', 'brush')
        .call(brush);
    }

    // Tooltip
    if (hoveredPoint && interactive) {
      const tooltip = svg.append('g')
        .attr('class', 'tooltip')
        .style('pointer-events', 'none');

      tooltip.append('rect')
        .attr('x', xScale(new Date(hoveredPoint.time)) + 10)
        .attr('y', yScale(hoveredPoint.attacks) - 40)
        .attr('width', 100)
        .attr('height', 30)
        .attr('fill', 'rgba(0, 0, 0, 0.8)')
        .attr('rx', 4);

      tooltip.append('text')
        .attr('x', xScale(new Date(hoveredPoint.time)) + 15)
        .attr('y', yScale(hoveredPoint.attacks) - 20)
        .attr('fill', 'white')
        .attr('font-size', '12px')
        .text(`${hoveredPoint.attacks} attacks`);
    }

  }, [data, type, width, height, interactive, hoveredPoint]);

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="overflow-visible"
      />
      {realtime && (
        <div className="absolute top-2 right-2 flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-green-400">LIVE</span>
        </div>
      )}
      {selectedRange && (
        <div className="absolute bottom-2 left-2 text-xs text-blue-400">
          Range: {new Date(selectedRange[0]).toLocaleTimeString()} - {new Date(selectedRange[1]).toLocaleTimeString()}
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
    let startTime: number;
    let animationFrame: number;

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
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
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

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

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

    // Initialize particles
    for (let i = 0; i < count; i++) {
      particles.push(createParticle());
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((particle, index) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life++;

        // Wrap around edges
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        // Fade out as life decreases
        const alpha = 1 - (particle.life / particle.maxLife);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Respawn particle when life ends
        if (particle.life >= particle.maxLife) {
          particles[index] = createParticle();
        }
      });

      requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [count, colors]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ width: '100%', height: '100%' }}
    />
  );
};
