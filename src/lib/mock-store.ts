import { useEffect, useState } from "react";

export type RecordType = "lab" | "imaging" | "genomic" | "wearable" | "clinical-note";
export type Anonymization = "raw" | "pseudonymized" | "anonymized";
export type ImageModality = "DICOM" | "PNG" | "JPEG" | "TIFF" | "NIfTI" | "other";

export interface RecordMetadata {
  title: string;
  description: string;
  tags: string[];          // e.g. ["diabetes", "blood-glucose"]
  source: string;          // e.g. "UCSF hospital", "Fitbit"
  format: string;          // e.g. "FHIR R4", "DICOM", "CSV"
}

export interface DatasetMetadata extends RecordMetadata {
  rowCount: number;
  columns: string[];       // CSV column names
  priceUsdc: number;       // uploader-set price
  sampleAvailable: boolean;
}

export interface ImageDatasetMetadata extends RecordMetadata {
  fileCount: number;
  modality: ImageModality;  // DICOM, PNG, etc.
  imageFormat: string;      // e.g. "DICOM 3.0", "PNG 16-bit"
  priceUsdc: number;
  sampleAvailable: boolean;
}

export interface HealthRecord {
  id: string;
  owner: string;
  recordType: RecordType;
  date: string;
  anonymization: Anonymization;
  blobId: string;
  iv: string;
  policyId: string;
  sizeBytes: number;
  kind: "record" | "dataset" | "image-dataset";
  metadata: RecordMetadata | DatasetMetadata | ImageDatasetMetadata;
  accessCapObjectId?: string;
}

export interface Listing {
  id: string;
  recordId: string;
  seller: string;
  priceUsdc: number;
  title: string;
  description: string;
  tags: string[];
  format: string;
  rowCount?: number;
  columns?: string[];
  fileCount?: number;
  modality?: string;
  createdAt: number;
  policyObjectId?: string;   // on-chain Policy object ID
  listingObjectId?: string;  // on-chain Listing object ID
}

export interface DataRequest {
  id: string;
  buyer: string;
  title: string;
  description: string;
  feeUsdc: number;
  contributorSharePct: number;
  deadline: number;
  // institution-specified dataset requirements
  requiredFormat: string;
  requiredColumns: string[];
  minRowCount: number;
  requiredAnonymization: Anonymization;
  requiredRecordType: RecordType;
  requiredModality: string;   // empty for non-image requests
  minFileCount: number;
  responses: Array<{ user: string; recordId: string; at: number }>;
  status: "open" | "settled" | "refunded";
  requestObjectId?: string;
}

export type AccessEvent = {
  id: string;
  at: number;
  kind: "grant" | "revoke" | "purchase" | "request" | "respond" | "settle" | "refund" | "upload";
  actor: string;
  details: string;
};

interface Store {
  records: HealthRecord[];
  listings: Listing[];
  requests: DataRequest[];
  events: AccessEvent[];
}

const KEY = "healthdata-store-v3";
const empty: Store = { records: [], listings: [], requests: [], events: [] };

function read(): Store {
  if (typeof window === "undefined") return empty;
  try {
    return { ...empty, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return empty;
  }
}

function write(s: Store) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("healthdata-store"));
}

export function useStore() {
  const [state, setState] = useState<Store>(() => read());
  useEffect(() => {
    const sync = () => setState(read());
    window.addEventListener("healthdata-store", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("healthdata-store", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return state;
}

function mutate(fn: (s: Store) => Store) {
  write(fn(read()));
}

export const store = {
  log(ev: Omit<AccessEvent, "id" | "at">) {
    mutate((s) => ({
      ...s,
      events: [{ ...ev, id: crypto.randomUUID(), at: Date.now() }, ...s.events].slice(0, 200),
    }));
  },
  addRecord(r: Omit<HealthRecord, "id">) {
    const rec = { ...r, id: crypto.randomUUID() };
    mutate((s) => ({ ...s, records: [rec, ...s.records] }));
    return rec;
  },
  addListing(l: Omit<Listing, "id" | "createdAt">) {
    const li = { ...l, id: crypto.randomUUID(), createdAt: Date.now() };
    mutate((s) => ({ ...s, listings: [li, ...s.listings] }));
    return li;
  },
  removeListing(id: string) {
    mutate((s) => ({ ...s, listings: s.listings.filter((x) => x.id !== id) }));
  },
  addRequest(r: Omit<DataRequest, "id" | "responses" | "status">) {
    const req = { ...r, id: crypto.randomUUID(), responses: [], status: "open" as const };
    mutate((s) => ({ ...s, requests: [req, ...s.requests] }));
    return req;
  },
  respondToRequest(reqId: string, user: string, recordId: string) {
    mutate((s) => ({
      ...s,
      requests: s.requests.map((r) =>
        r.id === reqId
          ? { ...r, responses: [...r.responses, { user, recordId, at: Date.now() }] }
          : r,
      ),
    }));
  },
  settleRequest(reqId: string) {
    mutate((s) => ({
      ...s,
      requests: s.requests.map((r) => (r.id === reqId ? { ...r, status: "settled" } : r)),
    }));
  },
  refundRequest(reqId: string) {
    mutate((s) => ({
      ...s,
      requests: s.requests.map((r) => (r.id === reqId ? { ...r, status: "refunded" } : r)),
    }));
  },
};
