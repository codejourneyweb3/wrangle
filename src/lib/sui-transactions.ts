import { Transaction } from "@mysten/sui/transactions";
import { HEALTHDATA_PACKAGE_ID, USDC_COIN_TYPE } from "./constants";

const pkg = HEALTHDATA_PACKAGE_ID;
const ac = `${pkg}::access_control`;
const mp = `${pkg}::marketplace`;
const re = `${pkg}::request_escrow`;

// ─── policy creation PTBs ────────────────────────────────────────────────────

export function buildCreateRecordPolicy(args: {
  recordType: string;
  anonymization: string;
  blobId: string;
  title: string;
  description: string;
  tags: string[];
  source: string;
  format: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${ac}::create_record_policy`,
    arguments: [
      tx.pure.string(args.recordType),
      tx.pure.string(args.anonymization),
      tx.pure.string(args.blobId),
      tx.pure.string(args.title),
      tx.pure.string(args.description),
      tx.pure(bcs_string_vec(args.tags)),
      tx.pure.string(args.source),
      tx.pure.string(args.format),
    ],
  });
  return tx;
}

export function buildCreateDatasetPolicy(args: {
  recordType: string;
  anonymization: string;
  blobId: string;
  title: string;
  description: string;
  tags: string[];
  source: string;
  format: string;
  rowCount: number;
  columns: string[];
  priceUsdc: number;
  sampleAvailable: boolean;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${ac}::create_dataset_policy`,
    arguments: [
      tx.pure.string(args.recordType),
      tx.pure.string(args.anonymization),
      tx.pure.string(args.blobId),
      tx.pure.string(args.title),
      tx.pure.string(args.description),
      tx.pure(bcs_string_vec(args.tags)),
      tx.pure.string(args.source),
      tx.pure.string(args.format),
      tx.pure.u64(args.rowCount),
      tx.pure(bcs_string_vec(args.columns)),
      tx.pure.u64(args.priceUsdc * 1_000_000),
      tx.pure.bool(args.sampleAvailable),
    ],
  });
  return tx;
}

export function buildCreateImageDatasetPolicy(args: {
  recordType: string;
  anonymization: string;
  blobId: string;
  title: string;
  description: string;
  tags: string[];
  source: string;
  fileCount: number;
  modality: string;
  imageFormat: string;
  priceUsdc: number;
  sampleAvailable: boolean;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${ac}::create_image_dataset_policy`,
    arguments: [
      tx.pure.string(args.recordType),
      tx.pure.string(args.anonymization),
      tx.pure.string(args.blobId),
      tx.pure.string(args.title),
      tx.pure.string(args.description),
      tx.pure(bcs_string_vec(args.tags)),
      tx.pure.string(args.source),
      tx.pure.u64(args.fileCount),
      tx.pure.string(args.modality),
      tx.pure.string(args.imageFormat),
      tx.pure.u64(args.priceUsdc * 1_000_000),
      tx.pure.bool(args.sampleAvailable),
    ],
  });
  return tx;
}

// ─── revoke policy ──────────────────────────────────────────────────────────

export function buildRevokePolicy(policyObjectId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${ac}::revoke`,
    arguments: [tx.object(policyObjectId)],
  });
  return tx;
}

// ─── marketplace PTBs ────────────────────────────────────────────────────────

