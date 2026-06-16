import { useStore } from "../lib/mock-store";

export default function Dashboard() {
  const { records, events } = useStore();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">Your health data overview.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Recent records"
          empty="No records yet — upload your first."
          items={records.slice(0, 5).map((r) => ({
            k: r.id, primary: r.recordType, secondary: `${r.anonymization} · ${(r.sizeBytes / 1024).toFixed(1)} KB`, meta: r.date,
          }))}
        />
        <Section
          title="Recent activity"
          empty="Nothing here yet."
          items={events.slice(0, 5).map((e) => ({
            k: e.id, primary: e.kind, secondary: e.details, meta: new Date(e.at).toLocaleTimeString(),
          }))}
        />
      </div>
    </div>
  );
}

function Section({ title, items, empty }: { title: string; empty: string; items: { k: string; primary: string; secondary: string; meta: string }[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {items.map((i) => (
            <li key={i.k} className="flex items-center justify-between gap-4 py-3 text-sm">
              <div>
                <div className="font-medium capitalize">{i.primary}</div>
                <div className="text-xs text-muted-foreground">{i.secondary}</div>
              </div>
              <div className="font-mono text-xs text-muted-foreground">{i.meta}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
