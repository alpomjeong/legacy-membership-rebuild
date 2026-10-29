import PDFDocument from 'pdfkit';
import { join } from 'path';

/** 번들 한글 폰트(Nanum Gothic, OFL). 런타임 cwd=backend 기준. */
const FONT_PATH = join(
  process.cwd(),
  'assets',
  'fonts',
  'NanumGothic-Regular.ttf',
);

export interface CertificateData {
  memberName: string;
  itemName: string;
  altarNumber: string | null;
  issuedDate: string | null;
}

/**
 * 불사 증서 PDF 생성 (FR-RPT-09) — 서버사이드 pdfkit + 한글 폰트 임베드.
 * 반환: PDF Buffer. 데이터는 권한 검증된 자원만 호출자가 넘긴다.
 */
export function renderCertificatePdf(d: CertificateData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 64 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('ko', FONT_PATH);
    doc.font('ko');

    const W = doc.page.width - 128; // 본문 폭(좌우 margin 64)

    doc.moveDown(2);
    doc
      .fontSize(13)
      .fillColor('#9c2f1f')
      .text('신 고 달 사', { align: 'center' });
    doc.moveDown(1.6);
    doc
      .fontSize(36)
      .fillColor('#262019')
      .text('불 사 증 서', { align: 'center', characterSpacing: 6 });
    doc.moveDown(0.2);
    doc
      .fontSize(11)
      .fillColor('#8a7f6c')
      .text('佛 事 證 書', { align: 'center', characterSpacing: 4 });

    doc.moveDown(3.2);
    const rows: [string, string][] = [
      ['회원', d.memberName || '—'],
      ['불사목록', d.itemName || '—'],
      ['단번호', d.altarNumber || '—'],
      ['발급일자', d.issuedDate || '—'],
    ];
    const left = 64 + W * 0.22;
    for (const [k, v] of rows) {
      const y = doc.y;
      doc
        .fontSize(13)
        .fillColor('#7a7060')
        .text(k, 64, y, { width: W * 0.2, align: 'right' });
      doc
        .fontSize(14)
        .fillColor('#262019')
        .text(v, left + 16, y, { width: W * 0.6 });
      doc.moveDown(0.9);
    }

    doc.moveDown(3.5);
    doc
      .fontSize(13)
      .fillColor('#262019')
      .text('위 불사를 봉행하였음을 증명합니다.', 64, doc.y, {
        width: W,
        align: 'center',
      });
    doc.moveDown(1.4);
    doc
      .fontSize(22)
      .text('신 고 달 사', { align: 'center', characterSpacing: 5 });

    doc.end();
  });
}
