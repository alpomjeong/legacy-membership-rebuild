import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { memberDisplayName } from '@domain/member-display-name';
import { PERSON_SLOT_KEYS } from '@domain/buddhist-service';

export interface MemberSearchHit {
  id: string;
  memberName: string;
  displayName: string;
  phone: string | null;
  missionaryName: string | null;
  matchReasons: string[];
}

/** 검색 인덱싱 대상 인물 슬롯(텍스트 컬럼). 12성주/관계 포함(SearchIndexed 후속 세분화 가능). */
const SLOT_COLUMNS = PERSON_SLOT_KEYS;

/**
 * SearchService — 통합 확장검색 (E1.4, FR-MEM-14/FR-BUD-15).
 * 회원 본인 필드 + 불사 인물 슬롯을 매칭하여 distinct 소유 회원을 매칭 사유와 함께 노출한다.
 * 전 쿼리 Prisma 파라미터화(인젝션 차단, FR-BUD-20).
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchMembers(tenantId: bigint, q: string, page = 1, pageSize = 20) {
    const hits = new Map<string, MemberSearchHit>();

    const members = await this.prisma.member.findMany({
      where: {
        tenantId,
        isDeleted: false,
        OR: [
          { memberName: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
          { address: { contains: q, mode: 'insensitive' } },
          { addressDetail: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { missionary: { select: { name: true } } },
    });
    for (const m of members) {
      this.addHit(hits, m, ['self']);
    }

    const regs = await this.prisma.buddhistServiceReg.findMany({
      where: {
        tenantId,
        isDeleted: false,
        OR: SLOT_COLUMNS.map((k) => ({
          [k]: { contains: q, mode: 'insensitive' },
        })),
      },
      include: {
        member: { include: { missionary: { select: { name: true } } } },
      },
    });
    for (const reg of regs) {
      if (!reg.member || reg.member.isDeleted) continue;
      const reasons = SLOT_COLUMNS.filter((k) => {
        const v = reg[k as keyof typeof reg];
        return (
          typeof v === 'string' && v.toLowerCase().includes(q.toLowerCase())
        );
      });
      this.addHit(hits, reg.member, reasons);
    }

    const all = [...hits.values()];
    const start = (page - 1) * pageSize;
    return {
      items: all.slice(start, start + pageSize),
      total: all.length,
      page,
      pageSize,
    };
  }

  private addHit(
    hits: Map<string, MemberSearchHit>,
    m: {
      id: bigint;
      memberName: string;
      phone: string | null;
      missionary: { name: string } | null;
    },
    reasons: string[],
  ): void {
    const key = m.id.toString();
    const existing = hits.get(key);
    if (existing) {
      for (const r of reasons)
        if (!existing.matchReasons.includes(r)) existing.matchReasons.push(r);
      return;
    }
    hits.set(key, {
      id: key,
      memberName: m.memberName,
      displayName: memberDisplayName({
        name: m.memberName,
        missionaryName: m.missionary?.name ?? null,
        phone: m.phone,
      }),
      phone: m.phone,
      missionaryName: m.missionary?.name ?? null,
      matchReasons: [...reasons],
    });
  }
}
