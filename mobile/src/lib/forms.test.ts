import {
  memberFormToDto, emptyMemberForm, counselFormToDto, bulsaFormToDto,
  emptyBulsaForm, parseKstDateTime, toIso, isoToKstText,
} from "./forms";

describe("memberFormToDto", () => {
  it("requires name, omits empty optionals", () => {
    expect(memberFormToDto({ ...emptyMemberForm, memberName: " 홍길동 " })).toEqual({ memberName: "홍길동" });
  });
  it("includes non-empty optionals, trimmed", () => {
    expect(memberFormToDto({ ...emptyMemberForm, memberName: "김", phone: " 010-1 ", missionaryId: "5" }))
      .toEqual({ memberName: "김", phone: "010-1", missionaryId: "5" });
  });
});

describe("date helpers", () => {
  it("parses KST wall-clock to UTC iso", () => {
    expect(toIso(parseKstDateTime("2026-06-27 14:30")!)).toBe("2026-06-27T05:30:00.000Z");
  });
  it("parses date-only as KST midnight", () => {
    expect(toIso(parseKstDateTime("2026-06-27")!)).toBe("2026-06-26T15:00:00.000Z");
  });
  it("rejects bad input", () => {
    expect(parseKstDateTime("nope")).toBeNull();
  });
  it("round-trips iso->kst text", () => {
    expect(isoToKstText("2026-06-27T05:30:00.000Z")).toBe("2026-06-27 14:30");
  });
});

describe("counselFormToDto", () => {
  it("maps and converts date", () => {
    expect(counselFormToDto({ memberId: "7", counseledAt: "2026-06-27 09:00", content: " 메모 " }))
      .toEqual({ memberId: "7", counseledAt: "2026-06-27T00:00:00.000Z", content: "메모" });
  });
});

describe("bulsaFormToDto", () => {
  it("keeps required, omits empty, coerces money digits", () => {
    expect(bulsaFormToDto({ ...emptyBulsaForm, memberId: "7", buddhistServiceItemId: "3", donationAmount: "₩100,000", altarNumber: "" }))
      .toEqual({ memberId: "7", buddhistServiceItemId: "3", donationAmount: "100000" });
  });
  it("includes cert flag + date when issued", () => {
    expect(bulsaFormToDto({ ...emptyBulsaForm, memberId: "1", buddhistServiceItemId: "2", isCertificateIssued: true, certificateIssuedDate: "2026-06-27" }))
      .toEqual({ memberId: "1", buddhistServiceItemId: "2", isCertificateIssued: true, certificateIssuedDate: "2026-06-26T15:00:00.000Z" });
  });
});
