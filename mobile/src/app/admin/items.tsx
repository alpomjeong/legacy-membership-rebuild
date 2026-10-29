import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAdminCrud } from "@/lib/admin-crud";
import type { AdminItem } from "@/lib/admin-forms";
import { AdminListScreen } from "@/components/admin-list";
import { fmt } from "@/lib/util";

export default function ItemsList() {
  const router = useRouter();
  const crud = useAdminCrud<AdminItem>("/admin/buddhist-service-items");
  return (
    <AdminListScreen<AdminItem>
      title="불사목록" items={crud.items} loading={crud.loading} onReload={crud.reload}
      search={(i, q) => i.name.toLowerCase().includes(q.toLowerCase())}
      onAdd={() => router.push("/admin/items/new")}
      onRow={(i) => router.push(`/admin/items/edit/${i.id}`)}
      onDelete={(i) => crud.remove(i.id)}
      canDelete={(i) => (i.usageCount ?? 0) === 0}
      renderRow={(i) => (
        <View>
          <Text className="font-bodyb text-[14px] text-ink dark:text-ink-dark">{i.name}{i.isActive === false ? <Text className="font-body text-[12px] text-vermilion">  (비활성)</Text> : null}</Text>
          <Text className="mt-0.5 font-body text-[12px] text-ink-soft dark:text-ink-softDark">{i.referenceAmount ? `기준 ${fmt(Number(i.referenceAmount))}원` : "—"}{(i.usageCount ?? 0) > 0 ? `  · 사용 ${i.usageCount}건` : ""}</Text>
        </View>
      )}
    />
  );
}
