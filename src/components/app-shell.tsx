import { ConnectButton } from "@mysten/dapp-kit";
import { NavLink, Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useBalances } from "../hooks/use-balances";

const nav = [
  { to: "/app", label: "Dashboard" },
  { to: "/app/upload", label: "Upload" },
  { to: "/app/marketplace", label: "Marketplace" },
  { to: "/app/requests", label: "Requests" },
  { to: "/app/access", label: "Access" },
  { to: "/app/activity", label: "Activity" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-primary shadow-[0_0_24px_var(--color-primary)]" />
            <span className="font-display text-lg font-semibold tracking-tight">wrangle</span>
          </Link>
          <nav className="hidden gap-1 md:flex">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/app"}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 text-sm transition hover:bg-secondary hover:text-foreground ${isActive ? "bg-secondary text-foreground" : "text-muted-foreground"}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Balances />
            <ConnectButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground">
          <span>Wrangle · Sui Testnet · Walrus · Seal</span>
          <span className="font-mono">USDC payments — not for production data</span>
        </div>
      </footer>
    </div>
  );
}

function Balances() {
  const balances = useBalances();
  if (!balances) return null;
  return (
    <div className="hidden items-center gap-2 md:flex">
      <BalancePill label="SUI" value={balances.sui} />
      <BalancePill label="USDC" value={balances.usdc} />
      <BalancePill label="WAL" value={balances.wal} />
    </div>
  );
}

function BalancePill({ label, value }: { label: string; value: string | null }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-mono">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value ?? "…"}</span>
    </span>
  );
}
