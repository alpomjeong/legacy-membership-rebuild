import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { memberDisplayName } from '@domain/member-display-name';
import { CreateCounselDto } from './dto/create-counsel.dto';
import { UpdateCounselDto } from './dto/update-counsel.dto';
import { QueryCounselsDto } from './dto/query-counsels.dto';

export interface CounselView {
  id: string;
  memberId: string;
  memberName: string | null;
  memberDisplayName: string | null;
  counseledAt: Date;
  content: string;
  createdAt: Date;
  updatedAt: Date | null;
}

const INCLUDE = {
  member: {
    select: {
      memberName: true,
      phone: true,
      missionary: { select: { name: true } },
    },
  },
} as const;

type Row = Prisma.CounselGetPayload<{ include: typeof INCLUDE }>;

const THREE_MONTHS_MS = 1000 * 60 * 60 * 24 * 90;

/** CounselsService — 상담 CRUD/검색 (E1.7, FR-CNS-01~08). 상담일시 단일 규칙(ISO8601→UTC 저장). */
@Injectable()
export class CounselsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenantId: bigint,
    actorId: bigint,
    dto: CreateCounselDto,
  ): Promise<CounselView> {
    await this.assertMember(tenantId, dto.memberId);
    const created = await this.prisma.$transaction(async (tx) => {
      const c = await tx.counsel.create({
        data: {
          tenantId,
          memberId: BigInt(dto.memberId),
          counseledAt: new Date(dto.counseledAt),
          content: dto.content,
          createdBy: actorId,
        },
        include: INCLUDE,
      });
      await tx.auditLog.create({
        data: this.audit(tenantId, actorId, 'counsel.create', c.id),
      });
      return c;
    });
    return this.toView(created);
  }

  async update(
    tenantId: bigint,
    actorId: bigint,
    id: bigint,
    dto: UpdateCounselDto,
  ): Promise<CounselView> {
    const before = await this.prisma.counsel.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!before) throw new NotFoundException('상담을 찾을 수 없습니다');
    await this.assertMember(tenantId, dto.memberId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const c = await tx.counsel.update({
        where: { id },
        data: {
          memberId: BigInt(dto.memberId),
          counseledAt: new Date(dto.counseledAt),
          content: dto.content,
          updatedBy: actorId,
        },
        include: INCLUDE,
      });
      await tx.auditLog.create({
        data: this.audit(tenantId, actorId, 'counsel.update', c.id),
      });
      return c;
    });
    return this.toView(updated);
  }

  async list(tenantId: bigint, q: QueryCounselsDto) {
    const where: Prisma.CounselWhereInput = { tenantId, isDeleted: false };
    const from = q.from
      ? new Date(q.from)
      : new Date(Date.now() - THREE_MONTHS_MS);
    const to = q.to ? new Date(q.to) : undefined;
    where.counseledAt = to ? { gte: from, lte: to } : { gte: from };
    if (q.memberId) where.memberId = BigInt(q.memberId);
    if (q.q) {
      where.OR = [
        { content: { contains: q.q, mode: 'insensitive' } },
        { member: { memberName: { contains: q.q, mode: 'insensitive' } } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.counsel.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ counseledAt: q.order }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.counsel.count({ where }),
    ]);
    return {
      items: rows.map((r) => this.toView(r)),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  /** 내보내기용 — 페이지네이션 없이 기간/필터 결과 전체. */
  async listForExport(
    tenantId: bigint,
    q: QueryCounselsDto,
  ): Promise<CounselView[]> {
    const where: Prisma.CounselWhereInput = { tenantId, isDeleted: false };
    const from = q.from
      ? new Date(q.from)
      : new Date(Date.now() - THREE_MONTHS_MS);
    const to = q.to ? new Date(q.to) : undefined;
    where.counseledAt = to ? { gte: from, lte: to } : { gte: from };
    if (q.memberId) where.memberId = BigInt(q.memberId);
    if (q.q) {
      where.OR = [
        { content: { contains: q.q, mode: 'insensitive' } },
        { member: { memberName: { contains: q.q, mode: 'insensitive' } } },
      ];
    }
    const rows = await this.prisma.counsel.findMany({
      where,
      include: INCLUDE,
      orderBy: [{ counseledAt: q.order }],
    });
    return rows.map((r) => this.toView(r));
  }

  /** 회원별 상담 이력(최신순) — 회원 상세 탭(FR-CNS-08). */
  async byMember(tenantId: bigint, memberId: bigint): Promise<CounselView[]> {
    const rows = await this.prisma.counsel.findMany({
      where: { tenantId, memberId, isDeleted: false },
      include: INCLUDE,
      orderBy: [{ counseledAt: 'desc' }],
    });
    return rows.map((r) => this.toView(r));
  }

  async getById(tenantId: bigint, id: bigint): Promise<CounselView> {
    const c = await this.prisma.counsel.findFirst({
      where: { id, tenantId, isDeleted: false },
      include: INCLUDE,
    });
    if (!c) throw new NotFoundException('상담을 찾을 수 없습니다');
    return this.toView(c);
  }

  async softDelete(
    tenantId: bigint,
    actorId: bigint,
    id: bigint,
  ): Promise<void> {
    const before = await this.prisma.counsel.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!before) throw new NotFoundException('상담을 찾을 수 없습니다');
    await this.prisma.$transaction(async (tx) => {
      await tx.counsel.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date(), updatedBy: actorId },
      });
      await tx.auditLog.create({
        data: this.audit(tenantId, actorId, 'counsel.delete', id),
      });
    });
  }

  private async assertMember(
    tenantId: bigint,
    memberId: string,
  ): Promise<void> {
    const m = await this.prisma.member.findFirst({
      where: { id: BigInt(memberId), tenantId, isDeleted: false },
    });
    if (!m) throw new BadRequestException(`존재하지 않는 회원: ${memberId}`);
  }

  private audit(
    tenantId: bigint,
    actorId: bigint,
    actionType: string,
    id: bigint,
  ): Prisma.AuditLogUncheckedCreateInput {
    return {
      tenantId,
      userAccountId: actorId,
      actionType,
      entityName: 'Counsel',
      entityId: id.toString(),
    };
  }

  private toView(c: Row): CounselView {
    return {
      id: c.id.toString(),
      memberId: c.memberId.toString(),
      memberName: c.member?.memberName ?? null,
      memberDisplayName: c.member
        ? memberDisplayName({
            name: c.member.memberName,
            missionaryName: c.member.missionary?.name ?? null,
            phone: c.member.phone,
          })
        : null,
      counseledAt: c.counseledAt,
      content: c.content,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }
}
