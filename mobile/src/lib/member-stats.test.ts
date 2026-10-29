import { regStatusBreakdown, nextEnshrineDday, visibleSlots, slotValue } from "./member-stats";
import type { Reg, Member } from "@/lib/data";
import type { Enshrinement, SlotRule } from "@/lib/types";

const reg = (p: Partial<Reg>): Reg => ({
  id: "1", date: "", staff: "", event: null, item: "", type: "", altar: "",
  donation: 0, canceled: false, cert: false, createdAt: "", createdBy: "", ...p,
});

describe("regStatusBreakdown", () => {
  it("classifies cert/pending/canceled (canceled wins)", () => {
    const regs = [reg({ cert: true }), reg({ cert: true, canceled: true }), reg({}), reg({ canceled: true })];
    expect(regStatusBreakdown(regs)).toEqual({ cert: 1, pending: 1, canceled: 2 });
  });
  it("empty", () => { expect(regStatusBreakdown([])).toEqual({ cert: 0, pending: 0, canceled: 0 }); });
});

describe("nextEnshrineDday", () => {
  const now = new Date("2026-06-28T00:00:00Z");
  const member = (eventIds: (string | null)[]): Member => ({
    id: "1", name: "", missionary: "", phone: "", aff: "", addr: "", memo: "",
    counsels: [], regs: eventIds.map((eventId) => reg({ eventId })),
  });
  const ens = (id: string, d: string): Enshrinement => ({ id, eventDateSolar: d, label: null, remark: null, defaultBuddhistServiceItemId: null, defaultBuddhistServiceItemName: null });
  const list = [ens("10", "2026-07-10"), ens("20", "2026-06-20"), ens("30", "2026-07-01")];
  it("picks nearest upcoming linked event", () => {
    expect(nextEnshrineDday(member(["10", "30"]), list, now)).toBe(3); // 07-01 is nearest upcoming
  });
  it("ignores past and unlinked", () => {
    expect(nextEnshrineDday(member(["20"]), list, now)).toBeNull(); // 06-20 past
  });
  it("null when none", () => { expect(nextEnshrineDday(member([null]), list, now)).toBeNull(); });
  it("D-day uses local (KST) calendar date, not UTC", () => {
    // 2026-06-28T20:00Z = 2026-06-29 05:00 KST → local date is 06-29
    const kstEarlyAm = new Date("2026-06-28T20:00:00Z");
    expect(nextEnshrineDday(member(["10"]), [ens("10", "2026-06-29")], kstEarlyAm)).toBe(0);
  });
});

describe("visibleSlots", () => {
  const r = (slotKey: string, isVisible: boolean, sortOrder: number): SlotRule => ({ slotKey, isVisible, isRequired: false, labelOverride: null, sortOrder });
  it("filters invisible and sorts by sortOrder", () => {
    expect(visibleSlots([r("b", true, 2), r("a", true, 1), r("c", false, 0)]).map((x) => x.slotKey)).toEqual(["a", "b"]);
  });
});

describe("slotValue", () => {
  it("maps slotKey to Reg field", () => {
    const r = reg({ bogwija: "보위", rel: "관계", spirit: "영가", seongju: "성주" });
    expect(slotValue(r, "bogwija")).toBe("보위");
    expect(slotValue(r, "relationship")).toBe("관계");
    expect(slotValue(r, "spiritual")).toBe("영가");
    expect(slotValue(r, "seongju12")).toBe("성주");
    expect(slotValue(r, "unknown")).toBe("");
  });
});
