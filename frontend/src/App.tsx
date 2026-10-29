import { useEffect, useState, useMemo, useRef, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Search, Plus, ChevronLeft, ChevronRight, Menu, Users, CalendarClock, MessageSquare, Upload,
  BarChart3, Settings, LayoutDashboard, ShieldCheck, Printer, FileSpreadsheet, PanelLeft, LogOut, X,
  Moon, Sun, SlidersHorizontal, LayoutGrid, Lock, Database, DatabaseZap, User,
} from "lucide-react";
import { UiPrefs, type FormMode, loadDark, saveDark, loadFormMode, saveFormMode, useUiPrefs } from "@/lib/ui-prefs";
import { Canvas } from "@/Canvas";
import { MobileApp } from "@/mobile/MobileApp";
import { useIsMobile } from "@/lib/use-is-mobile";
import {
  SLOT_DEFS, SLOT_LABEL, SLOT_HINT, ALL_SLOT_KEYS, type Member, type Reg,
} from "@/data";
import { DataGrid } from "@/DataGrid";
import type { ColDef } from "ag-grid-community";
import { api, apiFetch, ApiError, downloadFile, uploadXlsx, uploadImage } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authStore } from "@/lib/auth-store";
import { useLive, serviceTypeLabel } from "@/lib/live";
import type { ServiceItem, Missionary, CommonCode, Enshrinement, RosterRow } from "@/lib/types";

