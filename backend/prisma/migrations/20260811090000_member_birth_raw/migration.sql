-- 회원 생년월일 원문 보존 컬럼(레거시 육십갑자 간지코드/비정형 텍스트, DM-19). 날짜 아님.
ALTER TABLE "member" ADD COLUMN "birth_raw" TEXT;
