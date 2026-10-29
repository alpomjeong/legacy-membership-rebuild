/* JWT payload의 roles 추출 (UI 게이팅 전용 — 서버가 최종 강제). */
import { authStore } from "@/lib/auth";

export function decodeRoles(token: string | null): string[] {
  if (!token) return [];
  try {
    const part = token.split(".")[1];
    if (!part) return [];
    // JWT payload는 base64url(패딩 없음·-_) → 표준 base64로 정규화 후 디코드(웹 atob/네이티브 Buffer).
    let b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    b64 += "=".repeat((4 - (b64.length % 4)) % 4);
    const decoded = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("utf8");
    const json = JSON.parse(decoded);
    return Array.isArray(json.roles) ? json.roles.filter((r: unknown): r is string => typeof r === "string") : [];
  } catch { return []; }
}
export function currentRoles(): string[] { return decodeRoles(authStore.getToken()); }
export function canEdit(roles: string[]): boolean { return roles.some((r) => r !== "READONLY"); }
export function isAdmin(roles: string[]): boolean { return roles.includes("ADMIN"); }

// 역할 한글 라벨(웹 ROLE_LABEL 동일) — 표시 우선순위 ADMIN > STAFF > READONLY.
export const ROLE_LABEL: Record<string, string> = { ADMIN: "관리자", STAFF: "직원", READONLY: "조회 전용" };
export function roleLabel(roles: string[]): string {
  for (const r of ["ADMIN", "STAFF", "READONLY"]) if (roles.includes(r)) return ROLE_LABEL[r];
  return roles[0] ? (ROLE_LABEL[roles[0]] ?? roles[0]) : "";
}
