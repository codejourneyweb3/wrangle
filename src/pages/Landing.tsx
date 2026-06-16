import { Link } from "react-router-dom";
import { ArrowRight, Lock, Database, Coins, ShieldCheck } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 grid-bg opacity-60" />
        <div className="absolute -top-40 left-1/2 size-[700px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <header className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-primary shadow-[0_0_24px_var(--color-primary)]" />
            <span className="font-display text-lg font-semibold tracking-tight">wrangle</span>
          </div>
          <nav className="hidden gap-6 text-sm md:flex">
            <a href="#how" className="text-primary hover:opacity-80">How it works</a>
            <a href="#marketplace" className="text-primary hover:opacity-80">Marketplace</a>
          </nav>
          <Link to="/app" className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90">
            Open app
          </Link>
        </header>

        <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-32">
          <h1 className="mt-6 max-w-4xl font-display text-6xl font-semibold leading-[0.95] tracking-tight md:text-7xl">
            Your health data.<br />
            <span className="text-gradient-accent">Your price.</span>
          </h1>
          <p className="mt-8 max-w-xl text-lg text-muted-foreground">
            Wrangle turns personal medical records into a sovereign asset. Encrypt with Seal,
            store on Walrus, and sell access to vetted institutions — settled in USDC on Sui.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/app/upload" className="group inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90">
              List a record <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
            </Link>
            <Link to="/app/marketplace" className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground hover:bg-secondary">
              Browse marketplace
            </Link>
          </div>

          <div className="mt-24 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
            {[
              { k: "$0.42M", l: "USDC settled (testnet demo)" },
              { k: "2,184", l: "encrypted records on Walrus" },
              { k: "37", l: "institutional buyers" },
            ].map((s) => (
              <div key={s.l} className="bg-card p-6">
                <div className="font-display text-3xl font-semibold">{s.k}</div>
                <div className="mt-1 text-sm text-muted-foreground">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <h2 className="max-w-2xl font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Four steps.<br />Zero custody risk.
          </h2>
          <div className="mt-14 grid gap-6 md:grid-cols-4">
            {[
              { i: Lock, t: "Encrypt", d: "Seal encrypts your file in-browser. Only policy-holders decrypt." },
              { i: Database, t: "Store", d: "Walrus blob storage — decentralized, verifiable, persistent." },
              { i: ShieldCheck, t: "Govern", d: "Sui Move policies grant, revoke, and log every access on-chain." },
              { i: Coins, t: "Earn", d: "Institutions escrow USDC. Smart contracts split on deadline." },
            ].map((s, i) => (
              <div key={s.t} className="group rounded-2xl border border-border bg-card p-6 transition hover:border-primary/40">
                <div className="font-mono text-xs text-muted-foreground">0{i + 1}</div>
                <s.i className="mt-4 size-6 text-primary" />
                <div className="mt-4 font-display text-xl font-semibold">{s.t}</div>
                <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      <section id="marketplace" className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="relative mx-auto max-w-7xl px-6 py-32 text-center">
          <h2 className="mx-auto max-w-3xl font-display text-5xl font-semibold tracking-tight md:text-6xl">
            The data economy<br /><span className="text-gradient-accent">finally pays you.</span>
          </h2>
          <Link to="/app" className="mt-10 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-medium text-primary-foreground transition hover:opacity-90">
            Launch dashboard <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
