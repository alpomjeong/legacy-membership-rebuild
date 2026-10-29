import { upcomingMemorials } from './upcoming-memorials';

const ev = (id: number, iso: string, label?: string) => ({
  id: BigInt(id),
  eventDateSolar: iso,
  label: label ?? null,
});

describe('upcomingMemorials', () => {
  it('includes today (daysUntil 0) and within lookahead, excludes beyond', () => {
    const now = new Date('2026-07-02T10:00:00');
    const events = [
      ev(1, '2010-07-02T00:00:00'), // 오늘
      ev(2, '2011-07-05T00:00:00'), // +3
      ev(3, '2012-07-06T00:00:00'), // +4 (제외, lookahead 3)
    ];
    const up = upcomingMemorials(events, now, 3);
    expect(up.map((u) => u.id)).toEqual(['1', '2']);
    expect(up[0].daysUntil).toBe(0);
    expect(up[1].daysUntil).toBe(3);
  });

  it('rolls a passed anniversary to next year (so yesterday is excluded)', () => {
    const now = new Date('2026-07-02T10:00:00');
    const up = upcomingMemorials([ev(1, '2000-07-01T00:00:00')], now, 3);
    expect(up).toHaveLength(0);
  });

  it('handles year-end wrap (Dec 31 now → Jan 1 within lookahead)', () => {
    const now = new Date('2026-12-31T10:00:00');
    const up = upcomingMemorials([ev(1, '1990-01-01T00:00:00')], now, 3);
    expect(up).toHaveLength(1);
    expect(up[0].daysUntil).toBe(1);
  });

  it('sorts by daysUntil ascending and carries the label', () => {
    const now = new Date('2026-07-02T00:00:00');
    const up = upcomingMemorials(
      [
        ev(1, '2000-07-04T00:00:00', '홍길동'),
        ev(2, '2000-07-02T00:00:00', '김철수'),
      ],
      now,
      5,
    );
    expect(up.map((u) => u.label)).toEqual(['김철수', '홍길동']);
  });
});
