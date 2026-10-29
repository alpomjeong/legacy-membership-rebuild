import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAdminCrud } from "@/lib/admin-crud";
import type { AdminMissionary } from "@/lib/admin-forms";
import { AdminListScreen } from "@/components/admin-list";

export default function MissionariesList() {
  const router = useRouter();
  const crud = useAdminCrud<AdminMissionary>("/admin/missionaries");
  return (
    <AdminListScreen<AdminMissionary>
      title="포교원장" items={crud.items} loading={crud.loading} onReload={crud.reload}
      search={(m, q) => (m.name + (m.phone ?? "")).toLowerCase().includes(q.toLowerCase())}
      onAdd={() => router.push("/admin/missionaries/new")}
      onRow={(m) => router.push(`/admin/missionaries/edit/${m.id}`)}
      onDelete={(m) => crud.remove(m.id)}
      renderRow={(m) => (
        <View>
          <Text className="font-bodyb text-[14px] text-ink dark:text-ink-dark">{m.name}{m.isActive === false ? <Text className="font-body text-[12px] text-vermilion">  (비활성)</Text> : null}</Text>
          <Text className="mt-0.5 font-body text-[12px] text-ink-soft dark:text-ink-softDark">{m.phone || "전화 없음"}{m.address ? `  ${m.address}` : ""}</Text>
        </View>
      )}
    />
  );
}
