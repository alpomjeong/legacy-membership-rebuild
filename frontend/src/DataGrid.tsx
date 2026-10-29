/* eslint-disable @typescript-eslint/no-explicit-any -- AG Grid 래퍼: 행/값은 동적 타입 */
import { useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz } from "ag-grid-community";
import type { ColDef, GridApi, RowClickedEvent, CellValueChangedEvent } from "ag-grid-community";
import { Search, Rows2, Rows3, Download, RotateCcw } from "lucide-react";
import { useUiPrefs } from "@/lib/ui-prefs";

ModuleRegistry.registerModules([AllCommunityModule]);

const themeBase = {
  accentColor: "#2f7d6b",
  fontFamily: "Pretendard, sans-serif",
  fontSize: 12.5,
  headerFontSize: 11.5,
  headerFontWeight: 700,
  rowBorder: true,
  columnBorder: true,
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  cellHorizontalPadding: 10,
} as const;

// 밝은 한지/청자 톤
const templeTheme = themeQuartz.withParams({
  ...themeBase,
  backgroundColor: "#ffffff",
  foregroundColor: "#2a2420",
  borderColor: "rgba(38,32,25,0.10)",
  chromeBackgroundColor: "#f6f3ec",
  headerBackgroundColor: "#f1ede2",
  headerTextColor: "#5b5346",
  oddRowBackgroundColor: "rgba(241,237,226,0.30)",
  rowHoverColor: "rgba(47,125,107,0.06)",
  selectedRowBackgroundColor: "rgba(47,125,107,0.12)",
});

// 다크 톤
const templeThemeDark = themeQuartz.withParams({
  ...themeBase,
  accentColor: "#46b394",
  backgroundColor: "#1f1d1b",
  foregroundColor: "#e7e2d8",
  borderColor: "rgba(231,226,216,0.12)",
  chromeBackgroundColor: "#26231f",
  headerBackgroundColor: "#2b2722",
  headerTextColor: "#b3ac9c",
  oddRowBackgroundColor: "rgba(255,255,255,0.02)",
  rowHoverColor: "rgba(70,179,148,0.10)",
  selectedRowBackgroundColor: "rgba(70,179,148,0.18)",
});

// 2.0 모던 — 에어리(보더 제거)·라운드·여백↑·강조 헤더. 레거시와 확연히 구분.
const modernBase = {
  ...themeBase,
  fontSize: 13,
  headerFontSize: 11.5,
  rowBorder: false,
  columnBorder: false,
  wrapperBorderRadius: 14,
  cellHorizontalPadding: 16,
} as const;
const templeThemeModern = themeQuartz.withParams({
  ...modernBase,
  accentColor: "#2f7d6b",
  backgroundColor: "#ffffff",
  foregroundColor: "#23201c",
  borderColor: "rgba(38,32,25,0.05)",
  chromeBackgroundColor: "#f1f6f3",
  headerBackgroundColor: "#e9f2ee",
  headerTextColor: "#2f6b5e",
  oddRowBackgroundColor: "rgba(47,125,107,0.022)",
  rowHoverColor: "rgba(47,125,107,0.09)",
  selectedRowBackgroundColor: "rgba(47,125,107,0.15)",
});
const templeThemeModernDark = themeQuartz.withParams({
  ...modernBase,
  accentColor: "#46b394",
  backgroundColor: "#211e1b",
  foregroundColor: "#ece7dd",
  borderColor: "rgba(231,226,216,0.07)",
  chromeBackgroundColor: "#2a2620",
  headerBackgroundColor: "#2f3a34",
  headerTextColor: "#7fcab4",
  oddRowBackgroundColor: "rgba(255,255,255,0.015)",
  rowHoverColor: "rgba(70,179,148,0.12)",
  selectedRowBackgroundColor: "rgba(70,179,148,0.2)",
});

export interface RowAction {
  label: string;
  onClick: (row: any) => void;
  tone?: "celadon" | "vermilion";
  /** 행별로 이 액션을 숨김(예: 사용중인 항목의 삭제 버튼). true 면 렌더 안 함. */
  hidden?: (row: any) => boolean;
}

// 숫자 인식 정렬 — BigInt id 등 숫자 문자열은 수치로 비교(1,2,…,10), 그 외 한국어 문자열 비교.
const NUMERIC_RE = /^-?\d+$/;
function smartCompare(a: unknown, b: unknown): number {
  const an = typeof a === "number" ? a : (typeof a === "string" && NUMERIC_RE.test(a) ? Number(a) : null);
  const bn = typeof b === "number" ? b : (typeof b === "string" && NUMERIC_RE.test(b) ? Number(b) : null);
  if (an !== null && bn !== null) return an - bn;
  if (a == null || a === "") return b == null || b === "" ? 0 : -1;
  if (b == null || b === "") return 1;
  return String(a).localeCompare(String(b), "ko");
}

