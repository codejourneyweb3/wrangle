import { useState, useCallback } from "react";
import { useCurrentAccount, useSignPersonalMessage } from "@mysten/dapp-kit";
import { SessionKey } from "@mysten/seal";
import { HEALTHDATA_PACKAGE_ID } from "../lib/constants";

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

let _cached: { key: SessionKey; expiresAt: number; address: string } | null = null;

// SessionKey constructor is typed private but works at runtime
type SessionKeyConstructor = new (opts: { address: string; packageId: string; ttlMin: number }) => SessionKey;
const SessionKeyCtor = SessionKey as unknown as SessionKeyConstructor;

export function useSessionKey() {
  const account = useCurrentAccount();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const [busy, setBusy] = useState(false);

  const getSessionKey = useCallback(async (): Promise<SessionKey> => {
    const address = account?.address;
    if (!address) throw new Error("Wallet not connected");

    if (_cached && _cached.address === address && Date.now() < _cached.expiresAt && !_cached.key.isExpired()) {
      return _cached.key;
    }

    setBusy(true);
    try {
      const sessionKey = new SessionKeyCtor({ address, packageId: HEALTHDATA_PACKAGE_ID, ttlMin: 10 });
      const message = sessionKey.getPersonalMessage();
      const { signature } = await signPersonalMessage({ message });
      sessionKey.setPersonalMessageSignature(signature);
      _cached = { key: sessionKey, expiresAt: Date.now() + SESSION_TTL_MS, address };
      return sessionKey;
    } finally {
      setBusy(false);
    }
  }, [account?.address, signPersonalMessage]);

  return { getSessionKey, busy };
}
