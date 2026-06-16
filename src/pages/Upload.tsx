import { useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { sealEncrypt } from "../lib/seal";
import { walrusStoreBlob } from "../lib/walrus";
import {
  buildCreateRecordPolicy,
  buildCreateDatasetPolicy,
  buildCreateImageDatasetPolicy,
} from "../lib/sui-transactions";
import {
  store, useStore,
  type Anonymization, type RecordType, type ImageModality,
  type RecordMetadata, type DatasetMetadata, type ImageDatasetMetadata,
} from "../lib/mock-store";
import { useAddress } from "../hooks/use-address";
import { useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";

type Tab = "record" | "dataset" | "image-dataset";

const RECORD_TYPES: RecordType[] = ["lab", "imaging", "genomic", "wearable", "clinical-note"];
const ANON_OPTS: Anonymization[] = ["raw", "pseudonymized", "anonymized"];
const IMAGE_MODALITIES: ImageModality[] = ["DICOM", "PNG", "JPEG", "TIFF", "NIfTI", "other"];

// accepted MIME types / extensions per tab
const ACCEPT: Record<Tab, string> = {
  record: "*/*",
  dataset: ".csv",
  "image-dataset": ".dcm,.png,.jpg,.jpeg,.tif,.tiff,.nii,.nii.gz,image/*",
};

export default function Upload() {
  const [tab, setTab] = useState<Tab>("record");
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction({
    execute: async ({ bytes, signature }) =>
      suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: { showEffects: true },
      }),
  });
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Upload</h1>
        <p className="mt-2 text-muted-foreground">Encrypt and store health data on Walrus. Only ciphertext leaves your device.</p>
      </div>
      <div className="flex gap-1 rounded-xl border border-border bg-card p-1 w-fit">
        {(["record", "dataset", "image-dataset"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "record" ? "Single record" : t === "dataset" ? "CSV dataset" : "Image dataset"}
          </button>
        ))}
      </div>
      {tab === "record" && <SingleRecord signAndExecute={signAndExecute} suiClient={suiClient} />}
      {tab === "dataset" && <CsvDataset signAndExecute={signAndExecute} suiClient={suiClient} />}
      {tab === "image-dataset" && <ImageDataset signAndExecute={signAndExecute} suiClient={suiClient} />}
    </div>
  );
}

// ─── shared helpers ────────────────────────────────────────────────────────

function TagInput({ tags, setTags }: { tags: string[]; setTags: (t: string[]) => void }) {
  const [input, setInput] = useState("");
  function add() {
    const v = input.trim();
    if (v && !tags.includes(v)) setTags([...tags, v]);
    setInput("");
  }
  return (
    <Field label="Tags">
      <div className="flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Add tag, press Enter" />
        <button type="button" onClick={add} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary">Add</button>
      </div>
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
              {t}<button type="button" onClick={() => setTags(tags.filter((x) => x !== t))}><X className="size-3" /></button>
            </span>
          ))}
        </div>
      )}
    </Field>
  );
}

type SignAndExecute = ReturnType<typeof useSignAndExecuteTransaction>["mutateAsync"];

async function encryptAndUpload(bytes: Uint8Array, policyObjectId: string, suiClient: unknown): Promise<{ blobId: string }> {
  const sealed = await sealEncrypt(bytes, policyObjectId, suiClient);
  let blobId: string;
  try { blobId = await walrusStoreBlob(sealed.ciphertext); }
  catch { blobId = `local-${crypto.randomUUID()}`; toast.message("Walrus unreachable — using local id."); }
  return { blobId };
}

/** Extract the created Policy object ID from transaction effects. */
function extractPolicyId(result: { effects?: { created?: Array<{ reference?: { objectId?: string }; owner?: unknown }> } }): string {
  const created = result.effects?.created ?? [];
  // Policy is transferred to sender — find the object with AddressOwner (not shared)
  const owned = created.find((o) => o.owner && typeof o.owner === 'object' && 'AddressOwner' in (o.owner as object));
  const objectId = owned?.reference?.objectId ?? created[0]?.reference?.objectId;
  if (!objectId) throw new Error("Policy object ID not found in transaction effects. Make sure showEffects is enabled.");
  return objectId;
}

