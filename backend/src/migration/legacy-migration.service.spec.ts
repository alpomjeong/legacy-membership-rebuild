import { parseResultLine } from './legacy-migration.service';

describe('parseResultLine', () => {
  it('parses the last __RESULT__ json line', () => {
    const out = [
      '▶ 추출 중...',
      '__RESULT__ {"ok":true,"dryRun":true,"extracted":{"member":103}}',
      '기타 로그',
    ].join('\n');
    expect(parseResultLine(out)).toEqual({
      ok: true,
      dryRun: true,
      extracted: { member: 103 },
    });
  });

  it('returns null when no result line is present', () => {
    expect(parseResultLine('그냥 로그\n두 번째 줄')).toBeNull();
  });

  it('returns null on malformed json', () => {
    expect(parseResultLine('__RESULT__ {oops')).toBeNull();
  });
});
