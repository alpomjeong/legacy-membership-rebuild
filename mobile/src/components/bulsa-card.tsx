import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Reg } from "@/lib/data";
import { day, fmt } from "@/lib/util";

const DASH = "—";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ width: "48%" }} className="mb-2">
      <Text className="font-bodym text-[11px] text-ink-soft dark:text-ink-softDark">{label}</Text>
      <Text numberOfLines={1} className="mt-0.5 font-body text-[13.5px] text-ink dark:text-ink-dark">{value || DASH}</Text>
    </View>
  );
}

/* 불사 신청 1건 카드. 접힘=요약 한 줄, 펴짐=전 항목 2열 그리드(빈 값 — ). 펼침 상태는 부모가 관리(FlashList 재활용 안전). 불사 신청 목록·봉안일 시트 공용. */
export function BulsaCard({ reg, memberName, onPress, expanded, onToggle }: { reg: Reg; memberName: string; onPress: () => void; expanded: boolean; onToggle: () => void }) {
  const chip = reg.canceled
    ? { label: "취소", text: "text-vermilion", bg: "bg-vermilion-soft" }
    : reg.cert
    ? { label: "증서", text: "text-celadon dark:text-celadon-dark", bg: "bg-celadon-soft dark:bg-celadon-deep/40" }
    : { label: "신청", text: "text-ink-soft dark:text-ink-softDark", bg: "bg-line/60 dark:bg-line-dark" };
  const v = (s: string | null | undefined) => s ?? "";
  const money = reg.donation ? `${fmt(reg.donation)}원` : "";
  const certDate = reg.cert ? (reg.certDate ? day(reg.certDate) ?? "발급" : "발급") : "";
  const cancelDate = reg.canceled ? (reg.cancelDate ? day(reg.cancelDate) ?? "취소" : "취소") : "";
  const summary = `${reg.item || "불사"} · 신청일 ${day(reg.date) ?? DASH} · 단번호 ${reg.altar || DASH}${money ? ` · ${money}` : ""}`;

  return (
    <View className="rounded-2xl border border-line bg-hanji-card p-3.5 dark:border-line-dark dark:bg-hanji-cardDark">
      <View className="flex-row items-center gap-2">
        <Pressable onPress={onPress} className="flex-1 active:opacity-70">
          <Text numberOfLines={1} className="font-bodyb text-[15px] text-ink dark:text-ink-dark">{memberName}<Text className="font-body text-[14px] text-ink-soft dark:text-ink-softDark">  {reg.item}</Text></Text>
        </Pressable>
        <View className={`rounded-full px-2.5 py-1 ${chip.bg}`}><Text className={`font-bodyb text-[11px] ${chip.text}`}>{chip.label}</Text></View>
        <Pressable onPress={onToggle} hitSlop={8} className="p-1 active:opacity-60"><Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color="#a39a88" /></Pressable>
      </View>
      {expanded ? (
        <Pressable onPress={onPress} className="active:opacity-70">
          <View className="mt-2 flex-row flex-wrap justify-between">
            <Field label="불사 항목" value={v(reg.item)} />
            <Field label="신청일" value={day(reg.date) ?? ""} />
            <Field label="봉안행사" value={v(reg.event)} />
            <Field label="단번호" value={v(reg.altar)} />
            <Field label="시주금액" value={money} />
            <Field label="담당" value={v(reg.staff)} />
            <Field label="복전자" value={v(reg.bokjunja)} />
            <Field label="복위자" value={v(reg.bogwija)} />
            <Field label="관계" value={v(reg.rel)} />
            <Field label="영가" value={v(reg.spirit)} />
            <Field label="예수재" value={v(reg.yesujae)} />
            <Field label="12성주" value={v(reg.seongju)} />
            <Field label="증서일" value={certDate} />
            <Field label="취소일" value={cancelDate} />
          </View>
          <View>
            <Text className="font-bodym text-[11px] text-ink-soft dark:text-ink-softDark">메모</Text>
            <Text numberOfLines={3} className="mt-0.5 font-body text-[13.5px] text-ink dark:text-ink-dark">{v(reg.memo) || DASH}</Text>
          </View>
        </Pressable>
      ) : (
        <Pressable onPress={onPress} className="active:opacity-70">
          <Text numberOfLines={1} className="mt-1 font-body text-[12.5px] text-ink-soft dark:text-ink-softDark">{summary}</Text>
        </Pressable>
      )}
    </View>
  );
}
