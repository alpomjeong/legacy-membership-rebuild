import { DataImportService } from './data-import.service';

/**
 * importBuddhistServices 용 mock — 마스터·회원·이벤트·기존 건 프리로드 + tx 배치(createMany).
 * 대량 적재 재작성 후: 행별 create/findFirst 폐기 → 엔티티별 createMany + 재조회 id 매핑.
 * tx.*.findMany 기본값은 pending 신규분(신규회원·신규원장·신규 봉안일)을 되돌려 id 매핑을 시뮬레이션.
 */
const makeSvcPrisma = (over: Record<string, unknown> = {}) => {
  const tx = {
    missionary: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([{ id: 700n, name: '신규원장' }]),
    },
    member: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest
        .fn()
        .mockResolvedValue([
          { id: 100n, memberName: '신규회원', phone: '010-9999-8888' },
        ]),
    },
    enshrinementEvent: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest
        .fn()
        .mockResolvedValue([
          { id: 200n, eventDateSolar: new Date(2026, 7, 15, 11, 0) },
        ]),
    },
    buddhistServiceReg: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  return {
    tx,
    buddhistServiceItem: {
      findMany: jest.fn().mockResolvedValue([{ id: 11n, name: '위패' }]),
    },
    member: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { id: 5n, memberName: '홍길동', phone: '010-1111-2222' },
        ]),
    },
    enshrinementEvent: { findMany: jest.fn().mockResolvedValue([]) },
    missionary: {
      findMany: jest.fn().mockResolvedValue([{ id: 7n, name: '무량원' }]),
    },
    // 기존 건 스냅샷(재업로드 멱등 프리로드) — 기본 없음.
    buddhistServiceReg: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(
      async (cb: (t: typeof tx) => unknown, opts?: unknown) => {
        void opts; // 시그니처상 2번째 인자(트랜잭션 옵션) 캡처용
        return cb(tx);
      },
    ),
    ...over,
  };
};

/** createMany 로 적재된 첫 불사 건 data(단건 테스트용). */
const firstReg = (p: ReturnType<typeof makeSvcPrisma>) =>
  p.tx.buddhistServiceReg.createMany.mock.calls[0][0].data[0];

