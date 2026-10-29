import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  applyCancel,
  applyCertificate,
  normalizeSeongju12,
  normalizeSpiritual,
  type PersonSlots,
} from '@domain/buddhist-service';
import { normalizeAltarNumber } from '@domain/altar-number';
import { CreateBuddhistServiceDto } from './dto/create-buddhist-service.dto';
import { UpdateBuddhistServiceDto } from './dto/update-buddhist-service.dto';
import { QueryBuddhistServicesDto } from './dto/query-buddhist-services.dto';

export interface BuddhistServiceView {
  id: string;
  registrationDate: Date;
  memberId: string;
  memberName: string | null;
  buddhistServiceItemId: string;
  buddhistServiceItemName: string | null;
  enshrinementEventId: string | null;
  enshrinementLabel: string | null;
  staffId: string | null;
  staffName: string | null;
  altarNumber: string | null;
  bogwija: string | null;
  relationship: string | null;
  bokjunja: string | null;
  spiritual: string | null;
  yesujae: string | null;
  seongju12: string | null;
  sexagenaryYearId: string | null;
  donationAmount: string | null;
  memo: string | null;
  isCanceled: boolean;
  canceledAt: Date | null;
  isCertificateIssued: boolean;
  certificateIssuedDate: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

const INCLUDE = {
  member: {
    select: { memberName: true, missionary: { select: { name: true } } },
  },
  buddhistServiceItem: { select: { name: true, serviceTypeCode: true } },
  enshrinementEvent: { select: { label: true, eventDateSolar: true } },
  sexagenaryYear: { select: { ganjiNameKo: true } },
  staff: { select: { staffNameKo: true } },
} as const;

type RegRow = Prisma.BuddhistServiceRegGetPayload<{ include: typeof INCLUDE }>;

/**
 * BuddhistServicesService — 불사 신청 CRUD/검색/소프트삭제 (E1.2, FR-BUD-*).
 * 입력일 서버 KST 자동, 12성주/영가 정규화, 인물 슬롯 전체 선택(타입별 필수강제 없음), 취소/증서 워크플로우,
 * 전 쿼리 Prisma 파라미터화, $transaction 으로 엔티티+감사 원자 적재.
 */
@Injectable()
export class BuddhistServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenantId: bigint,
    actorId: bigint,
    dto: CreateBuddhistServiceDto,
  ): Promise<BuddhistServiceView> {
    await this.resolveEnshrinementByDate(tenantId, actorId, dto);
    await this.assertRefs(tenantId, dto);
    const slots = this.normalizeSlots(dto);
    const now = new Date();
    const created = await this.prisma.$transaction(async (tx) => {
      const reg = await tx.buddhistServiceReg.create({
        data: {
          ...this.toData(
            tenantId,
            dto,
            slots,
            dto.registrationDate ? new Date(dto.registrationDate) : now,
            actorId,
          ),
          createdBy: actorId,
        },
        include: INCLUDE,
      });
      await tx.auditLog.create({
        data: this.auditData(
          tenantId,
          actorId,
          'buddhist_service.create',
          reg.id,
          {
            after: this.snapshot(reg),
          },
        ),
      });
      return reg;
    });
    return this.toView(created);
  }

  async update(
    tenantId: bigint,
    actorId: bigint,
    id: bigint,
    dto: UpdateBuddhistServiceDto,
  ): Promise<BuddhistServiceView> {
    const before = await this.prisma.buddhistServiceReg.findFirst({
      where: { id, tenantId, isDeleted: false },
      include: INCLUDE,
    });
    if (!before) throw new NotFoundException('불사 신청을 찾을 수 없습니다');
    await this.resolveEnshrinementByDate(tenantId, actorId, dto);
    await this.assertRefs(tenantId, dto);
    const slots = this.normalizeSlots(dto);
    const updated = await this.prisma.$transaction(async (tx) => {
      const reg = await tx.buddhistServiceReg.update({
        where: { id },
        data: {
          ...this.toData(
            tenantId,
            dto,
            slots,
            dto.registrationDate
              ? new Date(dto.registrationDate)
              : before.registrationDate,
            actorId,
          ),
          // 전체교체(PUT) 보정 — DTO 에 없는 필드가 소실되지 않도록 기존 값 보존:
          //  · 접수사원: DTO 미전송 시 기존 staffId 유지(UI 에 편집 필드 없음)
          staffId: dto.staffId ? BigInt(dto.staffId) : before.staffId,
          //  · 취소일자: 이미 취소된 건을 계속 취소로 두면 원 취소일·취소자 보존(오늘로 리셋 방지)
          ...(before.isCanceled && (dto.isCanceled ?? false)
            ? { canceledAt: before.canceledAt, canceledBy: before.canceledBy }
            : {}),
          updatedBy: actorId,
        },
        include: INCLUDE,
      });
      await tx.auditLog.create({
        data: this.auditData(
          tenantId,
          actorId,
          'buddhist_service.update',
          reg.id,
          {
            before: this.snapshot(before),
            after: this.snapshot(reg),
          },
        ),
      });
      return reg;
    });
    return this.toView(updated);
  }

  async list(tenantId: bigint, q: QueryBuddhistServicesDto) {
    const where: Prisma.BuddhistServiceRegWhereInput = {
      tenantId,
      isDeleted: false,
    };
    if (q.memberId) where.memberId = BigInt(q.memberId);
    if (q.buddhistServiceItemId)
      where.buddhistServiceItemId = BigInt(q.buddhistServiceItemId);
    if (q.enshrinementEventId)
      where.enshrinementEventId = BigInt(q.enshrinementEventId);
    if (q.includeCanceled !== 'true') where.isCanceled = false;
    const [rows, total] = await Promise.all([
      this.prisma.buddhistServiceReg.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ [q.sort]: q.order }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.buddhistServiceReg.count({ where }),
    ]);
    return {
      items: rows.map((r) => this.toView(r)),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  /** 내보내기용 — 페이지네이션 없이 필터 결과 전체. */
  async listForExport(
    tenantId: bigint,
    q: QueryBuddhistServicesDto,
  ): Promise<BuddhistServiceView[]> {
    const where: Prisma.BuddhistServiceRegWhereInput = {
      tenantId,
      isDeleted: false,
    };
    if (q.memberId) where.memberId = BigInt(q.memberId);
    if (q.buddhistServiceItemId)
      where.buddhistServiceItemId = BigInt(q.buddhistServiceItemId);
    if (q.enshrinementEventId)
      where.enshrinementEventId = BigInt(q.enshrinementEventId);
    if (q.includeCanceled !== 'true') where.isCanceled = false;
    const rows = await this.prisma.buddhistServiceReg.findMany({
      where,
      include: INCLUDE,
      orderBy: [{ [q.sort]: q.order }],
    });
    return rows.map((r) => this.toView(r));
  }

  async getById(tenantId: bigint, id: bigint): Promise<BuddhistServiceView> {
    const reg = await this.prisma.buddhistServiceReg.findFirst({
      where: { id, tenantId, isDeleted: false },
      include: INCLUDE,
    });
    if (!reg) throw new NotFoundException('불사 신청을 찾을 수 없습니다');
    return this.toView(reg);
  }

  async softDelete(
    tenantId: bigint,
    actorId: bigint,
    id: bigint,
  ): Promise<void> {
    const before = await this.prisma.buddhistServiceReg.findFirst({
      where: { id, tenantId, isDeleted: false },
      include: INCLUDE,
    });
    if (!before) throw new NotFoundException('불사 신청을 찾을 수 없습니다');
    await this.prisma.$transaction(async (tx) => {
      await tx.buddhistServiceReg.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date(), updatedBy: actorId },
      });
      await tx.auditLog.create({
        data: this.auditData(tenantId, actorId, 'buddhist_service.delete', id, {
          before: this.snapshot(before),
        }),
      });
    });
  }

  /** 참조 무결성 검증 — 회원·불사목록(필수), 봉안일·간지·사원(선택). 불사목록 행 반환. */
  /**
   * 봉안일 날짜 → 이벤트 find-or-create (KST 기준). enshrinementDate 가 있고 명시적
   * enshrinementEventId 가 없으면, 그 날짜(솔라)의 봉안일 이벤트를 찾거나 만들어
   * dto.enshrinementEventId 를 채운다. "봉안일 = 날짜" UX + 같은 날짜는 공유 이벤트로 수렴.
   */
  private async resolveEnshrinementByDate(
    tenantId: bigint,
    actorId: bigint,
    dto: CreateBuddhistServiceDto,
  ): Promise<void> {
    if (dto.enshrinementEventId || !dto.enshrinementDate) return;
    const ymd = dto.enshrinementDate.slice(0, 10);
    const dayStart = new Date(`${ymd}T00:00:00+09:00`); // KST 자정(서버 TZ 무관)
    if (Number.isNaN(dayStart.getTime()))
      throw new BadRequestException(
        `봉안일 날짜 형식 오류: ${dto.enshrinementDate}`,
      );
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const existing = await this.prisma.enshrinementEvent.findFirst({
      where: {
        tenantId,
        isDeleted: false,
        eventDateSolar: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { eventDateSolar: 'asc' },
    });
    dto.enshrinementEventId = existing
      ? existing.id.toString()
      : (
          await this.prisma.enshrinementEvent.create({
            data: { tenantId, eventDateSolar: dayStart, createdBy: actorId },
          })
        ).id.toString();
  }

  private async assertRefs(
    tenantId: bigint,
    dto: CreateBuddhistServiceDto,
  ): Promise<{ serviceTypeCode: string | null }> {
    const member = await this.prisma.member.findFirst({
      where: { id: BigInt(dto.memberId), tenantId, isDeleted: false },
    });
    if (!member)
      throw new BadRequestException(`존재하지 않는 회원: ${dto.memberId}`);
    const item = await this.prisma.buddhistServiceItem.findFirst({
      where: {
        id: BigInt(dto.buddhistServiceItemId),
        tenantId,
        isDeleted: false,
      },
      select: { serviceTypeCode: true },
    });
    if (!item)
      throw new BadRequestException(
        `존재하지 않는 불사목록: ${dto.buddhistServiceItemId}`,
      );
    if (dto.enshrinementEventId) {
      const e = await this.prisma.enshrinementEvent.findFirst({
        where: {
          id: BigInt(dto.enshrinementEventId),
          tenantId,
          isDeleted: false,
        },
      });
      if (!e)
        throw new BadRequestException(
          `존재하지 않는 봉안일: ${dto.enshrinementEventId}`,
        );
    }
    if (dto.sexagenaryYearId) {
      const s = await this.prisma.sexagenaryYear.findFirst({
        where: { id: BigInt(dto.sexagenaryYearId), tenantId },
      });
      if (!s)
        throw new BadRequestException(
          `존재하지 않는 육십갑자: ${dto.sexagenaryYearId}`,
        );
    }
    if (dto.staffId) {
      const st = await this.prisma.staff.findFirst({
        where: { id: BigInt(dto.staffId), tenantId, isDeleted: false },
      });
      if (!st)
        throw new BadRequestException(`존재하지 않는 사원: ${dto.staffId}`);
    }
    return item;
  }

  private normalizeSlots(dto: CreateBuddhistServiceDto): PersonSlots {
    return {
      bogwija: dto.bogwija,
      relationship: dto.relationship,
      bokjunja: dto.bokjunja,
      spiritual: dto.spiritual
        ? normalizeSpiritual(dto.spiritual)
        : dto.spiritual,
      yesujae: dto.yesujae,
      seongju12: dto.seongju12
        ? normalizeSeongju12(dto.seongju12)
        : dto.seongju12,
    };
  }

  private toData(
    tenantId: bigint,
    dto: CreateBuddhistServiceDto,
    slots: PersonSlots,
    registrationDate: Date,
    actorId: bigint,
  ): Prisma.BuddhistServiceRegUncheckedCreateInput {
    const now = new Date();
    const cancel = applyCancel(dto.isCanceled ?? false, now, actorId);
    const cert = applyCertificate(
      dto.isCertificateIssued ?? false,
      now,
      dto.certificateIssuedDate
        ? new Date(dto.certificateIssuedDate)
        : undefined,
    );
    return {
      tenantId,
      registrationDate,
      memberId: BigInt(dto.memberId),
      buddhistServiceItemId: BigInt(dto.buddhistServiceItemId),
      enshrinementEventId: dto.enshrinementEventId
        ? BigInt(dto.enshrinementEventId)
        : null,
      staffId: dto.staffId ? BigInt(dto.staffId) : null,
      sexagenaryYearId: dto.sexagenaryYearId
        ? BigInt(dto.sexagenaryYearId)
        : null,
      altarNumber: dto.altarNumber
        ? normalizeAltarNumber(dto.altarNumber)
        : null,
      bogwija: dto.bogwija ?? null,
      relationship: dto.relationship ?? null,
      bokjunja: dto.bokjunja ?? null,
      spiritual: slots.spiritual ?? null,
      yesujae: dto.yesujae ?? null,
      seongju12: slots.seongju12 ?? null,
      donationAmount: dto.donationAmount
        ? new Prisma.Decimal(dto.donationAmount)
        : null,
      memo: dto.memo ?? null,
      ...cancel,
      ...cert,
    };
  }

  private auditData(
    tenantId: bigint,
    actorId: bigint,
    actionType: string,
    entityId: bigint,
    json: { before?: Prisma.InputJsonValue; after?: Prisma.InputJsonValue },
  ): Prisma.AuditLogUncheckedCreateInput {
    return {
      tenantId,
      userAccountId: actorId,
      actionType,
      entityName: 'BuddhistServiceReg',
      entityId: entityId.toString(),
      beforeJson: json.before,
      afterJson: json.after,
    };
  }

  private toView(r: RegRow): BuddhistServiceView {
    return {
      id: r.id.toString(),
      registrationDate: r.registrationDate,
      memberId: r.memberId.toString(),
      memberName: r.member?.memberName ?? null,
      buddhistServiceItemId: r.buddhistServiceItemId.toString(),
      buddhistServiceItemName: r.buddhistServiceItem?.name ?? null,
      enshrinementEventId: r.enshrinementEventId?.toString() ?? null,
      enshrinementLabel: r.enshrinementEvent?.label ?? null,
      staffId: r.staffId?.toString() ?? null,
      staffName: r.staff?.staffNameKo ?? null,
      altarNumber: r.altarNumber,
      bogwija: r.bogwija,
      relationship: r.relationship,
      bokjunja: r.bokjunja,
      spiritual: r.spiritual,
      yesujae: r.yesujae,
      seongju12: r.seongju12,
      sexagenaryYearId: r.sexagenaryYearId?.toString() ?? null,
      donationAmount: r.donationAmount?.toString() ?? null,
      memo: r.memo,
      isCanceled: r.isCanceled,
      canceledAt: r.canceledAt,
      isCertificateIssued: r.isCertificateIssued,
      certificateIssuedDate: r.certificateIssuedDate,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private snapshot(r: RegRow): Prisma.InputJsonValue {
    return {
      id: r.id.toString(),
      memberId: r.memberId.toString(),
      buddhistServiceItemId: r.buddhistServiceItemId.toString(),
      altarNumber: r.altarNumber,
      isCanceled: r.isCanceled,
      isCertificateIssued: r.isCertificateIssued,
    };
  }
}
