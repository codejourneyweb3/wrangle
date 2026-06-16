import { SealClient, SessionKey, DemType } from "@mysten/seal";
import { fromHex, toHex } from "@mysten/sui/utils";
import { HEALTHDATA_PACKAGE_ID } from "./constants";

// Official Mysten Labs decentralized key server on testnet
// https://github.com/MystenLabs/seal/blob/main/examples/frontend/src/utils.ts
const SEAL_SERVER_CONFIGS = [
  {
    objectId: "0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98",
    weight: 1,
    aggregatorUrl: "https://seal-aggregator-testnet.mystenlabs.com",
  },
];

export function createSealClient(suiClient: unknown): SealClient {
  return new SealClient({
    suiClient: suiClient as never,
    serverConfigs: SEAL_SERVER_CONFIGS,
    verifyKeyServers: false,
  });
}

export interface SealEncrypted {
  ciphertext: Uint8Array;
  iv: string;
  policyId: string;
}

/**
 * Encrypt `data` under `policyObjectId` using the Seal SDK.
 * id = toHex(policyObjectBytes + 5-byte random nonce) per the official Seal example.
 * `policyObjectId` must be a real on-chain hex object ID (0x...).
 */
export async function sealEncrypt(
  data: Uint8Array,
  policyObjectId: string,
  suiClient: unknown,
): Promise<SealEncrypted> {
  if (!policyObjectId.startsWith("0x") || policyObjectId.includes("-")) {
    throw new Error(`sealEncrypt: invalid policyObjectId "${policyObjectId}" — must be an on-chain object ID (0x…). Make sure the policy transaction was submitted first.`);
  }
  const client = createSealClient(suiClient);
  const nonce = crypto.getRandomValues(new Uint8Array(5));
  const id = toHex(new Uint8Array([...fromHex(policyObjectId), ...nonce]));
  const { encryptedObject } = await client.encrypt({
    threshold: 1,
    packageId: HEALTHDATA_PACKAGE_ID,
    id,
    data,
    demType: DemType.AesGcm256,
  });
  return { ciphertext: encryptedObject, iv: "", policyId: policyObjectId };
}

/**
 * Decrypt a Seal-encrypted blob.
 * `sessionKey` must be a signed SessionKey from the connected wallet.
 * `txBytes` is the PTB that calls `seal_approve` — simulated by Seal key servers.
 */
export async function sealDecrypt(
  ciphertext: Uint8Array,
  sessionKey: SessionKey,
  txBytes: Uint8Array,
  suiClient: unknown,
): Promise<Uint8Array> {
  const client = createSealClient(suiClient);
  return client.decrypt({ data: ciphertext, sessionKey, txBytes });
}

export { SessionKey };
