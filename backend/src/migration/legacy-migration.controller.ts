import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { RequirePermissions } from '../rbac/decorators';
import { LegacyMigrationService } from './legacy-migration.service';

export class LegacyMigrationDto {
  @IsString() @MinLength(1) host!: string;
  @IsOptional() @IsInt() @Min(1) @Max(65535) port?: number;
  @IsString() @MinLength(1) user!: string;
  @IsString() @MinLength(1) database!: string;
  @IsString() password!: string;
  /** true 면 추출·변환·검증만(쓰기 없음). */
  @IsOptional() @IsBoolean() dryRun?: boolean;
  /** true 면 실적재 후 사진 BLOB → MinIO 이관까지. */
  @IsOptional() @IsBoolean() includePhotos?: boolean;
  /** 실적재(파괴적) 확인 토큰 — 'MIGRATE' 를 입력해야 진행. */
  @IsOptional() @IsString() confirm?: string;
}

/**
 * 레거시 데이터 이관 API (`/admin/migration`) — 관리자(`migration:run`) 전용.
 * 최초 세팅 시 레거시 MSSQL → PostgreSQL 로 즉시 이관. 실적재는 업무 테이블을
 * 덮어쓰는 파괴적 작업이라 confirm='MIGRATE' 필수(드라이런은 안전).
 */
@ApiTags('migration')
@ApiBearerAuth()
@Controller('admin/migration')
export class LegacyMigrationController {
  constructor(private readonly svc: LegacyMigrationService) {}

  @Post('legacy')
  @RequirePermissions('migration:run')
  legacy(@Body() dto: LegacyMigrationDto) {
    const dryRun = dto.dryRun ?? true; // 안전 기본값: 드라이런
    if (!dryRun && dto.confirm !== 'MIGRATE') {
      throw new BadRequestException(
        "실행하려면 confirm 에 'MIGRATE' 를 입력하세요. 기존 업무 데이터를 덮어씁니다.",
      );
    }
    return this.svc.run(
      {
        host: dto.host,
        port: dto.port,
        user: dto.user,
        database: dto.database,
        password: dto.password,
      },
      { dryRun, includePhotos: dto.includePhotos ?? false },
    );
  }
}
