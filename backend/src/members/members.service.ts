import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { memberDisplayName } from '@domain/member-display-name';
import { memberNaturalKey, normalizeMemberName } from '@domain/member';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { QueryMembersDto } from './dto/query-members.dto';

/** 응답 표시 모델 — DisplayName 파생 포함(물리 미저장). */
export interface MemberView {
  id: string;
  memberName: string;
  displayName: string;
  affiliationCode: string | null;
  phone: string | null;
  address: string | null;
  addressDetail: string | null;
  zipCode: string | null;
  missionaryId: string | null;
  missionaryName: string | null;
  memo: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

type MemberWithMissionary = Prisma.MemberGetPayload<{
  include: { missionary: { select: { name: true } } };
}>;

const INCLUDE_MISSIONARY = { missionary: { select: { name: true } } } as const;

/**
 * MembersService — 회원 CRUD/검색/소프트삭제 (E1.1, FR-MEM-*).
 * 전 쿼리 Prisma 파라미터화. 변경은 $transaction 으로 엔티티+감사 원자 적재(PD-6).
 */
@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenantId: bigint,
    actorId: bigint,
    dto: CreateMemberDto,
  ): Promise<MemberView> {
    await this.assertLookups(tenantId, dto);
    const created = await this.prisma.$transaction(async (tx) => {
      const m = await tx.member.create({
        data: this.toData(tenantId, dto, { createdBy: actorId }),
        include: INCLUDE_MISSIONARY,
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          userAccountId: actorId,
          actionType: 'member.create',
          entityName: 'Member',
          entityId: m.id.toString(),
          afterJson: this.snapshot(m),
        },
      });
      return m;
    });
    return this.toView(created);
  }

  async update(
    tenantId: bigint,
    actorId: bigint,
    id: bigint,
    dto: UpdateMemberDto,
  ): Promise<MemberView> {
    const before = await this.prisma.member.findFirst({
      where: { id, tenantId, isDeleted: false },
      include: INCLUDE_MISSIONARY,
    });
    if (!before) throw new NotFoundException('회원을 찾을 수 없습니다');
    await this.assertLookups(tenantId, dto);
    const updated = await this.prisma.$transaction(async (tx) => {
      const m = await tx.member.update({
        where: { id },
        data: this.toData(tenantId, dto, { updatedBy: actorId }),
        include: INCLUDE_MISSIONARY,
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          userAccountId: actorId,
          actionType: 'member.update',
          entityName: 'Member',
          entityId: m.id.toString(),
          beforeJson: this.snapshot(before),
          afterJson: this.snapshot(m),
        },
      });
      return m;
    });
    return this.toView(updated);
  }

  async list(tenantId: bigint, q: QueryMembersDto) {
    const where = this.buildWhere(tenantId, q);
    const [rows, total] = await Promise.all([
      this.prisma.member.findMany({
        where,
        include: INCLUDE_MISSIONARY,
        orderBy: [{ [q.sort]: q.order }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.member.count({ where }),
    ]);
    const keyCount = new Map<string, number>();
    for (const m of rows) {
      const k = memberNaturalKey({
        memberName: m.memberName,
        missionaryId: m.missionaryId,
      });
      keyCount.set(k, (keyCount.get(k) ?? 0) + 1);
    }
    const items = rows.map((m) =>
      this.toView(
        m,
        (keyCount.get(
          memberNaturalKey({
            memberName: m.memberName,
            missionaryId: m.missionaryId,
          }),
        ) ?? 0) > 1,
      ),
    );
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async listForExport(
    tenantId: bigint,
    q: QueryMembersDto,
  ): Promise<MemberView[]> {
    const rows = await this.prisma.member.findMany({
      where: this.buildWhere(tenantId, q),
      include: INCLUDE_MISSIONARY,
      orderBy: [{ [q.sort]: q.order }],
    });
    return rows.map((m) => this.toView(m));
  }

  async findDuplicateCandidates(
    tenantId: bigint,
    memberName: string,
    missionaryId: bigint | null,
  ): Promise<MemberView[]> {
    const rows = await this.prisma.member.findMany({
      where: {
        tenantId,
        isDeleted: false,
        memberName: normalizeMemberName(memberName),
        missionaryId,
      },
      include: INCLUDE_MISSIONARY,
    });
    return rows.map((m) => this.toView(m, rows.length > 1));
  }

  private buildWhere(
    tenantId: bigint,
    q: QueryMembersDto,
  ): Prisma.MemberWhereInput {
    const where: Prisma.MemberWhereInput = { tenantId, isDeleted: false };
    if (q.q) {
      where.OR = [
        { memberName: { contains: q.q, mode: 'insensitive' } },
        { phone: { contains: q.q } },
        { address: { contains: q.q, mode: 'insensitive' } },
        { addressDetail: { contains: q.q, mode: 'insensitive' } },
      ];
    }
    if (q.affiliationCodes?.length)
      where.affiliationCode = { in: q.affiliationCodes };
    if (q.missionaryIds?.length)
      where.missionaryId = { in: q.missionaryIds.map((x) => BigInt(x)) };
    return where;
  }

  async getById(tenantId: bigint, id: bigint): Promise<MemberView> {
    const m = await this.prisma.member.findFirst({
      where: { id, tenantId, isDeleted: false },
      include: INCLUDE_MISSIONARY,
    });
    if (!m) throw new NotFoundException('회원을 찾을 수 없습니다');
    const sameKey = await this.prisma.member.count({
      where: {
        tenantId,
        isDeleted: false,
        memberName: m.memberName,
        missionaryId: m.missionaryId,
      },
    });
    return this.toView(m, sameKey > 1);
  }

  async softDelete(
    tenantId: bigint,
    actorId: bigint,
    id: bigint,
  ): Promise<void> {
    const before = await this.prisma.member.findFirst({
      where: { id, tenantId, isDeleted: false },
      include: INCLUDE_MISSIONARY,
    });
    if (!before) throw new NotFoundException('회원을 찾을 수 없습니다');
    // 연결 기록 가드 — 불사 신청/상담이 남아 있으면 삭제 차단(사유 안내). 취소 건도 기록이므로 포함.
    const [regCount, counselCount] = await Promise.all([
      this.prisma.buddhistServiceReg.count({
        where: { tenantId, memberId: id, isDeleted: false },
      }),
      this.prisma.counsel.count({
        where: { tenantId, memberId: id, isDeleted: false },
      }),
    ]);
    if (regCount + counselCount > 0) {
      throw new ConflictException(
        `연결된 기록이 있어 회원을 삭제할 수 없습니다 — 불사 신청 ${regCount}건 · 상담 ${counselCount}건. 해당 기록을 먼저 삭제한 뒤 다시 시도하세요.`,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.member.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date(), updatedBy: actorId },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          userAccountId: actorId,
          actionType: 'member.delete',
          entityName: 'Member',
          entityId: id.toString(),
          beforeJson: this.snapshot(before),
        },
      });
    });
  }

  private toData(
    tenantId: bigint,
    dto: CreateMemberDto,
    audit: { createdBy?: bigint; updatedBy?: bigint },
  ): Prisma.MemberUncheckedCreateInput {
    return {
      tenantId,
      memberName: normalizeMemberName(dto.memberName),
      affiliationCode: dto.affiliationCode ?? null,
      phone: dto.phone ?? null,
      address: dto.address ?? null,
      addressDetail: dto.addressDetail ?? null,
      zipCode: dto.zipCode ?? null,
      missionaryId: dto.missionaryId ? BigInt(dto.missionaryId) : null,
      memo: dto.memo ?? null,
      ...audit,
    };
  }

  private async assertLookups(
    tenantId: bigint,
    dto: CreateMemberDto,
  ): Promise<void> {
    if (dto.affiliationCode) {
      const c = await this.prisma.commonCode.findFirst({
        where: {
          tenantId,
          groupCode: 'BA10',
          code: dto.affiliationCode,
          isActive: true,
        },
      });
      if (!c)
        throw new BadRequestException(
          `소속 코드(BA10)에 없는 값: ${dto.affiliationCode}`,
        );
    }
    if (dto.missionaryId) {
      const mi = await this.prisma.missionary.findFirst({
        where: { id: BigInt(dto.missionaryId), tenantId, isDeleted: false },
      });
      if (!mi)
        throw new BadRequestException(
          `존재하지 않는 포교원장: ${dto.missionaryId}`,
        );
    }
  }

  toView(m: MemberWithMissionary, disambiguate = false): MemberView {
    return {
      id: m.id.toString(),
      memberName: m.memberName,
      displayName: memberDisplayName({
        name: m.memberName,
        missionaryName: m.missionary?.name ?? null,
        phone: m.phone,
        disambiguate,
      }),
      affiliationCode: m.affiliationCode,
      phone: m.phone,
      address: m.address,
      addressDetail: m.addressDetail,
      zipCode: m.zipCode,
      missionaryId: m.missionaryId?.toString() ?? null,
      missionaryName: m.missionary?.name ?? null,
      memo: m.memo,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    };
  }

  private snapshot(m: MemberWithMissionary): Prisma.InputJsonValue {
    return {
      id: m.id.toString(),
      memberName: m.memberName,
      affiliationCode: m.affiliationCode,
      phone: m.phone,
      address: m.address,
      addressDetail: m.addressDetail,
      zipCode: m.zipCode,
      missionaryId: m.missionaryId?.toString() ?? null,
      memo: m.memo,
    };
  }
}
