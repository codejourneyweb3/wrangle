/// Marketplace for curated dataset/record sale. Price is set by the uploader
/// on the Policy (dataset_info.price_usdc) and carried into the Listing.
module healthdata::marketplace {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::transfer;
    use sui::event;
    use std::string::String;
    use std::vector;
    use healthdata::access_control::{Self as ac, Policy};

    const EWrongPrice: u64 = 0;

    public struct Listing<phantom T> has key, store {
        id: UID,
        seller: address,
        policy: ID,
        price: u64,
        title: String,
        description: String,
        tags: vector<String>,
        format: String,
        row_count: u64,      // 0 for records/image-datasets
        columns: vector<String>,
        file_count: u64,     // 0 for records/csv-datasets
        modality: String,    // empty for non-image kinds
    }

    public struct Listed<phantom T> has copy, drop {
        listing: ID, seller: address, policy: ID, price: u64, title: String
    }
    public struct Purchased<phantom T> has copy, drop {
        listing: ID, buyer: address, paid: u64
    }

    /// List a dataset or record. `price` is supplied by the caller and must
    /// match the price encoded in the Policy's dataset_info (enforced off-chain
    /// for now; on-chain check can be added once policy getters are exposed).
    public entry fun list<T>(
        policy: &Policy,
        price: u64,
        title: String,
        description: String,
        tags: vector<String>,
        format: String,
        row_count: u64,
        columns: vector<String>,
        file_count: u64,
        modality: String,
        ctx: &mut TxContext,
    ) {
        let seller = tx_context::sender(ctx);
        let listing = Listing<T> {
            id: object::new(ctx),
            seller,
            policy: object::id(policy),
            price,
            title,
            description,
            tags,
            format,
            row_count,
            columns,
            file_count,
            modality,
        };
        let lid = object::id(&listing);
        event::emit(Listed<T> { listing: lid, seller, policy: object::id(policy), price, title: listing.title });
        transfer::public_share_object(listing);
    }

    public entry fun buy<T>(
        listing: Listing<T>,
        policy: &Policy,
        payment: Coin<T>,
        ctx: &mut TxContext,
    ) {
        assert!(coin::value(&payment) == listing.price, EWrongPrice);
        let buyer = tx_context::sender(ctx);
        let Listing { id, seller, policy: _, price, title: _, description: _, tags: _, format: _, row_count: _, columns: _, file_count: _, modality: _ } = listing;
        let lid = object::uid_to_inner(&id);
        object::delete(id);
        transfer::public_transfer(payment, seller);
        ac::grant_unchecked(policy, buyer, ctx);
        event::emit(Purchased<T> { listing: lid, buyer, paid: price });
    }
}
