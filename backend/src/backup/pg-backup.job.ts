import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PgDumpService } from './pg-dump.service';
import { PG_DUMP_CONFIG, type PgDumpModuleConfig } from './pg-dump.config';
import { isFullBackupDue } from './full-backup.due';

const MINUTE = 60_000;

/**
 * PgBackupJob — 앱 자체 스케줄러(Windows 작업 스케줄러 불필요). 1분마다 "예약 시각 지났고 오늘
 * 아직 백업 없으면" pg_dump 백업(하루 1회 + PC-off 캐치업). scheduleEnabled 일 때만 기동.
 */
@Injectable()
export class PgBackupJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('PgBackup');
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly svc: PgDumpService,
    @Inject(PG_DUMP_CONFIG) private readonly config: PgDumpModuleConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    // 타이머는 항상 기동하고, 실제 실행 여부는 매 틱마다 스케줄 설정(파일/웹에서 변경 가능)으로 판단.
    // → 웹에서 자동백업 켜고/끄고·시각 변경 시 재기동 없이 반영된다.
    // 스케줄 로드 실패(권한/손상 등)가 앱 부팅을 막지 않도록 방어 — 타이머는 그대로 기동.
    try {
      const sch = await this.svc.getSchedule();
      this.logger.log(
        sch.enabled
          ? `자동 백업 활성 — 매일 ${sch.fullHour}시, dir=${this.config.backupDir}`
          : '자동 백업 비활성. 웹 수동 백업/복원 및 스케줄 변경은 사용 가능.',
      );
    } catch (e) {
      this.logger.warn(
        `스케줄 로드 실패 — 타이머는 기동, 매 틱 재시도: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    await this.safeRun(new Date()); // 기동 캐치업
    this.timer = setInterval(() => void this.safeRun(new Date()), MINUTE);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** 스케줄이 켜져 있고, 예약 시각이 지났고, 오늘 백업이 없으면 백업. */
  async runIfDue(now: Date): Promise<void> {
    const sch = await this.svc.getSchedule();
    if (!sch.enabled) return;
    const st = await this.svc.status(now, sch); // 로드한 스케줄 재사용(파일 재읽기 방지)
    if (isFullBackupDue(st.last?.at ?? null, now, sch.fullHour)) {
      this.logger.log('자동 백업 시작');
      const r = await this.svc.backupNow(now);
      this.logger.log(`자동 백업 완료 — ${r.name} (${r.bytes} bytes)`);
    }
  }

  private async safeRun(now: Date): Promise<void> {
    try {
      await this.runIfDue(now);
    } catch (e) {
      this.logger.error(
        `자동 백업 실패: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
