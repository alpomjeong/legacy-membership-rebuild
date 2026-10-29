import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeMemberName } from '@domain/member';
import type { SheetRow } from '@infrastructure/excel/workbook-reader';

export interface ImportReport {
  total: number;
  loaded: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
}

export interface ServiceImportReport extends ImportReport {
  /** 시트에 없던 회원을 자동 생성한 수(이름+전화+소속·포교원장·생년월일 원문). */
  membersCreated: number;
  /** 시트의 일시로 새로 만든 봉안일(공유 이벤트) 수. */
  eventsCreated: number;
  /** 마스터에 없어 새로 만든 포교원장 수(이름만). */
  missionariesCreated: number;
}

/**
 * 불사 건 템플릿 헤더(한글). 레거시 엑셀 정리본 이관용(FR-MIG-*, .bak 대체 경로).
 * 레거시 실엑셀 별칭 허용: 회원명=신청자, 메모=기타메모. 소속·포교원장·생년월일은
 * 회원(피신청자) 속성으로 회원 자동생성 시 반영(레거시는 회원명단 분리 없이 불사 시트에 동봉).
 */
const HS = {
  memberName: '회원명',
  memberNameAlt: '신청자',
  phone: '전화',
  aff: '소속',
  missionary: '포교원장',
  item: '불사목록',
  regDate: '신청일',
  event: '봉안일',
  altar: '단번호',
  bogwija: '복위자',
  rel: '관계',
  bokjunja: '복전자',
  spirit: '영가',
  yesujae: '예수재',
  seongju: '12성주',
  birth: '생년월일',
  donation: '시주금액',
  canceled: '취소여부',
  cancelDate: '취소일자',
  cert: '증서발급',
  certDate: '증서발급일자',
  memo: '메모',
  memoAlt: '기타메모',
} as const;

