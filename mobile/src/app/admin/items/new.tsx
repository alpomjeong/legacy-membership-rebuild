import { useState } from "react";
import { useRouter } from "expo-router";
import { useAdminCrud } from "@/lib/admin-crud";
import { type AdminItem, emptyItemForm, itemFormToDto, type ItemForm } from "@/lib/admin-forms";
import { FormScreen, TextField, MultilineField, MoneyField, SwitchField } from "@/components/form";

export default function ItemNew() {
  const router = useRouter();
  const crud = useAdminCrud<AdminItem>("/admin/buddhist-service-items");
  const [f, setF] = useState<ItemForm>(emptyItemForm);
  const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof ItemForm>(k: K, v: ItemForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    if (!f.name.trim()) { setError("명칭은 필수입니다"); return; }
    setSaving(true); setError(null);
    try { await crud.create(itemFormToDto(f)); router.back(); } catch (e) { setError(e instanceof Error ? e.message : "저장 실패"); setSaving(false); }
  };
  return (
    <FormScreen title="불사목록 추가" onCancel={() => router.back()} onSave={save} saving={saving} error={error}>
      <TextField label="명칭 *" value={f.name} onChangeText={(v) => set("name", v)} />
      <MoneyField label="기준금액" value={f.referenceAmount} onChangeText={(v) => set("referenceAmount", v)} />
      <MultilineField label="설명" value={f.description} onChangeText={(v) => set("description", v)} />
      <SwitchField label="사용여부" value={f.isActive} onValueChange={(v) => set("isActive", v)} />
    </FormScreen>
  );
}
