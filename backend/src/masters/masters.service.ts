import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MissionaryDto, ServiceItemDto } from './dto/master.dto';

/**
 * MastersService — 마스터 조회 + CRUD (E1.x). 포교원장/불사목록/슬롯규칙/육십갑자/역할.
 * 전 쿼리 Prisma 파라미터화. 드롭다운은 활성/비삭제만. 쓰기는 감사 적재.
 */
@Injectable()
export class MastersService {
  constructor(private readonly prisma: PrismaService) {}

  /** 관리자 화면용 전체 목록(비삭제, 비활성 포함). */
  async missionariesAll(tenantId: bigint) {
    const rows = await this.prisma.missionary.findMany({
      where: { tenantId, isDeleted: false },
      orderBy: [{ name: 'asc' }],
    });
    return rows.map((r) => ({
      id: r.id.toString(),
      name: r.name,
      phone: r.phone,
      address: r.address,
      addressDetail: r.addressDetail,
      isActive: r.isActive,
    }));
  }

  async createMissionary(
    tenantId: bigint,
    actorId: bigint,
    dto: MissionaryDto,
  ) {
    const m = await this.prisma.missionary.create({
      data: {
        tenantId,
        name: dto.name,
        phone: dto.phone ?? null,
        address: dto.address ?? null,
        addressDetail: dto.addressDetail ?? null,
        createdBy: actorId,
      },
    });
    await this.audit(
      tenantId,
      actorId,
      'missionary.create',
      'Missionary',
      m.id,
    );
    return { id: m.id.toString(), name: m.name };
  }

