import { Workbook } from 'exceljs';

/** 회원 내보내기 행 — DisplayName 등 파생값 포함(화면 표시와 동일). */
export interface MemberExportRow {
  memberName: string;
  displayName: string;
  affiliationCode: string | null;
  phone: string | null;
  address: string | null;
  addressDetail: string | null;
  zipCode: string | null;
  missionaryName: string | null;
  memo: string | null;
}

const COLUMNS: Array<{ header: string; key: keyof MemberExportRow }> = [
  { header: '회원명', key: 'memberName' },
  { header: '표시명', key: 'displayName' },
  { header: '소속코드', key: 'affiliationCode' },
  { header: '전화', key: 'phone' },
  { header: '주소', key: 'address' },
  { header: '상세주소', key: 'addressDetail' },
  { header: '우편번호', key: 'zipCode' },
  { header: '포교원장', key: 'missionaryName' },
  { header: '메모', key: 'memo' },
];

/**
 * 회원 목록을 xlsx 버퍼로 생성한다(서버사이드). 모든 셀은 문자열로 기록하여
 * 우편번호/전화 등 선행 0 을 보존한다(OLEDB/외부 프로세스 의존 0, FR-MEM-29).
 */
export async function buildMemberWorkbook(
  rows: MemberExportRow[],
): Promise<Buffer> {
  const wb = new Workbook();
  const ws = wb.addWorksheet('회원목록');
  ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key }));
  for (const r of rows) {
    ws.addRow(
      COLUMNS.reduce<Record<string, string>>((acc, c) => {
        const v = r[c.key];
        acc[c.key] = v == null ? '' : String(v);
        return acc;
      }, {}),
    );
  }
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