/* ============== 프리미티브 ============== */
type Tone = "celadon" | "red" | "gold" | "ghost";
const TONE: Record<Tone, string> = {
  celadon: "bg-accent text-celadon border-transparent",
  red: "bg-vermilion/12 text-vermilion border-transparent",
  gold: "bg-gold/15 text-gold border-transparent",
  ghost: "bg-transparent text-muted-foreground border-border",
};
function Chip({ tone = "ghost", children, className = "" }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11.5px] font-bold ${TONE[tone]} ${className}`}>{children}</span>;
}
/** PageTitle/Ann desc 는 dangerouslySetInnerHTML(<b> 등 정적 마크업)로 렌더되므로, 사용자 입력을 끼울 땐 반드시 이스케이프. */
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function PageTitle({ title, route, desc, actions }: { title: string; route: string; desc?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-4" data-tm-pagetitle>
      <div data-tm-pttext>
        <div className="flex items-center gap-2.5">
          <h1 className="text-[19px] font-bold tracking-tight">{title}</h1>
          <span className="rounded border bg-secondary px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">{route}</span>
        </div>
        {desc && <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-muted-foreground" dangerouslySetInnerHTML={{ __html: desc }} />}
      </div>
      {actions && <div className="ml-auto flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
function Ann({ show, children }: { show: boolean; children: string }) {
  if (!show) return null;
  return <div data-tm-ann className="mb-4 rounded-lg border border-l-4 border-gold bg-gradient-to-b from-amber-50 to-amber-100/60 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-900" dangerouslySetInnerHTML={{ __html: children }} />;
}
function KV({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2 text-[13.5px]">
      {items.map(([k, v], i) => (<Fragment key={i}><dt className="font-bold text-muted-foreground">{k}</dt><dd className="m-0">{v}</dd></Fragment>))}
    </dl>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (<div className="mt-5"><div className="mb-2 flex items-center gap-2"><span className="h-3.5 w-1 rounded bg-celadon" /><h4 className="font-serif text-sm font-bold">{title}</h4></div>{children}</div>);
}
const krw = (n: number) => n.toLocaleString() + "원";

const NAV = [
  { group: "회원관리", items: [
    { key: "member-status", icon: LayoutGrid, label: "회원현황" },
    { key: "members", icon: Users, label: "회원관리" },
    { key: "dashboard", icon: LayoutDashboard, label: "대시보드" },
    { key: "enshrinements", icon: CalendarClock, label: "봉안일·기일" },
    { key: "counsels", icon: MessageSquare, label: "상담 관리" },
    { key: "import", icon: Upload, label: "일괄 업로드" },
    { key: "reports", icon: BarChart3, label: "리포트" },
    { key: "canvas", icon: LayoutGrid, label: "캔버스 ✨" },
  ] },
  { group: "관리자", admin: true, items: [
    { key: "admin-codes", icon: Settings, label: "공통코드" },
    { key: "admin-items", icon: Settings, label: "불사목록" },
    { key: "admin-missionaries", icon: Users, label: "포교원장" },
    { key: "admin-roles", icon: ShieldCheck, label: "역할·권한" },
    { key: "admin-staff", icon: Users, label: "사원" },
    { key: "admin-accounts", icon: ShieldCheck, label: "계정 관리" },
    { key: "admin-backup", icon: Database, label: "백업 관리" },
    { key: "admin-migration", icon: DatabaseZap, label: "초기 데이터 이관" },
  ] },
];
const CRUMB: Record<string, string> = {
  canvas: "캔버스", members: "회원관리", dashboard: "대시보드", enshrinements: "봉안일·기일", counsels: "상담 관리",
  import: "일괄 업로드", "member-status": "회원현황", reports: "회원현황 리포트", "reports-svc": "제사·불사 현황", "reg-new": "불사 신청 입력",
  "member-edit": "회원 등록·수정", "admin-codes": "공통코드", "admin-items": "불사목록",
  "admin-missionaries": "포교원장", "admin-roles": "역할·권한", "admin-staff": "사원", "admin-accounts": "계정 관리",
  "admin-backup": "백업 관리", "admin-migration": "초기 데이터 이관",
};

const PROTO_TO_API: Record<string, string> = {
  bogwija: "bogwija", rel: "relationship", bokjunja: "bokjunja", spirit: "spiritual", yesujae: "yesujae", seongju: "seongju12",
};

// 봉안일 드롭다운 표기 — 이름만("49재")은 찾기 어려워 날짜·시간 + 이름으로 표시.
function ensOptionLabel(f: { label: string | null; eventDateSolar: string }): string {
  const d = new Date(f.eventDateSolar);
  const dt = `${d.toLocaleDateString("ko-KR")} ${d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`;
  return f.label ? `${dt} · ${f.label}` : dt;
}

// 로그인 사용자 표시용 — access 토큰의 roles 클레임 디코드 + 역할코드 한글화.
const ROLE_LABEL: Record<string, string> = { ADMIN: "관리자", STAFF: "직원", READONLY: "조회 전용" };
function tokenRoles(token: string | null): string[] {
  if (!token) return [];
  try {
    const b64 = token.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/");
    const payload: unknown = JSON.parse(atob(b64 ?? ""));
    const roles = (payload as { roles?: unknown }).roles;
    return Array.isArray(roles) ? roles.filter((r): r is string => typeof r === "string") : [];
  } catch { return []; }
}

// 탭 인디케이터 — 사이드바/검색으로 연 화면을 탭으로 띄워두고 전환. 서브뷰(reports-svc)는 부모 탭에 귀속.
const NAV_ITEMS = NAV.flatMap((g) => g.items);
const PANEL_CATALOG = NAV_ITEMS.filter((i) => i.key !== "canvas"); // 캔버스에 던져 넣을 수 있는 화면(탭) 목록
const TABBABLE = new Set<string>([...NAV_ITEMS.map((i) => i.key), "search"]);
const tabIcon = (k: string) => NAV_ITEMS.find((i) => i.key === k)?.icon;
const tabLabel = (k: string) => CRUMB[k] ?? (k === "search" ? "통합검색" : k);
const tabKeyOf = (r: string) => (r === "reports-svc" ? "reports" : r);
// v2: 기본 랜딩을 회원현황(member-status)으로 변경 — 키를 올려 기존 저장 탭도 새 기본으로 초기화(1회).
const HOME = "member-status";
const TABS_KEY = "tm.openTabs.v2";
const ROUTE_KEY = "tm.activeRoute.v2";
function loadTabs(): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(TABS_KEY) ?? "[]");
    const valid = Array.isArray(raw) ? raw.filter((k): k is string => typeof k === "string" && TABBABLE.has(k)) : [];
    return valid.length ? valid : [HOME];
  } catch { return [HOME]; }
}
function loadActiveRoute(tabs: string[]): string {
  const r = localStorage.getItem(ROUTE_KEY);
  return r && tabs.includes(tabKeyOf(r)) ? r : (tabs[0] ?? HOME);
}

export default function App() {
  const [authed, setAuthed] = useState(authStore.isAuthenticated());
  const [openTabs, setOpenTabs] = useState<string[]>(() => (authStore.isAuthenticated() ? loadTabs() : [HOME]));
  const [route, setRoute] = useState(() => (authStore.isAuthenticated() ? loadActiveRoute(loadTabs()) : "login"));
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [tabCtx, setTabCtx] = useState<{ x: number; y: number; key: string } | null>(null);
  const [dark, setDark] = useState<boolean>(loadDark);
  const [formMode, setFormMode] = useState<FormMode>(loadFormMode);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pwChangeOpen, setPwChangeOpen] = useState(false);
  const [memberEdit, setMemberEdit] = useState<null | "new" | "edit">(null);
  const [regNew, setRegNew] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const dragSuppressClick = useRef(false);
  const [lockMin, setLockMin] = useState<number>(() => Number(localStorage.getItem("tm.lockMin") ?? "0"));
  const [locked, setLocked] = useState(false);
  const isMobile = useIsMobile();
  useEffect(() => { try { localStorage.setItem("tm.lockMin", String(lockMin)); } catch { /* */ } }, [lockMin]);
  // 유휴(설정 분) 경과 시 화면 보호 모드 진입 — 개인정보 무단 열람 방지(NFR-SEC).
  useEffect(() => {
    if (!authed || locked || lockMin <= 0) return;
    let timer = 0;
    const reset = () => { window.clearTimeout(timer); timer = window.setTimeout(() => setLocked(true), lockMin * 60_000); };
    const evts = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"];
    evts.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { window.clearTimeout(timer); evts.forEach((e) => window.removeEventListener(e, reset)); };
  }, [authed, locked, lockMin]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdOpen((o) => !o); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const modern = formMode === "modal"; // 2.0 = 모던 풀스킨(폼+셸 전체)
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); saveDark(dark); }, [dark]);
  useEffect(() => { saveFormMode(formMode); }, [formMode]);
  useEffect(() => { document.documentElement.classList.toggle("modern", modern); }, [modern]);
  const [searchTerm, setSearchTerm] = useState("");
  const [ann, setAnn] = useState(false);
  const [selId, setSelId] = useState<string>("");
  const [tab, setTab] = useState<"reg" | "cns">("reg");
  const [regSel, setRegSel] = useState<Reg | null>(null);
  const [cnsBody, setCnsBody] = useState("");
  const [cnsOpen, setCnsOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [cnsListOpen, setCnsListOpen] = useState(false);
  const [cnsListMember, setCnsListMember] = useState("");
  const [cnsListBody, setCnsListBody] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [selReg, setSelReg] = useState<string | null>(null);

  const live = useLive(authed);
  const [menuCodes, setMenuCodes] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!authed) { setMenuCodes(null); return; }
    let alive = true;
    api.get<{ items: { code: string }[] }[]>("/menus")
      .then((gs) => { if (alive) setMenuCodes(new Set(gs.flatMap((g) => g.items.map((i) => i.code)))); })
      .catch(() => { if (alive) setMenuCodes(null); });
    return () => { alive = false; };
  }, [authed]);
  const members = live.members;
  // 쓰기 권한 — 서버 RBAC 가 최종 강제(403)하되, 조회 전용 계정에는 UI 에서도 쓰기 버튼을 숨긴다.
  //   토큰 roles 에 ADMIN/STAFF 가 없으면(=READONLY 등) 읽기 전용으로 간주.
  const myRoles = tokenRoles(authStore.getToken());
  const ro = !myRoles.includes("ADMIN") && !myRoles.includes("STAFF");
  const sel = members.find((m) => String(m.id) === selId) || members[0];

  useEffect(() => {
    if (members.length && (!selId || !members.some((m) => String(m.id) === selId))) {
      setSelId(String(members[0].id));
    }
  }, [members, selId]);

  // 탭/활성 라우트 영속화 — 새로고침 후 복원.
  useEffect(() => {
    if (!authed) return;
    localStorage.setItem(TABS_KEY, JSON.stringify(openTabs));
    localStorage.setItem(ROUTE_KEY, route);
  }, [authed, openTabs, route]);

  const go = (r: string) => {
    // 회원 등록/수정·불사 신청은 전체화면 라우트 대신 드로워/모달 오버레이로(일관성).
    if (r === "member-new") { setMemberEdit("new"); setNavOpen(false); return; }
    if (r === "member-edit") { setMemberEdit("edit"); setNavOpen(false); return; }
    if (r === "reg-new") { setRegNew(true); setNavOpen(false); return; }
    setRoute(r); setNavOpen(false);
    const tk = tabKeyOf(r);
    if (TABBABLE.has(tk)) setOpenTabs((prev) => (prev.includes(tk) ? prev : [...prev, tk]));
  };
  const closeTab = (k: string) => {
    const idx = openTabs.indexOf(k);
    const next = openTabs.filter((t) => t !== k);
    if (next.length === 0) { setOpenTabs([HOME]); setRoute(HOME); return; }
    setOpenTabs(next);
    if (tabKeyOf(route) === k) setRoute(next[idx] ?? next[idx - 1] ?? next[next.length - 1]);
  };
  const closeOthers = (k: string) => { setOpenTabs([k]); setRoute(k); };
  const closeRight = (k: string) => {
    const idx = openTabs.indexOf(k);
    if (idx < 0) return;
    const next = openTabs.slice(0, idx + 1);
    setOpenTabs(next);
    if (!next.includes(tabKeyOf(route))) setRoute(k);
  };
  const closeAllTabs = () => { setOpenTabs([HOME]); setRoute(HOME); };
  const moveTab = (from: number, to: number) => {
    setOpenTabs((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  };
  const selectMember = (id: string) => { setSelId(id); setTab("reg"); setCnsOpen(false); setRegSel(null); setSelReg(null); go("members"); };
  // 회원현황에서 불사 건 상세를 화면 이동 없이 바로 연다 — 건 단위 그리드도 "더블클릭=그 행의 상세" 규칙으로 일관화.
  const openReg = (memberId: string, regId: string) => {
    const m = members.find((x) => String(x.id) === memberId);
    const rg = m?.regs.find((x) => String(x.id) === regId);
    setSelId(memberId); setSelReg(regId); setRegSel(rg ?? null);
  };
  const logout = async () => { try { await api.post("/auth/logout", {}); } catch { /* 오프라인 등 서버 취소 실패해도 로컬 정리는 진행 */ } authStore.clear(); localStorage.removeItem(TABS_KEY); localStorage.removeItem(ROUTE_KEY); setOpenTabs([HOME]); setAuthed(false); setRoute("login"); };
  // 로그인 사용자(헤더 표시) — loginId(로그인 시 저장) + 토큰 roles 한글화.
  const currentLoginId = (() => { try { return localStorage.getItem("tm.loginId") ?? ""; } catch { return ""; } })();
  const currentRoleLabel = tokenRoles(authStore.getToken()).map((r) => ROLE_LABEL[r] ?? r).join("·");

  function WBtn({ label, onClick, variant = "default", size = "default", icon }: { label: string; onClick?: () => void; variant?: "default" | "outline" | "ghost"; size?: "default" | "sm" | "icon"; icon?: React.ReactNode }) {
    if (ro) return null; // 조회 전용 — 쓰기 버튼 자체를 숨김(등록/수정/삭제 진입 불가). 서버도 403 으로 이중 차단.
    return <Button variant={variant} size={size} onClick={onClick}>{icon}{label}</Button>;
  }

  /* ---------- 로그인 ---------- */
  if (route === "login" || !authed) {
    return <LoginScreen onSuccess={() => { setAuthed(true); go(HOME); }} />;
  }

  // 모바일 전용 트리 — 데스크톱 셸과 분리. 잠금 오버레이는 공통 적용.
  if (isMobile) {
    return (
      <UiPrefs.Provider value={{ dark, formMode }}>
        <MobileApp dark={dark} setDark={setDark} onLock={() => setLocked(true)} onLogout={logout} formMode={formMode} setFormMode={setFormMode} />
        {locked && <LockScreen onUnlock={() => setLocked(false)} onLogout={() => { setLocked(false); logout(); }} />}
      </UiPrefs.Provider>
    );
  }

  // 좌측 메뉴 → 캔버스 드래그(마우스 이벤트 기반 — 버튼 HTML5 draggable/포인터가 불안정해 직접 구현).
  // 캔버스는 레거시·2.0 모두 접근 가능하므로 모드 무관하게 동작.
  const startMenuDrag = (e: React.MouseEvent, key: string, label: string) => {
    if (key === "canvas" || e.button !== 0) return;
    e.preventDefault(); // 포커스/텍스트선택/네이티브 드래그 방지
    const sx = e.clientX, sy = e.clientY;
    let dragging = false;
    let ghost: HTMLDivElement | null = null;
    const zones = () => Array.from(document.querySelectorAll<HTMLElement>("[data-canvas-dropzone]"));
    const zoneAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest("[data-canvas-dropzone]") as HTMLElement | null);
    const move = (ev: MouseEvent) => {
      if (!dragging) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
        dragging = true;
        ghost = document.createElement("div");
        ghost.textContent = "＋ " + label;
        ghost.style.cssText = "position:fixed;z-index:1000;pointer-events:none;padding:6px 12px;border-radius:10px;font-size:13px;font-weight:700;background:#fff;color:#2f7d6b;border:1px solid #2f7d6b;box-shadow:0 8px 24px -8px rgba(0,0,0,.35)";
        document.body.appendChild(ghost);
        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";
      }
      if (ghost) { ghost.style.left = ev.clientX + 12 + "px"; ghost.style.top = ev.clientY + 10 + "px"; }
      const z = zoneAt(ev.clientX, ev.clientY);
      zones().forEach((el) => el.classList.toggle("tm-dropring", el === z));
    };
    const up = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      if (ghost) ghost.remove();
      zones().forEach((el) => el.classList.remove("tm-dropring"));
      if (dragging) {
        dragSuppressClick.current = true;
        window.setTimeout(() => { dragSuppressClick.current = false; }, 80);
        const z = zoneAt(ev.clientX, ev.clientY);
        if (z) window.dispatchEvent(new CustomEvent("tm:add-panel", { detail: { key } }));
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const Sidebar = (col: boolean) => (
    <div className="flex h-full flex-col gap-1.5 p-3">
      <div className={`mb-2 flex items-center border-b pb-3.5 ${col ? "justify-center" : "px-1"}`}>
        {col
          ? <div className="font-serif text-[15px] font-black">불사</div>
          : <div><div className="font-serif text-[17px] font-black leading-none">불사 · 회원관리</div><div className="mt-1 text-[11px] tracking-wide text-muted-foreground">사찰 통합 관리 시스템</div></div>}
      </div>
      {NAV.map((g) => {
        const items = g.items.filter((it) => it.key === "canvas" || !menuCodes || menuCodes.has(it.key));
        if (items.length === 0) return null;
        return (
        <div key={g.group}>
          {col ? <div className="my-2 border-t" /> : <div className="px-2.5 pb-1.5 pt-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{g.group}</div>}
          {items.map((it) => {
            const active = route === it.key || (it.key === "reports" && route === "reports-svc");
            const Icon = it.icon;
            return (
              <button key={it.key} onClick={() => { if (dragSuppressClick.current) return; go(it.key); }} title={col ? it.label : (it.key !== "canvas" ? "캔버스로 드래그해 패널 추가" : undefined)}
                onMouseDown={(e) => startMenuDrag(e, it.key, it.label)}
                className={`group flex w-full items-center rounded-[10px] border text-sm font-semibold transition
                ${it.key !== "canvas" ? "tm-drag-src" : ""}
                ${col ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2 hover:translate-x-0.5"}
                ${active ? "border-border bg-card text-celadon shadow-sm" : "border-transparent text-foreground/80 hover:bg-card/60"}`}>
                <Icon className="h-4 w-4 flex-none opacity-85" />{!col && it.label}
              </button>
            );
          })}
        </div>
        );
      })}
      {!col && <div className="mt-auto border-t pt-3.5 text-[11px] leading-relaxed text-muted-foreground">불사 · 회원관리 · Phase 1<br />실데이터 연동</div>}
    </div>
  );

  // 키 → 화면 렌더(라우트 본문 + 캔버스 패널 공용)
  const renderRoute = (r: string): React.ReactNode => {
    if (r === "dashboard") return <Dashboard ann={ann} go={go} selectMember={selectMember} members={members} />;
    if (r === "members") return (
      <MembersScreen ann={ann} members={members} sel={sel} selId={selId} setSelId={setSelId} tab={tab} setTab={setTab}
        selReg={selReg} setSelReg={setSelReg} setRegSel={setRegSel} cnsOpen={cnsOpen} setCnsOpen={setCnsOpen}
        cnsBody={cnsBody} setCnsBody={setCnsBody} WBtn={WBtn} go={go} reload={live.reload} loading={live.loading} ro={ro} />
    );
    if (r === "search") return <SearchScreen term={searchTerm} selectMember={selectMember} />;
    if (r === "enshrinements") return <Enshrinements ann={ann} ro={ro} selectMember={selectMember} enshrinements={live.enshrinements} reload={live.reload} />;
    if (r === "counsels") return <Counsels ann={ann} members={members} cnsListOpen={cnsListOpen} setCnsListOpen={setCnsListOpen} cnsListMember={cnsListMember} setCnsListMember={setCnsListMember} cnsListBody={cnsListBody} setCnsListBody={setCnsListBody} reload={live.reload} selectMember={selectMember} WBtn={WBtn} />;
    if (r === "import") return <ImportWizard ann={ann} reload={live.reload} />;
    if (r === "member-status") return <MemberStatus members={members} selectMember={selectMember} openReg={openReg} />;
    if (r === "reports" || r === "reports-svc") return <Reports ann={ann} route={r} setRoute={setRoute} members={members} selectMember={selectMember} />;
    if (r.startsWith("admin")) return <Admin route={r} ann={ann} />;
    return null;
  };

  let body: React.ReactNode = null;
  if (live.error && !members.length) body = <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">데이터 로드 오류: {live.error}<br /><button onClick={() => live.reload()} className="mt-2 rounded border border-red-300 px-2 py-1 font-bold hover:bg-red-100">다시 시도</button></div>;
  else if (route === "canvas") body = <Canvas catalog={PANEL_CATALOG} renderPanel={renderRoute} dataKey={members} />;
  else body = renderRoute(route);

  return (
    <UiPrefs.Provider value={{ dark, formMode }}>
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-screen">
        <aside className={`sticky top-0 hidden h-screen flex-none overflow-auto border-r bg-gradient-to-b from-secondary to-[hsl(40_25%_82%)] transition-[width] duration-200 md:block ${collapsed ? "w-[68px]" : "w-[264px]"}`}>{Sidebar(collapsed)}</aside>
        <Sheet open={navOpen} onOpenChange={setNavOpen}><SheetContent side="left" className="w-[280px] p-0">{Sidebar(false)}</SheetContent></Sheet>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className={`sticky top-0 z-20 flex items-center gap-2 border-b px-3 py-2 md:px-5 ${modern ? "tm-glass" : "bg-background/85 backdrop-blur"}`}>
            <Button variant="outline" size="icon" className="hidden h-9 w-9 md:flex" onClick={() => setCollapsed(!collapsed)} title="사이드바 접기/펴기"><PanelLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" className="h-9 w-9 md:hidden" onClick={() => setNavOpen(true)}><Menu className="h-4 w-4" /></Button>
            <div className="flex items-center gap-2 md:hidden"><span className="font-serif text-base font-black">불사 · 회원관리</span></div>
            <div className="hidden text-xs text-muted-foreground md:block">불사 · 회원관리 · <b className="text-foreground/80">{CRUMB[route] || "회원관리"}</b></div>
            <div className="flex-1" />
            <form className="hidden items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground lg:flex lg:w-72" onSubmit={(e) => { e.preventDefault(); if (searchTerm.trim()) go("search"); }}>
              <Search className="h-4 w-4" />
              <input className="w-full bg-transparent text-foreground outline-none" placeholder="회원·복전자·영가 통합 검색" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </form>
            <div className="hidden items-center gap-2 sm:flex">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-muted-foreground"><input type="checkbox" checked={ann} onChange={(e) => setAnn(e.target.checked)} className="accent-[hsl(167_39%_30%)]" />주석</label>
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setLocked(true)} title="화면 잠금"><Lock className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCmdOpen(true)} title="빠른 이동 (⌘K)"><Search className="h-4 w-4" /></Button>
            <div className="relative">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSettingsOpen((o) => !o)} title="설정·인터페이스"><SlidersHorizontal className="h-4 w-4" /></Button>
              {settingsOpen && (<>
                <div className="fixed inset-0 z-30" onClick={() => setSettingsOpen(false)} />
                <div className="absolute right-0 z-40 mt-1.5 w-56 rounded-md border bg-card p-3 shadow-lg">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">인터페이스 (사용감 테스트)</div>
                  <button onClick={() => setDark((d) => !d)} className="mb-3 flex w-full items-center justify-between rounded-md border px-2.5 py-2 text-sm hover:bg-secondary">
                    <span className="flex items-center gap-2 font-medium">{dark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />} 다크 모드</span>
                    <span className={`text-xs font-bold ${dark ? "text-celadon" : "text-muted-foreground"}`}>{dark ? "ON" : "OFF"}</span>
                  </button>
                  <div className="mb-1.5 text-[11px] font-bold text-muted-foreground">인터페이스 모드 (앱 전체)</div>
                  <div className="flex gap-1.5">
                    {([["drawer", "레거시"], ["modal", "2.0 ✨"]] as [FormMode, string][]).map(([m, lbl]) => (
                      <button key={m} onClick={() => setFormMode(m)} className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-bold transition ${formMode === m ? "border-celadon bg-accent text-celadon" : "text-muted-foreground hover:bg-secondary"}`}>{lbl}</button>
                    ))}
                  </div>
                  <div className="mb-1.5 mt-3 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground"><Lock className="h-3 w-3" /> 화면 보호 (자동 잠금)</div>
                  <div className="grid grid-cols-5 gap-1">
                    {[0, 1, 3, 5, 10, 15, 20, 25, 30].map((m) => (
                      <button key={m} onClick={() => setLockMin(m)} title={m === 0 ? "끄기" : `${m}분 후 자동 잠금`} className={`rounded-md border py-1 text-[11px] font-bold transition ${lockMin === m ? "border-celadon bg-accent text-celadon" : "text-muted-foreground hover:bg-secondary"}`}>{m === 0 ? "끄기" : m}</button>
                    ))}
                  </div>
                  <div className="my-2.5 border-t" />
                  <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">계정</div>
                  <button onClick={() => { setSettingsOpen(false); setPwChangeOpen(true); }} className="mb-2 flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-sm font-medium hover:bg-secondary"><Lock className="h-4 w-4" /> 비밀번호 변경</button>
                  <button onClick={() => { setSettingsOpen(false); setLocked(true); }} className="flex w-full items-center justify-center gap-1.5 rounded-md bg-foreground/90 py-1.5 text-xs font-bold text-background hover:bg-foreground"><Lock className="h-3.5 w-3.5" /> 지금 잠그기</button>
                </div>
              </>)}
            </div>
            <div className="hidden items-center gap-1.5 border-l pl-2 sm:flex" title="로그인 계정">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="max-w-[120px] truncate text-xs font-bold text-foreground/80">{currentLoginId || "—"}</span>
              {currentRoleLabel && <span className="rounded bg-secondary px-1.5 py-0.5 text-[10.5px] font-bold text-muted-foreground">{currentRoleLabel}</span>}
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={logout} title="로그아웃"><LogOut className="h-4 w-4" /></Button>
          </header>
          {openTabs.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto border-b bg-card/30 px-3 py-1.5">
              {openTabs.map((k, i) => {
                const Icon = tabIcon(k);
                const active = tabKeyOf(route) === k;
                return (
                  <div key={k} onClick={() => setRoute(k)}
                    draggable
                    onDragStart={(e) => { setDragIdx(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); }}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (overIdx !== i) setOverIdx(i); }}
                    onDragLeave={() => { if (overIdx === i) setOverIdx(null); }}
                    onDrop={(e) => { e.preventDefault(); if (dragIdx !== null) moveTab(dragIdx, i); setDragIdx(null); setOverIdx(null); }}
                    onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                    onContextMenu={(e) => { e.preventDefault(); setTabCtx({ x: e.clientX, y: e.clientY, key: k }); }}
                    title="드래그로 순서변경 · 우클릭 메뉴"
                    className={`group flex flex-none cursor-pointer select-none items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition
                    ${active ? "border-border bg-card text-celadon shadow-sm" : "border-transparent text-muted-foreground hover:bg-card/60"}
                    ${dragIdx === i ? "opacity-40" : ""}
                    ${overIdx === i && dragIdx !== null && dragIdx !== i ? "ring-2 ring-[hsl(167_44%_33%)]" : ""}`}>
                    {Icon && <Icon className="h-3.5 w-3.5 opacity-85" />}
                    <span className="whitespace-nowrap">{tabLabel(k)}</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); closeTab(k); }}
                      title="탭 닫기" className="ml-0.5 rounded p-0.5 opacity-40 hover:bg-secondary hover:text-vermilion hover:opacity-100">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="has-bottomnav w-full flex-1 p-4 md:px-6 md:py-5">{body}</div>
          {/* 모바일 전용 하단 탭바 */}
          <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-background/90 backdrop-blur md:hidden">
            {[["members", Users, "회원"], ["dashboard", LayoutDashboard, "대시보드"], ["enshrinements", CalendarClock, "봉안일"], ["counsels", MessageSquare, "상담"], ["reports", BarChart3, "리포트"]].map(([key, Icon, label]) => {
              const active = route === (key as string);
              const I = Icon as React.ComponentType<{ className?: string }>;
              return (
                <button key={key as string} onClick={() => go(key as string)} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold transition ${active ? "text-celadon" : "text-muted-foreground"}`}>
                  <I className="h-5 w-5" />{label as string}
                </button>
              );
            })}
          </nav>
        </main>
      </div>

      {tabCtx && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setTabCtx(null)} onContextMenu={(e) => { e.preventDefault(); setTabCtx(null); }} />
          <div className="fixed z-50 min-w-[140px] overflow-hidden rounded-md border bg-card py-1 text-xs shadow-lg" style={{ left: tabCtx.x, top: tabCtx.y }}>
            <button className="block w-full px-3 py-1.5 text-left font-medium hover:bg-secondary" onClick={() => { closeTab(tabCtx.key); setTabCtx(null); }}>탭 닫기</button>
            <button className="block w-full px-3 py-1.5 text-left font-medium hover:bg-secondary" onClick={() => { closeOthers(tabCtx.key); setTabCtx(null); }}>다른 탭 닫기</button>
            {openTabs.indexOf(tabCtx.key) < openTabs.length - 1 && (
              <button className="block w-full px-3 py-1.5 text-left font-medium hover:bg-secondary" onClick={() => { closeRight(tabCtx.key); setTabCtx(null); }}>오른쪽 탭 닫기</button>
            )}
            <button className="block w-full px-3 py-1.5 text-left font-medium hover:bg-secondary" onClick={() => { closeAllTabs(); setTabCtx(null); }}>모든 탭 닫기</button>
          </div>
        </>
      )}
      {sel && <RegSheet reg={regSel} onClose={() => setRegSel(null)} member={sel} items={live.items} fdays={live.enshrinements} ro={ro} reload={live.reload} />}
      {memberEdit && <FormShell open onClose={() => setMemberEdit(null)}>
        <MemberEdit sel={sel} editing={memberEdit === "edit"} newMode={memberEdit === "new"} missionaries={live.missionaries} go={() => setMemberEdit(null)} reload={live.reload} WBtn={WBtn} ann={ann} />
      </FormShell>}
      {regNew && sel && <FormShell open onClose={() => setRegNew(false)}>
        <RegNew sel={sel} items={live.items} fdays={live.enshrinements} ann={ann} go={() => setRegNew(false)} reload={live.reload} />
      </FormShell>}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} members={members} go={go} selectMember={selectMember} />
      <PasswordChangeDialog open={pwChangeOpen} onClose={() => setPwChangeOpen(false)} />
      {locked && <LockScreen onUnlock={() => setLocked(false)} onLogout={() => { setLocked(false); logout(); }} />}
    </TooltipProvider>
    </UiPrefs.Provider>
  );
}

/* ============== 로그인 ============== */
/** 화면 보호(잠금) — 콘텐츠를 가리고 비밀번호 재인증으로만 해제(개인정보 무단 열람 방지). */
function LockScreen({ onUnlock, onLogout }: { onUnlock: () => void; onLogout: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const loginId = (() => { try { return localStorage.getItem("tm.loginId") ?? ""; } catch { return ""; } })();
  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(t); }, []);
  const submit = async () => {
    if (!password) return;
    setBusy(true); setError(null);
    try {
      const res = await api.post<{ accessToken: string }>("/auth/login", { loginId, password, cookieMode: true });
      authStore.setTokens(res.accessToken);
      onUnlock();
    } catch { setError("비밀번호가 올바르지 않습니다."); } finally { setBusy(false); }
  };
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background/80 backdrop-blur-2xl">
      <div className="mb-1 font-mono text-6xl font-black tabular-nums tracking-tight">{hh}:{mm}</div>
      <div className="mb-8 text-sm text-muted-foreground">{now.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}</div>
      <div className="w-full max-w-xs rounded-2xl border bg-card/90 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-center gap-2 text-celadon"><Lock className="h-5 w-5" /><span className="font-serif text-lg font-bold">화면 잠김</span></div>
        <p className="mb-3 text-center text-xs text-muted-foreground">{loginId ? <><b>{loginId}</b> · 비밀번호로 잠금 해제</> : "비밀번호로 잠금 해제"}</p>
        <input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
          placeholder="비밀번호" className="mb-2 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-celadon" />
        {error && <div className="mb-2 rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700">{error}</div>}
        <button onClick={() => void submit()} disabled={busy} className="w-full rounded-lg bg-gradient-to-r from-[hsl(167_44%_34%)] to-[hsl(167_46%_27%)] py-2 text-sm font-bold text-white disabled:opacity-60">{busy ? "확인 중…" : "잠금 해제"}</button>
        <button onClick={onLogout} className="mt-2 w-full text-center text-xs text-muted-foreground hover:text-foreground">다른 계정으로 로그인</button>
      </div>
    </div>
  );
}

function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forceReset, setForceReset] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const res = await api.post<{ accessToken: string; mustResetPassword: boolean }>("/auth/login", { loginId, password, cookieMode: true });
      authStore.setTokens(res.accessToken);
      try { localStorage.setItem("tm.loginId", loginId); } catch { /* */ } // 화면 잠금 해제(재인증)용
      if (res.mustResetPassword) setForceReset(true);
      else onSuccess();
    } catch (e) { setError(e instanceof ApiError ? e.message : "로그인 실패"); } finally { setBusy(false); }
  };
  const changePw = async () => {
    setError(null);
    if (newPw.length < 8) { setError("새 비밀번호는 8자 이상이어야 합니다."); return; }
    if (newPw !== newPw2) { setError("새 비밀번호가 일치하지 않습니다."); return; }
    setBusy(true);
    try {
      await api.post("/auth/change-password", { currentPassword: password, newPassword: newPw });
      onSuccess();
    } catch (e) { setError(e instanceof ApiError ? e.message : "변경 실패"); } finally { setBusy(false); }
  };
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <Card className="w-[400px] max-w-full shadow-2xl">
        <CardContent className="p-9">
          <div className="flex flex-col items-center gap-3 pb-4 text-center">
            <div><div className="font-serif text-2xl font-black">불사 · 회원관리</div><div className="text-[11px] tracking-wide text-muted-foreground">사찰 통합 관리 시스템</div></div>
          </div>
          {forceReset ? (
            <form className="space-y-3 pt-2" onSubmit={(e) => { e.preventDefault(); void changePw(); }}>
              <div className="rounded-lg bg-accent px-3 py-2.5 text-[12px] text-celadon">최초 로그인입니다. 임시 비밀번호를 <b>새 비밀번호로 변경</b>해 주세요(8자 이상).</div>
              <div><Label className="mb-1.5 block">새 비밀번호</Label><Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoFocus /></div>
              <div><Label className="mb-1.5 block">새 비밀번호 확인</Label><Input type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} /></div>
              {error && <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
              <Button className="w-full" type="submit" disabled={busy}>{busy ? "변경 중…" : "비밀번호 변경 후 시작"}</Button>
            </form>
          ) : (<>
            <form className="space-y-3 pt-2" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
              <div><Label className="mb-1.5 block">로그인 ID</Label><Input value={loginId} onChange={(e) => setLoginId(e.target.value)} /></div>
              <div><Label className="mb-1.5 block">비밀번호</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              {error && <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
              <Button className="w-full" type="submit" disabled={busy}>{busy ? "로그인 중…" : "로그인"}</Button>
            </form>
            <div className="mt-4 rounded-lg bg-accent px-3 py-2.5 text-[11.5px] leading-relaxed text-celadon">🔒 argon2 · JWT(access+refresh 회전) · 실패 5회 잠금 · 최초 비번변경 강제</div>
          </>)}
        </CardContent>
      </Card>
    </div>
  );
}

/** 수동 비밀번호 변경 — 로그인된 사용자가 스스로 변경(현재비번 확인 → 8자+ 새비번). 백엔드 /auth/change-password 재사용. */
function PasswordChangeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setCurPw(""); setNewPw(""); setNewPw2(""); setError(null); setBusy(false); } }, [open]);
  if (!open) return null;
  const submit = async () => {
    setError(null);
    if (!curPw) { setError("현재 비밀번호를 입력하세요."); return; }
    if (newPw.length < 8) { setError("새 비밀번호는 8자 이상이어야 합니다."); return; }
    if (newPw !== newPw2) { setError("새 비밀번호가 일치하지 않습니다."); return; }
    if (newPw === curPw) { setError("새 비밀번호가 현재 비밀번호와 같습니다."); return; }
    setBusy(true);
    try {
      await api.post("/auth/change-password", { currentPassword: curPw, newPassword: newPw });
      alert("비밀번호가 변경되었습니다.");
      onClose();
    } catch (e) { setError(e instanceof ApiError ? e.message : "변경 실패 — 현재 비밀번호를 확인하세요."); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6" onClick={onClose}>
      <Card className="w-[380px] max-w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-6">
          <div className="mb-3 flex items-center gap-2 font-serif text-lg font-black"><Lock className="h-4 w-4" /> 비밀번호 변경</div>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <div><Label className="mb-1.5 block">현재 비밀번호</Label><Input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} autoFocus /></div>
            <div><Label className="mb-1.5 block">새 비밀번호</Label><Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="8자 이상" /></div>
            <div><Label className="mb-1.5 block">새 비밀번호 확인</Label><Input type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} /></div>
            {error && <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={busy}>취소</Button>
              <Button type="submit" className="flex-1" disabled={busy}>{busy ? "변경 중…" : "변경"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============== 회원 화면 (마스터-디테일) ============== */
function dispName(m: Member, members: Member[]): string {
  const dup = members.filter((x) => x.name === m.name && x.missionary === m.missionary).length > 1;
  return `${m.name}${m.missionary ? "_" + m.missionary : ""}` + (dup && m.phone ? ` (${m.phone.slice(-4)})` : "");
}

interface NavRow { id: string; memberId: string; realName: string; hoewonId: string; aff: string; regId: string | null; item: string | null; bokjunja: string | null; altar: string | null; yesujae: string | null; spirit: string | null; status: string; canceled: boolean }

function MembersScreen(props: {
  ann: boolean; members: Member[]; sel: Member | undefined; selId: string; setSelId: (s: string) => void;
  tab: "reg" | "cns"; setTab: (t: "reg" | "cns") => void; selReg: string | null; setSelReg: (s: string | null) => void;
  setRegSel: (r: Reg | null) => void; cnsOpen: boolean; setCnsOpen: (b: boolean) => void; cnsBody: string; setCnsBody: (s: string) => void;
  WBtn: (p: { label: string; onClick?: () => void; variant?: "default" | "outline" | "ghost"; size?: "default" | "sm" | "icon"; icon?: React.ReactNode }) => React.ReactNode;
  go: (r: string) => void; reload: () => void; loading: boolean; ro: boolean;
}) {
  const { ann, members, sel, setSelId, tab, setTab, selReg, setSelReg, setRegSel, cnsOpen, setCnsOpen, cnsBody, setCnsBody, WBtn, go, reload, loading } = props;
  const { data: affs } = useApiList<CommonCode>("/common-codes?group=BA10");
  const affMap = useMemo(() => Object.fromEntries((affs ?? []).map((a) => [a.code, a.name])), [affs]);
  // 동명이인 판별 맵(O(1)) — 8천+ 회원에서 O(n²) 방지
  const dupKeys = useMemo(() => {
    const c = new Map<string, number>();
    for (const x of members) { const k = `${x.name}|${x.missionary ?? ""}`; c.set(k, (c.get(k) ?? 0) + 1); }
    return c;
  }, [members]);
  // 좌측 네비 그리드 행(불사 1건=1행). 대량(2.4만행) → 메모이제이션 + AG Grid 가상 스크롤.
  const flatRows = useMemo<NavRow[]>(() => members.flatMap((m): NavRow[] => {
    const dup = (dupKeys.get(`${m.name}|${m.missionary ?? ""}`) ?? 0) > 1;
    const hoewonId = `${m.name}${m.missionary ? "_" + m.missionary : ""}` + (dup && m.phone ? ` (${m.phone.slice(-4)})` : "");
    const base = { memberId: String(m.id), realName: m.name, hoewonId, aff: affMap[m.aff ?? ""] ?? m.aff ?? "" };
    return m.regs.length
      ? m.regs.map((r) => ({ ...base, id: `r-${r.id}`, regId: String(r.id), item: r.item ?? null, bokjunja: r.bokjunja ?? null, altar: r.altar ?? null, yesujae: r.yesujae ?? null, spirit: r.spirit ?? null, status: r.canceled ? "취소" : r.cert ? "증서" : "신청", canceled: !!r.canceled }))
      : [{ ...base, id: `m-${m.id}`, regId: null, item: null, bokjunja: null, altar: null, yesujae: null, spirit: null, status: "", canceled: false }];
  }), [members, dupKeys, affMap]);
  if (!sel) return <div className="text-muted-foreground">{loading ? "불러오는 중…" : "회원이 없습니다."}</div>;
  const idx = members.findIndex((m) => m.id === sel.id);
  const prev = String(members[(idx - 1 + members.length) % members.length].id);
  const next = String(members[(idx + 1) % members.length].id);
  const delMember = async () => {
    if (!confirm(`'${sel.name}' 회원을 삭제할까요?\n(연결된 불사 신청 등이 있으면 서버가 막을 수 있습니다.)`)) return;
    try { await api.delete(`/members/${sel.id}`); setSelId(next); reload(); }
    catch (e) { alert(e instanceof ApiError ? e.message : "삭제 실패 — 연결된 데이터가 있는지 확인하세요."); }
  };

  const addCounsel = async () => {
    if (!cnsBody.trim()) return;
    await api.post("/counsels", { memberId: String(sel.id), counseledAt: new Date().toISOString(), content: cnsBody.trim() });
    setCnsBody(""); setCnsOpen(false); setTab("cns"); reload();
  };
  const dash = (p: { value?: string }) => p.value || "—";
  const statusChip = (p: { value: string }) => <Chip tone={p.value === "취소" ? "red" : p.value === "증서" ? "celadon" : "ghost"} className="px-1.5 py-0 text-[10px]">{p.value}</Chip>;
  const regCols: ColDef[] = [
    { headerName: "상태", pinned: "left", width: 84, valueGetter: (p: { data: Reg }) => p.data.canceled ? "취소" : p.data.cert ? "증서" : "신청", cellStyle: { display: "flex", alignItems: "center" }, cellRenderer: statusChip },
    { headerName: "입력일", field: "date", pinned: "left", width: 106, cellClass: "font-mono" },
    { headerName: "불사목록", field: "item", width: 132 },
    { headerName: "봉안일", field: "event", width: 176, valueFormatter: dash },
    { headerName: "단번호", field: "altar", width: 92, cellClass: "font-mono font-bold" },
    { headerName: "복위자", field: "bogwija", width: 96, valueFormatter: dash },
    { headerName: "관계", field: "rel", width: 88, valueFormatter: dash },
    { headerName: "복전자", field: "bokjunja", width: 210, tooltipField: "bokjunja", valueFormatter: dash },
    { headerName: "영가", field: "spirit", width: 110, valueFormatter: dash },
    { headerName: "예수재", field: "yesujae", width: 96, valueFormatter: dash },
    { headerName: "12성주", field: "seongju", width: 90, valueFormatter: dash },
    { headerName: "시주", field: "donation", width: 108, type: "rightAligned", cellClass: "font-mono", valueFormatter: (p: { value: number }) => p.value ? krw(Number(p.value)) : "—" },
    { headerName: "증서", width: 130, valueGetter: (p: { data: Reg }) => p.data.cert ? `발급 ${p.data.certDate ?? ""}` : "—" },
    { headerName: "취소", width: 130, valueGetter: (p: { data: Reg }) => p.data.canceled ? `${p.data.cancelDate ?? ""}` : "—" },
    { headerName: "입력일시", field: "createdAt", width: 140, cellClass: "font-mono" },
    { headerName: "메모", field: "memo", width: 160, tooltipField: "memo", valueFormatter: dash },
  ];

  // 적층형 셀 — 소속|회원ID / 불사목록·복전자·단번호 / 예수재·영가·취소여부
  const navInfoCell = (p: { data: NavRow }) => {
    const d = p.data;
    const dash = (v: string | null) => v || "—";
    const statusCell = !d.regId ? <span className="text-muted-foreground/60">—</span>
      : d.status === "취소" ? <Chip tone="red" className="px-1 py-0 text-[9px]">취소</Chip>
      : d.status === "증서" ? <Chip tone="celadon" className="px-1 py-0 text-[9px]">증서</Chip>
      : <Chip tone="ghost" className="px-1 py-0 text-[9px]">신청</Chip>;
    const c = "truncate px-1.5 flex items-center text-muted-foreground";
    const cd = "border-l border-black/15 " + c;
    return (
      <div className="grid h-full grid-cols-6 content-center text-[11.5px] leading-tight [&>span]:min-w-0 [&>span]:border-b [&>span]:border-black/15 [&>span]:py-[4px]">
        {/* 1줄: 소속 | 회원ID — 정확히 반반(3+3) */}
        <span className={c + " col-span-3"}>{dash(d.aff)}</span>
        <span className={cd + " col-span-3 font-bold text-foreground"}>{d.hoewonId}</span>
        {/* 2줄: 불사목록 | 복전자 | 단번호 — 1/3씩(2+2+2) */}
        <span className={c + ` col-span-2 font-semibold ${d.canceled ? "text-vermilion line-through" : "text-foreground"}`}>{dash(d.item)}</span>
        <span className={cd + " col-span-2"} title={d.bokjunja ?? ""}>{dash(d.bokjunja)}</span>
        <span className={cd + " col-span-2 font-mono font-bold text-foreground"}>{dash(d.altar)}</span>
        {/* 3줄: 예수재 | 영가 | 취소여부 — 1/3씩 */}
        <span className={c + " col-span-2 border-b-0"}>{dash(d.yesujae)}</span>
        <span className={cd + " col-span-2 border-b-0"}>{dash(d.spirit)}</span>
        <span className={cd + " col-span-2 border-b-0"}>{statusCell}</span>
      </div>
    );
  };
  const navInfoHeader = () => (
    <div className="grid h-full w-full grid-cols-6 content-center text-[10px] font-bold leading-tight text-muted-foreground [&>span]:min-w-0 [&>span]:truncate [&>span]:border-b [&>span]:border-black/15 [&>span]:px-1.5 [&>span]:py-[4px]">
      <span className="col-span-3">소속</span>
      <span className="col-span-3 border-l border-black/15">회원ID</span>
      <span className="col-span-2">불사목록</span>
      <span className="col-span-2 border-l border-black/15">복전자</span>
      <span className="col-span-2 border-l border-black/15">단번호</span>
      <span className="col-span-2 border-b-0">예수재</span>
      <span className="col-span-2 border-b-0 border-l border-black/15">영가</span>
      <span className="col-span-2 border-b-0 border-l border-black/15">취소</span>
    </div>
  );
  const navCols: ColDef[] = [
    { headerName: "이름", field: "realName", pinned: "left", width: 88, cellClass: "font-extrabold", cellStyle: { display: "flex", alignItems: "center", borderRight: "1px solid rgba(38,32,25,0.12)" } },
    { headerName: "회원 정보", headerComponent: navInfoHeader, flex: 1, minWidth: 300, cellRenderer: navInfoCell, cellStyle: { padding: 0 }, valueGetter: (p: { data: NavRow }) => `${p.data.hoewonId} ${p.data.aff} ${p.data.item ?? ""} ${p.data.bokjunja ?? ""} ${p.data.altar ?? ""} ${p.data.spirit ?? ""} ${p.data.yesujae ?? ""}` },
  ];

  return (<>
    <PageTitle title="회원관리" route="/members"
      desc="왼쪽 목록에서 회원을 클릭하면 오른쪽에 상세가 바로 열립니다 — 페이지 이동 없이 <b>‹ ›</b> 로 빠르게 순회. 신청내역 행을 누르면 <b>전 칼럼 상세</b>가 우측 패널로 열립니다."
      actions={<>{WBtn({ label: "회원 등록", icon: <Plus className="mr-1 h-4 w-4" />, onClick: () => go("member-new") })}</>} />
    <Ann show={ann}>{`<b>마스터-디테일 + 신청내역 디테일 시트</b>로 빠른 업무 순회·가시성 확보. 인물명 확장검색(<b>FR-MEM-14·FR-BUD-15</b>) · 상담은 상담관리·회원상세 양쪽 추가(<b>FR-CNS-01·08</b>).`}</Ann>

    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[480px_1fr]">
      <DataGrid title="불사 신청 (신청별)" rowData={flatRows} columnDefs={navCols} height="calc(100dvh - 250px)" rowHeight={72} headerHeight={68}
        selectedId={selReg ? `r-${selReg}` : `m-${sel.id}`}
        onRowClicked={(e: { data: { memberId: string; regId: string | null } }) => { setSelId(e.data.memberId); setTab("reg"); setSelReg(e.data.regId ?? null); setCnsOpen(false); }}
        onRowOpen={(r) => { setSelId((r as { memberId: string }).memberId); go("member-edit"); }} />

      <Card className="overflow-hidden p-0">
        <div className="flex items-start gap-2.5 border-b p-4">
          <div>
            <h3 className="font-serif text-[17px] font-bold">{dispName(sel, members)}</h3>
            <div className="mt-1 text-xs text-muted-foreground">{sel.aff || "—"} · {sel.missionary || "—"} · <span className="font-mono">{sel.phone || "—"}</span></div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelId(prev); setSelReg(null); }} title="이전 회원"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelId(next); setSelReg(null); }} title="다음 회원"><ChevronRight className="h-4 w-4" /></Button>
            {WBtn({ label: "불사 신청", size: "sm", icon: <Plus className="mr-1 h-3.5 w-3.5" />, onClick: () => go("reg-new") })}
            {WBtn({ label: "수정", size: "sm", variant: "outline", onClick: () => { setSelId(String(sel.id)); go("member-edit"); } })}
            {WBtn({ label: "삭제", size: "sm", variant: "outline", onClick: () => void delMember() })}
          </div>
        </div>
        <div className="border-b px-4 py-3"><KV items={[["주소", sel.addr || "—"], ["메모", <span className="text-muted-foreground">{sel.memo || "-"}</span>]]} /></div>

        <Tabs value={tab} onValueChange={(v) => { setTab(v as "reg" | "cns"); setCnsOpen(false); }} className="px-3 pt-2">
          <TabsList><TabsTrigger value="reg">불사 신청 내역 ({sel.regs.length})</TabsTrigger><TabsTrigger value="cns">상담 내역 ({sel.counsels.length})</TabsTrigger></TabsList>
        </Tabs>

        {tab === "reg" ? (
          <div className="p-3">
            {ann && <div className="mb-2 rounded border-l-2 border-gold bg-amber-50/70 px-3 py-1.5 text-[11.5px] text-amber-800">신청내역(DM-02)은 칼럼이 많음 — <b>엔터프라이즈 데이터그리드</b>. 행을 <b>더블클릭</b>하면 상세(수정창)가 열려 전 항목·인물·취소/증서를 편집합니다.</div>}
            <DataGrid title="불사 신청 내역" rowData={sel.regs} columnDefs={regCols} selectedId={selReg}
              onRowOpen={(r) => { setSelReg(String((r as Reg).id)); setRegSel(r as Reg); }}
              height={sel.regs.length ? Math.min(520, sel.regs.length * 32 + 80) : 220} />
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <span className="text-xs text-muted-foreground">회원 상세에서 바로 상담을 추가할 수 있습니다 (빠른 접근).</span>
              {WBtn({ label: cnsOpen ? "닫기" : "상담 추가", size: "sm", icon: cnsOpen ? null : <Plus className="mr-1 h-3.5 w-3.5" />, onClick: () => setCnsOpen(!cnsOpen) })}
            </div>
            {cnsOpen && (
              <div className="border-b bg-accent px-4 py-3.5">
                <div className="mt-0.5"><Label className="mb-1.5 block text-xs">상담 내용 <span className="text-vermilion">*</span></Label><Textarea rows={2} value={cnsBody} onChange={(e) => setCnsBody(e.target.value)} placeholder="상담 내용 입력…" /></div>
                <div className="mt-2.5 flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => { setCnsOpen(false); setCnsBody(""); }}>취소</Button><Button size="sm" onClick={() => void addCounsel()}>저장</Button></div>
              </div>
            )}
            <Table><TableHeader><TableRow><TableHead>일시</TableHead><TableHead>상담 내용</TableHead></TableRow></TableHeader>
              <TableBody>{sel.counsels.length ? sel.counsels.map((c, i) => (<TableRow key={i}><TableCell className="whitespace-nowrap font-mono">{c.date}</TableCell><TableCell>{c.desc}</TableCell></TableRow>)) : <TableRow><TableCell colSpan={2} className="py-10 text-center text-muted-foreground">상담 내역이 없습니다.</TableCell></TableRow>}</TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  </>);
}

/* ============== 회원 등록·수정 ============== */
function MemberEdit({ sel, missionaries, go, reload, WBtn, ann, newMode }: { sel: Member | undefined; editing: boolean; missionaries: Missionary[]; go: (r: string) => void; reload: () => void; WBtn: (p: { label: string; onClick?: () => void; variant?: "default" | "outline" | "ghost"; size?: "default" | "sm" | "icon"; icon?: React.ReactNode }) => React.ReactNode; ann: boolean; newMode: boolean }) {
  const editing = !newMode && !!sel;
  const [name, setName] = useState(editing ? sel!.name : "");
  const [missionaryId, setMissionaryId] = useState("");
  const [affiliationCode, setAffiliationCode] = useState("");
  const [phone, setPhone] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [addr, setAddr] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { data: affiliations } = useApiList<CommonCode>("/common-codes?group=BA10");

  // 수정 시 기존 값 로딩 — 목록 요약이 아니라 서버 상세(/members/:id)로 폼을 채운다(프리필 버그 수정).
  // sel.id 기준으로만 로딩(객체 참조가 아닌 id) — 편집 중 백그라운드 refetch 로 입력이 덮어써지지 않게.
  const selId = sel?.id;
  useEffect(() => {
    if (!editing || selId == null) return;
    let alive = true;
    api.get<{ memberName: string; missionaryId: string | null; affiliationCode: string | null; phone: string | null; address: string | null; addressDetail: string | null; zipCode: string | null; memo: string | null }>(`/members/${selId}`)
      .then((m) => {
        if (!alive) return;
        setName(m.memberName ?? ""); setMissionaryId(m.missionaryId ?? ""); setAffiliationCode(m.affiliationCode ?? "");
        setPhone(m.phone ?? ""); setZipCode(m.zipCode ?? ""); setAddr(m.address ?? ""); setAddressDetail(m.addressDetail ?? ""); setMemo(m.memo ?? "");
      })
      .catch((e) => { if (alive) setError(e instanceof ApiError ? `기존 정보 로딩 실패: ${e.message}` : "기존 정보를 불러오지 못했습니다. 새로고침 후 다시 시도하세요."); });
    return () => { alive = false; };
  }, [editing, selId]);

  const save = async () => {
    setError(null);
    if (!name.trim()) { setError("이름은 필수입니다."); return; }
    const payload = {
      memberName: name.trim(), phone: phone || undefined, address: addr || undefined,
      addressDetail: addressDetail || undefined, zipCode: zipCode || undefined,
      affiliationCode: affiliationCode || undefined, missionaryId: missionaryId || undefined,
      memo: memo || undefined,
    };
    try {
      if (editing) await api.put(`/members/${sel!.id}`, payload);
      else await api.post("/members", payload);
      reload(); go("members");
    } catch (e) { setError(e instanceof ApiError ? e.message : "저장 실패"); }
  };

  return (<>
    <PageTitle title="회원 등록·수정" route="/members/edit" desc="이름만 필수, 나머지는 선택값. 동일 이름+포교원장이라도 차단하지 않고 <b>중복 후보만 경고</b>합니다."
      actions={<><Button variant="ghost" onClick={() => go("members")}>취소</Button>{WBtn({ label: "저장", onClick: () => void save() })}</>} />
    <Ann show={ann}>{`이름 필수(<b>FR-MEM-05</b>) · 동명이인 surrogate 공존(<b>FR-MEM-19</b>) · 중복 하드 차단 폐기→경고(<b>FR-MEM-11·20</b>) · 포교원장/소속은 마스터 룩업만.`}</Ann>
    <Card className="max-w-2xl"><CardContent className="space-y-3.5 p-5">
      {error && <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div><Label className="mb-1.5 block">이름 <span className="text-vermilion">*</span></Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <div><Label className="mb-1.5 block">포교원장</Label>
          <Select value={missionaryId} onValueChange={setMissionaryId}><SelectTrigger><SelectValue placeholder="(선택 안 함)" /></SelectTrigger><SelectContent>{missionaries.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label className="mb-1.5 block">소속 (BA10)</Label>
          <Select value={affiliationCode} onValueChange={setAffiliationCode}><SelectTrigger><SelectValue placeholder="(선택 안 함)" /></SelectTrigger><SelectContent>{(affiliations ?? []).map((c) => <SelectItem key={c.id} value={c.code}>{c.name}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <div><Label className="mb-1.5 block">전화번호</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" /></div>
        <div><Label className="mb-1.5 block">우편번호</Label><Input value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="우편번호" /></div>
      </div>
      <div><Label className="mb-1.5 block">주소 / 상세주소</Label><Input value={addr} onChange={(e) => setAddr(e.target.value)} /></div>
      <div><Label className="mb-1.5 block">기타메모</Label><Textarea rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} /></div>
      <div className="rounded-lg bg-accent px-3 py-2.5 text-[11.5px] text-celadon">표시값 <b>이름_포교원장</b>은 저장하지 않고 조회 시 파생 계산 — 포교원장 개명 시 자동 반영, 회원 키는 불변.</div>
    </CardContent></Card>
  </>);
}

/* ============== 불사 신청 입력 ============== */
function RegNew({ sel, items, fdays, ann, go, reload }: { sel: Member | undefined; items: ServiceItem[]; fdays: { id: string; label: string | null; eventDateSolar: string }[]; ann: boolean; go: (r: string) => void; reload: () => void }) {
  const [itemId, setItemId] = useState("");
  const [eventId, setEventId] = useState("");
  const [altar, setAltar] = useState("");
  const [slots, setSlots] = useState<Record<string, string>>({});
  const [donation, setDonation] = useState("");
  const [cancel, setCancel] = useState(false);
  const [cert, setCert] = useState(false);
  const [memo, setMemo] = useState("");
  const [regDate, setRegDate] = useState("");
  const [sexId, setSexId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { data: ganjiList } = useApiList<{ id: string; ganjiNameKo: string }>("/sexagenary-years");

  const item = items.find((i) => i.id === itemId);
  const svcType = serviceTypeLabel(item?.serviceTypeCode);

  const save = async () => {
    setError(null);
    if (!itemId) { setError("불사목록을 선택하세요."); return; }
    const payload: Record<string, unknown> = {
      registrationDate: regDate ? new Date(regDate).toISOString() : undefined,
      memberId: String(sel!.id), buddhistServiceItemId: itemId,
      enshrinementEventId: eventId || undefined,
      sexagenaryYearId: sexId || undefined,
      altarNumber: altar || undefined,
      donationAmount: donation || undefined, memo: memo || undefined,
      isCanceled: cancel, isCertificateIssued: cert,
    };
    for (const [k, v] of Object.entries(slots)) if (v) payload[PROTO_TO_API[k]] = v;
    try { await api.post("/buddhist-services", payload); reload(); go("members"); }
    catch (e) { setError(e instanceof ApiError ? e.message : "저장 실패"); }
  };

  if (!sel) return null;
  return (<>
    <PageTitle title="불사 신청 입력" route="/reg/new" desc="인물 슬롯은 불사종류와 무관하게 <b>전부 입력 가능</b>합니다. 모든 필드 선택값(공란 저장 허용)."
      actions={<><Button variant="ghost" onClick={() => go("members")}>취소</Button><Button onClick={() => void save()}>저장</Button></>} />
    <Ann show={ann}>{`<b>서비스 타입별 인물 슬롯 메타데이터(DM-20):</b> 위패=5정보, 12지신등명불=3정보. 코드 하드코딩 아닌 마스터 메타데이터로 구동. 예수재→<b>제자 재</b> 라벨 오버라이드.`}</Ann>
    {error && <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
    {/* 드로어/모달 폭에 맞춰 세로 스택 — 좁은 셸에서 2단 카드가 무너지던 문제(서식 깨짐) 방지. */}
    <div className="grid gap-4">
      <Card><CardContent className="p-5">
        <h3 className="font-serif text-[15px] font-bold">신청 정보</h3>
        <div className="mt-3 grid gap-3.5 sm:grid-cols-2">
          <div><Label className="mb-1.5 block">신청자(회원)</Label><Input value={`${sel.name}${sel.missionary ? "_" + sel.missionary : ""}`} readOnly /></div>
          <div><Label className="mb-1.5 block">입력일 <span className="text-muted-foreground">(미입력 시 오늘)</span></Label><Input type="date" value={regDate} onChange={(e) => setRegDate(e.target.value)} /></div>
          <div><Label className="mb-1.5 block">생년 간지(육십갑자) <span className="text-muted-foreground">(선택)</span></Label>
            <Select value={sexId} onValueChange={setSexId}><SelectTrigger><SelectValue placeholder="(미지정)" /></SelectTrigger><SelectContent>{(ganjiList ?? []).map((g) => <SelectItem key={g.id} value={g.id}>{g.ganjiNameKo}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
          <div><Label className="mb-1.5 block">불사목록</Label>
            <Select value={itemId} onValueChange={setItemId}><SelectTrigger><SelectValue placeholder="(선택)" /></SelectTrigger><SelectContent>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select>
            {item && <div className="mt-1 text-[11px] text-muted-foreground">인물 슬롯: 전체 입력 가능</div>}</div>
          <div><Label className="mb-1.5 block">봉안일 <span className="text-muted-foreground">(선택)</span></Label>
            <Select value={eventId} onValueChange={setEventId}><SelectTrigger><SelectValue placeholder="미지정" /></SelectTrigger><SelectContent>{fdays.map((f) => <SelectItem key={f.id} value={f.id}>{ensOptionLabel(f)}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
          <div><Label className="mb-1.5 block">단번호</Label><Input value={altar} onChange={(e) => setAltar(e.target.value)} placeholder="0909" /><div className="mt-1 text-[11px] text-muted-foreground">문자열 보존 — <b>0909</b> ≠ 909</div></div>
          <div><Label className="mb-1.5 block">시주(보시) 금액 <span className="text-muted-foreground">(선택)</span></Label><Input value={donation} onChange={(e) => setDonation(e.target.value.replace(/[^\d]/g, ""))} placeholder="0" /><div className="mt-1 text-[11px] text-muted-foreground">통화 KRW · 결제/정산 없음</div></div>
        </div>
        <div className="mt-3.5"><Label className="mb-1.5 block">기타메모</Label><Textarea rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} /></div>
      </CardContent></Card>

      <Card><CardContent className="p-5">
        <div className="flex items-center gap-2"><h3 className="font-serif text-[15px] font-bold">인물 슬롯</h3><Chip tone="gold">{svcType}</Chip></div>
        {!itemId && <div className="mt-3 text-sm text-muted-foreground">불사목록을 먼저 선택하세요.</div>}
        <div className="mt-3 space-y-3.5">
          {itemId && ALL_SLOT_KEYS.map((k) => (
            <div key={k}><Label className="mb-1.5 block">{SLOT_LABEL[k]}{k === "bokjunja" && <Chip tone="celadon" className="ml-1.5 px-1.5 py-0 text-[10px]">다건</Chip>}</Label>
              {k === "bokjunja"
                ? <Textarea rows={2} value={slots[k] ?? ""} onChange={(e) => setSlots((s) => ({ ...s, [k]: e.target.value }))} placeholder="여러 명 입력 (예: 홍길순, 김철수 …)" />
                : <Input value={slots[k] ?? ""} onChange={(e) => setSlots((s) => ({ ...s, [k]: e.target.value }))} />}
              <div className="mt-1 text-[11px] text-muted-foreground">{SLOT_HINT[k]}</div></div>
          ))}
        </div>
        <Separator className="my-4" />
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div><Label className="mb-1.5 block">취소 여부</Label>
            <div className="inline-flex overflow-hidden rounded-lg border">
              <button type="button" onClick={() => setCancel(false)} className={`px-3.5 py-2 text-sm font-bold ${!cancel ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>신청</button>
              <button type="button" onClick={() => setCancel(true)} className={`px-3.5 py-2 text-sm font-bold ${cancel ? "bg-vermilion text-white" : "bg-background text-muted-foreground"}`}>취소</button>
            </div></div>
          <div><Label className="mb-1.5 block">증서 발급</Label>
            <div className="inline-flex overflow-hidden rounded-lg border">
              <button type="button" onClick={() => setCert(false)} className={`px-3.5 py-2 text-sm font-bold ${!cert ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>발급안함</button>
              <button type="button" onClick={() => setCert(true)} className={`px-3.5 py-2 text-sm font-bold ${cert ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>발급</button>
            </div></div>
        </div>
      </CardContent></Card>
    </div>
  </>);
}

/** 불사 증서 — 브라우저 인쇄/PDF(별도 라이브러리 없이). FR-RPT-10. */
function printCertificate(reg: Reg, memberLabel: string) {
  const esc = (s: string | number | null | undefined) =>
    String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] ?? c));
  const w = window.open("", "_blank", "width=720,height=900");
  if (!w) { alert("팝업이 차단되었습니다. 팝업 허용 후 다시 시도하세요."); return; }
  w.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>불사 증서</title>
  <style>
    body{font-family:'Noto Serif KR',serif;color:#262019;margin:0;padding:56px;text-align:center;background:#fbf8f0}
    .seal{width:64px;height:64px;margin:0 auto 18px;border-radius:12px;background:linear-gradient(160deg,#bf4530,#9c2f1f);color:#fff8ee;display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:900}
    h1{font-size:30px;letter-spacing:10px;margin:8px 0 4px}.sub{color:#7a7060;font-size:13px;margin-bottom:34px}
    table{margin:24px auto;border-collapse:collapse;min-width:400px}
    td{padding:11px 18px;border-bottom:1px solid #e0d8c6;font-size:16px;text-align:left}
    td.k{color:#7a7060;font-weight:700;width:120px}
    .foot{margin-top:52px;font-size:14px}.temple{font-size:22px;font-weight:900;margin-top:8px;letter-spacing:6px}
  </style></head><body>
    <h1>불사 증서</h1>
    <table>
      <tr><td class="k">회원</td><td>${esc(memberLabel)}</td></tr>
      <tr><td class="k">불사목록</td><td>${esc(reg.item)}</td></tr>
      <tr><td class="k">단번호</td><td>${esc(reg.altar || "—")}</td></tr>
      <tr><td class="k">발급일자</td><td>${esc(reg.certDate || "")}</td></tr>
    </table>
    <div class="foot">위 불사를 봉행하였음을 증명합니다.<div class="temple">신 고 달 사</div></div>
    <script>window.onload=function(){setTimeout(function(){window.print()},200)}</script>
  </body></html>`);
  w.document.close();
}

/* ============== 신청내역 상세·수정 (사이드 팝업) ============== */
function RegSheet({ reg, onClose, member, items, fdays, ro, reload }: { reg: Reg | null; onClose: () => void; member: Member; items: ServiceItem[]; fdays: { id: string; label: string | null; eventDateSolar: string }[]; ro: boolean; reload: () => void }) {
  const [d, setD] = useState<Reg | null>(reg);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: ganjiList } = useApiList<{ id: string; ganjiNameKo: string }>("/sexagenary-years");
  useEffect(() => { setD(reg); setError(null); }, [reg]);
  const dis = ro;
  const rule = d ? (SLOT_DEFS[d.type] || SLOT_DEFS["미설정"]) : null;
  const set = (k: keyof Reg, v: unknown) => setD((p) => (p ? { ...p, [k]: v } : p));
  const L = ({ children }: { children: React.ReactNode }) => <Label className="mb-1.5 block text-xs">{children}</Label>;

  const save = async () => {
    if (!d) return;
    setBusy(true);
    const payload: Record<string, unknown> = {
      registrationDate: d.date ? new Date(d.date).toISOString() : undefined,
      memberId: d.memberId ?? String(member.id),
      buddhistServiceItemId: d.itemId,
      enshrinementEventId: d.eventId ?? undefined,
      sexagenaryYearId: d.sexagenaryYearId || undefined,
      altarNumber: d.altar || undefined,
      donationAmount: d.donation ? String(d.donation) : undefined,
      memo: d.memo || undefined,
      isCanceled: d.canceled,
      isCertificateIssued: d.cert,
      certificateIssuedDate: d.cert && d.certDate ? new Date(d.certDate).toISOString() : undefined,
    };
    for (const k of ["bogwija", "rel", "bokjunja", "spirit", "yesujae", "seongju"] as const) {
      payload[PROTO_TO_API[k]] = (d as unknown as Record<string, unknown>)[k] || undefined;
    }
    try { setError(null); await api.put(`/buddhist-services/${d.id}`, payload); reload(); onClose(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "저장 실패 — 필수 인물 슬롯 등을 확인하세요."); }
    finally { setBusy(false); }
  };

  return (
    <Sheet open={!!reg} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {d && rule && (<>
          <SheetHeader>
            <SheetTitle className="font-serif text-xl">{dis ? "불사 신청 상세" : "불사 신청 수정"} <span className="text-sm font-normal text-muted-foreground">#{d.id}</span></SheetTitle>
            <SheetDescription>{member.name}{member.missionary ? "_" + member.missionary : ""} · DM-02 BuddhistServiceReg{dis ? " · 조회 전용(읽기)" : ""}</SheetDescription>
          </SheetHeader>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {d.canceled ? <Chip tone="red">취소 {d.cancelDate}</Chip> : <Chip tone="ghost">신청</Chip>}
            {d.cert && <Chip tone="celadon">증서발급 {d.certDate}</Chip>}
            <Chip tone="gold">{d.type}</Chip>
          </div>

          <Section title="신청 정보">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><L>불사목록</L>
                <Select value={d.itemId ?? ""} onValueChange={(v) => { const it = items.find((i) => i.id === v); setD((p) => p ? { ...p, itemId: v, item: it?.name ?? p.item, type: serviceTypeLabel(it?.serviceTypeCode) } : p); }} disabled={dis}>
                  <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select>
                <div className="mt-1 text-[11px] text-muted-foreground">인물 슬롯: 전체 입력 가능</div></div>
              <div><L>입력일</L><Input type="date" value={(d.date || "").slice(0, 10)} onChange={(e) => set("date", e.target.value)} disabled={dis} /></div>
              <div><L>봉안일</L>
                <Select value={d.eventId ?? ""} onValueChange={(v) => set("eventId", v)} disabled={dis}>
                  <SelectTrigger><SelectValue placeholder="(미지정)" /></SelectTrigger>
                  <SelectContent>{(fdays ?? []).map((f) => <SelectItem key={f.id} value={f.id}>{ensOptionLabel(f)}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><L>생년 간지(육십갑자)</L>
                <Select value={d.sexagenaryYearId ?? ""} onValueChange={(v) => set("sexagenaryYearId", v)} disabled={dis}>
                  <SelectTrigger><SelectValue placeholder="(미지정)" /></SelectTrigger>
                  <SelectContent>{(ganjiList ?? []).map((g) => <SelectItem key={g.id} value={g.id}>{g.ganjiNameKo}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><L>단번호</L><Input value={d.altar} onChange={(e) => set("altar", e.target.value)} disabled={dis} /></div>
              <div><L>시주금액 (KRW)</L><Input value={String(d.donation)} onChange={(e) => set("donation", Number(e.target.value.replace(/[^0-9]/g, "")) || 0)} disabled={dis} /></div>
              <div className="col-span-2"><L>기타메모</L><Textarea rows={2} value={d.memo || ""} onChange={(e) => set("memo", e.target.value)} disabled={dis} /></div>
            </div>
          </Section>

          <Section title="인물 슬롯">
            <div className="mb-2 text-[11.5px] text-muted-foreground">불사종류와 무관하게 전체 입력 가능 · 신청자(회원) 외 전원 기록 · 공란 허용</div>
            <div className="grid grid-cols-2 gap-3">
              {ALL_SLOT_KEYS.map((k) => (
                <div key={k} className={k === "bokjunja" ? "col-span-2" : ""}>
                  <L>{SLOT_LABEL[k]}{k === "bokjunja" && <Chip tone="celadon" className="ml-1.5 px-1.5 py-0 text-[10px]">다건</Chip>}</L>
                  {k === "bokjunja"
                    ? <Textarea rows={2} value={(d as unknown as Record<string, string>)[k] || ""} onChange={(e) => set(k as keyof Reg, e.target.value)} disabled={dis} />
                    : <Input value={(d as unknown as Record<string, string>)[k] || ""} onChange={(e) => set(k as keyof Reg, e.target.value)} disabled={dis} />}
                </div>
              ))}
            </div>
          </Section>

          <Section title="상태 · 증서">
            <div className="grid grid-cols-2 gap-3">
              <div><L>취소 여부</L>
                <div className="inline-flex overflow-hidden rounded-lg border">
                  <button type="button" disabled={dis} onClick={() => setD((p) => p ? { ...p, canceled: false, cancelDate: undefined } : p)} className={`px-3.5 py-2 text-sm font-bold disabled:opacity-60 ${!d.canceled ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>신청</button>
                  <button type="button" disabled={dis} onClick={() => setD((p) => p ? { ...p, canceled: true } : p)} className={`px-3.5 py-2 text-sm font-bold disabled:opacity-60 ${d.canceled ? "bg-vermilion text-white" : "bg-background text-muted-foreground"}`}>취소</button>
                </div></div>
              <div><L>증서 발급</L>
                <div className="inline-flex overflow-hidden rounded-lg border">
                  <button type="button" disabled={dis} onClick={() => setD((p) => p ? { ...p, cert: false, certDate: undefined } : p)} className={`px-3.5 py-2 text-sm font-bold disabled:opacity-60 ${!d.cert ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>발급안함</button>
                  <button type="button" disabled={dis} onClick={() => setD((p) => p ? { ...p, cert: true } : p)} className={`px-3.5 py-2 text-sm font-bold disabled:opacity-60 ${d.cert ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>발급</button>
                </div></div>
            </div>
          </Section>

          {error && <div className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="mt-6 flex justify-end gap-2 border-t pt-4">
            <Button variant="ghost" onClick={onClose}>{dis ? "닫기" : "취소"}</Button>
            {d.cert && <Button variant="outline" onClick={() => { downloadFile(`/buddhist-services/${d.id}/certificate`, `증서_${member.name}.pdf`).catch((e) => alert(e instanceof ApiError ? e.message : "증서 PDF 다운로드 실패")); }}><FileSpreadsheet className="mr-1 h-4 w-4" />증서 PDF</Button>}
            {d.cert && <Button variant="outline" onClick={() => printCertificate(d, `${member.name}${member.missionary ? "_" + member.missionary : ""}`)}><Printer className="mr-1 h-4 w-4" />증서 인쇄</Button>}
            {!dis && <Button onClick={() => void save()} disabled={busy}>{busy ? "저장 중…" : "저장"}</Button>}
          </div>
        </>)}
      </SheetContent>
    </Sheet>
  );
}

/* ============== 통합 검색 (서버 /search — 회원 본인 + 인물 슬롯) ============== */
interface SearchHit { id: string; memberName: string; displayName: string; phone: string | null; missionaryName: string | null; matchReasons: string[] }
const REASON_LABEL: Record<string, string> = { self: "본인", bogwija: "복위자", relationship: "관계", bokjunja: "복전자", spiritual: "영가", yesujae: "예수재", seongju12: "12성주" };

function SearchScreen({ term, selectMember }: { term: string; selectMember: (id: string) => void }) {
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!term.trim()) { setHits([]); return; }
    let alive = true;
    setLoading(true);
    api.get<{ items: SearchHit[] }>(`/search/members?q=${encodeURIComponent(term)}&pageSize=100`)
      .then((d) => { if (alive) setHits(d.items); })
      .catch(() => { if (alive) setHits([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [term]);
  return (<>
    <PageTitle title="통합 검색" route="/search" desc={`회원 본인 + 복전자·영가·예수재 등 인물 슬롯까지 매칭 — 검색어 <b>${escapeHtml(term) || "(없음)"}</b>`} />
    <Card className="overflow-hidden p-0">
      {hits.map((h) => (
        <button key={h.id} onClick={() => selectMember(h.id)} className="flex w-full items-center justify-between border-b px-4 py-3 text-left last:border-0 hover:bg-accent/40">
          <div><div className="font-bold">{h.displayName}</div><div className="font-mono text-[12px] text-muted-foreground">{h.phone ?? "—"}</div></div>
          <div className="flex flex-wrap justify-end gap-1">{h.matchReasons.map((r) => <Chip key={r} tone={r === "self" ? "ghost" : "celadon"} className="px-1.5 py-0 text-[10px]">{REASON_LABEL[r] ?? r}</Chip>)}</div>
        </button>
      ))}
      {!loading && hits.length === 0 && <div className="px-4 py-12 text-center text-muted-foreground">{term ? "결과가 없습니다." : "상단 검색창에 입력 후 Enter."}</div>}
    </Card>
  </>);
}

/* ============== 상담 관리 ============== */
interface CounselRow { id: string; memberId: string; memberName: string | null; memberDisplayName: string | null; counseledAt: string; content: string }

function Counsels({ ann, members, cnsListOpen, setCnsListOpen, reload, selectMember, WBtn }: {
  ann: boolean; members: Member[]; cnsListOpen: boolean; setCnsListOpen: (b: boolean) => void; cnsListMember: string; setCnsListMember: (s: string) => void;
  cnsListBody: string; setCnsListBody: (s: string) => void; reload: () => void; selectMember: (id: string) => void;
  WBtn: (p: { label: string; onClick?: () => void; variant?: "default" | "outline" | "ghost"; size?: "default" | "sm" | "icon"; icon?: React.ReactNode }) => React.ReactNode;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<CounselRow[]>([]);
  const [tick, setTick] = useState(0);
  const [detail, setDetail] = useState<CounselRow | null>(null);
  useEffect(() => {
    const params = new URLSearchParams({ pageSize: "100" });
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(to + "T23:59:59").toISOString());
    if (q) params.set("q", q);
    let alive = true;
    api.get<{ items: CounselRow[] }>(`/counsels?${params.toString()}`)
      .then((d) => { if (alive) setItems(d.items); })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [from, to, q, tick]);

  const createCounsel = async (f: Record<string, unknown>) => {
    const memberId = f.memberId as string | undefined;
    const content = (f.content as string | undefined)?.trim();
    if (!memberId || !content) { alert("회원·상담내용은 필수입니다."); return; }
    await api.post("/counsels", { memberId, counseledAt: new Date().toISOString(), content });
    setTick((t) => t + 1); reload();
  };
  const putCounsel = async (c: CounselRow) => {
    await api.put(`/counsels/${c.id}`, { memberId: c.memberId, counseledAt: new Date(c.counseledAt).toISOString(), content: c.content });
    setTick((t) => t + 1); reload();
  };
  const cnsCols: ColDef[] = [
    { headerName: "상담 일시", field: "counseledAt", width: 168, cellClass: "font-mono", valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleString("ko-KR") : "—") },
    { headerName: "회원", width: 150, valueGetter: (p: { data: CounselRow }) => p.data.memberDisplayName ?? p.data.memberName ?? "—" },
    { headerName: "상담 내용", field: "content", editable: true, flex: 1, minWidth: 260, tooltipField: "content" },
  ];
  return (<>
    <PageTitle title="상담 관리" route="/counsels" desc="기간/키워드(내용·회원명)로 서버 조회. 등록은 회원 선택 후 저장. 회원 상세 상담탭에서도 동일하게 추가됩니다."
      actions={<>
        <Button variant="ghost" onClick={() => void downloadFile("/counsels/export", "상담현황.xlsx")}><FileSpreadsheet className="mr-1 h-4 w-4" />Excel</Button>
        {WBtn({ label: "상담 등록", icon: <Plus className="mr-1 h-4 w-4" />, onClick: () => setCnsListOpen(true) })}
      </>} />
    <Ann show={ann}>{`AS-IS→TO-BE: 진입화면별 시간 불일치 정리(<b>FR-CNS-05</b>) · CHAR(10) 비교 폐기→정식 date 범위 · 하드 DELETE → 소프트삭제.`}</Ann>
    <EditSheet open={cnsListOpen} onClose={() => setCnsListOpen(false)} title="상담 등록" desc="회원 선택 후 내용 입력 · KST 저장(FR-CNS-05)"
      fields={[
        { key: "memberId", label: "회원", type: "select", options: members.map((m) => ({ value: String(m.id), label: `${m.name}${m.missionary ? "_" + m.missionary : ""}` })) },
        { key: "content", label: "상담 내용", type: "textarea" },
      ]}
      row={cnsListOpen ? {} : null} onSave={async (f) => { await createCounsel(f); }} />
    <Card className="mb-4"><CardContent className="flex flex-wrap items-end gap-2 p-4">
      <label className="text-xs"><span className="mb-1 block font-bold text-muted-foreground">시작</span><Input type="date" className="w-auto" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
      <label className="text-xs"><span className="mb-1 block font-bold text-muted-foreground">종료</span><Input type="date" className="w-auto" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      <label className="max-w-xs flex-1 text-xs"><span className="mb-1 block font-bold text-muted-foreground">키워드(내용·회원명)</span><Input value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <span className="pb-2 text-[11px] text-muted-foreground">기간 미지정 시 최근 3개월</span>
    </CardContent></Card>
    <DataGrid title="상담 내역" rowData={items} columnDefs={cnsCols} height="calc(100dvh - 220px)"
      onCellEdit={(_id, _f, _v, row) => { putCounsel(row as CounselRow).catch(() => setTick((t) => t + 1)); }}
      onRowOpen={(r) => setDetail(r as CounselRow)} rowActions={[{ label: "회원", onClick: (r) => selectMember((r as CounselRow).memberId) }]} />
    <EditSheet open={!!detail} onClose={() => setDetail(null)} title="상담 상세" desc={detail ? (detail.memberDisplayName ?? detail.memberName ?? "") : ""}
      fields={[
        { key: "counseledAt", label: "상담 일시", type: "datetime" },
        { key: "content", label: "상담 내용", type: "textarea" },
      ]}
      row={detail as unknown as Record<string, unknown> | null}
      onSave={async (f) => { if (detail) await putCounsel({ ...detail, ...f } as CounselRow); }} />
  </>);
}

/* ============== 대시보드 ============== */
function Dashboard({ ann, go, selectMember, members }: { ann: boolean; go: (r: string) => void; selectMember: (id: string) => void; members: Member[] }) {
  const { formMode } = useUiPrefs();
  const modern = formMode === "modal";
  const totalRegs = members.reduce((a, m) => a + m.regs.length, 0);
  const Stat = ({ k, v, d, warn }: { k: string; v: string; d: string; warn?: boolean }) => (
    modern ? (
      <div className="tm-card relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card to-accent/40 p-5">
        <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary/10 blur-xl" />
        <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{k}</div>
        <div className="mt-2 bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-[34px] font-black leading-none tracking-tight text-transparent tabular-nums">{v}</div>
        <div className={`mt-2.5 text-[11.5px] font-bold ${warn ? "text-vermilion" : "text-celadon"}`}>{d}</div>
      </div>
    ) : (
      <Card><CardContent className="p-4"><div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{k}</div><div className="mt-1.5 text-[28px] font-extrabold leading-none tracking-tight tabular-nums">{v}</div><div className={`mt-2 text-[11.5px] font-bold ${warn ? "text-vermilion" : "text-celadon"}`}>{d}</div></CardContent></Card>
    )
  );
  // 집계(이미 로드된 데이터 — 외부 의존 없음)
  const status = { 신청: 0, 증서: 0, 취소: 0 };
  const typeCounts: Record<string, number> = {};
  members.forEach((m) => m.regs.forEach((r) => {
    status[r.canceled ? "취소" : r.cert ? "증서" : "신청"]++;
    const t = r.type || "미설정"; typeCounts[t] = (typeCounts[t] ?? 0) + 1;
  }));
  const statusRows: [string, number, string][] = [["신청", status.신청, "bg-[hsl(40_14%_60%)]"], ["증서", status.증서, "bg-[hsl(167_44%_33%)]"], ["취소", status.취소, "bg-[hsl(8_72%_47%)]"]];
  const typeRows = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  const maxStatus = Math.max(1, ...statusRows.map((r) => r[1]));
  const maxType = Math.max(1, ...typeRows.map((r) => r[1]));
  const Bar = ({ label, value, max, tone }: { label: string; value: number; max: number; tone?: string }) => (
    <div className="flex items-center gap-2 py-1 text-[12px]">
      <div className="w-28 flex-none truncate text-muted-foreground">{label}</div>
      <div className="h-3.5 flex-1 overflow-hidden rounded bg-secondary/60"><div className={`h-full rounded ${tone ?? "bg-[hsl(167_44%_33%)]"}`} style={{ width: `${(value / max) * 100}%` }} /></div>
      <div className="w-8 flex-none text-right font-mono font-bold tabular-nums">{value}</div>
    </div>
  );
  return (<>
    <PageTitle title="대시보드" route="/dashboard" desc="오늘 사찰 업무 요약." />
    <Ann show={ann}>{`신규 <b>운영 요약 위젯</b>. 다가오는 기일은 음력·육십갑자 계산 결과에 의존(Phase 2).`}</Ann>
    <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Stat k="총 회원수" v={String(members.length)} d="단일 테넌트" />
      <Stat k="총 불사 신청" v={String(totalRegs)} d="신청일 기준" />
      <Stat k="다가오는 기일 (30일)" v="—" d="음력 계산 Phase 2" warn />
      <Stat k="상담 누적" v={String(members.reduce((a, m) => a + m.counsels.length, 0))} d="최근 등록순" />
    </div>
    <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card><CardHeader className="border-b py-3"><CardTitle className="font-serif text-[14px]">불사 상태 분포</CardTitle></CardHeader>
        <CardContent className="p-4">{statusRows.map(([l, v, tone]) => <Bar key={l} label={l} value={v} max={maxStatus} tone={tone} />)}</CardContent></Card>
      <Card><CardHeader className="border-b py-3"><CardTitle className="font-serif text-[14px]">서비스 타입별 건수</CardTitle></CardHeader>
        <CardContent className="p-4">{typeRows.length ? typeRows.map(([l, v]) => <Bar key={l} label={l} value={v} max={maxType} />) : <div className="py-2 text-sm text-muted-foreground">데이터 없음</div>}</CardContent></Card>
    </div>
    <Card className="overflow-hidden p-0">
      <CardHeader className="flex-row items-center justify-between border-b py-3.5"><CardTitle className="font-serif text-[15px]">최근 불사 신청</CardTitle><Chip tone="celadon">실시간</Chip></CardHeader>
      <Table><TableHeader><TableRow><TableHead>회원</TableHead><TableHead>불사</TableHead><TableHead>단번호</TableHead><TableHead>상태</TableHead></TableRow></TableHeader>
        <TableBody>{members.flatMap((m) => m.regs.map((r) => ({ m, r }))).slice(0, 6).map(({ m, r }, i) => (
          <TableRow key={i} className={`cursor-pointer ${r.canceled ? "text-vermilion" : ""}`} onClick={() => selectMember(String(m.id))}>
            <TableCell>{m.name}{m.missionary ? "_" + m.missionary : ""}</TableCell><TableCell>{r.item}</TableCell><TableCell className="font-mono">{r.altar}</TableCell>
            <TableCell>{r.canceled ? <Chip tone="red">취소</Chip> : r.cert ? <Chip tone="celadon">증서발급</Chip> : <Chip tone="ghost">신청</Chip>}</TableCell></TableRow>
        ))}</TableBody></Table>
    </Card>
    <div className="mt-3"><Button variant="outline" onClick={() => go("members")}>회원관리로 →</Button></div>
  </>);
}

/* ============== 회원현황 — 전체 불사 평면 그리드 (레거시 동등) ============== */
function MemberStatus({ members, selectMember, openReg }: { members: Member[]; selectMember: (id: string) => void; openReg: (memberId: string, regId: string) => void }) {
  const { data: affCodes } = useApiList<CommonCode>("/common-codes?group=BA10");
  const affLabel = useMemo(() => Object.fromEntries((affCodes ?? []).map((c) => [c.code, c.name])), [affCodes]);
  const [fAff, setFAff] = useState("__all");
  const [fMiss, setFMiss] = useState("__all");
  const [fItem, setFItem] = useState("__all");
  const [fEvent, setFEvent] = useState("__all");

  const rows = useMemo(() => members.flatMap((m) => m.regs.map((r) => ({
    id: `${m.id}-${r.id}`, memberId: String(m.id), regId: String(r.id),
    name: m.name, missionary: m.missionary || "—",
    affName: affLabel[m.aff] ?? m.aff ?? "",
    event: r.event || "—", item: r.item, altar: r.altar,
    bokjunja: r.bokjunja || "", bogwija: r.bogwija || "", rel: r.rel || "", spirit: r.spirit || "",
    yesujae: r.yesujae || "", seongju: r.seongju || "", sexagenary: r.sexagenary || "", memo: r.memo || "",
    canceled: r.canceled ? "취소" : "", cancelDate: r.cancelDate || "",
    cert: r.cert ? "발급" : "발급안함", certDate: r.certDate || "", date: r.date,
  }))), [members, affLabel]);

  const opts = useMemo(() => {
    const u = (sel: (r: typeof rows[number]) => string) => Array.from(new Set(rows.map(sel).filter((v) => v && v !== "—"))).sort();
    return { aff: u((r) => r.affName), miss: u((r) => r.missionary), item: u((r) => r.item), event: u((r) => r.event) };
  }, [rows]);
  const filtered = useMemo(() => rows.filter((r) =>
    (fAff === "__all" || r.affName === fAff) &&
    (fMiss === "__all" || r.missionary === fMiss) &&
    (fItem === "__all" || r.item === fItem) &&
    (fEvent === "__all" || r.event === fEvent)), [rows, fAff, fMiss, fItem, fEvent]);

  const dash = (p: { value?: string }) => p.value || "—";
  const cols: ColDef[] = [
    { headerName: "이름", field: "name", pinned: "left", width: 104, cellClass: "font-bold" },
    { headerName: "봉안일", field: "event", width: 156, tooltipField: "event" },
    { headerName: "포교원장", field: "missionary", width: 118 },
    { headerName: "소속", field: "affName", width: 96, valueFormatter: dash },
    { headerName: "불사목록", field: "item", width: 126 },
    { headerName: "단번호", field: "altar", width: 88, cellClass: "font-mono" },
    { headerName: "복전자", field: "bokjunja", width: 150, tooltipField: "bokjunja", valueFormatter: dash },
    { headerName: "복위자", field: "bogwija", width: 96, valueFormatter: dash },
    { headerName: "관계", field: "rel", width: 76, valueFormatter: dash },
    { headerName: "영가", field: "spirit", width: 96, valueFormatter: dash },
    { headerName: "예수재", field: "yesujae", width: 88, valueFormatter: dash },
    { headerName: "12성주", field: "seongju", width: 78, valueFormatter: dash },
    { headerName: "생년", field: "sexagenary", width: 108, valueFormatter: dash },
    { headerName: "기타메모", field: "memo", width: 140, tooltipField: "memo", valueFormatter: dash },
    { headerName: "취소여부", field: "canceled", width: 82, valueFormatter: dash },
    { headerName: "취소일자", field: "cancelDate", width: 108, valueFormatter: dash },
    { headerName: "증서발급", field: "cert", width: 88 },
    { headerName: "증서발급일자", field: "certDate", width: 118, valueFormatter: dash },
    { headerName: "입력일", field: "date", width: 108, cellClass: "font-mono" },
  ];

  const selCls = "h-8 w-[150px]";
  return (<>
    <PageTitle title="회원현황" route="/member-status"
      desc="등록된 <b>모든 불사</b>를 1행씩 펼쳐서 봅니다(동명이인 전부 표시). 그리드 검색·필터로 찾고, 행을 <b>더블클릭</b>하면 그 불사 건을 바로 수정 — 회원 화면은 <b>회원</b> 버튼."
      actions={<Button onClick={() => void downloadFile("/buddhist-services/export?includeCanceled=true", "회원현황.xlsx")}><FileSpreadsheet className="mr-1 h-4 w-4" />Excel</Button>} />
    <Card className="mb-3"><CardContent className="flex flex-wrap items-end gap-3 p-3">
      <div><Label className="mb-1 block text-[11px]">소속</Label>
        <Select value={fAff} onValueChange={setFAff}><SelectTrigger className={selCls}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all">전체</SelectItem>{opts.aff.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
      <div><Label className="mb-1 block text-[11px]">포교원장</Label>
        <Select value={fMiss} onValueChange={setFMiss}><SelectTrigger className={selCls}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all">전체</SelectItem>{opts.miss.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
      <div><Label className="mb-1 block text-[11px]">불사목록</Label>
        <Select value={fItem} onValueChange={setFItem}><SelectTrigger className={selCls}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all">전체</SelectItem>{opts.item.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
      <div><Label className="mb-1 block text-[11px]">봉안일</Label>
        <Select value={fEvent} onValueChange={setFEvent}><SelectTrigger className={selCls}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all">전체</SelectItem>{opts.event.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
      <Button variant="ghost" size="sm" className="mb-0.5" onClick={() => { setFAff("__all"); setFMiss("__all"); setFItem("__all"); setFEvent("__all"); }}>필터 초기화</Button>
      <div className="mb-1.5 ml-auto self-center text-[12px] text-muted-foreground"><b className="text-foreground">{filtered.length}</b> / {rows.length} 건</div>
    </CardContent></Card>
    <DataGrid title="회원현황" rowData={filtered} columnDefs={cols} height="calc(100dvh - 300px)"
      onRowOpen={(r) => openReg((r as { memberId: string }).memberId, (r as { regId: string }).regId)}
      rowActions={[{ label: "회원", onClick: (r) => selectMember((r as { memberId: string }).memberId) }]} />
  </>);
}

/* ============== 리포트 ============== */
function Reports({ ann, route, setRoute, members, selectMember }: { ann: boolean; route: string; setRoute: (r: string) => void; members: Member[]; selectMember: (id: string) => void }) {
  const svc = route === "reports-svc";
  const regs: { m: Member; r: Reg }[] = [];
  members.forEach((m) => m.regs.forEach((r) => regs.push({ m, r })));
  regs.sort((a, b) => b.r.date.localeCompare(a.r.date));
  const svcRows = regs.map(({ m, r }) => ({ ...r, member: `${m.name}${m.missionary ? "_" + m.missionary : ""}`, mid: String(m.id) }));
  const statusChip = (p: { value: string }) => <Chip tone={p.value === "취소" ? "red" : p.value === "증서" ? "celadon" : "ghost"} className="px-1.5 py-0 text-[10px]">{p.value}</Chip>;
  const reportCols: ColDef[] = [
    { headerName: "상태", pinned: "left", width: 84, valueGetter: (p: { data: Reg }) => p.data.canceled ? "취소" : p.data.cert ? "증서" : "신청", cellStyle: { display: "flex", alignItems: "center" }, cellRenderer: statusChip },
    { headerName: "봉안일", pinned: "left", width: 130, valueGetter: (p: { data: Reg }) => p.data.event || p.data.date, cellClass: "font-mono" },
    { headerName: "불사", field: "item", width: 132 },
    { headerName: "회원", field: "member", width: 160 },
    { headerName: "단번호", field: "altar", width: 92, cellClass: "font-mono font-bold" },
    { headerName: "복전자", field: "bokjunja", width: 220, tooltipField: "bokjunja", valueFormatter: (p: { value?: string }) => p.value || "—" },
    { headerName: "영가", field: "spirit", width: 110, valueFormatter: (p: { value?: string }) => p.value || "—" },
    { headerName: "예수재", field: "yesujae", width: 96, valueFormatter: (p: { value?: string }) => p.value || "—" },
    { headerName: "시주", field: "donation", width: 108, type: "rightAligned", cellClass: "font-mono", valueFormatter: (p: { value: number }) => p.value ? krw(p.value) : "—" },
    { headerName: "입력일", field: "date", width: 110, cellClass: "font-mono" },
  ];
  return (<>
    <PageTitle title={svc ? "제사·불사 현황" : "회원현황 리포트"} route={svc ? "/reports/services" : "/reports/members"}
      desc={svc ? "불사 항목별 <b>1행</b> 출력, 가독성 위해 <b>봉안일을 행 맨 앞 열</b>." : "봉안일/소속/불사/포교원장 필터 + 서버사이드 Excel 내보내기."}
      actions={<>
        <Button variant="ghost" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />인쇄/PDF</Button>
        <Button onClick={() => void downloadFile(svc ? "/buddhist-services/export?includeCanceled=true" : "/members/export", svc ? "제사불사현황.xlsx" : "회원현황.xlsx")}><FileSpreadsheet className="mr-1 h-4 w-4" />Excel</Button>
      </>} />
    <div className="mb-4 flex gap-1.5">
      <button onClick={() => setRoute("reports")} className={`rounded-lg px-3.5 py-2 text-sm font-bold ${!svc ? "bg-primary text-primary-foreground" : "border bg-card text-muted-foreground"}`}>회원현황</button>
      <button onClick={() => setRoute("reports-svc")} className={`rounded-lg px-3.5 py-2 text-sm font-bold ${svc ? "bg-primary text-primary-foreground" : "border bg-card text-muted-foreground"}`}>제사·불사 현황</button>
    </div>
    <Ann show={ann}>{svc ? `항목당 1행 분해(<b>FR-RPT-01</b>) · 인물명 매칭으로 소유 회원 노출(<b>FR-RPT-04</b>).` : `레거시 <code>F_MemberList</code> 동등 · 서버 ExcelJS, 타입 보존.`}</Ann>
    {svc ? (
      <DataGrid title="제사·불사 현황 · 항목별 1행" rowData={svcRows} columnDefs={reportCols} onRowClicked={(e: { data: { mid: string } }) => selectMember(e.data.mid)} height="calc(100dvh - 220px)" />
    ) : (
      <Card className="overflow-hidden p-0">
        <Table><TableHeader><TableRow><TableHead>회원</TableHead><TableHead>포교원장</TableHead><TableHead>소속</TableHead><TableHead>전화</TableHead><TableHead>불사</TableHead></TableRow></TableHeader>
          <TableBody>{members.map((m) => (<TableRow key={m.id} className="cursor-pointer" onClick={() => selectMember(String(m.id))}><TableCell className="font-bold">{m.name}{m.missionary ? "_" + m.missionary : ""}</TableCell><TableCell>{m.missionary || "—"}</TableCell><TableCell>{m.aff || "—"}</TableCell><TableCell className="font-mono">{m.phone || "—"}</TableCell><TableCell>{m.regs.length}건</TableCell></TableRow>))}</TableBody></Table>
      </Card>
    )}
  </>);
}

/* ============== 봉안일 (프로토타입 목업 · 음력/간지 Phase 2) ============== */
function Enshrinements({ ann, ro, selectMember, enshrinements, reload }: { ann: boolean; ro: boolean; selectMember: (id: string) => void; enshrinements: Enshrinement[]; reload: () => void }) {
  const [cur, setCur] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [open, setOpen] = useState(false);
  const [ensDetail, setEnsDetail] = useState<Record<string, unknown> | null>(null);

  const sorted = [...enshrinements].sort((a, b) => b.eventDateSolar.localeCompare(a.eventDateSolar));
  const curE = enshrinements.find((e) => e.id === cur) ?? null;
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("ko-KR");
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

  useEffect(() => {
    if (!cur) { setRoster([]); return; }
    let alive = true;
    api.get<RosterRow[]>(`/enshrinements/${cur}/members`).then((r) => { if (alive) setRoster(r); }).catch(() => { if (alive) setRoster([]); });
    return () => { alive = false; };
  }, [cur]);

  const createEns = async (f: Record<string, unknown>) => {
    const date = f.eventDateSolar as string | undefined;
    if (!date) { alert("봉안일(양력)을 입력하세요."); return; }
    try {
      await api.post("/enshrinements", { eventDateSolar: new Date(date).toISOString(), label: (f.label as string) || undefined, remark: (f.remark as string) || undefined });
      setOpen(false); reload();
    } catch (e) { alert(e instanceof ApiError ? e.message : "저장 실패"); }
  };
  const putEns = async (r: { id: string; eventDateSolar?: string; label?: string | null; remark?: string | null; defaultBuddhistServiceItemId?: string | null }) => {
    await api.put(`/enshrinements/${r.id}`, { eventDateSolar: new Date(r.eventDateSolar ?? "").toISOString(), label: r.label || undefined, remark: r.remark || undefined, defaultBuddhistServiceItemId: r.defaultBuddhistServiceItemId || undefined });
    reload();
  };
  const ensRows = sorted.map((e) => ({ id: e.id, eventDateSolar: e.eventDateSolar, dateLabel: fmtDate(e.eventDateSolar), time: fmtTime(e.eventDateSolar), label: e.label, remark: e.remark, item: e.defaultBuddhistServiceItemName, defaultBuddhistServiceItemId: e.defaultBuddhistServiceItemId }));
  const rosterRows = roster.map((r) => ({ ...r, id: r.regId }));
  const ensCols: ColDef[] = [
    { headerName: "일자", field: "dateLabel", width: 116, cellClass: "font-mono" },
    { headerName: "시간", field: "time", width: 80, cellClass: "font-mono" },
    { headerName: "표기", field: "label", flex: 1, minWidth: 130, valueFormatter: (p) => p.value ?? "—" },
    { headerName: "기본 불사", field: "item", width: 150, valueFormatter: (p) => p.value ?? "—" },
    { headerName: "비고", field: "remark", flex: 1, minWidth: 130, valueFormatter: (p) => p.value ?? "—" },
  ];
  const rosterCols: ColDef[] = [
    { headerName: "단번호", field: "altarNumber", width: 104, cellClass: "font-mono font-bold", valueFormatter: (p) => p.value ?? "—" },
    { headerName: "회원", field: "displayName", flex: 1, minWidth: 140 },
    { headerName: "불사", field: "buddhistServiceItemName", width: 150, valueFormatter: (p) => p.value ?? "—" },
    { headerName: "상태", width: 90, valueGetter: (p: { data: RosterRow }) => (p.data.isCanceled ? "취소" : "정상") },
  ];

  return (<>
    <PageTitle title="봉안일·기일" route="/enshrinements" desc="행 <b>더블클릭</b>으로 상세(일자 포함 편집), <b>명단</b>으로 연결 신청 표시. 봉안일은 날짜+시간+불사목록으로 식별되는 <b>공유 이벤트</b>."
      actions={<Button disabled={ro} onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />봉안일 등록</Button>} />
    <Ann show={ann}>{`AS-IS→TO-BE: 문자열 연결·CHAR(10) 비교 폐기 → 정식 date(timestamptz). 음력↔양력·육십갑자·기일 자동계산은 <b>Phase 2</b>.`}</Ann>
    <EditSheet open={open} onClose={() => setOpen(false)} title="봉안일 등록" desc="양력 일시(음력/간지는 Phase 2)"
      fields={[
        { key: "eventDateSolar", label: "봉안일(양력)", type: "datetime" },
        { key: "label", label: "표기", placeholder: "2026-09-24_해인" },
        { key: "remark", label: "비고", type: "textarea" },
      ]}
      row={open ? {} : null} onSave={async (f) => { await createEns(f); }} />
    <DataGrid title="봉안일 (양력 내림차순)" rowData={ensRows} columnDefs={ensCols} selectedId={cur} height={ensRows.length ? Math.min(360, ensRows.length * 32 + 80) : 160}
      onCellEdit={ro ? undefined : (_id, _f, _v, row) => { putEns(row as { id: string }).catch(() => reload()); }}
      onRowOpen={(r) => setEnsDetail(r as Record<string, unknown>)} rowActions={[{ label: "명단", onClick: (r) => setCur((r as { id: string }).id) }]} />
    <div className="mt-4">
      {curE ? (
        <DataGrid title={`명단 · ${fmtDate(curE.eventDateSolar)} ${fmtTime(curE.eventDateSolar)}${curE.label ? " · " + curE.label : ""} (${roster.length}명)`}
          rowData={rosterRows} columnDefs={rosterCols} height={rosterRows.length ? Math.min(420, rosterRows.length * 32 + 80) : 160}
          rowActions={[{ label: "회원", onClick: (r) => selectMember((r as RosterRow).memberId) }]} />
      ) : <Card className="p-8 text-center text-sm text-muted-foreground">위 목록에서 봉안일의 <b className="mx-1">명단</b> 버튼을 누르면 연결된 불사 신청이 표시됩니다.</Card>}
    </div>
    <EditSheet open={!!ensDetail} onClose={() => setEnsDetail(null)} title="봉안일 상세"
      fields={[
        { key: "eventDateSolar", label: "봉안일(양력)", type: "datetime" },
        { key: "label", label: "표기" },
        { key: "remark", label: "비고", type: "textarea" },
      ]}
      row={ensDetail}
      onSave={async (f) => { if (ensDetail) await putEns({ ...ensDetail, ...f } as { id: string }); }} />
  </>);
}

/* ============== 일괄 업로드 위저드 (프로토타입 표시) ============== */
interface ImportReport { total: number; loaded: number; skipped: number; errors: { row: number; reason: string }[]; membersCreated?: number; eventsCreated?: number }

/** 업로드 섹션 — 회원/불사 템플릿 공용(파일 선택 → 검증·적재 → 리포트). */
function ImportSection({ title, desc, endpoint, reload }: { title: string; desc: React.ReactNode; endpoint: string; reload: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async () => {
    if (!file) { setError("xlsx 파일을 선택하세요."); return; }
    setBusy(true); setError(null); setReport(null);
    try {
      const r = await uploadXlsx<ImportReport>(endpoint, file);
      setReport(r);
      if (r.loaded > 0) reload();
    } catch (e) { setError(e instanceof ApiError ? e.message : "업로드 실패"); }
    finally { setBusy(false); }
  };

  const stats: [string, string, string][] = [
    ["총 행", String(report?.total ?? 0), ""],
    ["적재", String(report?.loaded ?? 0), "text-celadon"],
    ["스킵(중복)", String(report?.skipped ?? 0), "text-gold"],
    ["오류", String(report?.errors.length ?? 0), "text-vermilion"],
  ];
  if (report?.membersCreated !== undefined) stats.push(["자동생성 회원", String(report.membersCreated), "text-celadon"]);
  if (report?.eventsCreated !== undefined) stats.push(["신규 봉안일", String(report.eventsCreated), "text-celadon"]);

  return (<>
    <Card className="mb-4"><CardContent className="p-5">
      <h3 className="font-serif text-[15px] font-bold">{title}</h3>
      <div className="mt-2 text-[12px] text-muted-foreground">{desc}</div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input type="file" accept=".xlsx" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setReport(null); }} className="text-sm" />
        <Button onClick={() => void upload()} disabled={busy || !file}><Upload className="mr-1 h-4 w-4" />{busy ? "업로드 중…" : "검증·적재"}</Button>
        <Button variant="outline" onClick={() => { downloadFile(`${endpoint}/export`, "불사건_전체.xlsx").catch((e) => alert(e instanceof ApiError ? e.message : "엑셀 추출 실패")); }} title="현재 적재된 불사 건 전체를 업로드 양식 그대로 내려받기(수정 후 재업로드 가능)"><FileSpreadsheet className="mr-1 h-4 w-4" />엑셀 추출</Button>
      </div>
      {error && <div className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
    </CardContent></Card>

    {report && (<>
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        {stats.map((s) => (
          <Card key={s[0]}><CardContent className="p-4"><div className="text-xs font-bold text-muted-foreground">{s[0]}</div><div className={`mt-1.5 font-serif text-2xl font-black ${s[2]}`}>{s[1]}</div></CardContent></Card>
        ))}
      </div>
      <Card className="mb-4 overflow-hidden p-0"><CardHeader className="border-b py-3.5"><CardTitle className="font-serif text-[15px]">오류 리포트</CardTitle></CardHeader>
        <Table><TableHeader><TableRow><TableHead>엑셀 행</TableHead><TableHead>사유</TableHead></TableRow></TableHeader>
          <TableBody>{report.errors.length ? report.errors.map((e, i) => (<TableRow key={i} className="text-vermilion"><TableCell className="font-mono">{e.row}</TableCell><TableCell>{e.reason}</TableCell></TableRow>)) : <TableRow><TableCell colSpan={2} className="py-6 text-center text-celadon">오류 없음 ✓</TableCell></TableRow>}</TableBody></Table></Card>
    </>)}
  </>);
}

function ImportWizard({ ann, reload }: { ann: boolean; reload: () => void }) {
  return (<>
    <PageTitle title="일괄 업로드" route="/data/import" desc="불사 건 표준 템플릿(.xlsx) 업로드 → <b>적재 전 검증</b> → 단일 트랜잭션 적재 → 결과 리포트. 레거시 백업(.bak)만 있는 경우는 SQL Server 복원 후 <b>초기 데이터 이관</b>을 사용하세요." />
    <Ann show={ann}>{`레거시 <code>F_DataBatchAdd</code> 행별 SP·비트랜잭션 → 검증 강제·단일 트랜잭션·멱등. 불사 시트에 회원정보(소속·포교원장·생년월일) 동봉 → 회원 자동생성·봉안일 자동연결. FR-MIG-01~13`}</Ann>
    <ImportSection title="불사 건 업로드" endpoint="/data/import/buddhist-services" reload={reload}
      desc={<>헤더(레거시 실컬럼): <code>신청자 · 소속 · 포교원장 · 봉안일 · 불사목록 · 단번호 · 복위자 · 관계 · 복전자 · 영가 · 예수재 · 12성주 · 생년월일 · 기타메모 · 취소일자 · 증서발급 · 증서발급일자</code><br />
        신청자·불사목록 필수. 회원 미존재 시 <b>자동 생성</b>(소속·포교원장·생년월일 반영, 포교원장 미등록 시 자동 등록), 봉안일(YYYY-MM-DD HH:mm)은 동일 일시 이벤트에 연결·없으면 생성. 완전 동일 건은 스킵.</>} />
  </>);
}

/* ============== 관리자 (프로토타입 표시) ============== */
interface MissionaryRow { id: string; name: string; phone: string | null; address: string | null; addressDetail: string | null; isActive: boolean }
interface ItemRow { id: string; name: string; serviceTypeCode: string | null; referenceAmount: string | null; description: string | null; photoUrl: string | null; isActive: boolean; usageCount?: number }
interface RoleRow { id: string; code: string; name: string; permissions: string[] }
interface StaffRow { id: string; staffNameKo: string; staffNameEn: string | null; positionCode: string | null; dutyCode: string | null; jobGroupCode: string | null; staffDivCode: string | null; appellationDivCode: string | null; solarLunarCode: string | null; authLevelCode: string | null; birthDate: string | null; joinDate: string | null; retireDate: string | null; smsReceiveYn: boolean | null; photoUrl: string | null; juminMasked: string | null; isWorking: boolean }

function Admin({ route, ann }: { route: string; ann: boolean }) {
  if (route === "admin-missionaries") return <AdminMissionaries ann={ann} />;
  if (route === "admin-items") return <AdminItems ann={ann} />;
  if (route === "admin-codes") return <AdminCodes ann={ann} />;
  if (route === "admin-roles") return <AdminRoles ann={ann} />;
  if (route === "admin-accounts") return <AdminAccounts ann={ann} />;
  if (route === "admin-backup") return <AdminBackup ann={ann} />;
  if (route === "admin-migration") return <AdminMigration ann={ann} />;
  return <AdminStaff ann={ann} />;
}

/* ============== 재사용 상세 편집 슬라이드오버 ============== */
type EditFieldType = "text" | "number" | "select" | "bool" | "textarea" | "datetime" | "date" | "image";
interface EditField { key: string; label: string; type?: EditFieldType; options?: { value: string; label: string }[]; mono?: boolean; placeholder?: string }

/** ISO → datetime-local 입력값(로컬 시간). */
const dtLocal = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** 명령 팔레트(⌘K) — 화면 빠른 이동 + 회원 즉시 점프. 모던/레거시·모바일 공용. */
function CommandPalette({ open, onClose, members, go, selectMember }: {
  open: boolean; onClose: () => void; members: Member[];
  go: (r: string) => void; selectMember: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  useEffect(() => { if (open) { setQ(""); setIdx(0); } }, [open]);
  const lc = q.trim().toLowerCase();
  const navHits = NAV_ITEMS.filter((i) => !lc || i.label.toLowerCase().includes(lc)).map((i) => ({ kind: "nav" as const, key: i.key, label: i.label, icon: i.icon }));
  const memHits = lc ? members.filter((m) => m.name.toLowerCase().includes(lc) || (m.missionary ?? "").toLowerCase().includes(lc)).slice(0, 6).map((m) => ({ kind: "member" as const, key: String(m.id), label: `${m.name}${m.missionary ? "_" + m.missionary : ""}`, sub: `${m.regs.length}건 · ${m.phone || "—"}` })) : [];
  const items = [...navHits, ...memHits];
  const run = (it: typeof items[number]) => { if (it.kind === "nav") go(it.key); else selectMember(it.key); onClose(); };
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
      else if (e.key === "Enter" && items[idx]) { e.preventDefault(); run(items[idx]); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, items, idx]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} placeholder="화면 이동 또는 회원 검색…" className="w-full bg-transparent text-sm outline-none" />
          <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">ESC</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-1.5">
          {items.length === 0 && <div className="px-3 py-6 text-center text-sm text-muted-foreground">결과 없음</div>}
          {items.map((it, i) => (
            <button key={it.kind + it.key} onMouseEnter={() => setIdx(i)} onClick={() => run(it)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${i === idx ? "bg-accent text-celadon" : "hover:bg-secondary"}`}>
              {it.kind === "nav" ? <it.icon className="h-4 w-4 flex-none opacity-80" /> : <Users className="h-4 w-4 flex-none opacity-60" />}
              <span className="flex-1 truncate font-medium">{it.label}</span>
              <span className="text-[11px] text-muted-foreground">{it.kind === "nav" ? "이동" : (it as { sub: string }).sub}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 드로워(레거시) ↔ 모달(2.0) 공용 셸 — 커스텀 폼(회원 등록/불사 신청)을 일관 표현. */
function FormShell({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const { formMode } = useUiPrefs();
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (formMode === "modal") {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
        <div className="relative flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-2xl border bg-card shadow-2xl sm:max-w-3xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
          <button onClick={onClose} className="absolute right-3 top-3 z-10 rounded-full bg-secondary/80 p-1.5 text-muted-foreground transition hover:text-foreground"><X className="h-4 w-4" /></button>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
        </div>
      </div>
    );
  }
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">{children}</SheetContent>
    </Sheet>
  );
}

function EditSheet({ open, onClose, title, desc, fields, row, onSave, footerExtra }: {
  open: boolean; onClose: () => void; title: string; desc?: string;
  fields: EditField[]; row: Record<string, unknown> | null;
  onSave: (form: Record<string, unknown>) => Promise<void>; footerExtra?: React.ReactNode;
}) {
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setForm(row ? { ...row } : {}); setError(null); }, [row]);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => { setBusy(true); setError(null); try { await onSave(form); onClose(); } catch (e) { setError(e instanceof ApiError ? e.message : "저장 실패"); } finally { setBusy(false); } };
  const { formMode } = useUiPrefs();
  const fieldsBody = (
      <div className={`grid grid-cols-1 gap-x-4 gap-y-3 ${formMode === "modal" ? "sm:grid-cols-2" : ""}`}>
          {error && <div className="sm:col-span-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {fields.map((f) => (
            <div key={f.key} className={f.type === "textarea" || f.type === "image" ? "sm:col-span-2" : ""}>
              <Label className="mb-1.5 block text-xs">{f.label}</Label>
              {f.type === "bool" ? (
                <Select value={String(form[f.key] ?? false)} onValueChange={(v) => set(f.key, v === "true")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="true">예</SelectItem><SelectItem value="false">아니오</SelectItem></SelectContent>
                </Select>
              ) : f.type === "select" ? (
                <Select value={(form[f.key] as string) || ""} onValueChange={(v) => set(f.key, v)}>
                  <SelectTrigger><SelectValue placeholder="(미설정)" /></SelectTrigger>
                  <SelectContent>{(f.options ?? []).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              ) : f.type === "textarea" ? (
                <Textarea rows={3} value={(form[f.key] as string) ?? ""} onChange={(e) => set(f.key, e.target.value)} />
              ) : f.type === "datetime" ? (
                <Input type="datetime-local" value={dtLocal(form[f.key] as string | undefined)} onChange={(e) => set(f.key, e.target.value)} />
              ) : f.type === "date" ? (
                <Input type="date" value={(form[f.key] as string | undefined)?.slice(0, 10) ?? ""} onChange={(e) => set(f.key, e.target.value)} />
              ) : f.type === "image" ? (
                <div className="flex items-center gap-3">
                  <div className="grid h-20 w-20 flex-none place-items-center overflow-hidden rounded-md border bg-secondary/40 text-center text-[10px] text-muted-foreground">
                    {form[f.key] ? <img src={form[f.key] as string} alt="" className="h-full w-full object-cover" /> : "이미지 없음"}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="block w-full text-[11px] file:mr-2 file:rounded file:border file:bg-secondary file:px-2 file:py-1 file:text-xs"
                      onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { const r = await uploadImage(file); set(f.key, r.url); } catch (err) { alert(err instanceof ApiError ? err.message : "이미지 업로드 실패"); } }} />
                    <Input placeholder="또는 이미지 URL 직접 입력" value={(form[f.key] as string) ?? ""} onChange={(e) => set(f.key, e.target.value)} />
                  </div>
                </div>
              ) : (
                <Input className={f.mono ? "font-mono" : ""} placeholder={f.placeholder}
                  value={(form[f.key] as string | number | null | undefined) ?? ""}
                  onChange={(e) => set(f.key, f.type === "number" ? e.target.value.replace(/[^\d]/g, "") : e.target.value)} />
              )}
            </div>
          ))}
          {footerExtra && <div className="sm:col-span-2">{footerExtra}</div>}
        </div>
  );
  if (formMode === "modal") {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
        <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border bg-card shadow-2xl sm:max-w-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-[hsl(167_44%_34%)] to-[hsl(167_46%_24%)] px-6 py-4 text-white">
            <div>
              <div className="mb-1 inline-block rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-black tracking-widest">2.0</div>
              <h2 className="font-serif text-xl font-black leading-tight">{title}</h2>
              {desc && <p className="mt-1 text-xs text-white/75">{desc}</p>}
            </div>
            <button onClick={onClose} className="-mr-1 rounded-full p-1.5 text-white/80 transition hover:bg-white/20 hover:text-white"><X className="h-5 w-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">{fieldsBody}</div>
          <div className="flex justify-end gap-2 border-t bg-secondary/40 px-6 py-3.5">
            <Button variant="ghost" onClick={onClose}>취소</Button>
            <Button onClick={() => void save()} disabled={busy} className="bg-gradient-to-r from-[hsl(167_44%_34%)] to-[hsl(167_46%_27%)] text-white shadow-md hover:opacity-95">{busy ? "저장 중…" : "저장"}</Button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <div className="mb-1"><h2 className="font-serif text-lg font-bold">{title}</h2>{desc && <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>}</div>
        <div className="mt-4">{fieldsBody}</div>
        <div className="mt-6 flex justify-end gap-2 border-t pt-4">
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button onClick={() => void save()} disabled={busy}>{busy ? "저장 중…" : "저장"}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const opts = (cs: CommonCode[] | null) => (cs ?? []).map((c) => ({ value: c.code, label: c.name }));
const refOf = (cs: CommonCode[] | null) => Object.fromEntries((cs ?? []).map((c) => [c.code, c.name]));
const staffBody = (r: Partial<StaffRow> & { jumin?: string }) => ({
  staffNameKo: r.staffNameKo, staffNameEn: r.staffNameEn || null,
  positionCode: r.positionCode || null, dutyCode: r.dutyCode || null, jobGroupCode: r.jobGroupCode || null,
  staffDivCode: r.staffDivCode || null, appellationDivCode: r.appellationDivCode || null,
  solarLunarCode: r.solarLunarCode || null, authLevelCode: r.authLevelCode || null,
  birthDate: r.birthDate || undefined, joinDate: r.joinDate || undefined, retireDate: r.retireDate || undefined,
  smsReceiveYn: r.smsReceiveYn ?? undefined, isWorking: r.isWorking ?? true,
});

function AdminStaff({ ann }: { ann: boolean }) {
  const { data, reload } = useApiList<StaffRow>("/admin/staff");
  const { data: posCodes } = useApiList<CommonCode>("/common-codes?group=AB10");
  const { data: dutyCodes } = useApiList<CommonCode>("/common-codes?group=AA10");
  const { data: jobCodes } = useApiList<CommonCode>("/common-codes?group=AC10");
  const { data: divCodes } = useApiList<CommonCode>("/common-codes?group=AD10");
  const { data: appCodes } = useApiList<CommonCode>("/common-codes?group=AE10");
  const { data: slCodes } = useApiList<CommonCode>("/common-codes?group=AF10");
  const { data: alCodes } = useApiList<CommonCode>("/common-codes?group=AL10");
  const [detail, setDetail] = useState<StaffRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const del = async (id: string) => { if (!confirm("이 사원을 삭제하시겠습니까?")) return; await api.delete(`/admin/staff/${id}`); reload(); };
  const put = async (id: string, r: Partial<StaffRow>) => { await api.put(`/admin/staff/${id}`, staffBody(r)); reload(); };
  const create = async (f: Record<string, unknown>) => { const r = f as Partial<StaffRow> & { jumin?: string }; if (!r.staffNameKo) { alert("이름은 필수입니다."); return; } await api.post("/admin/staff", { ...staffBody(r), jumin: r.jumin || undefined }); reload(); };
  const dash = (p: { value?: string | null }) => p.value ?? "—";
  const codeCol = (header: string, field: string, cs: CommonCode[] | null, width: number): ColDef => {
    const rd = refOf(cs);
    return { headerName: header, field, editable: true, width, refData: rd, cellEditor: "agSelectCellEditor", cellEditorParams: { values: opts(cs).map((o) => o.value) }, valueFormatter: (p) => (p.value ? rd[p.value] ?? p.value : "—") };
  };
  const STAFF_FIELDS: EditField[] = [
    { key: "staffNameKo", label: "이름(한글)" }, { key: "staffNameEn", label: "영문명" },
    { key: "positionCode", label: "직위", type: "select", options: opts(posCodes) },
    { key: "dutyCode", label: "직책", type: "select", options: opts(dutyCodes) },
    { key: "jobGroupCode", label: "직군", type: "select", options: opts(jobCodes) },
    { key: "staffDivCode", label: "직원구분", type: "select", options: opts(divCodes) },
    { key: "appellationDivCode", label: "호칭구분", type: "select", options: opts(appCodes) },
    { key: "solarLunarCode", label: "양/음력", type: "select", options: opts(slCodes) },
    { key: "authLevelCode", label: "사용자구분", type: "select", options: opts(alCodes) },
    { key: "birthDate", label: "생년월일", type: "date" }, { key: "joinDate", label: "입사일", type: "date" }, { key: "retireDate", label: "퇴사일", type: "date" },
    { key: "smsReceiveYn", label: "SMS 수신", type: "bool" }, { key: "isWorking", label: "재직여부", type: "bool" },
  ];
  const cols: ColDef[] = [
    { headerName: "ID", field: "id", width: 60, cellClass: "font-mono text-muted-foreground" },
    { headerName: "이름", field: "staffNameKo", editable: true, width: 96, cellClass: "font-bold" },
    { headerName: "영문", field: "staffNameEn", editable: true, width: 84, valueFormatter: dash },
    codeCol("직위", "positionCode", posCodes, 84),
    codeCol("직책", "dutyCode", dutyCodes, 84),
    codeCol("직군", "jobGroupCode", jobCodes, 84),
    codeCol("직원구분", "staffDivCode", divCodes, 92),
    codeCol("호칭", "appellationDivCode", appCodes, 80),
    codeCol("양음력", "solarLunarCode", slCodes, 80),
    codeCol("사용자구분", "authLevelCode", alCodes, 96),
    { headerName: "생년월일", field: "birthDate", width: 108, cellClass: "font-mono", valueFormatter: dash },
    { headerName: "입사일", field: "joinDate", width: 106, cellClass: "font-mono", valueFormatter: dash },
    { headerName: "퇴사일", field: "retireDate", width: 106, cellClass: "font-mono", valueFormatter: dash },
    { headerName: "SMS", field: "smsReceiveYn", editable: true, width: 66 },
    { headerName: "주민번호", field: "juminMasked", width: 146, cellClass: "font-mono", valueFormatter: dash },
    { headerName: "재직", field: "isWorking", editable: true, width: 66 },
  ];
  return (<>
    <PageTitle title="사원" route="/admin/staff" desc="행 <b>더블클릭</b>으로 상세(전체 항목 편집, 코드는 드롭다운). 주민번호는 암호화·마스킹, 열람 시 감사(FR-HR-03)."
      actions={<Button onClick={() => setCreating(true)}><Plus className="mr-1 h-4 w-4" />사원 추가</Button>} />
    <Ann show={ann}>{`주민번호 평문 → AES-256-GCM 암호화 + 마스킹 + 접근 감사(NFR-SEC-17). 코드류는 공통코드(AA10·AB10…) 기반 드롭다운.`}</Ann>
    <DataGrid title="사원" rowData={data ?? []} columnDefs={cols} height="calc(100dvh - 220px)"
      onCellEdit={(id, _f, _v, row) => { put(id, row as StaffRow).catch(() => reload()); }}
      onRowOpen={(r) => { setDetail(r as StaffRow); setRevealed(null); }} rowActions={[{ label: "삭제", tone: "vermilion", onClick: (r) => void del((r as StaffRow).id) }]} />
    <EditSheet open={!!detail} onClose={() => setDetail(null)} title="사원 상세" desc="전체 인사 항목 편집"
      fields={STAFF_FIELDS} row={detail as unknown as Record<string, unknown> | null}
      onSave={async (f) => { if (detail) await put(detail.id, f as Partial<StaffRow>); }}
      footerExtra={detail && (
        <div className="rounded-md border bg-secondary/40 p-3">
          <Label className="mb-1.5 block text-xs">주민번호</Label>
          <div className="flex items-center gap-2 font-mono text-sm">{revealed ?? detail.juminMasked ?? "—"}
            {detail.juminMasked && revealed == null && <button className="text-[11px] font-bold text-celadon hover:underline" onClick={async () => { const r = await api.get<{ jumin: string | null }>(`/admin/staff/${detail.id}/jumin`); setRevealed(r.jumin ?? "(없음)"); }}>열람(감사 기록)</button>}
          </div>
        </div>
      )} />
    <EditSheet open={creating} onClose={() => setCreating(false)} title="사원 추가" desc="신규 사원 등록(이름 필수)"
      fields={[...STAFF_FIELDS, { key: "jumin", label: "주민번호", mono: true, placeholder: "901010-1234567" }]}
      row={creating ? {} : null}
      onSave={async (f) => { await create(f); }} />
  </>);
}

const MISSIONARY_FIELDS: EditField[] = [
  { key: "name", label: "이름" },
  { key: "phone", label: "휴대폰", mono: true },
  { key: "address", label: "주소" },
  { key: "addressDetail", label: "주소 상세" },
  { key: "isActive", label: "사용여부", type: "bool" },
];
const missionaryBody = (r: Partial<MissionaryRow>) => ({ name: r.name, phone: r.phone || null, address: r.address || null, addressDetail: r.addressDetail || null, isActive: r.isActive });

function AdminMissionaries({ ann }: { ann: boolean }) {
  const { data, reload } = useApiList<MissionaryRow>("/admin/missionaries");
  const [detail, setDetail] = useState<MissionaryRow | null>(null);
  const [creating, setCreating] = useState(false);
  const del = async (id: string) => { if (!confirm("이 포교원장을 삭제하시겠습니까?")) return; await api.delete(`/admin/missionaries/${id}`); reload(); };
  const put = async (id: string, r: Partial<MissionaryRow>) => { await api.put(`/admin/missionaries/${id}`, missionaryBody(r)); reload(); };
  const create = async (f: Record<string, unknown>) => { const r = f as Partial<MissionaryRow>; if (!r.name) { alert("이름은 필수입니다."); return; } await api.post("/admin/missionaries", missionaryBody(r)); reload(); };
  const cols: ColDef[] = [
    { headerName: "ID", field: "id", width: 64, cellClass: "font-mono text-muted-foreground" },
    { headerName: "이름", field: "name", editable: true, width: 150, cellClass: "font-bold" },
    { headerName: "휴대폰", field: "phone", editable: true, width: 150, cellClass: "font-mono", valueFormatter: (p) => p.value ?? "—" },
    { headerName: "주소", field: "address", editable: true, flex: 1, minWidth: 180, valueFormatter: (p) => p.value ?? "—" },
    { headerName: "주소 상세", field: "addressDetail", editable: true, flex: 1, minWidth: 140, valueFormatter: (p) => p.value ?? "—" },
    { headerName: "사용", field: "isActive", width: 84, editable: true },
  ];
  return (<>
    <PageTitle title="포교원장 마스터" route="/admin/missionaries" desc="행 <b>더블클릭</b>으로 상세(전체 편집). 개명해도 회원 표시값만 변동(surrogate 키)."
      actions={<Button onClick={() => setCreating(true)}><Plus className="mr-1 h-4 w-4" />포교원장 추가</Button>} />
    <Ann show={ann}>{`사람/지점 혼재 정리(FR-MST-11) · 식별 키는 surrogate · 주소/주소상세 분리.`}</Ann>
    <DataGrid title="포교원장" rowData={data ?? []} columnDefs={cols} height="calc(100dvh - 220px)"
      onCellEdit={(id, _f, _v, row) => { put(id, row as MissionaryRow).catch(() => reload()); }}
      onRowOpen={(r) => setDetail(r as MissionaryRow)} rowActions={[{ label: "삭제", tone: "vermilion", onClick: (r) => void del((r as MissionaryRow).id) }]} />
    <EditSheet open={!!detail} onClose={() => setDetail(null)} title="포교원장 상세" fields={MISSIONARY_FIELDS}
      row={detail as unknown as Record<string, unknown> | null}
      onSave={async (f) => { if (detail) await put(detail.id, f as Partial<MissionaryRow>); }} />
    <EditSheet open={creating} onClose={() => setCreating(false)} title="포교원장 추가" desc="신규 포교원장 등록(이름 필수)"
      fields={MISSIONARY_FIELDS} row={creating ? {} : null} onSave={async (f) => { await create(f); }} />
  </>);
}

function AdminItems({ ann }: { ann: boolean }) {
  const { data, reload } = useApiList<ItemRow>("/admin/buddhist-service-items");
  const [detail, setDetail] = useState<ItemRow | null>(null);
  const [creating, setCreating] = useState(false);
  const itemBody = (r: Partial<ItemRow>) => ({ name: r.name, serviceTypeCode: r.serviceTypeCode || null, referenceAmount: r.referenceAmount ? String(r.referenceAmount) : null, description: r.description || null, photoUrl: r.photoUrl || null, isActive: r.isActive });
  const del = async (id: string) => { if (!confirm("이 불사목록을 삭제하시겠습니까?")) return; try { await api.delete(`/admin/buddhist-service-items/${id}`); reload(); } catch (e) { alert(e instanceof ApiError ? e.message : "삭제 실패"); } };
  const put = async (id: string, r: Partial<ItemRow>) => { await api.put(`/admin/buddhist-service-items/${id}`, itemBody(r)); reload(); };
  const create = async (f: Record<string, unknown>) => { const r = f as Partial<ItemRow>; if (!r.name) { alert("불사명은 필수입니다."); return; } await api.post("/admin/buddhist-service-items", itemBody(r)); reload(); };
  const ITEM_FIELDS: EditField[] = [
    { key: "name", label: "불사명" },
    { key: "referenceAmount", label: "참조 금액", type: "number", mono: true },
    { key: "description", label: "설명", type: "textarea" },
    { key: "photoUrl", label: "사진", type: "image" },
    { key: "isActive", label: "사용여부", type: "bool" },
  ];
  const photoCell = (p: { value?: string | null }) => (p.value
    ? <img src={p.value} alt="" className="h-6 w-6 rounded object-cover" />
    : <span className="text-muted-foreground">—</span>);
  const cols: ColDef[] = [
    { headerName: "ID", field: "id", width: 64, cellClass: "font-mono text-muted-foreground" },
    { headerName: "사진", field: "photoUrl", width: 64, cellRenderer: photoCell, cellStyle: { display: "flex", alignItems: "center" }, sortable: false, filter: false },
    { headerName: "불사명", field: "name", editable: true, width: 170, minWidth: 130, cellClass: "font-bold" },
    { headerName: "참조 금액", field: "referenceAmount", editable: true, width: 116, cellClass: "font-mono", valueFormatter: (p) => (p.value ? Number(p.value).toLocaleString() : "—") },
    { headerName: "설명", field: "description", editable: true, flex: 1, minWidth: 200, valueFormatter: (p) => p.value ?? "—" },
    { headerName: "사용여부", field: "isActive", width: 90, editable: true },
    { headerName: "사용중", field: "usageCount", width: 92, sortable: true, cellClass: "font-mono", valueFormatter: (p) => (p.value ? `${p.value}건` : "—") },
  ];
  return (<>
    <PageTitle title="불사목록 마스터" route="/admin/items" desc="행 <b>더블클릭</b>으로 상세(사진·서비스타입 등 편집). ID는 자동발번, 금액은 참조용(결제 없음)."
      actions={<Button onClick={() => setCreating(true)}><Plus className="mr-1 h-4 w-4" />불사목록 추가</Button>} />
    <Ann show={ann}>{`ServiceTypeCode가 인물 슬롯 규칙(DM-20)을 구동. 사진은 URL/메타만(추후 오브젝트 스토리지 업로드 연동, P2).`}</Ann>
    <DataGrid title="불사목록" rowData={data ?? []} columnDefs={cols} height="calc(100dvh - 220px)"
      onCellEdit={(id, _f, _v, row) => { put(id, row as ItemRow).catch(() => reload()); }}
      onRowOpen={(r) => setDetail(r as ItemRow)} rowActions={[{ label: "삭제", tone: "vermilion", hidden: (r) => ((r as ItemRow).usageCount ?? 0) > 0, onClick: (r) => void del((r as ItemRow).id) }]} />
    <EditSheet open={!!detail} onClose={() => setDetail(null)} title="불사목록 상세" fields={ITEM_FIELDS}
      row={detail as unknown as Record<string, unknown> | null}
      onSave={async (f) => { if (detail) await put(detail.id, f as Partial<ItemRow>); }} />
    <EditSheet open={creating} onClose={() => setCreating(false)} title="불사목록 추가" desc="신규 불사목록 등록(불사명 필수)"
      fields={ITEM_FIELDS} row={creating ? {} : null} onSave={async (f) => { await create(f); }} />
  </>);
}

const CODE_GROUPS: { group: string; label: string }[] = [
  { group: "BA10", label: "BA10 · 소속" },
  { group: "SVC_TYPE", label: "SVC_TYPE · 서비스 타입" },
  { group: "AB10", label: "AB10 · 직위" },
  { group: "AA10", label: "AA10 · 직책" },
  { group: "AC10", label: "AC10 · 직군" },
  { group: "AD10", label: "AD10 · 직원구분" },
  { group: "AE10", label: "AE10 · 호칭구분" },
  { group: "AF10", label: "AF10 · 양/음력" },
  { group: "AL10", label: "AL10 · 사용자구분" },
];

function AdminCodes({ ann }: { ann: boolean }) {
  const [group, setGroup] = useState("BA10");
  const { data, reload } = useApiList<CommonCode>(`/common-codes?group=${group}&all=true`);
  const [detail, setDetail] = useState<CommonCode | null>(null);
  const [creating, setCreating] = useState(false);
  const del = async (id: string) => { if (!confirm("이 코드를 삭제하시겠습니까?")) return; await api.delete(`/common-codes/${id}`); reload(); };
  const put = async (id: string, r: Partial<CommonCode>) => { await api.patch(`/common-codes/${id}`, { code: r.code, name: r.name, shortName: r.shortName || null, sortOrder: r.sortOrder != null && r.sortOrder !== undefined ? Number(r.sortOrder) : undefined, isActive: r.isActive }); reload(); };
  const create = async (f: Record<string, unknown>) => { const r = f as Partial<CommonCode>; if (!r.code || !r.name) { alert("코드·명칭은 필수입니다."); return; } await api.post("/common-codes", { groupCode: group, code: r.code, name: r.name, shortName: r.shortName || undefined, sortOrder: r.sortOrder != null ? Number(r.sortOrder) : undefined }); reload(); };
  const CODE_FIELDS: EditField[] = [
    { key: "code", label: "코드", mono: true },
    { key: "name", label: "명칭" },
    { key: "shortName", label: "단축명" },
    { key: "sortOrder", label: "정렬순서", type: "number" },
    { key: "isActive", label: "사용여부", type: "bool" },
  ];
  const codeCols: ColDef[] = [
    { headerName: "ID", field: "id", width: 60, cellClass: "font-mono text-muted-foreground" },
    { headerName: "코드", field: "code", editable: true, width: 130, cellClass: "font-mono" },
    { headerName: "명칭", field: "name", editable: true, flex: 1, minWidth: 140 },
    { headerName: "단축명", field: "shortName", editable: true, width: 120, valueFormatter: (p) => p.value ?? "—" },
    { headerName: "사용", field: "isActive", width: 84, editable: true },
  ];
  return (<>
    <PageTitle title="공통코드" route="/admin/codes" desc="그룹/값 2단계. 매직 컨벤션(0000·^code^·4자) 폐기 → 사용자 편집 가능 데이터."
      actions={<Button onClick={() => setCreating(true)}><Plus className="mr-1 h-4 w-4" />코드 추가</Button>} />
    <Ann show={ann}>{`FR-MST-01·05 · (TenantId, GroupCode, Code) 유니크 · 사원 코드류(AA10·AB10…) 포함.`}</Ann>
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[220px_1fr]">
      <Card className="max-h-[520px] overflow-auto p-0">{CODE_GROUPS.map((g) => (<button key={g.group} onClick={() => setGroup(g.group)} className={`block w-full border-b px-3.5 py-3 text-left text-sm font-bold ${group === g.group ? "bg-accent text-celadon" : "hover:bg-secondary/30"}`}>{g.label}</button>))}</Card>
      <DataGrid title={`공통코드 · ${group}`} rowData={data ?? []} columnDefs={codeCols} height="calc(100dvh - 220px)"
        onCellEdit={(id, _f, _v, row) => { put(id, row as CommonCode).catch(() => reload()); }}
        onRowOpen={(r) => setDetail(r as CommonCode)} rowActions={[{ label: "삭제", tone: "vermilion", onClick: (r) => void del((r as CommonCode).id) }]} />
    </div>
    <EditSheet open={!!detail} onClose={() => setDetail(null)} title="공통코드 상세" fields={CODE_FIELDS}
      row={detail as unknown as Record<string, unknown> | null}
      onSave={async (f) => { if (detail) await put(detail.id, f as Partial<CommonCode>); }} />
    <EditSheet open={creating} onClose={() => setCreating(false)} title={`공통코드 추가 · ${group}`} desc="코드·명칭 필수"
      fields={CODE_FIELDS} row={creating ? {} : null} onSave={async (f) => { await create(f); }} />
  </>);
}

const ACTIONS: { key: string; label: string }[] = [
  { key: "read", label: "조회" }, { key: "create", label: "생성" }, { key: "update", label: "수정" },
  { key: "delete", label: "삭제" }, { key: "print", label: "인쇄" }, { key: "export", label: "엑셀" },
];

function AdminRoles({ ann }: { ann: boolean }) {
  const { data } = useApiList<RoleRow>("/admin/roles");
  const has = (perms: string[], action: string) => perms.some((p) => p.endsWith(`:${action}`));
  const rows = (data ?? []).map((r) => ({
    id: r.id, name: r.name, count: r.permissions.length,
    ...Object.fromEntries(ACTIONS.map((a) => [a.key, has(r.permissions, a.key) ? "●" : "○"])),
  }));
  const cols: ColDef[] = [
    { headerName: "역할", field: "name", flex: 1, minWidth: 140 },
    ...ACTIONS.map((a): ColDef => ({ headerName: a.label, field: a.key, width: 72, cellClass: (p) => (p.value === "●" ? "font-bold text-celadon" : "text-muted-foreground") })),
    { headerName: "권한 수", field: "count", width: 96, cellClass: "font-mono" },
  ];
  return (<>
    <PageTitle title="역할·권한 (RBAC)" route="/admin/roles" desc="역할→권한 매핑(서버 강제). 액션 플래그 6종은 자원×액션으로 일반화. (권한 부여는 서버 시드 기준 — 읽기 전용)" />
    <Ann show={ann}>{`AS-IS→TO-BE: 사용자×메뉴 1행 → 중앙집중 RBAC. NFR-SEC-04 · 모든 인가 서버사이드 강제.`}</Ann>
    <DataGrid title="역할·권한 매트릭스" rowData={rows} columnDefs={cols} />
  </>);
}

/* ============== 계정 관리 (FR-AUTH-13) ============== */
interface AccountRow { id: string; loginId: string; staffId: string | null; staffName: string | null; isActive: boolean; mustResetPassword: boolean; locked: boolean; lastLoginAt: string | null; roleIds: string[]; roleNames: string; activeSessions: number }

function AdminAccounts({ ann }: { ann: boolean }) {
  const { data, reload } = useApiList<AccountRow>("/admin/accounts");
  const { data: roles } = useApiList<RoleRow>("/admin/roles");
  const { data: staff } = useApiList<StaffRow>("/admin/staff");
  const [creating, setCreating] = useState(false);
  const [loginId, setLoginId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const create = async () => {
    if (!loginId.trim()) { alert("로그인 ID는 필수입니다."); return; }
    if (roleIds.length === 0) { alert("역할을 1개 이상 선택하세요."); return; }
    setBusy(true);
    try {
      const r = await api.post<{ tempPassword: string }>("/admin/accounts", { loginId: loginId.trim(), staffId: staffId || undefined, roleIds });
      alert(`계정 생성 완료\n\n로그인 ID: ${loginId.trim()}\n임시 비밀번호: ${r.tempPassword}\n\n대면/전화로 전달하세요. 최초 로그인 시 변경됩니다.`);
      setCreating(false); setLoginId(""); setStaffId(""); setRoleIds([]); reload();
    } catch (e) { alert(e instanceof ApiError ? e.message : "생성 실패"); } finally { setBusy(false); }
  };
  const toggleActive = async (a: AccountRow) => { await api.patch(`/admin/accounts/${a.id}`, { isActive: !a.isActive }); reload(); };
  const resetPw = async (a: AccountRow) => { if (!confirm(`${a.loginId} 계정의 비밀번호를 초기화할까요?`)) return; const r = await api.post<{ tempPassword: string }>(`/admin/accounts/${a.id}/reset-password`); alert(`임시 비밀번호: ${r.tempPassword}\n\n대면/전화로 전달하세요. 최초 로그인 시 변경됩니다.`); reload(); };
  const forceLogout = async (a: AccountRow) => { if (!confirm(`${a.loginId} 의 모든 세션을 종료(강제 로그아웃)할까요?`)) return; const r = await api.post<{ revoked: number }>(`/admin/accounts/${a.id}/logout-all`); alert(`${r.revoked}개 세션을 종료했습니다.`); reload(); };
  const cols: ColDef[] = [
    { headerName: "ID", field: "id", width: 60, cellClass: "font-mono text-muted-foreground" },
    { headerName: "로그인 ID", field: "loginId", width: 140, cellClass: "font-bold" },
    { headerName: "사원", field: "staffName", width: 110, valueFormatter: (p) => p.value ?? "—" },
    { headerName: "역할", field: "roleNames", flex: 1, minWidth: 150, valueFormatter: (p) => p.value || "—" },
    { headerName: "활성", field: "isActive", width: 72, cellDataType: "text", valueFormatter: (p) => (p.value ? "활성" : "비활성") },
    { headerName: "잠금", field: "locked", width: 68, cellDataType: "text", valueFormatter: (p) => (p.value ? "잠금" : "—") },
    { headerName: "비번변경", field: "mustResetPassword", width: 82, cellDataType: "text", valueFormatter: (p) => (p.value ? "필요" : "—") },
    { headerName: "세션", field: "activeSessions", width: 64, cellClass: "font-mono", valueFormatter: (p) => String(p.value ?? 0) },
    { headerName: "최근 로그인", field: "lastLoginAt", width: 158, cellClass: "font-mono", valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleString("ko-KR") : "—") },
  ];
  return (<>
    <PageTitle title="계정 관리" route="/admin/accounts" desc="관리자 발급 모델 — 사원/독립 계정 생성·역할 부여, 임시비번 1회 발급(최초 변경 강제), 활성/잠금·비번 초기화."
      actions={<Button onClick={() => setCreating(true)}><Plus className="mr-1 h-4 w-4" />계정 추가</Button>} />
    <Ann show={ann}>{`FR-AUTH-13: 관리자만 계정 생성 · 역할 1개+ 할당 · 임시비번 대면/전화 전달 · 최초 로그인 변경 강제 · 실패 5회 잠금.`}</Ann>
    <DataGrid title="계정" rowData={data ?? []} columnDefs={cols} height="calc(100dvh - 220px)"
      rowActions={[{ label: "비번초기화", onClick: (r) => void resetPw(r as AccountRow) }, { label: "세션종료", onClick: (r) => void forceLogout(r as AccountRow) }, { label: "활성토글", onClick: (r) => void toggleActive(r as AccountRow) }]} />
    <Sheet open={creating} onOpenChange={(o) => !o && setCreating(false)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader><SheetTitle>계정 추가</SheetTitle><SheetDescription>임시 비밀번호가 생성되어 1회 표시됩니다(대면/전화 전달).</SheetDescription></SheetHeader>
        <div className="mt-4 space-y-3.5">
          <div><Label className="mb-1.5 block text-xs">로그인 ID <span className="text-vermilion">*</span></Label><Input value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="영문/숫자" /></div>
          <div><Label className="mb-1.5 block text-xs">사원 연결 (선택)</Label>
            <Select value={staffId} onValueChange={setStaffId}><SelectTrigger><SelectValue placeholder="(독립 계정)" /></SelectTrigger><SelectContent>{(staff ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.staffNameKo}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="mb-1.5 block text-xs">역할 <span className="text-vermilion">*</span> (1개 이상)</Label>
            <div className="space-y-1.5 rounded-md border p-3">{(roles ?? []).map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={roleIds.includes(r.id)} onChange={() => setRoleIds((s) => s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id])} className="accent-[hsl(167_44%_33%)]" />
                {r.name}
              </label>
            ))}</div></div>
        </div>
        <div className="mt-6 flex justify-end gap-2 border-t pt-4">
          <Button variant="ghost" onClick={() => setCreating(false)}>취소</Button>
          <Button onClick={() => void create()} disabled={busy}>{busy ? "생성 중…" : "생성"}</Button>
        </div>
      </SheetContent>
    </Sheet>
  </>);
}

/* ============== 백업 관리 (backup:manage) ============== */
interface BackupMeta { name: string; bytes: number; at: string }
interface BackupStatus { last: BackupMeta | null; count: number; nextRunAt: string; fullHour: number; enabled: boolean; database: string; lastRestore: { file: string; at: string } | null; hostDir: string | null }
interface SchedulePref { enabled: boolean; fullHour: number }

const fmtBytes = (b: number): string =>
  b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : b >= 1e3 ? `${(b / 1e3).toFixed(0)} KB` : `${b} B`;
const fmtDateTime = (iso?: string | null): string =>
  iso ? (Number.isNaN(new Date(iso).getTime()) ? iso : new Date(iso).toLocaleString("ko-KR")) : "—";

function AdminBackup({ ann }: { ann: boolean }) {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [list, setList] = useState<BackupMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<BackupMeta | null>(null); // 복원 대상(확인 모달)
  const [confirmText, setConfirmText] = useState("");
  const [restoreList, setRestoreList] = useState<BackupMeta[]>([]); // 왼쪽에서 담은 복원 후보
  const [sched, setSched] = useState<SchedulePref | null>(null); // 편집용 스케줄 사본
  const [schedBusy, setSchedBusy] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null); // 업로드 복원 대상(첨부)
  const [uploadConfirm, setUploadConfirm] = useState("");

  const addRestore = (b: BackupMeta) => setRestoreList((s) => s.some((x) => x.name === b.name) ? s : [b, ...s]);
  const removeRestore = (b: BackupMeta) => setRestoreList((s) => s.filter((x) => x.name !== b.name));

  const load = async () => {
    try {
      const [s, l, sc] = await Promise.all([
        api.get<BackupStatus>("/admin/backup/status"),
        api.get<BackupMeta[]>("/admin/backup/list"),
        api.get<SchedulePref>("/admin/backup/schedule"),
      ]);
      setStatus(s); setList(l); setSched(sc);
    } catch (e) { alert(e instanceof ApiError ? e.message : "불러오기 실패"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const saveSchedule = async () => {
    if (!sched) return;
    setSchedBusy(true);
    try {
      const saved = await api.put<SchedulePref>("/admin/backup/schedule", { enabled: sched.enabled, fullHour: sched.fullHour });
      setSched(saved);
      alert(`자동 백업 스케줄 저장\n${saved.enabled ? `사용 · 매일 ${String(saved.fullHour).padStart(2, "0")}:00` : "사용 안 함"}`);
      await load();
    } catch (e) { alert(e instanceof ApiError ? e.message : "스케줄 저장 실패"); }
    finally { setSchedBusy(false); }
  };

  const runBackup = async () => {
    setBusy(true);
    try {
      const r = await api.post<BackupMeta>("/admin/backup/run");
      alert(`백업 완료\n${r.name}\n${fmtBytes(r.bytes)}`);
      await load();
    } catch (e) { alert(e instanceof ApiError ? e.message : "백업 실패"); }
    finally { setBusy(false); }
  };

  const download = (name: string) =>
    void downloadFile(`/admin/backup/download/${encodeURIComponent(name)}`, name)
      .catch((e) => alert(e instanceof ApiError ? e.message : "다운로드 실패"));

  const doRestore = async () => {
    if (!target) return;
    const restoredName = target.name;
    setBusy(true);
    try {
      const r = await api.post<{ restored: string; safetyBackup?: string }>("/admin/backup/restore", { file: restoredName, confirm: confirmText.trim() });
      setTarget(null); setConfirmText("");
      setRestoreList((s) => s.filter((x) => x.name !== restoredName)); // 복원한 항목은 목록에서 제거
      alert(`복원 완료\n${r.restored}\n복원 전 안전백업: ${r.safetyBackup ?? "-"}`);
      await load();
    } catch (e) { alert(e instanceof ApiError ? e.message : "복원 실패"); }
    finally { setBusy(false); }
  };

  const doUploadRestore = async () => {
    if (!uploadFile) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("confirm", uploadConfirm.trim()); // 게이트와 동일하게 trim — 공백으로 인한 서버 불일치 방지
      // apiFetch: FormData 그대로 전송 + 401 시 토큰 자동 갱신·재시도(raw fetch 는 갱신 없음).
      const data = await apiFetch<{ restored?: string; safetyBackup?: string }>(
        "/admin/backup/restore-upload",
        { method: "POST", body: fd },
      );
      setUploadFile(null); setUploadConfirm("");
      alert(`업로드 복원 완료\n${data?.restored ?? ""}\n복원 전 안전백업: ${data?.safetyBackup ?? "-"}`);
      await load();
    } catch (e) { alert(e instanceof ApiError ? e.message : "업로드 복원 실패"); }
    finally { setBusy(false); }
  };

  const canRestore = !!status && confirmText.trim() === status.database;
  const uploadCanRestore = !!status && !!uploadFile && uploadConfirm.trim() === status.database;
  const backupCols: ColDef[] = [
    { headerName: "파일", field: "name", flex: 1, minWidth: 200, cellClass: "font-mono text-[12px]" },
    { headerName: "생성 시각", field: "at", width: 158, valueFormatter: (p) => fmtDateTime(p.value as string) },
    { headerName: "크기", field: "bytes", width: 92, cellClass: "font-mono", valueFormatter: (p) => fmtBytes(p.value as number) },
  ];
  const restoreCols: ColDef[] = [
    { headerName: "복원 지점", field: "at", width: 158, valueFormatter: (p) => fmtDateTime(p.value as string) },
    { headerName: "파일", field: "name", flex: 1, minWidth: 200, cellClass: "font-mono text-[12px]" },
    { headerName: "크기", field: "bytes", width: 92, cellClass: "font-mono", valueFormatter: (p) => fmtBytes(p.value as number) },
  ];
  const gridH = "calc(100dvh - 430px)";

  return (<>
    <PageTitle title="백업 관리" route="/admin/backup"
      desc="DB 백업·복원 (관리자). 자동 스케줄 + 수동 백업/다운로드/복원. 복원 직전 자동 안전백업이 생성됩니다."
      actions={<div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-lg border border-celadon/40 bg-accent px-3 py-1.5 text-[12px] text-celadon" title="현재 DB 에 적용된(마지막으로 복원한) 백업본. 복원 이력이 없으면 라이브 데이터입니다.">
          <span className={`h-2 w-2 rounded-full ${status?.lastRestore ? "bg-gold" : "bg-celadon"}`} />
          <span className="font-bold">현재 적용</span>
          {status?.lastRestore
            ? <span className="font-mono">{status.lastRestore.file}<span className="ml-1 font-sans opacity-70">({fmtDateTime(status.lastRestore.at)} 복원)</span></span>
            : <span className="opacity-80">라이브 데이터 · 복원 이력 없음</span>}
          <span className="opacity-50">· DB {status?.database ?? "…"}</span>
        </span>
        <input ref={uploadRef} type="file" accept=".dump" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setUploadFile(f); setUploadConfirm(""); } e.target.value = ""; }} />
        <Button variant="outline" onClick={() => uploadRef.current?.click()} disabled={busy}>파일에서 복원</Button>
        <Button onClick={() => void runBackup()} disabled={busy}><Database className="mr-1 h-4 w-4" />{busy ? "처리 중…" : "지금 백업"}</Button>
      </div>} />
    <Ann show={ann}>{`backup:manage 권한. pg_dump 커스텀 포맷(.dump). 복원은 DB 이름 확인 입력이 일치해야 실행되는 파괴적 작업입니다.`}</Ann>
    <div className="mb-4 grid gap-3 sm:grid-cols-3">
      <Card><CardContent className="p-4"><div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">최근 백업</div><div className="mt-1 text-[13.5px]">{status?.last ? `${fmtDateTime(status.last.at)} · ${fmtBytes(status.last.bytes)}` : "없음"}</div></CardContent></Card>
      <Card><CardContent className="p-4"><div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">자동 백업 / 다음 실행</div><div className="mt-1 text-[13.5px]">{status ? (status.enabled ? `사용 · ${fmtDateTime(status.nextRunAt)}` : "사용 안 함") : "…"}</div></CardContent></Card>
      <Card><CardContent className="p-4"><div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">백업 저장 위치</div><div className="mt-1 break-all font-mono text-[12px]" title="infra\native\.env 의 BACKUP_DIR 로 변경">{status?.hostDir ?? "…"}</div></CardContent></Card>
    </div>
    {/* 자동 백업 스케줄 설정 (ps1 GUI ⑥/⑦ 이식) */}
    <Card className="mb-4">
      <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
        <div className="text-[13px] font-bold">자동 백업 스케줄</div>
        <label className="flex items-center gap-2 text-[13px]">
          <Switch checked={sched?.enabled ?? false} onCheckedChange={(v) => setSched((s) => s ? { ...s, enabled: v } : s)} disabled={!sched || schedBusy} />
          {sched?.enabled ? "사용" : "사용 안 함"}
        </label>
        <label className="flex items-center gap-2 text-[13px]">
          매일
          <Select value={String(sched?.fullHour ?? 3)} onValueChange={(v) => setSched((s) => s ? { ...s, fullHour: Number(v) } : s)}>
            <SelectTrigger className="w-[92px]" disabled={!sched || !sched.enabled || schedBusy}><SelectValue /></SelectTrigger>
            <SelectContent>{Array.from({ length: 24 }, (_, h) => <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>)}</SelectContent>
          </Select>
          시에 실행
        </label>
        <Button size="sm" className="ml-auto" onClick={() => void saveSchedule()} disabled={!sched || schedBusy}>{schedBusy ? "저장 중…" : "스케줄 저장"}</Button>
      </CardContent>
    </Card>
    <div className="grid gap-4 lg:grid-cols-2">
      <DataGrid title={`백업 목록 (${list.length})`} rowData={loading ? [] : list} columnDefs={backupCols} height={gridH}
        rowActions={[
          { label: "복원", onClick: (r) => addRestore(r as BackupMeta) },
          { label: "다운로드", onClick: (r) => download((r as BackupMeta).name) },
        ]} />
      <div>
        <DataGrid title={`복원 목록 (${restoreList.length})`} rowData={restoreList} columnDefs={restoreCols} height={gridH}
          rowActions={[
            { label: "복원 실행", onClick: (r) => { setTarget(r as BackupMeta); setConfirmText(""); } },
            { label: "빼기", onClick: (r) => removeRestore(r as BackupMeta) },
          ]} />
        {restoreList.length === 0 && <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">← 왼쪽 <b>백업 목록</b>에서 <b>복원</b>을 누르면 여기에 담깁니다. 담은 항목에서 <b>복원 실행</b>으로 되돌립니다.</p>}
      </div>
    </div>
    {target && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6" onClick={() => { if (!busy) { setTarget(null); setConfirmText(""); } }}>
        <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
          <CardContent className="p-5">
            <div className="text-[16px] font-bold text-vermilion">⚠ 복원 — 파괴적 작업</div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">현재 DB를 아래 백업 시점으로 덮어씁니다. 복원 직전 자동 안전백업이 만들어집니다.</p>
            <div className="mt-2 break-all rounded border bg-secondary px-2 py-1 font-mono text-[12px]">{target.name}</div>
            <Label className="mb-1.5 mt-3 block text-[12.5px]">확인을 위해 DB 이름 <b className="text-foreground">{status?.database}</b> 을(를) 입력하세요</Label>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={status?.database ?? ""} autoFocus />
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setTarget(null); setConfirmText(""); }} disabled={busy}>취소</Button>
              <Button onClick={() => void doRestore()} disabled={!canRestore || busy} className="bg-vermilion text-white hover:bg-vermilion/90">{busy ? "복원 중…" : "복원 실행"}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )}
    {uploadFile && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6" onClick={() => { if (!busy) { setUploadFile(null); setUploadConfirm(""); } }}>
        <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
          <CardContent className="p-5">
            <div className="text-[16px] font-bold text-vermilion">⚠ 파일 업로드 복원 — 파괴적 작업</div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">선택한 파일(내 PC)로 현재 DB를 덮어씁니다. 복원 직전 자동 안전백업이 만들어집니다.</p>
            <div className="mt-2 break-all rounded border bg-secondary px-2 py-1 font-mono text-[12px]">{uploadFile.name} · {fmtBytes(uploadFile.size)}</div>
            <Label className="mb-1.5 mt-3 block text-[12.5px]">확인을 위해 DB 이름 <b className="text-foreground">{status?.database}</b> 을(를) 입력하세요</Label>
            <Input value={uploadConfirm} onChange={(e) => setUploadConfirm(e.target.value)} placeholder={status?.database ?? ""} autoFocus />
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setUploadFile(null); setUploadConfirm(""); }} disabled={busy}>취소</Button>
              <Button onClick={() => void doUploadRestore()} disabled={!uploadCanRestore || busy} className="bg-vermilion text-white hover:bg-vermilion/90">{busy ? "복원 중…" : "업로드 복원 실행"}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )}
  </>);
}

/* ============== 초기 데이터 이관 (migration:run) ============== */
interface MigrationResult { ok: boolean; dryRun: boolean; log: string; summary: unknown; photos: unknown }

function AdminMigration({ ann }: { ann: boolean }) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("1433");
  const [user, setUser] = useState("");
  const [database, setDatabase] = useState("");
  const [password, setPassword] = useState("");
  const [includePhotos, setIncludePhotos] = useState(true);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<"" | "dry" | "run">("");
  const [result, setResult] = useState<MigrationResult | null>(null);

  // 업무 데이터 초기화 (data/import/reset · migration:run)
  type ResetResult = { before: Record<string, number>; after: Record<string, number> };
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetResult, setResetResult] = useState<ResetResult | null>(null);
  const doReset = async () => {
    if (resetConfirm !== "RESET") { alert("확인란에 RESET 을 입력하세요."); return; }
    if (!window.confirm("회원·불사 건·봉안일·상담·포교원장·사원을 모두 삭제합니다.\n(계정·권한·공통코드·불사목록 마스터는 보존)\n\n되돌릴 수 없습니다. 계속할까요?")) return;
    setResetBusy(true); setResetResult(null);
    try {
      const r = await api.post<ResetResult>("/data/import/reset");
      setResetResult(r); setResetConfirm("");
    } catch (e) { alert(e instanceof ApiError ? e.message : "초기화 실패"); }
    finally { setResetBusy(false); }
  };

  const call = async (dryRun: boolean) => {
    if (!password) { alert("MSSQL 비밀번호를 입력하세요."); return; }
    if (!dryRun && confirm !== "MIGRATE") { alert("실행하려면 확인란에 MIGRATE 를 입력하세요."); return; }
    if (!dryRun && !window.confirm("기존 업무 데이터를 레거시 데이터로 덮어씁니다. 계속할까요?")) return;
    setBusy(dryRun ? "dry" : "run"); setResult(null);
    try {
      const r = await api.post<MigrationResult>("/admin/migration/legacy", {
        host, port: Number(port) || 1433, user, database, password,
        dryRun, includePhotos, confirm: dryRun ? undefined : confirm,
      });
      setResult(r);
    } catch (e) { alert(e instanceof ApiError ? e.message : "이관 실패"); }
    finally { setBusy(""); }
  };

  return (<>
    <PageTitle title="초기 데이터 이관" route="/admin/migration"
      desc="레거시 MSSQL → 현재 DB 로 회원·불사·상담·봉안일·포교원장·불사목록·사원·계정을 즉시 이관합니다. 먼저 <b>미리보기(드라이런)</b>로 건수를 확인한 뒤 실행하세요."
      actions={<DatabaseZap className="h-6 w-6 text-celadon" />} />
    <Ann show={ann}>{`migration:run 권한. 레거시 숫자 PK 보존·FK 의존순 적재·건수 검증. 평문 비번 미반입(임시비번 최초변경 강제). 실행은 업무 테이블을 <b>덮어쓰는 파괴적 작업</b>이라 최초 세팅/컷오버 전용.`}</Ann>

    <Card className="mb-4 border-vermilion/40"><CardContent className="p-4">
      <div className="mb-1 text-[13px] font-bold text-vermilion">업무 데이터 초기화 (데모·리허설 정리 → 실데이터 적재 전)</div>
      <div className="mb-3 text-[12px] text-muted-foreground">
        <b>삭제</b>: 회원 · 불사 건 · 봉안일 · 상담 · 포교원장 · 사원 &nbsp;·&nbsp;
        <b>보존</b>: 계정 · 권한 · 메뉴 · 공통코드 · <b>불사목록(마스터)</b> · 감사로그.
        초기화 직후 <b>불사 엑셀 업로드</b>로 실데이터를 넣으면 됩니다.
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40"><Label className="mb-1.5 block text-xs">실행 확인 (RESET 입력)</Label><Input value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)} placeholder="RESET" /></div>
        <Button className="bg-vermilion text-white hover:bg-vermilion/90" onClick={() => void doReset()} disabled={resetBusy || resetConfirm !== "RESET"}>{resetBusy ? "초기화 중…" : "업무 데이터 초기화"}</Button>
      </div>
      {resetResult && (
        <div className="mt-3 rounded-md border bg-secondary/40 p-3 font-mono text-[11.5px]">
          ✔ 초기화 완료 —{" "}
          {(["member", "reg", "event", "counsel", "missionary", "staff"] as const)
            .map((k) => `${k}: ${resetResult.before[k] ?? 0}→${resetResult.after[k] ?? 0}`)
            .join(" · ")}
        </div>
      )}
    </CardContent></Card>

    <Card className="mb-4"><CardContent className="p-4">
      <div className="mb-3 text-[13px] font-bold">레거시 MSSQL 접속</div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44"><Label className="mb-1.5 block text-xs">호스트(IP)</Label><Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="<레거시-DB-IP>" /></div>
        <div className="w-24"><Label className="mb-1.5 block text-xs">포트</Label><Input value={port} onChange={(e) => setPort(e.target.value)} placeholder="1433" /></div>
        <div className="w-32"><Label className="mb-1.5 block text-xs">사용자</Label><Input value={user} onChange={(e) => setUser(e.target.value)} placeholder="sa" /></div>
        <div className="w-40"><Label className="mb-1.5 block text-xs">데이터베이스</Label><Input value={database} onChange={(e) => setDatabase(e.target.value)} placeholder="레거시 DB명" /></div>
        <div className="w-48"><Label className="mb-1.5 block text-xs">비밀번호</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <label className="mb-1 flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={includePhotos} onChange={(e) => setIncludePhotos(e.target.checked)} className="accent-[hsl(167_44%_33%)]" />
          사진(BLOB) → MinIO 이관
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3 border-t pt-4">
        <Button variant="outline" onClick={() => void call(true)} disabled={!!busy}>{busy === "dry" ? "확인 중…" : "① 미리보기(드라이런)"}</Button>
        <div className="w-40"><Label className="mb-1.5 block text-xs">실행 확인 (MIGRATE 입력)</Label><Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="MIGRATE" /></div>
        <Button className="bg-vermilion text-white hover:bg-vermilion/90" onClick={() => void call(false)} disabled={!!busy || confirm !== "MIGRATE"}>{busy === "run" ? "이관 중…" : "② 이관 실행"}</Button>
      </div>
    </CardContent></Card>

    {result && (
      <Card><CardContent className="p-4">
        <div className="mb-2 flex items-center gap-2 text-[13px] font-bold">
          {result.ok ? <span className="text-celadon">✔ {result.dryRun ? "드라이런 완료" : "이관 완료"}</span> : <span className="text-vermilion">✗ 실패/불일치</span>}
        </div>
        <pre className="max-h-[52vh] overflow-auto whitespace-pre-wrap rounded-md border bg-secondary/40 p-3 font-mono text-[11.5px] leading-relaxed">{result.log?.trim() || "(로그 없음)"}</pre>
      </CardContent></Card>
    )}
  </>);
}

/* ============== 소형 조회 훅(reload 지원) ============== */
function useApiList<T>(path: string): { data: T[] | null; reload: () => void } {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["list", path], queryFn: () => api.get<T[]>(path) });
  return { data: data ?? null, reload: () => { void qc.invalidateQueries({ queryKey: ["list", path] }); } };
}
