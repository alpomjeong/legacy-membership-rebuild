import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PushTokenService } from './push-token.service';
import { ExpoPushService, buildMemorialMessages } from './expo-push.service';
import { upcomingMemorials } from './upcoming-memorials';
import { NOTIFY_CONFIG, type NotifyConfig } from './notifications.config';

/**
 * MemorialNotifyJob — 매일 지정 시각, 다가오는 기일(양력 기념일)을 산출해 테넌트의
 * 등록 기기(직원)로 Expo 푸시 발송(FR-FUN-10). 음력/간지 반복은 Phase 2.
 * 타이머는 매시 정각 점검하고 notifyHour 일 때만 실행.
 */
@Injectable()
export class MemorialNotifyJob {
  private readonly logger = new Logger('MemorialNotify');

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushTokens: PushTokenService,
    private readonly expo: ExpoPushService,
    @Inject(NOTIFY_CONFIG) private readonly config: NotifyConfig,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async tick(): Promise<void> {
    if (!this.config.enabled) return;
    const now = new Date();
    if (now.getHours() !== this.config.notifyHour) return;
    try {
      const r = await this.runOnce(now);
      this.logger.log(
        `기일 알림 — 대상 기일 ${r.memorials}건, 발송 ${r.sent}건`,
      );
    } catch (e) {
      this.logger.error(
        `기일 알림 실패: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /** 산출 + 발송. 테넌트별로 묶어 각 테넌트 기기에 발송. */
  async runOnce(now: Date): Promise<{ memorials: number; sent: number }> {
    const events = await this.prisma.enshrinementEvent.findMany({
      where: { isDeleted: false },
      select: { id: true, tenantId: true, eventDateSolar: true, label: true },
    });
    const byTenant = new Map<string, typeof events>();
    for (const e of events) {
      const k = e.tenantId.toString();
      (byTenant.get(k) ?? byTenant.set(k, []).get(k)!).push(e);
    }
    let memorials = 0;
    let sent = 0;
    for (const [tenantKey, list] of byTenant) {
      const upcoming = upcomingMemorials(list, now, this.config.lookaheadDays);
      if (upcoming.length === 0) continue;
      memorials += upcoming.length;
      const tokens = await this.pushTokens.tokensForTenant(BigInt(tenantKey));
      if (tokens.length === 0) continue;
      const res = await this.expo.send(buildMemorialMessages(tokens, upcoming));
      sent += res.sent;
    }
    return { memorials, sent };
  }
}
