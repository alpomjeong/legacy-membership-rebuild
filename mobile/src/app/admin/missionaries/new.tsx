import { useState } from "react";
import { useRouter } from "expo-router";
import { useAdminCrud } from "@/lib/admin-crud";
import { type AdminMissionary, emptyMissionaryForm, missionaryFormToDto, type MissionaryForm } from "@/lib/admin-forms";
import { FormScreen, TextField, SwitchField } from "@/components/form";

export default function MissionaryNew() {
  const router = useRouter();
  const crud = useAdminCrud<AdminMissionary>("/admin/missionaries");
  const [f, setF] = useState<MissionaryForm>(emptyMissionaryForm);
  const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof MissionaryForm>(k: K, v: MissionaryForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    if (!f.name.trim()) { setError("이름은 필수입니다"); return; }
    setSaving(true); setError(null);
    try { await crud.create(missionaryFormToDto(f)); router.back(); } catch (e) { setError(e instanceof Error ? e.message : "저장 실패"); setSaving(false); }
  };
  return (
    <FormScreen title="포교원장 추가" onCancel={() => router.back()} onSave={save} saving={saving} error={error}>
      <TextField label="이름 *" value={f.name} onChangeText={(v) => set("name", v)} />
      <TextField label="전화" value={f.phone} onChangeText={(v) => set("phone", v)} keyboardType="phone-pad" />
      <TextField label="주소" value={f.address} onChangeText={(v) => set("address", v)} />
      <TextField label="상세주소" value={f.addressDetail} onChangeText={(v) => set("addressDetail", v)} />
      <SwitchField label="사용여부" value={f.isActive} onValueChange={(v) => set("isActive", v)} />
    </FormScreen>
  );
}
