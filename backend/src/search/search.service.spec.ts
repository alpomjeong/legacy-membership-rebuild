import { SearchService } from './search.service';

const memberA = {
  id: 1n,
  memberName: '홍길동',
  phone: '010-1111-2222',
  missionary: { name: '무량원' },
};

const makePrisma = (opts: { members?: unknown[]; regs?: unknown[] }) => ({
  member: { findMany: jest.fn().mockResolvedValue(opts.members ?? []) },
  buddhistServiceReg: {
    findMany: jest.fn().mockResolvedValue(opts.regs ?? []),
  },
});

describe('SearchService.searchMembers', () => {
  it('회원 본인 필드 매칭 → self 사유', async () => {
    const p = makePrisma({ members: [memberA] });
    const svc = new SearchService(p as never);
    const res = await svc.searchMembers(1n, '홍길동');
    expect(res.items).toHaveLength(1);
    expect(res.items[0].displayName).toBe('홍길동_무량원');
    expect(res.items[0].matchReasons).toContain('self');
  });

  it("인물 슬롯만 보유한 소유 회원 노출 ('홍길순'→홍길동)", async () => {
    const p = makePrisma({
      regs: [
        { memberId: 1n, bokjunja: '홍길순', spiritual: null, member: memberA },
      ],
    });
    const svc = new SearchService(p as never);
    const res = await svc.searchMembers(1n, '홍길순');
    expect(res.items).toHaveLength(1);
    expect(res.items[0].id).toBe('1');
    expect(res.items[0].matchReasons).toContain('bokjunja');
  });

  it('본인 + 슬롯 동시 매칭은 distinct 1행, 사유 합집합', async () => {
    const p = makePrisma({
      members: [memberA],
      regs: [{ memberId: 1n, spiritual: '홍길동', member: memberA }],
    });
    const svc = new SearchService(p as never);
    const res = await svc.searchMembers(1n, '홍길동');
    expect(res.items).toHaveLength(1);
    expect(res.items[0].matchReasons).toEqual(
      expect.arrayContaining(['self', 'spiritual']),
    );
  });
});
