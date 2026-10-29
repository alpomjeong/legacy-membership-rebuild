import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useAdminCrud } from "@/lib/admin-crud";
import type { AdminAccount, AdminRole } from "@/lib/admin-forms";
import { accountEditToDto } from "@/lib/admin-forms";
import { FormScreen, SwitchField, MultiSelectField, type PickerOption } from "@/components/form";

export default function AccountEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const crud = useAdminCrud<AdminAccount>("/admin/accounts", "PATCH");
  const found = crud.items.find((x) => x.id === id);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true); const [roleIds, setRoleIds] = useState<string[]>([]);
  const [roles, setRoles] = useState<PickerOption[]>([]);
  const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  // 데이터가 로드돼 계정을 찾으면 1회 초기화(effect 안 setState 회피, 편집 중 덮어쓰기 방지).
  if (found && loadedId !== found.id) { setLoadedId(found.id); setIsActive(found.isActive); setRoleIds(found.roleIds); }
  useEffect(() => { api.get<AdminRole[]>("/admin/roles").then((r) => setRoles(r.map((x) => ({ value: x.id, label: x.name })))).catch(() => setRoles([])); }, []);
  const save = async () => {
    if (roleIds.length === 0) { setError("역할을 1개 이상 선택하세요"); return; }
    setSaving(true); setError(null);
    try { await crud.update(id, accountEditToDto({ isActive, roleIds })); router.back(); } catch (e) { setError(e instanceof Error ? e.message : "저장 실패"); setSaving(false); }
  };
  return (
    <FormScreen title="계정 수정" onCancel={() => router.back()} onSave={save} saving={saving} error={error}>
      <SwitchField label="활성" value={isActive} onValueChange={setIsActive} />
      <MultiSelectField label="역할" values={roleIds} options={roles} onChange={setRoleIds} />
    </FormScreen>
  );
}