// ─── Single record ──────────────────────────────────────────────────────────

function SingleRecord({ signAndExecute, suiClient }: { signAndExecute: SignAndExecute; suiClient: unknown }) {
  const addr = useAddress();
  const { records } = useStore();
  const [file, setFile] = useState<File | null>(null);
  const [recordType, setRecordType] = useState<RecordType>("lab");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [anonymization, setAnonymization] = useState<Anonymization>("anonymized");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("");
  const [format, setFormat] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error("Select a file");
    if (!addr) return toast.error("Connect wallet first");
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      // 1. create on-chain Policy first (blobId placeholder, updated after upload)
      toast.message("Creating on-chain policy…");
      const tempBlobId = "pending";
      const policyTx = buildCreateRecordPolicy({ recordType, anonymization, blobId: tempBlobId, title, description, tags, source, format });
      const policyResult = await signAndExecute({ transaction: policyTx });
      const policyObjectId = extractPolicyId(policyResult as never);
      // 2. encrypt with real policy object ID + upload
      toast.message("Encrypting and uploading to Walrus…");
      const { blobId } = await encryptAndUpload(bytes, policyObjectId, suiClient);
      const metadata: RecordMetadata = { title, description, tags, source, format };
      store.addRecord({ owner: addr, recordType, date, anonymization, blobId, iv: "", policyId: policyObjectId, sizeBytes: bytes.byteLength, kind: "record", metadata });
      store.log({ kind: "upload", actor: addr, details: `record · ${recordType} · "${title || file.name}" · ${(bytes.byteLength / 1024).toFixed(1)} KB` });
      toast.success("Record encrypted and stored");
      setFile(null); setTitle(""); setDescription(""); setSource(""); setFormat(""); setTags([]);
    } catch (err) { console.error(err); toast.error("Upload failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
      <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-border bg-card p-6">
        <Field label="File">
          <input type="file" accept={ACCEPT.record} onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Record type"><Select value={recordType} onChange={(v) => setRecordType(v as RecordType)} options={RECORD_TYPES} /></Field>
          <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field label="Anonymization"><Select value={anonymization} onChange={(v) => setAnonymization(v as Anonymization)} options={ANON_OPTS} /></Field>
        <MetaSection title={title} setTitle={setTitle} description={description} setDescription={setDescription}
          source={source} setSource={setSource} format={format} setFormat={setFormat} tags={tags} setTags={setTags} />
        <button type="submit" disabled={busy} className="w-full rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50">
          {busy ? "Encrypting + uploading…" : "Encrypt & store"}
        </button>
      </form>
      <RecordsList records={records} />
    </div>
  );
}

// ─── CSV dataset ─────────────────────────────────────────────────────────────

