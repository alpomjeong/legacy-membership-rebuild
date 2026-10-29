/* 토큰 스토어 — 메모리 캐시 + 영속(네이티브: expo-secure-store / 웹: localStorage). api.ts 의 동기 getToken 에 맞춰 메모리에서 즉시 반환. */
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const isWeb = Platform.OS === "web";
async function storeGet(k: string): Promise<string | null> {
  if (isWeb) { try { return globalThis.localStorage?.getItem(k) ?? null; } catch { return null; } }
  return SecureStore.getItemAsync(k);
}
async function storeSet(k: string, val: string): Promise<void> {
  if (isWeb) { try { globalThis.localStorage?.setItem(k, val); } catch { /* */ } return; }
  await SecureStore.setItemAsync(k, val);
}
async function storeDel(k: string): Promise<void> {
  if (isWeb) { try { globalThis.localStorage?.removeItem(k); } catch { /* */ } return; }
  await SecureStore.deleteItemAsync(k);
}

const ACCESS = "tmAccessToken";
const REFRESH = "tmRefreshToken";
const LOGINID = "tmLoginId";

let accessToken: string | null = null;
let refreshToken: string | null = null;
let loginId: string | null = null;

type Listener = (token: string | null) => void;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((fn) => fn(accessToken));

export const authStore = {
  /** 앱 시작 시 1회 호출 — 보안 저장소에서 토큰 로드. */
  async init(): Promise<void> {
    try {
      accessToken = await storeGet(ACCESS);
      refreshToken = await storeGet(REFRESH);
      loginId = await storeGet(LOGINID);
    } catch { /* 무시 */ }
    notify();
  },
  getToken(): string | null { return accessToken; },
  getRefresh(): string | null { return refreshToken; },
  getLoginId(): string | null { return loginId; },
  isAuthenticated(): boolean { return Boolean(accessToken); },

  async setTokens(access: string | null, refresh: string | null): Promise<void> {
    accessToken = access; refreshToken = refresh;
    try {
      if (access) await storeSet(ACCESS, access); else await storeDel(ACCESS);
      if (refresh) await storeSet(REFRESH, refresh); else await storeDel(REFRESH);
    } catch { /* 무시 */ }
    notify();
  },
  async setLoginId(id: string): Promise<void> { loginId = id; try { await storeSet(LOGINID, id); } catch { /* */ } },
  async clear(): Promise<void> { await this.setTokens(null, null); },

  subscribe(fn: Listener): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; },
};
