import { useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useLive } from "@/lib/live";
import { emptyBulsaForm, bulsaFormToDto, type BulsaForm } from "@/lib/forms";
import { BulsaFormBody } from "@/components/bulsa-form";

export default function BulsaNew() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const router = useRouter();
  const live = useLive(true);
  const form = useMemo<BulsaForm>(() => ({ ...emptyBulsaForm, memberId: memberId ?? "" }), [memberId]);
  const submit = async (f: BulsaForm) => {
    await api.post("/buddhist-services", bulsaFormToDto(f));
    live.reload();
    router.back();
  };
  return <BulsaFormBody title="불사 신청 추가" form={form} onSubmit={submit} onCancel={() => router.back()} />;
}
