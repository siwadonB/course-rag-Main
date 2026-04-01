import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

const API = import.meta.env.VITE_API_URL;

type StoreState =
  | { hasStore: false }
  | { hasStore: true; storeName: string; displayName?: string };

type DocRow = {
  name: string;
  displayName: string;
  state: string;
  mimeType?: string;
  sizeBytes?: string;
  createTime?: string;
  metadata?: Record<string, any>;
};

type Lang = "th" | "en";
type View = "home" | "library";

function cx(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function prettyBytes(n?: string) {
  const x = Number(n || 0);
  if (!x) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let v = x;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function fmtDate(iso?: string, lang: Lang = "th") {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat(lang === "th" ? "th-TH" : "en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
}

function useLocalStorageState<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {}
  }, [key, v]);

  return [v, setV] as const;
}

function badgeKindClass(kind?: string) {
  if (kind === "study") {
    return "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/20";
  }
  if (kind === "exam") {
    return "bg-indigo-500/10 text-indigo-200 ring-1 ring-indigo-500/20";
  }
  return "bg-slate-500/10 text-slate-200 ring-1 ring-slate-500/20";
}

function badgeStateClass(state?: string) {
  const s = (state || "").toLowerCase();
  if (s.includes("active") || s.includes("ready")) {
    return "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/20";
  }
  if (s.includes("processing") || s.includes("index")) {
    return "bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/20";
  }
  if (s.includes("failed") || s.includes("error")) {
    return "bg-rose-500/10 text-rose-200 ring-1 ring-rose-500/20";
  }
  return "bg-slate-500/10 text-slate-200 ring-1 ring-slate-500/20";
}

const I18N = {
  appName: { th: "StudyMate", en: "StudyMate" },
  tagline: {
    th: "อัปโหลดเอกสาร → สรุปไว → ทำนายแนวข้อสอบแบบมีอ้างอิง",
    en: "Upload → Summarize → Predict exam trends with citations",
  },
  home: { th: "หน้าหลัก", en: "Home" },
  library: { th: "คลังเอกสาร", en: "Library" },
  refresh: { th: "รีเฟรช", en: "Refresh" },
  advanced: { th: "Advanced", en: "Advanced" },
  close: { th: "ปิด", en: "Close" },

  welcomeTitle: { th: "พร้อมเริ่มอ่านหนังสือแบบมีผู้ช่วย", en: "Ready to study with an assistant" },
  welcomeDesc: {
    th: "เริ่มจากสร้างคลังเอกสาร 1 ครั้ง จากนั้นอัปโหลดเอกสารเรียน/ข้อสอบเก่าได้เลย",
    en: "Create a workspace once, then upload study docs and past exams.",
  },
  createWorkspace: { th: "สร้างคลังเอกสาร", en: "Create workspace" },
  workspaceReady: { th: "คลังพร้อมใช้งาน", en: "Workspace ready" },

  uploadStudyTitle: { th: "เอกสารเรียน", en: "Study documents" },
  uploadStudyDesc: { th: "ชีท/สไลด์/สรุป/คู่มือ", en: "Slides, notes, manuals" },
  uploadExamTitle: { th: "ข้อสอบเก่า", en: "Past exams" },
  uploadExamDesc: { th: "ใช้จับแนว/หัวข้อที่ออกบ่อย", en: "Detect trends & recurring topics" },
  dropHere: { th: "ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์", en: "Drop files here, or click to browse" },
  supportedHint: {
    th: "รองรับไฟล์ตามที่ backend รองรับ (เช่น PDF/DOCX/TXT)",
    en: "Supported formats depend on your backend (e.g., PDF/DOCX/TXT).",
  },

  summarize: { th: "สรุปเนื้อหา", en: "Summarize" },
  predict: { th: "ทำนายแนวข้อสอบ", en: "Predict exam trends" },
  questions: { th: "จำนวนข้อ", en: "Questions" },
  copy: { th: "คัดลอก", en: "Copy" },

  search: { th: "ค้นหาไฟล์...", en: "Search files..." },
  all: { th: "ทั้งหมด", en: "All" },
  study: { th: "เรียน", en: "Study" },
  exam: { th: "ข้อสอบ", en: "Exam" },
  file: { th: "ไฟล์", en: "File" },
  type: { th: "ประเภท", en: "Type" },
  status: { th: "สถานะ", en: "Status" },
  size: { th: "ขนาด", en: "Size" },
  date: { th: "วันที่", en: "Date" },
  actions: { th: "จัดการ", en: "Actions" },
  delete: { th: "ลบ", en: "Delete" },
  empty: { th: "ยังไม่มีเอกสารในคลัง", en: "No documents yet" },

  confirmTitle: { th: "ยืนยันการลบ", en: "Confirm deletion" },
  confirmDesc: { th: "ต้องการลบเอกสารนี้ออกจากคลังใช่ไหม?", en: "Remove this document from the library?" },
  cancel: { th: "ยกเลิก", en: "Cancel" },
  confirm: { th: "ลบเลย", en: "Delete" },

  sReady: { th: "พร้อมใช้งาน", en: "Ready" },
  sCreating: { th: "กำลังสร้างคลัง…", en: "Creating workspace…" },
  sUploading: { th: "กำลังอัปโหลด…", en: "Uploading…" },
  sIndexing: { th: "กำลังทำดัชนี…", en: "Indexing…" },
  sSummarizing: { th: "กำลังสรุป…", en: "Summarizing…" },
  sPredicting: { th: "กำลังทำนาย…", en: "Predicting…" },
  sDone: { th: "เสร็จแล้ว ✅", en: "Done ✅" },
  sError: { th: "มีบางอย่างผิดพลาด", en: "Something went wrong" },

  aApi: { th: "Backend API", en: "Backend API" },
  aStore: { th: "Store (internal)", en: "Store (internal)" },
  aRawError: { th: "Raw error", en: "Raw error" },
  aGrounding: { th: "Grounding metadata", en: "Grounding metadata" },
} as const;

