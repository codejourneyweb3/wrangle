/// Custom-request escrow: institution locks USDC + specifies exact dataset
/// requirements. Contributors match against requirements and respond.
module healthdata::request_escrow {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::clock::{Self, Clock};
    use sui::transfer;
    use sui::event;
    use std::vector;
    use std::string::String;

    const EClosed: u64 = 0;
    const ETooEarly: u64 = 1;
    const ENotEmpty: u64 = 2;
    const EBadShare: u64 = 3;

    /// Institution-specified requirements for the dataset they want.
    public struct DatasetRequirements has store, drop {
        required_format: String,
        required_columns: vector<String>,
        min_row_count: u64,
        required_anonymization: String,
        required_record_type: String,
        // image-specific (empty strings / 0 if not an image request)
        required_modality: String,
        min_file_count: u64,
    }

    public struct Request<phantom T> has key {
        id: UID,
        buyer: address,
        curator: address,
        title: String,
        description: String,
        contributor_share_bps: u64,
        deadline_ms: u64,
        funds: Balance<T>,
        requirements: DatasetRequirements,
        responders: vector<address>,
        settled: bool,
    }

    public struct RequestOpened<phantom T> has copy, drop { request: ID, buyer: address, fee: u64, deadline_ms: u64 }
    public struct Responded<phantom T> has copy, drop { request: ID, responder: address }
    public struct Settled<phantom T> has copy, drop { request: ID, per_responder: u64, curator_amount: u64, n: u64 }
    public struct Refunded<phantom T> has copy, drop { request: ID, amount: u64 }

    public entry fun open<T>(
        title: String,
        description: String,
        curator: address,
        contributor_share_bps: u64,
        deadline_ms: u64,
        required_format: String,
        required_columns: vector<String>,
        min_row_count: u64,
        required_anonymization: String,
        required_record_type: String,
        required_modality: String,
        min_file_count: u64,
        fee: Coin<T>,
        ctx: &mut TxContext,
    ) {
        assert!(contributor_share_bps <= 10000, EBadShare);
        let amount = coin::value(&fee);
        let req = Request<T> {
            id: object::new(ctx),
            buyer: tx_context::sender(ctx),
            curator,
            title,
            description,
            contributor_share_bps,
            deadline_ms,
            funds: coin::into_balance(fee),
            requirements: DatasetRequirements {
                required_format,
                required_columns,
                min_row_count,
                required_anonymization,
                required_record_type,
                required_modality,
                min_file_count,
            },
            responders: vector::empty<address>(),
            settled: false,
        };
        event::emit(RequestOpened<T> {
            request: object::id(&req),
            buyer: tx_context::sender(ctx),
            fee: amount,
            deadline_ms,
        });
        transfer::share_object(req);
    }

    public entry fun respond<T>(req: &mut Request<T>, clock: &Clock, ctx: &mut TxContext) {
        assert!(!req.settled, EClosed);
        assert!(clock::timestamp_ms(clock) < req.deadline_ms, EClosed);
        let who = tx_context::sender(ctx);
        vector::push_back(&mut req.responders, who);
        event::emit(Responded<T> { request: object::id(req), responder: who });
    }

    public entry fun settle<T>(req: &mut Request<T>, clock: &Clock, ctx: &mut TxContext) {
        assert!(!req.settled, EClosed);
        assert!(clock::timestamp_ms(clock) >= req.deadline_ms, ETooEarly);
        let n = vector::length(&req.responders);
        assert!(n > 0, ENotEmpty);

        let total = balance::value(&req.funds);
        let contributor_pool = total * req.contributor_share_bps / 10000;
        let per = contributor_pool / n;

        let mut i = 0;
        while (i < n) {
            let addr = *vector::borrow(&req.responders, i);
            let part = coin::take(&mut req.funds, per, ctx);
            transfer::public_transfer(part, addr);
            i = i + 1;
        };

        let remaining = balance::value(&req.funds);
        let curator_coin = coin::take(&mut req.funds, remaining, ctx);
        transfer::public_transfer(curator_coin, req.curator);

        req.settled = true;
        event::emit(Settled<T> { request: object::id(req), per_responder: per, curator_amount: remaining, n });
    }

    public entry fun refund<T>(req: &mut Request<T>, clock: &Clock, ctx: &mut TxContext) {
        assert!(!req.settled, EClosed);
        assert!(clock::timestamp_ms(clock) >= req.deadline_ms, ETooEarly);
        assert!(vector::length(&req.responders) == 0, ENotEmpty);
        let amt = balance::value(&req.funds);
        let c = coin::take(&mut req.funds, amt, ctx);
        transfer::public_transfer(c, req.buyer);
        req.settled = true;
        event::emit(Refunded<T> { request: object::id(req), amount: amt });
    }
}
