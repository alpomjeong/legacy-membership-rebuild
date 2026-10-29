import { adminUpsertArgs, shouldSeedSampleBusinessData } from './seed-policy';

/**
 * 온프레(절 PC)는 start.bat 이 서버 기동 때마다 seed 를 다시 돌린다.
 * 그래서 시드는 "재실행해도 운영 상태를 되돌리지 않아야" 한다 — 이 규칙을 고정한다.
 */
describe('seed-policy', () => {
  describe('adminUpsertArgs', () => {
    const args = adminUpsertArgs(1n, 'hash-of-admin1234');

    it('재기동 시드가 운영자가 바꾼 비밀번호를 덮어쓰지 않는다', () => {
      // update 에 passwordHash 가 들어가면 재부팅마다 admin1234 로 원복된다.
      expect(args.update).not.toHaveProperty('passwordHash');
    });

    it('재기동 시드가 비밀번호 강제변경 플래그를 해제하지 않는다', () => {
      expect(args.update).not.toHaveProperty('mustResetPassword');
    });

    it('신규 계정은 최초 로그인 시 비밀번호 변경을 강제한다', () => {
      expect(args.create.mustResetPassword).toBe(true);
      expect(args.create.passwordHash).toBe('hash-of-admin1234');
    });

    it('테넌트/로그인ID 로 계정을 찾는다', () => {
      expect(args.where.tenantId_loginId).toEqual({
        tenantId: 1n,
        loginId: 'admin',
      });
    });
  });

  describe('shouldSeedSampleBusinessData', () => {
    it('운영(APP_ENV=production)에는 샘플 회원·포교원장을 넣지 않는다', () => {
      expect(shouldSeedSampleBusinessData({ APP_ENV: 'production' })).toBe(
        false,
      );
    });

    it('로컬/개발에는 샘플 데이터를 넣는다', () => {
      expect(shouldSeedSampleBusinessData({})).toBe(true);
      expect(shouldSeedSampleBusinessData({ APP_ENV: 'local' })).toBe(true);
    });
  });
});