/** 'YYYY-MM-DD[ HH:mm]' (구분자 - . / 허용) → Date. 빈 값 null, 형식 오류 undefined. */
function parseKDate(raw: string): Date | null | undefined {
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(
    /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/,
  );
  if (!m) return undefined;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4] ?? 0),
    Number(m[5] ?? 0),
  );
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** timestamptz → KST 벽시계 'YYYY-MM-DD HH:mm'(추출용, 서버 TZ 무관). 재업로드 parseKDate 와 왕복. */
function fmtKstDateTime(d: Date): string {
  const k = new Date(d.getTime() + 9 * 3_600_000); // UTC+9 로 옮겨 UTC 파트를 KST 벽시계로 읽음
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${k.getUTCFullYear()}-${p2(k.getUTCMonth() + 1)}-${p2(k.getUTCDate())} ${p2(k.getUTCHours())}:${p2(k.getUTCMinutes())}`;
}
/** timestamptz → KST 'YYYY-MM-DD'(취소일자·증서발급일자용). */
function fmtKstDate(d: Date): string {
  return fmtKstDateTime(d).slice(0, 10);
}

/**
 * 불사 건 추출(왕복) 컬럼 — 업로드 헤더(HS)와 동일하게 맞춰 '추출→수정→재업로드'를 보장한다.
 * (report 형식의 buddhist-services/export 와 별개 — 그건 사람이 보기용 요약 컬럼.)
 * key=header(한글) 로 buildSheet 가 그대로 매핑. 별칭은 신청자(=회원명)·기타메모(=메모) 사용.
 */
export const BUDDHIST_SERVICE_EXPORT_COLUMNS: {
  header: string;
  key: string;
}[] = [
  HS.memberNameAlt,
  HS.item,
  HS.aff,
  HS.missionary,
  HS.event,
  HS.altar,
  HS.bogwija,
  HS.rel,
  HS.bokjunja,
  HS.spirit,
  HS.yesujae,
  HS.seongju,
  HS.birth,
  HS.memoAlt,
  HS.cancelDate,
  HS.cert,
  HS.certDate,
].map((h) => ({ header: h, key: h }));

/**
 * DataImportService — 불사 건 일괄 업로드 (E1.8, FR-MIG-*).
 * 적재 전 검증(필수값) → 단일 트랜잭션 적재(부분 적재 0) → 행 단위 리포트.
 * OLEDB/문자열 보간 폐기(ExcelJS·Prisma 파라미터). 회원 정보는 불사 시트에 동봉돼 자동 반영.
 * (독립 회원 엑셀 업로드는 폐기 — 회원현황판에서 처리, 회원정보만 온전히 오는 경우 없음.)
 */
@Injectable()
export class DataImportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 불사 건 일괄 업로드 — 레거시 엑셀 정리본 이관(.bak 직접 업로드 대체 경로).
   * 회원=이름(+전화) 매칭(미존재 시 자동 생성), 불사목록=마스터 이름 매칭(미존재 행 오류),
   * 봉안일=동일 일시 공유 이벤트 연결(없으면 생성). 완전 동일 건은 스킵(재업로드 멱등).
   * 인물 슬롯 필수검증은 적용하지 않음 — 직접(MSSQL) 이관 경로와 동일하게 레거시 원본을 보존.
   * 레거시 실엑셀 대응: 헤더 별칭(신청자→회원명, 기타메모→메모), 회원 자동생성 시 소속·
   * 포교원장(미등록 자동생성)·생년월일 원문 반영, '취소일자'만 있어도 취소 처리, 신청일 없으면 오늘.
   */
  async importBuddhistServices(
    tenantId: bigint,
    actorId: bigint,
    rows: SheetRow[],
  ): Promise<ServiceImportReport> {
    const report: ServiceImportReport = {
      total: rows.length,
      loaded: 0,
      skipped: 0,
      errors: [],
      membersCreated: 0,
      eventsCreated: 0,
      missionariesCreated: 0,
    };

    const [items, members, events, missionaries, existingRegs] =
      await Promise.all([
        this.prisma.buddhistServiceItem.findMany({
          where: { tenantId, isDeleted: false },
          select: { id: true, name: true },
        }),
        this.prisma.member.findMany({
          where: { tenantId, isDeleted: false },
          select: { id: true, memberName: true, phone: true },
        }),
        this.prisma.enshrinementEvent.findMany({
          where: { tenantId, isDeleted: false },
          select: { id: true, eventDateSolar: true },
        }),
        this.prisma.missionary.findMany({
          where: { tenantId, isDeleted: false },
          select: { id: true, name: true },
        }),
        // 재업로드 멱등용 기존 건 스냅샷 — 행별 findFirst(N+1) 대체(수만 건 1쿼리 프리로드).
        this.prisma.buddhistServiceReg.findMany({
          where: { tenantId, isDeleted: false },
          select: {
            memberId: true,
            buddhistServiceItemId: true,
            registrationDate: true,
            altarNumber: true,
            enshrinementEventId: true,
          },
        }),
      ]);
    const itemByName = new Map(items.map((i) => [i.name, i.id]));
    const missionaryByName = new Map(missionaries.map((m) => [m.name, m.id]));
    const membersByName = new Map<
      string,
      { id: bigint; phone: string | null }[]
    >();
    for (const m of members) {
      const list = membersByName.get(m.memberName) ?? [];
      list.push({ id: m.id, phone: m.phone });
      membersByName.set(m.memberName, list);
    }
    const eventByTime = new Map(
      events.map((e) => [e.eventDateSolar.getTime(), e.id]),
    );

    // 재업로드 멱등 — 기존 건을 키 집합으로 프리로드(행별 findFirst 대체).
    //   dupWithDate: 신청일 포함 정확일치, dupNoDate: 신청일 무시(레거시 신청일 공란 대응,
    //   기존 findFirst 의 `registrationDate: undefined`(= 날짜 무시) 의미 보존).
    //   날짜 키는 로컬 연-월-일 — 운영 PC(Asia/Seoul)에서 @db.Date(UTC 자정→KST 09시 동일일)와
    //   parseKDate(로컬 자정)의 연-월-일이 일치. 타임존 캐스팅 함정 회피.
    const dateKeyOf = (d: Date | null | undefined): string =>
      d ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` : '';
    const dupKey = (
      memberId: bigint,
      itemId: bigint,
      dateKey: string,
      altar: string | null,
      eventId: bigint | null,
    ): string =>
      `${memberId}|${itemId}|${dateKey}|${altar ?? ''}|${eventId ?? ''}`;
    const dupWithDate = new Set<string>();
    const dupNoDate = new Set<string>();
    for (const r of existingRegs) {
      dupWithDate.add(
        dupKey(
          r.memberId,
          r.buddhistServiceItemId,
          dateKeyOf(r.registrationDate),
          r.altarNumber,
          r.enshrinementEventId,
        ),
      );
      dupNoDate.add(
        dupKey(
          r.memberId,
          r.buddhistServiceItemId,
          '',
          r.altarNumber,
          r.enshrinementEventId,
        ),
      );
    }

    // 파일 내 동일 신규 회원/봉안일/포교원장 중복 생성 방지용 pending 키
    const pendingMembers = new Map<
      string,
      {
        memberName: string;
        phone: string | null;
        affiliationCode: string | null;
        missionaryName: string | null;
        birthRaw: string | null;
      }
    >();
    const pendingEvents = new Map<number, Date>();
    const pendingMissionaries = new Set<string>();

    interface PlannedReg {
      memberId: bigint | null; // null=pending member
      memberKey: string | null;
      eventId: bigint | null; // null+eventTime=pending event
      eventTime: number | null;
      data: Omit<
        Prisma.BuddhistServiceRegCreateManyInput,
        'memberId' | 'enshrinementEventId'
      >;
    }
    const planned: PlannedReg[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const excelRow = i + 2;
      const err = (reason: string) =>
        report.errors.push({ row: excelRow, reason });

      const rawName = (
        row[HS.memberName] ??
        row[HS.memberNameAlt] ??
        ''
      ).trim();
      if (!rawName) {
        err('회원명(신청자) 누락(필수)');
        continue;
      }
      const memberName = normalizeMemberName(rawName);
      const phone = (row[HS.phone] ?? '').trim() || null;
      // 회원(피신청자) 속성 — 레거시 실엑셀은 불사 시트에 소속·포교원장·생년월일 동봉.
      const affiliationCode = (row[HS.aff] ?? '').trim() || null;
      const missionaryName = (row[HS.missionary] ?? '').trim() || null;
      const birthRaw = (row[HS.birth] ?? '').trim() || null;

      const itemName = (row[HS.item] ?? '').trim();
      if (!itemName) {
        err('불사목록 누락(필수)');
        continue;
      }
      const itemId = itemByName.get(itemName);
      if (!itemId) {
        err(`불사목록 미등록: "${itemName}" — 마스터에 먼저 등록하세요`);
        continue;
      }

      const regDate = parseKDate(row[HS.regDate] ?? '');
      if (regDate === undefined) {
        err(`신청일 형식 오류: "${row[HS.regDate]}" (YYYY-MM-DD)`);
        continue;
      }
      const eventDate = parseKDate(row[HS.event] ?? '');
      if (eventDate === undefined) {
        err(`봉안일 형식 오류: "${row[HS.event]}" (YYYY-MM-DD HH:mm)`);
        continue;
      }
      const cancelDate = parseKDate(row[HS.cancelDate] ?? '');
      if (cancelDate === undefined) {
        err(`취소일자 형식 오류: "${row[HS.cancelDate]}"`);
        continue;
      }
      const certDate = parseKDate(row[HS.certDate] ?? '');
      if (certDate === undefined) {
        err(`증서발급일자 형식 오류: "${row[HS.certDate]}"`);
        continue;
      }

      // 회원 매칭 — 이름(+전화). 0명=자동 생성 예약, 2명+(전화 무)=오류.
      let memberId: bigint | null = null;
      let memberKey: string | null = null;
      const candidates = membersByName.get(memberName) ?? [];
      const matched = phone
        ? candidates.filter((c) => c.phone === phone)
        : candidates;
      if (matched.length === 1) memberId = matched[0].id;
      else if (matched.length > 1) {
        err(
          `동명이인 ${matched.length}명 — [전화]로 구분하세요: ${memberName}`,
        );
        continue;
      } else {
        memberKey = `${memberName}|${phone ?? ''}`;
        if (!pendingMembers.has(memberKey))
          pendingMembers.set(memberKey, {
            memberName,
            phone,
            affiliationCode,
            missionaryName,
            birthRaw,
          });
        // 포교원장 미등록이면 자동 생성 예약(이름만).
        if (missionaryName && !missionaryByName.has(missionaryName))
          pendingMissionaries.add(missionaryName);
      }

      // 봉안일 매칭 — 동일 일시 공유 이벤트, 없으면 생성 예약.
      let eventId: bigint | null = null;
      let eventTime: number | null = null;
      if (eventDate) {
        eventId = eventByTime.get(eventDate.getTime()) ?? null;
        if (!eventId) {
          eventTime = eventDate.getTime();
          pendingEvents.set(eventTime, eventDate);
        }
      }

      // 취소 판정 — 명시 '취소여부'=취소 이거나, 레거시엔 칸이 없고 '취소일자'만 있으므로 그 존재로도 판정.
      const isCanceled =
        (row[HS.canceled] ?? '').trim() === '취소' || cancelDate != null;
      const isCert = (row[HS.cert] ?? '').trim() === '발급';
      const donationRaw = (row[HS.donation] ?? '').replace(/[^\d]/g, '');

      const altarNumber = (row[HS.altar] ?? '').trim() || null;

      // 완전 동일 건 스킵(기존 회원만 판정 가능) — 재업로드 멱등. 프리로드 키 집합으로 O(1) 판정.
      if (memberId) {
        const isDup = regDate
          ? dupWithDate.has(
              dupKey(
                memberId,
                itemId,
                dateKeyOf(regDate),
                altarNumber,
                eventId,
              ),
            )
          : dupNoDate.has(dupKey(memberId, itemId, '', altarNumber, eventId));
        if (isDup) {
          report.skipped++;
          continue;
        }
      }

      planned.push({
        memberId,
        memberKey,
        eventId,
        eventTime,
        data: {
          tenantId,
          registrationDate: regDate ?? new Date(),
          buddhistServiceItemId: itemId,
          altarNumber,
          bogwija: (row[HS.bogwija] ?? '').trim() || null,
          relationship: (row[HS.rel] ?? '').trim() || null,
          bokjunja: (row[HS.bokjunja] ?? '').trim() || null,
          spiritual: (row[HS.spirit] ?? '').trim() || null,
          yesujae: (row[HS.yesujae] ?? '').trim() || null,
          seongju12: (row[HS.seongju] ?? '').trim() || null,
          donationAmount: donationRaw ? new Prisma.Decimal(donationRaw) : null,
          memo: (row[HS.memo] ?? row[HS.memoAlt] ?? '').trim() || null,
          isCanceled,
          canceledAt: isCanceled ? (cancelDate ?? new Date()) : null,
          isCertificateIssued: isCert,
          certificateIssuedDate: isCert ? certDate : null,
          createdBy: actorId,
        },
      });
    }

    if (planned.length > 0) {
      // 대량 적재 — 엔티티별 createMany 배치 후 재조회로 id 매핑(행별 create 왕복 폐기).
      //   수만 행을 소수의 SQL 문으로 처리해 단일 트랜잭션 타임아웃(기본 5s)을 넘지 않게 한다.
      //   신규(pending) 키는 매칭 0건이라 기존 데이터와 disjoint → 이름/일시 재조회 결과는 이번 생성분.
      await this.prisma.$transaction(
        async (tx) => {
          // 1) 미등록 포교원장 자동 생성(이름만) → 이름→id.
          const missionaryIds = new Map(missionaryByName);
          if (pendingMissionaries.size > 0) {
            const names = [...pendingMissionaries];
            await tx.missionary.createMany({
              data: names.map((name) => ({
                tenantId,
                name,
                createdBy: actorId,
              })),
            });
            const created = await tx.missionary.findMany({
              where: { tenantId, isDeleted: false, name: { in: names } },
              select: { id: true, name: true },
            });
            for (const m of created) missionaryIds.set(m.name, m.id);
          }
          const resolveMissionaryId = (name: string | null): bigint | null =>
            name ? (missionaryIds.get(name) ?? null) : null;

          // 2) 미존재 회원 자동 생성 → key(이름|전화)→id.
          const memberIds = new Map<string, bigint>();
          if (pendingMembers.size > 0) {
            const list = [...pendingMembers.values()];
            await tx.member.createMany({
              data: list.map((m) => ({
                tenantId,
                memberName: m.memberName,
                phone: m.phone,
                affiliationCode: m.affiliationCode,
                missionaryId: resolveMissionaryId(m.missionaryName),
                birthRaw: m.birthRaw,
                memo: '불사 일괄 업로드로 자동 생성',
                createdBy: actorId,
              })),
            });
            const names = [...new Set(list.map((m) => m.memberName))];
            const created = await tx.member.findMany({
              where: { tenantId, isDeleted: false, memberName: { in: names } },
              select: { id: true, memberName: true, phone: true },
            });
            for (const m of created)
              memberIds.set(`${m.memberName}|${m.phone ?? ''}`, m.id);
          }

          // 3) 신규 봉안일(공유 이벤트) 자동 생성 → time→id.
          const eventIds = new Map<number, bigint>();
          if (pendingEvents.size > 0) {
            const dates = [...pendingEvents.values()];
            await tx.enshrinementEvent.createMany({
              data: dates.map((date) => ({
                tenantId,
                eventDateSolar: date,
                createdBy: actorId,
              })),
            });
            const created = await tx.enshrinementEvent.findMany({
              where: {
                tenantId,
                isDeleted: false,
                eventDateSolar: { in: dates },
              },
              select: { id: true, eventDateSolar: true },
            });
            for (const e of created)
              eventIds.set(e.eventDateSolar.getTime(), e.id);
          }

          // 4) 불사 건 대량 적재.
          await tx.buddhistServiceReg.createMany({
            data: planned.map((plan) => ({
              ...plan.data,
              memberId: plan.memberId ?? memberIds.get(plan.memberKey!)!,
              enshrinementEventId:
                plan.eventId ??
                (plan.eventTime != null
                  ? (eventIds.get(plan.eventTime) ?? null)
                  : null),
            })),
          });

          await tx.auditLog.create({
            data: {
              tenantId,
              userAccountId: actorId,
              actionType: 'buddhist_service.bulk_import',
              entityName: 'BuddhistServiceReg',
              afterJson: {
                loaded: planned.length,
                skipped: report.skipped,
                errors: report.errors.length,
                membersCreated: pendingMembers.size,
                eventsCreated: pendingEvents.size,
                missionariesCreated: pendingMissionaries.size,
              },
            },
          });
        },
        // 배치라 보통 수 초 내 완료되지만, 대량·저사양 PC 대비 안전망으로 상향.
        { timeout: 120_000, maxWait: 10_000 },
      );
      report.loaded = planned.length;
      report.membersCreated = pendingMembers.size;
      report.eventsCreated = pendingEvents.size;
      report.missionariesCreated = pendingMissionaries.size;
    }

    return report;
  }

  /**
   * 불사 건 전체를 업로드 양식(HS 헤더)과 동일한 시트 행으로 추출 — 백업 보조/사람 확인용.
   * 추출본을 그대로 다시 '불사 건 업로드'에 올리면 왕복(round-trip)된다. 필터 없이 전체(취소 포함),
   * 봉안일/증서발급일자/취소일자는 KST 벽시계 문자열, 단번호 등은 문자열 그대로(선행 0 보존).
   */
  async exportBuddhistServices(tenantId: bigint): Promise<SheetRow[]> {
    const regs = await this.prisma.buddhistServiceReg.findMany({
      where: { tenantId, isDeleted: false },
      include: {
        member: {
          select: {
            memberName: true,
            affiliationCode: true,
            birthRaw: true,
            missionary: { select: { name: true } },
          },
        },
        buddhistServiceItem: { select: { name: true } },
        enshrinementEvent: { select: { eventDateSolar: true } },
      },
      orderBy: [{ registrationDate: 'asc' }, { id: 'asc' }],
    });
    return regs.map((r) => ({
      [HS.memberNameAlt]: r.member?.memberName ?? '',
      [HS.item]: r.buddhistServiceItem?.name ?? '',
      [HS.aff]: r.member?.affiliationCode ?? '',
      [HS.missionary]: r.member?.missionary?.name ?? '',
      [HS.event]: r.enshrinementEvent?.eventDateSolar
        ? fmtKstDateTime(r.enshrinementEvent.eventDateSolar)
        : '',
      [HS.altar]: r.altarNumber ?? '',
      [HS.bogwija]: r.bogwija ?? '',
      [HS.rel]: r.relationship ?? '',
      [HS.bokjunja]: r.bokjunja ?? '',
      [HS.spirit]: r.spiritual ?? '',
      [HS.yesujae]: r.yesujae ?? '',
      [HS.seongju]: r.seongju12 ?? '',
      [HS.birth]: r.member?.birthRaw ?? '',
      [HS.memoAlt]: r.memo ?? '',
      [HS.cancelDate]:
        r.isCanceled && r.canceledAt ? fmtKstDate(r.canceledAt) : '',
      [HS.cert]: r.isCertificateIssued ? '발급' : '',
      [HS.certDate]: r.certificateIssuedDate
        ? fmtKstDate(r.certificateIssuedDate)
        : '',
    }));
  }

  /**
   * 업무 데이터 초기화 — 실서비스 전환/이관 전 정리(FR-MIG-*). 파괴적.
   * 보존: 테넌트·RBAC(계정/역할/권한/메뉴)·공통코드·육십갑자·불사목록(마스터)·감사로그.
   * 삭제: 회원·불사 건·봉안일·상담·피안치자·포교원장·사원.
   *
   * ⚠️ TRUNCATE ... CASCADE 금지: user_account.staff_id → staff FK 로 인해 CASCADE 가
   *    (데이터 유무와 무관하게 제약 존재만으로) user_account 까지 비워 계정이 사라진다.
   *    대신 자식→부모 의존순 deleteMany 를 단일 트랜잭션으로 실행 — staff FK 는 ON DELETE
   *    SET NULL 이라 계정은 보존되고 링크만 해제된다. 불사목록 마스터 보존 → 초기화 후 바로 업로드.
   */
  async resetBusinessData(
    tenantId: bigint,
    actorId: bigint,
  ): Promise<{
    before: Record<string, number>;
    after: Record<string, number>;
  }> {
    const before = await this.businessCounts(tenantId);
    const w = { where: { tenantId } };
    await this.prisma.$transaction([
      this.prisma.buddhistServiceReg.deleteMany(w),
      this.prisma.counsel.deleteMany(w),
      this.prisma.deceased.deleteMany(w),
      this.prisma.enshrinementEvent.deleteMany(w),
      this.prisma.member.deleteMany(w),
      this.prisma.missionary.deleteMany(w),
      this.prisma.staff.deleteMany(w),
      this.prisma.auditLog.create({
        data: {
          tenantId,
          userAccountId: actorId,
          actionType: 'data.reset_business',
          entityName: 'BusinessData',
          afterJson: before,
        },
      }),
    ]);
    const after = await this.businessCounts(tenantId);
    return { before, after };
  }

  private async businessCounts(
    tenantId: bigint,
  ): Promise<Record<string, number>> {
    const [member, reg, event, counsel, deceased, missionary, staff] =
      await Promise.all([
        this.prisma.member.count({ where: { tenantId } }),
        this.prisma.buddhistServiceReg.count({ where: { tenantId } }),
        this.prisma.enshrinementEvent.count({ where: { tenantId } }),
        this.prisma.counsel.count({ where: { tenantId } }),
        this.prisma.deceased.count({ where: { tenantId } }),
        this.prisma.missionary.count({ where: { tenantId } }),
        this.prisma.staff.count({ where: { tenantId } }),
      ]);
    return { member, reg, event, counsel, deceased, missionary, staff };
  }
}