describe('DataImportService.importBuddhistServices (불사 엑셀 이관)', () => {
  it('기존 회원 매칭 + 불사목록 매칭 → 건 적재(슬롯·단번호·상태 포함)', async () => {
    const p = makeSvcPrisma();
    const svc = new DataImportService(p as never);
    const report = await svc.importBuddhistServices(1n, 99n, [
      {
        회원명: '홍길동',
        전화: '010-1111-2222',
        불사목록: '위패',
        신청일: '2025-03-01',
        단번호: '0909',
        복위자: '김복순',
        취소여부: '',
        증서발급: '발급',
        증서발급일자: '2025-03-02',
      },
    ]);
    expect(report.loaded).toBe(1);
    expect(report.errors).toEqual([]);
    const data = firstReg(p);
    expect(data.memberId).toBe(5n);
    expect(data.buddhistServiceItemId).toBe(11n);
    expect(data.altarNumber).toBe('0909'); // 선행 0 보존
    expect(data.bogwija).toBe('김복순');
    expect(data.isCertificateIssued).toBe(true);
    expect(data.isCanceled).toBe(false);
  });

  it('불사목록 미등록 이름은 행 오류(마스터 선등록 필요)', async () => {
    const p = makeSvcPrisma();
    const svc = new DataImportService(p as never);
    const report = await svc.importBuddhistServices(1n, 99n, [
      { 회원명: '홍길동', 불사목록: '없는불사' },
    ]);
    expect(report.loaded).toBe(0);
    expect(report.errors[0].reason).toContain('불사목록');
  });

  it('회원 미존재 시 자동 생성 후 건 연결(membersCreated 집계)', async () => {
    const p = makeSvcPrisma();
    const svc = new DataImportService(p as never);
    const report = await svc.importBuddhistServices(1n, 99n, [
      { 회원명: '신규회원', 전화: '010-9999-8888', 불사목록: '위패' },
    ]);
    expect(report.loaded).toBe(1);
    expect(report.membersCreated).toBe(1);
    expect(p.tx.member.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ memberName: '신규회원' }),
        ]),
      }),
    );
    // 재조회로 매핑된 신규 회원 id 로 연결
    expect(firstReg(p).memberId).toBe(100n);
  });

  it('전화 없이 동명이인 2명이면 행 오류(구분 불가)', async () => {
    const p = makeSvcPrisma({
      member: {
        findMany: jest.fn().mockResolvedValue([
          { id: 5n, memberName: '홍길동', phone: '010-1111-2222' },
          { id: 6n, memberName: '홍길동', phone: '010-3333-4444' },
        ]),
      },
    });
    const svc = new DataImportService(p as never);
    const report = await svc.importBuddhistServices(1n, 99n, [
      { 회원명: '홍길동', 불사목록: '위패' },
    ]);
    expect(report.loaded).toBe(0);
    expect(report.errors[0].reason).toContain('동명이인');
  });

  it('봉안일 신규 일시는 공유 이벤트로 자동 생성·연결(eventsCreated 집계)', async () => {
    const p = makeSvcPrisma();
    const svc = new DataImportService(p as never);
    const report = await svc.importBuddhistServices(1n, 99n, [
      {
        회원명: '홍길동',
        전화: '010-1111-2222',
        불사목록: '위패',
        봉안일: '2026-08-15 11:00',
      },
    ]);
    expect(report.loaded).toBe(1);
    expect(report.eventsCreated).toBe(1);
    expect(p.tx.enshrinementEvent.createMany).toHaveBeenCalled();
    expect(firstReg(p).enshrinementEventId).toBe(200n);
  });

  it('완전 동일 건(회원+불사+신청일+단번호+봉안일)이 이미 있으면 스킵 — 재업로드 멱등', async () => {
    const p = makeSvcPrisma({
      // 프리로드 스냅샷에 완전 동일 건 존재 → 스킵
      buddhistServiceReg: {
        findMany: jest.fn().mockResolvedValue([
          {
            memberId: 5n,
            buddhistServiceItemId: 11n,
            registrationDate: new Date(2025, 2, 1),
            altarNumber: null,
            enshrinementEventId: null,
          },
        ]),
      },
    });
    const svc = new DataImportService(p as never);
    const report = await svc.importBuddhistServices(1n, 99n, [
      {
        회원명: '홍길동',
        전화: '010-1111-2222',
        불사목록: '위패',
        신청일: '2025-03-01',
      },
    ]);
    expect(report.skipped).toBe(1);
    expect(report.loaded).toBe(0);
    expect(p.tx.buddhistServiceReg.createMany).not.toHaveBeenCalled();
  });

  it('날짜 형식 오류는 행 오류로 분류', async () => {
    const p = makeSvcPrisma();
    const svc = new DataImportService(p as never);
    const report = await svc.importBuddhistServices(1n, 99n, [
      {
        회원명: '홍길동',
        전화: '010-1111-2222',
        불사목록: '위패',
        신청일: '2025년3월',
      },
    ]);
    expect(report.loaded).toBe(0);
    expect(report.errors[0].reason).toContain('신청일');
  });

  it('레거시 별칭(신청자/기타메모) + 소속·생년월일 반영, 미등록 포교원장 자동생성', async () => {
    const p = makeSvcPrisma();
    // 신규 회원 재조회 매핑(이름|전화 없음)
    p.tx.member.findMany.mockResolvedValue([
      { id: 100n, memberName: '김레거시', phone: null },
    ]);
    const svc = new DataImportService(p as never);
    const report = await svc.importBuddhistServices(1n, 99n, [
      {
        신청자: '김레거시',
        소속: '9001',
        포교원장: '신규원장', // 마스터에 없음 → 자동 생성
        불사목록: '위패',
        생년월일: '갑자생',
        기타메모: '레거시 비고',
      },
    ]);
    expect(report.loaded).toBe(1);
    expect(report.errors).toEqual([]);
    expect(report.membersCreated).toBe(1);
    expect(report.missionariesCreated).toBe(1);
    expect(p.tx.missionary.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ name: '신규원장' }),
        ]),
      }),
    );
    const mData = p.tx.member.createMany.mock.calls[0][0].data[0];
    expect(mData.memberName).toBe('김레거시');
    expect(mData.affiliationCode).toBe('9001');
    expect(mData.missionaryId).toBe(700n); // 자동 생성된 포교원장 id
    expect(mData.birthRaw).toBe('갑자생');
    expect(firstReg(p).memo).toBe('레거시 비고'); // 기타메모 별칭
  });

  it('마스터에 있는 포교원장은 재사용(자동생성 안 함)', async () => {
    const p = makeSvcPrisma();
    p.tx.member.findMany.mockResolvedValue([
      { id: 100n, memberName: '박기존', phone: null },
    ]);
    const svc = new DataImportService(p as never);
    const report = await svc.importBuddhistServices(1n, 99n, [
      { 신청자: '박기존', 포교원장: '무량원', 불사목록: '위패' },
    ]);
    expect(report.missionariesCreated).toBe(0);
    expect(p.tx.missionary.createMany).not.toHaveBeenCalled();
    expect(p.tx.member.createMany.mock.calls[0][0].data[0].missionaryId).toBe(
      7n,
    );
  });

  it("'취소일자'만 있어도 취소로 판정(취소여부 칸 없는 레거시)", async () => {
    const p = makeSvcPrisma();
    const svc = new DataImportService(p as never);
    const report = await svc.importBuddhistServices(1n, 99n, [
      {
        회원명: '홍길동',
        전화: '010-1111-2222',
        불사목록: '위패',
        취소일자: '2025-05-01',
      },
    ]);
    expect(report.loaded).toBe(1);
    const rData = firstReg(p);
    expect(rData.isCanceled).toBe(true);
    expect(rData.canceledAt).toEqual(new Date(2025, 4, 1, 0, 0));
  });

  it('대량 행은 단일 createMany 배치로 적재(행별 create 왕복 없음) + 트랜잭션 타임아웃 상향', async () => {
    const p = makeSvcPrisma();
    // 신규 회원 N명 재조회 매핑(이름 회원i|전화 없음)
    const N = 5000;
    p.tx.member.findMany.mockResolvedValue(
      Array.from({ length: N }, (_, i) => ({
        id: BigInt(1000 + i),
        memberName: `회원${i}`,
        phone: null,
      })),
    );
    const svc = new DataImportService(p as never);
    const rows = Array.from({ length: N }, (_, i) => ({
      회원명: `회원${i}`,
      불사목록: '위패',
    }));
    const report = await svc.importBuddhistServices(1n, 99n, rows);

    expect(report.loaded).toBe(N);
    // 불사 건은 한 번의 createMany 로 N건 적재
    expect(p.tx.buddhistServiceReg.createMany).toHaveBeenCalledTimes(1);
    expect(
      p.tx.buddhistServiceReg.createMany.mock.calls[0][0].data,
    ).toHaveLength(N);
    // 회원도 한 번의 createMany
    expect(p.tx.member.createMany).toHaveBeenCalledTimes(1);
    // 기본 5s 타임아웃을 넘도록 명시 옵션 전달(안전망)
    const txOpts = p.$transaction.mock.calls[0][1] as { timeout: number };
    expect(txOpts).toEqual(
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
    expect(txOpts.timeout).toBeGreaterThanOrEqual(60_000);
  });
});

