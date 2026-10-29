import { ConflictException } from '@nestjs/common';
import { CommonCodeService } from './common-code.service';

describe('CommonCodeService (FR-MST-01/02)', () => {
  const prisma = {
    commonCode: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const svc = () => new CommonCodeService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.commonCode.findUnique.mockResolvedValue(null);
  });

  it('드롭다운: 기본은 isActive=true 만, sortOrder→code 정렬', async () => {
    await svc().listByGroup(1n, 'BA10');
    expect(prisma.commonCode.findMany).toHaveBeenCalledWith({
      where: { tenantId: 1n, groupCode: 'BA10', isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  });

  it('includeInactive=true 면 isActive 필터를 걸지 않는다', async () => {
    await svc().listByGroup(1n, 'BA10', true);
    expect(prisma.commonCode.findMany).toHaveBeenCalledWith({
      where: { tenantId: 1n, groupCode: 'BA10' },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  });

  it('create 는 tenantId 를 함께 저장한다', async () => {
    await svc().create(1n, {
      groupCode: 'BA10',
      code: '9001',
      name: '샘플 기관',
    });
    expect(prisma.commonCode.create).toHaveBeenCalledWith({
      data: { tenantId: 1n, groupCode: 'BA10', code: '9001', name: '샘플 기관' },
    });
  });

  it('deactivate 는 소프트 비활성(isActive=false)', async () => {
    await svc().deactivate(5n);
    expect(prisma.commonCode.update).toHaveBeenCalledWith({
      where: { id: 5n },
      data: { isActive: false },
    });
  });

  it('활성 코드와 중복 생성은 Conflict(409) — 500 이 아니라 명시적 거부', async () => {
    prisma.commonCode.findUnique.mockResolvedValue({ id: 9n, isActive: true });
    await expect(
      svc().create(1n, { groupCode: 'BA10', code: '9001', name: '중복' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.commonCode.create).not.toHaveBeenCalled();
  });

  it('비활성(삭제)된 동일 코드가 있으면 복원·갱신한다 — 재추가 500 방지', async () => {
    prisma.commonCode.findUnique.mockResolvedValue({ id: 9n, isActive: false });
    await svc().create(1n, { groupCode: 'BA10', code: '9001', name: '새이름' });
    expect(prisma.commonCode.update).toHaveBeenCalledWith({
      where: { id: 9n },
      data: expect.objectContaining({ name: '새이름', isActive: true }),
    });
    expect(prisma.commonCode.create).not.toHaveBeenCalled();
  });
});
