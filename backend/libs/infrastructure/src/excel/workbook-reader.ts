import { Workbook } from 'exceljs';

export type SheetRow = Record<string, string>;

/**
 * xlsx 버퍼 → 행 객체 배열(첫 시트, 1행=헤더). ACE/Jet OLEDB 폐기 → OpenXML(ExcelJS).
 * 셀은 표시 문자열(text)로 읽어 단번호/우편번호 등 선행 0을 보존한다(FR-MIG-02).
 */
export async function parseXlsxBuffer(buf: Buffer): Promise<SheetRow[]> {
  const wb = new Workbook();
  // @types/node 24 의 Buffer 제네릭과 exceljs Buffer 타입 불일치 → 캐스팅(런타임은 Node Buffer 허용)
  await wb.xlsx.load(buf as unknown as Parameters<Workbook['xlsx']['load']>[0]);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const headers: string[] = [];
  ws.getRow(1).eachCell((cell, col) => {
    headers[col] = String(cell.text).trim();
  });

  const rows: SheetRow[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const obj: SheetRow = {};
    let hasValue = false;
    headers.forEach((h, col) => {
      if (!h) return;
      const text = String(row.getCell(col).text ?? '').trim();
      obj[h] = text;
      if (text) hasValue = true;
    });
    if (hasValue) rows.push(obj);
  }
  return rows;
}
