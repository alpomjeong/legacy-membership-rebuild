import { useMemo } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useLive } from "@/lib/live";
import { emptyBulsaForm, regToBulsaForm, bulsaFormToDto, type BulsaForm } from "@/lib/forms";
import type { Reg } from "@/lib/data";
import { BulsaFormBody } from "@/components/bulsa-form";

export default function BulsaEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const live = useLive(true);
  const reg = useMemo<Reg | undefined>(
    () => live.members.flatMap((m) => m.regs).find((r) => String(r.id) === String(id)),
    [live.members, id],
  );
  const form = useMemo<BulsaForm>(() => (reg ? regToBulsaForm(reg) : emptyBulsaForm), [reg]);
  const submit = async (f: BulsaForm) => {
    await api.put(`/buddhist-services/${id}`, bulsaFormToDto(f));
    live.reload();
    router.back();
  };
  if (!reg && live.members.length > 0) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 items-center justify-center bg-hanji dark:bg-hanji-dark">
        <Text className="font-body text-ink-soft">신청 내역을 찾을 수 없습니다</Text>
        <View className="h-2" />
        <Text onPress={() => router.back()} className="font-bodyb text-celadon">닫기</Text>
      </SafeAreaView>
    );
  }
  return <BulsaFormBody title="불사 신청 수정" form={form} onSubmit={submit} onCancel={() => router.back()} />;
}
