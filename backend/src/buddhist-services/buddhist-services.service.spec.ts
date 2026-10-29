import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BuddhistServicesService } from './buddhist-services.service';

const regRow = {
  id: 100n,
  registrationDate: new Date('2026-06-21T00:00:00Z'),
  memberId: 10n,
  buddhistServiceItemId: 5n,
  enshrinementEventId: null,
  staffId: null,
  altarNumber: '0909',
  bogwija: '홍길동',
  relationship: null,
  bokjunja: null,
  spiritual: null,
  yesujae: null,
  seongju12: '축성주',
  sexagenaryYearId: null,
  donationAmount: null,
  memo: null,
  isCanceled: false,
  canceledAt: null,
  isCertificateIssued: false,
  certificateIssuedDate: null,
  createdAt: new Date('2026-06-21T00:00:00Z'),
  updatedAt: null,
  member: { memberName: '홍길동', missionary: null },
  buddhistServiceItem: { name: '위패', serviceTypeCode: 'TABLET' },
  enshrinementEvent: null,
  sexagenaryYear: null,
};

const makePrisma = (slotRules: unknown[] = []) => {
  const tx = {
    buddhistServiceReg: {
      create: jest.fn().mockResolvedValue(regRow),
      update: jest.fn().mockResolvedValue(regRow),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  return {
    tx,
    member: { findFirst: jest.fn().mockResolvedValue({ id: 10n }) },
    buddhistServiceItem: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 5n, serviceTypeCode: 'TABLET' }),
    },
    enshrinementEvent: { findFirst: jest.fn().mockResolvedValue({ id: 1n }) },
    sexagenaryYear: { findFirst: jest.fn().mockResolvedValue({ id: 1n }) },
    staff: { findFirst: jest.fn().mockResolvedValue({ id: 1n }) },
    serviceTypeSlotRule: { findMany: jest.fn().mockResolvedValue(slotRules) },
    buddhistServiceReg: {
      findFirst: jest.fn().mockResolvedValue(regRow),
      findMany: jest.fn().mockResolvedValue([regRow]),
      count: jest.fn().mockResolvedValue(1),
    },
    $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
  };
};

const baseDto = () => ({ memberId: '10', buddhistServiceItemId: '5' });

describe('BuddhistServicesService.create', () => {
  it('registrationDate 자동 + 12성주 정규화 + createdBy + 감사', async () => {
    const p = makePrisma();
    const svc = new BuddhistServicesService(p as never);
    const view = await svc.create(1n, 99n, {
      ...baseDto(),
      seongju12: '축 성주',
    });
    const data = p.tx.buddhistServiceReg.create.mock.calls[0][0].data;
    expect(data.registrationDate).toEqual(expect.any(Date));
    expect(data.seongju12).toBe('축성주');
    expect(data.createdBy).toBe(99n);
    expect(data.tenantId).toBe(1n);
    expect(p.tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionType: 'buddhist_service.create',
        }),
      }),
    );
    expect(view.altarNumber).toBe('0909');
  });

  it('회원 없으면 BadRequest', async () => {
    const p = makePrisma();
    p.member.findFirst.mockResolvedValue(null);
    const svc = new BuddhistServicesService(p as never);
    await expect(svc.create(1n, 99n, baseDto())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('불사목록 없으면 BadRequest', async () => {
    const p = makePrisma();
    p.buddhistServiceItem.findFirst.mockResolvedValue(null);
    const svc = new BuddhistServicesService(p as never);
    await expect(svc.create(1n, 99n, baseDto())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('인물 슬롯은 불사종류와 무관하게 전체 선택 — 공란이어도 적재(필수강제 제거, 운영 요청)', async () => {
    const p = makePrisma([{ slotKey: 'bogwija', isRequired: true }]);
    const svc = new BuddhistServicesService(p as never);
    await expect(
      svc.create(1n, 99n, { ...baseDto(), bogwija: '' }),
    ).resolves.toBeDefined();
    expect(p.tx.buddhistServiceReg.create).toHaveBeenCalled();
  });

  it('취소 플래그 시 canceledAt 자동', async () => {
    const p = makePrisma();
    const svc = new BuddhistServicesService(p as never);
    await svc.create(1n, 99n, { ...baseDto(), isCanceled: true });
    const data = p.tx.buddhistServiceReg.create.mock.calls[0][0].data;
    expect(data.isCanceled).toBe(true);
    expect(data.canceledAt).toEqual(expect.any(Date));
    expect(data.canceledBy).toBe(99n);
  });
});

describe('BuddhistServicesService.update', () => {
  it('대상 없으면 NotFound', async () => {
    const p = makePrisma();
    p.buddhistServiceReg.findFirst.mockResolvedValue(null);
    const svc = new BuddhistServicesService(p as never);
    await expect(svc.update(1n, 99n, 100n, baseDto())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('DTO 에 staffId 미전송 시 기존 접수사원 보존(전체교체 소실 방지)', async () => {
    const p = makePrisma();
    p.buddhistServiceReg.findFirst.mockResolvedValue({
      ...regRow,
      staffId: 7n,
    });
    const svc = new BuddhistServicesService(p as never);
    await svc.update(1n, 99n, 100n, baseDto()); // baseDto 에 staffId 없음
    expect(p.tx.buddhistServiceReg.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ staffId: 7n }),
      }),
    );
  });

  it('이미 취소된 건을 취소 상태로 수정하면 원 취소일자 보존(오늘로 리셋 방지)', async () => {
    const p = makePrisma();
    const origCancel = new Date('2026-01-02T03:04:05Z');
    p.buddhistServiceReg.findFirst.mockResolvedValue({
      ...regRow,
      isCanceled: true,
      canceledAt: origCancel,
      canceledBy: 3n,
    });
    const svc = new BuddhistServicesService(p as never);
    await svc.update(1n, 99n, 100n, { ...baseDto(), isCanceled: true });
    expect(p.tx.buddhistServiceReg.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          canceledAt: origCancel,
          canceledBy: 3n,
        }),
      }),
    );
  });
});

describe('BuddhistServicesService.softDelete', () => {
  it('isDeleted + 감사, 하드삭제 없음', async () => {
    const p = makePrisma();
    const svc = new BuddhistServicesService(p as never);
    await svc.softDelete(1n, 99n, 100n);
    expect(p.tx.buddhistServiceReg.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 100n },
        data: expect.objectContaining({ isDeleted: true, updatedBy: 99n }),
      }),
    );
    expect(p.tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionType: 'buddhist_service.delete',
        }),
      }),
    );
  });
});
