import { useRouter } from "expo-router";
import { useAdminCrud } from "@/lib/admin-crud";
import { type AdminStaff, emptyStaffForm, staffFormToDto, type StaffForm } from "@/lib/admin-forms";
import { StaffFormBody } from "@/components/staff-form-body";

export default function StaffNew() {
  const router = useRouter();
  const crud = useAdminCrud<AdminStaff>("/admin/staff");
  const submit = async (f: StaffForm) => { await crud.create(staffFormToDto(f)); router.back(); };
  return <StaffFormBody title="사원 추가" form={emptyStaffForm} onSubmit={submit} onCancel={() => router.back()} />;
}