describe('DataImportService.exportBuddhistServices (왕복 추출)', () => {
  const makeExportPrisma = (regs: unknown[]) => ({
    buddhistServiceReg: { findMany: jest.fn().mockResolvedValue(regs) },
  });

  it('업로드 헤더(신청자/불사목록/소속/포교원장/봉안일…)와 동일 컬럼으로 매핑 — 재업로드 왕복', async () => {
    const p = makeExportPrisma([
      {
        altarNumber: '0909', // 선행 0 보존
        bogwija: '김복순',
        relationship: '모',
        bokjunja: null,
        spiritual: null,
        yesujae: null,
        seongju12: null,
        memo: '비고',
        isCanceled: false,
        canceledAt: null,
        isCertificateIssued: true,
        certificateIssuedDate: new Date(Date.UTC(2025, 2, 1, 15, 0)), // KST 2025-03-02
        member: {
          memberName: '홍길동',
          affiliationCode: '9001',
          birthRaw: '갑자생',
          missionary: { name: '무량원' },
        },
        buddhistServiceItem: { name: '위패' },
        enshrinementEvent: {
          eventDateSolar: new Date(Date.UTC(2026, 7, 15, 2, 0)),
        }, // KST 2026-08-15 11:00
      },
    ]);
    const svc = new DataImportService(p as never);
    const rows = await svc.exportBuddhistServices(1n);

    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r['신청자']).toBe('홍길동');
    expect(r['불사목록']).toBe('위패');
    expect(r['소속']).toBe('9001');
    expect(r['포교원장']).toBe('무량원');
    expect(r['봉안일']).toBe('2026-08-15 11:00'); // KST, 'YYYY-MM-DD HH:mm'
    expect(r['단번호']).toBe('0909');
    expect(r['복위자']).toBe('김복순');
    expect(r['관계']).toBe('모');
    expect(r['생년월일']).toBe('갑자생');
    expect(r['기타메모']).toBe('비고');
    expect(r['증서발급']).toBe('발급');
    expect(r['증서발급일자']).toBe('2025-03-02');
    expect(r['취소일자']).toBe('');
  });

  it('전체 내보내기 — where 에 isCanceled 필터 없음, 취소 건은 취소일자 채움', async () => {
    const p = makeExportPrisma([
      {
        altarNumber: null,
        bogwija: null,
        relationship: null,
        bokjunja: null,
        spiritual: null,
        yesujae: null,
        seongju12: null,
        memo: null,
        isCanceled: true,
        canceledAt: new Date(Date.UTC(2025, 4, 1, 0, 0)), // KST 2025-05-01
        isCertificateIssued: false,
        certificateIssuedDate: null,
        member: {
          memberName: '박취소',
          affiliationCode: null,
          birthRaw: null,
          missionary: null,
        },
        buddhistServiceItem: { name: '위패' },
        enshrinementEvent: null,
      },
    ]);
    const svc = new DataImportService(p as never);
    const rows = await svc.exportBuddhistServices(1n);

    expect(rows[0]['취소일자']).toBe('2025-05-01');
    expect(rows[0]['증서발급']).toBe('');
    expect(rows[0]['봉안일']).toBe('');
    // 전체 내보내기 — 취소 건도 포함(where 에 isCanceled 조건 없음)
    const where = p.buddhistServiceReg.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ tenantId: 1n, isDeleted: false });
  });
});

