export const NOTIFY_CONFIG = Symbol('NOTIFY_CONFIG');

export interface NotifyConfig {
  /** 기일 알림 활성(기본 on). MEMORIAL_NOTIFY_ENABLED=false 로 끔. */
  enabled: boolean;
  /** 매일 발송 시각(로컬 0~23시, 기본 9). */
  notifyHour: number;
  /** 며칠 전까지 알릴지(오늘 포함, 기본 3). */
  lookaheadDays: number;
}

type Getter = (key: string) => string | undefined;

const clampInt = (
  v: string | undefined,
  dflt: number,
  min: number,
  max: number,
): number => {
  const n = Number(v);
  if (v === undefined || v === '' || !Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, Math.trunc(n)));
};

export function loadNotifyConfig(get: Getter): NotifyConfig {
  return {
    enabled: get('MEMORIAL_NOTIFY_ENABLED') !== 'false',
    notifyHour: clampInt(get('MEMORIAL_NOTIFY_HOUR'), 9, 0, 23),
    lookaheadDays: clampInt(get('MEMORIAL_LOOKAHEAD_DAYS'), 3, 0, 60),
  };
}
