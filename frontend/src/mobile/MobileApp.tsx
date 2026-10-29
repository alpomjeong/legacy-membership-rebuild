/* 모바일 전용 앱 — 데스크톱과 분리된 트리. 카드 리스트·가상 스크롤·풀스크린 상세·바텀시트 CRUD·풀투리프레시·리포트. */
import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Users, CalendarClock, MessageSquare, MoreHorizontal, Search, ChevronRight, ArrowLeft,
  Phone, MapPin, Moon, Sun, Lock, LogOut, X, Sparkles, FileText, Plus, Pencil,
  BarChart3, RefreshCw, MessageCircle,
} from "lucide-react";
import { useLive } from "@/lib/live";
import { api } from "@/lib/api";
import type { Member, Reg } from "@/data";
import type { Missionary, ServiceItem, Enshrinement } from "@/lib/types";
import type { FormMode } from "@/lib/ui-prefs";

type Tab = "members" | "enshrine" | "counsel" | "reports" | "more";

const initials = (name: string) => (name || "?").trim().slice(0, 2);
const day = (s?: string | null) => (s ? s.slice(0, 10) : "—");
const regStatus = (r: Reg) => (r.canceled ? { label: "취소", cls: "bg-vermilion/15 text-vermilion" } : r.cert ? { label: "증서", cls: "bg-accent text-celadon" } : { label: "신청", cls: "bg-secondary text-muted-foreground" });
const daysUntil = (iso: string) => { const d = new Date(iso); const now = new Date(); d.setHours(0, 0, 0, 0); now.setHours(0, 0, 0, 0); return Math.round((d.getTime() - now.getTime()) / 86400000); };

/* 풀투리프레시 — 스크롤 최상단에서 아래로 당기면 새로고침. */
function usePullToRefresh(ref: React.RefObject<HTMLDivElement | null>, onRefresh: () => void) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pv = useRef(0); const active = useRef(false); const startY = useRef(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const set = (v: number) => { pv.current = v; setPull(v); };
    const ts = (e: TouchEvent) => { if (el.scrollTop <= 0 && !refreshing) { startY.current = e.touches[0].clientY; active.current = true; } };
    const tm = (e: TouchEvent) => { if (!active.current) return; const d = e.touches[0].clientY - startY.current; if (d > 0 && el.scrollTop <= 0) set(Math.min(d * 0.5, 70)); else { active.current = false; set(0); } };
    const te = () => { if (!active.current) return; active.current = false; if (pv.current > 55) { setRefreshing(true); Promise.resolve(onRefresh()).finally(() => window.setTimeout(() => setRefreshing(false), 600)); } set(0); };
    el.addEventListener("touchstart", ts, { passive: true });
    el.addEventListener("touchmove", tm, { passive: true });
    el.addEventListener("touchend", te);
    return () => { el.removeEventListener("touchstart", ts); el.removeEventListener("touchmove", tm); el.removeEventListener("touchend", te); };
  }, [ref, onRefresh, refreshing]);
  return { pull, refreshing };
}
function PullIndicator({ pull, refreshing }: { pull: number; refreshing: boolean }) {
  if (pull <= 0 && !refreshing) return null;
  return <div className="flex items-center justify-center text-muted-foreground" style={{ height: refreshing ? 44 : pull }}><RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} style={{ transform: refreshing ? undefined : `rotate(${pull * 4}deg)` }} /></div>;
}

