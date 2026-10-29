import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useLive } from "@/lib/live";
import { emptyMemberForm, memberToForm, memberFormToDto, type MemberForm } from "@/lib/forms";
import type { Member } from "@/lib/types";
import { FormScreen, TextField, MultilineField, PickerField } from "@/components/form";

export default function MemberEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const live = useLive(true);
  const [f, setF] = useState<MemberForm>(emptyMemberForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api.get<Member>(`/members/${id}`).then((m) => { if (alive) setF(memberToForm(m)); }).catch((e) => setError(e instanceof Error ? e.message : "불러오기 실패"));
    return () => { alive = false; };
  }, [id]);
  const set = <K extends keyof MemberForm>(k: K, v: MemberForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    if (!f.memberName.trim()) { setError("이름을 입력하세요"); return; }
    setSaving(true); setError(null);
    try { await api.put(`/members/${id}`, memberFormToDto(f)); live.reload(); router.back(); }
    catch (e) { setError(e instanceof Error ? e.message : "저장 실패"); setSaving(false); }
  };
  const missionaryOptions = live.missionaries.map((m) => ({ value: m.id, label: m.name }));
  return (
    <FormScreen title="회원 수정" onCancel={() => router.back()} onSave={save} saving={saving} error={error}>
      <TextField label="이름 *" value={f.memberName} onChangeText={(v) => set("memberName", v)} />
      <TextField label="전화" value={f.phone} onChangeText={(v) => set("phone", v)} keyboardType="phone-pad" />
      <PickerField label="포교원장" value={f.missionaryId} options={missionaryOptions} onSelect={(v) => set("missionaryId", v)} />
      <TextField label="소속코드" value={f.affiliationCode} onChangeText={(v) => set("affiliationCode", v)} />
      <TextField label="주소" value={f.address} onChangeText={(v) => set("address", v)} />
      <TextField label="상세주소" value={f.addressDetail} onChangeText={(v) => set("addressDetail", v)} />
      <TextField label="우편번호" value={f.zipCode} onChangeText={(v) => set("zipCode", v)} keyboardType="number-pad" />
      <MultilineField label="메모" value={f.memo} onChangeText={(v) => set("memo", v)} />
    </FormScreen>
  );
}
