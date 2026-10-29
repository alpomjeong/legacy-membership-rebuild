import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateMemberDto } from './create-member.dto';

const errorsFor = (obj: unknown) =>
  validateSync(plainToInstance(CreateMemberDto, obj), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('CreateMemberDto', () => {
  it('이름이 비면 검증 실패(FR-MEM-05)', () => {
    const e = errorsFor({ memberName: '' });
    expect(e.some((x) => x.property === 'memberName')).toBe(true);
  });
  it('이름만 있으면 통과(나머지 선택)', () => {
    expect(errorsFor({ memberName: '홍길동' })).toHaveLength(0);
  });
  it('알 수 없는 필드는 거부', () => {
    const e = errorsFor({ memberName: '홍길동', hacker: 1 });
    expect(e.length).toBeGreaterThan(0);
  });
  it('missionaryId 는 숫자 문자열만', () => {
    const e = errorsFor({ memberName: '홍길동', missionaryId: 'abc' });
    expect(e.some((x) => x.property === 'missionaryId')).toBe(true);
  });
});