export function DataGrid({
  title, rowData, columnDefs, onRowClicked, onRowOpen, selectedId, height = "calc(100dvh - 230px)",
  onCellEdit, rowActions, rowHeight, headerHeight = 34, gridId, autoFit = true,
}: {
  title: string;
  rowData: any[];
  columnDefs: ColDef[];
  onRowClicked?: (e: RowClickedEvent) => void;
  /** 셀 단일클릭 시 상세 열기(편집 그리드는 더블클릭 편집과 분리: 더블클릭이 오면 취소). */
  onRowOpen?: (row: any) => void;
  selectedId?: number | string | null;
  /** 그리드 높이 — px(number) 또는 CSS(예: "calc(100dvh - 230px)"). 기본은 뷰포트 채움. */
  height?: number | string;
  /** 인라인 셀 편집 저장 콜백. 지정 시 셀 포커스/편집 활성화. */
  onCellEdit?: (id: string, field: string, value: unknown, row: any) => void;
  /** 행 우측 고정 액션(상세/삭제 등). */
  rowActions?: RowAction[];
  /** 고정 행 높이(적층형 셀 등). 지정 시 밀도 토글 무시. */
  rowHeight?: number;
  /** 헤더 높이(적층 헤더용). */
  headerHeight?: number;
  /** 컬럼 상태(순서·폭·정렬) 저장 키. 기본 title. 화면별 고유해야 함. */
  gridId?: string;
  /** 첫 로드 시 내용에 맞춰 자동 폭 조정(글자 클리핑 방지). 적층형 커스텀 셀 그리드는 false 권장. */
  autoFit?: boolean;
}) {
  const { dark, formMode } = useUiPrefs();
  const modern = formMode === "modal";
  const gridTheme = modern ? (dark ? templeThemeModernDark : templeThemeModern) : (dark ? templeThemeDark : templeTheme);
  const apiRef = useRef<GridApi | null>(null);
  const hadSavedRef = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const persistKey = `tm.gridcol.${gridId ?? title}`;
  const saveColState = () => {
    const api = apiRef.current; if (!api) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try { localStorage.setItem(persistKey, JSON.stringify(api.getColumnState())); } catch { /* */ }
    }, 300);
  };
  const [compact, setCompact] = useState(true);
  const canOpen = !!onRowOpen;
  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true, resizable: true, filter: true, minWidth: 78, comparator: smartCompare,
    editable: false, // 통일 UX: 그리드 인라인 편집 없음 — 수정은 상세 드로어에서(더블클릭=상세)
    floatingFilter: modern, // 2.0: 컬럼별 인라인 필터 행(실사용 차이)
  }), [modern]);

  const cols = useMemo<ColDef[]>(() => {
    // 컬럼 정의에 남아있는 editable:true 를 무력화(인라인 편집 폐지, 더블클릭=상세로 통일).
    const base = columnDefs.map((c) => (c.editable ? { ...c, editable: false } : c));
    if (!rowActions?.length) return base;
    const actionCol: ColDef = {
      headerName: "작업", field: "__actions", pinned: "right",
      width: 64 * rowActions.length + 16, sortable: false, filter: false, editable: false, resizable: false,
      cellRenderer: (p: any) => (
        <div className="flex h-full items-center gap-2">
          {rowActions.filter((a) => !a.hidden?.(p.data)).map((a) => (
            <button key={a.label} onClick={() => a.onClick(p.data)}
              className={`text-[11.5px] font-bold hover:underline ${a.tone === "vermilion" ? "text-vermilion" : "text-celadon"}`}>
              {a.label}
            </button>
          ))}
        </div>
      ),
    };
    return [...base, actionCol];
  }, [columnDefs, rowActions]);

  // flex 열 정보(콜아이디→flex) — autoSize 가 flex 를 폭 고정으로 덮어써 우측 빈칸이 생기던 문제 방지.
  const flexById = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cols) if (c.flex != null) m.set((c.colId ?? c.field ?? "") as string, c.flex);
    return m;
  }, [cols]);
  // flex 아닌 열만 내용 맞춤(autosize) → flex 열은 그대로 남은 폭을 채움(우측 빈칸 방지).
  //   flex 열까지 autosize 하면 폭이 고정돼 flex 가 죽으므로 대상에서 제외한다.
  const fitColumns = (api: GridApi): void => {
    const nonFlexKeys = (api.getColumns() ?? [])
      .filter((col) => col.getColDef().flex == null)
      .map((col) => col.getColId());
    api.autoSizeColumns(nonFlexKeys);
    const st = api.getColumnState();
    const capped = st.map((c) =>
      !flexById.has(c.colId) && c.width && c.width > 460 ? { ...c, width: 460 } : c,
    );
    if (capped.some((c, i) => c.width !== st[i].width)) api.applyColumnState({ state: capped });
  };

  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    api.redrawRows();
    if (selectedId != null) { const n = api.getRowNode(String(selectedId)); if (n) api.ensureNodeVisible(n); }
  }, [selectedId]);

  return (
    <div className="tm-card overflow-hidden rounded-md border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b bg-secondary/60 px-3 py-1.5">
        <span className="text-[11.5px] font-bold uppercase tracking-wide text-foreground/80">{title}</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-muted-foreground">{rowData.length} 행</span>
        {canOpen && <span className="rounded bg-accent px-1.5 py-0.5 text-[10.5px] font-bold text-celadon">행 더블클릭 = 상세</span>}
        <div className="ml-auto flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 rounded border bg-background px-2 py-1 text-xs text-muted-foreground">
            <Search className="h-3.5 w-3.5" />
            <input placeholder="그리드 검색…" className="w-28 bg-transparent text-foreground outline-none sm:w-36"
              onChange={(e) => apiRef.current?.setGridOption("quickFilterText", e.target.value)} />
          </div>
          <button onClick={() => setCompact(!compact)} title="행 높이" className="rounded border bg-background p-1.5 text-muted-foreground transition hover:text-foreground">
            {compact ? <Rows3 className="h-3.5 w-3.5" /> : <Rows2 className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => {
            try { localStorage.removeItem(persistKey); } catch { /* */ }
            hadSavedRef.current = false;
            const api = apiRef.current;
            if (api) {
              api.resetColumnState();
              if (autoFit) fitColumns(api);
              saveColState();
            }
          }} title="컬럼 초기화(폭·순서·정렬)" className="rounded border bg-background p-1.5 text-muted-foreground transition hover:text-foreground">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => apiRef.current?.exportDataAsCsv()} title="CSV 내보내기" className="rounded border bg-background p-1.5 text-muted-foreground transition hover:text-foreground">
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div style={{ height }}>
        <AgGridReact
          theme={gridTheme}
          rowData={rowData}
          columnDefs={cols}
          defaultColDef={defaultColDef}
          getRowId={(p) => String(p.data.id)}
          rowHeight={rowHeight ?? (compact ? 31 : 40)}
          headerHeight={headerHeight}
          suppressCellFocus
          onRowClicked={onRowClicked}
          onCellDoubleClicked={(e) => {
            // 통일 UX: 단일클릭은 선택만(onRowClicked), 상세는 더블클릭으로만 연다(전 그리드 동일).
            if (!onRowOpen || e.colDef.field === "__actions") return;
            onRowOpen(e.data);
          }}
          onCellValueChanged={(e: CellValueChangedEvent) => {
            const field = e.colDef.field;
            if (onCellEdit && field && field !== "__actions" && e.newValue !== e.oldValue) {
              onCellEdit(String(e.data.id), field, e.newValue, e.data);
            }
          }}
          onGridReady={(e) => {
            apiRef.current = e.api;
            try {
              const saved = localStorage.getItem(persistKey);
              if (saved) { e.api.applyColumnState({ state: JSON.parse(saved), applyOrder: true }); hadSavedRef.current = true; }
            } catch { /* */ }
            if (selectedId != null) { const n = e.api.getRowNode(String(selectedId)); if (n) e.api.ensureNodeVisible(n); }
          }}
          onFirstDataRendered={() => {
            const api = apiRef.current;
            if (!api || hadSavedRef.current || !autoFit) return;
            fitColumns(api); // 내용 맞춤 + 과폭 상한 + flex 열 복원(우측 빈칸 방지)
            saveColState();
          }}
          onColumnResized={(e) => { if (e.finished && e.source !== "api") saveColState(); }}
          onColumnMoved={(e) => { if (e.finished) saveColState(); }}
          onSortChanged={() => saveColState()}
          getRowStyle={(p: any) => {
            const s: any = {};
            if (p.data?.canceled) s.color = "#b23a26";
            if (selectedId != null && p.data?.id === selectedId) { s.background = "rgba(47,125,107,0.12)"; s.boxShadow = "inset 3px 0 0 #2f7d6b"; }
            return Object.keys(s).length ? s : undefined;
          }}
        />
      </div>
    </div>
  );
}
