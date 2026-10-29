import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useLive } from "@/lib/live";
import { fmt } from "@/lib/util";
import { ScreenHeader } from "@/components/ui";
import { MemberCard } from "@/components/member-card";
import { currentRoles, canEdit } from "@/lib/roles";
import { regStatusBreakdown, nextEnshrineDday } from "@/lib/member-stats";

type StatusFilter = "all" | "soon" | "unissued";
const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "soon", label: "봉안일 임박" },
  { id: "unissued", label: "증서 미발급" },
];

// 표(셀타입) 열 정의 — 웹 회원현황 축약. 화면보다 넓으면 가로 스크롤.
const COLS: { key: string; label: string; w: number }[] = [
  { key: "name", label: "이름", w: 84 },
  { key: "item", label: "불사목록", w: 118 },
  { key: "event", label: "봉안일", w: 94 },
  { key: "altar", label: "단번호", w: 58 },
  { key: "status", label: "상태", w: 60 },
  { key: "date", label: "입력일", w: 86 },
];
const TABLE_W = COLS.reduce((s, c) => s + c.w, 0);

interface FlatRow {
  id: string; memberId: string; name: string; item: string; event: string;
  altar: string; status: "증서" | "신청" | "취소"; date: string; eventId: string | null;
}

function regStatus(r: { canceled: boolean; cert: boolean }): "증서" | "신청" | "취소" {
  return r.canceled ? "취소" : r.cert ? "증서" : "신청";
}
const STATUS_CLS: Record<string, string> = {
  증서: "text-celadon dark:text-celadon-dark",
  신청: "text-ink-soft dark:text-ink-softDark",
  취소: "text-vermilion",
};

