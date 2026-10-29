import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useAdminCrud } from "@/lib/admin-crud";
import type { AdminAccount, AdminRole, AdminStaff } from "@/lib/admin-forms";
import { accountCreateToDto } from "@/lib/admin-forms";
import { FormScreen, TextField, PickerField, MultiSelectField, type PickerOption } from "@/components/form";

export default function AccountNew() {
  const router = useRouter();
  const crud = useAdminCrud<AdminAccount>("/admin/accounts", "PATCH");
  const [loginId, setLoginId] = useState(""); const [staffId, setStaffId] = useState(""); const [roleIds, setRoleIds] = useState<string[]>([]);
  const [roles, setRoles] = useState<PickerOption[]>([]); const [staff, setStaff] = useState<PickerOption[]>([]);
  const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.get<AdminRole[]>("/admin/roles").then((r) => setRoles(r.map((x) => ({ value: x.id, label: x.name })))).catch(() => setRoles([]));
    api.get<AdminStaff[]>("/admin/staff").then((r) => setStaff(r.map((x) => ({ value: x.id, label: x.staffNameKo })))).catch(() => setStaff([]));
  }, []);
  const save = async () => {
    if (!loginId.trim()) { setError("로그인ID는 필수입니다"); return; }
    if (roleIds.length === 0) { setError("역할을 1개 이상 선택하세요"); return; }
    setSaving(true); setError(null);
    try {
      const r = await api.post<{ tempPassword: string }>("/admin/accounts", accountCreateToDto({ loginId, staffId, roleIds }));
      await crud.reload();
      Alert.alert("계정 생성", `임시 비밀번호: ${r.tempPassword}`, [{ text: "확인", onPress: () => router.back() }]);
    } catch (e) { setError(e instanceof Error ? e.message : "저장 실패"); setSaving(false); }
  };
  return (
    <FormScreen title="계정 추가" onCancel={() => router.back()} onSave={save} saving={saving} error={error}>
      <TextField label="로그인 ID *" value={loginId} onChangeText={setLoginId} />
      <PickerField label="사원" value={staffId} options={staff} onSelect={setStaffId} />
      <MultiSelectField label="역할 *" values={roleIds} options={roles} onChange={setRoleIds} />
    </FormScreen>
  );
}
