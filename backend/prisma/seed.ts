import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { DEFAULT_ROLES, ALL_PERMISSIONS } from '../src/rbac/permissions';
import { adminUpsertArgs, shouldSeedSampleBusinessData } from './seed-policy';

/**
 * RBAC 시드 (E0.5) — 기본 테넌트 + 권한 전체 + 역할 3종(관리자/직원/조회 전용) + 역할-권한 매핑.
 * 멱등(upsert). 실행: `pnpm prisma:seed` (DB 기동 + 마이그레이션 적용 후).
 */
const prisma = new PrismaClient();
const TENANT_ID = 1n;

async function main(): Promise<void> {
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    // 기관명은 설치 시 환경변수로 주입 — 코드에 고객사명을 두지 않는다.
    create: { id: TENANT_ID, name: process.env.TENANT_NAME ?? '샘플 기관' },
  });

  for (const code of ALL_PERMISSIONS) {
    const [resource, action] = code.split(':');
    await prisma.permission.upsert({
      where: { code },
      update: { resource, action },
      create: { code, name: code, resource, action },
    });
  }

  for (const role of DEFAULT_ROLES) {
    const r = await prisma.role.upsert({
      where: { tenantId_code: { tenantId: TENANT_ID, code: role.code } },
      update: { name: role.name },
      create: { tenantId: TENANT_ID, code: role.code, name: role.name },
    });
    for (const code of role.permissions) {
      const p = await prisma.permission.findUniqueOrThrow({ where: { code } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: r.id, permissionId: p.id } },
        update: {},
        create: { roleId: r.id, permissionId: p.id },
      });
    }
  }

  console.log(
    `✅ RBAC 시드 완료: 역할 ${DEFAULT_ROLES.length}종 · 권한 ${ALL_PERMISSIONS.length}개`,
  );

  await seedSampleData();
}

