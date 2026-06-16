import { useStore } from "../lib/mock-store";
import { useOnChainEvents } from "../hooks/use-on-chain-events";
import { short } from "../hooks/use-address";

const dot: Record<string, string> = {
  upload: "bg-primary",
  grant: "bg-primary",
  "access-granted": "bg-primary",
  "policy-created": "bg-primary",
  revoke: "bg-destructive",
  "access-revoked": "bg-destructive",
  purchase: "bg-emerald-400",
  purchased: "bg-emerald-400",
  request: "bg-amber-400",
  "request-opened": "bg-amber-400",
  respond: "bg-sky-400",
  responded: "bg-sky-400",
  settle: "bg-emerald-400",
  settled: "bg-emerald-400",
  refund: "bg-destructive",
  refunded: "bg-destructive",
};

export default function Activity() {
  const { events: localEvents } = useStore();
  const { data: chainEvents, isLoading, isError } = useOnChainEvents();

  // merge: chain events first, then local-only events not already covered
  const events = chainEvents && chainEvents.length > 0
    ? chainEvents
    : localEvents.map((e) => ({ id: e.id, kind: e.kind, actor: e.actor, details: e.details, at: e.at }));

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Activity log</h1>
          <p className="mt-2 text-muted-foreground">On-chain events from the healthdata package — refreshes every 15s.</p>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <span className="text-xs text-muted-foreground">Fetching chain events…</span>}
          {isError && <span className="text-xs text-destructive">Chain unavailable — showing local log</span>}
          {chainEvents && (
            <span className="rounded-full border border-border bg-secondary px-2 py-1 font-mono text-[11px] text-muted-foreground">
              {chainEvents.length} on-chain
            </span>
          )}
        </div>
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-14 text-center text-sm text-muted-foreground">No activity yet.</div>
      ) : (
        <ol className="relative ml-3 space-y-4 border-l border-border pl-6">
          {events.map((e) => (
            <li key={e.id} className="relative">
              <span className={`absolute -left-[27px] top-1.5 size-2.5 rounded-full ring-4 ring-background ${dot[e.kind] ?? "bg-muted-foreground"}`} />
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider">{e.kind}</span>
                    <span className="font-mono text-xs text-muted-foreground">{short(e.actor)}</span>
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">{new Date(e.at).toLocaleString()}</span>
                </div>
                <div className="mt-2 text-sm text-foreground">{e.details}</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
