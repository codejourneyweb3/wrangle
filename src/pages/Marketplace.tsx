import { useState } from "react";
import { toast } from "sonner";
import { useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { store, useStore, type DatasetMetadata, type ImageDatasetMetadata } from "../lib/mock-store";
import { useAddress, short } from "../hooks/use-address";
import { buildListDataset, buildBuyDataset } from "../lib/sui-transactions";
import { getUsdcCoin } from "../lib/usdc";

export default function Marketplace() {
  const addr = useAddress();
  const { records, listings } = useStore();
  const [open, setOpen] = useState(false);
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  async function purchase(id: string, price: number, seller: string, listingObjectId: string, policyObjectId: string) {
    if (!addr) return toast.error("Connect wallet");
    try {
      const usdcCoin = await getUsdcCoin(addr);
      if (!usdcCoin) return toast.error("No USDC balance found");
      const tx = buildBuyDataset({ listingObjectId, policyObjectId, usdcCoinObjectId: usdcCoin, price });
      await signAndExecute({ transaction: tx });
      store.removeListing(id);
      store.log({ kind: "purchase", actor: addr, details: `Bought listing ${id.slice(0, 6)} for ${price} USDC from ${short(seller)}` });
      toast.success(`Purchased for ${price} USDC — AccessCap minted to your wallet`);
    } catch (err) {
      console.error(err);
      toast.error("Purchase failed");
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Marketplace</h1>
          <p className="mt-2 text-muted-foreground">Curated datasets listed for direct USDC sale.</p>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          {open ? "Close" : "+ List dataset"}
        </button>
      </div>

      {open && <NewListing records={records} addr={addr} signAndExecute={signAndExecute} onDone={() => setOpen(false)} />}

      {listings.length === 0 ? (
        <Empty title="No listings yet" hint="List one of your encrypted records to start earning." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <div key={l.id} className="flex flex-col rounded-2xl border border-border bg-card p-6">
              <div className="flex items-start justify-between gap-2">
                <div className="font-display text-lg font-semibold leading-tight">{l.title}</div>
                <span className="shrink-0 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                  {l.modality ? l.modality : (l.format || "dataset")}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{l.description}</p>

              {l.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {l.tags.map((t) => <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{t}</span>)}
                </div>
              )}

              {l.columns && l.columns.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Columns</p>
                  <div className="flex flex-wrap gap-1">
                    {l.columns.slice(0, 6).map((c) => <span key={c} className="rounded bg-background border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{c}</span>)}
                    {l.columns.length > 6 && <span className="font-mono text-[10px] text-muted-foreground">+{l.columns.length - 6}</span>}
                  </div>
                </div>
              )}

              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-mono">seller {short(l.seller)}</span>
                {l.rowCount ? <span>{l.rowCount} rows</span> : null}
                {l.fileCount ? <span>{l.fileCount} files</span> : null}
              </div>

              <div className="mt-auto pt-5 flex items-center justify-between">
                <div className="font-display text-2xl font-semibold text-primary">
                  {l.priceUsdc} <span className="text-sm text-muted-foreground">USDC</span>
                </div>
                <button
                  onClick={() => purchase(l.id, l.priceUsdc, l.seller, l.listingObjectId ?? l.id, l.policyObjectId ?? "")}
                  className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20">
                  Buy access
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type SignAndExecute = ReturnType<typeof useSignAndExecuteTransaction>["mutateAsync"];

function NewListing({ records, addr, signAndExecute, onDone }: {
  records: ReturnType<typeof useStore>["records"];
  addr: string | null;
  signAndExecute: SignAndExecute;
  onDone: () => void;
}) {
  const [recordId, setRecordId] = useState(records[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  const selected = records.find((r) => r.id === recordId);
  const isDataset = selected?.kind === "dataset";
  const isImage = selected?.kind === "image-dataset";
  const ds = isDataset ? (selected?.metadata as DatasetMetadata) : null;
  const img = isImage ? (selected?.metadata as ImageDatasetMetadata) : null;
  const defaultPrice = ds?.priceUsdc ?? img?.priceUsdc ?? 10;
  const [price, setPrice] = useState(defaultPrice);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!addr || !selected) return toast.error(!addr ? "Connect wallet" : "No record selected");
    if (!selected.policyId || selected.policyId.startsWith("local-")) {
      return toast.error("Record has no on-chain policy — re-upload with wallet connected");
    }
    setBusy(true);
    try {
      const tx = buildListDataset({
        policyObjectId: selected.policyId,
        price: Number(price),
        title: selected.metadata.title || `${selected.recordType} · ${selected.date}`,
        description: selected.metadata.description,
        tags: selected.metadata.tags,
        format: selected.metadata.format,
        rowCount: ds?.rowCount ?? 0,
        columns: ds?.columns ?? [],
        fileCount: img?.fileCount ?? 0,
        modality: img?.modality ?? "",
      });
      const result = await signAndExecute({ transaction: tx });
      // extract created Listing object ID from effects
      const created = (result as { effects?: { created?: Array<{ reference?: { objectId?: string } }> } }).effects?.created ?? [];
      const listingObjectId = created[0]?.reference?.objectId ?? "";
      store.addListing({
        recordId,
        seller: addr,
        priceUsdc: Number(price),
        title: selected.metadata.title || `${selected.recordType} · ${selected.date}`,
        description: selected.metadata.description,
        tags: selected.metadata.tags,
        format: selected.metadata.format,
        rowCount: ds?.rowCount,
        columns: ds?.columns,
        fileCount: img?.fileCount,
        modality: img?.modality,
        policyObjectId: selected.policyId,
        listingObjectId,
      });
      store.log({ kind: "grant", actor: addr, details: `Listed "${selected.metadata.title || selected.recordType}" for ${price} USDC` });
      toast.success("Listing published on-chain");
      onDone();
    } catch (err) {
      console.error(err);
      toast.error("Listing failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm md:col-span-2">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Record / dataset</span>
          <select value={recordId} onChange={(e) => { setRecordId(e.target.value); const r = records.find((x) => x.id === e.target.value); setPrice(r?.kind === "dataset" ? (r.metadata as DatasetMetadata).priceUsdc : 10); }}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
            {records.map((r) => <option key={r.id} value={r.id}>{r.metadata.title || `${r.recordType} · ${r.date}`} ({r.kind})</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Price (USDC)</span>
          <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(Number(e.target.value))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
      </div>
      {selected && (
        <div className="rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground space-y-1">
          {selected.metadata.description && <p>{selected.metadata.description}</p>}
          {selected.metadata.tags.length > 0 && <p>Tags: {selected.metadata.tags.join(", ")}</p>}
          {ds && <p>{ds.rowCount} rows · columns: {ds.columns.slice(0, 4).join(", ")}{ds.columns.length > 4 ? ` +${ds.columns.length - 4}` : ""}</p>}
          {img && <p>{img.fileCount} files · {img.modality} · {img.imageFormat}</p>}
          <p className="font-mono text-[10px]">policy {selected.policyId}</p>
        </div>
      )}
      <button disabled={busy} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
        {busy ? "Publishing…" : "Publish listing"}
      </button>
    </form>
  );
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-14 text-center">
      <div className="font-display text-xl font-semibold">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}
