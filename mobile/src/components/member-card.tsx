import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Member } from "@/lib/data";
import type { Enshrinement } from "@/lib/types";
import { initials } from "@/lib/util";
import { regStatusBreakdown, nextEnshrineDday } from "@/lib/member-stats";

function StatChip({ label, n, tone }: { label: string; n: number; tone: "cert" | "pending" | "cancel" }) {
  if (n === 0) return null;
  const cls = tone === "cert" ? "text-celadon dark:text-celadon-dark" : tone === "cancel" ? "text-vermilion" : "text-ink-soft dark:text-ink-softDark";
  return <Text className={`font-bodyb text-[12px] ${cls}`}>{label} {n}</Text>;
}

export function MemberCard({ member, enshrinements, onPress }: { member: Member; enshrinements: Enshrinement[]; onPress: () => void }) {
  const s = regStatusBreakdown(member.regs);
  const dday = nextEnshrineDday(member, enshrinements);
  const noStats = s.cert === 0 && s.pending === 0 && s.canceled === 0;
  return (
    <Pressable onPress={onPress} className="rounded-2xl border border-line bg-hanji-card p-3.5 active:opacity-70 dark:border-line-dark dark:bg-hanji-cardDark">
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-celadon-soft dark:bg-celadon-deep/40"><Text className="font-bodyb text-[14px] text-celadon dark:text-celadon-dark">{initials(member.name)}</Text></View>
        <View className="flex-1">
          <Text numberOfLines={1} className="font-bodyb text-[15px] text-ink dark:text-ink-dark">{member.name}{member.missionary ? <Text className="font-body text-[13px] text-ink-soft dark:text-ink-softDark">  {member.missionary}</Text> : null}</Text>
          <Text numberOfLines={1} className="mt-0.5 font-body text-[12.5px] text-ink-soft dark:text-ink-softDark">{member.phone || "전화번호 없음"}</Text>
        </View>
        {dday !== null ? <View className="rounded-full bg-vermilion-soft px-2.5 py-1"><Text className="font-bodyb text-[11px] text-vermilion">{dday === 0 ? "오늘" : `D-${dday}`}</Text></View> : null}
        <Ionicons name="chevron-forward" size={16} color="#c9bfa9" />
      </View>
      <View className="mt-2 flex-row items-center gap-3 pl-14">
        {noStats ? <Text className="font-body text-[12px] text-ink-soft dark:text-ink-softDark">불사 없음</Text> : (
          <>
            <StatChip label="증서" n={s.cert} tone="cert" />
            <StatChip label="신청" n={s.pending} tone="pending" />
            <StatChip label="취소" n={s.canceled} tone="cancel" />
          </>
        )}
        {member.counsels.length > 0 ? <Text className="font-body text-[12px] text-ink-soft dark:text-ink-softDark">상담 {member.counsels.length}</Text> : null}
      </View>
    </Pressable>
  );
}
