import { useQuery } from "@tanstack/react-query";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { HEALTHDATA_PACKAGE_ID } from "../lib/constants";

const rpc = new SuiJsonRpcClient({ url: "https://fullnode.testnet.sui.io:443", network: "testnet" });

export interface ChainEvent {
  id: string;
  kind: string;
  actor: string;
  details: string;
  at: number;
}

async function fetchModuleEvents(module: string): Promise<ChainEvent[]> {
  const res = await rpc.queryEvents({
    query: { MoveModule: { package: HEALTHDATA_PACKAGE_ID, module } },
    limit: 50,
    order: "descending",
  });
  return (res?.data ?? []).map((e) => parseEvent(e as SuiEventRaw));
}

async function fetchEvents(): Promise<ChainEvent[]> {
  const [ac, mp, re] = await Promise.all([
    fetchModuleEvents("access_control"),
    fetchModuleEvents("marketplace"),
    fetchModuleEvents("request_escrow"),
  ]);
  return [...ac, ...mp, ...re].sort((a, b) => b.at - a.at).slice(0, 200);
}

interface SuiEventRaw {
  id: { txDigest: string; eventSeq: string };
  type: string;
  parsedJson?: Record<string, string>;
  timestampMs?: string;
}

function parseEvent(e: SuiEventRaw): ChainEvent {
  const typeParts = e.type.split("::");
  const kind = typeParts[typeParts.length - 1] ?? "event";
  const j = e.parsedJson ?? {};
  const actor = j.owner ?? j.buyer ?? j.seller ?? j.grantee ?? j.by ?? "";
  return {
    id: `${e.id.txDigest}-${e.id.eventSeq}`,
    kind: camelToKind(kind),
    actor,
    details: formatDetails(kind, j),
    at: e.timestampMs ? Number(e.timestampMs) : Date.now(),
  };
}

function formatDetails(kind: string, j: Record<string, string>): string {
  switch (kind) {
    case "PolicyCreated":  return `Policy ${short(j.policy)} created · kind: ${j.kind}`;
    case "AccessGranted":  return `Access granted to ${short(j.grantee)} on policy ${short(j.policy)}`;
    case "AccessRevoked":  return `Policy ${short(j.policy)} revoked`;
    case "AccessUsed":     return `Policy ${short(j.policy)} accessed by ${short(j.by)}`;
    case "Listed":         return `Listed policy ${short(j.policy)} for ${fmtUsdc(j.price)} USDC`;
    case "Purchased":      return `Listing ${short(j.listing)} purchased by ${short(j.buyer)} for ${fmtUsdc(j.paid)} USDC`;
    case "RequestOpened":  return `Request ${short(j.request)} opened · ${fmtUsdc(j.fee)} USDC escrowed`;
    case "Responded":      return `${short(j.responder)} responded to request ${short(j.request)}`;
    case "Settled":        return `Request ${short(j.request)} settled · ${j.n} contributors · ${fmtUsdc(j.per_responder)} USDC each`;
    case "Refunded":       return `Request ${short(j.request)} refunded · ${fmtUsdc(j.amount)} USDC returned`;
    default:               return JSON.stringify(j);
  }
}

function camelToKind(s: string): string {
  return s.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`).replace(/^-/, "");
}
function short(s?: string): string {
  if (!s) return "?";
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}
function fmtUsdc(raw?: string): string {
  if (!raw) return "?";
  return (Number(raw) / 1_000_000).toFixed(2);
}

export function useOnChainEvents() {
  return useQuery({
    queryKey: ["chain-events", HEALTHDATA_PACKAGE_ID],
    queryFn: fetchEvents,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
