/**
 * 토큰 스토어 (Phase 0 스텁).
 *
 * Phase 1에서 실제 로그인 응답(JWT Access/Refresh)으로 채워진다.
 * 지금은 localStorage 기반의 단순 보관소로, api.ts 의 Bearer 첨부에 사용된다.
 */

const TOKEN_KEY = "tm.accessToken";
const REFRESH_KEY = "tm.refreshToken";

type Listener = (token: string | null) => void;
const listeners = new Set<Listener>();

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* localStorage 비활성(프라이빗 모드 등) 시 무시 */
  }
}

export const authStore = {
  getToken(): string | null {
    return safeGet(TOKEN_KEY);
  },

  setToken(token: string | null): void {
    safeSet(TOKEN_KEY, token);
    listeners.forEach((fn) => fn(token));
  },

  /** refresh 는 더 이상 JS 로 보관하지 않음(HttpOnly 쿠키) — 항상 null. */
  getRefresh(): string | null {
    return null;
  },

  /** 로그인/회전 시 access 만 보관. refresh 는 서버가 HttpOnly 쿠키로 관리(XSS 탈취 방지). */
  setTokens(access: string | null): void {
    safeSet(REFRESH_KEY, null); // 과거 localStorage 잔재 제거
    this.setToken(access);
  },

  clear(): void {
    safeSet(REFRESH_KEY, null);
    this.setToken(null);
  },

  isAuthenticated(): boolean {
    return Boolean(this.getToken());
  },

  /** 토큰 변경 구독. 해제 함수를 반환한다. */
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
