import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * 정적분석 회귀 (NFR-SEC-03 / FR-AUTH-02 / MAP-30):
 * 운영 소스(src, 테스트 제외)에 레거시 백도어 표식이 남아 있지 않음을 보장한다.
 * 테스트가 백도어 시도를 검증하는 것과, 운영 코드가 백도어를 '구현'하는 것은 다르다 —
 * 따라서 *.spec.ts 는 스캔 대상에서 제외한다.
 */
const SRC_ROOT = join(__dirname, '..');

// 레거시 하드코딩 자격증명 표식. 부활 시 회귀 실패로 잡는다.
const FORBIDDEN_MARKERS = ['chul0127'];

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('백도어 정적분석 (운영 소스)', () => {
  const files = collectSourceFiles(SRC_ROOT);

  it('스캔할 운영 소스 파일이 존재한다', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('운영 소스 어디에도 하드코딩 백도어 표식이 없다', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const marker of FORBIDDEN_MARKERS) {
        if (content.includes(marker)) {
          offenders.push(`${file} :: ${marker}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
