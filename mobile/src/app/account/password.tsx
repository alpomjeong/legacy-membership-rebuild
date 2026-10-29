import { useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { FormScreen, TextField } from "@/components/form";

// 본인 비밀번호 변경(웹 PasswordChangeDialog 동일) — POST /auth/change-password { currentPassword, newPassword }.
export default function PasswordChange() {
  const router = useRouter();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!cur) { setError("현재 비밀번호를 입력하세요"); return; }
    if (next.length < 8) { setError("새 비밀번호는 8자 이상이어야 합니다."); return; }
    if (next !== confirm) { setError("새 비밀번호가 일치하지 않습니다."); return; }
    setSaving(true); setError(null);
    try {
      await api.post("/auth/change-password", { currentPassword: cur, newPassword: next });
      Alert.alert("완료", "비밀번호가 변경되었습니다.", [{ text: "확인", onPress: () => router.back() }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "변경 실패");
      setSaving(false);
    }
  };

  return (
    <FormScreen title="비밀번호 변경" onCancel={() => router.back()} onSave={save} saving={saving} error={error}>
      <TextField label="현재 비밀번호" value={cur} onChangeText={setCur} secureTextEntry placeholder="현재 비밀번호" />
      <TextField label="새 비밀번호 (8자 이상)" value={next} onChangeText={setNext} secureTextEntry placeholder="새 비밀번호" />
      <TextField label="새 비밀번호 확인" value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="새 비밀번호 다시 입력" />
    </FormScreen>
  );
}
