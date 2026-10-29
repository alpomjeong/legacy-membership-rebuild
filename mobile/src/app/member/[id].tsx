import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useLive } from "@/lib/live";
import { initials } from "@/lib/util";
import { currentRoles, canEdit } from "@/lib/roles";
import { nextEnshrineDday } from "@/lib/member-stats";
import { SectionTitle, EmptyBox } from "@/components/ui";
import { MemberSummaryStrip } from "@/components/member-summary";
import { BulsaRegCard } from "@/components/bulsa-reg-card";
import type { Member as ApiMember } from "@/lib/types";

export default function MemberDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const live = useLive(true);
  const editable = canEdit(currentRoles());
  const m = useMemo(() => live.members.find((x) => String(x.id) === String(id)), [live.members, id]);
  const [full, setFull] = useState<ApiMember | null>(null);
  useEffect(() => {
    let alive = true;
    api.get<ApiMember>(`/members/${id}`).then((r) => { if (alive) setFull(r); }).catch(() => {});
    return () => { alive = false; };
  }, [id]);
  const dday = useMemo(() => (m ? nextEnshrineDday(m, live.enshrinements) : null), [m, live.enshrinements]);
  const [deleting, setDeleting] = useState(false);
  // 회원 삭제(웹 delMember 동일) — 확인 후 DELETE, 목록 갱신하고 뒤로.
  const del = () => {
    if (!m) return;
    Alert.alert("회원 삭제", `'${m.name}' 회원을 삭제할까요? 되돌릴 수 없습니다.`, [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: async () => {
        setDeleting(true);
        try { await api.delete(`/members/${m.id}`); live.reload(); router.back(); }
        catch (e) { setDeleting(false); Alert.alert("삭제 실패", e instanceof Error ? e.message : "삭제 실패"); }
      } },
    ]);
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-hanji dark:bg-hanji-dark">
      <View className="flex-row items-center gap-1 px-2 py-2">
        <Pressable onPress={() => router.back()} className="rounded-full p-2 active:opacity-60"><Ionicons name="arrow-back" size={23} color="#6f675a" /></Pressable>
        <Text numberOfLines={1} className="flex-1 font-bodyb text-[16px] text-ink dark:text-ink-dark">{m ? m.name : "회원"}</Text>
        {m && editable ? <Pressable onPress={() => router.push(`/member/edit/${m.id}`)} hitSlop={8} className="rounded-full px-2 py-1 active:opacity-60"><Text className="font-bodyb text-[14px] text-celadon dark:text-celadon-dark">수정</Text></Pressable> : null}
      </View>
      {!m ? (
        <View className="flex-1 items-center justify-center"><Text className="font-body text-ink-soft">회원을 찾을 수 없습니다</Text></View>
      ) : (
        <ScrollView>
          <View className="items-center px-5 pb-4 pt-2">
            <View className="h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-celadon-soft dark:bg-celadon-deep/40"><Text className="font-display text-2xl text-celadon dark:text-celadon-dark">{initials(m.name)}</Text></View>
            <Text className="mt-3 font-display text-[22px] text-ink dark:text-ink-dark">{m.name}</Text>
            {m.missionary ? <Text className="mt-0.5 font-body text-[13px] text-ink-soft dark:text-ink-softDark">포교원장 {m.missionary}</Text> : null}
            <View className="mt-4 flex-row gap-2.5">
              <Action icon="call" label="전화" disabled={!m.phone} onPress={() => m.phone && Linking.openURL(`tel:${m.phone}`)} />
              <Action icon="chatbubble" label="문자" disabled={!m.phone} onPress={() => m.phone && Linking.openURL(`sms:${m.phone}`)} />
            </View>
          </View>

          <MemberSummaryStrip regs={m.regs} counsels={m.counsels} enshrineDday={dday} />

          <View className="mx-5 mb-2 rounded-2xl border border-line bg-hanji-card dark:border-line-dark dark:bg-hanji-cardDark">
            <Info label="전화" value={(full?.phone ?? m.phone) || "—"} />
            <Sep /><Info label="소속" value={full?.affiliationCode || m.aff || "—"} />
            <Sep /><Info label="주소" value={[full?.address, full?.addressDetail].filter(Boolean).join(" ") || m.addr || "—"} />
            <Sep /><Info label="우편번호" value={full?.zipCode || "—"} />
            <Sep /><Info label="메모" value={(full?.memo ?? m.memo) || "—"} />
          </View>

          <View className="px-5 pt-4">
            <View className="flex-row items-center justify-between">
              <SectionTitle title="불사 신청" count={m.regs.length} />
              {editable ? <Pressable onPress={() => router.push(`/bulsa/new?memberId=${m.id}`)} hitSlop={8} className="active:opacity-60"><Text className="font-bodyb text-[13px] text-celadon dark:text-celadon-dark">+ 추가</Text></Pressable> : null}
            </View>
            {m.regs.length === 0 ? <EmptyBox>신청 내역 없음</EmptyBox> : m.regs.map((r) => (
              <BulsaRegCard key={String(r.id)} reg={r} editable={editable} onEdit={() => router.push(`/bulsa/edit/${r.id}`)} />
            ))}
          </View>

          <View className="px-5 pt-4">
            <View className="flex-row items-center justify-between">
              <SectionTitle title="상담" count={m.counsels.length} />
              {editable ? <Pressable onPress={() => router.push(`/counsel/new?memberId=${m.id}`)} hitSlop={8} className="active:opacity-60"><Text className="font-bodyb text-[13px] text-celadon dark:text-celadon-dark">+ 추가</Text></Pressable> : null}
            </View>
            {m.counsels.length === 0 ? <EmptyBox>상담 내역 없음</EmptyBox> : m.counsels.map((c, i) => (
              <View key={i} className="mb-2 rounded-2xl border border-line bg-hanji-card p-3.5 dark:border-line-dark dark:bg-hanji-cardDark"><Text className="font-bodym text-[12px] text-ink-soft dark:text-ink-softDark">{c.date}</Text><Text className="mt-0.5 font-body text-[14px] text-ink dark:text-ink-dark">{c.desc}</Text></View>
            ))}
          </View>

          {editable ? (
            <View className="px-5 pb-10 pt-6">
              <Pressable onPress={del} disabled={deleting} className="items-center rounded-2xl border border-vermilion/40 bg-vermilion/5 py-3 active:opacity-70">
                <Text className="font-bodyb text-[14px] text-vermilion">{deleting ? "삭제 중…" : "회원 삭제"}</Text>
              </Pressable>
            </View>
          ) : <View className="pb-10" />}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Action({ icon, label, onPress, disabled }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} className={`flex-row items-center gap-1.5 rounded-full border border-celadon/40 bg-celadon-soft/60 px-5 py-2.5 dark:border-celadon-dark/30 dark:bg-celadon-deep/30 ${disabled ? "opacity-40" : "active:opacity-70"}`}><Ionicons name={icon} size={16} color="#2f7d6b" /><Text className="font-bodyb text-[13px] text-celadon dark:text-celadon-dark">{label}</Text></Pressable>;
}
function Info({ label, value }: { label: string; value: string }) {
  return <View className="flex-row items-center gap-3 px-4 py-3"><Text className="w-12 font-bodym text-[12px] text-ink-soft dark:text-ink-softDark">{label}</Text><Text className="flex-1 font-body text-[14px] text-ink dark:text-ink-dark">{value}</Text></View>;
}
function Sep() { return <View className="h-px bg-line dark:bg-line-dark" />; }
