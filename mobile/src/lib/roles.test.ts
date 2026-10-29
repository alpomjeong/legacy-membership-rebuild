import { decodeRoles, canEdit, isAdmin } from "./roles";
// header.payload.signature ; payload = {"roles":["ADMIN"]}
const tok = (payload: object) => `x.${Buffer.from(JSON.stringify(payload)).toString("base64")}.y`;
const tokUrl = (payload: object) => `x.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.y`;
describe("roles", () => {
  it("decodes roles", () => { expect(decodeRoles(tok({ roles: ["ADMIN", "STAFF"] }))).toEqual(["ADMIN", "STAFF"]); });
  it("decodes base64url JWT payload (web/native)", () => { expect(decodeRoles(tokUrl({ roles: ["ADMIN"], sub: "1", x: "a-b_c" }))).toEqual(["ADMIN"]); });
  it("empty for null/garbage", () => { expect(decodeRoles(null)).toEqual([]); expect(decodeRoles("nope")).toEqual([]); });
  it("canEdit false only when READONLY-only", () => { expect(canEdit(["READONLY"])).toBe(false); expect(canEdit(["STAFF"])).toBe(true); });
  it("isAdmin", () => { expect(isAdmin(["ADMIN"])).toBe(true); expect(isAdmin(["STAFF"])).toBe(false); });
});