export function buildListDataset(args: {
  policyObjectId: string;
  price: number;          // USDC, human units
  title: string;
  description: string;
  tags: string[];
  format: string;
  rowCount: number;
  columns: string[];
  fileCount: number;
  modality: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${mp}::list`,
    typeArguments: [USDC_COIN_TYPE],
    arguments: [
      tx.object(args.policyObjectId),
      tx.pure.u64(Math.round(args.price * 1_000_000)),
      tx.pure.string(args.title),
      tx.pure.string(args.description),
      tx.pure(bcs_string_vec(args.tags)),
      tx.pure.string(args.format),
      tx.pure.u64(args.rowCount),
      tx.pure(bcs_string_vec(args.columns)),
      tx.pure.u64(args.fileCount),
      tx.pure.string(args.modality),
    ],
  });
  return tx;
}

export function buildBuyDataset(args: {
  listingObjectId: string;
  policyObjectId: string;
  usdcCoinObjectId: string;
  price: number;          // USDC, human units — used to split exact amount
}): Transaction {
  const tx = new Transaction();
  const [payment] = tx.splitCoins(tx.object(args.usdcCoinObjectId), [
    tx.pure.u64(Math.round(args.price * 1_000_000)),
  ]);
  tx.moveCall({
    target: `${mp}::buy`,
    typeArguments: [USDC_COIN_TYPE],
    arguments: [
      tx.object(args.listingObjectId),
      tx.object(args.policyObjectId),
      payment,
    ],
  });
  return tx;
}

// ─── request_escrow PTBs ─────────────────────────────────────────────────────

export function buildOpenRequest(args: {
  title: string;
  description: string;
  curator: string;
  contributorShareBps: number;
  deadlineMs: number;
  requiredFormat: string;
  requiredColumns: string[];
  minRowCount: number;
  requiredAnonymization: string;
  requiredRecordType: string;
  requiredModality: string;
  minFileCount: number;
  usdcCoinObjectId: string;
  feeUsdc: number;
}): Transaction {
  const tx = new Transaction();
  const [fee] = tx.splitCoins(tx.object(args.usdcCoinObjectId), [
    tx.pure.u64(Math.round(args.feeUsdc * 1_000_000)),
  ]);
  tx.moveCall({
    target: `${re}::open`,
    typeArguments: [USDC_COIN_TYPE],
    arguments: [
      tx.pure.string(args.title),
      tx.pure.string(args.description),
      tx.pure.address(args.curator),
      tx.pure.u64(args.contributorShareBps),
      tx.pure.u64(args.deadlineMs),
      tx.pure.string(args.requiredFormat),
      tx.pure(bcs_string_vec(args.requiredColumns)),
      tx.pure.u64(args.minRowCount),
      tx.pure.string(args.requiredAnonymization),
      tx.pure.string(args.requiredRecordType),
      tx.pure.string(args.requiredModality),
      tx.pure.u64(args.minFileCount),
      fee,
    ],
  });
  return tx;
}

export function buildRespondRequest(args: {
  requestObjectId: string;
  clockObjectId?: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${re}::respond`,
    typeArguments: [USDC_COIN_TYPE],
    arguments: [
      tx.object(args.requestObjectId),
      tx.object(args.clockObjectId ?? "0x6"),
    ],
  });
  return tx;
}

export function buildSettleRequest(args: {
  requestObjectId: string;
  clockObjectId?: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${re}::settle`,
    typeArguments: [USDC_COIN_TYPE],
    arguments: [
      tx.object(args.requestObjectId),
      tx.object(args.clockObjectId ?? "0x6"),
    ],
  });
  return tx;
}

export function buildRefundRequest(args: {
  requestObjectId: string;
  clockObjectId?: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${re}::refund`,
    typeArguments: [USDC_COIN_TYPE],
    arguments: [
      tx.object(args.requestObjectId),
      tx.object(args.clockObjectId ?? "0x6"),
    ],
  });
  return tx;
}

// ─── seal_approve PTB ────────────────────────────────────────────────────────

/**
 * Build the PTB that Seal key servers simulate to gate decryption.
 * Must call `seal_approve(id, cap, policy)` where:
 *   - id     = the Seal encrypted-object identity (policy object ID as bytes)
 *   - cap    = the AccessCap object owned by the decryptor
 *   - policy = the Policy shared/owned object
 */
export function buildSealApproveTx(args: {
  policyObjectId: string;
  accessCapObjectId: string;
}): Transaction {
  const tx = new Transaction();
  // id = policy object ID encoded as a vector<u8>
  const idBytes = hexToBytes(args.policyObjectId.replace(/^0x/, ""));
  tx.moveCall({
    target: `${ac}::seal_approve`,
    arguments: [
      tx.pure(bcs_bytes(idBytes)),
      tx.object(args.accessCapObjectId),
      tx.object(args.policyObjectId),
    ],
  });
  return tx;
}

// ─── BCS helpers ────────────────────────────────────────────────────────────

function bcs_string_vec(strings: string[]): Uint8Array {
  // BCS vector<String>: uleb128 length, then each string as uleb128-length-prefixed UTF-8
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  parts.push(uleb128(strings.length));
  for (const s of strings) {
    const b = enc.encode(s);
    parts.push(uleb128(b.length));
    parts.push(b);
  }
  return concat(parts);
}

function bcs_bytes(bytes: Uint8Array): Uint8Array {
  // BCS vector<u8>: uleb128 length prefix
  return concat([uleb128(bytes.length), bytes]);
}

function uleb128(n: number): Uint8Array {
  const out: number[] = [];
  do {
    let byte = n & 0x7f;
    n >>>= 7;
    if (n !== 0) byte |= 0x80;
    out.push(byte);
  } while (n !== 0);
  return new Uint8Array(out);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) { out.set(p, offset); offset += p.length; }
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
