-- 강제 로그아웃/비번초기화/비활성화 시 access 토큰 즉시 무효화 컷오프 (QA 발견 I-3)
ALTER TABLE "user_account" ADD COLUMN "access_invalid_before" TIMESTAMPTZ(6);
