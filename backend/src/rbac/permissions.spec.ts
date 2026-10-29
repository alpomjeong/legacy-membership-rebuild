import { ADMIN_ROLE, STAFF_ROLE, READONLY_ROLE, perm } from './permissions';

describe('RBAC 기본 역할 권한 (FR-AUTH-21/25)', () => {
  it('관리자는 삭제·관리 자원 포함 전 권한', () => {
    expect(ADMIN_ROLE.permissions).toContain(perm('member', 'delete'));
    expect(ADMIN_ROLE.permissions).toContain(perm('staff', 'read'));
    expect(ADMIN_ROLE.permissions).toContain(perm('role', 'update'));
  });

  it('직원은 업무 자원 생성/수정 가능하나 삭제 불가·관리 자원 접근 불가', () => {
    expect(STAFF_ROLE.permissions).toContain(perm('member', 'create'));
    expect(STAFF_ROLE.permissions).toContain(perm('member', 'update'));
    expect(STAFF_ROLE.permissions).not.toContain(perm('member', 'delete'));
    expect(STAFF_ROLE.permissions).not.toContain(perm('staff', 'read'));
    expect(STAFF_ROLE.permissions).not.toContain(perm('role', 'read'));
  });

  it('조회 전용은 업무 자원 read 만 (쓰기 불가)', () => {
    expect(READONLY_ROLE.permissions).toContain(perm('member', 'read'));
    expect(READONLY_ROLE.permissions).not.toContain(perm('member', 'create'));
    expect(READONLY_ROLE.permissions).not.toContain(perm('member', 'update'));
    expect(READONLY_ROLE.permissions).not.toContain(perm('member', 'delete'));
    expect(READONLY_ROLE.permissions).not.toContain(perm('staff', 'read'));
  });
});
