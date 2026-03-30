// @ts-nocheck
import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";

function clampIndex(index, total) {
  if (total <= 0) {
    return 0;
  }
  const normalized = index % total;
  return normalized < 0 ? normalized + total : normalized;
}

export default function ProofGallery({ items = [] }) {
  const total = items.length;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);

  const activeItem = useMemo(() => items[clampIndex(currentIndex, total)] || null, [items, currentIndex, total]);

  if (total === 0 || !activeItem) {
    return null;
  }

  const move = (step) => setCurrentIndex((prev) => clampIndex(prev + step, total));

  return (
    <div className="proof-gallery">
      <article className="proof-gallery-stage">
        <button
          type="button"
          className="proof-gallery-image-wrap"
          onClick={() => setZoomOpen(true)}
          aria-label={`Expand ${activeItem.title}`}
        >
          <img
            src={activeItem.src}
            alt={activeItem.alt}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
          />
          <span className="proof-gallery-expand">
            <Expand size={14} />
            View full size
          </span>
        </button>
        <div className="proof-gallery-copy">
          <p className="proof-gallery-label">{activeItem.label || "Visual proof"}</p>
          <h3>{activeItem.title}</h3>
          <p>{activeItem.description}</p>
          {Array.isArray(activeItem.points) && activeItem.points.length > 0 ? (
            <ul className="proof-list">
              {activeItem.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </article>

      <div className="proof-gallery-controls">
        <button type="button" className="proof-gallery-nav" onClick={() => move(-1)} aria-label="Previous proof">
          <ChevronLeft size={16} />
        </button>
        <div className="proof-gallery-thumbs">
          {items.map((item, idx) => (
            <button
              key={item.src}
              type="button"
              className={`proof-gallery-thumb ${idx === clampIndex(currentIndex, total) ? "active" : ""}`}
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Show ${item.title}`}
            >
              <img src={item.src} alt={item.alt} loading="lazy" decoding="async" fetchPriority="low" />
              <span>{item.title}</span>
            </button>
          ))}
        </div>
        <button type="button" className="proof-gallery-nav" onClick={() => move(1)} aria-label="Next proof">
          <ChevronRight size={16} />
        </button>
      </div>

      {zoomOpen ? (
        <div className="proof-lightbox" role="dialog" aria-modal="true" aria-label={activeItem.title}>
          <button type="button" className="proof-lightbox-close" onClick={() => setZoomOpen(false)} aria-label="Close viewer">
            <X size={16} />
          </button>
          <div className="proof-lightbox-content">
            <img src={activeItem.src} alt={activeItem.alt} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
