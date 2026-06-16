import { Transaction } from "@mysten/sui/transactions";
import { USDC_COIN_TYPE } from "./constants";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

export const USDC = { type: USDC_COIN_TYPE, decimals: 6 };

/** Build a transaction that splits and transfers USDC (testnet, 6 decimals). */
export function buildUsdcTransfer(recipient: string, amountUsdc: number) {
  const tx = new Transaction();
  const amount = BigInt(Math.round(amountUsdc * 1_000_000));
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);
  tx.transferObjects([coin], tx.pure.address(recipient));
  tx.setGasBudget(10_000_000);
  return tx;
}

const rpc = new SuiJsonRpcClient({ url: "https://fullnode.testnet.sui.io:443", network: "testnet" });

/**
 * Find the largest USDC coin object owned by `address`.
 * Returns the objectId string or null if none found.
 */
export async function getUsdcCoin(address: string): Promise<string | null> {
  const res = await rpc.getCoins({ owner: address, coinType: USDC_COIN_TYPE });
  const coins = res?.data ?? [];
  if (coins.length === 0) return null;
  coins.sort((a, b) => Number(BigInt(b.balance) - BigInt(a.balance)));
  return coins[0].coinObjectId;
}
