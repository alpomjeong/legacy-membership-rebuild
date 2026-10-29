import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "@/App";
import "@/index.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error('루트 엘리먼트("#root")를 찾을 수 없습니다.');

// PWA 자동 갱신 — 새 배포로 서비스워커가 교체(skipWaiting+clientsClaim)되면 controllerchange 발생.
//   이때 페이지를 한 번 자동 새로고침해 최신 화면을 즉시 반영한다. → 시크릿 탭/수동 캐시삭제 불필요.
//   (refreshing 가드로 페이지당 1회만 — 무한 리로드 방지)
if ("serviceWorker" in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  // 오래 열어둔 화면도 반영되도록 새 배포를 주기적으로 확인(감지 시 위 흐름으로 자동 새로고침).
  navigator.serviceWorker.ready
    .then((reg) => { window.setInterval(() => void reg.update(), 60_000); })
    .catch(() => { /* SW 미지원/실패 무시 */ });
}

// TanStack Query — 서버 상태 캐시/로딩/무효화 표준화(TS-4). 401 등은 api.ts에서 처리하므로 재시도 1회.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3, // 대용량 응답 전송 일시 실패 자동 복구
      retryDelay: (n) => Math.min(800 * 2 ** n, 5000),
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