type I18nKey = keyof typeof I18N;

function Icon({
  name,
  className,
}: {
  name: "spark" | "upload" | "doc" | "trash" | "search";
  className?: string;
}) {
  const cls = cx("h-5 w-5", className);

  if (name === "spark") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2l1.6 6.2L20 12l-6.4 3.8L12 22l-1.6-6.2L4 12l6.4-3.8L12 2z"
          className="fill-white/80"
        />
      </svg>
    );
  }

  if (name === "upload") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none">
        <path d="M12 16V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path
          d="M7 9l5-5 5 5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M4 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "doc") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none">
        <path
          d="M7 3h7l3 3v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M14 3v4a2 2 0 0 0 2 2h4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === "trash") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none">
        <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M10 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path
          d="M6 7l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none">
      <path d="M11 19a8 8 0 1 1 5.3-14.1A8 8 0 0 1 11 19z" stroke="currentColor" strokeWidth="2" />
      <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1", className)}>
      {children}
    </span>
  );
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-white/10 bg-white/[0.035] shadow-[0_20px_60px_-40px_rgba(0,0,0,0.8)]",
        className
      )}
    >
      {children}
    </div>
  );
}

function Button({
  children,
  onClick,
  variant = "neutral",
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "neutral" | "primary" | "danger" | "indigo";
  disabled?: boolean;
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50 disabled:cursor-not-allowed";

  const v =
    variant === "primary"
      ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
      : variant === "indigo"
      ? "bg-indigo-400 text-slate-950 hover:bg-indigo-300"
      : variant === "danger"
      ? "bg-rose-500/10 text-rose-200 ring-1 ring-rose-500/20 hover:bg-rose-500/15"
      : "bg-white/6 text-slate-100 ring-1 ring-white/10 hover:bg-white/10";

  return (
    <button className={cx(base, v, className)} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function Toast({
  items,
  onDismiss,
}: {
  items: Array<{ id: string; title: string; kind: "ok" | "warn" | "err" }>;
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="fixed right-4 top-4 z-[60] space-y-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={cx(
            "w-[min(420px,92vw)] rounded-2xl border bg-slate-950/70 p-3 backdrop-blur-md shadow-xl",
            t.kind === "ok"
              ? "border-emerald-500/20"
              : t.kind === "err"
              ? "border-rose-500/25"
              : "border-amber-500/25"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm font-medium text-slate-100">{t.title}</div>
            <button
              className="rounded-lg px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
              onClick={() => onDismiss(t.id)}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Modal({
  open,
  title,
  desc,
  onCancel,
  onConfirm,
  confirmText,
  cancelText,
  danger,
}: {
  open: boolean;
  title: string;
  desc: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmText: string;
  cancelText: string;
  danger?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
      <div className="w-[min(520px,95vw)] rounded-2xl border border-white/10 bg-slate-950 p-5 shadow-2xl">
        <div className="text-base font-semibold text-slate-100">{title}</div>
        <div className="mt-2 text-sm text-slate-400">{desc}</div>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onCancel} variant="neutral">
            {cancelText}
          </Button>
          <Button onClick={onConfirm} variant={danger ? "danger" : "primary"} className="px-5">
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Drawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      {open && <div className="fixed inset-0 z-[55] bg-black/50" onClick={onClose} />}
      <div
        className={cx(
          "fixed right-0 top-0 z-[56] h-full w-[min(520px,92vw)] transform border-l border-white/10 bg-slate-950/90 backdrop-blur-xl transition duration-200",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="text-sm font-semibold text-slate-100">{title}</div>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-xs text-slate-300 hover:bg-white/10"
          >
            ✕
          </button>
        </div>
        <div className="h-[calc(100%-56px)] overflow-auto px-5 py-4">{children}</div>
      </div>
    </>
  );
}

function Dropzone({
  disabled,
  title,
  desc,
  onFile,
}: {
  disabled?: boolean;
  title: string;
  desc: string;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [drag, setDrag] = useState(false);

  return (
    <div
      className={cx(
        "group relative rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition",
        drag ? "ring-2 ring-white/20" : "hover:bg-white/[0.035]",
        disabled && "opacity-60 pointer-events-none"
      )}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDrag(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDrag(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDrag(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-white/5 p-2 ring-1 ring-white/10">
          <Icon name="upload" className="text-slate-200" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-100">{title}</div>
          <div className="mt-1 text-xs text-slate-400">{desc}</div>
          <div className="mt-3 text-xs text-slate-300">
            <span className="rounded-lg bg-white/5 px-2 py-1 ring-1 ring-white/10">Drag & drop</span>{" "}
            <span className="text-slate-500">หรือคลิกเพื่อเลือกไฟล์</span>
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}

export default function App() {
  const [lang, setLang] = useLocalStorageState<Lang>("rag_lang", "th");
  const t = (k: I18nKey) => I18N[k][lang];

  const [view, setView] = useState<View>("home");
  const [store, setStore] = useState<StoreState>({ hasStore: false });
  const [docs, setDocs] = useState<DocRow[]>([]);

  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string>(t("sReady"));

  const [rawError, setRawError] = useState<string>("");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [toasts, setToasts] = useState<Array<{ id: string; title: string; kind: "ok" | "warn" | "err" }>>([]);
  const toast = (title: string, kind: "ok" | "warn" | "err" = "ok") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((s) => [{ id, title, kind }, ...s].slice(0, 3));
    setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), 2800);
  };

  const [summary, setSummary] = useState("");
  const [summaryMeta, setSummaryMeta] = useState<any>(null);
  const [n, setN] = useState(10);
  const [pred, setPred] = useState<any>(null);
  const [predRaw, setPredRaw] = useState("");
  const [predMeta, setPredMeta] = useState<any>(null);

  const [kindFilter, setKindFilter] = useState<"all" | "study" | "exam">("all");
  const [q, setQ] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ name: string; displayName: string } | null>(null);

  const ready = store.hasStore;

  async function apiGet(url: string) {
    const r = await fetch(url);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new Error(JSON.stringify(j || { error: `HTTP ${r.status}` }));
    }
    return j;
  }

  async function apiPost(url: string, body?: any) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new Error(JSON.stringify(j || { error: `HTTP ${r.status}` }));
    }
    return j;
  }

  async function loadStore() {
    const j = await apiGet(`${API}/api/store`);
    setStore(j);
    return j as StoreState;
  }

  async function loadDocs() {
    const j = await apiGet(`${API}/api/documents`);
    setDocs(j.documents || []);
    return j.documents || [];
  }

  useEffect(() => {
    (async () => {
      try {
        setBusyLabel(t("sReady"));
        await loadStore();
      } catch (e: any) {
        const raw = String(e?.message || e);
        setRawError(raw);
        toast(t("sError"), "err");
      }
    })();
  }, [lang]);

  useEffect(() => {
    if (store.hasStore) {
      loadDocs().catch(() => {});
    }
  }, [store.hasStore]);

  const studyCount = useMemo(
    () => docs.filter((d) => d.metadata?.kind === "study").length,
    [docs]
  );

  const examCount = useMemo(
    () => docs.filter((d) => d.metadata?.kind === "exam").length,
    [docs]
  );

  const filteredDocs = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return docs
      .slice()
      .sort((a, b) => new Date(b.createTime || 0).getTime() - new Date(a.createTime || 0).getTime())
      .filter((d) => {
        const kindOk = kindFilter === "all" ? true : d.metadata?.kind === kindFilter;
        const qOk = !qq ? true : (d.displayName || "").toLowerCase().includes(qq);
        return kindOk && qOk;
      });
  }, [docs, kindFilter, q]);

  async function runGuard<T>(label: string, fn: () => Promise<T>) {
    try {
      setBusy(true);
      setBusyLabel(label);
      setRawError("");
      const out = await fn();
      return out;
    } catch (e: any) {
      const raw = String(e?.message || e);
      setRawError(raw);
      toast(t("sError"), "err");
      throw e;
    } finally {
      setBusy(false);
      setBusyLabel(t("sReady"));
    }
  }

  async function createStore() {
    await runGuard(t("sCreating"), async () => {
      await apiPost(`${API}/api/store/create`, { displayName: "course-one" });
      await loadStore();
      await loadDocs();
      toast(t("workspaceReady"), "ok");
    });
  }

  async function pollOperation(op: any, max = 60) {
    let cur = op;
    for (let i = 0; i < max; i++) {
      if (cur?.done) return cur;
      await new Promise((r) => setTimeout(r, 1500));
      const j = await apiPost(`${API}/api/operation/get`, { operation: cur });
      cur = j.operation;
      setBusyLabel(`${t("sIndexing")} (${i + 1})`);
    }
    return cur;
  }

  async function upload(kind: "study" | "exam", file: File) {
    await runGuard(t("sUploading"), async () => {
      const fd = new FormData();
      fd.append("file", file);

      const r = await fetch(`${API}/api/upload?kind=${kind}`, {
        method: "POST",
        body: fd,
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(JSON.stringify(j || { error: `HTTP ${r.status}` }));
      }

      setBusyLabel(t("sIndexing"));
      await pollOperation(j.operation, 60);

      await loadDocs();
      toast(lang === "th" ? `อัปโหลดสำเร็จ: ${file.name}` : `Uploaded: ${file.name}`, "ok");
      setView("library");
    });
  }

  async function refreshAll() {
    await runGuard("Refreshing…", async () => {
      await loadStore();
      if ((await loadStore()).hasStore) {
        await loadDocs();
      }
      toast(t("sDone"), "ok");
    });
  }

  function askDelete(d: DocRow) {
    setDeleteTarget({ name: d.name, displayName: d.displayName });
    setConfirmOpen(true);
  }

  async function doDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setConfirmOpen(false);

    await runGuard("Deleting…", async () => {
      const r = await fetch(`${API}/api/documents?name=${encodeURIComponent(target.name)}`, {
        method: "DELETE",
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(JSON.stringify(j || { error: `HTTP ${r.status}` }));
      }

      await loadDocs();
      toast(lang === "th" ? `ลบแล้ว: ${target.displayName}` : `Deleted: ${target.displayName}`, "ok");
    });

    setDeleteTarget(null);
  }

  async function runSummarize() {
    await runGuard(t("sSummarizing"), async () => {
      setSummary("");
      setSummaryMeta(null);
      const j = await apiPost(`${API}/api/summarize`, { lang });
      setSummary(j.text || "");
      setSummaryMeta(j.groundingMetadata || null);
      toast(t("sDone"), "ok");
    });
  }

  async function runPredict() {
    await runGuard(t("sPredicting"), async () => {
      setPred(null);
      setPredRaw("");
      setPredMeta(null);
      const j = await apiPost(`${API}/api/predict`, { n, lang });
      setPred(j.json);
      setPredRaw(j.text || "");
      setPredMeta(j.groundingMetadata || null);
      toast(t("sDone"), "ok");
    });
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(lang === "th" ? "คัดลอกแล้ว" : "Copied", "ok");
    } catch {
      toast(lang === "th" ? "คัดลอกไม่สำเร็จ" : "Copy failed", "err");
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Toast items={toasts} onDismiss={(id) => setToasts((s) => s.filter((x) => x.id !== id))} />

      <Modal
        open={confirmOpen}
        title={t("confirmTitle")}
        desc={t("confirmDesc")}
        cancelText={t("cancel")}
        confirmText={t("confirm")}
        danger
        onCancel={() => setConfirmOpen(false)}
        onConfirm={doDelete}
      />

      <Drawer open={advancedOpen} title={t("advanced")} onClose={() => setAdvancedOpen(false)}>
        <div className="space-y-3 text-sm">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-slate-400">{t("aApi")}</div>
            <div className="mt-1 break-all font-mono text-xs text-slate-200">{API || "-"}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-slate-400">{t("aStore")}</div>
            <div className="mt-1 break-all font-mono text-xs text-slate-200">
              {store.hasStore ? `${store.storeName} (${store.displayName || "-"})` : "-"}
            </div>
          </div>

          {rawError && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3">
              <div className="text-xs text-rose-200">{t("aRawError")}</div>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-rose-100">{rawError}</pre>
            </div>
          )}

          {(summaryMeta || predMeta) && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-slate-400">{t("aGrounding")}</div>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-slate-200">
                {JSON.stringify(summaryMeta || predMeta, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </Drawer>

      <div className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/5 p-2 ring-1 ring-white/10">
              <Icon name="spark" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">{t("appName")}</div>
              <div className="text-xs text-slate-400">{t("tagline")}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center rounded-2xl border border-white/10 bg-white/5 p-1 sm:flex">
              <button
                onClick={() => setLang("th")}
                className={cx(
                  "rounded-xl px-3 py-2 text-xs font-medium",
                  lang === "th" ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10"
                )}
              >
                ไทย
              </button>
              <button
                onClick={() => setLang("en")}
                className={cx(
                  "rounded-xl px-3 py-2 text-xs font-medium",
                  lang === "en" ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10"
                )}
              >
                EN
              </button>
            </div>

            <Button onClick={refreshAll} disabled={busy}>
              {t("refresh")}
            </Button>

            <Button onClick={() => setAdvancedOpen(true)} disabled={busy}>
              {t("advanced")}
            </Button>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-3">
          <div className="flex gap-2">
            <button
              onClick={() => setView("home")}
              className={cx(
                "rounded-xl px-4 py-2 text-sm font-medium transition",
                view === "home"
                  ? "bg-white/10 ring-1 ring-white/15"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              )}
            >
              {t("home")}
            </button>

            <button
              onClick={() => setView("library")}
              className={cx(
                "rounded-xl px-4 py-2 text-sm font-medium transition",
                view === "library"
                  ? "bg-white/10 ring-1 ring-white/15"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              )}
            >
              {t("library")}
            </button>

            <div className="ml-auto flex items-center gap-2">
              <Pill className={cx("bg-white/5 text-slate-200 ring-white/10")}>
                <span className={cx("h-1.5 w-1.5 rounded-full", busy ? "bg-amber-400" : "bg-emerald-400")} />
                {busy ? busyLabel : t("sReady")}
              </Pill>

              <Pill className={cx("bg-white/5 ring-white/10")}>
                <span className="text-slate-400">study</span>
                <span className="text-slate-200">{studyCount}</span>
              </Pill>

              <Pill className={cx("bg-white/5 ring-white/10")}>
                <span className="text-slate-400">exam</span>
                <span className="text-slate-200">{examCount}</span>
              </Pill>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {view === "home" ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <div className="p-5">
                <div className="text-base font-semibold">{t("welcomeTitle")}</div>
                <div className="mt-1 text-sm text-slate-400">{t("welcomeDesc")}</div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">
                        {ready ? t("workspaceReady") : t("createWorkspace")}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {ready
                          ? store.displayName || "course-one"
                          : lang === "th"
                          ? "พร้อมมีไฟล์เอกสารภายใน"
                          : "Ready for document uploads"}
                      </div>
                    </div>

                    {ready ? (
                      <Pill className="bg-emerald-500/10 text-emerald-200 ring-emerald-500/20">✓</Pill>
                    ) : (
                      <Pill className="bg-amber-500/10 text-amber-200 ring-amber-500/20">1</Pill>
                    )}
                  </div>

                  <div className="mt-3">
                    {!ready ? (
                      <Button variant="primary" onClick={createStore} disabled={busy}>
                        {t("createWorkspace")}
                      </Button>
                    ) : (
                      <div className="text-xs text-slate-400">
                        {lang === "th" ? "พร้อมอัปโหลดเอกสารได้เลย" : "You can start uploading now."}
                      </div>
                    )}
                  </div>
                </div>

                {!API && (
                  <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-200">
                    {lang === "th" ? "ยังไม่ได้ตั้งค่า VITE_API_URL" : "VITE_API_URL is not set."}
                  </div>
                )}
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold">{lang === "th" ? "อัปโหลดเอกสาร" : "Upload"}</div>
                    <div className="mt-1 text-sm text-slate-400">{t("supportedHint")}</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Dropzone
                    disabled={!ready || busy}
                    title={t("uploadStudyTitle")}
                    desc={t("uploadStudyDesc")}
                    onFile={(f) => upload("study", f)}
                  />
                  <Dropzone
                    disabled={!ready || busy}
                    title={t("uploadExamTitle")}
                    desc={t("uploadExamDesc")}
                    onFile={(f) => upload("exam", f)}
                  />
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm font-semibold">{t("summarize")}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {lang === "th"
                        ? "สรุปจากเอกสารเรียนทั้งหมดในคลัง"
                        : "Summarize from all study docs in your library."}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        variant="primary"
                        onClick={runSummarize}
                        disabled={!ready || busy || studyCount === 0}
                      >
                        <Icon name="spark" className="h-4 w-4" />
                        {t("summarize")}
                      </Button>
                      <span className="text-xs text-slate-500">
                        {lang === "th" ? `มี ${studyCount} ไฟล์` : `${studyCount} files`}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm font-semibold">{t("predict")}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {lang === "th"
                        ? "ใช้ข้อสอบเก่าวิเคราะห์หัวข้อที่ออกบ่อย"
                        : "Use past exams to infer likely topics/questions."}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                        <span className="text-xs text-slate-400">{t("questions")}</span>
                        <input
                          type="number"
                          value={n}
                          min={1}
                          max={50}
                          disabled={!ready || busy}
                          onChange={(e) => setN(Number(e.target.value))}
                          className="w-20 rounded-lg bg-transparent px-2 py-1 text-sm text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                        />
                      </div>

                      <Button
                        variant="indigo"
                        onClick={runPredict}
                        disabled={!ready || busy || examCount === 0}
                      >
                        <Icon name="spark" className="h-4 w-4" />
                        {t("predict")}
                      </Button>

                      <span className="text-xs text-slate-500">
                        {lang === "th" ? `มี ${examCount} ไฟล์` : `${examCount} files`}
                      </span>
                    </div>
                  </div>
                </div>

                {(summary || pred?.predictedQuestions?.length || predRaw) && (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold">
                        {summary
                          ? lang === "th"
                            ? "ผลสรุป"
                            : "Summary"
                          : lang === "th"
                          ? "ผลทำนาย"
                          : "Predictions"}
                      </div>
                      <div className="flex gap-2">
                        {summary && <Button onClick={() => copyText(summary)}>{t("copy")}</Button>}
                        {pred?.predictedQuestions?.length && (
                          <Button onClick={() => copyText(JSON.stringify(pred, null, 2))}>{t("copy")}</Button>
                        )}
                      </div>
                    </div>

                    {summary && (
                      <pre className="mt-3 whitespace-pre-wrap rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-100">
                        {summary}
                      </pre>
                    )}

                    {pred?.predictedQuestions?.length ? (
                      <div className="mt-3 grid gap-3">
                        {pred.predictedQuestions.map((qq: any, i: number) => (
                          <div key={i} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                            <div className="text-sm font-semibold">
                              Q{i + 1}: <span className="text-slate-100">{qq.q}</span>
                            </div>

                            <div className="mt-3 grid gap-2 text-sm">
                              <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                                <div className="text-xs font-medium text-slate-300">
                                  {lang === "th" ? "เหตุผลที่น่าจะออก" : "Why likely"}
                                </div>
                                <div className="mt-1 text-slate-100">{qq.whyLikely}</div>
                              </div>

                              <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                                <div className="text-xs font-medium text-slate-300">
                                  {lang === "th" ? "แนวคำตอบ" : "Answer guide"}
                                </div>
                                <div className="mt-1 text-slate-100">{qq.shortAnswer}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : predRaw ? (
                      <pre className="mt-3 whitespace-pre-wrap rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-100">
                        {predRaw}
                      </pre>
                    ) : null}
                  </div>
                )}
              </div>
            </Card>
          </div>
        ) : (
          <Card>
            <div className="p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Icon
                      name="search"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder={t("search")}
                      className="w-[280px] rounded-2xl border border-white/10 bg-white/5 py-2 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-white/10"
                    />
                  </div>

                  <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
                    {(["all", "study", "exam"] as const).map((k) => (
                      <button
                        key={k}
                        onClick={() => setKindFilter(k)}
                        className={cx(
                          "rounded-xl px-3 py-2 text-xs",
                          kindFilter === k ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10"
                        )}
                      >
                        {k === "all" ? t("all") : k === "study" ? t("study") : t("exam")}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-xs text-slate-400">
                  {lang === "th" ? `ทั้งหมด ${filteredDocs.length} ไฟล์` : `${filteredDocs.length} files`}
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                <div className="hidden grid-cols-12 gap-3 border-b border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-400 md:grid">
                  <div className="col-span-4">{t("file")}</div>
                  <div className="col-span-2">{t("type")}</div>
                  <div className="col-span-2">{t("status")}</div>
                  <div className="col-span-1">{t("size")}</div>
                  <div className="col-span-2">{t("date")}</div>
                  <div className="col-span-1 text-right">{t("actions")}</div>
                </div>

                {filteredDocs.length === 0 ? (
                  <div className="p-6 text-sm text-slate-400">{t("empty")}</div>
                ) : (
                  <div className="divide-y divide-white/10">
                    {filteredDocs.map((d) => (
                      <div key={d.name} className="px-4 py-4">
                        <div className="md:hidden">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Icon name="doc" className="text-slate-300" />
                                <div className="truncate text-sm font-medium text-slate-100">{d.displayName}</div>
                              </div>

                              <div className="mt-2 flex flex-wrap gap-2">
                                <Pill className={badgeKindClass(d.metadata?.kind)}>
                                  {d.metadata?.kind || "-"}
                                </Pill>
                                <Pill className={badgeStateClass(d.state)}>{d.state}</Pill>
                                <Pill className="bg-white/5 text-slate-300 ring-white/10">
                                  {prettyBytes(d.sizeBytes)}
                                </Pill>
                                <Pill className="bg-white/5 text-slate-300 ring-white/10">
                                  {fmtDate(d.createTime, lang)}
                                </Pill>
                              </div>
                            </div>

                            <Button variant="danger" onClick={() => askDelete(d)}>
                              <Icon name="trash" className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="hidden items-center gap-3 md:grid md:grid-cols-12">
                          <div className="col-span-4 min-w-0">
                            <div className="flex items-center gap-2">
                              <Icon name="doc" className="text-slate-300" />
                              <div className="truncate text-sm font-medium text-slate-100">{d.displayName}</div>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">{d.mimeType || "-"}</div>
                          </div>

                          <div className="col-span-2">
                            <Pill className={badgeKindClass(d.metadata?.kind)}>
                              {d.metadata?.kind || "-"}
                            </Pill>
                          </div>

                          <div className="col-span-2">
                            <Pill className={badgeStateClass(d.state)}>{d.state}</Pill>
                          </div>

                          <div className="col-span-1 text-sm text-slate-300">{prettyBytes(d.sizeBytes)}</div>
                          <div className="col-span-2 text-sm text-slate-300">{fmtDate(d.createTime, lang)}</div>

                          <div className="col-span-1 flex justify-end">
                            <Button variant="danger" onClick={() => askDelete(d)}>
                              <Icon name="trash" className="h-4 w-4" />
                              {t("delete")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}