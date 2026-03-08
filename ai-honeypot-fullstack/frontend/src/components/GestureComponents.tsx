import React, { useRef, useEffect, useState } from 'react';
import { useGesture } from 'react-use-gesture';
import { useSpring, animated } from 'react-spring';

interface GestureCardProps {
  children: React.ReactNode;
  className?: string;
  onSwipe?: (direction: 'left' | 'right' | 'up' | 'down') => void;
  onPinch?: (scale: number) => void;
  onRotate?: (angle: number) => void;
  draggable?: boolean;
  rotatable?: boolean;
  scalable?: boolean;
}

export const GestureCard: React.FC<GestureCardProps> = ({
  children,
  className = '',
  onSwipe,
  onPinch,
  onRotate,
  draggable = true,
  rotatable = true,
  scalable = true
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [{ x, y, scale, rotate }, setSpring] = useSpring(() => ({
    x: 0,
    y: 0,
    scale: 1,
    rotate: 0
  }));

  const bind = useGesture(
    {
      onDrag: ({ active, movement: [mx, my], velocity, direction: [xDir, yDir] }) => {
        if (!draggable) return;

        setIsDragging(active);
        setSpring({
          x: active ? mx : 0,
          y: active ? my : 0,
          immediate: active
        });

        if (!active && velocity > 0.5) {
          // Detect swipe direction
          if (Math.abs(xDir) > Math.abs(yDir)) {
            if (xDir > 0) onSwipe?.('right');
            else onSwipe?.('left');
          } else {
            if (yDir > 0) onSwipe?.('down');
            else onSwipe?.('up');
          }
        }
      },
      onPinch: ({ active, offset: [scale], origin: [ox, oy] }) => {
        if (!scalable) return;

        setSpring({
          scale: active ? scale : 1,
          immediate: active
        });
        onPinch?.(scale);
      },
      onWheel: ({ active, movement: [, my] }) => {
        if (!scalable) return;

        const newScale = Math.max(0.5, Math.min(2, scale.get() + my * 0.001));
        setSpring({
          scale: active ? newScale : 1,
          immediate: active
        });
      }
    },
    {
      drag: {
        filterTaps: true,
        threshold: 10
      },
      pinch: {
        scaleBounds: { min: 0.5, max: 2 },
        rubberband: true
      }
    }
  );

  return (
    <animated.div
      ref={cardRef}
      {...bind()}
      style={{
        x,
        y,
        scale,
        rotate,
        cursor: isDragging ? 'grabbing' : draggable ? 'grab' : 'default'
      }}
      className={`gesture-card ${className} ${isDragging ? 'dragging' : ''}`}
    >
      {children}
    </animated.div>
  );
};

interface FloatingPanelProps {
  children: React.ReactNode;
  title?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  draggable?: boolean;
  collapsible?: boolean;
  className?: string;
}

export const FloatingPanel: React.FC<FloatingPanelProps> = ({
  children,
  title,
  position = 'top-right',
  draggable = true,
  collapsible = true,
  className = ''
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [{ x, y }, setSpring] = useSpring(() => ({
    x: 0,
    y: 0
  }));

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  };

  const bind = useGesture({
    onDrag: ({ active, movement: [mx, my] }) => {
      if (!draggable) return;

      setIsDragging(active);
      setSpring({
        x: active ? mx : 0,
        y: active ? my : 0,
        immediate: active
      });
    }
  });

  return (
    <animated.div
      {...bind()}
      style={{ x, y }}
      className={`fixed ${positionClasses[position]} z-50 ${className}`}
    >
      <div className={`bg-gray-900/90 backdrop-blur-xl border border-gray-700/70 rounded-lg shadow-2xl overflow-hidden min-w-64 max-w-sm ${isDragging ? 'cursor-grabbing' : draggable ? 'cursor-grab' : ''}`}>
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
            <h3 className="text-white font-medium">{title}</h3>
            {collapsible && (
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                {isCollapsed ? '▲' : '▼'}
              </button>
            )}
          </div>
        )}
        {!isCollapsed && (
          <div className="p-4">
            {children}
          </div>
        )}
      </div>
    </animated.div>
  );
};

interface InteractiveGridProps {
  children: React.ReactNode[];
  className?: string;
  animationDelay?: number;
  hoverEffect?: 'lift' | 'glow' | 'scale' | 'rotate';
}

export const InteractiveGrid: React.FC<InteractiveGridProps> = ({
  children,
  className = '',
  animationDelay = 100,
  hoverEffect = 'lift'
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const getHoverStyle = (index: number) => {
    if (hoveredIndex !== index) return {};

    switch (hoverEffect) {
      case 'lift':
        return { transform: 'translateY(-8px)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' };
      case 'glow':
        return { boxShadow: '0 0 30px rgba(59, 130, 246, 0.3)' };
      case 'scale':
        return { transform: 'scale(1.05)' };
      case 'rotate':
        return { transform: 'rotate(2deg)' };
      default:
        return {};
    }
  };

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
      {children.map((child, index) => (
        <div
          key={index}
          className="transition-all duration-300 ease-out"
          style={{
            animationDelay: `${index * animationDelay}ms`,
            ...getHoverStyle(index)
          }}
          onMouseEnter={() => setHoveredIndex(index)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {child}
        </div>
      ))}
    </div>
  );
};

interface NeuralNetworkProps {
  nodes?: number;
  connections?: number;
  className?: string;
  interactive?: boolean;
}

export const NeuralNetwork: React.FC<NeuralNetworkProps> = ({
  nodes = 20,
  connections = 30,
  className = '',
  interactive = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Generate neural network nodes
    const networkNodes = Array.from({ length: nodes }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      connections: [] as number[]
    }));

    // Generate connections
    for (let i = 0; i < connections; i++) {
      const node1 = Math.floor(Math.random() * nodes);
      const node2 = Math.floor(Math.random() * nodes);
      if (node1 !== node2) {
        networkNodes[node1].connections.push(node2);
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update node positions
      networkNodes.forEach(node => {
        node.x += node.vx;
        node.y += node.vy;

        // Bounce off edges
        if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
        if (node.y < 0 || node.y > canvas.height) node.vy *= -1;

        // Mouse interaction
        if (interactive) {
          const dx = mousePos.x - node.x;
          const dy = mousePos.y - node.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 100) {
            node.vx += dx * 0.0001;
            node.vy += dy * 0.0001;
          }
        }
      });

      // Draw connections
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.2)';
      ctx.lineWidth = 1;

      networkNodes.forEach((node, i) => {
        node.connections.forEach(j => {
          const targetNode = networkNodes[j];
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(targetNode.x, targetNode.y);
          ctx.stroke();
        });
      });

      // Draw nodes
      networkNodes.forEach(node => {
        const gradient = ctx.createRadialGradient(
          node.x, node.y, 0,
          node.x, node.y, 8
        );
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.2)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      requestAnimationFrame(animate);
    };

    animate();

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      setMousePos({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      });
    };

    if (interactive) {
      canvas.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
    };
  }, [nodes, connections, interactive, mousePos]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ width: '100%', height: '100%' }}
    />
  );
};
