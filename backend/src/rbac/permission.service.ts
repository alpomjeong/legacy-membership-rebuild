import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * PermissionService — 역할 코드 집합 → 권한 코드 집합 해소 (DB 기반, 데이터로 관리).
 * 역할→권한 매핑을 서버에서 조회하여 토큰 갱신 시 역할 변경이 반영되게 한다(FR-AUTH-20).
 */
@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  async permissionsForRoles(roleCodes: string[]): Promise<Set<string>> {
    if (!roleCodes || roleCodes.length === 0) return new Set<string>();
    const rows = await this.prisma.permission.findMany({
      where: { roles: { some: { role: { code: { in: roleCodes } } } } },
      select: { code: true },
    });
    return new Set(rows.map((r) => r.code));
  }
}
