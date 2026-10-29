import { useMemo } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLive } from "@/lib/live";
import { day, fmt } from "@/lib/util";
import { ScreenHeader, EmptyBox } from "@/components/ui";

export default function CounselScreen() {
  const live = useLive(true);
  const list = useMemo(
    () => live.members.flatMap((m) => m.counsels.map((c) => ({ ...c, name: m.name, missionary: m.missionary }))).sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    [live.members],
  );
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-hanji dark:bg-hanji-dark">
      <ScreenHeader title="상담" subtitle={`${fmt(list.length)}건 · 회원 상세에서 추가`} />
      <ScrollView className="flex-1 px-5" refreshControl={<RefreshControl refreshing={live.loading} onRefresh={live.reload} tintColor="#2f7d6b" />}>
        {list.length === 0 ? <EmptyBox>상담 내역 없음</EmptyBox> : list.map((c, i) => (
          <View key={i} className="mb-2 rounded-2xl border border-line bg-hanji-card p-3.5 dark:border-line-dark dark:bg-hanji-cardDark">
            <View className="flex-row items-center gap-2"><Text numberOfLines={1} className="flex-1 font-bodyb text-[14px] text-ink dark:text-ink-dark">{c.name}{c.missionary ? <Text className="font-body text-ink-soft dark:text-ink-softDark">  {c.missionary}</Text> : null}</Text><Text className="font-bodym text-[12px] text-ink-soft dark:text-ink-softDark">{day(c.date)}</Text></View>
            <Text className="mt-1 font-body text-[13.5px] text-ink dark:text-ink-dark">{c.desc}</Text>
          </View>
        ))}
        <View className="h-6" />
      </ScrollView>
    </SafeAreaView>
  );
}
