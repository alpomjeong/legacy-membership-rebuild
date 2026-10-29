import { Text, View } from "react-native";
import type { Reg, Counsel } from "@/lib/data";
import { regStatusBreakdown } from "@/lib/member-stats";

const Cell = ({ label, value }: { label: string; value: string }) => (
  <View className="flex-1 items-center"><Text className="font-display text-[18px] text-ink dark:text-ink-dark">{value}</Text><Text className="mt-0.5 font-bodym text-[11px] text-ink-soft dark:text-ink-softDark">{label}</Text></View>
);

export function MemberSummaryStrip({ regs, counsels, enshrineDday }: { regs: Reg[]; counsels: Counsel[]; enshrineDday: number | null }) {
  const s = regStatusBreakdown(regs);
  return (
    <View className="mx-5 mb-2 flex-row rounded-2xl border border-line bg-hanji-card py-3 dark:border-line-dark dark:bg-hanji-cardDark">
      <Cell label="불사" value={String(regs.length)} />
      <Cell label="증서" value={String(s.cert)} />
      <Cell label="상담" value={String(counsels.length)} />
      <Cell label="봉안일" value={enshrineDday === null ? "—" : enshrineDday === 0 ? "오늘" : `D-${enshrineDday}`} />
    </View>
  );
}