function CsvDataset({ signAndExecute, suiClient }: { signAndExecute: SignAndExecute; suiClient: unknown }) {
  const addr = useAddress();
  const { records } = useStore();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [recordType, setRecordType] = useState<RecordType>("lab");
  const [anonymization, setAnonymization] = useState<Anonymization>("anonymized");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("");
  const [priceUsdc, setPriceUsdc] = useState<number | "">("");
  const [sampleAvailable, setSampleAvailable] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f); setPreview(null);
    if (!f) return;
    if (!f.name.endsWith(".csv")) return toast.error("Please select a .csv file");
    const lines = (await f.text()).trim().split("\n").map((l) => l.split(",").map((c) => c.trim()));
    const [headers, ...rows] = lines;
    setPreview({ headers, rows });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !addr) return toast.error(!file ? "Select a CSV" : "Connect wallet");
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      toast.message("Creating on-chain policy…");
      const policyTx = buildCreateDatasetPolicy({
        recordType, anonymization, blobId: "pending", title, description, tags, source, format: "CSV",
        rowCount: preview?.rows.length ?? 0, columns: preview?.headers ?? [],
        priceUsdc: Number(priceUsdc), sampleAvailable,
      });
      const policyResult = await signAndExecute({ transaction: policyTx });
      const policyObjectId = extractPolicyId(policyResult as never);
      toast.message("Encrypting and uploading to Walrus…");
      const { blobId } = await encryptAndUpload(bytes, policyObjectId, suiClient);
      const metadata: DatasetMetadata = { title, description, tags, source, format: "CSV", rowCount: preview?.rows.length ?? 0, columns: preview?.headers ?? [], priceUsdc: Number(priceUsdc), sampleAvailable };
      store.addRecord({ owner: addr, recordType, date: new Date().toISOString().slice(0, 10), anonymization, blobId, iv: "", policyId: policyObjectId, sizeBytes: bytes.byteLength, kind: "dataset", metadata });
      store.log({ kind: "upload", actor: addr, details: `dataset · ${recordType} · "${title}" · ${preview?.rows.length ?? 0} rows · ${priceUsdc} USDC` });
      toast.success(`Dataset stored — ${preview?.rows.length ?? 0} rows at ${priceUsdc} USDC`);
      setFile(null); setPreview(null); setTitle(""); setDescription(""); setSource(""); setTags([]); setPriceUsdc("");
    } catch (err) { console.error(err); toast.error("Upload failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
      <div className="overflow-x-auto">
        <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-border bg-card p-6">
          <Field label="CSV file">
            <input type="file" accept={ACCEPT.dataset} onChange={onFileChange}
              className="w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground" />
          </Field>
          {preview && <CsvPreview preview={preview} />}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Record type"><Select value={recordType} onChange={(v) => setRecordType(v as RecordType)} options={RECORD_TYPES} /></Field>
            <Field label="Anonymization"><Select value={anonymization} onChange={(v) => setAnonymization(v as Anonymization)} options={ANON_OPTS} /></Field>
          </div>
          <div className="border-t border-border pt-5 space-y-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Dataset metadata</p>
            <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Glucose monitoring 2024" /></Field>
            <Field label="Description">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" placeholder="What does this dataset contain?" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Source"><Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Fitbit" /></Field>
              <Field label="Price (USDC)"><Input type="number" min={0} step="0.01" value={priceUsdc} onChange={(e) => setPriceUsdc(e.target.value === "" ? "" : Number(e.target.value))} placeholder="e.g. 50" /></Field>
            </div>
            <TagInput tags={tags} setTags={setTags} />
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={sampleAvailable} onChange={(e) => setSampleAvailable(e.target.checked)} className="accent-primary" />
              <span className="text-muted-foreground">Sample preview available to buyers</span>
            </label>
          </div>
          <button type="submit" disabled={busy || !file} className="w-full rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50">
            {busy ? "Encrypting + uploading…" : `Encrypt & store dataset${preview ? ` (${preview.rows.length} rows)` : ""}`}
          </button>
        </form>
      </div>
      <RecordsList records={records} />
    </div>
  );
}

// ─── Image dataset ────────────────────────────────────────────────────────────