/** 개발/테스트용 샘플 데이터 — 관리자 계정 + 마스터 + 샘플 회원(멱등). */
async function seedSampleData(): Promise<void> {
  // 1) 관리자 계정 (loginId: admin / pw: admin1234) — 수동 테스트 로그인용.
  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { tenantId_code: { tenantId: TENANT_ID, code: 'ADMIN' } },
  });
  const passwordHash = await argon2.hash('admin1234');
  // 매 기동 재실행돼도 운영자가 바꾼 비밀번호를 덮지 않는다 — 규칙/근거는 seed-policy.ts.
  const admin = await prisma.userAccount.upsert(
    adminUpsertArgs(TENANT_ID, passwordHash),
  );
  await prisma.userRole.upsert({
    where: {
      userAccountId_roleId: { userAccountId: admin.id, roleId: adminRole.id },
    },
    update: {},
    create: { userAccountId: admin.id, roleId: adminRole.id },
  });

  // 2) 공통코드 — 소속(BA10) + 서비스 타입(SVC_TYPE).
  const commonCodes: Array<{
    groupCode: string;
    code: string;
    name: string;
    sortOrder: number;
  }> = [
    { groupCode: 'BA10', code: '9001', name: '본사', sortOrder: 1 },
    { groupCode: 'BA10', code: '9002', name: '포교원', sortOrder: 2 },
    { groupCode: 'SVC_TYPE', code: 'TABLET', name: '위패형', sortOrder: 1 },
    {
      groupCode: 'SVC_TYPE',
      code: 'GUARDIAN12',
      name: '12지신등명불형',
      sortOrder: 2,
    },
    // 사원 코드류(FR-MST-03) — 직위(AB10)·직책(AA10)·직군(AC10)·직원구분(AD10)·호칭(AE10)·양음력(AF10)·사용자구분(AL10)
    { groupCode: 'AB10', code: '10', name: '주지', sortOrder: 1 },
    { groupCode: 'AB10', code: '20', name: '부주지', sortOrder: 2 },
    { groupCode: 'AB10', code: '30', name: '총무', sortOrder: 3 },
    { groupCode: 'AB10', code: '40', name: '재무', sortOrder: 4 },
    { groupCode: 'AB10', code: '50', name: '교무', sortOrder: 5 },
    { groupCode: 'AA10', code: '10', name: '사무장', sortOrder: 1 },
    { groupCode: 'AA10', code: '20', name: '팀장', sortOrder: 2 },
    { groupCode: 'AA10', code: '30', name: '직원', sortOrder: 3 },
    { groupCode: 'AC10', code: '10', name: '사무직', sortOrder: 1 },
    { groupCode: 'AC10', code: '20', name: '법무직', sortOrder: 2 },
    { groupCode: 'AD10', code: '10', name: '정직원', sortOrder: 1 },
    { groupCode: 'AD10', code: '20', name: '계약직', sortOrder: 2 },
    { groupCode: 'AD10', code: '30', name: '자원봉사', sortOrder: 3 },
    { groupCode: 'AE10', code: '10', name: '스님', sortOrder: 1 },
    { groupCode: 'AE10', code: '20', name: '거사', sortOrder: 2 },
    { groupCode: 'AE10', code: '30', name: '보살', sortOrder: 3 },
    { groupCode: 'AF10', code: 'S', name: '양력', sortOrder: 1 },
    { groupCode: 'AF10', code: 'L', name: '음력', sortOrder: 2 },
    { groupCode: 'AL10', code: '10', name: '관리자', sortOrder: 1 },
    { groupCode: 'AL10', code: '20', name: '직원', sortOrder: 2 },
    { groupCode: 'AL10', code: '30', name: '조회전용', sortOrder: 3 },
  ];
  for (const c of commonCodes) {
    await prisma.commonCode.upsert({
      where: {
        tenantId_groupCode_code: {
          tenantId: TENANT_ID,
          groupCode: c.groupCode,
          code: c.code,
        },
      },
      update: { name: c.name, sortOrder: c.sortOrder, isActive: true },
      create: { tenantId: TENANT_ID, ...c },
    });
  }

  // 3) 서비스 타입별 슬롯 규칙 — 위패=5슬롯(복위자 필수), 12지신등명불=3슬롯.
  const slotRules: Array<{
    serviceTypeCode: string;
    slotKey: string;
    isVisible: boolean;
    isRequired: boolean;
    sortOrder: number;
  }> = [
    {
      serviceTypeCode: 'TABLET',
      slotKey: 'bogwija',
      isVisible: true,
      isRequired: true,
      sortOrder: 1,
    },
    {
      serviceTypeCode: 'TABLET',
      slotKey: 'relationship',
      isVisible: true,
      isRequired: false,
      sortOrder: 2,
    },
    {
      serviceTypeCode: 'TABLET',
      slotKey: 'bokjunja',
      isVisible: true,
      isRequired: false,
      sortOrder: 3,
    },
    {
      serviceTypeCode: 'TABLET',
      slotKey: 'spiritual',
      isVisible: true,
      isRequired: false,
      sortOrder: 4,
    },
    {
      serviceTypeCode: 'TABLET',
      slotKey: 'seongju12',
      isVisible: true,
      isRequired: false,
      sortOrder: 5,
    },
    {
      serviceTypeCode: 'GUARDIAN12',
      slotKey: 'bogwija',
      isVisible: true,
      isRequired: true,
      sortOrder: 1,
    },
    {
      serviceTypeCode: 'GUARDIAN12',
      slotKey: 'bokjunja',
      isVisible: true,
      isRequired: false,
      sortOrder: 2,
    },
    {
      serviceTypeCode: 'GUARDIAN12',
      slotKey: 'spiritual',
      isVisible: true,
      isRequired: false,
      sortOrder: 3,
    },
  ];
  for (const s of slotRules) {
    await prisma.serviceTypeSlotRule.upsert({
      where: {
        tenantId_serviceTypeCode_slotKey: {
          tenantId: TENANT_ID,
          serviceTypeCode: s.serviceTypeCode,
          slotKey: s.slotKey,
        },
      },
      update: {
        isVisible: s.isVisible,
        isRequired: s.isRequired,
        sortOrder: s.sortOrder,
      },
      create: { tenantId: TENANT_ID, ...s },
    });
  }

  // 4) 육십갑자 — 60간지 전체(코드 1000~1118, +2). DM-19.
  const CHEONGAN = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
  const CHEONGAN_H = [
    '甲',
    '乙',
    '丙',
    '丁',
    '戊',
    '己',
    '庚',
    '辛',
    '壬',
    '癸',
  ];
  const JIJI = [
    '자',
    '축',
    '인',
    '묘',
    '진',
    '사',
    '오',
    '미',
    '신',
    '유',
    '술',
    '해',
  ];
  const JIJI_H = [
    '子',
    '丑',
    '寅',
    '卯',
    '辰',
    '巳',
    '午',
    '未',
    '申',
    '酉',
    '戌',
    '亥',
  ];
  for (let i = 0; i < 60; i++) {
    const code = 1000 + i * 2;
    const ganjiNameKo = `${CHEONGAN[i % 10]}${JIJI[i % 12]}년`;
    const ganjiNameHanja = `${CHEONGAN_H[i % 10]}${JIJI_H[i % 12]}年`;
    await prisma.sexagenaryYear.upsert({
      where: { tenantId_code: { tenantId: TENANT_ID, code } },
      update: { ganjiNameKo, ganjiNameHanja },
      create: { tenantId: TENANT_ID, code, ganjiNameKo, ganjiNameHanja },
    });
  }

  // 5) 포교원장·불사목록·샘플 회원 — 자연키 없는 엔티티는 빈 상태일 때만 1회 생성.
  //    운영(APP_ENV=production)에는 넣지 않는다. 실데이터는 엑셀 일괄 업로드,
  //    불사목록 마스터(213종 + 별도 전달분 24종)는 infra/native/reference-seed*.sql 이 담당.
  const withSamples = shouldSeedSampleBusinessData();
  if (
    withSamples &&
    (await prisma.missionary.count({ where: { tenantId: TENANT_ID } })) === 0
  ) {
    const [yang, haein] = await Promise.all([
      prisma.missionary.create({
        data: { tenantId: TENANT_ID, name: '무량원' },
      }),
      prisma.missionary.create({ data: { tenantId: TENANT_ID, name: '해인' } }),
    ]);
    await prisma.member.createMany({
      data: [
        {
          tenantId: TENANT_ID,
          memberName: '홍길동',
          missionaryId: yang.id,
          phone: '010-1111-2222',
          affiliationCode: '9001',
          createdBy: admin.id,
        },
        {
          tenantId: TENANT_ID,
          memberName: '홍길동',
          missionaryId: haein.id,
          phone: '010-3333-4444',
          affiliationCode: '9002',
          createdBy: admin.id,
        },
        {
          tenantId: TENANT_ID,
          memberName: '김영희',
          phone: '010-5555-6666',
          affiliationCode: '9001',
          createdBy: admin.id,
        },
      ],
    });
  }

  if (
    withSamples &&
    (await prisma.buddhistServiceItem.count({
      where: { tenantId: TENANT_ID },
    })) === 0
  ) {
    await prisma.buddhistServiceItem.createMany({
      data: [
        {
          tenantId: TENANT_ID,
          name: '위패',
          serviceTypeCode: 'TABLET',
          referenceAmount: '100000',
          createdBy: admin.id,
        },
        {
          tenantId: TENANT_ID,
          name: '12지신등명불',
          serviceTypeCode: 'GUARDIAN12',
          referenceAmount: '50000',
          createdBy: admin.id,
        },
        { tenantId: TENANT_ID, name: '산신대불', createdBy: admin.id },
      ],
    });
  }

  await seedMenus();

  console.log(
    withSamples
      ? '✅ 시드 완료: admin(최초 로그인 시 비번 변경) · 마스터 · 샘플 회원 3명'
      : '✅ 시드 완료: admin(최초 로그인 시 비번 변경) · 마스터 (운영 — 샘플 업무데이터 제외)',
  );
}