describe('DataImportService.resetBusinessData', () => {
  const tbl = (n: number) => ({
    count: jest.fn().mockResolvedValue(n),
    deleteMany: jest.fn().mockResolvedValue({ count: n }),
  });
  const makeResetPrisma = () => ({
    member: tbl(5),
    buddhistServiceReg: tbl(9),
    enshrinementEvent: tbl(2),
    counsel: tbl(4),
    deceased: tbl(0),
    missionary: tbl(3),
    staff: tbl(7),
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    // TRUNCATE 금지 — 존재하면 테스트 실패시키기 위한 가드
    $executeRawUnsafe: jest.fn(() => {
      throw new Error('TRUNCATE 금지: deleteMany 를 사용해야 함');
    }),
    $transaction: jest.fn(async (ops: unknown[]) => ops),
  });

  it('의존순 deleteMany(트랜잭션)로 삭제 — TRUNCATE 미사용, 계정테이블 미포함, 감사로그 기록', async () => {
    const p = makeResetPrisma();
    const svc = new DataImportService(p as never);
    const res = await svc.resetBusinessData(1n, 99n);
    // TRUNCATE(raw) 는 절대 쓰지 않음 → 계정 보존
    expect(p.$executeRawUnsafe).not.toHaveBeenCalled();
    // 자식 먼저(불사 건), 부모 나중(회원)까지 각 테이블 deleteMany 호출
    expect(p.buddhistServiceReg.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 1n },
    });
    expect(p.member.deleteMany).toHaveBeenCalled();
    expect(p.staff.deleteMany).toHaveBeenCalled();
    // user_account/role 등 계정·RBAC 테이블은 애초에 건드리지 않음(모의에 없음 = 미참조)
    expect(p.$transaction).toHaveBeenCalledTimes(1);
    expect(p.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionType: 'data.reset_business' }),
      }),
    );
    expect(res.before.member).toBe(5);
  });
});