function ImageDataset({ signAndExecute, suiClient }: { signAndExecute: SignAndExecute; suiClient: unknown }) {
  const addr = useAddress();
  const { records } = useStore();
  const [files, setFiles] = useState<File[]>([]);
  const [modality, setModality] = useState<ImageModality>("DICOM");
  const [imageFormat, setImageFormat] = useState("DICOM 3.0");
  const [recordType, setRecordType] = useState<RecordType>("imaging");
  const [anonymization, setAnonymization] = useState<Anonymization>("anonymized");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("");
  const [priceUsdc, setPriceUsdc] = useState(100);
  const [sampleAvailable, setSampleAvailable] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const next = Array.from(incoming).filter(
      (f) => !files.some((existing) => existing.name === f.name && existing.size === f.size),
    );
    setFiles((prev) => [...prev, ...next]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) return toast.error("Add at least one image file");
    if (!addr) return toast.error("Connect wallet first");
    setBusy(true);
    try {
      const totalSize = files.reduce((s, f) => s + f.size, 0);
      const combined = new Uint8Array(totalSize);
      let offset = 0;
      for (const f of files) {
        const buf = new Uint8Array(await f.arrayBuffer());
        combined.set(buf, offset);
        offset += buf.byteLength;
      }
      toast.message("Creating on-chain policy…");
      const policyTx = buildCreateImageDatasetPolicy({
        recordType, anonymization, blobId: "pending", title, description, tags, source,
        fileCount: files.length, modality, imageFormat, priceUsdc, sampleAvailable,
      });
      const policyResult = await signAndExecute({ transaction: policyTx });
      const policyObjectId = extractPolicyId(policyResult as never);
      toast.message("Encrypting and uploading to Walrus…");
      const { blobId } = await encryptAndUpload(combined, policyObjectId, suiClient);
      const metadata: ImageDatasetMetadata = {
        title, description, tags, source,
        format: imageFormat, fileCount: files.length, modality, imageFormat, priceUsdc, sampleAvailable,
      };
      store.addRecord({
        owner: addr, recordType, date: new Date().toISOString().slice(0, 10),
        anonymization, blobId, iv: "", policyId: policyObjectId, sizeBytes: combined.byteLength,
        kind: "image-dataset", metadata,
      });
      store.log({ kind: "upload", actor: addr, details: `image-dataset · ${modality} · "${title}" · ${files.length} files · ${(combined.byteLength / 1024).toFixed(1)} KB · ${priceUsdc} USDC` });
      toast.success(`Image dataset stored — ${files.length} files at ${priceUsdc} USDC`);
      setFiles([]); setTitle(""); setDescription(""); setSource(""); setTags([]);
    } catch (err) { console.error(err); toast.error("Upload failed"); }
    finally { setBusy(false); }
  }

  const totalKb = (files.reduce((s, f) => s + f.size, 0) / 1024).toFixed(1);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
      <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-border bg-card p-6">

        {/* ── file collection area ── */}
        <div className="space-y-2">
          <span className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Image files {files.length > 0 && `· ${files.length} added · ${totalKb} KB`}
          </span>
          <div className="flex flex-wrap gap-2">
            {/* add individual files */}
            <label className="cursor-pointer rounded-lg border border-dashed border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-foreground transition">
              + Add files
              <input type="file" accept={ACCEPT["image-dataset"]} multiple className="hidden"
                onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            </label>
            {/* add entire folder */}
            <label className="cursor-pointer rounded-lg border border-dashed border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-foreground transition">
              + Add folder
              <input type="file" accept={ACCEPT["image-dataset"]} multiple className="hidden"
                // @ts-expect-error webkitdirectory is non-standard
                webkitdirectory=""
                onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">Accepts DICOM (.dcm), PNG, JPEG, TIFF, NIfTI (.nii / .nii.gz). Add as many batches as you need before finishing.</p>
        </div>

        {/* ── file list ── */}
        {files.length > 0 && (
          <div className="rounded-lg border border-border bg-background p-3 max-h-48 overflow-auto">
            <ul className="space-y-0.5">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                  <span className="truncate flex-1">{f.name}</span>
                  <span className="ml-4 shrink-0">{(f.size / 1024).toFixed(1)} KB</span>
                  <button type="button" onClick={() => removeFile(i)}
                    className="ml-3 shrink-0 text-muted-foreground hover:text-destructive transition">
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Modality"><Select value={modality} onChange={(v) => { setModality(v as ImageModality); setImageFormat(v === "DICOM" ? "DICOM 3.0" : v); }} options={IMAGE_MODALITIES} /></Field>
          <Field label="Record type"><Select value={recordType} onChange={(v) => setRecordType(v as RecordType)} options={RECORD_TYPES} /></Field>
          <Field label="Image format"><Input value={imageFormat} onChange={(e) => setImageFormat(e.target.value)} placeholder="e.g. DICOM 3.0, PNG 16-bit" /></Field>
          <Field label="Anonymization"><Select value={anonymization} onChange={(v) => setAnonymization(v as Anonymization)} options={ANON_OPTS} /></Field>
        </div>

        <div className="border-t border-border pt-5 space-y-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Dataset metadata</p>
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chest CT scans 2024" /></Field>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="Body part, scanner model, patient cohort details…" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Source / scanner"><Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Siemens SOMATOM" /></Field>
            <Field label="Price (USDC)"><Input type="number" min={0} step="0.01" value={priceUsdc} onChange={(e) => setPriceUsdc(Number(e.target.value))} /></Field>
          </div>
          <TagInput tags={tags} setTags={setTags} />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={sampleAvailable} onChange={(e) => setSampleAvailable(e.target.checked)} className="accent-primary" />
            <span className="text-muted-foreground">Sample preview available to buyers</span>
          </label>
        </div>

        <button type="submit" disabled={busy || files.length === 0}
          className="w-full rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50">
          {busy ? "Encrypting + uploading…" : files.length > 0 ? `Finish & encrypt (${files.length} file${files.length > 1 ? "s" : ""})` : "Finish & encrypt"}
        </button>
      </form>
      <RecordsList records={records} />
    </div>
  );
}

