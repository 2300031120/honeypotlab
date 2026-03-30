import React, { useEffect, useRef, useState } from "react";

interface GestureCardProps {
  children: React.ReactNode;
  className?: string;
  onSwipe?: (direction: "left" | "right" | "up" | "down") => void;
  onPinch?: (scale: number) => void;
  onRotate?: (angle: number) => void;
  draggable?: boolean;
  rotatable?: boolean;
  scalable?: boolean;
}

interface TransformState {
  x: number;
  y: number;
  scale: number;
  rotate: number;
}

interface DragState {
  active: boolean;
  pointerId: number | null;
  startX: number;
  startY: number;
}

const SWIPE_THRESHOLD = 84;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function detectSwipe(dx: number, dy: number): "left" | "right" | "up" | "down" | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) {
    return null;
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "down" : "up";
}

export const GestureCard: React.FC<GestureCardProps> = ({
  children,
  className = "",
  onSwipe,
  onPinch,
  onRotate,
  draggable = true,
  rotatable = true,
  scalable = true,
}) => {
  const [transform, setTransform] = useState<TransformState>({ x: 0, y: 0, scale: 1, rotate: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<DragState>({ active: false, pointerId: null, startX: 0, startY: 0 });

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggable) {
      return;
    }
    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX - transform.x,
      startY: event.clientY - transform.y,
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active || dragRef.current.pointerId !== event.pointerId) {
      return;
    }
    const nextX = event.clientX - dragRef.current.startX;
    const nextY = event.clientY - dragRef.current.startY;
    const nextRotate = rotatable ? clamp(nextX * 0.06, -8, 8) : 0;
    setTransform((prev) => ({ ...prev, x: nextX, y: nextY, rotate: nextRotate }));
    if (rotatable) {
      onRotate?.(nextRotate);
    }
  };

  const releasePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active || dragRef.current.pointerId !== event.pointerId) {
      return;
    }
    const swipe = detectSwipe(transform.x, transform.y);
    dragRef.current = { active: false, pointerId: null, startX: 0, startY: 0 };
    setIsDragging(false);
    setTransform((prev) => ({ ...prev, x: 0, y: 0, rotate: 0 }));
    if (swipe) {
      onSwipe?.(swipe);
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!scalable) {
      return;
    }
    event.preventDefault();
    setTransform((prev) => {
      const nextScale = clamp(prev.scale - event.deltaY * 0.001, 0.5, 2);
      onPinch?.(nextScale);
      return { ...prev, scale: nextScale };
    });
  };

  const handleDoubleClick = () => {
    setTransform({ x: 0, y: 0, scale: 1, rotate: 0 });
    onPinch?.(1);
    onRotate?.(0);
  };

  return (
    <div
      onDoubleClick={handleDoubleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={releasePointer}
      onPointerCancel={releasePointer}
      onWheel={handleWheel}
      style={{
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale}) rotate(${transform.rotate}deg)`,
        transition: isDragging ? "none" : "transform 180ms ease",
        cursor: isDragging ? "grabbing" : draggable ? "grab" : "default",
        touchAction: scalable ? "none" : "pan-y",
      }}
      className={`gesture-card ${className} ${isDragging ? "dragging" : ""}`}
    >
      {children}
    </div>
  );
};

interface FloatingPanelProps {
  children: React.ReactNode;
  title?: string;
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  draggable?: boolean;
  collapsible?: boolean;
  className?: string;
}

export const FloatingPanel: React.FC<FloatingPanelProps> = ({
  children,
  title,
  position = "top-right",
  draggable = true,
  collapsible = true,
  className = "",
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<DragState>({ active: false, pointerId: null, startX: 0, startY: 0 });

  const positionClasses = {
    "top-left": "top-4 left-4",
    "top-right": "top-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "bottom-right": "bottom-4 right-4",
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggable) {
      return;
    }
    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX - offset.x,
      startY: event.clientY - offset.y,
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active || dragRef.current.pointerId !== event.pointerId) {
      return;
    }
    setOffset({
      x: event.clientX - dragRef.current.startX,
      y: event.clientY - dragRef.current.startY,
    });
  };

  const releasePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active || dragRef.current.pointerId !== event.pointerId) {
      return;
    }
    dragRef.current = { active: false, pointerId: null, startX: 0, startY: 0 };
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      style={{
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
        transition: isDragging ? "none" : "transform 180ms ease",
      }}
      className={`fixed ${positionClasses[position]} z-50 ${className}`}
    >
      <div
        className={`min-w-64 max-w-sm overflow-hidden rounded-lg border border-gray-700/70 bg-gray-900/90 shadow-2xl backdrop-blur-xl ${
          isDragging ? "cursor-grabbing" : draggable ? "cursor-grab" : ""
        }`}
      >
        {title && (
          <div
            className="flex items-center justify-between border-b border-gray-700/50 p-4"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={releasePointer}
            onPointerCancel={releasePointer}
            style={{ touchAction: "none" }}
          >
            <h3 className="font-medium text-white">{title}</h3>
            {collapsible && (
              <button
                type="button"
                onClick={() => setIsCollapsed((prev) => !prev)}
                className="text-gray-400 transition-colors hover:text-white"
              >
                {isCollapsed ? "▲" : "▼"}
              </button>
            )}
          </div>
        )}
        {!isCollapsed && <div className="p-4">{children}</div>}
      </div>
    </div>
  );
};

interface InteractiveGridProps {
  children: React.ReactNode[];
  className?: string;
  animationDelay?: number;
  hoverEffect?: "lift" | "glow" | "scale" | "rotate";
}

export const InteractiveGrid: React.FC<InteractiveGridProps> = ({
  children,
  className = "",
  animationDelay = 100,
  hoverEffect = "lift",
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const getHoverStyle = (index: number) => {
    if (hoveredIndex !== index) {
      return {};
    }
    switch (hoverEffect) {
      case "lift":
        return { transform: "translateY(-8px)", boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3)" };
      case "glow":
        return { boxShadow: "0 0 30px rgba(59, 130, 246, 0.3)" };
      case "scale":
        return { transform: "scale(1.05)" };
      case "rotate":
        return { transform: "rotate(2deg)" };
      default:
        return {};
    }
  };

  return (
    <div className={`grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {children.map((child, index) => (
        <div
          key={index}
          className="transition-all duration-300 ease-out"
          style={{
            animationDelay: `${index * animationDelay}ms`,
            ...getHoverStyle(index),
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

interface NetworkNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  connections: number[];
}

export const NeuralNetwork: React.FC<NeuralNetworkProps> = ({
  nodes = 20,
  connections = 30,
  className = "",
  interactive = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return undefined;
    }

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const networkNodes: NetworkNode[] = Array.from({ length: nodes }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      connections: [],
    }));

    for (let index = 0; index < connections; index += 1) {
      const left = Math.floor(Math.random() * nodes);
      const right = Math.floor(Math.random() * nodes);
      if (left !== right) {
        networkNodes[left].connections.push(right);
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      networkNodes.forEach((node) => {
        node.x += node.vx;
        node.y += node.vy;

        if (node.x < 0 || node.x > canvas.width) {
          node.vx *= -1;
        }
        if (node.y < 0 || node.y > canvas.height) {
          node.vy *= -1;
        }

        if (interactive) {
          const dx = mouseRef.current.x - node.x;
          const dy = mouseRef.current.y - node.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 100) {
            node.vx += dx * 0.0001;
            node.vy += dy * 0.0001;
          }
        }
      });

      ctx.strokeStyle = "rgba(59, 130, 246, 0.2)";
      ctx.lineWidth = 1;
      networkNodes.forEach((node) => {
        node.connections.forEach((targetIndex) => {
          const targetNode = networkNodes[targetIndex];
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(targetNode.x, targetNode.y);
          ctx.stroke();
        });
      });

      networkNodes.forEach((node) => {
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, 8);
        gradient.addColorStop(0, "rgba(59, 130, 246, 0.8)");
        gradient.addColorStop(1, "rgba(59, 130, 246, 0.2)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      animationRef.current = window.requestAnimationFrame(animate);
    };

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };

    if (interactive) {
      canvas.addEventListener("mousemove", handleMouseMove);
    }
    animate();

    return () => {
      if (animationRef.current !== null) {
        window.cancelAnimationFrame(animationRef.current);
      }
      canvas.removeEventListener("mousemove", handleMouseMove);
    };
  }, [connections, interactive, nodes]);

  return <canvas ref={canvasRef} className={`pointer-events-none absolute inset-0 ${className}`} style={{ width: "100%", height: "100%" }} />;
};
