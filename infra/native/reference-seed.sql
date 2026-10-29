-- ============================================================
--  참조데이터 시드 (멱등) — 서비스 항목 마스터 + 공통코드
--  업무데이터(회원·건별 내역·기념일·담당자)는 제외 — 그건 엑셀 업로드로 적재한다.
--
--  ※ 공개 배포본 안내
--     이 파일은 구조를 보여 주기 위한 **샘플 데이터**다.
--     실제 운영 마스터는 기관마다 다르므로 설치 시 별도 파일로 전달받아 적재한다.
--     (운영 마스터·개인 항목은 저장소에 포함하지 않는다.)
--
--  새 PC 절차:
--    1) prisma migrate deploy      (스키마)
--    2) pnpm prisma:seed           (RBAC·권한·메뉴·admin 계정·기본코드)
--    3) 이 파일 실행                (서비스 항목 + 공통코드)   ← 지금 이 파일
--    4) 기관별 마스터 파일 실행      (별도 전달)
--    5) 서버 기동 → 일괄 업로드 → 건별 내역 업로드(엑셀)
--
--  실행:  psql -d "<DB이름>" -f infra/native/reference-seed.sql
--  멱등:  여러 번 실행해도 중복 생성 안 됨.
-- ============================================================

-- 이 파일은 UTF-8. 윈도우에서 psql 출력이 리다이렉트되면(서버관리 GUI → start.bat → 로그 파일)
-- 클라이언트 인코딩이 콘솔/ANSI 코드페이지(한국어 윈도우 = UHC)로 잡혀 아래 한글이 깨진 바이트로
-- 해석되어 전량 실패한다. 첫 줄은 ASCII 뿐이라 어떤 인코딩에서도 안전하게 전달된다.
SET client_encoding TO 'UTF8';

BEGIN;

-- 1) 서비스 항목 마스터 (tenant 1) — 동일 이름이 없을 때만 삽입.
--    멱등 전략: NOT EXISTS 로 이름 중복을 막는다(운영 중 재실행 안전).
INSERT INTO buddhist_service_item (tenant_id, name, is_active)
SELECT 1, v.name, true
FROM (VALUES
  ('샘플 항목 A'),('샘플 항목 B'),('샘플 항목 C'),
  ('샘플 항목 D'),('샘플 항목 E'),('샘플 항목 F')
) AS v(name)
WHERE NOT EXISTS (
  SELECT 1 FROM buddhist_service_item b
  WHERE b.tenant_id = 1 AND b.name = v.name
);

-- 2) 공통코드 — 그룹별 코드 체계.
--    멱등 전략: 복합 유니크(tenant_id, group_code, code) 에 ON CONFLICT DO NOTHING.
INSERT INTO common_code (tenant_id, group_code, code, name, short_name, sort_order, is_active)
VALUES
  -- AA10: 직책
  (1,'AA10','10','사무장',NULL,1,true),
  (1,'AA10','20','팀장',NULL,2,true),
  (1,'AA10','30','직원',NULL,3,true),
  -- AC10: 직무 구분
  (1,'AC10','10','사무직',NULL,1,true),
  (1,'AC10','20','현장직',NULL,2,true),
  -- AD10: 고용 형태
  (1,'AD10','10','정직원',NULL,1,true),
  (1,'AD10','20','계약직',NULL,2,true),
  (1,'AD10','30','자원봉사',NULL,3,true),
  -- AF10: 날짜 기준(양력/음력) — 기념일 계산에 사용
  (1,'AF10','S','양력',NULL,1,true),
  (1,'AF10','L','음력',NULL,2,true),
  -- BA10: 소속 (설치 시 기관에 맞게 교체)
  (1,'BA10','9001','샘플 소속',NULL,1,true),
  -- SVC_TYPE: 서비스 유형
  (1,'SVC_TYPE','GENERAL','일반형',NULL,1,true),
  (1,'SVC_TYPE','PERIODIC','정기형',NULL,2,true)
ON CONFLICT (tenant_id, group_code, code) DO NOTHING;

COMMIT;

-- 확인:
--   SELECT count(*) FROM buddhist_service_item WHERE is_deleted = false;
--   SELECT group_code, count(*) FROM common_code GROUP BY group_code ORDER BY 1;
