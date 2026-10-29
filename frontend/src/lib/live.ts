import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Member, Reg, Counsel } from "@/data";
import type {
  BuddhistService,
  Counsel as ApiCounsel,
  Enshrinement,
  Member as ApiMember,
  Missionary,
  Paged,
  ServiceItem,
} from "@/lib/types";

/** 서비스 타입 코드 → 프로토타입 한글 라벨(SLOT_DEFS 키). */
export function serviceTypeLabel(code: string | null | undefined): string {
  if (code === "TABLET") return "위패형";
  if (code === "GUARDIAN12") return "12지신등명불형";
  return "미설정";
}

const day = (s: string | null) => (s ? s.slice(0, 10) : null);

interface LiveCore {
  members: Member[];
  items: ServiceItem[];
  missionaries: Missionary[];
  enshrinements: Enshrinement[];
}

export interface LiveData extends LiveCore {
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** API 응답을 프로토타입(temple-admin) Member/Reg 형태로 어댑트한다. */
async function fetchLive(): Promise<LiveCore> {
  const [members, regs, counsels, items, missionaries, ens] = await Promise.all([
    api.get<Paged<ApiMember>>("/members?pageSize=100000"),
    api.get<Paged<BuddhistService>>("/buddhist-services?pageSize=100000&includeCanceled=true"),
    api.get<Paged<ApiCounsel>>("/counsels?pageSize=100000&from=2000-01-01T00:00:00Z"),
    api.get<ServiceItem[]>("/buddhist-service-items"),
    api.get<Missionary[]>("/missionaries"),
    api.get<Paged<Enshrinement>>("/enshrinements?pageSize=100000"),
  ]);

  const typeByItemId = new Map(items.map((i) => [i.id, serviceTypeLabel(i.serviceTypeCode)]));

  // 봉안일 표기 — 본질은 "언제 봉안하는지"라 날짜+시간만 표시(라벨은 봉안일 화면·선택 드롭다운에서 확인).
  const p2 = (n: number) => String(n).padStart(2, "0");
  const ensDisplayById = new Map(
    ens.items.map((e) => {
      const d = new Date(e.eventDateSolar);
      return [
        e.id,
        Number.isNaN(d.getTime())
          ? null
          : `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`,
      ];
    }),
  );

  const regsByMember = new Map<string, Reg[]>();
  for (const r of regs.items) {
    const reg: Reg = {
      id: r.id,
      date: day(r.registrationDate) ?? "",
      staff: r.staffName ?? "",
      event: r.enshrinementEventId
        ? (ensDisplayById.get(r.enshrinementEventId) ?? r.enshrinementLabel)
        : r.enshrinementLabel,
      item: r.buddhistServiceItemName ?? "",
      type: typeByItemId.get(r.buddhistServiceItemId) ?? "미설정",
      altar: r.altarNumber ?? "",
      bogwija: r.bogwija ?? undefined,
      rel: r.relationship ?? undefined,
      bokjunja: r.bokjunja ?? undefined,
      spirit: r.spiritual ?? undefined,
      yesujae: r.yesujae ?? undefined,
      seongju: r.seongju12 ?? undefined,
      sexagenary: undefined,
      donation: r.donationAmount ? Number(r.donationAmount) : 0,
      memo: r.memo ?? undefined,
      canceled: r.isCanceled,
      cancelDate: day(r.canceledAt) ?? undefined,
      cancelBy: undefined,
      cert: r.isCertificateIssued,
      certDate: day(r.certificateIssuedDate) ?? undefined,
      createdAt: r.createdAt?.replace("T", " ").slice(0, 16) ?? "",
      createdBy: "",
      itemId: r.buddhistServiceItemId,
      eventId: r.enshrinementEventId,
      staffId: r.staffId,
      sexagenaryYearId: r.sexagenaryYearId,
      memberId: r.memberId,
    };
    const list = regsByMember.get(r.memberId) ?? [];
    list.push(reg);
    regsByMember.set(r.memberId, list);
  }

  const cnsByMember = new Map<string, Counsel[]>();
  for (const c of counsels.items) {
    const cns: Counsel = {
      date: c.counseledAt?.replace("T", " ").slice(0, 16) ?? "",
      desc: c.content,
    };
    const list = cnsByMember.get(c.memberId) ?? [];
    list.push(cns);
    cnsByMember.set(c.memberId, list);
  }

  const liveMembers: Member[] = members.items.map((m) => ({
    id: m.id,
    name: m.memberName,
    missionary: m.missionaryName ?? "",
    phone: m.phone ?? "",
    aff: m.affiliationCode ?? "",
    addr: [m.address, m.addressDetail].filter(Boolean).join(" "),
    memo: m.memo ?? "",
    regs: regsByMember.get(m.id) ?? [],
    counsels: cnsByMember.get(m.id) ?? [],
  }));

  return { members: liveMembers, items, missionaries, enshrinements: ens.items };
}

/** TanStack Query 기반 라이브 데이터 훅 — 캐시/무효화 표준화(TS-4). */
export function useLive(enabled: boolean): LiveData {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["live"],
    queryFn: fetchLive,
    enabled,
  });
  return {
    members: data?.members ?? [],
    items: data?.items ?? [],
    missionaries: data?.missionaries ?? [],
    enshrinements: data?.enshrinements ?? [],
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    reload: () => {
      void qc.invalidateQueries({ queryKey: ["live"] });
    },
  };
}
