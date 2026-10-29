import { useMemo } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLive } from "@/lib/live";
import { daysUntil, fmt } from "@/lib/util";
import { ScreenHeader, SectionTitle, EmptyBox } from "@/components/ui";

export default function ReportsScreen() {
  const live = useLive(true);
  const s = useMemo(() => {
    let regs = 0, cert = 0, canceled = 0, cns = 0;
    const byType: Record<string, number> = {}; const byMiss: Record<string, number> = {};
    for (const m of live.members) {
      cns += m.counsels.length;
      if (m.missionary) byMiss[m.missionary] = (byMiss[m.missionary] ?? 0) + 1;
      for (const r of m.regs) { regs++; if (r.canceled) canceled++; else if (r.cert) cert++; const t = r.type || "미설정"; byType[t] = (byType[t] ?? 0) + 1; }
    }
    const soon = live.enshrinements.filter((e) => { const d = daysUntil(e.eventDateSolar); return d >= 0 && d <= 30; }).length;
    return { regs, cert, canceled, cns, soon, byType: Object.entries(byType).sort((a, b) => b[1] - a[1]), byMiss: Object.entries(byMiss).sort((a, b) => b[1] - a[1]).slice(0, 8) };
  }, [live.members, live.enshrinements]);

  const tiles: [string, number][] = [["회원", live.members.length], ["불사 신청", s.regs], ["증서 발급", s.cert], ["상담", s.cns], ["30일 내 봉안일", s.soon], ["취소", s.canceled]];
  const max1 = Math.max(1, ...s.byType.map((x) => x[1])); const max2 = Math.max(1, ...s.byMiss.map((x) => x[1]));
  const Bar = ({ label, val, max, color }: { label: string; val: number; max: number; color: string }) => (
    <View className="mb-2.5 flex-row items-center gap-2">
      <Text numberOfLines={1} className="w-28 font-body text-[12.5px] text-ink-soft dark:text-ink-softDark">{label}</Text>
      <View className="h-2.5 flex-1 overflow-hidden rounded-full bg-line/70 dark:bg-line-dark"><View style={{ width: `${(val / max) * 100}%`, backgroundColor: color }} className="h-full rounded-full" /></View>
      <Text className="w-12 text-right font-bodyb text-[12.5px] text-ink dark:text-ink-dark">{fmt(val)}</Text>
    </View>
  );

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-hanji dark:bg-hanji-dark">
      <ScreenHeader title="대시보드" subtitle="실시간 현황" />
      <ScrollView className="flex-1 px-5" refreshControl={<RefreshControl refreshing={live.loading} onRefresh={live.reload} tintColor="#2f7d6b" />}>
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {tiles.map(([k, v]) => (
            <View key={k} style={{ width: "48%" }} className="rounded-2xl border border-line bg-hanji-card p-4 dark:border-line-dark dark:bg-hanji-cardDark">
              <Text className="font-bodym text-[11px] text-ink-soft dark:text-ink-softDark">{k}</Text>
              <Text className="mt-1 font-display text-[26px] text-ink dark:text-ink-dark">{fmt(v)}</Text>
            </View>
          ))}
        </View>
        <View className="pt-5"><SectionTitle title="서비스 타입별" /></View>
        <View className="rounded-2xl border border-line bg-hanji-card p-3.5 dark:border-line-dark dark:bg-hanji-cardDark">{s.byType.map(([k, v]) => <Bar key={k} label={k} val={v} max={max1} color="#2f7d6b" />)}</View>
        <View className="pt-5"><SectionTitle title="포교원장별 회원 (상위 8)" /></View>
        <View className="rounded-2xl border border-line bg-hanji-card p-3.5 dark:border-line-dark dark:bg-hanji-cardDark">{s.byMiss.length === 0 ? <EmptyBox>데이터 없음</EmptyBox> : s.byMiss.map(([k, v]) => <Bar key={k} label={k} val={v} max={max2} color="#b8923f" />)}</View>
        <View className="h-6" />
      </ScrollView>
    </SafeAreaView>
  );
}
