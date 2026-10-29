import { useState } from "react";
import { Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export function FormScreen({ title, onCancel, onSave, saving, error, children }: {
  title: string; onCancel: () => void; onSave: () => void; saving?: boolean; error?: string | null; children: React.ReactNode;
}) {
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-hanji dark:bg-hanji-dark">
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable onPress={onCancel} hitSlop={8} className="active:opacity-60"><Text className="font-body text-[15px] text-ink-soft dark:text-ink-softDark">취소</Text></Pressable>
        <Text className="font-bodyb text-[16px] text-ink dark:text-ink-dark">{title}</Text>
        <Pressable onPress={onSave} disabled={saving} hitSlop={8} className="active:opacity-60"><Text className={`font-bodyb text-[15px] ${saving ? "text-ink-soft" : "text-celadon dark:text-celadon-dark"}`}>{saving ? "저장 중…" : "저장"}</Text></Pressable>
      </View>
      {error ? <View className="mx-4 mb-2 rounded-xl bg-vermilion-soft px-3.5 py-2.5"><Text className="font-bodym text-[13px] text-vermilion">{error}</Text></View> : null}
      <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>{children}</ScrollView>
    </SafeAreaView>
  );
}

const Label = ({ text }: { text: string }) => <Text className="mb-1 mt-3 font-bodym text-[12px] text-ink-soft dark:text-ink-softDark">{text}</Text>;
const fieldCls = "rounded-2xl border border-line bg-hanji-card px-3.5 py-3 font-body text-[15px] text-ink dark:border-line-dark dark:bg-hanji-cardDark dark:text-ink-dark";

