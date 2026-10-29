import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { memberDisplayName } from '@domain/member-display-name';
import { CreateEnshrinementDto } from './dto/create-enshrinement.dto';
import { UpdateEnshrinementDto } from './dto/update-enshrinement.dto';

export interface EnshrinementView {
  id: string;
  eventDateSolar: Date;
  label: string | null;
  remark: string | null;
  defaultBuddhistServiceItemId: string | null;
  defaultBuddhistServiceItemName: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface RosterRow {
  regId: string;
  memberId: string;
  memberName: string;
  displayName: string;
  buddhistServiceItemName: string | null;
  altarNumber: string | null;
  isCanceled: boolean;
}

const INCLUDE = {
  defaultBuddhistServiceItem: { select: { name: true } },
} as const;

type Row = Prisma.EnshrinementEventGetPayload<{ include: typeof INCLUDE }>;

/** EnshrinementsService — 봉안일 CRUD + 명단 (E1.6, FR-FUN-01~04). 양력만(음력/간지는 Phase 2). */
@Injectable()
export class EnshrinementsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 기본 불사목록 참조 검증 — 없는/잘못된 id 를 그대로 넣어 FK 위반 500 나던 문제 방지(→ 400). */
  private async assertDefaultItem(
    tenantId: bigint,
    dto: { defaultBuddhistServiceItemId?: string | null },
  ): Promise<void> {
    const raw = dto.defaultBuddhistServiceItemId;
    if (!raw) return;
    if (!/^\d+$/.test(raw))
      throw new BadRequestException(`불사목록 ID 형식 오류: ${raw}`);
    const item = await this.prisma.buddhistServiceItem.findFirst({
      where: { id: BigInt(raw), tenantId, isDeleted: false },
    });
    if (!item) throw new BadRequestException(`존재하지 않는 불사목록: ${raw}`);
  }

  async create(
    tenantId: bigint,
    actorId: bigint,
    dto: CreateEnshrinementDto,
  ): Promise<EnshrinementView> {
    await this.assertDefaultItem(tenantId, dto);
    const created = await this.prisma.$transaction(async (tx) => {
      const e = await tx.enshrinementEvent.create({
        data: { ...this.toData(tenantId, dto), createdBy: actorId },
        include: INCLUDE,
      });
      await tx.auditLog.create({
        data: this.audit(tenantId, actorId, 'enshrinement.create', e.id),
      });
      return e;
    });
    return this.toView(created);
  }

  async update(
    tenantId: bigint,
    actorId: bigint,
    id: bigint,
    dto: UpdateEnshrinementDto,
  ): Promise<EnshrinementView> {
    const before = await this.prisma.enshrinementEvent.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!before) throw new NotFoundException('봉안일을 찾을 수 없습니다');
    await this.assertDefaultItem(tenantId, dto);
    const updated = await this.prisma.$transaction(async (tx) => {
      const e = await tx.enshrinementEvent.update({
        where: { id },
        data: { ...this.toData(tenantId, dto), updatedBy: actorId },
        include: INCLUDE,
      });
      await tx.auditLog.create({
        data: this.audit(tenantId, actorId, 'enshrinement.update', e.id),
      });
      return e;
    });
    return this.toView(updated);
  }

  async list(
    tenantId: bigint,
    page = 1,
    pageSize = 50,
    order: 'asc' | 'desc' = 'desc',
  ) {
    const where: Prisma.EnshrinementEventWhereInput = {
      tenantId,
      isDeleted: false,
    };
    const [rows, total] = await Promise.all([
      this.prisma.enshrinementEvent.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ eventDateSolar: order }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.enshrinementEvent.count({ where }),
    ]);
    return { items: rows.map((r) => this.toView(r)), total, page, pageSize };
  }

  async getById(tenantId: bigint, id: bigint): Promise<EnshrinementView> {
    const e = await this.prisma.enshrinementEvent.findFirst({
      where: { id, tenantId, isDeleted: false },
      include: INCLUDE,
    });
    if (!e) throw new NotFoundException('봉안일을 찾을 수 없습니다');
    return this.toView(e);
  }

  async softDelete(
    tenantId: bigint,
    actorId: bigint,
    id: bigint,
  ): Promise<void> {
    const before = await this.prisma.enshrinementEvent.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!before) throw new NotFoundException('봉안일을 찾을 수 없습니다');
    await this.prisma.$transaction(async (tx) => {
      await tx.enshrinementEvent.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date(), updatedBy: actorId },
      });
      await tx.auditLog.create({
        data: this.audit(tenantId, actorId, 'enshrinement.delete', id),
      });
    });
  }

  /** 봉안일에 묶인 불사 신청 회원 명단(FR-FUN-04). */
  async roster(tenantId: bigint, id: bigint): Promise<RosterRow[]> {
    const regs = await this.prisma.buddhistServiceReg.findMany({
      where: { tenantId, enshrinementEventId: id, isDeleted: false },
      include: {
        member: {
          select: {
            memberName: true,
            phone: true,
            missionary: { select: { name: true } },
          },
        },
        buddhistServiceItem: { select: { name: true } },
      },
      orderBy: [{ altarNumber: 'asc' }],
    });
    return regs.map((r) => ({
      regId: r.id.toString(),
      memberId: r.memberId.toString(),
      memberName: r.member?.memberName ?? '',
      displayName: r.member
        ? memberDisplayName({
            name: r.member.memberName,
            missionaryName: r.member.missionary?.name ?? null,
            phone: r.member.phone,
          })
        : '',
      buddhistServiceItemName: r.buddhistServiceItem?.name ?? null,
      altarNumber: r.altarNumber,
      isCanceled: r.isCanceled,
    }));
  }

  private toData(
    tenantId: bigint,
    dto: CreateEnshrinementDto,
  ): Prisma.EnshrinementEventUncheckedCreateInput {
    return {
      tenantId,
      eventDateSolar: new Date(dto.eventDateSolar),
      label: dto.label ?? null,
      remark: dto.remark ?? null,
      defaultBuddhistServiceItemId: dto.defaultBuddhistServiceItemId
        ? BigInt(dto.defaultBuddhistServiceItemId)
        : null,
    };
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
      entityName: 'EnshrinementEvent',
      entityId: id.toString(),
    };
  }

  private toView(e: Row): EnshrinementView {
    return {
      id: e.id.toString(),
      eventDateSolar: e.eventDateSolar,
      label: e.label,
      remark: e.remark,
      defaultBuddhistServiceItemId:
        e.defaultBuddhistServiceItemId?.toString() ?? null,
      defaultBuddhistServiceItemName:
        e.defaultBuddhistServiceItem?.name ?? null,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }
}
