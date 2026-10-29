import { Alert, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useAdminCrud } from "@/lib/admin-crud";
import type { AdminAccount } from "@/lib/admin-forms";
import { AdminListScreen } from "@/components/admin-list";

export default function AccountsList() {
  const router = useRouter();
  const crud = useAdminCrud<AdminAccount>("/admin/accounts", "PATCH");
  const actions = (a: AdminAccount) => Alert.alert(a.loginId, a.isActive ? "활성 계정" : "비활성 계정", [
    { text: a.isActive ? "비활성화" : "활성화", style: a.isActive ? "destructive" : "default", onPress: async () => { try { await api.patch(`/admin/accounts/${a.id}`, { isActive: !a.isActive }); await crud.reload(); } catch (e) { Alert.alert("실패", e instanceof Error ? e.message : "오류"); } } },
    { text: "비밀번호 초기화", onPress: async () => { try { const r = await api.post<{ tempPassword: string }>(`/admin/accounts/${a.id}/reset-password`); Alert.alert("임시 비밀번호", r.tempPassword); } catch (e) { Alert.alert("실패", e instanceof Error ? e.message : "오류"); } } },
    { text: "전체 로그아웃", onPress: async () => { try { await api.post(`/admin/accounts/${a.id}/logout-all`); Alert.alert("완료", "모든 세션을 로그아웃했습니다"); } catch (e) { Alert.alert("실패", e instanceof Error ? e.message : "오류"); } } },
    { text: "닫기", style: "cancel" },
  ]);
  return (
    <AdminListScreen<AdminAccount>
      title="계정 관리" items={crud.items} loading={crud.loading} onReload={crud.reload}
      search={(a, q) => (a.loginId + (a.roleNames ?? "")).toLowerCase().includes(q.toLowerCase())}
      onAdd={() => router.push("/admin/accounts/new")}
      onRow={(a) => router.push(`/admin/accounts/edit/${a.id}`)}
      renderRow={(a) => (
        <View className="flex-row items-center">
          <View className="flex-1">
            <Text className="font-bodyb text-[14px] text-ink dark:text-ink-dark">{a.loginId}{a.isActive ? null : <Text className="font-body text-[12px] text-vermilion">  (비활성)</Text>}</Text>
            <Text className="mt-0.5 font-body text-[12px] text-ink-soft dark:text-ink-softDark">{a.roleNames || "역할 없음"}</Text>
          </View>
          <Pressable onPress={() => actions(a)} hitSlop={8} className="p-1 active:opacity-60"><Ionicons name="ellipsis-vertical" size={18} color="#a39a88" /></Pressable>
        </View>
      )}
    />
  );
}