/** 메뉴/메뉴-권한 시드 — DM-14/15. 레거시 메뉴코드 데이터화 + 권한 연결(서버 강제 렌더). */
async function seedMenus(): Promise<void> {
  // 상위 영역(level 0)
  const groups: Array<{ code: string; name: string; sort: number }> = [
    { code: 'AREA_MEMBER', name: '회원관리', sort: 1 },
    { code: 'AREA_ADMIN', name: '관리자', sort: 2 },
  ];
  // 하위 메뉴(level 1): code = 프런트 라우트 key, parent, 권한 코드(없으면 항상 노출)
  const items: Array<{
    code: string;
    name: string;
    parent: string;
    sort: number;
    perm?: string;
  }> = [
    {
      code: 'members',
      name: '회원관리',
      parent: 'AREA_MEMBER',
      sort: 1,
      perm: 'member:read',
    },
    { code: 'dashboard', name: '대시보드', parent: 'AREA_MEMBER', sort: 2 },
    {
      code: 'enshrinements',
      name: '봉안일·기일',
      parent: 'AREA_MEMBER',
      sort: 3,
      perm: 'enshrinement:read',
    },
    {
      code: 'counsels',
      name: '상담 관리',
      parent: 'AREA_MEMBER',
      sort: 4,
      perm: 'counsel:read',
    },
    {
      code: 'import',
      name: '일괄 업로드',
      parent: 'AREA_MEMBER',
      sort: 5,
      perm: 'member:create',
    },
    {
      code: 'member-status',
      name: '회원현황',
      parent: 'AREA_MEMBER',
      sort: 6,
      perm: 'member:read',
    },
    {
      code: 'reports',
      name: '리포트',
      parent: 'AREA_MEMBER',
      sort: 7,
      perm: 'member:read',
    },
    {
      code: 'admin-codes',
      name: '공통코드',
      parent: 'AREA_ADMIN',
      sort: 1,
      perm: 'common_code:read',
    },
    {
      code: 'admin-items',
      name: '불사목록',
      parent: 'AREA_ADMIN',
      sort: 2,
      perm: 'service_item:read',
    },
    {
      code: 'admin-missionaries',
      name: '포교원장',
      parent: 'AREA_ADMIN',
      sort: 3,
      perm: 'missionary:read',
    },
    {
      code: 'admin-roles',
      name: '역할·권한',
      parent: 'AREA_ADMIN',
      sort: 4,
      perm: 'role:read',
    },
    {
      code: 'admin-staff',
      name: '사원',
      parent: 'AREA_ADMIN',
      sort: 5,
      perm: 'staff:read',
    },
    {
      code: 'admin-accounts',
      name: '계정 관리',
      parent: 'AREA_ADMIN',
      sort: 6,
      perm: 'account:read',
    },
    {
      code: 'admin-backup',
      name: '백업 관리',
      parent: 'AREA_ADMIN',
      sort: 7,
      perm: 'backup:manage',
    },
    {
      code: 'admin-migration',
      name: '초기 데이터 이관',
      parent: 'AREA_ADMIN',
      sort: 8,
      perm: 'migration:run',
    },
  ];

  const groupId = new Map<string, bigint>();
  for (const g of groups) {
    const m = await prisma.menu.upsert({
      where: { tenantId_code: { tenantId: TENANT_ID, code: g.code } },
      update: { name: g.name, sortOrder: g.sort, level: 0, parentId: null },
      create: {
        tenantId: TENANT_ID,
        code: g.code,
        name: g.name,
        sortOrder: g.sort,
        level: 0,
      },
    });
    groupId.set(g.code, m.id);
  }
  for (const it of items) {
    const m = await prisma.menu.upsert({
      where: { tenantId_code: { tenantId: TENANT_ID, code: it.code } },
      update: {
        name: it.name,
        sortOrder: it.sort,
        level: 1,
        parentId: groupId.get(it.parent),
      },
      create: {
        tenantId: TENANT_ID,
        code: it.code,
        name: it.name,
        sortOrder: it.sort,
        level: 1,
        parentId: groupId.get(it.parent),
      },
    });
    if (it.perm) {
      const perm = await prisma.permission.findUnique({
        where: { code: it.perm },
      });
      if (perm) {
        await prisma.menuPermission.upsert({
          where: {
            menuId_permissionId: { menuId: m.id, permissionId: perm.id },
          },
          update: {},
          create: { menuId: m.id, permissionId: perm.id },
        });
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
