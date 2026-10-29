import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAdminCrud } from "@/lib/admin-crud";
import { type AdminItem, emptyItemForm, itemToForm, itemFormToDto, type ItemForm } from "@/lib/admin-forms";
import { FormScreen, TextField, MultilineField, MoneyField, SwitchField } from "@/components/form";

export default function ItemEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const crud = useAdminCrud<AdminItem>("/admin/buddhist-service-items");
  const found = crud.items.find((x) => x.id === id);
  const [f, setF] = useState<ItemForm>(emptyItemForm);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  // 데이터가 로드돼 해당 항목을 찾으면 폼을 1회 초기화(effect 안 setState 회피, 편집 중 덮어쓰기 방지).
  if (found && loadedId !== found.id) { setLoadedId(found.id); setF(itemToForm(found)); }
  const set = <K extends keyof ItemForm>(k: K, v: ItemForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    if (!f.name.trim()) { setError("명칭은 필수입니다"); return; }
    setSaving(true); setError(null);
    try { await crud.update(id, itemFormToDto(f)); router.back(); } catch (e) { setError(e instanceof Error ? e.message : "저장 실패"); setSaving(false); }
  };
  return (
    <FormScreen title="불사목록 수정" onCancel={() => router.back()} onSave={save} saving={saving} error={error}>
      <TextField label="명칭 *" value={f.name} onChangeText={(v) => set("name", v)} />
      <MoneyField label="기준금액" value={f.referenceAmount} onChangeText={(v) => set("referenceAmount", v)} />
      <MultilineField label="설명" value={f.description} onChangeText={(v) => set("description", v)} />
      <SwitchField label="사용여부" value={f.isActive} onValueChange={(v) => set("isActive", v)} />
    </FormScreen>
  );
}
