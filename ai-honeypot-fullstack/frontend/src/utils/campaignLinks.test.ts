// @ts-nocheck
import { buildCampaignAwarePath } from "./campaignLinks";

describe("buildCampaignAwarePath", () => {
  it("preserves campaign params for internal paths", () => {
    const result = buildCampaignAwarePath("/demo", "?utm_source=google&utm_medium=cpc&utm_campaign=summer");
    expect(result).toBe("/demo?utm_source=google&utm_medium=cpc&utm_campaign=summer");
  });

  it("keeps existing target params and appends campaign params", () => {
    const result = buildCampaignAwarePath("/contact?plan=growth", "?utm_source=linkedin&campaign=q2");
    expect(result).toBe("/contact?plan=growth&utm_source=linkedin&campaign=q2");
  });

  it("does not overwrite target params that already exist", () => {
    const result = buildCampaignAwarePath("/demo?utm_source=referral", "?utm_source=google&utm_campaign=launch");
    expect(result).toBe("/demo?utm_source=referral&utm_campaign=launch");
  });

  it("ignores non-campaign params", () => {
    const result = buildCampaignAwarePath("/demo", "?source=ad&foo=bar");
    expect(result).toBe("/demo");
  });

  it("preserves hash fragments", () => {
    const result = buildCampaignAwarePath("/demo#book", "?utm_campaign=fall");
    expect(result).toBe("/demo?utm_campaign=fall#book");
  });
});
