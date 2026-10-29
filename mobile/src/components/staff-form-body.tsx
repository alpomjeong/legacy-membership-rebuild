import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { StaffForm } from "@/lib/admin-forms";
import { FormScreen, TextField, SwitchField } from "@/components/form";

const MORE_TEXT: { key: keyof StaffForm; label: string }[] = [
  { key: "positionCode", label: "직급코드" }, { key: "dutyCode", label: "직무코드" }, { key: "jobGroupCode", label: "직군코드" },
  { key: "staffDivCode", label: "구분코드" }, { key: "appellationDivCode", label: "호칭코드" }, { key: "solarLunarCode", label: "양력/음력코드" },
];
const MORE_DATE: { key: keyof StaffForm; label: string }[] = [
  { key: "birthDate", label: "생년월일 (YYYY-MM-DD)" }, { key: "joinDate", label: "입사일 (YYYY-MM-DD)" }, { key: "retireDate", label: "퇴사일 (YYYY-MM-DD)" },
];

export function StaffFormBody({ title, form, onSubmit, onCancel }: { title: string; form: StaffForm; onSubmit: (f: StaffForm) => Promise<void>; onCancel: () => void }) {
  const [f, setF] = useState<StaffForm>(form);
  const [prevForm, setPrevForm] = useState(form);
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  // form prop 이 바뀌면 렌더 중 동기화(effect 안 setState 회피 → 캐스케이딩 렌더 방지).
  if (prevForm !== form) { setPrevForm(form); setF(form); }
  const set = <K extends keyof StaffForm>(k: K, v: StaffForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    if (!f.staffNameKo.trim()) { setError("한글명은 필수입니다"); return; }
    setSaving(true); setError(null);
    try { await onSubmit(f); } catch (e) { setError(e instanceof Error ? e.message : "저장 실패"); setSaving(false); }
  };
  return (
    <FormScreen title={title} onCancel={onCancel} onSave={save} saving={saving} error={error}>
      <TextField label="한글명 *" value={f.staffNameKo} onChangeText={(v) => set("staffNameKo", v)} />
      <TextField label="영문명" value={f.staffNameEn} onChangeText={(v) => set("staffNameEn", v)} />
      <TextField label="권한레벨코드" value={f.authLevelCode} onChangeText={(v) => set("authLevelCode", v)} />
      <SwitchField label="재직여부" value={f.isWorking} onValueChange={(v) => set("isWorking", v)} />
      <Pressable onPress={() => setMore((m) => !m)} className="mt-4 active:opacity-60"><Text className="font-bodyb text-[13px] text-celadon dark:text-celadon-dark">{more ? "▲ 접기" : "▼ 더보기"}</Text></Pressable>
      {more ? (
        <View>
          {MORE_TEXT.map((m) => <TextField key={m.key} label={m.label} value={f[m.key] as string} onChangeText={(v) => set(m.key, v as never)} />)}
          {MORE_DATE.map((m) => <TextField key={m.key} label={m.label} value={f[m.key] as string} onChangeText={(v) => set(m.key, v as never)} placeholder="2020-01-02" />)}
          <SwitchField label="SMS 수신" value={f.smsReceiveYn} onValueChange={(v) => set("smsReceiveYn", v)} />
        </View>
      ) : null}
    </FormScreen>
  );
}
