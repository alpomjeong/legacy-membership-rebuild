import { useState } from "react";
import { View } from "react-native";
import { useLive } from "@/lib/live";
import { useSlotRules } from "@/lib/slot-rules";
import { visibleSlots } from "@/lib/member-stats";
import { SLOT_LABELS } from "@/lib/types";
import type { BulsaForm } from "@/lib/forms";
import { FormScreen, TextField, MultilineField, MoneyField, SwitchField, PickerField } from "@/components/form";

// 인물 슬롯 힌트(웹 SLOT_HINT 동일) — 어떤 값을 넣는 칸인지 안내.
const SLOT_HINT: Record<string, string> = {
  bogwija: "조상 봉안자", relationship: "조상과의 관계", bokjunja: "불상에 이름 붙는 사람 · 다건",
  spiritual: "위패 망자명", yesujae: "위패 생자명(예수재→제자 재)", seongju12: "12지신 중 하나",
};

// 봉안일 드롭다운 표기 — 웹과 동일하게 "날짜 시간 · 이름"(이름만은 같은 이름 구분 어려움).
//   RN Hermes 의 Intl 로케일 한계를 피해 수동 포맷(오전/오후 12시간제)으로 동일 출력.
function ensOptionLabel(e: { label: string | null; eventDateSolar?: string }): string {
  const d = e.eventDateSolar ? new Date(e.eventDateSolar) : null;
  if (!d || Number.isNaN(d.getTime())) return e.label ?? "";
  let h = d.getHours();
  const ampm = h < 12 ? "오전" : "오후";
  h = h % 12; if (h === 0) h = 12;
  const dt = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${ampm} ${String(h).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return e.label ? `${dt} · ${e.label}` : dt;
}

export function BulsaFormBody({ title, form, onSubmit, onCancel }: {
  title: string; form: BulsaForm; onSubmit: (dto: BulsaForm) => Promise<void>; onCancel: () => void;
}) {
  const live = useLive(true);
  const [f, setF] = useState<BulsaForm>(form);
  const [prevForm, setPrevForm] = useState(form);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // form prop 이 바뀌면 렌더 중 동기화(effect 안 setState 회피).
  if (prevForm !== form) { setPrevForm(form); setF(form); }
  const set = <K extends keyof BulsaForm>(k: K, v: BulsaForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const itemOptions = live.items.map((i) => ({ value: i.id, label: i.name }));
  const ensOptions = live.enshrinements.map((e) => ({ value: e.id, label: ensOptionLabel(e) }));
  // 선택한 불사 항목의 DB 슬롯 규칙 — 웹과 동일하게 필요한 인물칸만 동적 표시(읽기 카드와 동일 소스).
  const slots = visibleSlots(useSlotRules(f.buddhistServiceItemId, true));
  const slotLabel = (s: { slotKey: string; labelOverride: string | null }) => s.labelOverride || SLOT_LABELS[s.slotKey] || s.slotKey;
  const save = async () => {
    if (!f.buddhistServiceItemId) { setError("불사 항목을 선택하세요"); return; }
    for (const s of slots) {
      if (s.isRequired && !(f[s.slotKey as keyof BulsaForm] as string).trim()) { setError(`${slotLabel(s)}은(는) 필수입니다`); return; }
    }
    setSaving(true); setError(null);
    try { await onSubmit(f); } catch (e) { setError(e instanceof Error ? e.message : "저장 실패"); setSaving(false); }
  };
  return (
    <FormScreen title={title} onCancel={onCancel} onSave={save} saving={saving} error={error}>
      <PickerField label="불사 항목 *" value={f.buddhistServiceItemId} options={itemOptions} onSelect={(v) => set("buddhistServiceItemId", v)} allowClear={false} placeholder="항목 선택" />
      <PickerField label="봉안일(행사)" value={f.enshrinementEventId} options={ensOptions} onSelect={(v) => set("enshrinementEventId", v)} />
      <TextField label="단번호" value={f.altarNumber} onChangeText={(v) => set("altarNumber", v)} />
      <MoneyField label="시주금액" value={f.donationAmount} onChangeText={(v) => set("donationAmount", v)} />
      {f.buddhistServiceItemId && slots.length > 0 ? (
        <View>
          {slots.map((s) => {
            const k = s.slotKey as keyof BulsaForm;
            return <TextField key={s.slotKey} label={slotLabel(s) + (s.isRequired ? " *" : "")} hint={SLOT_HINT[s.slotKey]} value={f[k] as string} onChangeText={(v) => set(k, v as never)} />;
          })}
        </View>
      ) : null}
      <MultilineField label="메모" value={f.memo} onChangeText={(v) => set("memo", v)} />
      <SwitchField label="증서 발급" value={f.isCertificateIssued} onValueChange={(b) => set("isCertificateIssued", b)} />
      {f.isCertificateIssued ? (
        <TextField label="증서 발급일 (YYYY-MM-DD)" value={f.certificateIssuedDate} onChangeText={(v) => set("certificateIssuedDate", v)} placeholder="2026-06-27" />
      ) : null}
    </FormScreen>
  );
}
