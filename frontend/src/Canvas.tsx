/* 2.0 캔버스 — 여러 개의 이름있는 캔버스. 빈 화면에 메뉴(탭)를 패널로 던져 자유 배치(드래그/리사이즈). localStorage 저장. */
import { useEffect, useMemo, useRef, useState } from "react";
import GridLayout, { WidthProvider, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { Plus, X, LayoutGrid, Pencil, List, FolderOpen } from "lucide-react";
import { api } from "@/lib/api";

const Grid = WidthProvider(GridLayout);
const KEY = "tm.canvas.v3";

export interface CanvasCatalogItem { key: string; label: string; icon: React.ComponentType<{ className?: string }> }

interface CanvasState { id: string; name: string; active: string[]; layout: Layout[]; lite: boolean }
interface Store { canvases: CanvasState[]; currentId: string }

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
const blank = (name: string): CanvasState => ({ id: uid(), name, active: [], layout: [], lite: true });

function load(): Store {
  try { const j = JSON.parse(localStorage.getItem(KEY) ?? "null"); if (j?.canvases?.length) return j; } catch { /* */ }
  // v2 단일 캔버스 → v3 마이그레이션
  let first: CanvasState | null = null;
  try { const old = JSON.parse(localStorage.getItem("tm.canvas.v2") ?? "null"); if (Array.isArray(old?.active)) first = { id: uid(), name: "캔버스 1", active: old.active, layout: old.layout ?? [], lite: !!old.lite }; } catch { /* */ }
  const c = first ?? blank("캔버스 1");
  return { canvases: [c], currentId: c.id };
}

export function Canvas({ catalog, renderPanel, dataKey }: {
  catalog: CanvasCatalogItem[];
  renderPanel: (key: string) => React.ReactNode;
  /** 데이터 갱신 시에만 변하는 식별자(예: members 참조) — 패널 재렌더를 드래그가 아닌 데이터 변경에만 트리거. */
  dataKey?: unknown;
}) {
  const [store, setStore] = useState<Store>(load);
  const [addOpen, setAddOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const serverTimer = useRef<number | null>(null);
  const addRef = useRef<(k: string) => void>(() => {});
  const renderPanelRef = useRef(renderPanel);
  renderPanelRef.current = renderPanel;
  const removeRef = useRef<(k: string) => void>(() => {});
  const cur = store.canvases.find((c) => c.id === store.currentId) ?? store.canvases[0];

  // 좌측 메뉴 포인터 드래그 → 드롭 시 App 이 발행하는 커스텀 이벤트 수신.
  useEffect(() => {
    const h = (e: Event) => { const k = (e as CustomEvent<{ key: string }>).detail?.key; if (k) addRef.current(k); };
    window.addEventListener("tm:add-panel", h);
    return () => window.removeEventListener("tm:add-panel", h);
  }, []);

  // 계정 단위 서버 동기화 — 어느 기기/세션에서 로그인해도 동일 캔버스 복원.
  useEffect(() => {
    let cancelled = false;
    api.get<{ value: Store | null }>("/me/settings/canvas")
      .then((r) => {
        if (cancelled) return;
        if (r?.value?.canvases?.length) {
          setStore(r.value);
          try { localStorage.setItem(KEY, JSON.stringify(r.value)); } catch { /* */ }
        } else {
          // 서버에 없으면 로컬(기존 작업)을 서버로 올림(최초 마이그레이션)
          void api.put("/me/settings/canvas", { value: store }).catch(() => { /* 오프라인 무시 */ });
        }
      })
      .catch(() => { /* 미인증/오프라인 → 로컬 유지 */ });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (s: Store) => {
    setStore(s);
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* */ }
    if (serverTimer.current) window.clearTimeout(serverTimer.current);
    serverTimer.current = window.setTimeout(() => { void api.put("/me/settings/canvas", { value: s }).catch(() => { /* 오프라인 무시 */ }); }, 600);
  };
  const updateCur = (patch: Partial<CanvasState>) => save({ ...store, canvases: store.canvases.map((c) => (c.id === cur.id ? { ...c, ...patch } : c)) });

  const add = (key: string, at?: { x: number; y: number }) => {
    if (!catalog.some((c) => c.key === key) || cur.active.includes(key)) return;
    updateCur({
      active: [...cur.active, key],
      layout: [...cur.layout, { i: key, x: at ? at.x : (cur.active.length * 6) % 12, y: at ? at.y : Infinity, w: 6, h: 7 }],
    });
    setAddOpen(false);
  };
  addRef.current = add;
  const remove = (key: string) => updateCur({ active: cur.active.filter((k) => k !== key), layout: cur.layout.filter((x) => x.i !== key) });
  removeRef.current = remove;
  const onLayout = (l: Layout[]) => updateCur({ layout: l });
  const toggleLite = () => updateCur({ lite: !cur.lite });
  const clearAll = () => updateCur({ active: [], layout: [] });

  const newCanvas = () => { const c = blank(`캔버스 ${store.canvases.length + 1}`); save({ canvases: [...store.canvases, c], currentId: c.id }); };
  const switchTo = (id: string) => save({ ...store, currentId: id });
  const rename = (id: string) => { const c = store.canvases.find((x) => x.id === id); const n = window.prompt("캔버스 이름", c?.name ?? ""); if (n && n.trim()) save({ ...store, canvases: store.canvases.map((x) => (x.id === id ? { ...x, name: n.trim() } : x)) }); };
  const delCanvas = (id: string) => {
    if (!window.confirm("이 캔버스를 삭제할까요?")) return;
    const rest = store.canvases.filter((c) => c.id !== id);
    const next = rest.length ? rest : [blank("캔버스 1")];
    save({ canvases: next, currentId: id === store.currentId ? next[0].id : store.currentId });
  };

  const available = catalog.filter((c) => !cur.active.includes(c.key));

  // 패널 메모이즈 — 의존성은 패널 구성(active)·경량·캔버스·데이터(dataKey)뿐. 레이아웃(드래그/리사이즈)
  // 변경 시엔 재계산하지 않아 무거운 임베드 화면이 재렌더되지 않음(RGL이 CSS transform으로만 이동).
  const panelEls = useMemo(
    () => cur.active.map((key) => {
      const item = catalog.find((c) => c.key === key);
      const Icon = item?.icon ?? LayoutGrid;
      return (
        <div key={key} className="tm-card flex flex-col overflow-hidden rounded-2xl border bg-card">
          <div className="wdrag flex flex-none cursor-move items-center gap-2 border-b bg-secondary/50 px-3 py-2">
            <Icon className="h-3.5 w-3.5 opacity-70" /><span className="text-[12px] font-bold">{item?.label ?? key}</span>
            <button onMouseDown={(e) => e.stopPropagation()} onClick={() => removeRef.current(key)} className="tm-nodrag ml-auto rounded p-0.5 text-muted-foreground hover:text-vermilion" title="패널 제거"><X className="h-3.5 w-3.5" /></button>
          </div>
          <div className={`min-h-0 flex-1 overflow-auto p-3 ${cur.lite ? "tm-lite" : ""}`}>{renderPanelRef.current(key)}</div>
        </div>
      );
    }),
    [cur.active, cur.lite, cur.id, catalog, dataKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div>
      {/* 캔버스 탭 바 */}
      <div className="mb-3 flex flex-wrap items-center gap-1 border-b pb-2">
        {store.canvases.map((c) => {
          const on = c.id === cur.id;
          return (
            <div key={c.id} className={`group flex items-center gap-1 rounded-t-lg border-b-2 px-3 py-1.5 text-sm font-bold transition ${on ? "border-celadon text-celadon" : "border-transparent text-muted-foreground hover:bg-secondary"}`}>
              <button onClick={() => switchTo(c.id)} onDoubleClick={() => rename(c.id)} title="더블클릭하여 이름 변경">{c.name}</button>
              {on && <Pencil onClick={() => rename(c.id)} className="h-3 w-3 cursor-pointer opacity-50 hover:opacity-100" />}
              <X onClick={() => delCanvas(c.id)} className="h-3.5 w-3.5 cursor-pointer opacity-40 transition hover:text-vermilion hover:opacity-100" aria-label="이 캔버스 삭제" />
            </div>
          );
        })}
        <button onClick={newCanvas} className="ml-1 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-bold text-muted-foreground hover:bg-secondary" title="새 캔버스"><Plus className="h-4 w-4" />새 캔버스</button>
      </div>

      {/* 현재 캔버스 컨트롤 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div><h2 className="font-serif text-xl font-black">{cur.name}</h2><p className="text-xs text-muted-foreground">좌측 메뉴를 끌어다 놓거나 "패널 추가" — 드래그·리사이즈로 자유 배치, 자동 저장</p></div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setListOpen(true)} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-bold text-muted-foreground transition hover:bg-secondary" title="저장된 캔버스 목록 관리"><List className="h-4 w-4" />목록</button>
          <button onClick={toggleLite} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-bold transition ${cur.lite ? "border-celadon bg-accent text-celadon" : "text-muted-foreground hover:bg-secondary"}`} title="패널 안 제목/설명 숨겨 그리드만">경량 {cur.lite ? "ON" : "OFF"}</button>
          <div className="relative">
            <button onClick={() => setAddOpen((o) => !o)} className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[hsl(167_44%_34%)] to-[hsl(167_46%_27%)] px-3 py-1.5 text-sm font-bold text-white shadow-md"><Plus className="h-4 w-4" />패널 추가</button>
            {addOpen && (<>
              <div className="fixed inset-0 z-30" onClick={() => setAddOpen(false)} />
              <div className="absolute right-0 z-40 mt-1.5 max-h-[60vh] w-56 overflow-y-auto rounded-xl border bg-card p-1.5 shadow-xl">
                {available.length === 0 && <div className="px-3 py-3 text-center text-xs text-muted-foreground">모든 메뉴 추가됨</div>}
                {available.map((c) => (
                  <button key={c.key} onClick={() => add(c.key)} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary"><c.icon className="h-4 w-4 opacity-70" />{c.label}</button>
                ))}
              </div>
            </>)}
          </div>
          {cur.active.length > 0 && <button onClick={clearAll} className="rounded-lg border px-3 py-1.5 text-sm font-bold text-muted-foreground hover:bg-secondary">모두 비우기</button>}
        </div>
      </div>

      {/* 캔버스 영역 전체가 드롭존 — 좌측 메뉴 포인터 드래그를 어디에 놓아도 패널 추가. */}
      <div data-canvas-dropzone className="rounded-2xl transition">
        {cur.active.length === 0 ? (
          <div className="flex h-[55vh] flex-col items-center justify-center rounded-2xl border-2 border-dashed text-muted-foreground">
            <LayoutGrid className="mb-3 h-12 w-12 opacity-30" />
            <p className="text-lg font-bold">빈 캔버스</p>
            <p className="mt-1 text-sm">좌측 메뉴를 <b className="text-celadon">여기로 드래그</b>하거나 우측 상단 <b className="text-celadon">패널 추가</b></p>
          </div>
        ) : (
          <Grid key={cur.id} className="layout" layout={cur.layout} cols={12} rowHeight={84} margin={[14, 14]} draggableHandle=".wdrag" draggableCancel=".tm-nodrag" isBounded onLayoutChange={onLayout} resizeHandles={["se"]}>
            {panelEls}
          </Grid>
        )}
      </div>

      {/* 캔버스 목록 관리 — 저장된 캔버스를 언제든 열기/이름변경/삭제 (계정 단위 서버 동기화) */}
      {listOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6" onClick={() => setListOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-2">
              <List className="h-5 w-5 text-celadon" />
              <h3 className="text-[16px] font-bold">캔버스 목록</h3>
              <span className="text-xs text-muted-foreground">저장 {store.canvases.length}개 · 계정 동기화</span>
              <button onClick={() => { newCanvas(); setListOpen(false); }} className="ml-auto flex items-center gap-1 rounded-lg bg-gradient-to-r from-[hsl(167_44%_34%)] to-[hsl(167_46%_27%)] px-2.5 py-1.5 text-sm font-bold text-white"><Plus className="h-4 w-4" />새 캔버스</button>
            </div>
            <div className="max-h-[60vh] space-y-1.5 overflow-y-auto">
              {store.canvases.map((c) => {
                const on = c.id === cur.id;
                return (
                  <div key={c.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${on ? "border-celadon bg-accent" : "hover:bg-secondary"}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate text-sm font-bold">{c.name}{on && <span className="rounded bg-celadon/15 px-1.5 py-0.5 text-[10px] text-celadon">현재</span>}</div>
                      <div className="text-[11px] text-muted-foreground">{c.active.length} 패널</div>
                    </div>
                    <button onClick={() => { switchTo(c.id); setListOpen(false); }} className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold text-celadon hover:bg-secondary"><FolderOpen className="h-3.5 w-3.5" />열기</button>
                    <button onClick={() => rename(c.id)} className="rounded-lg border p-1.5 text-muted-foreground hover:bg-secondary" aria-label="이름 변경"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => delCanvas(c.id)} className="rounded-lg border p-1.5 text-muted-foreground transition hover:border-vermilion/40 hover:text-vermilion" aria-label="삭제"><X className="h-3.5 w-3.5" /></button>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setListOpen(false)} className="rounded-lg px-3 py-1.5 text-sm font-bold text-muted-foreground hover:bg-secondary">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
