/* RN fetch 래퍼 — 절대 API_BASE + Bearer 첨부 + 401 시 refresh 1회 재시도. (웹 api.ts 이식, DOM/localStorage 제거) */
import { API_BASE } from "@/lib/config";
import { authStore } from "@/lib/auth";

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export interface ApiOptions extends Omit<RequestInit, "body"> {
  json?: unknown;
  body?: BodyInit | null;
}

let refreshing: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      const rt = authStore.getRefresh();
      if (!rt) return false;
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: rt }),
        });
        if (!res.ok) return false;
        const d = (await res.json()) as { accessToken?: string; refreshToken?: string };
        if (d.accessToken) { await authStore.setTokens(d.accessToken, d.refreshToken ?? null); return true; }
        return false;
      } catch { return false; }
    })().finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function apiFetch<T = unknown>(path: string, options: ApiOptions = {}, allowRetry = true): Promise<T> {
  const { json, headers, body, ...rest } = options;
  const finalHeaders = new Headers(headers);
  finalHeaders.set("Accept", "application/json");
  let finalBody: BodyInit | null | undefined = body;
  if (json !== undefined) { finalHeaders.set("Content-Type", "application/json"); finalBody = JSON.stringify(json); }
  const token = authStore.getToken();
  if (token) finalHeaders.set("Authorization", `Bearer ${token}`);

  const url = path.startsWith("http") ? path : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { ...rest, headers: finalHeaders, body: finalBody });
  const text = await res.text();
  const data: unknown = text ? safeParseJson(text) : null;

  if (!res.ok) {
    if (res.status === 401 && !url.includes("/auth/login") && !url.includes("/auth/refresh")) {
      if (allowRetry && authStore.getRefresh()) {
        const ok = await tryRefresh();
        if (ok) return apiFetch<T>(path, options, false);
      }
      await authStore.clear(); // 구독자(루트 가드)가 로그인으로 전환
    }
    // 서버 오류 메시지 — RFC7807 은 detail 필드(계정 잠금 메시지 등), NestException 은 message. 둘 다 대응.
    const message =
      (isRecord(data) && typeof data.detail === "string" && data.detail) ||
      (isRecord(data) && typeof data.message === "string" && data.message) ||
      `${res.status} ${res.statusText}`;
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}

export const api = {
  get: <T = unknown>(path: string, options?: ApiOptions) => apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T = unknown>(path: string, json?: unknown, options?: ApiOptions) => apiFetch<T>(path, { ...options, method: "POST", json }),
  put: <T = unknown>(path: string, json?: unknown, options?: ApiOptions) => apiFetch<T>(path, { ...options, method: "PUT", json }),
  patch: <T = unknown>(path: string, json?: unknown, options?: ApiOptions) => apiFetch<T>(path, { ...options, method: "PATCH", json }),
  delete: <T = unknown>(path: string, options?: ApiOptions) => apiFetch<T>(path, { ...options, method: "DELETE" }),
};

function safeParseJson(text: string): unknown { try { return JSON.parse(text); } catch { return text; } }
function isRecord(v: unknown): v is Record<string, unknown> { return typeof v === "object" && v !== null; }
