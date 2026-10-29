import { createContext, useContext } from "react";

/** 추가/편집 폼 표현 방식 — 사용감 비교용(테스트). */
export type FormMode = "drawer" | "modal";

export interface UiPrefsValue {
  dark: boolean;
  formMode: FormMode;
}

export const UiPrefs = createContext<UiPrefsValue>({ dark: false, formMode: "drawer" });
export const useUiPrefs = () => useContext(UiPrefs);

const DARK_KEY = "tm.dark";
const FORM_KEY = "tm.formMode";

export function loadDark(): boolean {
  try { return localStorage.getItem(DARK_KEY) === "1"; } catch { return false; }
}
export function saveDark(v: boolean) { try { localStorage.setItem(DARK_KEY, v ? "1" : "0"); } catch { /* ignore */ } }
export function loadFormMode(): FormMode {
  try { return localStorage.getItem(FORM_KEY) === "modal" ? "modal" : "drawer"; } catch { return "drawer"; }
}
export function saveFormMode(v: FormMode) { try { localStorage.setItem(FORM_KEY, v); } catch { /* ignore */ } }
