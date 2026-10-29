import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { MembersService } from './members.service';
import { QueryMembersDto } from './dto/query-members.dto';

const memberRow = {
  id: 10n,
  memberName: '홍길동',
  affiliationCode: null,
  phone: null,
  address: null,
  addressDetail: null,
  zipCode: null,
  missionaryId: null,
  memo: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: null,
  missionary: null,
};

const makePrisma = () => {
  const tx = {
    member: {
      create: jest.fn().mockResolvedValue(memberRow),
      update: jest.fn().mockResolvedValue(memberRow),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  return {
    tx,
    commonCode: { findFirst: jest.fn().mockResolvedValue({ id: 1n }) },
    missionary: { findFirst: jest.fn().mockResolvedValue({ id: 7n }) },
    member: {
      findFirst: jest.fn().mockResolvedValue(memberRow),
      findMany: jest.fn().mockResolvedValue([memberRow]),
      count: jest.fn().mockResolvedValue(1),
    },
    buddhistServiceReg: { count: jest.fn().mockResolvedValue(0) },
    counsel: { count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
  };
};

const baseQuery = (): QueryMembersDto => ({
  page: 1,
  pageSize: 20,
  sort: 'createdAt',
  order: 'desc',
});

describe('MembersService.create', () => {
  it('createdBy/tenantId 적재 + 감사 기록', async () => {
    const p = makePrisma();
    const svc = new MembersService(p as never);
    const view = await svc.create(1n, 99n, { memberName: ' 홍길동 ' });
    expect(p.tx.member.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 1n,
          createdBy: 99n,
          memberName: '홍길동',
        }),
      }),
    );
    expect(p.tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionType: 'member.create',
          entityName: 'Member',
          userAccountId: 99n,
        }),
      }),
    );
    expect(view.displayName).toBe('홍길동');
  });

  it('없는 소속코드면 BadRequest', async () => {
    const p = makePrisma();
    p.commonCode.findFirst.mockResolvedValue(null);
    const svc = new MembersService(p as never);
    await expect(
      svc.create(1n, 99n, { memberName: '홍길동', affiliationCode: 'ZZZZ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('없는 포교원장이면 BadRequest', async () => {
    const p = makePrisma();
    p.missionary.findFirst.mockResolvedValue(null);
    const svc = new MembersService(p as never);
    await expect(
      svc.create(1n, 99n, { memberName: '홍길동', missionaryId: '7' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('MembersService.update', () => {
  it('대상 없으면 NotFound', async () => {
    const p = makePrisma();
    p.member.findFirst.mockResolvedValue(null);
    const svc = new MembersService(p as never);
    await expect(
      svc.update(1n, 99n, 10n, { memberName: '홍길동' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updatedBy 적재 + before/after 감사', async () => {
    const p = makePrisma();
    const svc = new MembersService(p as never);
    await svc.update(1n, 99n, 10n, { memberName: '홍길동' });
    expect(p.tx.member.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10n },
        data: expect.objectContaining({ updatedBy: 99n }),
      }),
    );
    expect(p.tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionType: 'member.update' }),
      }),
    );
  });
});

describe('MembersService.list', () => {
  it('where: tenantId + isDeleted=false 항상, q 는 OR contains', async () => {
    const p = makePrisma();
    const svc = new MembersService(p as never);
    await svc.list(1n, { ...baseQuery(), q: '홍길' });
    const arg = p.member.findMany.mock.calls[0][0];
    expect(arg.where.tenantId).toBe(1n);
    expect(arg.where.isDeleted).toBe(false);
    expect(arg.where.OR).toEqual([
      { memberName: { contains: '홍길', mode: 'insensitive' } },
      { phone: { contains: '홍길' } },
      { address: { contains: '홍길', mode: 'insensitive' } },
      { addressDetail: { contains: '홍길', mode: 'insensitive' } },
    ]);
    expect(arg.skip).toBe(0);
    expect(arg.take).toBe(20);
  });

  it('다중필터 affiliationCodes/missionaryIds 는 in[]', async () => {
    const p = makePrisma();
    p.member.findMany.mockResolvedValue([]);
    p.member.count.mockResolvedValue(0);
    const svc = new MembersService(p as never);
    await svc.list(1n, {
      ...baseQuery(),
      affiliationCodes: ['BA01'],
      missionaryIds: ['7', '8'],
    });
    const arg = p.member.findMany.mock.calls[0][0];
    expect(arg.where.affiliationCode).toEqual({ in: ['BA01'] });
    expect(arg.where.missionaryId).toEqual({ in: [7n, 8n] });
  });

  it('동일 자연키 2건이면 표시명 disambiguate', async () => {
    const p = makePrisma();
    const a = {
      ...memberRow,
      id: 1n,
      phone: '010-0000-1111',
      missionary: { name: '무량원' },
    };
    const b = {
      ...memberRow,
      id: 2n,
      phone: '010-0000-2222',
      missionary: { name: '무량원' },
    };
    p.member.findMany.mockResolvedValue([a, b]);
    p.member.count.mockResolvedValue(2);
    const svc = new MembersService(p as never);
    const res = await svc.list(1n, baseQuery());
    expect(res.items[0].displayName).toBe('홍길동_무량원 (1111)');
    expect(res.items[1].displayName).toBe('홍길동_무량원 (2222)');
  });
});

describe('MembersService.findDuplicateCandidates', () => {
  it('정규화 이름 + 포교원장으로 후보 조회', async () => {
    const p = makePrisma();
    const svc = new MembersService(p as never);
    await svc.findDuplicateCandidates(1n, ' 홍길동 ', 7n);
    const arg = p.member.findMany.mock.calls[0][0];
    expect(arg.where).toEqual(
      expect.objectContaining({
        tenantId: 1n,
        isDeleted: false,
        memberName: '홍길동',
        missionaryId: 7n,
      }),
    );
  });
});

describe('MembersService.getById', () => {
  it('없으면 NotFound', async () => {
    const p = makePrisma();
    p.member.findFirst.mockResolvedValue(null);
    const svc = new MembersService(p as never);
    await expect(svc.getById(1n, 10n)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
  it('동일 자연키 2명이면 disambiguate', async () => {
    const p = makePrisma();
    p.member.findFirst.mockResolvedValue({
      ...memberRow,
      phone: '010-0000-3333',
      missionary: { name: '무량원' },
    });
    p.member.count.mockResolvedValue(2);
    const svc = new MembersService(p as never);
    const v = await svc.getById(1n, 10n);
    expect(v.displayName).toBe('홍길동_무량원 (3333)');
  });
});

describe('MembersService.softDelete', () => {
  it('isDeleted=true + updatedBy + 감사, 하드삭제 없음', async () => {
    const p = makePrisma();
    const svc = new MembersService(p as never);
    await svc.softDelete(1n, 99n, 10n);
    expect(p.tx.member.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10n },
        data: expect.objectContaining({
          isDeleted: true,
          updatedBy: 99n,
          deletedAt: expect.any(Date),
        }),
      }),
    );
    expect(p.tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionType: 'member.delete' }),
      }),
    );
  });
  it('이미 삭제/없으면 NotFound', async () => {
    const p = makePrisma();
    p.member.findFirst.mockResolvedValue(null);
    const svc = new MembersService(p as never);
    await expect(svc.softDelete(1n, 99n, 10n)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
  it('연결된 불사 신청이 있으면 Conflict 로 차단하고 삭제하지 않는다', async () => {
    const p = makePrisma();
    p.buddhistServiceReg.count.mockResolvedValue(3);
    const svc = new MembersService(p as never);
    await expect(svc.softDelete(1n, 99n, 10n)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(p.tx.member.update).not.toHaveBeenCalled();
  });
  it('연결된 상담만 있어도 Conflict 로 차단한다', async () => {
    const p = makePrisma();
    p.counsel.count.mockResolvedValue(2);
    const svc = new MembersService(p as never);
    await expect(svc.softDelete(1n, 99n, 10n)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(p.tx.member.update).not.toHaveBeenCalled();
  });
});
