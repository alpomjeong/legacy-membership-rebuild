import { Workbook } from 'exceljs';
import { buildMemberWorkbook } from './member-export';

describe('buildMemberWorkbook', () => {
  it('헤더 + 데이터 행, 선행 0 문자열 보존', async () => {
    const buf = await buildMemberWorkbook([
      {
        memberName: '홍길동',
        displayName: '홍길동_무량원',
        affiliationCode: 'BA01',
        phone: '010-1234-5678',
        address: '서울시',
        addressDetail: '101동',
        zipCode: '04524',
        missionaryName: '무량원',
        memo: null,
      },
    ]);
    const wb = new Workbook();
    // exceljs 전역 타입 병합(declare interface Buffer extends ArrayBuffer)이 Node Buffer 와
    // 충돌하여 load(buffer) 인자 타입이 어긋난다(서드파티 타입 결함). 런타임은 정상.
    // @ts-expect-error -- exceljs Buffer 타입 병합 결함
    await wb.xlsx.load(buf);
    const ws = wb.worksheets[0];
    expect(ws.getRow(1).getCell(1).value).toBe('회원명');
    expect(ws.getRow(2).getCell(1).value).toBe('홍길동');
    const zip = ws.getRow(2).getCell(7).value;
    expect(zip).toBe('04524');
    expect(typeof zip).toBe('string');
  });
});
