import { renderLlmsTxt, renderRobots, renderSitemap, renderStructuredData } from "./siteDiscovery";

describe("siteDiscovery", () => {
  it("renders sitemap with marketing urls", () => {
    const xml = renderSitemap("https://example.com");
    expect(xml).toContain("<loc>https://example.com/</loc>");
    expect(xml).toContain("<loc>https://example.com/platform</loc>");
  });

  it("renders robots and llms assets", () => {
    const robots = renderRobots("https://example.com");
    const llms = renderLlmsTxt({
      siteName: "CyberSentinel AI",
      siteDescription: "Deception platform",
      siteUrl: "https://example.com",
    });
    expect(robots).toContain("Disallow: /dashboard");
    expect(llms).toContain("# CyberSentinel AI");
    expect(llms).toContain("https://example.com/platform");
  });

  it("renders valid structured data JSON", () => {
    const raw = renderStructuredData({
      siteName: "CyberSentinel AI",
      siteDescription: "Deception platform",
      siteUrl: "https://example.com",
      companyName: "CyberSentinel AI Labs",
    });
    const parsed = JSON.parse(raw);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.some((entry) => entry["@type"] === "SoftwareApplication")).toBe(true);
  });
});
