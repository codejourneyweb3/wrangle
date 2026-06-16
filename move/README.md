# Vessel — Healthcare Data dApp

End-to-end scaffold for a decentralized healthcare data marketplace built on **Sui**, **Walrus** (decentralized blob storage), **Seal** (threshold encryption / access control), with **USDC** payments on Sui Testnet.

## Move package

`move/healthdata/` contains three modules:

| Module | Purpose |
| --- | --- |
| `access_control` | Policy objects + revocable `AccessCap` NFTs + on-chain access log events |
| `marketplace`    | Listings for curated datasets, atomic pay-and-grant via PTB |
| `request_escrow` | Institution-funded data requests with deadline, fee escrow, %-split settlement, refund on no-response |

Publish to Sui testnet:

```bash
cd move/healthdata
sui client publish --gas-budget 300000000
```

Then put the resulting package id into `src/lib/constants.ts` (`HEALTHDATA_PACKAGE_ID`).

## Frontend

- React + TanStack Start + Tailwind v4
- `@mysten/dapp-kit` wallet connect (Sui Testnet)
- `src/lib/walrus.ts` — Walrus HTTP publisher/aggregator (testnet)
- `src/lib/seal.ts` — Seal-shaped encrypt/decrypt API (currently WebCrypto AES-GCM stub — swap for `@mysten/seal` SDK)
- `src/lib/usdc.ts` — PTB builder for USDC transfers
- `src/lib/mock-store.ts` — local persistence so the full marketplace flow demos end-to-end before contracts are deployed

## Demo workflow

1. Connect wallet → **Upload**: file is encrypted with Seal and pushed to Walrus.
2. **Marketplace**: list the encrypted record for sale in USDC.
3. **Requests**: an institution broadcasts a request, escrowing USDC with a deadline and contributor-share %.
4. Users respond by granting access to a record.
5. After the deadline, **Settle** releases the escrow: contributors split their share, the curator gets the remainder. No responses → **Refund**.
6. Every grant, revoke, purchase, settle, and refund shows up in **Activity** (mirrors `AccessGranted` / `Settled` / `Refunded` Move events).
