import { useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAdminCrud } from "@/lib/admin-crud";
import { type AdminStaff, emptyStaffForm, staffToForm, staffFormToDto, type StaffForm } from "@/lib/admin-forms";
import { StaffFormBody } from "@/components/staff-form-body";

export default function StaffEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const crud = useAdminCrud<AdminStaff>("/admin/staff");
  const st = useMemo(() => crud.items.find((x) => x.id === id), [crud.items, id]);
  const submit = async (f: StaffForm) => { await crud.update(id, staffFormToDto(f)); router.back(); };
  return <StaffFormBody title="사원 수정" form={st ? staffToForm(st) : emptyStaffForm} onSubmit={submit} onCancel={() => router.back()} />;
}
