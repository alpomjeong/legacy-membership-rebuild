import { authStore } from "@/lib/auth-store";

/** 모든 백엔드 호출의 기준 경로 (NestJS, 전역 prefix `/api/v1`). */
export const API_BASE = "/api/v1";

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
  /** JSON 으로 직렬화할 요청 본문. FormData 등은 raw body 로 직접 전달. */
  json?: unknown;
  body?: BodyInit | null;
}

/**
 * `/api/v1` 대상 fetch 래퍼.
 * - 토큰 스토어의 Access 토큰을 `Authorization: Bearer` 로 첨부
 * - `json` 옵션 직렬화 + JSON 응답 파싱
 * - 2xx 가 아니면 {@link ApiError} throw
 */
/** 동시 401 시 중복 호출 방지용 단일 refresh 프라미스. */
let refreshing: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        // refresh 토큰은 HttpOnly 쿠키에 있음 — credentials 로 자동 전송(바디 없음).
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: "{}",
        });
        if (!res.ok) return false;
        const d = (await res.json()) as { accessToken?: string };
        if (d.accessToken) { authStore.setTokens(d.accessToken); return true; }
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
  if (json !== undefined) {
    finalHeaders.set("Content-Type", "application/json");
    finalBody = JSON.stringify(json);
  }

  const token = authStore.getToken();
  if (token) finalHeaders.set("Authorization", `Bearer ${token}`);

  const url = path.startsWith("http") ? path : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  // credentials:include — refresh HttpOnly 쿠키(/api/v1/auth 범위)를 로그인/로그아웃 시 저장·전송.
  //   교차 출처 배포에서도 쿠키 흐름이 동작(동일 출처는 영향 없음).
  const res = await fetch(url, { credentials: "include", ...rest, headers: finalHeaders, body: finalBody });

  const text = await res.text();
  const data: unknown = text ? safeParseJson(text) : null;

  if (!res.ok) {
    // 토큰 만료/무효: refresh 1회 시도 후 재요청, 실패 시 세션 정리 → 로그인.
    if (res.status === 401 && !url.includes("/auth/login") && !url.includes("/auth/refresh")) {
      if (allowRetry) {
        // refresh 토큰은 HttpOnly 쿠키 — 있으면 재발급 성공, 없으면 false 로 로그인 유도.
        const ok = await tryRefresh();
        if (ok) return apiFetch<T>(path, options, false);
      }
      authStore.clear();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
    // 서버 오류 메시지 — RFC7807 은 detail 필드 사용(NestException 은 message). 둘 다 대응.
    const message =
      (isRecord(data) && typeof data.detail === "string" && data.detail) ||
      (isRecord(data) && typeof data.message === "string" && data.message) ||
      `${res.status} ${res.statusText}`;
    throw new ApiError(res.status, message, data);
  }

  return data as T;
}

export const api = {
  get: <T = unknown>(path: string, options?: ApiOptions) =>
    apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T = unknown>(path: string, json?: unknown, options?: ApiOptions) =>
    apiFetch<T>(path, { ...options, method: "POST", json }),
  put: <T = unknown>(path: string, json?: unknown, options?: ApiOptions) =>
    apiFetch<T>(path, { ...options, method: "PUT", json }),
  patch: <T = unknown>(path: string, json?: unknown, options?: ApiOptions) =>
    apiFetch<T>(path, { ...options, method: "PATCH", json }),
  delete: <T = unknown>(path: string, options?: ApiOptions) =>
    apiFetch<T>(path, { ...options, method: "DELETE" }),
};

/** 멀티파트로 xlsx 파일을 업로드한다(Content-Type은 브라우저가 boundary 포함 설정). */
export async function uploadXlsx<T = unknown>(path: string, file: File): Promise<T> {
  const fd = new FormData();
  fd.append("file", file);
  return apiFetch<T>(path, { method: "POST", body: fd });
}

/** 이미지 파일을 오브젝트 스토리지에 업로드하고 { key, url } 을 받는다(FR-MST-08). */
export async function uploadImage(file: File): Promise<{ key: string; url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  return apiFetch<{ key: string; url: string }>("/uploads/image", { method: "POST", body: fd });
}

/** 인증 헤더로 바이너리(xlsx/pdf)를 받아 브라우저 다운로드를 트리거한다. 401 시 1회 재발급 후 재시도. */
export async function downloadFile(path: string, filename: string, allowRetry = true): Promise<void> {
  const token = authStore.getToken();
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    if (res.status === 401 && allowRetry && (await tryRefresh())) {
      return downloadFile(path, filename, false);
    }
    // 서버 오류 메시지(RFC7807 detail) 노출
    let message = `다운로드 실패 (${res.status})`;
    try {
      const data: unknown = JSON.parse(await res.text());
      if (isRecord(data) && typeof data.detail === "string") message = data.detail;
    } catch { /* 비 JSON 응답 무시 */ }
    throw new ApiError(res.status, message, null);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
