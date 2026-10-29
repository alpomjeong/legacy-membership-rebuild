/**
 * 레거시 MSSQL → PostgreSQL 직접 마이그레이션 (1회성).
 * 실행: DATABASE_URL=... MSSQL_PW=... [DRY=1] node apps/migration/mssql-migrate.cjs
 * - DRY=1: 추출·변환·검증만(쓰기 없음). 미설정 시 업무 테이블 truncate 후 실적재.
 * - ID 보존(레거시 숫자 PK), FK 의존순 적재, 시퀀스 재설정, 건수 검증.
 * - 평문 비번 미반입(임시비번+최초변경강제). 사진 BLOB 제외. 봉안일=양력만(음력 Phase2).
 * 접속정보는 env 로 재정의 가능(웹 이관 페이지에서 주입):
 *   MSSQL_HOST · MSSQL_PORT(기본 1433) · MSSQL_USER · MSSQL_DB · MSSQL_PW  (PORT 외 전부 필수)
 * 마지막 줄에 결과 요약 JSON 을 `__RESULT__ {...}` 로 출력한다(백엔드 파싱용).
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
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

const prisma = new PrismaClient();
const TENANT = 1n;
const DRY = process.env.DRY === '1';
// 마이그레이션 계정 임시비번 — 환경변수 필수. 미설정 시 매 실행 랜덤 생성(혼동문자 제외).
// 평문은 실행 결과에 1회만 노출되며, 최초 로그인 시 변경이 강제된다.
function genTempPw() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%';
  const buf = require('crypto').randomBytes(16);
  return Array.from(buf).map((b) => A[b % A.length]).join('');
}
const TEMP_PW = process.env.MIGRATION_TEMP_PW || genTempPw();

const MSSQL = {
  server: requireEnv('MSSQL_HOST'),
  port: Number(process.env.MSSQL_PORT) || 1433,
  user: requireEnv('MSSQL_USER'),
  password: requireEnv('MSSQL_PW'),
  database: requireEnv('MSSQL_DB'),
  options: { encrypt: false, trustServerCertificate: true },
  connectionTimeout: 10000,
  requestTimeout: 120000,
};

const has = (v) => v !== null && v !== undefined && String(v).trim() !== '';
const big = (v) => (has(v) ? BigInt(Math.trunc(Number(v))) : null);
const yn = (c) => String(c).toUpperCase() === 'Y';
const parseDate = (s) => { if (!has(s)) return null; const d = new Date(String(s).trim()); return isNaN(d.getTime()) ? null : d; };
const staffBig = (s) => { if (!has(s)) return null; const n = parseInt(String(s).trim(), 10); return Number.isFinite(n) && n > 0 ? BigInt(n) : null; };

async function main() {
  await sql.connect(MSSQL);
  const all = async (t) => (await sql.query(`SELECT * FROM ${t}`)).recordset;

  console.log('▶ 추출 중...');
  const [common, sexa, miss, items, members, funeral, staff, accounts, regs, counsels] = await Promise.all([
    all('CM_Common'), all('wk_육십갑자'), all('CM_Missionary'), all('CM_BuddhistServiceList'),
    all('TB_Member'), all('TB_FuneralDay'), all('CM_Staff'), all('SM_UserInfo'),
    all('MM_ARI_Reg'), all('TB_Counsel'),
  ]);
  await sql.close();
  console.log(`  추출 완료: 회원 ${members.length}, 불사 ${regs.length}, 포교원장 ${miss.length}, 불사목록 ${items.length}, 공통코드 ${common.length}, 봉안일 ${funeral.length}, 육십갑자 ${sexa.length}, 상담 ${counsels.length}, 사원 ${staff.length}`);

  // ---- 변환 ----
  const staffIdSet = new Set(staff.map((s) => staffBig(s.StaffID)?.toString()).filter(Boolean));

  const tCommon = common.map((r) => ({ tenantId: TENANT, groupCode: String(r.CommCls), code: String(r.CommCD), name: r.CommNm ?? '', shortName: r.Abbreviation ?? null, sortOrder: r.S_Order ?? 0, isActive: yn(r.UseYN) }));
  const tSexa = sexa.map((r) => { const nm = String(r.name ?? ''); const m = nm.match(/^(.*?)\(([^)]*)\)/); return { code: Math.trunc(Number(r.code)), ganjiNameHanja: m ? m[1].trim() : null, ganjiNameKo: m ? m[2].trim() : nm, namede: r.namede }; });
  const tMiss = miss.map((r) => ({ id: big(r.MissionaryID), tenantId: TENANT, name: r.MissionaryNm ?? '', phone: r.CellPhone ?? null, address: r.Addr ?? null, addressDetail: r.AddrD ?? null, isActive: yn(r.UseYN) }));
  const tItems = items.map((r) => ({ id: big(r.BuddhistServiceID), tenantId: TENANT, name: r.BuddhistServiceNm ?? '', referenceAmount: r.Amount ?? null, serviceTypeCode: null, photoUrl: null, description: r.Description ?? null, isActive: yn(r.UseYN) }));
  const tMembers = members.map((r) => ({ id: big(r.MemberID), tenantId: TENANT, memberName: r.MemberNm ?? '', affiliationCode: has(r.Affiliation) ? String(r.Affiliation) : null, phone: r.Phone ?? null, address: r.Addr ?? null, addressDetail: r.AddrD ?? null, zipCode: r.ZipCode ?? null, missionaryId: big(r.MissionaryID), memo: r.Memo ?? null, createdAt: parseDate(r.SaveDate) ?? new Date('2000-01-01'), updatedAt: parseDate(r.EditDate) }));
  const tFuneral = funeral.map((r) => ({ id: big(r.FuneralDayID), tenantId: TENANT, eventDateSolar: parseDate(r.FuneralDayDate) ?? new Date('2000-01-01'), defaultBuddhistServiceItemId: big(r.BuddhistServiceID), remark: r.Remark ?? null }));
  const tCounsels = counsels.map((r) => ({ id: big(r.CounselID), tenantId: TENANT, memberId: big(r.MemberID), counseledAt: parseDate(r.CounselDate) ?? new Date('2000-01-01'), content: r.CounselDesp ?? '' }));
  const tStaff = staff.map((r) => ({ id: staffBig(r.StaffID), tenantId: TENANT, staffNameKo: r.StaffNmK ?? '', staffNameEn: r.StaffNmE ?? null, isWorking: yn(r.WorkYN), positionCode: r.Position ?? null, dutyCode: r.Duty ?? null, jobGroupCode: r.JobGroup ?? null, staffDivCode: r.StaffDiv ?? null, appellationDivCode: r.AppellationDiv ?? null, solarLunarCode: r.SolarLuna ?? null, authLevelCode: r.AuthLevel ?? null, birthDate: parseDate(r.BirthDay), smsReceiveYn: yn(r.SmsReceiveStaff), joinDate: parseDate(r.JoinDate), retireDate: parseDate(r.RetireDate) }));

  // 불사신청: sexagenary code→id 는 적재 후 매핑. 여기선 birthday 코드만 보관.
  const tRegs = regs.map((r) => ({
    id: big(r.RegistrationID), tenantId: TENANT,
    registrationDate: parseDate(r.RegistrationDate) ?? new Date('2000-01-01'),
    staffId: staffIdSet.has(staffBig(r.StaffID)?.toString()) ? staffBig(r.StaffID) : null,
    enshrinementEventId: big(r.FuneralDayID), memberId: big(r.MemberID), buddhistServiceItemId: big(r.BuddhistServiceID),
    altarNumber: r.AltarNumber ?? null, bogwija: r.Bogwija ?? null, relationship: r.Relationship ?? null,
    bokjunja: r.Bokjunja ?? null, spiritual: r.Spiritual ?? null, yesujae: r.Yesujae ?? null, seongju12: r.Seongju12 ?? null,
    _birthdayCode: has(r.Birthday) ? Math.trunc(Number(r.Birthday)) : null,
    memo: r.Memo ?? null, isCanceled: yn(r.CancelYN), canceledAt: parseDate(r.CancelDate), canceledBy: staffIdSet.has(staffBig(r.CancelStaff)?.toString()) ? staffBig(r.CancelStaff) : null,
    isCertificateIssued: yn(r.CertificateIssue), certificateIssuedDate: parseDate(r.CertificateIssueDate),
  }));

  const extracted = { commonCode: tCommon.length, sexagenaryYear: tSexa.length, missionary: tMiss.length, buddhistServiceItem: tItems.length, member: tMembers.length, enshrinementEvent: tFuneral.length, buddhistServiceReg: tRegs.length, counsel: tCounsels.length, staff: tStaff.length };
  const emit = (obj) => console.log('__RESULT__ ' + JSON.stringify(obj));

  if (DRY) {
    console.log('\n▶ DRY-RUN (쓰기 없음) — 변환 검증');
    console.log(`  공통코드 ${tCommon.length} / 육십갑자 ${tSexa.length} / 포교원장 ${tMiss.length} / 불사목록 ${tItems.length}`);
    console.log(`  회원 ${tMembers.length} / 봉안일 ${tFuneral.length} / 불사신청 ${tRegs.length} / 상담 ${tCounsels.length} / 사원 ${tStaff.length}`);
    console.log('  회원 샘플:', JSON.stringify(tMembers[0], (k, v) => typeof v === 'bigint' ? v.toString() : v));
    console.log('  불사 샘플:', JSON.stringify(tRegs[0], (k, v) => typeof v === 'bigint' ? v.toString() : v));
    const badDate = tRegs.filter((r) => r.registrationDate.getFullYear() === 2000).length;
    console.log(`  날짜 파싱 실패(2000 대체): regs ${badDate}`);
    emit({ ok: true, dryRun: true, extracted, badDate });
    await prisma.$disconnect();
    return;
  }

  // ---- 안전장치: 잘못된/빈 소스로 기존 데이터를 날리지 않도록 ----
  // 회원 0건이면 접속 대상(host/DB)이 틀렸을 가능성이 높음 → TRUNCATE 전에 중단.
  if (tMembers.length === 0 && process.env.ALLOW_EMPTY !== '1') {
    console.error('✗ 안전중단: 레거시에서 회원 0건 추출. 접속 대상(host/DB/user)이 올바른지 확인하세요. (강제하려면 ALLOW_EMPTY=1)');
    emit({ ok: false, dryRun: false, reason: 'empty_source', extracted });
    await prisma.$disconnect();
    process.exit(2);
  }

  // ---- 적재 ----
  console.log('\n▶ 업무 테이블 비우기(truncate CASCADE)...');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE buddhist_service_reg, counsel, deceased, enshrinement_event, member, missionary, buddhist_service_item, sexagenary_year_mapping, sexagenary_year, common_code RESTART IDENTITY CASCADE`);

  console.log('▶ 적재: 공통코드/육십갑자...');
  await prisma.commonCode.createMany({ data: tCommon });
  await prisma.sexagenaryYear.createMany({ data: tSexa.map(({ namede, ...x }) => ({ tenantId: TENANT, ...x })) });
  const sexRows = await prisma.sexagenaryYear.findMany({ select: { id: true, code: true } });
  const codeToSex = new Map(sexRows.map((s) => [s.code, s.id]));
  // 육십갑자 매핑(서기년)
  const mappings = [];
  for (const s of tSexa) { const id = codeToSex.get(s.code); if (!id || !s.namede) continue; for (const y of String(s.namede).split(',').map((x) => parseInt(x.trim(), 10)).filter(Number.isFinite)) mappings.push({ sexagenaryYearId: id, gregorianYear: y }); }
  if (mappings.length) await prisma.sexagenaryYearMapping.createMany({ data: mappings, skipDuplicates: true });

  console.log('▶ 적재: 포교원장/불사목록/회원/봉안일...');
  await prisma.missionary.createMany({ data: tMiss });
  await prisma.buddhistServiceItem.createMany({ data: tItems });
  for (let i = 0; i < tMembers.length; i += 2000) await prisma.member.createMany({ data: tMembers.slice(i, i + 2000) });
  await prisma.enshrinementEvent.createMany({ data: tFuneral });

  console.log('▶ 적재: 사원(upsert) + 계정...');
  for (const s of tStaff) { if (!s.id) continue; await prisma.staff.upsert({ where: { id: s.id }, create: s, update: s }); }
  const adminRole = await prisma.role.findFirst({ where: { code: 'ADMIN' } });
  const pwHash = await argon2.hash(TEMP_PW);
  for (const a of accounts) {
    const sid = staffBig(a.StaffID); if (!has(a.LoginID)) continue;
    const exists = await prisma.userAccount.findFirst({ where: { tenantId: TENANT, loginId: String(a.LoginID) } });
    if (exists) continue;
    const acc = await prisma.userAccount.create({ data: { tenantId: TENANT, staffId: sid, loginId: String(a.LoginID), passwordHash: pwHash, mustResetPassword: true, isActive: true } });
    if (adminRole) await prisma.userRole.create({ data: { userAccountId: acc.id, roleId: adminRole.id } });
  }

  console.log('▶ 적재: 불사신청(24k, 배치)...');
  let n = 0;
  for (let i = 0; i < tRegs.length; i += 2000) {
    const batch = tRegs.slice(i, i + 2000).map(({ _birthdayCode, ...x }) => ({ ...x, sexagenaryYearId: _birthdayCode != null ? (codeToSex.get(_birthdayCode) ?? null) : null }));
    await prisma.buddhistServiceReg.createMany({ data: batch });
    n += batch.length; process.stdout.write(`\r  ${n}/${tRegs.length}`);
  }
  console.log('');
  await prisma.counsel.createMany({ data: tCounsels });

  console.log('▶ 시퀀스 재설정...');
  for (const [tbl] of [['member'], ['missionary'], ['buddhist_service_item'], ['buddhist_service_reg'], ['enshrinement_event'], ['counsel'], ['staff']])
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('${tbl}','id'), GREATEST((SELECT COALESCE(MAX(id),1) FROM ${tbl}),1))`);

  console.log('\n▶ 검증(적재 건수):');
  const loaded = {};
  let allMatch = true;
  for (const [name, model, exp] of [['공통코드', 'commonCode', tCommon.length], ['육십갑자', 'sexagenaryYear', tSexa.length], ['포교원장', 'missionary', tMiss.length], ['불사목록', 'buddhistServiceItem', tItems.length], ['회원', 'member', tMembers.length], ['봉안일', 'enshrinementEvent', tFuneral.length], ['불사신청', 'buddhistServiceReg', tRegs.length], ['상담', 'counsel', tCounsels.length]]) {
    const c = await prisma[model].count();
    loaded[model] = c;
    if (c !== exp) allMatch = false;
    console.log(`  ${name}: ${c} / 기대 ${exp} ${c === exp ? '✅' : '❌ 불일치'}`);
  }
  await prisma.$disconnect();
  console.log(allMatch ? '\n✅ 마이그레이션 완료. (계정 임시비번:' : '\n❌ 마이그레이션 건수 불일치 — 로그 확인. (계정 임시비번:', TEMP_PW, '— 최초 로그인 변경 강제)');
  // ok 는 건수 검증(allMatch) 결과를 반영 — 불일치면 웹에서 실패로 표시.
  emit({ ok: allMatch, dryRun: false, extracted, loaded, allMatch, tempPassword: TEMP_PW });
}
main().catch((e) => { console.error('ERROR:', e); process.exit(1); });
