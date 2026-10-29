import { Injectable, Logger } from '@nestjs/common';
import type { UpcomingMemorial } from './upcoming-memorials';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100;

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** Expo 푸시 토큰 형식 검증(ExponentPushToken[...] / ExpoPushToken[...]). */
export function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[.+\]$/.test(token);
}

const p2 = (n: number): string => String(n).padStart(2, '0');

/** 다가오는 기일 목록 → 각 토큰으로 보낼 알림 메시지. 토큰당 1건(요약). */
export function buildMemorialMessages(
  tokens: string[],
  upcoming: UpcomingMemorial[],
): ExpoMessage[] {
  if (upcoming.length === 0) return [];
  const head = upcoming[0];
  const when = head.daysUntil === 0 ? '오늘' : `${head.daysUntil}일 후`;
  const d = new Date(head.date);
  const firstLabel = head.label ?? `${p2(d.getMonth() + 1)}/${p2(d.getDate())}`;
  const title = '다가오는 기일 알림';
  const body =
    upcoming.length === 1
      ? `${when} 기일: ${firstLabel}`
      : `${when} 기일: ${firstLabel} 외 ${upcoming.length - 1}건`;
  return tokens.filter(isExpoPushToken).map((to) => ({
    to,
    title,
    body,
    data: {
      type: 'memorial',
      route: '/(tabs)/enshrine',
      count: upcoming.length,
    },
  }));
}

/**
 * ExpoPushService — Expo Push API 로 알림 전송. FCM/APNs 자격증명 없이 개발 가능
 * (안드로이드 정식 배포 시 Expo 에 FCM 키 등록). 네트워크 실패는 로깅만(잡을 멈추지 않음).
 */
@Injectable()
export class ExpoPushService {
  private readonly logger = new Logger('ExpoPush');

  async send(messages: ExpoMessage[]): Promise<{ sent: number }> {
    const valid = messages.filter((m) => isExpoPushToken(m.to));
    let sent = 0;
    for (let i = 0; i < valid.length; i += BATCH) {
      const chunk = valid.slice(i, i + BATCH);
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(chunk),
        });
        if (!res.ok) {
          this.logger.warn(`Expo push HTTP ${res.status}`);
          continue;
        }
        sent += chunk.length;
      } catch (e) {
        this.logger.warn(
          `Expo push 전송 실패: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    return { sent };
  }
}