export function MobileApp({ dark, setDark, onLock, onLogout, formMode, setFormMode }: {
  dark: boolean; setDark: (f: (d: boolean) => boolean) => void;
  onLock: () => void; onLogout: () => void;
  formMode: FormMode; setFormMode: (m: FormMode) => void;
}) {
  const live = useLive(true);
  const [tab, setTab] = useState<Tab>("members");
  const [sel, setSel] = useState<Member | null>(null);
  // 상세 패널이 열려 있으면 최신 데이터로 동기화(편집/추가 후 반영).
  const selLive = sel ? live.members.find((m) => String(m.id) === String(sel.id)) ?? sel : null;

  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "members", label: "회원", icon: Users },
    { key: "enshrine", label: "봉안일", icon: CalendarClock },
    { key: "counsel", label: "상담", icon: MessageSquare },
    { key: "reports", label: "리포트", icon: BarChart3 },
    { key: "more", label: "더보기", icon: MoreHorizontal },
  ];

  return (
    <div className="flex h-[100dvh] flex-col bg-background text-foreground">
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "members" && <MembersTab members={live.members} loading={live.loading} error={live.error} reload={live.reload} missionaries={live.missionaries} onOpen={setSel} />}
        {tab === "enshrine" && <EnshrineTab items={live.enshrinements} reload={live.reload} />}
        {tab === "counsel" && <CounselTab members={live.members} reload={live.reload} />}
        {tab === "reports" && <ReportsTab members={live.members} enshrinements={live.enshrinements} reload={live.reload} />}
        {tab === "more" && <MoreTab dark={dark} setDark={setDark} onLock={onLock} onLogout={onLogout} formMode={formMode} setFormMode={setFormMode} count={live.members.length} />}
      </div>

      <nav className="flex flex-none items-stretch border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        {tabs.map((t) => {
          const on = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold transition ${on ? "text-celadon" : "text-muted-foreground"}`}>
              <t.icon className={`h-[21px] w-[21px] ${on ? "scale-110" : ""} transition`} />{t.label}
            </button>
          );
        })}
      </nav>

      {selLive && <MemberDetail member={selLive} items={live.items} enshrinements={live.enshrinements} missionaries={live.missionaries} reload={live.reload} onBack={() => setSel(null)} />}
    </div>
  );
}

/* ───────────── 공용 바텀시트/필드 ───────────── */
function BottomSheet({ title, onClose, onSave, saving, saveLabel = "저장", children }: { title: string; onClose: () => void; onSave?: () => void; saving?: boolean; saveLabel?: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div className="flex max-h-[92dvh] flex-col rounded-t-2xl border bg-card pb-[env(safe-area-inset-bottom)]" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/30" />
        <div className="flex items-center gap-2 px-4 py-3"><span className="flex-1 text-[16px] font-black">{title}</span><button onClick={onClose} className="rounded-full p-1.5 active:bg-secondary"><X className="h-5 w-5" /></button></div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3">{children}</div>
        {onSave && <div className="flex gap-2 border-t p-3"><button onClick={onClose} className="flex-1 rounded-xl border py-2.5 text-[15px] font-bold">취소</button><button onClick={onSave} disabled={saving} className="flex-[2] rounded-xl bg-gradient-to-r from-[hsl(167_44%_34%)] to-[hsl(167_46%_27%)] py-2.5 text-[15px] font-bold text-white disabled:opacity-60">{saving ? "저장 중…" : saveLabel}</button></div>}
      </div>
    </div>
  );
}
function Field({ label, children, req }: { label: string; children: React.ReactNode; req?: boolean }) {
  return <label className="block"><span className="mb-1 block text-[12.5px] font-bold text-muted-foreground">{label}{req && <span className="text-vermilion"> *</span>}</span>{children}</label>;
}
const inputCls = "w-full rounded-xl border bg-background px-3 py-2.5 text-[15px] outline-none focus:border-celadon";
function FAB({ onClick, label }: { onClick: () => void; label: string }) {
  return <button onClick={onClick} className="fixed bottom-[calc(env(safe-area-inset-bottom)+64px)] right-4 z-40 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[hsl(167_44%_34%)] to-[hsl(167_46%_27%)] px-4 py-3 text-[14px] font-bold text-white shadow-lg active:scale-95"><Plus className="h-5 w-5" />{label}</button>;
}

/* ───────────── 회원 탭 ───────────── */
function MembersTab({ members, loading, error, reload, missionaries, onOpen }: {
  members: Member[]; loading: boolean; error: string | null; reload: () => void; missionaries: Missionary[]; onOpen: (m: Member) => void;
}) {
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const lc = q.trim().toLowerCase();
  const list = useMemo(() => (lc ? members.filter((m) => m.name.toLowerCase().includes(lc) || (m.missionary ?? "").toLowerCase().includes(lc) || (m.phone ?? "").includes(q)) : members), [members, lc, q]);
  const parentRef = useRef<HTMLDivElement>(null);
  const { pull, refreshing } = usePullToRefresh(parentRef, reload);
  const vir = useVirtualizer({ count: list.length, getScrollElement: () => parentRef.current, estimateSize: () => 74, overscan: 10 });

  return (
    <>
      <div ref={parentRef} className="h-full overflow-y-auto">
        <PullIndicator pull={pull} refreshing={refreshing} />
        <div className="px-4 pb-2 pt-3">
          <h1 className="text-[26px] font-black tracking-tight">회원</h1>
          <p className="text-xs text-muted-foreground">{members.length.toLocaleString()}명 · 이름·포교원장·전화 검색</p>
        </div>
        <div className="sticky top-0 z-10 bg-background/90 px-4 pb-2 pt-1 backdrop-blur">
          <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="회원 검색" className="w-full bg-transparent text-[15px] outline-none" />
            {q && <X className="h-4 w-4 text-muted-foreground" onClick={() => setQ("")} />}
          </div>
        </div>
        {error && !members.length && <div className="mx-4 mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">데이터 오류: {error}<button onClick={reload} className="ml-2 font-bold underline">다시</button></div>}
        {loading && !members.length && <div className="p-6 text-center text-sm text-muted-foreground">불러오는 중…</div>}
        <div style={{ height: vir.getTotalSize(), position: "relative" }}>
          {vir.getVirtualItems().map((vi) => {
            const m = list[vi.index];
            return (
              <button key={m.id} onClick={() => onOpen(m)}
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: vi.size, transform: `translateY(${vi.start}px)` }}
                className="flex items-center gap-3 border-b px-4 text-left active:bg-secondary">
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-accent text-[13px] font-black text-celadon">{initials(m.name)}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold">{m.name}{m.missionary ? <span className="font-normal text-muted-foreground"> · {m.missionary}</span> : ""}</div>
                  <div className="truncate text-[12.5px] text-muted-foreground">{m.phone || "전화번호 없음"}</div>
                </div>
                {m.regs.length > 0 && <span className="flex-none rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-celadon">불사 {m.regs.length}</span>}
                <ChevronRight className="h-4 w-4 flex-none text-muted-foreground" />
              </button>
            );
          })}
        </div>
        {!loading && list.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">검색 결과 없음</div>}
        <div className="h-20" />
      </div>
      <FAB onClick={() => setAdding(true)} label="회원" />
      {adding && <MemberForm missionaries={missionaries} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload(); }} />}
    </>
  );
}

/* 회원 등록/편집 */
function MemberForm({ member, missionaries, onClose, onSaved }: { member?: Member; missionaries: Missionary[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(member?.name ?? "");
  const [missionaryId, setMissionaryId] = useState("");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [addr, setAddr] = useState(member?.addr ?? "");
  const [memo, setMemo] = useState(member?.memo ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (!name.trim()) { setErr("이름은 필수입니다."); return; }
    setBusy(true); setErr(null);
    const payload = { memberName: name.trim(), phone: phone || undefined, address: addr || undefined, missionaryId: missionaryId || undefined, memo: memo || undefined };
    try { if (member) await api.put(`/members/${member.id}`, payload); else await api.post("/members", payload); onSaved(); }
    catch (e) { setErr(e instanceof Error ? e.message : "저장 실패"); } finally { setBusy(false); }
  };
  return (
    <BottomSheet title={member ? "회원 수정" : "회원 등록"} onClose={onClose} onSave={save} saving={busy}>
      {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      <Field label="이름" req><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="회원 이름" /></Field>
      <Field label="포교원장"><select value={missionaryId} onChange={(e) => setMissionaryId(e.target.value)} className={inputCls}><option value="">(선택 안 함)</option>{missionaries.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
      <Field label="전화번호"><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="010-0000-0000" inputMode="tel" /></Field>
      <Field label="주소"><input value={addr} onChange={(e) => setAddr(e.target.value)} className={inputCls} /></Field>
      <Field label="메모"><textarea value={memo} onChange={(e) => setMemo(e.target.value)} className={`${inputCls} min-h-[72px]`} /></Field>
    </BottomSheet>
  );
}

/* ───────────── 회원 상세 ───────────── */
function MemberDetail({ member, items, enshrinements, missionaries, reload, onBack }: {
  member: Member; items: ServiceItem[]; enshrinements: Enshrinement[]; missionaries: Missionary[]; reload: () => void; onBack: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [addReg, setAddReg] = useState(false);
  const [addCns, setAddCns] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex flex-none items-center gap-1 border-b px-2 py-2.5">
        <button onClick={onBack} className="rounded-full p-2 active:bg-secondary"><ArrowLeft className="h-5 w-5" /></button>
        <div className="min-w-0 flex-1"><div className="truncate text-[17px] font-bold">{member.name}{member.missionary ? ` · ${member.missionary}` : ""}</div></div>
        <button onClick={() => setEditing(true)} className="rounded-full p-2 text-celadon active:bg-secondary"><Pencil className="h-5 w-5" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-10">
        <div className="flex flex-col items-center gap-1 border-b px-4 py-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-xl font-black text-celadon">{initials(member.name)}</div>
          <div className="mt-2 text-lg font-black">{member.name}</div>
          {member.missionary && <div className="text-sm text-muted-foreground">포교원장 {member.missionary}</div>}
          {member.phone && (
            <div className="mt-3 flex gap-2">
              <a href={`tel:${member.phone}`} className="flex items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] font-bold text-celadon active:bg-secondary"><Phone className="h-4 w-4" /> 전화</a>
              <a href={`sms:${member.phone}`} className="flex items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] font-bold text-celadon active:bg-secondary"><MessageCircle className="h-4 w-4" /> 문자</a>
            </div>
          )}
        </div>
        <div className="divide-y">
          <InfoRow icon={Phone} label="전화" value={member.phone || "—"} />
          <InfoRow icon={MapPin} label="주소" value={member.addr || "—"} />
          {member.memo && <InfoRow icon={FileText} label="메모" value={member.memo} />}
        </div>

        <Section title="불사 신청" count={member.regs.length} action={<AddBtn onClick={() => setAddReg(true)} />}>
          {member.regs.length === 0 ? <Empty>신청 내역 없음</Empty> : member.regs.map((r) => {
            const st = regStatus(r);
            return (
              <div key={r.id} className="rounded-xl border bg-card p-3">
                <div className="flex items-center gap-2"><span className="flex-1 truncate text-[14px] font-bold">{r.item}</span><span className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span></div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground">
                  <span>신청일 {day(r.date)}</span>{r.altar && <span>단번호 {r.altar}</span>}{r.event && <span>봉안일 {day(r.event)}</span>}{r.bokjunja && <span>복전자 {r.bokjunja}</span>}
                </div>
              </div>
            );
          })}
        </Section>

        <Section title="상담" count={member.counsels.length} action={<AddBtn onClick={() => setAddCns(true)} />}>
          {member.counsels.length === 0 ? <Empty>상담 내역 없음</Empty> : member.counsels.map((c, i) => (
            <div key={i} className="rounded-xl border bg-card p-3"><div className="text-[12px] font-bold text-muted-foreground">{day(c.date)}</div><div className="mt-0.5 text-[14px]">{c.desc}</div></div>
          ))}
        </Section>
      </div>
      {editing && <MemberForm member={member} missionaries={missionaries} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />}
      {addReg && <RegForm member={member} items={items} enshrinements={enshrinements} onClose={() => setAddReg(false)} onSaved={() => { setAddReg(false); reload(); }} />}
      {addCns && <CounselForm member={member} onClose={() => setAddCns(false)} onSaved={() => { setAddCns(false); reload(); }} />}
    </div>
  );
}
function AddBtn({ onClick }: { onClick: () => void }) { return <button onClick={onClick} className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[12px] font-bold text-celadon active:scale-95"><Plus className="h-3.5 w-3.5" />추가</button>; }

/* 불사 신청 추가(간이) */
function RegForm({ member, items, enshrinements, onClose, onSaved }: { member: Member; items: ServiceItem[]; enshrinements: Enshrinement[]; onClose: () => void; onSaved: () => void }) {
  const [itemId, setItemId] = useState("");
  const [date, setDate] = useState("");
  const [eventId, setEventId] = useState("");
  const [altar, setAltar] = useState("");
  const [donation, setDonation] = useState("");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (!itemId) { setErr("불사목록을 선택하세요."); return; }
    setBusy(true); setErr(null);
    const payload: Record<string, unknown> = {
      memberId: String(member.id), buddhistServiceItemId: itemId,
      registrationDate: date ? new Date(date).toISOString() : undefined,
      enshrinementEventId: eventId || undefined, altarNumber: altar || undefined,
      donationAmount: donation ? Number(donation) : undefined, memo: memo || undefined,
      isCanceled: false, isCertificateIssued: false,
    };
    try { await api.post("/buddhist-services", payload); onSaved(); }
    catch (e) { setErr(e instanceof Error ? e.message : "저장 실패"); } finally { setBusy(false); }
  };
  return (
    <BottomSheet title="불사 신청" onClose={onClose} onSave={save} saving={busy}>
      {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      <Field label="불사목록" req><select value={itemId} onChange={(e) => setItemId(e.target.value)} className={inputCls}><option value="">선택</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></Field>
      <Field label="신청일"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></Field>
      <Field label="봉안일"><select value={eventId} onChange={(e) => setEventId(e.target.value)} className={inputCls}><option value="">미지정</option>{enshrinements.map((f) => <option key={f.id} value={f.id}>{f.label ?? day(f.eventDateSolar)}</option>)}</select></Field>
      <Field label="단번호"><input value={altar} onChange={(e) => setAltar(e.target.value)} className={inputCls} placeholder="예: 2좌-0546" /></Field>
      <Field label="시주 금액"><input value={donation} onChange={(e) => setDonation(e.target.value)} className={inputCls} inputMode="numeric" placeholder="0" /></Field>
      <Field label="메모"><textarea value={memo} onChange={(e) => setMemo(e.target.value)} className={`${inputCls} min-h-[60px]`} /></Field>
      <p className="text-[11.5px] text-muted-foreground">복전자·영가 등 상세 슬롯은 데스크톱에서 편집하세요.</p>
    </BottomSheet>
  );
}

/* 상담 추가 */
function CounselForm({ member, onClose, onSaved }: { member: Member; onClose: () => void; onSaved: () => void }) {
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (!content.trim()) { setErr("상담 내용을 입력하세요."); return; }
    setBusy(true); setErr(null);
    try { await api.post("/counsels", { memberId: String(member.id), counseledAt: new Date().toISOString(), content: content.trim() }); onSaved(); }
    catch (e) { setErr(e instanceof Error ? e.message : "저장 실패"); } finally { setBusy(false); }
  };
  return (
    <BottomSheet title={`상담 — ${member.name}`} onClose={onClose} onSave={save} saving={busy}>
      {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      <Field label="상담 내용" req><textarea autoFocus value={content} onChange={(e) => setContent(e.target.value)} className={`${inputCls} min-h-[140px]`} placeholder="상담 내용을 입력하세요" /></Field>
    </BottomSheet>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return <div className="flex items-center gap-3 px-4 py-3"><Icon className="h-4 w-4 flex-none text-muted-foreground" /><div className="w-12 flex-none text-[12px] text-muted-foreground">{label}</div><div className="min-w-0 flex-1 break-words text-[14px]">{value}</div></div>;
}
function Section({ title, count, action, children }: { title: string; count: number; action?: React.ReactNode; children: React.ReactNode }) {
  return <div className="px-4 pt-5"><div className="mb-2 flex items-center gap-2"><h2 className="text-[15px] font-black">{title}</h2><span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-muted-foreground">{count}</span><div className="ml-auto">{action}</div></div><div className="space-y-2">{children}</div></div>;
}
function Empty({ children }: { children: React.ReactNode }) { return <div className="rounded-xl border border-dashed py-6 text-center text-[13px] text-muted-foreground">{children}</div>; }

/* ───────────── 봉안일 (임박 강조) ───────────── */
function EnshrineTab({ items, reload }: { items: Enshrinement[]; reload: () => void }) {
  const [adding, setAdding] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { pull, refreshing } = usePullToRefresh(ref, reload);
  const { upcoming, past } = useMemo(() => {
    const up: Enshrinement[] = []; const pa: Enshrinement[] = [];
    for (const e of items) { (daysUntil(e.eventDateSolar) >= 0 ? up : pa).push(e); }
    up.sort((a, b) => a.eventDateSolar.localeCompare(b.eventDateSolar));
    pa.sort((a, b) => b.eventDateSolar.localeCompare(a.eventDateSolar));
    return { upcoming: up, past: pa };
  }, [items]);
  const card = (e: Enshrinement) => {
    const d = daysUntil(e.eventDateSolar);
    const soon = d >= 0 && d <= 30;
    return (
      <div key={e.id} className={`flex items-center gap-3 rounded-xl border bg-card p-3 ${soon ? "border-celadon/50" : ""}`}>
        <div className="flex h-11 w-11 flex-none flex-col items-center justify-center rounded-lg bg-accent text-celadon"><CalendarClock className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1"><div className="text-[14px] font-bold">{day(e.eventDateSolar)}</div><div className="truncate text-[12.5px] text-muted-foreground">{e.label || "라벨 없음"}</div></div>
        {d >= 0 && <span className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-bold ${soon ? "bg-vermilion/15 text-vermilion" : "bg-secondary text-muted-foreground"}`}>{d === 0 ? "오늘" : `D-${d}`}</span>}
      </div>
    );
  };
  return (
    <>
      <div ref={ref} className="h-full overflow-y-auto">
        <PullIndicator pull={pull} refreshing={refreshing} />
        <div className="px-4 pb-3 pt-3"><h1 className="text-[26px] font-black tracking-tight">봉안일·기일</h1><p className="text-xs text-muted-foreground">{items.length.toLocaleString()}건 · 임박순</p></div>
        <div className="space-y-2 px-4 pb-24">
          {upcoming.length > 0 && <div className="pt-1 text-[12px] font-black text-celadon">다가오는 일정 {upcoming.length}</div>}
          {upcoming.map(card)}
          {past.length > 0 && <div className="pt-3 text-[12px] font-black text-muted-foreground">지난 일정</div>}
          {past.map(card)}
        </div>
      </div>
      <FAB onClick={() => setAdding(true)} label="봉안일" />
      {adding && <EnshrineForm onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload(); }} />}
    </>
  );
}
function EnshrineForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState("");
  const [label, setLabel] = useState("");
  const [remark, setRemark] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (!date) { setErr("일자를 선택하세요."); return; }
    setBusy(true); setErr(null);
    try { await api.post("/enshrinements", { eventDateSolar: new Date(date).toISOString(), label: label || undefined, remark: remark || undefined }); onSaved(); }
    catch (e) { setErr(e instanceof Error ? e.message : "저장 실패"); } finally { setBusy(false); }
  };
  return (
    <BottomSheet title="봉안일 등록" onClose={onClose} onSave={save} saving={busy}>
      {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      <Field label="일자" req><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></Field>
      <Field label="표기/라벨"><input value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls} /></Field>
      <Field label="비고"><textarea value={remark} onChange={(e) => setRemark(e.target.value)} className={`${inputCls} min-h-[60px]`} /></Field>
    </BottomSheet>
  );
}

