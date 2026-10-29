import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { BackupSink } from './sinks/backup-sink.interface';
import { BACKUP_SINK } from './sinks/backup-sink.interface';
import { FullBackupService } from './full-backup.service';
import { DeltaJournalService } from './delta-journal.service';
import { BACKUP_OPTIONS, type BackupOptions } from './backup.config';
import { loadState } from './backup-state';
import { isFullBackupDue } from './full-backup.due';

const MINUTE = 60_000;

/**
 * BackupJob — 스케줄러 글루. 두 타이머로 동작한다(온프레미스 특성상 @nestjs/schedule 없이 자족):
 *  - 델타: deltaDebounceMs 마다 저널 flush(변경점 초단위 백업).
 *  - 전체: 1분마다 "예약 시각 지났고 오늘 아직 안 돌았으면" 전체 백업(하루 1회 + PC-off 캐치업).
 * 기동 시(onModuleInit) 즉시 1회씩 점검해 밀린 백업을 따라잡는다.
 */
@Injectable()
export class BackupJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Backup');
  private fullTimer?: NodeJS.Timeout;
  private deltaTimer?: NodeJS.Timeout;

  constructor(
    private readonly full: FullBackupService,
    private readonly delta: DeltaJournalService,
    @Inject(BACKUP_SINK) private readonly sink: BackupSink,
    @Inject(BACKUP_OPTIONS) private readonly options: BackupOptions,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.options.enabled) {
      this.logger.log(
        '백업 비활성(BACKUP_ENABLED=false 또는 비운영). 스케줄러 미기동.',
      );
      return;
    }
    this.logger.log(
      `백업 활성 — dir=${this.options.dir}, 전체=${this.options.fullHour}시, 델타=${this.options.deltaDebounceMs}ms`,
    );
    // 기동 즉시 캐치업
    await this.safe('startup-delta', () => this.delta.flush());
    await this.safe('startup-full', () => this.runFullIfDue(new Date()));
    // 주기 타이머(프로세스 종료를 막지 않도록 unref)
    this.deltaTimer = setInterval(
      () => void this.safe('delta', () => this.delta.flush()),
      this.options.deltaDebounceMs,
    );
    this.fullTimer = setInterval(
      () => void this.safe('full', () => this.runFullIfDue(new Date())),
      MINUTE,
    );
    this.deltaTimer.unref?.();
    this.fullTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.deltaTimer) clearInterval(this.deltaTimer);
    if (this.fullTimer) clearInterval(this.fullTimer);
  }

  /** 예약 시각이 지났고 오늘 아직 안 돌았으면 전체 백업 + 저널 정리. */
  async runFullIfDue(now: Date): Promise<void> {
    const state = await loadState(this.sink);
    if (!isFullBackupDue(state.lastFullBackupAt, now, this.options.fullHour))
      return;
    this.logger.log('전체 백업 시작');
    const run = await this.full.run(now);
    await this.delta.pruneJournals(this.options.journalRetentionDays);
    this.logger.log(
      `전체 백업 완료 — ${run.rows}행, ${run.bytes}바이트, ${run.file}`,
    );
  }

  private async safe(label: string, fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
    } catch (e) {
      this.logger.error(
        `백업 작업 실패(${label}): ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
