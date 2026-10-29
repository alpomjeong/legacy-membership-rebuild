import { Workbook } from 'exceljs';

export interface SheetColumn {
  header: string;
  key: string;
}

/**
 * 제너릭 서버사이드 Excel 생성기 — 컬럼 스키마 + 행(문자열 맵)으로 xlsx 버퍼 생성.
 * 모든 셀은 문자열로 기록해 단번호/우편번호 등 선행 0 을 보존한다(OLEDB/외부 프로세스 의존 0).
 */
export async function buildSheet(
  sheetName: string,
  columns: SheetColumn[],
  rows: Array<Record<string, string>>,
): Promise<Buffer> {
  const wb = new Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key }));
  for (const r of rows) {
    ws.addRow(
      columns.reduce<Record<string, string>>((acc, c) => {
        acc[c.key] = r[c.key] ?? '';
        return acc;
      }, {}),
    );
  }
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