/* ───────────── 상담 탭 ───────────── */
function CounselTab({ members, reload }: { members: Member[]; reload: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { pull, refreshing } = usePullToRefresh(ref, reload);
  const list = useMemo(() => members.flatMap((m) => m.counsels.map((c) => ({ ...c, name: m.name, missionary: m.missionary }))).sort((a, b) => (b.date || "").localeCompare(a.date || "")), [members]);
  return (
    <div ref={ref} className="h-full overflow-y-auto">
      <PullIndicator pull={pull} refreshing={refreshing} />
      <div className="px-4 pb-3 pt-3"><h1 className="text-[26px] font-black tracking-tight">상담</h1><p className="text-xs text-muted-foreground">{list.length.toLocaleString()}건 · 회원 상세에서 추가</p></div>
      <div className="space-y-2 px-4 pb-24">
        {list.length === 0 ? <Empty>상담 내역 없음</Empty> : list.map((c, i) => (
          <div key={i} className="rounded-xl border bg-card p-3"><div className="flex items-center gap-2"><span className="flex-1 truncate text-[14px] font-bold">{c.name}{c.missionary ? ` · ${c.missionary}` : ""}</span><span className="text-[12px] text-muted-foreground">{day(c.date)}</span></div><div className="mt-1 text-[13.5px] text-muted-foreground">{c.desc}</div></div>
        ))}
      </div>
    </div>
  );
}

/* ───────────── 리포트 탭 ───────────── */
function ReportsTab({ members, enshrinements, reload }: { members: Member[]; enshrinements: Enshrinement[]; reload: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { pull, refreshing } = usePullToRefresh(ref, reload);
  const stats = useMemo(() => {
    let regs = 0, cert = 0, canceled = 0, cns = 0;
    const byType: Record<string, number> = {}; const byMiss: Record<string, number> = {};
    for (const m of members) {
      cns += m.counsels.length;
      if (m.missionary) byMiss[m.missionary] = (byMiss[m.missionary] ?? 0) + 1;
      for (const r of m.regs) { regs++; if (r.canceled) canceled++; else if (r.cert) cert++; const t = r.type || "미설정"; byType[t] = (byType[t] ?? 0) + 1; }
    }
    const soon = enshrinements.filter((e) => { const d = daysUntil(e.eventDateSolar); return d >= 0 && d <= 30; }).length;
    return { regs, cert, canceled, applied: regs - cert - canceled, cns, soon, byType: Object.entries(byType).sort((a, b) => b[1] - a[1]), byMiss: Object.entries(byMiss).sort((a, b) => b[1] - a[1]).slice(0, 8) };
  }, [members, enshrinements]);
  const tiles: [string, string][] = [["회원", members.length.toLocaleString()], ["불사 신청", stats.regs.toLocaleString()], ["증서 발급", stats.cert.toLocaleString()], ["상담", stats.cns.toLocaleString()], ["30일 내 봉안일", String(stats.soon)], ["취소", stats.canceled.toLocaleString()]];
  const max1 = Math.max(1, ...stats.byType.map((x) => x[1])); const max2 = Math.max(1, ...stats.byMiss.map((x) => x[1]));
  return (
    <div ref={ref} className="h-full overflow-y-auto">
      <PullIndicator pull={pull} refreshing={refreshing} />
      <div className="px-4 pb-3 pt-3"><h1 className="text-[26px] font-black tracking-tight">리포트</h1><p className="text-xs text-muted-foreground">실시간 현황</p></div>
      <div className="grid grid-cols-2 gap-2 px-4">
        {tiles.map(([k, v]) => (
          <div key={k} className="rounded-2xl border bg-gradient-to-br from-accent/50 to-card p-3.5"><div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{k}</div><div className="mt-1 text-[26px] font-black tabular-nums">{v}</div></div>
        ))}
      </div>
      <div className="px-4 pt-5"><h2 className="mb-2 text-[15px] font-black">서비스 타입별</h2><div className="space-y-2 rounded-2xl border bg-card p-3">
        {stats.byType.map(([k, v]) => (<div key={k} className="flex items-center gap-2 text-[12.5px]"><span className="w-28 flex-none truncate text-muted-foreground">{k}</span><div className="h-3 flex-1 overflow-hidden rounded bg-secondary"><div className="h-full rounded bg-[hsl(167_44%_33%)]" style={{ width: `${(v / max1) * 100}%` }} /></div><span className="w-12 flex-none text-right font-mono font-bold">{v}</span></div>))}
      </div></div>
      <div className="px-4 pb-24 pt-5"><h2 className="mb-2 text-[15px] font-black">포교원장별 회원 (상위 8)</h2><div className="space-y-2 rounded-2xl border bg-card p-3">
        {stats.byMiss.length === 0 ? <Empty>데이터 없음</Empty> : stats.byMiss.map(([k, v]) => (<div key={k} className="flex items-center gap-2 text-[12.5px]"><span className="w-28 flex-none truncate text-muted-foreground">{k}</span><div className="h-3 flex-1 overflow-hidden rounded bg-secondary"><div className="h-full rounded bg-[hsl(40_45%_55%)]" style={{ width: `${(v / max2) * 100}%` }} /></div><span className="w-12 flex-none text-right font-mono font-bold">{v}</span></div>))}
      </div></div>
    </div>
  );
}

/* ───────────── 더보기 ───────────── */
function MoreTab({ dark, setDark, onLock, onLogout, formMode, setFormMode, count }: {
  dark: boolean; setDark: (f: (d: boolean) => boolean) => void; onLock: () => void; onLogout: () => void;
  formMode: FormMode; setFormMode: (m: FormMode) => void; count: number;
}) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 pb-3 pt-3"><h1 className="text-[26px] font-black tracking-tight">더보기</h1><p className="text-xs text-muted-foreground">불사 · 회원관리 · 회원 {count.toLocaleString()}명</p></div>
      <div className="space-y-2 px-4 pb-24">
        <button onClick={() => setDark((d) => !d)} className="flex w-full items-center gap-3 rounded-xl border bg-card p-3.5 active:bg-secondary">
          {dark ? <Moon className="h-5 w-5 text-celadon" /> : <Sun className="h-5 w-5 text-celadon" />}<span className="flex-1 text-left text-[15px] font-bold">다크 모드</span><span className={`text-sm font-bold ${dark ? "text-celadon" : "text-muted-foreground"}`}>{dark ? "ON" : "OFF"}</span>
        </button>
        <div className="rounded-xl border bg-card p-3.5">
          <div className="mb-2 flex items-center gap-2 text-[15px] font-bold"><Sparkles className="h-5 w-5 text-celadon" /> 인터페이스</div>
          <div className="flex gap-2">{([["drawer", "레거시"], ["modal", "2.0"]] as [FormMode, string][]).map(([m, l]) => (<button key={m} onClick={() => setFormMode(m)} className={`flex-1 rounded-lg border py-2 text-sm font-bold ${formMode === m ? "border-celadon bg-accent text-celadon" : "text-muted-foreground"}`}>{l}</button>))}</div>
        </div>
        <button onClick={onLock} className="flex w-full items-center gap-3 rounded-xl border bg-card p-3.5 active:bg-secondary"><Lock className="h-5 w-5 text-celadon" /><span className="flex-1 text-left text-[15px] font-bold">화면 잠금</span><ChevronRight className="h-4 w-4 text-muted-foreground" /></button>
        <button onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl border bg-card p-3.5 text-vermilion active:bg-secondary"><LogOut className="h-5 w-5" /><span className="flex-1 text-left text-[15px] font-bold">로그아웃</span></button>
      </div>
    </div>
  );
}
