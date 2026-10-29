/**
 * 사진 이관 — 레거시 MSSQL image(BLOB) → 로컬 스토리지(STORAGE_DIR) 저장 → photoUrl 갱신.
 * 실행: DATABASE_URL=... STORAGE_DIR=... MSSQL_PW=... node apps/migration/mssql-photos.cjs
 * 대상: CM_BuddhistServiceList.Photo → BuddhistServiceItem.photoUrl, CM_Staff.Photo → Staff.photoUrl
 * 키는 공개 서빙 규칙(img_<uuid>.<ext>)에 맞춤 → /api/v1/uploads/image/<key> 로 로딩.
 * StorageService(로컬FS)와 동일 규약: `<key>` 파일 + `<key>.type` 사이드카(Content-Type).
 */
/** 필수 환경변수 — 미설정 시 즉시 종료(기본값을 코드에 두지 않는다). */
function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    console.error(`환경변수 ${name} 가 필요합니다. 예: ${name}=... node <script>`);
    process.exit(1);
  }
  return v;
}

const sql = require('mssql');
const { randomUUID } = require('crypto');
const { mkdir, writeFile } = require('fs/promises');
const { resolve, join } = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const STORAGE_DIR = resolve(process.env.STORAGE_DIR || './data/uploads');

const extOf = (b) => (b[0] === 0xff && b[1] === 0xd8) ? 'jpg' : (b[0] === 0x89 && b[1] === 0x50) ? 'png' : (b[0] === 0x47 && b[1] === 0x49) ? 'gif' : (b[8] === 0x57 && b[9] === 0x45) ? 'webp' : 'jpg';
const ctypeOf = (e) => e === 'png' ? 'image/png' : e === 'gif' ? 'image/gif' : e === 'webp' ? 'image/webp' : 'image/jpeg';

async function ensureBucket() { await mkdir(STORAGE_DIR, { recursive: true }); }
async function put(buf) {
  const e = extOf(buf); const key = `img_${randomUUID()}.${e}`;
  const path = join(STORAGE_DIR, key);
  await writeFile(path, buf);
  await writeFile(`${path}.type`, ctypeOf(e), 'utf8');
  return `/api/v1/uploads/image/${key}`;
}

async function main() {
  await sql.connect({
    server: requireEnv('MSSQL_HOST'), port: Number(process.env.MSSQL_PORT) || 1433,
    user: requireEnv('MSSQL_USER'), password: process.env.MSSQL_PW, database: requireEnv('MSSQL_DB'),
    options: { encrypt: false, trustServerCertificate: true }, connectionTimeout: 10000, requestTimeout: 120000,
  });
  await ensureBucket();

  const items = (await sql.query("SELECT BuddhistServiceID id, Photo FROM CM_BuddhistServiceList WHERE Photo IS NOT NULL")).recordset;
  console.log(`▶ 불사목록 사진 ${items.length}장 이관...`);
  let n = 0;
  for (const it of items) {
    const url = await put(Buffer.from(it.Photo));
    await prisma.buddhistServiceItem.update({ where: { id: BigInt(it.id) }, data: { photoUrl: url } });
    process.stdout.write(`\r  ${++n}/${items.length}`);
  }
  console.log('');

  const staff = (await sql.query("SELECT StaffID, Photo FROM CM_Staff WHERE Photo IS NOT NULL")).recordset;
  console.log(`▶ 사원 사진 ${staff.length}장 이관...`);
  for (const s of staff) {
    const id = BigInt(parseInt(String(s.StaffID), 10));
    const url = await put(Buffer.from(s.Photo));
    await prisma.staff.update({ where: { id }, data: { photoUrl: url } });
  }
  await sql.close();

  const withPhoto = await prisma.buddhistServiceItem.count({ where: { photoUrl: { not: null } } });
  console.log(`\n✅ 완료. 불사목록 photoUrl 설정: ${withPhoto}/${items.length}, 사원: ${staff.length}`);
  console.log('__RESULT__ ' + JSON.stringify({ ok: true, photos: { items: items.length, staff: staff.length } }));
  await prisma.$disconnect();
}
main().catch((e) => { console.error('ERROR:', e); process.exit(1); });