export function TextField({ label, value, onChangeText, placeholder, keyboardType, secureTextEntry, hint }: {
  label: string; value: string; onChangeText: (s: string) => void; placeholder?: string; keyboardType?: "default" | "phone-pad" | "number-pad"; secureTextEntry?: boolean; hint?: string;
}) {
  return (<View><Label text={label} /><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#a39a88" keyboardType={keyboardType} secureTextEntry={secureTextEntry} autoCapitalize={secureTextEntry ? "none" : undefined} autoCorrect={false} className={fieldCls} />{hint ? <Text className="ml-0.5 mt-1 font-body text-[11px] text-ink-soft dark:text-ink-softDark">{hint}</Text> : null}</View>);
}

export function MultilineField({ label, value, onChangeText, placeholder }: { label: string; value: string; onChangeText: (s: string) => void; placeholder?: string }) {
  return (<View><Label text={label} /><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#a39a88" multiline className={`${fieldCls} min-h-[88px]`} style={{ textAlignVertical: "top" }} /></View>);
}

export function MoneyField({ label, value, onChangeText }: { label: string; value: string; onChangeText: (s: string) => void }) {
  return <TextField label={label} value={value} onChangeText={(s) => onChangeText(s.replace(/[^0-9]/g, ""))} placeholder="0" keyboardType="number-pad" />;
}

export function SwitchField({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (b: boolean) => void }) {
  return (<View className="mt-3 flex-row items-center justify-between rounded-2xl border border-line bg-hanji-card px-3.5 py-3 dark:border-line-dark dark:bg-hanji-cardDark"><Text className="font-body text-[15px] text-ink dark:text-ink-dark">{label}</Text><Switch value={value} onValueChange={onValueChange} trackColor={{ true: "#2f7d6b" }} /></View>);
}

export interface PickerOption { value: string; label: string }
export function PickerField({ label, value, options, onSelect, placeholder = "선택 안 함", allowClear = true }: {
  label: string; value: string; options: PickerOption[]; onSelect: (v: string) => void; placeholder?: string; allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const sel = options.find((o) => o.value === value);
  const close = () => { setOpen(false); setQuery(""); };
  const showSearch = options.length > 8;
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  return (
    <View>
      <Label text={label} />
      <Pressable onPress={() => setOpen(true)} className={`${fieldCls} flex-row items-center justify-between active:opacity-70`}>
        <Text className={`font-body text-[15px] ${sel ? "text-ink dark:text-ink-dark" : "text-[#a39a88]"}`}>{sel ? sel.label : placeholder}</Text>
        <Ionicons name="chevron-down" size={16} color="#a39a88" />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable onPress={close} className="flex-1 justify-end bg-black/40">
          <Pressable onPress={() => {}} className="max-h-[70%] rounded-t-3xl bg-hanji p-4 dark:bg-hanji-dark">
            <Text className="mb-2 text-center font-bodyb text-[15px] text-ink dark:text-ink-dark">{label}</Text>
            {showSearch ? (
              <View className="mb-2 flex-row items-center gap-2 rounded-xl border border-line bg-hanji-card px-3 py-2.5 dark:border-line-dark dark:bg-hanji-cardDark">
                <Ionicons name="search" size={16} color="#a39a88" />
                <TextInput value={query} onChangeText={setQuery} placeholder="검색" placeholderTextColor="#a39a88" autoCorrect={false} autoFocus className="flex-1 font-body text-[15px] text-ink dark:text-ink-dark" />
                {query ? <Ionicons name="close-circle" size={16} color="#a39a88" onPress={() => setQuery("")} /> : null}
              </View>
            ) : null}
            <ScrollView keyboardShouldPersistTaps="handled">
              {allowClear ? (
                <Pressable onPress={() => { onSelect(""); close(); }} className="border-b border-line py-3 active:opacity-60 dark:border-line-dark"><Text className="font-body text-[15px] text-ink-soft dark:text-ink-softDark">{placeholder}</Text></Pressable>
              ) : null}
              {filtered.map((o) => (
                <Pressable key={o.value} onPress={() => { onSelect(o.value); close(); }} className="flex-row items-center justify-between border-b border-line py-3 active:opacity-60 dark:border-line-dark">
                  <Text className="font-body text-[15px] text-ink dark:text-ink-dark">{o.label}</Text>
                  {o.value === value ? <Ionicons name="checkmark" size={18} color="#2f7d6b" /> : null}
                </Pressable>
              ))}
              {showSearch && filtered.length === 0 ? (
                <Text className="py-6 text-center font-body text-[14px] text-ink-soft dark:text-ink-softDark">검색 결과 없음</Text>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function MultiSelectField({ label, values, options, onChange }: { label: string; values: string[]; options: PickerOption[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const sel = options.filter((o) => values.includes(o.value));
  const toggle = (v: string) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <View>
      <Text className="mb-1 mt-3 font-bodym text-[12px] text-ink-soft dark:text-ink-softDark">{label}</Text>
      <Pressable onPress={() => setOpen(true)} className="min-h-[48px] flex-row flex-wrap items-center gap-1.5 rounded-2xl border border-line bg-hanji-card px-3.5 py-2.5 active:opacity-70 dark:border-line-dark dark:bg-hanji-cardDark">
        {sel.length === 0 ? <Text className="font-body text-[15px] text-[#a39a88]">선택</Text> : sel.map((o) => <View key={o.value} className="rounded-full bg-celadon-soft px-2.5 py-1 dark:bg-celadon-deep/40"><Text className="font-bodyb text-[12px] text-celadon dark:text-celadon-dark">{o.label}</Text></View>)}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} className="flex-1 justify-end bg-black/40">
          <Pressable onPress={() => {}} className="max-h-[70%] rounded-t-3xl bg-hanji p-4 dark:bg-hanji-dark">
            <Text className="mb-2 text-center font-bodyb text-[15px] text-ink dark:text-ink-dark">{label}</Text>
            <ScrollView>
              {options.map((o) => (
                <Pressable key={o.value} onPress={() => toggle(o.value)} className="flex-row items-center justify-between border-b border-line py-3 active:opacity-60 dark:border-line-dark">
                  <Text className="font-body text-[15px] text-ink dark:text-ink-dark">{o.label}</Text>
                  <Ionicons name={values.includes(o.value) ? "checkbox" : "square-outline"} size={20} color={values.includes(o.value) ? "#2f7d6b" : "#c9bfa9"} />
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => setOpen(false)} className="mt-2 items-center rounded-xl bg-celadon py-3 active:opacity-80"><Text className="font-bodyb text-[15px] text-white">완료</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
