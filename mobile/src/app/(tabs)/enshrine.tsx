import { useMemo, useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useLive } from "@/lib/live";
import { day, daysUntil, fmt } from "@/lib/util";
import { ScreenHeader, EmptyBox } from "@/components/ui";
import { BulsaCard } from "@/components/bulsa-card";
import type { Reg } from "@/lib/data";
import type { Enshrinement } from "@/lib/types";

interface RegEntry { reg: Reg; memberId: string; name: string }

export default function EnshrineScreen() {
  const live = useLive(true);
  const router = useRouter();
  const [sheet, setSheet] = useState<{ title: string; entries: RegEntry[] } | null>(null);
  const [q, setQ] = useState("");
  const [openReg, setOpenReg] = useState<Record<string, boolean>>({});
  const toggleReg = (id: string) => setOpenReg((p) => ({ ...p, [id]: !p[id] }));

  const byEvent = useMemo(() => {
    const map = new Map<string, RegEntry[]>();
    for (const m of live.members) for (const r of m.regs) {
      if (!r.eventId) continue;
      const arr = map.get(r.eventId) ?? []; arr.push({ reg: r, memberId: String(m.id), name: m.name }); map.set(r.eventId, arr);
    }
    return map;
  }, [live.members]);
  const { upcoming, past } = useMemo(() => {
    const up: Enshrinement[] = []; const pa: Enshrinement[] = [];
    for (const e of live.enshrinements) (daysUntil(e.eventDateSolar) >= 0 ? up : pa).push(e);
    up.sort((a, b) => a.eventDateSolar.localeCompare(b.eventDateSolar));
    pa.sort((a, b) => b.eventDateSolar.localeCompare(a.eventDateSolar));
    return { upcoming: up, past: pa };
  }, [live.enshrinements]);

  const closeSheet = () => { setSheet(null); setQ(""); setOpenReg({}); };
  const goMember = (id: string) => { closeSheet(); router.push(`/member/${id}`); };
  const openEvent = (e: Enshrinement, entries: RegEntry[]) => {
    if (entries.length === 0) return;
    if (entries.length === 1) { router.push(`/member/${entries[0].memberId}`); return; }
    setQ(""); setSheet({ title: `${day(e.eventDateSolar)}${e.label ? `  ${e.label}` : ""}`, entries });
  };

  const lc = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    const base = sheet?.entries ?? [];
    if (!lc) return base;
    return base.filter((x) => x.name.toLowerCase().includes(lc) || x.reg.item.toLowerCase().includes(lc) || (x.reg.altar ?? "").toLowerCase().includes(lc));
  }, [sheet, lc]);

  const Card = (e: Enshrinement) => {
    const d = daysUntil(e.eventDateSolar); const soon = d >= 0 && d <= 30;
    const entries = byEvent.get(e.id) ?? [];
    const has = entries.length > 0;
    const distinctNames = [...new Map(entries.map((x) => [x.memberId, x.name])).values()];
    const preview = distinctNames.slice(0, 3).join(", ");
    return (
      <Pressable key={e.id} onPress={() => openEvent(e, entries)} disabled={!has} className={`mb-2 flex-row items-center gap-3 rounded-2xl border bg-hanji-card p-3.5 dark:bg-hanji-cardDark ${soon ? "border-celadon/40" : "border-line dark:border-line-dark"} ${has ? "active:opacity-70" : ""}`}>
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-celadon-soft dark:bg-celadon-deep/40"><Ionicons name="calendar" size={19} color="#2f7d6b" /></View>
        <View className="flex-1">
          <Text className="font-bodyb text-[14px] text-ink dark:text-ink-dark">{day(e.eventDateSolar)}{e.label ? `  ${e.label}` : ""}</Text>
          <Text numberOfLines={1} className="mt-0.5 font-body text-[12.5px] text-ink-soft dark:text-ink-softDark">{has ? `불사 ${entries.length}건 · ${preview}${distinctNames.length > 3 ? ` 외 ${distinctNames.length - 3}명` : ""}` : "연결된 불사 없음"}</Text>
        </View>
        {d >= 0 ? <View className={`rounded-full px-2.5 py-1 ${soon ? "bg-vermilion-soft" : "bg-line/60 dark:bg-line-dark"}`}><Text className={`font-bodyb text-[11px] ${soon ? "text-vermilion" : "text-ink-soft dark:text-ink-softDark"}`}>{d === 0 ? "오늘" : `D-${d}`}</Text></View> : null}
        {has ? <Ionicons name="chevron-forward" size={16} color="#c9bfa9" /> : null}
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-hanji dark:bg-hanji-dark">
      <ScreenHeader title="봉안일·기일" subtitle={`${fmt(live.enshrinements.length)}건 · 임박순`} />
      <ScrollView className="flex-1 px-5" refreshControl={<RefreshControl refreshing={live.loading} onRefresh={live.reload} tintColor="#2f7d6b" />}>
        {live.enshrinements.length === 0 ? <EmptyBox>봉안일 없음</EmptyBox> : null}
        {upcoming.length > 0 && <Text className="mb-2 mt-1 font-bodyb text-[12px] text-celadon dark:text-celadon-dark">다가오는 일정 {upcoming.length}</Text>}
        {upcoming.map(Card)}
        {past.length > 0 && <Text className="mb-2 mt-3 font-bodyb text-[12px] text-ink-soft dark:text-ink-softDark">지난 일정</Text>}
        {past.map(Card)}
        <View className="h-6" />
      </ScrollView>

      <Modal visible={!!sheet} transparent animationType="slide" onRequestClose={closeSheet}>
        <Pressable onPress={closeSheet} className="flex-1 justify-end bg-black/40">
          <Pressable onPress={() => {}} className="h-[82%] rounded-t-3xl bg-hanji px-4 pt-4 dark:bg-hanji-dark">
            <View className="mb-2 flex-row items-start justify-between">
              <View className="flex-1 pr-2">
                <Text className="font-bodyb text-[15px] text-ink dark:text-ink-dark">{sheet?.title}</Text>
                <Text className="mt-0.5 font-body text-[12px] text-ink-soft dark:text-ink-softDark">관련 불사 {sheet?.entries?.length ?? 0}건</Text>
              </View>
              <Pressable onPress={closeSheet} hitSlop={8} className="active:opacity-60"><Ionicons name="close" size={22} color="#a39a88" /></Pressable>
            </View>
            <View className="mb-2 flex-row items-center gap-2 rounded-2xl border border-line bg-hanji-card px-3.5 py-3 dark:border-line-dark dark:bg-hanji-cardDark">
              <Ionicons name="search" size={17} color="#a39a88" />
              <TextInput value={q} onChangeText={setQ} placeholder="회원·항목·단번호 검색" placeholderTextColor="#a39a88" autoCorrect={false} className="flex-1 font-body text-[15px] text-ink dark:text-ink-dark" />
              {q ? <Ionicons name="close-circle" size={18} color="#a39a88" onPress={() => setQ("")} /> : null}
            </View>
            <View className="flex-1">
              <FlashList
                data={filtered}
                keyExtractor={(x) => String(x.reg.id)}
                contentContainerStyle={{ paddingTop: 2, paddingBottom: 24 }}
                ItemSeparatorComponent={() => <View className="h-2" />}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => <BulsaCard reg={item.reg} memberName={item.name} onPress={() => goMember(item.memberId)} expanded={!!openReg[String(item.reg.id)]} onToggle={() => toggleReg(String(item.reg.id))} />}
                ListEmptyComponent={<Text className="py-8 text-center font-body text-[14px] text-ink-soft dark:text-ink-softDark">검색 결과 없음</Text>}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
