import { useCurrentAccount } from "@mysten/dapp-kit";

export function useAddress() {
  const acc = useCurrentAccount();
  return acc?.address ?? null;
}

export function short(addr: string | null | undefined) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