export default function MembersScreen() {
  const live = useLive(true);
  const router = useRouter();
  const editable = canEdit(currentRoles());
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [view, setView] = useState<"card" | "table">("card");
  const lc = q.trim().toLowerCase();

  const searched = useMemo(
    () => (lc ? live.members.filter((m) => m.name.toLowerCase().includes(lc) || (m.missionary ?? "").toLowerCase().includes(lc) || (m.phone ?? "").includes(q)) : live.members),
    [live.members, lc, q],
  );

  // 다가오는(오늘 이후) 봉안일 이벤트 id — 표/카드의 '임박' 필터 공용.
  const upcomingEventIds = useMemo(() => {
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const s = new Set<string>();
    for (const e of live.enshrinements) {
      if (!e.eventDateSolar) continue;
      const [y, mo, d] = e.eventDateSolar.slice(0, 10).split("-").map(Number);
      if (Math.round((new Date(y, mo - 1, d).getTime() - base) / 86_400_000) >= 0) s.add(String(e.id));
    }
    return s;
  }, [live.enshrinements]);

  // 카드 뷰: 회원 단위
  const cardList = useMemo(() => {
    if (filter === "soon") return searched.filter((m) => nextEnshrineDday(m, live.enshrinements) !== null);
    if (filter === "unissued") return searched.filter((m) => regStatusBreakdown(m.regs).pending > 0);
    return searched;
  }, [searched, live.enshrinements, filter]);

  // 표 뷰: 불사 신청 1건 = 1행
  const tableRows = useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = searched.flatMap((m) =>
      m.regs.map((r) => ({
        id: `${m.id}-${r.id}`, memberId: String(m.id), name: m.name,
        item: r.item || "—", event: r.event || "—", altar: r.altar || "—",
        status: regStatus(r), date: (r.date || "").slice(0, 10), eventId: r.eventId ?? null,
      })),
    );
    if (filter === "unissued") return rows.filter((r) => r.status === "신청");
    if (filter === "soon") return rows.filter((r) => r.eventId && upcomingEventIds.has(r.eventId));
    return rows;
  }, [searched, filter, upcomingEventIds]);

  const loading = live.loading && live.members.length === 0;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-hanji dark:bg-hanji-dark">
      <ScreenHeader title="회원현황" subtitle={`회원별 불사·봉안일 현황 · ${fmt(live.members.length)}명`} right={editable ? <Pressable onPress={() => router.push("/member/new")} hitSlop={8} className="flex-row items-center gap-1 active:opacity-60"><Ionicons name="add" size={18} color="#2f7d6b" /><Text className="font-bodyb text-[14px] text-celadon dark:text-celadon-dark">회원</Text></Pressable> : null} />
      <View className="px-5 pb-2">
        <View className="flex-row items-center gap-2 rounded-2xl border border-line bg-hanji-card px-3.5 py-3 dark:border-line-dark dark:bg-hanji-cardDark">
          <Ionicons name="search" size={17} color="#a39a88" />
          <TextInput value={q} onChangeText={setQ} placeholder="이름·포교원장·전화 검색" placeholderTextColor="#a39a88" autoCorrect={false} className="flex-1 font-body text-[15px] text-ink dark:text-ink-dark" />
          {q ? <Ionicons name="close-circle" size={18} color="#a39a88" onPress={() => setQ("")} /> : null}
        </View>
        <View className="mt-2 flex-row items-center gap-2">
          {FILTERS.map((f) => {
            const on = filter === f.id;
            return (
              <Pressable key={f.id} onPress={() => setFilter(f.id)} hitSlop={4}
                className={`rounded-full border px-3 py-1.5 active:opacity-70 ${on ? "border-celadon bg-celadon-soft dark:border-celadon-dark dark:bg-celadon-deep/40" : "border-line bg-hanji-card dark:border-line-dark dark:bg-hanji-cardDark"}`}>
                <Text className={`font-bodyb text-[12px] ${on ? "text-celadon dark:text-celadon-dark" : "text-ink-soft dark:text-ink-softDark"}`}>{f.label}</Text>
              </Pressable>
            );
          })}
          {/* 카드 / 표(셀타입) 전환 */}
          <View className="ml-auto flex-row overflow-hidden rounded-full border border-line dark:border-line-dark">
            {(["card", "table"] as const).map((v) => {
              const on = view === v;
              return (
                <Pressable key={v} onPress={() => setView(v)} hitSlop={4} className={`px-2.5 py-1.5 ${on ? "bg-celadon-soft dark:bg-celadon-deep/40" : "bg-hanji-card dark:bg-hanji-cardDark"}`}>
                  <Ionicons name={v === "card" ? "list" : "grid"} size={15} color={on ? "#2f7d6b" : "#a39a88"} />
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#2f7d6b" /></View>
      ) : view === "card" ? (
        <FlashList
          data={cardList}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View className="h-2" />}
          refreshControl={<RefreshControl refreshing={live.loading} onRefresh={live.reload} tintColor="#2f7d6b" />}
          renderItem={({ item: m }) => (
            <MemberCard member={m} enshrinements={live.enshrinements} onPress={() => router.push(`/member/${m.id}`)} />
          )}
          ListEmptyComponent={<Text className="p-10 text-center font-body text-sm text-ink-soft">검색 결과 없음</Text>}
        />
      ) : (
        <ScrollView horizontal style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} showsHorizontalScrollIndicator>
          <View style={{ width: TABLE_W, flex: 1 }}>
            {/* 헤더 행 */}
            <View className="flex-row border-y border-line bg-hanji-card dark:border-line-dark dark:bg-hanji-cardDark">
              {COLS.map((c) => (
                <Text key={c.key} style={{ width: c.w }} className="px-2 py-2 font-bodyb text-[11px] text-ink-soft dark:text-ink-softDark">{c.label}</Text>
              ))}
            </View>
            <FlashList
              data={tableRows}
              keyExtractor={(r) => r.id}
              style={{ flex: 1 }}
              refreshControl={<RefreshControl refreshing={live.loading} onRefresh={live.reload} tintColor="#2f7d6b" />}
              renderItem={({ item: r }) => (
                <Pressable onPress={() => router.push(`/member/${r.memberId}`)} className="flex-row items-center border-b border-line/50 active:opacity-60 dark:border-line-dark/50">
                  <Text style={{ width: COLS[0].w }} numberOfLines={1} className="px-2 py-2.5 font-bodyb text-[12.5px] text-ink dark:text-ink-dark">{r.name}</Text>
                  <Text style={{ width: COLS[1].w }} numberOfLines={1} className="px-2 py-2.5 font-body text-[12.5px] text-ink dark:text-ink-dark">{r.item}</Text>
                  <Text style={{ width: COLS[2].w }} numberOfLines={1} className="px-2 py-2.5 font-body text-[12.5px] text-ink-soft dark:text-ink-softDark">{r.event}</Text>
                  <Text style={{ width: COLS[3].w }} numberOfLines={1} className="px-2 py-2.5 font-body text-[12.5px] text-ink-soft dark:text-ink-softDark">{r.altar}</Text>
                  <Text style={{ width: COLS[4].w }} numberOfLines={1} className={`px-2 py-2.5 font-bodyb text-[12px] ${STATUS_CLS[r.status]}`}>{r.status}</Text>
                  <Text style={{ width: COLS[5].w }} numberOfLines={1} className="px-2 py-2.5 font-body text-[11.5px] text-ink-soft dark:text-ink-softDark">{r.date}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text className="p-10 text-center font-body text-sm text-ink-soft">불사 신청 없음</Text>}
            />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
