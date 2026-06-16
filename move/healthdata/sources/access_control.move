module healthdata::access_control {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use std::string::String;
    use std::vector;

    const ENotOwner: u64 = 0;
    const ERevoked: u64 = 1;

    /// Shared metadata for any uploaded entry (record or dataset).
    public struct EntryMetadata has store, drop {
        title: String,
        description: String,
        tags: vector<String>,
        source: String,
        format: String,
    }

    /// Extra fields only present on tabular (CSV) datasets.
    public struct DatasetInfo has store, drop {
        row_count: u64,
        columns: vector<String>,
        price_usdc: u64,
        sample_available: bool,
    }

    /// Extra fields only present on image datasets (DICOM, PNG, etc.).
    public struct ImageDatasetInfo has store, drop {
        file_count: u64,
        modality: String,   // "DICOM" | "PNG" | "JPEG" | "TIFF" | "NIfTI" | "other"
        image_format: String,
        price_usdc: u64,
        sample_available: bool,
    }

    /// A policy describing one encrypted upload.
    /// kind: "record" | "dataset" | "image-dataset"
    public struct Policy has key, store {
        id: UID,
        owner: address,
        record_type: String,
        anonymization: String,
        blob_id: String,
        kind: String,
        metadata: EntryMetadata,
        dataset_info: Option<DatasetInfo>,
        image_dataset_info: Option<ImageDatasetInfo>,
        revoked: bool,
    }

    public struct AccessCap has key, store {
        id: UID,
        policy: ID,
        grantee: address,
    }

    public struct PolicyCreated has copy, drop { policy: ID, owner: address, kind: String }
    public struct AccessGranted has copy, drop { policy: ID, grantee: address, cap: ID }
    public struct AccessRevoked has copy, drop { policy: ID, by: address }
    public struct AccessUsed    has copy, drop { policy: ID, by: address }

    public entry fun create_record_policy(
        record_type: String,
        anonymization: String,
        blob_id: String,
        title: String,
        description: String,
        tags: vector<String>,
        source: String,
        format: String,
        ctx: &mut TxContext,
    ) {
        let owner = tx_context::sender(ctx);
        let kind = std::string::utf8(b"record");
        let policy = Policy {
            id: object::new(ctx),
            owner,
            record_type,
            anonymization,
            blob_id,
            kind,
            metadata: EntryMetadata { title, description, tags, source, format },
            dataset_info: option::none(),
            image_dataset_info: option::none(),
            revoked: false,
        };
        let pid = object::id(&policy);
        event::emit(PolicyCreated { policy: pid, owner, kind: policy.kind });
        transfer::public_transfer(policy, owner);
    }

    public entry fun create_dataset_policy(
        record_type: String,
        anonymization: String,
        blob_id: String,
        title: String,
        description: String,
        tags: vector<String>,
        source: String,
        format: String,
        row_count: u64,
        columns: vector<String>,
        price_usdc: u64,
        sample_available: bool,
        ctx: &mut TxContext,
    ) {
        let owner = tx_context::sender(ctx);
        let kind = std::string::utf8(b"dataset");
        let policy = Policy {
            id: object::new(ctx),
            owner,
            record_type,
            anonymization,
            blob_id,
            kind,
            metadata: EntryMetadata { title, description, tags, source, format },
            dataset_info: option::some(DatasetInfo { row_count, columns, price_usdc, sample_available }),
            image_dataset_info: option::none(),
            revoked: false,
        };
        let pid = object::id(&policy);
        event::emit(PolicyCreated { policy: pid, owner, kind: policy.kind });
        transfer::public_transfer(policy, owner);
    }

    /// Create a policy for an image dataset (DICOM, PNG series, etc.).
    /// Files are zipped/tarred into a single Walrus blob before encryption.
    public entry fun create_image_dataset_policy(
        record_type: String,
        anonymization: String,
        blob_id: String,
        title: String,
        description: String,
        tags: vector<String>,
        source: String,
        file_count: u64,
        modality: String,
        image_format: String,
        price_usdc: u64,
        sample_available: bool,
        ctx: &mut TxContext,
    ) {
        let owner = tx_context::sender(ctx);
        let kind = std::string::utf8(b"image-dataset");
        let policy = Policy {
            id: object::new(ctx),
            owner,
            record_type,
            anonymization,
            blob_id,
            kind,
            metadata: EntryMetadata { title, description, tags, source, format: image_format },
            dataset_info: option::none(),
            image_dataset_info: option::some(ImageDatasetInfo {
                file_count, modality, image_format, price_usdc, sample_available,
            }),
            revoked: false,
        };
        let pid = object::id(&policy);
        event::emit(PolicyCreated { policy: pid, owner, kind: policy.kind });
        transfer::public_transfer(policy, owner);
    }

    public entry fun grant(policy: &Policy, grantee: address, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == policy.owner, ENotOwner);
        assert!(!policy.revoked, ERevoked);
        grant_unchecked(policy, grantee, ctx);
    }

    /// Grant access without owner check — for programmatic callers (e.g. marketplace).
    public fun grant_unchecked(policy: &Policy, grantee: address, ctx: &mut TxContext) {
        assert!(!policy.revoked, ERevoked);
        let cap = AccessCap { id: object::new(ctx), policy: object::id(policy), grantee };
        let cid = object::id(&cap);
        event::emit(AccessGranted { policy: object::id(policy), grantee, cap: cid });
        transfer::public_transfer(cap, grantee);
    }

    public entry fun revoke(policy: &mut Policy, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == policy.owner, ENotOwner);
        policy.revoked = true;
        event::emit(AccessRevoked { policy: object::id(policy), by: tx_context::sender(ctx) });
    }

    public entry fun log_use(cap: &AccessCap, ctx: &mut TxContext) {
        event::emit(AccessUsed { policy: cap.policy, by: tx_context::sender(ctx) });
    }

    /// Called by Seal key servers (via PTB simulation) to decide whether to
    /// release a decryption key share. The `id` is the Seal encrypted-object
    /// identity — we encode it as the Policy object ID bytes.
    /// The caller must present a valid, non-revoked AccessCap for that policy.
    public fun seal_approve(id: vector<u8>, cap: &AccessCap, policy: &Policy) {
        assert!(!policy.revoked, ERevoked);
        assert!(cap.policy == object::id(policy), ENotOwner);
        // id must match the policy object id bytes
        assert!(id == object::id_bytes(policy), ENotOwner);
    }
}
