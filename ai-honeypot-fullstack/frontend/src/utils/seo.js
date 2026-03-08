import { useEffect } from "react";

function ensureMetaTag(selector, attrs) {
  let tag = document.head.querySelector(selector);
  if (!tag) {
    tag = document.createElement("meta");
    Object.entries(attrs).forEach(([key, value]) => tag.setAttribute(key, value));
    document.head.appendChild(tag);
  }
  return tag;
}

export function useSeo({
  title,
  description,
  ogTitle,
  ogDescription,
  ogType = "website",
  ogUrl,
}) {
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (title) {
      document.title = title;
    }

    const descTag = ensureMetaTag('meta[name="description"]', { name: "description" });
    if (description) {
      descTag.setAttribute("content", description);
    }

    const ogTitleTag = ensureMetaTag('meta[property="og:title"]', { property: "og:title" });
    ogTitleTag.setAttribute("content", ogTitle || title || "");

    const ogDescTag = ensureMetaTag('meta[property="og:description"]', { property: "og:description" });
    ogDescTag.setAttribute("content", ogDescription || description || "");

    const ogTypeTag = ensureMetaTag('meta[property="og:type"]', { property: "og:type" });
    ogTypeTag.setAttribute("content", ogType);

    const ogUrlTag = ensureMetaTag('meta[property="og:url"]', { property: "og:url" });
    if (ogUrl) {
      ogUrlTag.setAttribute("content", ogUrl);
    } else if (typeof window !== "undefined") {
      ogUrlTag.setAttribute("content", window.location.href);
    }

    const twitterTitleTag = ensureMetaTag('meta[name="twitter:title"]', { name: "twitter:title" });
    twitterTitleTag.setAttribute("content", ogTitle || title || "");

    const twitterDescTag = ensureMetaTag('meta[name="twitter:description"]', { name: "twitter:description" });
    twitterDescTag.setAttribute("content", ogDescription || description || "");
  }, [description, ogDescription, ogTitle, ogType, ogUrl, title]);
}
