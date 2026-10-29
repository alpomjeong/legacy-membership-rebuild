import { useMemo, useState } from "react";
import { RefreshControl, Text, TextInput, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useLive } from "@/lib/live";
import { fmt } from "@/lib/util";
import { ScreenHeader } from "@/components/ui";
import { BulsaCard } from "@/components/bulsa-card";
import type { Reg } from "@/lib/data";

interface Row { reg: Reg; memberId: string; name: string }

export default function BulsaScreen() {
  const live = useLive(true);
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpen((p) => ({ ...p, [id]: !p[id] }));
  const lc = q.trim().toLowerCase();
  const rows = useMemo<Row[]>(() =>
    live.members.flatMap((m) => m.regs.map((r) => ({ reg: r, memberId: String(m.id), name: m.name })))
      .sort((a, b) => (b.reg.date || "").localeCompare(a.reg.date || "")), [live.members]);
  const list = useMemo(() => (lc ? rows.filter((r) => r.name.toLowerCase().includes(lc) || r.reg.item.toLowerCase().includes(lc) || (r.reg.altar ?? "").toLowerCase().includes(lc)) : rows), [rows, lc]);
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-hanji dark:bg-hanji-dark">
      <ScreenHeader title="불사 신청" subtitle={`${fmt(rows.length)}건 · 회원·항목·단번호 검색`} />
      <View className="px-5 pb-2">
        <View className="flex-row items-center gap-2 rounded-2xl border border-line bg-hanji-card px-3.5 py-3 dark:border-line-dark dark:bg-hanji-cardDark">
          <Ionicons name="search" size={17} color="#a39a88" />
          <TextInput value={q} onChangeText={setQ} placeholder="불사 검색" placeholderTextColor="#a39a88" autoCorrect={false} className="flex-1 font-body text-[15px] text-ink dark:text-ink-dark" />
        </View>
      </View>
      <FlashList
        data={list}
        keyExtractor={(r) => String(r.reg.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 }}
        ItemSeparatorComponent={() => <View className="h-2" />}
        refreshControl={<RefreshControl refreshing={live.loading} onRefresh={live.reload} tintColor="#2f7d6b" />}
        renderItem={({ item: r }) => <BulsaCard reg={r.reg} memberName={r.name} onPress={() => router.push(`/member/${r.memberId}`)} expanded={!!open[String(r.reg.id)]} onToggle={() => toggle(String(r.reg.id))} />}
      />
    </SafeAreaView>
  );
}
