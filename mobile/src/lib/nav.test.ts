import { normalizeTabIds, DEFAULT_TAB_IDS } from "./nav";

describe("normalizeTabIds", () => {
  it("falls back to default for non-array", () => {
    expect(normalizeTabIds(undefined)).toEqual(DEFAULT_TAB_IDS);
    expect(normalizeTabIds("x")).toEqual(DEFAULT_TAB_IDS);
  });
  it("keeps only known ids, dedups, preserves order", () => {
    expect(normalizeTabIds(["reports", "index", "index", "bogus"])).toEqual(["reports", "index"]);
  });
  it("caps at MAX_CUSTOM_TABS", () => {
    expect(normalizeTabIds(["index", "bulsa", "enshrine", "counsel", "reports"]))
      .toEqual(["index", "bulsa", "enshrine", "counsel"]);
  });
  it("falls back when nothing valid", () => {
    expect(normalizeTabIds(["bogus"])).toEqual(DEFAULT_TAB_IDS);
  });
});
