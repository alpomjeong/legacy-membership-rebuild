import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAdminCrud } from "@/lib/admin-crud";
import type { AdminCode } from "@/lib/admin-forms";
import { AdminListScreen } from "@/components/admin-list";

export default function CodesList() {
  const router = useRouter();
  const crud = useAdminCrud<AdminCode>("/common-codes", "PATCH", "?all=true");
  return (
    <AdminListScreen<AdminCode>
      title="공통코드" subtitle={`${crud.items.length}건`} items={crud.items} loading={crud.loading} onReload={crud.reload}
      search={(c, q) => (c.groupCode + c.code + c.name).toLowerCase().includes(q.toLowerCase())}
      onAdd={() => router.push("/admin/codes/new")}
      onRow={(c) => router.push(`/admin/codes/edit/${c.id}`)}
      onDelete={(c) => crud.remove(c.id)}
      renderRow={(c) => (
        <View>
          <Text className="font-bodyb text-[14px] text-ink dark:text-ink-dark">{c.name}{c.isActive === false ? <Text className="font-body text-[12px] text-vermilion">  (비활성)</Text> : null}</Text>
          <Text className="mt-0.5 font-body text-[12px] text-ink-soft dark:text-ink-softDark">{c.groupCode} · {c.code}{c.shortName ? `  ${c.shortName}` : ""}</Text>
        </View>
      )}
    />
  );
}
