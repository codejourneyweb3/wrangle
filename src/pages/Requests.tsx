import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { store, useStore, type DataRequest, type Anonymization, type RecordType } from "../lib/mock-store";
import { useAddress, short } from "../hooks/use-address";
import { buildOpenRequest, buildRespondRequest, buildSettleRequest, buildRefundRequest } from "../lib/sui-transactions";
import { getUsdcCoin } from "../lib/usdc";

type SignAndExecute = ReturnType<typeof useSignAndExecuteTransaction>["mutateAsync"];

export default function Requests() {
  const addr = useAddress();
  const { requests, records } = useStore();
  const [open, setOpen] = useState(false);
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  async function respond(r: DataRequest) {
    if (!addr) return toast.error("Connect wallet");
    const rec = records.find((x) => x.policyId && !x.policyId.startsWith("local-"));
    if (!rec) return toast.error("Upload a record with an on-chain policy first");
    if (!r.requestObjectId) return toast.error("Request has no on-chain object ID");
    try {
      const tx = buildRespondRequest({ requestObjectId: r.requestObjectId });
      await signAndExecute({ transaction: tx });
      store.respondToRequest(r.id, addr, rec.id);
      store.log({ kind: "respond", actor: addr, details: `Responded to request "${r.title}"` });
      toast.success("Response submitted on-chain. Funds release on deadline.");
    } catch (err) { console.error(err); toast.error("Respond failed"); }
  }

  async function settle(r: DataRequest) {
    if (!r.requestObjectId) return toast.error("Request has no on-chain object ID");
    if (Date.now() < r.deadline) return toast.error("Deadline not reached yet");
    try {
      const tx = r.responses.length === 0
        ? buildRefundRequest({ requestObjectId: r.requestObjectId })
        : buildSettleRequest({ requestObjectId: r.requestObjectId });
      await signAndExecute({ transaction: tx });
      if (r.responses.length === 0) {
        store.refundRequest(r.id);
        store.log({ kind: "refund", actor: r.buyer, details: `Refunded ${r.feeUsdc} USDC for "${r.title}"` });
        toast.message("Refunded — no responses received");
      } else {
        const perResponder = (r.feeUsdc * r.contributorSharePct) / 100 / r.responses.length;
        const curator = r.feeUsdc - perResponder * r.responses.length;
        store.settleRequest(r.id);
        store.log({ kind: "settle", actor: r.buyer, details: `Split ${r.feeUsdc} USDC → ${r.responses.length}×${perResponder.toFixed(2)} contributors, ${curator.toFixed(2)} curator` });
        toast.success("Escrow settled and split on-chain");
      }
    } catch (err) { console.error(err); toast.error("Settle failed"); }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Custom requests</h1>
          <p className="mt-2 text-muted-foreground">Institutions escrow USDC with specific dataset requirements. Contributors respond; funds split on deadline.</p>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          {open ? "Close" : "+ Broadcast request"}
        </button>
      </div>

      {open && <NewRequest addr={addr} signAndExecute={signAndExecute} onDone={() => setOpen(false)} />}

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-14 text-center text-sm text-muted-foreground">No active requests.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {requests.map((r) => {
            const days = Math.max(0, Math.ceil((r.deadline - Date.now()) / 86_400_000));
            return (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-display text-lg font-semibold">{r.title}</div>
                    <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
                  </div>
                  <Status status={r.status} />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                  <Meta k="Fee" v={`${r.feeUsdc} USDC`} />
                  <Meta k="Split" v={`${r.contributorSharePct}% / ${100 - r.contributorSharePct}%`} />
                  <Meta k="Deadline" v={`${days}d left`} />
                </div>

                <div className="mt-4 rounded-lg border border-border bg-background p-3 space-y-1.5 text-xs">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Dataset requirements</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                    <span>Type: <span className="text-foreground capitalize">{r.requiredRecordType}</span></span>
                    <span>Format: <span className="text-foreground">{r.requiredFormat || "any"}</span></span>
                    <span>Anonymization: <span className="text-foreground capitalize">{r.requiredAnonymization}</span></span>
                    <span>Min rows: <span className="text-foreground">{r.minRowCount || "any"}</span></span>
                    {r.requiredModality && <span>Modality: <span className="text-foreground">{r.requiredModality}</span></span>}
                    {r.minFileCount > 0 && <span>Min files: <span className="text-foreground">{r.minFileCount}</span></span>}
                  </div>
                  {r.requiredColumns.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {r.requiredColumns.map((c) => <span key={c} className="rounded bg-secondary border border-border px-1.5 py-0.5 font-mono text-[10px]">{c}</span>)}
                    </div>
                  )}
                </div>

                <div className="mt-3 font-mono text-[11px] text-muted-foreground">
                  buyer {short(r.buyer)} · {r.responses.length} response{r.responses.length === 1 ? "" : "s"}
                  {r.requestObjectId && <span className="ml-2">· obj {short(r.requestObjectId)}</span>}
                </div>
                {r.status === "open" && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button onClick={() => respond(r)} className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20">Grant access</button>
                    <button onClick={() => settle(r)} className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-secondary">Settle / refund</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewRequest({ addr, signAndExecute, onDone }: { addr: string | null; signAndExecute: SignAndExecute; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fee, setFee] = useState(500);
  const [share, setShare] = useState(70);
  const [days, setDays] = useState(7);
  const [requiredRecordType, setRequiredRecordType] = useState<RecordType>("lab");
  const [requiredAnonymization, setRequiredAnonymization] = useState<Anonymization>("anonymized");
  const [requiredFormat, setRequiredFormat] = useState("");
  const [minRowCount, setMinRowCount] = useState(0);
  const [requiredModality, setRequiredModality] = useState("");
  const [minFileCount, setMinFileCount] = useState(0);
  const [colInput, setColInput] = useState("");
  const [requiredColumns, setRequiredColumns] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function addCol() {
    const c = colInput.trim();
    if (c && !requiredColumns.includes(c)) setRequiredColumns((p) => [...p, c]);
    setColInput("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!addr) return toast.error("Connect wallet");
    setBusy(true);
    try {
      const usdcCoin = await getUsdcCoin(addr);
      if (!usdcCoin) return toast.error("No USDC balance found");
      const deadlineMs = Date.now() + Number(days) * 86_400_000;
      const tx = buildOpenRequest({
        title, description,
        curator: addr,
        contributorShareBps: Number(share) * 100,
        deadlineMs,
        requiredFormat, requiredColumns,
        minRowCount: Number(minRowCount),
        requiredAnonymization, requiredRecordType,
        requiredModality, minFileCount: Number(minFileCount),
        usdcCoinObjectId: usdcCoin,
        feeUsdc: Number(fee),
      });
      const result = await signAndExecute({ transaction: tx });
      const created = (result as { effects?: { created?: Array<{ reference?: { objectId?: string } }> } }).effects?.created ?? [];
      const requestObjectId = created[0]?.reference?.objectId;
      store.addRequest({
        buyer: addr, title, description,
        feeUsdc: Number(fee), contributorSharePct: Number(share),
        deadline: deadlineMs,
        requiredFormat, requiredColumns, minRowCount: Number(minRowCount),
        requiredAnonymization, requiredRecordType,
        requiredModality, minFileCount: Number(minFileCount),
        requestObjectId,
      });
      store.log({ kind: "request", actor: addr, details: `Escrowed ${fee} USDC for "${title}" (${days}d)` });
      toast.success("Request broadcast on-chain, USDC escrowed");
      onDone();
    } catch (err) { console.error(err); toast.error("Failed to open request"); }
    finally { setBusy(false); }
  }

  const inp = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
  const sel = `${inp} cursor-pointer`;

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6 space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Lbl label="Title" className="md:col-span-2"><input value={title} onChange={(e) => setTitle(e.target.value)} required className={inp} /></Lbl>
        <Lbl label="Description" className="md:col-span-2">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inp} placeholder="What data are you looking for and why?" />
        </Lbl>
        <Lbl label="Fee (USDC, escrowed)"><input type="number" min={1} value={fee} onChange={(e) => setFee(Number(e.target.value))} className={inp} /></Lbl>
        <Lbl label="Contributor share %"><input type="number" min={0} max={100} value={share} onChange={(e) => setShare(Number(e.target.value))} className={inp} /></Lbl>
        <Lbl label="Window (days)"><input type="number" min={1} max={90} value={days} onChange={(e) => setDays(Number(e.target.value))} className={inp} /></Lbl>
      </div>

      <div className="border-t border-border pt-5">
        <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Dataset requirements</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Lbl label="Record type">
            <select value={requiredRecordType} onChange={(e) => setRequiredRecordType(e.target.value as RecordType)} className={sel}>
              {["lab", "imaging", "genomic", "wearable", "clinical-note"].map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Lbl>
          <Lbl label="Anonymization">
            <select value={requiredAnonymization} onChange={(e) => setRequiredAnonymization(e.target.value as Anonymization)} className={sel}>
              {["raw", "pseudonymized", "anonymized"].map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Lbl>
          <Lbl label="Format (e.g. CSV, FHIR R4)">
            <input value={requiredFormat} onChange={(e) => setRequiredFormat(e.target.value)} placeholder="any" className={inp} />
          </Lbl>
          <Lbl label="Min row count">
            <input type="number" min={0} value={minRowCount} onChange={(e) => setMinRowCount(Number(e.target.value))} className={inp} />
          </Lbl>
          <Lbl label="Image modality (if image dataset)">
            <input value={requiredModality} onChange={(e) => setRequiredModality(e.target.value)} placeholder="e.g. DICOM — leave blank if any" className={inp} />
          </Lbl>
          <Lbl label="Min file count (images)">
            <input type="number" min={0} value={minFileCount} onChange={(e) => setMinFileCount(Number(e.target.value))} className={inp} />
          </Lbl>
          <Lbl label="Required columns" className="md:col-span-2">
            <div className="flex gap-2">
              <input value={colInput} onChange={(e) => setColInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCol(); } }}
                placeholder="Add column name, press Enter" className={inp} />
              <button type="button" onClick={addCol} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary">Add</button>
            </div>
            {requiredColumns.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {requiredColumns.map((c) => (
                  <span key={c} className="flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 font-mono text-[11px]">
                    {c}<button type="button" onClick={() => setRequiredColumns((p) => p.filter((x) => x !== c))}><X className="size-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </Lbl>
        </div>
      </div>

      <button disabled={busy} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
        {busy ? "Escrowing…" : "Escrow fee & broadcast"}
      </button>
    </form>
  );
}

function Lbl({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="mt-0.5 font-medium">{v}</div>
    </div>
  );
}
function Status({ status }: { status: DataRequest["status"] }) {
  const styles: Record<DataRequest["status"], string> = {
    open: "border-primary/40 bg-primary/10 text-primary",
    settled: "border-border bg-secondary text-foreground",
    refunded: "border-destructive/40 bg-destructive/10 text-destructive",
  };
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${styles[status]}`}>{status}</span>;
}
