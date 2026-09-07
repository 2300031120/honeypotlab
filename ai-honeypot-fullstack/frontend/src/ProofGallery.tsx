import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";

type ProofItem = {
  src: string;
  alt: string;
  title: string;
  description: string;
  label?: string;
  points?: string[];
};

type ProofGalleryProps = {
  items?: ProofItem[];
  layout?: "carousel" | "grid";
};

function webpSrc(src: string) {
  return src.replace(/\.png$/, ".webp");
}

function avifSrc(src: string) {
  return src.replace(/\.png$/, ".avif");
}

export function ProofImage({
  src,
  alt,
  loading,
  decoding,
  fetchPriority,
}: {
  src: string;
  alt: string;
  loading?: "eager" | "lazy";
  decoding?: "async" | "sync" | "auto";
  fetchPriority?: "high" | "low" | "auto";
}) {
  const avif = avifSrc(src);
  const webp = webpSrc(src);
  return (
    <picture>
      <source type="image/avif" srcSet={avif} />
      <source type="image/webp" srcSet={webp} />
      <img src={src} alt={alt} {...(loading ? { loading } : {})} {...(decoding ? { decoding } : {})} {...(fetchPriority ? { fetchPriority } : {})} />
    </picture>
  );
}

function clampIndex(index: number, total: number) {
  if (total <= 0) {
    return 0;
  }
  const normalized = index % total;
  return normalized < 0 ? normalized + total : normalized;
}

export default function ProofGallery({ items = [], layout = "carousel" }: ProofGalleryProps) {
  const total = items.length;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoomItem, setZoomItem] = useState<ProofItem | null>(null);

  const activeItem = useMemo(() => items[clampIndex(currentIndex, total)] || null, [items, currentIndex, total]);

  if (total === 0) {
    return null;
  }

  if (layout === "grid") {
    return (
      <div className="proof-gallery">
        <div className="proof-gallery-grid">
          {items.map((item) => (
            <article key={item.src} className="proof-gallery-grid-card">
              <button
                type="button"
                className="proof-gallery-grid-image"
                onClick={() => setZoomItem(item)}
                aria-label={`Expand ${item.title}`}
              >
                <ProofImage src={item.src} alt={item.alt} loading="eager" decoding="async" fetchPriority="high" />
                <span className="proof-gallery-expand">
                  <Expand size={14} />
                  View full size
                </span>
              </button>
              <div className="proof-gallery-grid-copy">
                <p className="proof-gallery-label">{item.label || "Visual proof"}</p>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                {Array.isArray(item.points) && item.points.length > 0 ? (
                  <ul className="proof-list">
                    {item.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </article>
          ))}
        </div>

        {zoomItem ? (
          <div className="proof-lightbox" role="dialog" aria-modal="true" aria-label={zoomItem.title}>
            <button type="button" className="proof-lightbox-close" onClick={() => setZoomItem(null)} aria-label="Close viewer">
              <X size={16} />
            </button>
            <div className="proof-lightbox-content">
              <ProofImage src={zoomItem.src} alt={zoomItem.alt} />
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (!activeItem) {
    return null;
  }

  const move = (step: number) => setCurrentIndex((prev) => clampIndex(prev + step, total));

  return (
    <div className="proof-gallery">
      <article className="proof-gallery-stage">
        <button
          type="button"
          className="proof-gallery-image-wrap"
          onClick={() => setZoomItem(activeItem)}
          aria-label={`Expand ${activeItem.title}`}
        >
          <ProofImage src={activeItem.src} alt={activeItem.alt} loading="eager" decoding="async" fetchPriority="high" />
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
              <ProofImage src={item.src} alt={item.alt} loading="lazy" decoding="async" fetchPriority="low" />
              <span>{item.title}</span>
            </button>
          ))}
        </div>
        <button type="button" className="proof-gallery-nav" onClick={() => move(1)} aria-label="Next proof">
          <ChevronRight size={16} />
        </button>
      </div>

      {zoomItem ? (
        <div className="proof-lightbox" role="dialog" aria-modal="true" aria-label={zoomItem.title}>
          <button type="button" className="proof-lightbox-close" onClick={() => setZoomItem(null)} aria-label="Close viewer">
            <X size={16} />
          </button>
          <div className="proof-lightbox-content">
            <ProofImage src={zoomItem.src} alt={zoomItem.alt} />
          </div>
        </div>
      ) : null}
    </div>
  );
}