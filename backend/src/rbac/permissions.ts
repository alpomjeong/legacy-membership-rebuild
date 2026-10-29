/**
 * RBAC 권한 정의 (E0.5 · FR-AUTH-20/21/25)
 * 권한 = 자원(resource) × 액션(action), 코드 형식 `resource:action` (예: member:read).
 * 기본 역할 3종(관리자/직원/조회 전용)을 권한 집합으로 정의한다. 순수 데이터.
 */
export const ACTIONS = [
  'read',
  'create',
  'update',
  'delete',
  'print',
  'export',
] as const;
export type Action = (typeof ACTIONS)[number];

/** 업무 자원 — 직원·조회전용이 다루는 자원 */
export const BUSINESS_RESOURCES = [
  'member',
  'buddhist_service',
  'enshrinement',
  'counsel',
  'service_item',
  'missionary',
  'common_code',
] as const;

/** 관리 자원 — 관리자 전용 */
export const ADMIN_RESOURCES = ['staff', 'role', 'audit', 'account'] as const;

export const ALL_RESOURCES: string[] = [
  ...BUSINESS_RESOURCES,
  ...ADMIN_RESOURCES,
];

export const perm = (resource: string, action: Action): string =>
  `${resource}:${action}`;

/** 자원×액션 격자 밖의 독립 권한(운영 기능 등). */
export const EXTRA_PERMISSIONS: string[] = [
  'backup:manage',
  'migration:run',
  'staff:pii:read', // 주민번호 평문 열람 — 목록(staff:read)보다 높은 별도 권한(관리자만)
];

export const ALL_PERMISSIONS: string[] = [
  ...ALL_RESOURCES.flatMap((r) => ACTIONS.map((a) => perm(r, a))),
  ...EXTRA_PERMISSIONS,
];

export interface RoleDef {
  code: string;
  name: string;
  permissions: string[];
}

/** 관리자 — 전 권한 */
export const ADMIN_ROLE: RoleDef = {
  code: 'ADMIN',
  name: '관리자',
  permissions: ALL_PERMISSIONS,
};

/** 직원 — 업무 자원 read/create/update/print/export (삭제 불가, 관리 자원 접근 불가) */
export const STAFF_ROLE: RoleDef = {
  code: 'STAFF',
  name: '직원',
  permissions: BUSINESS_RESOURCES.flatMap((r) =>
    (['read', 'create', 'update', 'print', 'export'] as Action[]).map((a) =>
      perm(r, a),
    ),
  ),
};

/** 조회 전용 — 업무 자원 read 만 (등록/수정/삭제 불가). FR-AUTH-25 */
export const READONLY_ROLE: RoleDef = {
  code: 'READONLY',
  name: '조회 전용',
  permissions: BUSINESS_RESOURCES.map((r) => perm(r, 'read')),
};

export const DEFAULT_ROLES: RoleDef[] = [ADMIN_ROLE, STAFF_ROLE, READONLY_ROLE];
