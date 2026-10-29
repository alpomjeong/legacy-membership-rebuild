import { Workbook } from 'exceljs';
import { parseXlsxBuffer } from './excel-parser';

async function synthWorkbook(): Promise<Buffer> {
  const wb = new Workbook();
  const ws = wb.addWorksheet('불사명단');
  ws.addRow(['회원명', '포교원장', '불사명', '단번호']);
  const r = ws.addRow(['홍길동', '무량원', '12지신등명불', '0909']);
  r.getCell(4).numFmt = '@'; // 텍스트 포맷 → 선행 0 보존
  ws.addRow(['성춘향', '안산', '칠성기도', '0142']);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

describe('parseXlsxBuffer (ExcelJS · OLEDB 폐기)', () => {
  it('헤더 기준 행 객체 파싱 + 단번호 선행 0 보존', async () => {
    const rows = await parseXlsxBuffer(await synthWorkbook());
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      회원명: '홍길동',
      포교원장: '무량원',
      단번호: '0909',
    });
    expect(rows[1]['단번호']).toBe('0142');
  });
});
