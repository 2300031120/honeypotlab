// @ts-nocheck
export const PUBLIC_ROUTE_ENTRIES = [
  { path: "/", title: "Home", changefreq: "daily", priority: "1.0" },
  { path: "/platform", title: "Platform", changefreq: "weekly", priority: "0.9" },
  { path: "/integrations", title: "Integrations", changefreq: "weekly", priority: "0.8" },
  { path: "/deployment", title: "Deployment", changefreq: "weekly", priority: "0.8" },
  { path: "/pricing", title: "Pricing", changefreq: "weekly", priority: "0.8" },
  { path: "/case-study", title: "Case Study", changefreq: "monthly", priority: "0.7" },
  { path: "/screenshots", title: "Screenshots", changefreq: "weekly", priority: "0.7" },
  { path: "/architecture", title: "Architecture", changefreq: "monthly", priority: "0.7" },
  { path: "/use-cases", title: "Use Cases", changefreq: "monthly", priority: "0.7" },
  { path: "/security", title: "Security", changefreq: "monthly", priority: "0.6" },
  { path: "/privacy", title: "Privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", title: "Terms", changefreq: "yearly", priority: "0.3" },
  { path: "/contact", title: "Contact", changefreq: "weekly", priority: "0.7" },
  { path: "/demo", title: "Demo", changefreq: "weekly", priority: "0.7" },
];

export const PRIVATE_ROUTE_PREFIXES = [
  "/auth/",
  "/login",
  "/signup",
  "/dashboard",
  "/telemetry",
  "/sites",
  "/forensics",
  "/intelligence",
  "/mapping",
  "/profiling",
  "/deception",
  "/graph",
  "/status",
  "/simulator",
  "/ai-companion",
  "/audit",
  "/admin/",
  "/lab/",
  "/terminal",
  "/url-scanner",
  "/api/",
];

export function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

export function buildAbsoluteUrl(siteUrl, path = "/") {
  const base = trimTrailingSlash(siteUrl);
  const normalizedPath = path === "/" ? "/" : `/${String(path || "").replace(/^\/+/, "")}`;
  return `${base}${normalizedPath}`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function renderSitemap(siteUrl) {
  const lastModified = new Date().toISOString();
  const rows = PUBLIC_ROUTE_ENTRIES.map(
    ({ path, changefreq, priority }) => `  <url>
    <loc>${escapeXml(buildAbsoluteUrl(siteUrl, path))}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
    <lastmod>${lastModified}</lastmod>
  </url>`
  ).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rows}
</urlset>
`;
}

export function renderRobots(siteUrl) {
  const rules = PRIVATE_ROUTE_PREFIXES.map((path) => `Disallow: ${path}`);
  return [
    "User-agent: *",
    "Allow: /",
    ...rules,
    "",
    `Sitemap: ${buildAbsoluteUrl(siteUrl, "/sitemap.xml")}`,
  ].join("\n");
}

export function renderLlmsTxt({ siteName, siteDescription, siteUrl }) {
  const routes = PUBLIC_ROUTE_ENTRIES.map(
    ({ title, path }) => `- ${title}: ${buildAbsoluteUrl(siteUrl, path)}`
  );
  return [
    `# ${siteName}`,
    "",
    siteDescription,
    "",
    "## Product",
    `${siteName} is an AI-enhanced deception telemetry platform for internet-facing threat detection and operator response.`,
    "",
    "## Public pages",
    ...routes,
    "",
    "## Safe usage",
    "- Defensive monitoring only.",
    "- Do not use for retaliation or attack-back behavior.",
    `- Primary website: ${trimTrailingSlash(siteUrl)}`,
  ].join("\n");
}

export function renderStructuredData({ siteName, siteDescription, siteUrl, companyName }) {
  const base = trimTrailingSlash(siteUrl);
  const organizationId = `${base}/#organization`;
  const websiteId = `${base}/#website`;
  const applicationId = `${base}/#application`;
  const payload = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": organizationId,
      name: companyName || siteName,
      url: base,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": websiteId,
      name: siteName,
      description: siteDescription,
      url: base,
      publisher: { "@id": organizationId },
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "@id": applicationId,
      name: siteName,
      description: siteDescription,
      applicationCategory: "SecurityApplication",
      operatingSystem: "Web",
      url: base,
      publisher: { "@id": organizationId },
    },
  ];
  return JSON.stringify(payload).replace(/</g, "\\u003c");
}
