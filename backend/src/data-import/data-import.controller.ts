import {
  BadRequestException,
  Controller,
  Get,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { parseXlsxBuffer } from '@infrastructure/excel/workbook-reader';
import { buildSheet } from '@infrastructure/excel/sheet-export';
import {
  DataImportService,
  BUDDHIST_SERVICE_EXPORT_COLUMNS,
} from './data-import.service';
import { StorageService } from '../storage/storage.service';
import { RequirePermissions } from '../rbac/decorators';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { CurrentUser, actorIdOf } from '../common/current-user.decorator';

interface UploadedXlsx {
  buffer: Buffer;
  originalname?: string;
}

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * 불사 건 일괄 업로드 API (E1.8, FR-MIG-*). .xlsx 업로드 → 검증·트랜잭션 적재 → 리포트. RBAC 서버 강제.
 * 회원 정보(신청자·소속·포교원장·생년월일)는 불사 시트에 동봉돼 회원 자동생성/연결로 반영된다.
 * 독립 '회원 엑셀 업로드'는 폐기 — 실무상 회원정보만 온전히 오는 경우가 없고 회원현황판에서 처리.
 */
@ApiTags('data-import')
@ApiBearerAuth()
@Controller('data/import')
export class DataImportController {
  private readonly tenantId = 1n;

  constructor(
    private readonly service: DataImportService,
    private readonly storage: StorageService,
  ) {}

  /** 불사 건 일괄 업로드 — 레거시 엑셀 정리본 이관(.bak 대체 경로). */
  @Post('buddhist-services')
  @RequirePermissions('buddhist_service:create')
  @UseInterceptors(FileInterceptor('file'))
  async importBuddhistServices(
    @UploadedFile() file: UploadedXlsx | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { buffer, originalKey } = await this.gateAndArchive(file);
    const rows = await parseXlsxBuffer(buffer);
    const report = await this.service.importBuddhistServices(
      this.tenantId,
      actorIdOf(user),
      rows,
    );
    return { ...report, originalKey };
  }

  /**
   * 불사 건 전체 추출(.xlsx) — 업로드 양식과 동일 컬럼이라 그대로 재업로드 가능(왕복).
   * 백업(pg_dump)이 정본이고, 이건 사람이 열어보거나 오프라인 확인용 보조 수단.
   */
  @Get('buddhist-services/export')
  @RequirePermissions('buddhist_service:export')
  async exportBuddhistServices(): Promise<StreamableFile> {
    const rows = await this.service.exportBuddhistServices(this.tenantId);
    const buf = await buildSheet(
      '불사건',
      BUDDHIST_SERVICE_EXPORT_COLUMNS,
      rows,
    );
    return new StreamableFile(buf, {
      type: XLSX_MIME,
      disposition: 'attachment; filename="buddhist-services-full.xlsx"',
    });
  }

  /**
   * 업무 데이터 초기화 — 실서비스 전환/이관 전 정리(파괴적, migration:run 관리자 전용).
   * 보존: 계정·RBAC·공통코드·불사목록(마스터)·감사로그 / 삭제: 회원·불사 건·봉안일·상담·포교원장·사원 등.
   */
  @Post('reset')
  @RequirePermissions('migration:run')
  async resetBusiness(@CurrentUser() user: AuthenticatedUser) {
    return this.service.resetBusinessData(this.tenantId, actorIdOf(user));
  }

  /** 공통 게이트(.xlsx만) + 원본 격리 저장(FR-MIG-14, 실패해도 적재 진행). */
  private async gateAndArchive(
    file: UploadedXlsx | undefined,
  ): Promise<{ buffer: Buffer; originalKey: string | null }> {
    if (!file)
      throw new BadRequestException('업로드 파일이 필요합니다(field: file)');
    if (!file.originalname?.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException('.xlsx 파일만 지원합니다(.xls 미지원)');
    }
    let originalKey: string | null = null;
    try {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      originalKey = await this.storage.put(
        `imports/${ts}-${file.originalname}`,
        file.buffer,
        XLSX_MIME,
      );
    } catch {
      originalKey = null;
    }
    return { buffer: file.buffer, originalKey };
  }
}