// ─── shared sub-components ────────────────────────────────────────────────────

function MetaSection({ title, setTitle, description, setDescription, source, setSource, format, setFormat, tags, setTags }:
  { title: string; setTitle: (v: string) => void; description: string; setDescription: (v: string) => void; source: string; setSource: (v: string) => void; format: string; setFormat: (v: string) => void; tags: string[]; setTags: (t: string[]) => void }) {
  return (
    <div className="border-t border-border pt-5 space-y-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Metadata</p>
      <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Q1 2024 blood panel" /></Field>
      <Field label="Description">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" placeholder="Brief description" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Source"><Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. UCSF, Fitbit" /></Field>
        <Field label="Format"><Input value={format} onChange={(e) => setFormat(e.target.value)} placeholder="e.g. FHIR R4, PDF" /></Field>
      </div>
      <TagInput tags={tags} setTags={setTags} />
    </div>
  );
}

function CsvPreview({ preview }: { preview: { headers: string[]; rows: string[][] } }) {
  return (
    <div className="rounded-lg border border-border bg-background overflow-x-auto overflow-y-auto max-h-44">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-secondary/50">
            {preview.headers.map((h) => <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {preview.rows.slice(0, 4).map((row, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {row.map((cell, j) => <td key={j} className="px-3 py-2 text-muted-foreground whitespace-nowrap">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {preview.rows.length > 4 && (
        <p className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border">
          +{preview.rows.length - 4} more rows · {preview.headers.length} columns
        </p>
      )}
    </div>
  );
}

function RecordsList({ records }: { records: ReturnType<typeof useStore>["records"] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">My records</h3>
        <span className="font-mono text-xs text-muted-foreground">{records.length} on Walrus</span>
      </div>
      {records.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Nothing uploaded yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {records.map((r) => {
            const isDs = r.kind === "dataset";
            const isImg = r.kind === "image-dataset";
            const ds = isDs ? (r.metadata as DatasetMetadata) : null;
            const img = isImg ? (r.metadata as ImageDatasetMetadata) : null;
            const badgeStyle = isImg
              ? "border-sky-400/30 bg-sky-400/10 text-sky-400"
              : isDs
              ? "border-amber-400/30 bg-amber-400/10 text-amber-400"
              : "border-primary/30 bg-primary/10 text-primary";
            return (
              <li key={r.id} className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{r.metadata.title || `${r.recordType} · ${r.date}`}</span>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${badgeStyle}`}>
                        {r.kind}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {r.anonymization} · {(r.sizeBytes / 1024).toFixed(1)} KB
                      {ds && ` · ${ds.rowCount} rows · ${ds.priceUsdc} USDC`}
                      {img && ` · ${img.fileCount} files · ${img.modality} · ${img.priceUsdc} USDC`}
                    </div>
                    {r.metadata.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {r.metadata.tags.map((t) => <span key={t} className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{t}</span>)}
                      </div>
                    )}
                    <div className="mt-1 font-mono text-[10px] text-muted-foreground">blob {r.blobId.slice(0, 16)}…</div>
                  </div>
                  <span className="shrink-0 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">encrypted</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary ${props.className ?? ""}`} />;
}
function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary">
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
