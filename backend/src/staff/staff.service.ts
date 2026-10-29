import { Injectable, NotFoundException } from '@nestjs/common';
import type { Staff } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto.service';
import { StaffDto } from './dto/staff.dto';

export interface StaffView {
  id: string;
  staffNameKo: string;
  staffNameEn: string | null;
  positionCode: string | null;
  dutyCode: string | null;
  jobGroupCode: string | null;
  staffDivCode: string | null;
  appellationDivCode: string | null;
  solarLunarCode: string | null;
  authLevelCode: string | null;
  birthDate: string | null;
  joinDate: string | null;
  retireDate: string | null;
  smsReceiveYn: boolean | null;
  photoUrl: string | null;
  juminMasked: string | null;
  isWorking: boolean;
}

/**
 * StaffService — 사원 CRUD (DM-08). 주민번호는 암호화 저장·화면 마스킹, 복호화는 감사 적재.
 * 평문/마스킹 외 노출 금지(NFR-SEC, FR-HR-03).
 */
@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async list(tenantId: bigint): Promise<StaffView[]> {
    const rows = await this.prisma.staff.findMany({
      where: { tenantId, isDeleted: false },
      orderBy: [{ staffNameKo: 'asc' }],
    });
    return rows.map((s) => this.toView(s));
  }

  async create(
    tenantId: bigint,
    actorId: bigint,
    dto: StaffDto,
  ): Promise<StaffView> {
    const s = await this.prisma.staff.create({
      data: { tenantId, ...this.toData(dto), createdBy: actorId },
    });
    await this.audit(tenantId, actorId, 'staff.create', s.id);
    return this.toView(s);
  }

  async update(
    tenantId: bigint,
    actorId: bigint,
    id: bigint,
    dto: StaffDto,
  ): Promise<StaffView> {
    const exist = await this.prisma.staff.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!exist) throw new NotFoundException('사원을 찾을 수 없습니다');
    const s = await this.prisma.staff.update({
      where: { id },
      data: { ...this.toData(dto), updatedBy: actorId },
    });
    await this.audit(tenantId, actorId, 'staff.update', id);
    return this.toView(s);
  }

  async softDelete(
    tenantId: bigint,
    actorId: bigint,
    id: bigint,
  ): Promise<void> {
    const exist = await this.prisma.staff.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!exist) throw new NotFoundException('사원을 찾을 수 없습니다');
    await this.prisma.staff.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), updatedBy: actorId },
    });
    await this.audit(tenantId, actorId, 'staff.delete', id);
  }

  /** 주민번호 복호화 — 접근 자체를 감사 적재(NFR-SEC-17). */
  async revealJumin(
    tenantId: bigint,
    actorId: bigint,
    id: bigint,
  ): Promise<{ jumin: string | null }> {
    const s = await this.prisma.staff.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!s) throw new NotFoundException('사원을 찾을 수 없습니다');
    await this.audit(tenantId, actorId, 'staff.pii_access', id);
    if (!s.juminNoEnc) return { jumin: null };
    return { jumin: this.crypto.decrypt(Buffer.from(s.juminNoEnc)) };
  }

  /** DTO → 설정 가능한 컬럼(테넌트/감사 제외). 주민번호가 있으면 암호화+마스킹. */
  private toData(dto: StaffDto) {
    let jumin = {};
    if (dto.jumin) {
      const enc = this.crypto.encrypt(dto.jumin);
      const bytes = new Uint8Array(enc.byteLength); // Uint8Array<ArrayBuffer>
      bytes.set(enc);
      jumin = { juminNoEnc: bytes, juminNoMasked: this.crypto.mask(dto.jumin) };
    }
    return {
      staffNameKo: dto.staffNameKo,
      staffNameEn: dto.staffNameEn ?? null,
      positionCode: dto.positionCode ?? null,
      dutyCode: dto.dutyCode ?? null,
      jobGroupCode: dto.jobGroupCode ?? null,
      staffDivCode: dto.staffDivCode ?? null,
      appellationDivCode: dto.appellationDivCode ?? null,
      solarLunarCode: dto.solarLunarCode ?? null,
      authLevelCode: dto.authLevelCode ?? null,
      birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
      joinDate: dto.joinDate ? new Date(dto.joinDate) : null,
      retireDate: dto.retireDate ? new Date(dto.retireDate) : null,
      smsReceiveYn: dto.smsReceiveYn ?? null,
      photoUrl: dto.photoUrl ?? null,
      isWorking: dto.isWorking ?? true,
      ...jumin,
    };
  }

  private toView(s: Staff): StaffView {
    const d = (x: Date | null) => (x ? x.toISOString().slice(0, 10) : null);
    return {
      id: s.id.toString(),
      staffNameKo: s.staffNameKo,
      staffNameEn: s.staffNameEn,
      positionCode: s.positionCode,
      dutyCode: s.dutyCode,
      jobGroupCode: s.jobGroupCode,
      staffDivCode: s.staffDivCode,
      appellationDivCode: s.appellationDivCode,
      solarLunarCode: s.solarLunarCode,
      authLevelCode: s.authLevelCode,
      birthDate: d(s.birthDate),
      joinDate: d(s.joinDate),
      retireDate: d(s.retireDate),
      smsReceiveYn: s.smsReceiveYn,
      photoUrl: s.photoUrl,
      juminMasked: s.juminNoMasked,
      isWorking: s.isWorking,
    };
  }

  private async audit(
    tenantId: bigint,
    actorId: bigint,
    actionType: string,
    id: bigint,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userAccountId: actorId,
        actionType,
        entityName: 'Staff',
        entityId: id.toString(),
      },
    });
  }
}
