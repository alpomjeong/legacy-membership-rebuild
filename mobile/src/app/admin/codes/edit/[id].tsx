import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAdminCrud } from "@/lib/admin-crud";
import { type AdminCode, emptyCodeForm, codeToForm, codeFormToDto, type CodeForm } from "@/lib/admin-forms";
import { FormScreen, TextField, SwitchField } from "@/components/form";

export default function CodeEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const crud = useAdminCrud<AdminCode>("/common-codes", "PATCH", "?all=true");
  const found = crud.items.find((x) => x.id === id);
  const [f, setF] = useState<CodeForm>(emptyCodeForm);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  // 데이터가 로드돼 해당 항목을 찾으면 폼을 1회 초기화(effect 안 setState 회피, 편집 중 덮어쓰기 방지).
  if (found && loadedId !== found.id) { setLoadedId(found.id); setF(codeToForm(found)); }
  const set = <K extends keyof CodeForm>(k: K, v: CodeForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    if (!f.groupCode.trim() || !f.code.trim() || !f.name.trim()) { setError("그룹코드·코드·명칭은 필수입니다"); return; }
    setSaving(true); setError(null);
    try { await crud.update(id, codeFormToDto(f)); router.back(); } catch (e) { setError(e instanceof Error ? e.message : "저장 실패"); setSaving(false); }
  };
  return (
    <FormScreen title="공통코드 수정" onCancel={() => router.back()} onSave={save} saving={saving} error={error}>
      <TextField label="그룹코드 *" value={f.groupCode} onChangeText={(v) => set("groupCode", v)} />
      <TextField label="코드 *" value={f.code} onChangeText={(v) => set("code", v)} />
      <TextField label="명칭 *" value={f.name} onChangeText={(v) => set("name", v)} />
      <TextField label="약칭" value={f.shortName} onChangeText={(v) => set("shortName", v)} />
      <TextField label="정렬순서" value={f.sortOrder} onChangeText={(v) => set("sortOrder", v)} keyboardType="number-pad" />
      <SwitchField label="사용여부" value={f.isActive} onValueChange={(v) => set("isActive", v)} />
    </FormScreen>
  );
}
