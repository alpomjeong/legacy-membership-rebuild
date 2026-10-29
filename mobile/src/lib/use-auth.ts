import { useEffect, useState } from "react";
import { authStore } from "@/lib/auth";

let initialized = false;

/** 인증 상태 훅 — 앱 시작 시 SecureStore 로드(1회) + 토큰 변경 구독. */
export function useAuth() {
  const [authed, setAuthed] = useState(authStore.isAuthenticated());
  const [ready, setReady] = useState(initialized);
  useEffect(() => {
    let mounted = true;
    authStore.init().then(() => { if (mounted) { initialized = true; setReady(true); setAuthed(authStore.isAuthenticated()); } });
    const unsub = authStore.subscribe((t) => { if (mounted) setAuthed(Boolean(t)); });
    return () => { mounted = false; unsub(); };
  }, []);
  return { authed, ready };
}
