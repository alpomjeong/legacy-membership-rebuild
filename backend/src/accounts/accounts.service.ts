import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../auth/password.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';

export interface AccountView {
  id: string;
  loginId: string;
  staffId: string | null;
  staffName: string | null;
  isActive: boolean;
  mustResetPassword: boolean;
  locked: boolean;
  lastLoginAt: string | null;
  roleIds: string[];
  roleNames: string;
  activeSessions: number;
}

const INCLUDE = {
  staff: { select: { staffNameKo: true } },
  roles: { include: { role: { select: { id: true, name: true } } } },
} as const;

/**
 * AccountsService — 로그인 계정 발급/관리 (FR-AUTH-13, FR-HR-05/06).
 * 임시 비밀번호 자동발급(평문은 응답 1회만), 최초 로그인 변경 강제, 역할 할당, 활성/잠금 관리.
 */
@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  async list(tenantId: bigint): Promise<AccountView[]> {
    const now = new Date();
    const [rows, counts] = await Promise.all([
      this.prisma.userAccount.findMany({
        where: { tenantId, isDeleted: false },
        orderBy: [{ loginId: 'asc' }],
        include: INCLUDE,
      }),
      this.prisma.refreshSession.groupBy({
        by: ['userAccountId'],
        where: { tenantId, revokedAt: null, expiresAt: { gt: now } },
        _count: { _all: true },
      }),
    ]);
    const sessionMap = new Map(
      counts.map((c) => [c.userAccountId.toString(), c._count._all]),
    );
    return rows.map((a) => ({
      id: a.id.toString(),
      loginId: a.loginId,
      staffId: a.staffId?.toString() ?? null,
      staffName: a.staff?.staffNameKo ?? null,
      isActive: a.isActive,
      mustResetPassword: a.mustResetPassword,
      locked: !!a.lockedUntil && a.lockedUntil > now,
      lastLoginAt: a.lastLoginAt ? a.lastLoginAt.toISOString() : null,
      roleIds: a.roles.map((ur) => ur.role.id.toString()),
      roleNames: a.roles.map((ur) => ur.role.name).join(', '),
      activeSessions: sessionMap.get(a.id.toString()) ?? 0,
    }));
  }

  /** 강제 로그아웃 — 계정의 활성 세션 전부 폐기(잠금 해제는 별도). */
  async forceLogout(
    tenantId: bigint,
    actorId: bigint,
    id: bigint,
  ): Promise<{ revoked: number }> {
    const account = await this.prisma.userAccount.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!account) throw new NotFoundException('계정을 찾을 수 없습니다');
    const res = await this.prisma.refreshSession.updateMany({
      where: { userAccountId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    // 이미 발급된 access 토큰도 다음 요청부터 즉시 거부(JwtStrategy 컷오프).
    await this.prisma.userAccount.update({
      where: { id },
      data: { accessInvalidBefore: new Date() },
    });
    await this.audit(tenantId, actorId, 'account.force_logout', id);
    return { revoked: res.count };
  }

  async create(
    tenantId: bigint,
    actorId: bigint,
    dto: CreateAccountDto,
  ): Promise<{ id: string; loginId: string; tempPassword: string }> {
    const exists = await this.prisma.userAccount.findFirst({
      where: { tenantId, loginId: dto.loginId, isDeleted: false },
    });
    if (exists)
      throw new BadRequestException('이미 사용 중인 로그인 ID 입니다.');
    if (dto.staffId) {
      const linked = await this.prisma.userAccount.findFirst({
        where: { staffId: BigInt(dto.staffId), isDeleted: false },
      });
      if (linked)
        throw new BadRequestException('해당 사원에 이미 계정이 있습니다.');
    }
    const tempPassword = this.genTempPassword();
    const passwordHash = await this.passwordService.hash(tempPassword);
    const account = await this.prisma.$transaction(async (tx) => {
      const a = await tx.userAccount.create({
        data: {
          tenantId,
          loginId: dto.loginId,
          passwordHash,
          staffId: dto.staffId ? BigInt(dto.staffId) : null,
          mustResetPassword: true,
        },
      });
      for (const rid of dto.roleIds) {
        await tx.userRole.create({
          data: { userAccountId: a.id, roleId: BigInt(rid) },
        });
      }
      return a;
    });
    await this.audit(tenantId, actorId, 'account.create', account.id);
    return {
      id: account.id.toString(),
      loginId: account.loginId,
      tempPassword,
    };
  }

  async update(
    tenantId: bigint,
    actorId: bigint,
    id: bigint,
    dto: UpdateAccountDto,
  ): Promise<void> {
    const account = await this.prisma.userAccount.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!account) throw new NotFoundException('계정을 찾을 수 없습니다');
    await this.prisma.$transaction(async (tx) => {
      if (dto.isActive !== undefined) {
        await tx.userAccount.update({
          where: { id },
          data: {
            isActive: dto.isActive,
            // 비활성화는 발급된 access 토큰도 즉시 무효(재활성 시엔 미적용).
            ...(dto.isActive === false
              ? { accessInvalidBefore: new Date() }
              : {}),
          },
        });
      }
      if (dto.roleIds) {
        await tx.userRole.deleteMany({ where: { userAccountId: id } });
        for (const rid of dto.roleIds) {
          await tx.userRole.create({
            data: { userAccountId: id, roleId: BigInt(rid) },
          });
        }
      }
    });
    // 비활성화 시 활성 세션 전부 폐기(강제 로그아웃).
    if (dto.isActive === false) {
      await this.prisma.refreshSession.updateMany({
        where: { userAccountId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await this.audit(tenantId, actorId, 'account.update', id);
  }

  /** 비밀번호 초기화 — 임시 비번 재발급·잠금 해제·최초 변경 강제. */
  async resetPassword(
    tenantId: bigint,
    actorId: bigint,
    id: bigint,
  ): Promise<{ tempPassword: string }> {
    const account = await this.prisma.userAccount.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!account) throw new NotFoundException('계정을 찾을 수 없습니다');
    const tempPassword = this.genTempPassword();
    const passwordHash = await this.passwordService.hash(tempPassword);
    await this.prisma.userAccount.update({
      where: { id },
      data: {
        passwordHash,
        mustResetPassword: true,
        failedLoginCount: 0,
        lockedUntil: null,
        accessInvalidBefore: new Date(),
      },
    });
    // 비번 초기화 시 기존 세션 전부 폐기.
    await this.prisma.refreshSession.updateMany({
      where: { userAccountId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit(tenantId, actorId, 'account.reset_password', id);
    return { tempPassword };
  }

  /** 혼동문자(0/O/1/l/I) 제외 10자 임시 비밀번호. */
  private genTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const buf = randomBytes(10);
    let s = '';
    for (let i = 0; i < 10; i++) s += chars[buf[i] % chars.length];
    return s;
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
        entityName: 'UserAccount',
        entityId: id.toString(),
      },
    });
  }
}
