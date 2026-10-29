# 불사 회원 관리 — 네이티브 모바일 앱 (Expo / React Native)

웹(React)·백엔드(NestJS `/api/v1`)와 **타입·API 클라이언트·데이터 변환을 공유**하는 네이티브 앱.
반응형 웹 모바일을 대체하는 별도 트리.

## 스택
- Expo SDK 56 · expo-router(파일 기반 네비) · React Native
- NativeWind v4(Tailwind) — 웹과 동일 청자/한지 디자인 토큰
- @tanstack/react-query(웹 `useLive` 이식) · @shopify/flash-list(대용량 가상 스크롤)
- expo-secure-store(JWT access/refresh 보안 저장)

## 실행
```bash
cd mobile
npm install
npx expo start          # QR → 폰의 Expo Go 앱으로 스캔
# 또는: npx expo start --web / --ios / --android
```

## API 서버 지정
기본값은 `src/lib/config.ts`의 데모 터널. 환경별 override:
```bash
# mobile/.env.local (gitignore됨)
EXPO_PUBLIC_API_BASE=http://<개발PC-IP>:8090/api/v1   # 실기기는 localhost 대신 PC IP
```
> 백엔드는 `app.enableCors({origin:true})` 적용(Bearer 토큰이라 안전). 네이티브 기기는 CORS 무관.

## 구현 현황 (v1)
- 로그인(JWT, SecureStore) · 자동 인증 게이트
- 회원: FlashList 카드 리스트 + 검색 + 당겨서 새로고침 → 상세(전화/문자 바로가기, 불사·상담)
- 봉안일(임박 D-day) · 상담 · 리포트(지표·막대) · 더보기(다크 토글·로그아웃)

## 다음
- 등록/편집/추가(바텀시트) 포팅, 생체인증 잠금(expo-local-authentication), 봉안일 푸시(expo-notifications), 사진 첨부(expo-image-picker), EAS Build/Update 배포
