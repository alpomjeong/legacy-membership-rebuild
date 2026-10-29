import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Reg } from "@/lib/data";
import { SLOT_LABELS } from "@/lib/types";
import { day, fmt } from "@/lib/util";
import { useSlotRules } from "@/lib/slot-rules";
import { visibleSlots, slotValue } from "@/lib/member-stats";

function chip(r: Reg) {
  return r.canceled ? { label: "취소", text: "text-vermilion", bg: "bg-vermilion-soft" }
    : r.cert ? { label: "증서", text: "text-celadon dark:text-celadon-dark", bg: "bg-celadon-soft dark:bg-celadon-deep/40" }
    : { label: "신청", text: "text-ink-soft dark:text-ink-softDark", bg: "bg-line/60 dark:bg-line-dark" };
}
const Row = ({ label, value }: { label: string; value: string }) => (
  <View className="flex-row gap-3 py-1"><Text className="w-20 font-bodym text-[12px] text-ink-soft dark:text-ink-softDark">{label}</Text><Text className="flex-1 font-body text-[13px] text-ink dark:text-ink-dark">{value || "—"}</Text></View>
);

export function BulsaRegCard({ reg, editable, onEdit }: { reg: Reg; editable: boolean; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  const rules = useSlotRules(reg.itemId, open);
  const c = chip(reg);
  return (
    <View className="mb-2 rounded-2xl border border-line bg-hanji-card p-3.5 dark:border-line-dark dark:bg-hanji-cardDark">
      <View className="flex-row items-center gap-2">
        <Pressable onPress={editable ? onEdit : undefined} disabled={!editable} className="flex-1 active:opacity-70">
          <Text numberOfLines={1} className="font-bodyb text-[14px] text-ink dark:text-ink-dark">{reg.item}</Text>
          <Text className="mt-0.5 font-body text-[12px] text-ink-soft dark:text-ink-softDark">신청일 {day(reg.date)}{reg.altar ? `   단번호 ${reg.altar}` : ""}</Text>
        </Pressable>
        <View className={`rounded-full px-2.5 py-1 ${c.bg}`}><Text className={`font-bodyb text-[11px] ${c.text}`}>{c.label}</Text></View>
        <Pressable onPress={() => setOpen((o) => !o)} hitSlop={8} className="p-1 active:opacity-60"><Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color="#a39a88" /></Pressable>
      </View>
      {open ? (
        <View className="mt-2 border-t border-line pt-2 dark:border-line-dark">
          {reg.event ? <Row label="봉안행사" value={reg.event} /> : null}
          <Row label="시주금액" value={reg.donation ? `${fmt(reg.donation)}원` : ""} />
          {visibleSlots(rules).map((s) => <Row key={s.slotKey} label={s.labelOverride || SLOT_LABELS[s.slotKey] || s.slotKey} value={slotValue(reg, s.slotKey)} />)}
          {reg.cert ? <Row label="증서발급" value={reg.certDate ? day(reg.certDate) ?? "발급" : "발급"} /> : null}
          {reg.canceled ? <Row label="취소일" value={reg.cancelDate ? day(reg.cancelDate) ?? "취소" : "취소"} /> : null}
          {reg.memo ? <Row label="메모" value={reg.memo} /> : null}
        </View>
      ) : null}
    </View>
  );
}
