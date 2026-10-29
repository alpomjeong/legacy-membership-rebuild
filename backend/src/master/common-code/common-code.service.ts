import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommonCodeDto } from './dto/create-common-code.dto';
import { UpdateCommonCodeDto } from './dto/update-common-code.dto';

/**
 * CommonCodeService — 공통코드(그룹/값 2단계) CRUD (E0.6, FR-MST-01/02).
 * 드롭다운 조회는 isActive=true 만, sortOrder→code 정렬. 비활성은 소프트(isActive=false)로
 * 기존 참조를 보존한다. 모든 쿼리는 Prisma 파라미터 바인딩(인라인 문자열 SQL 금지).
 */
@Injectable()
export class CommonCodeService {
  constructor(private readonly prisma: PrismaService) {}

  listByGroup(tenantId: bigint, groupCode: string, includeInactive = false) {
    return this.prisma.commonCode.findMany({
      where: {
        tenantId,
        groupCode,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }

  async create(tenantId: bigint, dto: CreateCommonCodeDto) {
    // (tenantId, groupCode, code) 유니크 — 비활성(삭제)된 동일 코드는 복원·갱신하고,
    // 활성 중복은 P2002(500) 대신 명시적 Conflict 로 거부한다.
    const existing = await this.prisma.commonCode.findUnique({
      where: {
        tenantId_groupCode_code: {
          tenantId,
          groupCode: dto.groupCode,
          code: dto.code,
        },
      },
    });
    if (existing) {
      if (existing.isActive) {
        throw new ConflictException(
          `이미 존재하는 코드입니다 — ${dto.groupCode}/${dto.code}. 다른 코드를 사용하세요.`,
        );
      }
      return this.prisma.commonCode.update({
        where: { id: existing.id },
        data: { ...dto, isActive: true },
      });
    }
    return this.prisma.commonCode.create({ data: { tenantId, ...dto } });
  }

  update(id: bigint, dto: UpdateCommonCodeDto) {
    return this.prisma.commonCode.update({ where: { id }, data: dto });
  }

  /** 소프트 비활성 — 기존 참조 보존(FR-MST-02). */
  deactivate(id: bigint) {
    return this.prisma.commonCode.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
