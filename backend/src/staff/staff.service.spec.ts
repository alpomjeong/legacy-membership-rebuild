import { StaffService } from './staff.service';
import { CryptoService } from '../common/crypto.service';

const crypto = new CryptoService({ get: () => 'test-key' } as never);

const makePrisma = () => ({
  staff: {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue({ id: 1n, juminNoEnc: null }),
    create: jest.fn().mockResolvedValue({ id: 1n, staffNameKo: '김총무' }),
    update: jest.fn().mockResolvedValue({ id: 1n, staffNameKo: '김총무' }),
  },
  auditLog: { create: jest.fn().mockResolvedValue({}) },
});

describe('StaffService', () => {
  it('create: 주민번호 암호화(Bytes) + 마스킹 저장', async () => {
    const p = makePrisma();
    const svc = new StaffService(p as never, crypto);
    await svc.create(1n, 99n, {
      staffNameKo: '김총무',
      jumin: '901010-1234567',
    });
    const data = p.staff.create.mock.calls[0][0].data;
    expect(data.juminNoEnc instanceof Uint8Array).toBe(true);
    expect(data.juminNoMasked).toBe('901010-1******');
    expect(data.staffNameKo).toBe('김총무');
    expect(data.createdBy).toBe(99n);
  });

  it('revealJumin: 복호화 + PII 접근 감사', async () => {
    const p = makePrisma();
    const enc = crypto.encrypt('901010-1234567');
    p.staff.findFirst.mockResolvedValue({ id: 1n, juminNoEnc: enc });
    const svc = new StaffService(p as never, crypto);
    const out = await svc.revealJumin(1n, 99n, 1n);
    expect(out.jumin).toBe('901010-1234567');
    expect(p.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionType: 'staff.pii_access' }),
      }),
    );
  });
});
