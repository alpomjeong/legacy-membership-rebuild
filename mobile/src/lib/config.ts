import { Platform } from "react-native";

/**
 * 백엔드 API 베이스.
 * - 웹 익스포트(같은 오리진 서빙): 빌드 시 EXPO_PUBLIC_API_BASE=/api/v1 주입(상대경로 OK).
 * - 네이티브(iOS/Android): 절대 URL 필요 → EAS 프로필(eas.json) 또는 실행 시 env 로 주입.
 *   예: LAN 이면 http://<서버IP>:8080/api/v1 (8080=네이티브 서버 단일 포트),
 *       운영이면 https://temple.<도메인>/api/v1 (Cloudflare Tunnel).
 */
const base = process.env.EXPO_PUBLIC_API_BASE ?? "/api/v1";

// 네이티브에서 상대경로면 fetch 가 실패(origin 없음) → 조용한 'Network request failed' 대신 명확히 경고.
if (Platform.OS !== "web" && base.startsWith("/")) {
  console.warn(
    "[config] 네이티브 빌드에 EXPO_PUBLIC_API_BASE(절대 URL) 가 설정되지 않았습니다. " +
      "eas.json 프로필이나 실행 시 env 로 서버 주소를 지정하세요(예: http://<서버IP>:8080/api/v1). 미설정이면 모든 API 호출이 실패합니다.",
  );
}

export const API_BASE = base;