  async updateMissionary(
    tenantId: bigint,
    actorId: bigint,
    id: bigint,
    dto: MissionaryDto,
  ) {
    const exist = await this.prisma.missionary.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!exist) throw new NotFoundException('포교원장을 찾을 수 없습니다');
    const m = await this.prisma.missionary.update({
      where: { id },
      data: {
        name: dto.name,
        phone: dto.phone ?? null,
        address: dto.address ?? null,
        addressDetail: dto.addressDetail ?? null,
        isActive: dto.isActive ?? undefined,
        updatedBy: actorId,
      },
    });
    await this.audit(tenantId, actorId, 'missionary.update', 'Missionary', id);
    return { id: m.id.toString(), name: m.name };
  }

  async deleteMissionary(tenantId: bigint, actorId: bigint, id: bigint) {
    const exist = await this.prisma.missionary.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!exist) throw new NotFoundException('포교원장을 찾을 수 없습니다');
    await this.prisma.missionary.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), updatedBy: actorId },
    });
    await this.audit(tenantId, actorId, 'missionary.delete', 'Missionary', id);
  }

  async serviceItemsAll(tenantId: bigint) {
    const rows = await this.prisma.buddhistServiceItem.findMany({
      where: { tenantId, isDeleted: false },
      orderBy: [{ name: 'asc' }],
    });
    // 사용 건수(불사 신청에서 참조) — 사용중이면 UI 에서 삭제 버튼을 숨긴다.
    const counts = await this.prisma.buddhistServiceReg.groupBy({
      by: ['buddhistServiceItemId'],
      where: { tenantId, isDeleted: false },
      _count: { _all: true },
    });
    const usage = new Map(
      counts.map((c) => [c.buddhistServiceItemId.toString(), c._count._all]),
    );
    return rows.map((r) => ({
      id: r.id.toString(),
      name: r.name,
      serviceTypeCode: r.serviceTypeCode,
      referenceAmount: r.referenceAmount?.toString() ?? null,
      description: r.description,
      photoUrl: r.photoUrl,
      isActive: r.isActive,
      usageCount: usage.get(r.id.toString()) ?? 0,
    }));
  }

  async createServiceItem(
    tenantId: bigint,
    actorId: bigint,
    dto: ServiceItemDto,
  ) {
    const it = await this.prisma.buddhistServiceItem.create({
      data: {
        tenantId,
        name: dto.name,
        serviceTypeCode: dto.serviceTypeCode ?? null,
        referenceAmount: dto.referenceAmount
          ? new Prisma.Decimal(dto.referenceAmount)
          : null,
        description: dto.description ?? null,
        photoUrl: dto.photoUrl ?? null,
        createdBy: actorId,
      },
    });
    await this.audit(
      tenantId,
      actorId,
      'service_item.create',
      'BuddhistServiceItem',
      it.id,
    );
    return { id: it.id.toString(), name: it.name };
  }

  async updateServiceItem(
    tenantId: bigint,
    actorId: bigint,
    id: bigint,
    dto: ServiceItemDto,
  ) {
    const exist = await this.prisma.buddhistServiceItem.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!exist) throw new NotFoundException('불사목록을 찾을 수 없습니다');
    const it = await this.prisma.buddhistServiceItem.update({
      where: { id },
      data: {
        name: dto.name,
        serviceTypeCode: dto.serviceTypeCode ?? null,
        referenceAmount: dto.referenceAmount
          ? new Prisma.Decimal(dto.referenceAmount)
          : null,
        description: dto.description ?? null,
        photoUrl: dto.photoUrl ?? null,
        isActive: dto.isActive ?? undefined,
        updatedBy: actorId,
      },
    });
    await this.audit(
      tenantId,
      actorId,
      'service_item.update',
      'BuddhistServiceItem',
      id,
    );
    return { id: it.id.toString(), name: it.name };
  }

  async deleteServiceItem(tenantId: bigint, actorId: bigint, id: bigint) {
    const exist = await this.prisma.buddhistServiceItem.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!exist) throw new NotFoundException('불사목록을 찾을 수 없습니다');
    // 사용 중(불사 신청에 참조됨)이면 삭제 차단 — 데이터 무결성.
    const inUse = await this.prisma.buddhistServiceReg.count({
      where: { buddhistServiceItemId: id, tenantId, isDeleted: false },
    });
    if (inUse > 0) {
      throw new ConflictException(
        `이 불사목록은 불사 신청 ${inUse}건에서 사용 중이라 삭제할 수 없습니다. (미사용 처리를 권장)`,
      );
    }
    await this.prisma.buddhistServiceItem.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), updatedBy: actorId },
    });
    await this.audit(
      tenantId,
      actorId,
      'service_item.delete',
      'BuddhistServiceItem',
      id,
    );
  }

  /** 역할 + 권한 매트릭스(관리자 화면 read). */
  async roles(tenantId: bigint) {
    const rows = await this.prisma.role.findMany({
      where: { tenantId },
      orderBy: [{ code: 'asc' }],
      include: {
        perms: {
          include: { permission: { select: { resource: true, action: true } } },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id.toString(),
      code: r.code,
      name: r.name,
      permissions: r.perms.map(
        (p) => `${p.permission.resource}:${p.permission.action}`,
      ),
    }));
  }

  private async audit(
    tenantId: bigint,
    actorId: bigint,
    actionType: string,
    entityName: string,
    id: bigint,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userAccountId: actorId,
        actionType,
        entityName,
        entityId: id.toString(),
      },
    });
  }

  async missionaries(tenantId: bigint) {
    const rows = await this.prisma.missionary.findMany({
      where: { tenantId, isDeleted: false, isActive: true },
      orderBy: [{ name: 'asc' }],
      select: { id: true, name: true },
    });
    return rows.map((r) => ({ id: r.id.toString(), name: r.name }));
  }

  async buddhistServiceItems(tenantId: bigint) {
    const rows = await this.prisma.buddhistServiceItem.findMany({
      where: { tenantId, isDeleted: false, isActive: true },
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        name: true,
        serviceTypeCode: true,
        referenceAmount: true,
      },
    });
    return rows.map((r) => ({
      id: r.id.toString(),
      name: r.name,
      serviceTypeCode: r.serviceTypeCode,
      referenceAmount: r.referenceAmount?.toString() ?? null,
    }));
  }

  /** 불사목록의 서비스 타입 슬롯 규칙(노출/필수/라벨). 미설정 시 전 슬롯 폴백은 프런트에서 처리. */
  async slotRulesForItem(tenantId: bigint, itemId: bigint) {
    const item = await this.prisma.buddhistServiceItem.findFirst({
      where: { id: itemId, tenantId, isDeleted: false },
      select: { serviceTypeCode: true },
    });
    if (!item?.serviceTypeCode) return { serviceTypeCode: null, rules: [] };
    const rules = await this.prisma.serviceTypeSlotRule.findMany({
      where: { tenantId, serviceTypeCode: item.serviceTypeCode },
      orderBy: [{ sortOrder: 'asc' }],
      select: {
        slotKey: true,
        isVisible: true,
        isRequired: true,
        labelOverride: true,
        sortOrder: true,
      },
    });
    return { serviceTypeCode: item.serviceTypeCode, rules };
  }

  async sexagenaryYears(tenantId: bigint) {
    const rows = await this.prisma.sexagenaryYear.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ code: 'asc' }],
      select: { id: true, code: true, ganjiNameKo: true },
    });
    return rows.map((r) => ({
      id: r.id.toString(),
      code: r.code,
      ganjiNameKo: r.ganjiNameKo,
    }));
  }
}
