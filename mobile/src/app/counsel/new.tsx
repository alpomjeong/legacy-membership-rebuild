import { useMemo, useState } from "react";
import { Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useLive } from "@/lib/live";
import { counselFormToDto, nowKstText, parseKstDateTime } from "@/lib/forms";
import { FormScreen, TextField, MultilineField } from "@/components/form";

export default function CounselNew() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const router = useRouter();
  const live = useLive(true);
  const member = useMemo(() => live.members.find((m) => String(m.id) === String(memberId)), [live.members, memberId]);
  const [counseledAt, setCounseledAt] = useState(nowKstText());
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (!memberId) { setError("회원 정보가 없습니다"); return; }
    if (!content.trim()) { setError("상담 내용을 입력하세요"); return; }
    if (!parseKstDateTime(counseledAt)) { setError("상담일시 형식: YYYY-MM-DD HH:mm"); return; }
    setSaving(true); setError(null);
    try { await api.post("/counsels", counselFormToDto({ memberId, counseledAt, content })); live.reload(); router.back(); }
    catch (e) { setError(e instanceof Error ? e.message : "저장 실패"); setSaving(false); }
  };
  return (
    <FormScreen title="상담 추가" onCancel={() => router.back()} onSave={save} saving={saving} error={error}>
      {member ? <Text className="mb-1 mt-3 font-bodyb text-[15px] text-ink dark:text-ink-dark">{member.name}{member.missionary ? `  ${member.missionary}` : ""}</Text> : null}
      <TextField label="상담일시 (YYYY-MM-DD HH:mm)" value={counseledAt} onChangeText={setCounseledAt} placeholder="2026-06-27 14:30" />
      <MultilineField label="내용 *" value={content} onChangeText={setContent} placeholder="상담 내용" />
    </FormScreen>
  );
}
