import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BACKUP_SINK } from './sinks/backup-sink.interface';
import { LocalFsSink } from './sinks/local-fs.sink';
import { MODEL_PLANS, type ModelPlan } from './backup-models';
import { getModelPlans, auditFieldTypes } from './backup.plans';
import {
  BACKUP_OPTIONS,
  loadBackupConfig,
  type BackupOptions,
} from './backup.config';
import { FullBackupService } from './full-backup.service';
import { DeltaJournalService } from './delta-journal.service';
import { RestoreService } from './restore.service';
import { BackupJob } from './backup.job';
import { PgDumpService } from './pg-dump.service';
import { spawnPg } from './pg-runner';
import {
  PG_DUMP_CONFIG,
  loadPgDumpConfig,
  type PgDumpModuleConfig,
} from './pg-dump.config';
import { PgBackupJob } from './pg-backup.job';
import { BackupController } from './backup.controller';

/**
 * BackupModule — DB 백업(전체 일배치 + 변경점 델타)과 복원 서비스를 조립한다.
 * PrismaService/ConfigService 는 전역 모듈에서 주입.
 */
@Module({
  providers: [
    {
      provide: BACKUP_OPTIONS,
      useFactory: (config: ConfigService): BackupOptions =>
        loadBackupConfig((k) => config.get<string>(k)),
      inject: [ConfigService],
    },
    {
      provide: BACKUP_SINK,
      useFactory: (opts: BackupOptions) => new LocalFsSink(opts.dir),
      inject: [BACKUP_OPTIONS],
    },
    { provide: MODEL_PLANS, useFactory: (): ModelPlan[] => getModelPlans() },
    {
      provide: FullBackupService,
      useFactory: (
        prisma: PrismaService,
        sink: LocalFsSink,
        plans: ModelPlan[],
        opts: BackupOptions,
      ) =>
        new FullBackupService(prisma, sink, plans, {
          fullRetentionDays: opts.fullRetentionDays,
        }),
      inject: [PrismaService, BACKUP_SINK, MODEL_PLANS, BACKUP_OPTIONS],
    },
    {
      provide: DeltaJournalService,
      useFactory: (
        prisma: PrismaService,
        sink: LocalFsSink,
        plans: ModelPlan[],
      ) => new DeltaJournalService(prisma, sink, auditFieldTypes(plans)),
      inject: [PrismaService, BACKUP_SINK, MODEL_PLANS],
    },
    {
      provide: RestoreService,
      useFactory: (
        prisma: PrismaService,
        sink: LocalFsSink,
        plans: ModelPlan[],
      ) => new RestoreService(prisma, sink, plans),
      inject: [PrismaService, BACKUP_SINK, MODEL_PLANS],
    },
    BackupJob,
    // ── pg_dump 기반 웹 관리(옵션 B) ──
    {
      provide: PG_DUMP_CONFIG,
      useFactory: (config: ConfigService): PgDumpModuleConfig =>
        loadPgDumpConfig((k) => config.get<string>(k)),
      inject: [ConfigService],
    },
    {
      provide: PgDumpService,
      useFactory: (cfg: PgDumpModuleConfig) => new PgDumpService(cfg, spawnPg),
      inject: [PG_DUMP_CONFIG],
    },
    PgBackupJob,
  ],
  controllers: [BackupController],
  exports: [
    FullBackupService,
    DeltaJournalService,
    RestoreService,
    PgDumpService,
  ],
})
export class BackupModule {}
