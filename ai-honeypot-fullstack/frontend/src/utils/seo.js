import { useEffect } from "react";
import { PUBLIC_SITE, applyPublicBranding } from "../siteConfig";

function ensureMetaTag(selector, attrs) {
  let tag = document.head.querySelector(selector);
  if (!tag) {
    tag = document.createElement("meta");
    Object.entries(attrs).forEach(([key, value]) => tag.setAttribute(key, value));
    document.head.appendChild(tag);
  }
  return tag;
}

function ensureLinkTag(selector, attrs) {
  let tag = document.head.querySelector(selector);
  if (!tag) {
    tag = document.createElement("link");
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

    const resolvedTitle = applyPublicBranding(title || PUBLIC_SITE.siteName);
    const resolvedDescription = applyPublicBranding(description || PUBLIC_SITE.siteDescription);
    const resolvedOgTitle = applyPublicBranding(ogTitle || resolvedTitle || PUBLIC_SITE.siteName);
    const resolvedOgDescription = applyPublicBranding(ogDescription || resolvedDescription || PUBLIC_SITE.siteDescription);
    const resolvedOgUrl = ogUrl || (typeof window !== "undefined" ? window.location.href : PUBLIC_SITE.siteUrl);

    if (title) {
      document.title = resolvedTitle;
    }

    const descTag = ensureMetaTag('meta[name="description"]', { name: "description" });
    descTag.setAttribute("content", resolvedDescription);

    const ogTitleTag = ensureMetaTag('meta[property="og:title"]', { property: "og:title" });
    ogTitleTag.setAttribute("content", resolvedOgTitle);

    const ogDescTag = ensureMetaTag('meta[property="og:description"]', { property: "og:description" });
    ogDescTag.setAttribute("content", resolvedOgDescription);

    const ogTypeTag = ensureMetaTag('meta[property="og:type"]', { property: "og:type" });
    ogTypeTag.setAttribute("content", ogType);

    const ogUrlTag = ensureMetaTag('meta[property="og:url"]', { property: "og:url" });
    ogUrlTag.setAttribute("content", resolvedOgUrl || PUBLIC_SITE.siteUrl);

    const ogSiteNameTag = ensureMetaTag('meta[property="og:site_name"]', { property: "og:site_name" });
    ogSiteNameTag.setAttribute("content", PUBLIC_SITE.siteName);

    const twitterTitleTag = ensureMetaTag('meta[name="twitter:title"]', { name: "twitter:title" });
    twitterTitleTag.setAttribute("content", resolvedOgTitle);

    const twitterDescTag = ensureMetaTag('meta[name="twitter:description"]', { name: "twitter:description" });
    twitterDescTag.setAttribute("content", resolvedOgDescription);

    const canonicalTag = ensureLinkTag('link[rel="canonical"]', { rel: "canonical" });
    canonicalTag.setAttribute("href", resolvedOgUrl || PUBLIC_SITE.siteUrl || window.location.href);
  }, [description, ogDescription, ogTitle, ogType, ogUrl, title]);
}
