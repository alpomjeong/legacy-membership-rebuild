import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CounselsService } from './counsels.service';

const row = {
  id: 1n,
  memberId: 10n,
  counseledAt: new Date('2026-06-20T05:00:00Z'),
  content: '상담 내용',
  createdAt: new Date('2026-06-21T00:00:00Z'),
  updatedAt: null,
  member: { memberName: '홍길동', missionary: null },
};

const makePrisma = () => {
  const tx = {
    counsel: {
      create: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockResolvedValue(row),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  return {
    tx,
    member: { findFirst: jest.fn().mockResolvedValue({ id: 10n }) },
    counsel: {
      findFirst: jest.fn().mockResolvedValue(row),
      findMany: jest.fn().mockResolvedValue([row]),
      count: jest.fn().mockResolvedValue(1),
    },
    $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
  };
};

describe('CounselsService', () => {
  it('create: counseledAt 저장 + createdBy + 감사', async () => {
    const p = makePrisma();
    const svc = new CounselsService(p as never);
    await svc.create(1n, 99n, {
      memberId: '10',
      counseledAt: '2026-06-20T05:00:00Z',
      content: 'x',
    });
    const data = p.tx.counsel.create.mock.calls[0][0].data;
    expect(data.counseledAt).toEqual(new Date('2026-06-20T05:00:00Z'));
    expect(data.memberId).toBe(10n);
    expect(data.createdBy).toBe(99n);
    expect(p.tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionType: 'counsel.create' }),
      }),
    );
  });

  it('create: 회원 없으면 BadRequest', async () => {
    const p = makePrisma();
    p.member.findFirst.mockResolvedValue(null);
    const svc = new CounselsService(p as never);
    await expect(
      svc.create(1n, 99n, {
        memberId: '10',
        counseledAt: '2026-06-20T05:00:00Z',
        content: 'x',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('list: 기간 from~to 가 counseledAt 범위로 적용', async () => {
    const p = makePrisma();
    const svc = new CounselsService(p as never);
    await svc.list(1n, {
      from: '2026-06-01T00:00:00Z',
      to: '2026-06-30T00:00:00Z',
      page: 1,
      pageSize: 20,
      order: 'desc',
    });
    const arg = p.counsel.findMany.mock.calls[0][0];
    expect(arg.where.counseledAt).toEqual({
      gte: new Date('2026-06-01T00:00:00Z'),
      lte: new Date('2026-06-30T00:00:00Z'),
    });
  });

  it('softDelete: isDeleted + 감사', async () => {
    const p = makePrisma();
    const svc = new CounselsService(p as never);
    await svc.softDelete(1n, 99n, 1n);
    expect(p.tx.counsel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isDeleted: true }),
      }),
    );
  });

  it('softDelete: 없으면 NotFound', async () => {
    const p = makePrisma();
    p.counsel.findFirst.mockResolvedValue(null);
    const svc = new CounselsService(p as never);
    await expect(svc.softDelete(1n, 99n, 1n)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
