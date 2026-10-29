import { createReadStream } from 'node:fs';
import { basename } from 'node:path';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsString, Max, Min } from 'class-validator';
import { RequirePermissions } from '../rbac/decorators';
import { PgDumpService } from './pg-dump.service';

export class RestoreDto {
  @IsString() file!: string;
  /** 파괴적 작업 확인 토큰 — 대상 DB 이름을 그대로 입력해야 진행. */
  @IsString() confirm!: string;
}

export class ScheduleDto {
  /** 자동 백업 사용 여부. */
  @IsBoolean() enabled!: boolean;
  /** 매일 자동 백업 시각(로컬 0~23시). */
  @IsInt() @Min(0) @Max(23) fullHour!: number;
}

/**
 * 백업 관리 API (`/admin/backup`) — 관리자(`backup:manage`) 전용.
 * 웹에서 백업 실행/상태/목록/다운로드/복원까지 완결(운영자가 CLI·pgAdmin 불필요).
 */
@ApiTags('backup')
@ApiBearerAuth()
@Controller('admin/backup')
export class BackupController {
  constructor(private readonly svc: PgDumpService) {}

  @Post('run')
  @RequirePermissions('backup:manage')
  run() {
    return this.svc.backupNow();
  }

  @Get('status')
  @RequirePermissions('backup:manage')
  status() {
    return this.svc.status();
  }

  @Get('schedule')
  @RequirePermissions('backup:manage')
  getSchedule() {
    return this.svc.getSchedule();
  }

  @Put('schedule')
  @RequirePermissions('backup:manage')
  setSchedule(@Body() dto: ScheduleDto) {
    return this.svc.setSchedule({
      enabled: dto.enabled,
      fullHour: dto.fullHour,
    });
  }

  @Get('list')
  @RequirePermissions('backup:manage')
  list() {
    return this.svc.list();
  }

  @Get('download/:file')
  @RequirePermissions('backup:manage')
  download(@Param('file') file: string): StreamableFile {
    const path = this.svc.pathFor(file); // 화이트리스트 검증 포함
    return new StreamableFile(createReadStream(path), {
      type: 'application/octet-stream',
      disposition: `attachment; filename="${basename(path)}"`,
    });
  }

  @Post('restore')
  @RequirePermissions('backup:manage')
  async restore(@Body() dto: RestoreDto) {
    // 확인문구(대상 DB명)가 정확히 일치해야 실행 — 오클릭 방지.
    if (dto.confirm !== this.svc.databaseName()) {
      throw new BadRequestException(
        '확인문구가 일치하지 않습니다. 대상 DB 이름을 정확히 입력하세요.',
      );
    }
    return this.svc.restore(dto.file, { safety: true });
  }

  /**
   * 파일 업로드 복원 — 사용자 PC 의 .dump 를 첨부(업로드)해 복원(USB/타 PC 백업본 등).
   * 서버 폴더에 없던 파일도 가져와 복원 가능. 확인문구(대상 DB명) 일치 필수.
   */
  @Post('restore-upload')
  @RequirePermissions('backup:manage')
  // 업로드 크기 상한(메모리 버퍼 DoS 방지). 초과 시 스트리밍 중 차단. nginx(client_max_body_size)도 함께 게이트.
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 200 * 1024 * 1024 } }),
  )
  async restoreUpload(
    @Body('confirm') confirm: string,
    @UploadedFile() file?: { buffer: Buffer; originalname?: string },
  ) {
    if (confirm !== this.svc.databaseName()) {
      throw new BadRequestException(
        '확인문구가 일치하지 않습니다. 대상 DB 이름을 정확히 입력하세요.',
      );
    }
    if (!file?.buffer) {
      throw new BadRequestException(
        '복원할 .dump 파일을 선택하세요(field: file).',
      );
    }
    let name: string;
    try {
      name = await this.svc.importUploaded(file.buffer);
    } catch (e) {
      // 잘못된 파일(형식/매직바이트 불일치)은 400 으로 사유를 노출.
      throw new BadRequestException(
        e instanceof Error ? e.message : '업로드 파일을 처리할 수 없습니다.',
      );
    }
    return this.svc.restore(name, { safety: true });
  }
}
