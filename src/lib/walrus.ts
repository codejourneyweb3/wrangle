import { WALRUS_AGGREGATOR, WALRUS_PUBLISHER } from "./constants";

/**
 * Walrus blob storage helpers.
 * Uses the public testnet HTTP publisher/aggregator endpoints so we don't
 * have to bundle the Walrus SDK. Returns the blobId for later retrieval.
 */
export async function walrusStoreBlob(data: Uint8Array, epochs = 5): Promise<string> {
  const res = await fetch(`${WALRUS_PUBLISHER}/v1/blobs?epochs=${epochs}`, {
    method: "PUT",
    body: new Blob([data.slice().buffer]),
  });
  if (!res.ok) throw new Error(`Walrus store failed: ${res.status}`);
  const json = (await res.json()) as {
    newlyCreated?: { blobObject: { blobId: string } };
    alreadyCertified?: { blobId: string };
  };
  const blobId = json.newlyCreated?.blobObject.blobId ?? json.alreadyCertified?.blobId;
  if (!blobId) throw new Error("Walrus: missing blobId in response");
  return blobId;
}

export async function walrusReadBlob(blobId: string): Promise<Uint8Array> {
  const res = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`);
  if (!res.ok) throw new Error(`Walrus read failed: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}
