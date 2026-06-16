import { useState } from "react";
import { toast } from "sonner";
import { useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { store, useStore, type DatasetMetadata, type ImageDatasetMetadata } from "../lib/mock-store";
import { useAddress, short } from "../hooks/use-address";
import { buildRevokePolicy, buildSealApproveTx } from "../lib/sui-transactions";
import { sealDecrypt } from "../lib/seal";
import { walrusReadBlob } from "../lib/walrus";
import { useSessionKey } from "../hooks/use-session-key";

export default function Access() {
  const addr = useAddress();
  const { records, listings, requests } = useStore();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();
  const { getSessionKey } = useSessionKey();

  const grants = [
    ...listings.map((l) => ({
      key: `l-${l.id}`, recordId: l.recordId, grantee: `marketplace listing`, source: "listing", id: l.id,
      policyObjectId: l.policyObjectId,
    })),
    ...requests.flatMap((r) =>
      r.responses.map((resp) => ({
        key: `r-${r.id}-${resp.user}`, recordId: resp.recordId, grantee: short(r.buyer), source: `request "${r.title}"`, id: r.id,
        policyObjectId: undefined as string | undefined,
      })),
    ),
  ];

  async function revoke(policyObjectId: string | undefined, localId: string, source: string) {
    if (!addr) return;
    if (!policyObjectId || policyObjectId.startsWith("local-")) {
      // fallback: local-only revoke
      store.removeListing(localId);
      store.log({ kind: "revoke", actor: addr, details: `Revoked ${source} (local only)` });
      toast.success("Access revoked (local)");
      return;
    }
    try {
      const tx = buildRevokePolicy(policyObjectId);
      await signAndExecute({ transaction: tx });
      store.removeListing(localId);
      store.log({ kind: "revoke", actor: addr, details: `Revoked policy ${short(policyObjectId)} via ${source}` });
      toast.success("Policy revoked on-chain");
    } catch (err) { console.error(err); toast.error("Revoke failed"); }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Access control</h1>
        <p className="mt-2 text-muted-foreground">Token-gated policies — granted via listings or request responses, revocable anytime.</p>
      </div>

      {/* Active grants */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="font-display text-lg font-semibold">Active grants</h3>
        {grants.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">No grants outstanding.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {grants.map((g) => {
              const rec = records.find((r) => r.id === g.recordId);
              return (
                <li key={g.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <div className="text-sm font-medium">{rec ? `${rec.recordType} · ${rec.date}` : "Unknown record"}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">grantee: {g.grantee} · via {g.source}</div>
                    {rec && <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">policy {rec.policyId.slice(0, 18)}…</div>}
                  </div>
                  {g.source === "listing" && (
                    <button
                      onClick={() => revoke(g.policyObjectId, g.id, g.source)}
                      className="rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/20">
                      Revoke on-chain
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* My records — decrypt */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="font-display text-lg font-semibold">My encrypted records</h3>
        <p className="mt-1 text-xs text-muted-foreground">Decrypt using your wallet. Requires a valid AccessCap on-chain.</p>
        {records.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">No records yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {records.map((r) => (
              <RecordRow key={r.id} record={r} getSessionKey={getSessionKey} signAndExecute={signAndExecute} suiClient={suiClient} />
            ))}
          </ul>
        )}
      </div>

      {/* Policies list */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="font-display text-lg font-semibold">Policies</h3>
        <p className="mt-1 text-xs text-muted-foreground">Each record is sealed under a unique on-chain policy. Decryption requires a matching AccessCap.</p>
        {records.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">No records yet.</p>
        ) : (
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {records.map((r) => (
              <div key={r.id} className="rounded-lg border border-border bg-background p-3 font-mono text-[11px]">
                <span className="text-primary">policy</span> {r.policyId}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type SignAndExecute = ReturnType<typeof useSignAndExecuteTransaction>["mutateAsync"];

function RecordRow({ record, getSessionKey, signAndExecute, suiClient }: {
  record: ReturnType<typeof useStore>["records"][number];
  getSessionKey: ReturnType<typeof useSessionKey>["getSessionKey"];
  signAndExecute: SignAndExecute;
  suiClient: unknown;
}) {
  const [decrypting, setDecrypting] = useState(false);
  const [decrypted, setDecrypted] = useState<string | null>(null);
  const [capId, setCapId] = useState(record.accessCapObjectId ?? "");

  const isDs = record.kind === "dataset";
  const isImg = record.kind === "image-dataset";
  const ds = isDs ? (record.metadata as DatasetMetadata) : null;
  const img = isImg ? (record.metadata as ImageDatasetMetadata) : null;

  async function decrypt() {
    if (!capId) return toast.error("Enter your AccessCap object ID");
    if (!record.blobId || record.blobId.startsWith("local-")) return toast.error("No Walrus blob to decrypt");
    if (!record.policyId || record.policyId.startsWith("local-")) return toast.error("No on-chain policy found");
    setDecrypting(true);
    try {
      // 1. get signed session key
      const sessionKey = await getSessionKey();
      // 2. build seal_approve PTB — Seal key servers simulate this
      const approveTx = buildSealApproveTx({ policyObjectId: record.policyId, accessCapObjectId: capId });
      const txBytes = await approveTx.build({ client: undefined as never });
      // 3. fetch ciphertext from Walrus
      const ciphertext = await walrusReadBlob(record.blobId);
      // 4. decrypt via Seal
      const plaintext = await sealDecrypt(ciphertext, sessionKey, txBytes, suiClient);
      // 5. display result
      const text = new TextDecoder().decode(plaintext);
      setDecrypted(text.slice(0, 2000));
      // log access on-chain
      store.log({ kind: "grant", actor: record.owner, details: `Decrypted record "${record.metadata.title || record.recordType}"` });
      toast.success("Decrypted successfully");
    } catch (err) {
      console.error(err);
      toast.error("Decryption failed — check your AccessCap and policy");
    } finally {
      setDecrypting(false);
    }
  }

  const badgeStyle = isImg
    ? "border-sky-400/30 bg-sky-400/10 text-sky-400"
    : isDs
    ? "border-amber-400/30 bg-amber-400/10 text-amber-400"
    : "border-primary/30 bg-primary/10 text-primary";

  return (
    <li className="py-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{record.metadata.title || `${record.recordType} · ${record.date}`}</span>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${badgeStyle}`}>{record.kind}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {record.anonymization} · {(record.sizeBytes / 1024).toFixed(1)} KB
            {ds && ` · ${ds.rowCount} rows · ${ds.priceUsdc} USDC`}
            {img && ` · ${img.fileCount} files · ${img.modality}`}
          </div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">blob {record.blobId.slice(0, 20)}…</div>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={capId}
          onChange={(e) => setCapId(e.target.value)}
          placeholder="AccessCap object ID (0x…)"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono outline-none focus:border-primary"
        />
        <button
          onClick={decrypt}
          disabled={decrypting}
          className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50">
          {decrypting ? "Decrypting…" : "Decrypt"}
        </button>
      </div>

      {decrypted !== null && (
        <pre className="rounded-lg border border-border bg-background p-3 text-[11px] font-mono text-muted-foreground overflow-x-auto max-h-48 whitespace-pre-wrap">
          {decrypted}
        </pre>
      )}
    </li>
  );
}
