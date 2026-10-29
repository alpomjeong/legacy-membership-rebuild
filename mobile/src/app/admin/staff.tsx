import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAdminCrud } from "@/lib/admin-crud";
import type { AdminStaff } from "@/lib/admin-forms";
import { AdminListScreen } from "@/components/admin-list";

export default function StaffList() {
  const router = useRouter();
  const crud = useAdminCrud<AdminStaff>("/admin/staff");
  return (
    <AdminListScreen<AdminStaff>
      title="사원" items={crud.items} loading={crud.loading} onReload={crud.reload}
      search={(st, q) => (st.staffNameKo + (st.staffNameEn ?? "")).toLowerCase().includes(q.toLowerCase())}
      onAdd={() => router.push("/admin/staff/new")}
      onRow={(st) => router.push(`/admin/staff/edit/${st.id}`)}
      onDelete={(st) => crud.remove(st.id)}
      renderRow={(st) => (
        <View>
          <Text className="font-bodyb text-[14px] text-ink dark:text-ink-dark">{st.staffNameKo}{st.isWorking === false ? <Text className="font-body text-[12px] text-vermilion">  (퇴사)</Text> : null}</Text>
          <Text className="mt-0.5 font-body text-[12px] text-ink-soft dark:text-ink-softDark">{st.staffNameEn || "-"}</Text>
        </View>
      )}
    />
  );
}
