import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAdminCrud } from "@/lib/admin-crud";
import type { AdminRole } from "@/lib/admin-forms";
import { ScreenHeader, EmptyBox } from "@/components/ui";

const RES_KO: Record<string, string> = {
  member: "회원", buddhist_service: "불사", counsel: "상담", enshrinement: "봉안일",
  missionary: "포교원장", staff: "사원", service_item: "불사목록", common_code: "공통코드",
  account: "계정", role: "역할·권한", audit: "감사로그", menu: "메뉴", data_import: "일괄업로드",
};
const ACT_KO: Record<string, string> = {
  read: "조회", create: "등록", update: "수정", delete: "삭제", export: "내보내기", print: "출력", import: "가져오기",
};
function permLabel(p: string): string {
  const [res, act] = p.split(":");
  return `${RES_KO[res] ?? res} ${ACT_KO[act] ?? act}`.trim();
}

function RoleCard({ role }: { role: AdminRole }) {
  const [open, setOpen] = useState(false);
  return (
    <View className="mb-2 rounded-2xl border border-line bg-hanji-card p-3.5 dark:border-line-dark dark:bg-hanji-cardDark">
      <Pressable onPress={() => setOpen((o) => !o)} className="flex-row items-center justify-between active:opacity-70">
        <Text className="font-bodyb text-[15px] text-ink dark:text-ink-dark">{role.name}</Text>
        <View className="flex-row items-center gap-2"><Text className="font-body text-[12px] text-ink-soft dark:text-ink-softDark">권한 {role.permissions.length}</Text><Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color="#a39a88" /></View>
      </Pressable>
      {open ? (
        <View className="mt-2 flex-row flex-wrap gap-1.5 border-t border-line pt-2 dark:border-line-dark">
          {role.permissions.length === 0 ? <Text className="font-body text-[12px] text-ink-soft">권한 없음</Text> : role.permissions.map((p) => <View key={p} className="rounded-full bg-line/60 px-2.5 py-1 dark:bg-line-dark"><Text className="font-body text-[11px] text-ink-soft dark:text-ink-softDark">{permLabel(p)}</Text></View>)}
        </View>
      ) : null}
    </View>
  );
}

export default function RolesList() {
  const router = useRouter();
  const crud = useAdminCrud<AdminRole>("/admin/roles");
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-hanji dark:bg-hanji-dark">
      <View className="flex-row items-center justify-between pr-3">
        <View className="flex-1"><ScreenHeader title="역할·권한" subtitle={`${crud.items.length}개 역할 · 읽기 전용`} /></View>
        <Pressable onPress={() => router.back()} hitSlop={8} className="active:opacity-60"><Ionicons name="close" size={22} color="#a39a88" /></Pressable>
      </View>
      {crud.loading && crud.items.length === 0 ? <View className="flex-1 items-center justify-center"><ActivityIndicator color="#2f7d6b" /></View> : (
        <ScrollView className="flex-1 px-5" refreshControl={<RefreshControl refreshing={crud.loading} onRefresh={crud.reload} tintColor="#2f7d6b" />}>
          {crud.items.length === 0 ? <EmptyBox>역할 없음</EmptyBox> : crud.items.map((r) => <RoleCard key={r.id} role={r} />)}
          <View className="h-6" />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
