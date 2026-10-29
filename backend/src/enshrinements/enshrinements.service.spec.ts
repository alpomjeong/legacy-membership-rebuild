import { NotFoundException } from '@nestjs/common';
import { EnshrinementsService } from './enshrinements.service';

const row = {
  id: 1n,
  eventDateSolar: new Date('2026-09-24T00:00:00Z'),
  label: '2026-09-24_해인',
  remark: null,
  defaultBuddhistServiceItemId: null,
  createdAt: new Date('2026-06-21T00:00:00Z'),
  updatedAt: null,
  defaultBuddhistServiceItem: null,
};

const makePrisma = () => {
  const tx = {
    enshrinementEvent: {
      create: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockResolvedValue(row),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  return {
    tx,
    enshrinementEvent: {
      findFirst: jest.fn().mockResolvedValue(row),
      findMany: jest.fn().mockResolvedValue([row]),
      count: jest.fn().mockResolvedValue(1),
    },
    buddhistServiceReg: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
  };
};

describe('EnshrinementsService', () => {
  it('create: eventDateSolar 저장 + createdBy + 감사', async () => {
    const p = makePrisma();
    const svc = new EnshrinementsService(p as never);
    await svc.create(1n, 99n, {
      eventDateSolar: '2026-09-24T00:00:00Z',
      label: '해인',
    });
    const data = p.tx.enshrinementEvent.create.mock.calls[0][0].data;
    expect(data.eventDateSolar).toEqual(new Date('2026-09-24T00:00:00Z'));
    expect(data.createdBy).toBe(99n);
    expect(p.tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionType: 'enshrinement.create' }),
      }),
    );
  });

  it('getById 없으면 NotFound', async () => {
    const p = makePrisma();
    p.enshrinementEvent.findFirst.mockResolvedValue(null);
    const svc = new EnshrinementsService(p as never);
    await expect(svc.getById(1n, 1n)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('softDelete: isDeleted + 감사', async () => {
    const p = makePrisma();
    const svc = new EnshrinementsService(p as never);
    await svc.softDelete(1n, 99n, 1n);
    expect(p.tx.enshrinementEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isDeleted: true }),
      }),
    );
  });

  it('roster: 봉안일 연결 불사 회원 명단', async () => {
    const p = makePrisma();
    p.buddhistServiceReg.findMany.mockResolvedValue([
      {
        id: 5n,
        memberId: 10n,
        altarNumber: '0001',
        isCanceled: false,
        member: { memberName: '홍길동', missionary: { name: '무량원' } },
        buddhistServiceItem: { name: '위패' },
      },
    ]);
    const svc = new EnshrinementsService(p as never);
    const res = await svc.roster(1n, 1n);
    expect(res).toHaveLength(1);
    expect(res[0].memberName).toBe('홍길동');
    expect(res[0].buddhistServiceItemName).toBe('위패');
  });
});
