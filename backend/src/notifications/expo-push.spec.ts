import { isExpoPushToken, buildMemorialMessages } from './expo-push.service';
import type { UpcomingMemorial } from './upcoming-memorials';

describe('isExpoPushToken', () => {
  it('accepts Exponent/Expo push token formats, rejects others', () => {
    expect(isExpoPushToken('ExponentPushToken[abc123]')).toBe(true);
    expect(isExpoPushToken('ExpoPushToken[abc123]')).toBe(true);
    expect(isExpoPushToken('not-a-token')).toBe(false);
    expect(isExpoPushToken('')).toBe(false);
  });
});

const m = (daysUntil: number, label: string | null): UpcomingMemorial => ({
  id: '1',
  label,
  date: '2026-07-05T00:00:00.000Z',
  daysUntil,
});

describe('buildMemorialMessages', () => {
  it('returns empty when nothing upcoming', () => {
    expect(buildMemorialMessages(['ExpoPushToken[x]'], [])).toEqual([]);
  });

  it('builds one message per valid token, filtering invalid tokens', () => {
    const msgs = buildMemorialMessages(
      ['ExpoPushToken[a]', 'bad', 'ExponentPushToken[b]'],
      [m(0, '홍길동')],
    );
    expect(msgs).toHaveLength(2);
    expect(msgs[0].title).toBe('다가오는 기일 알림');
    expect(msgs[0].body).toContain('오늘');
    expect(msgs[0].data?.type).toBe('memorial');
  });

  it('summarizes multiple upcoming with "외 N건" and future-day phrasing', () => {
    const [msg] = buildMemorialMessages(
      ['ExpoPushToken[a]'],
      [m(2, '김철수'), m(3, '이영희')],
    );
    expect(msg.body).toContain('2일 후');
    expect(msg.body).toContain('김철수');
    expect(msg.body).toContain('외 1건');
  });
});
