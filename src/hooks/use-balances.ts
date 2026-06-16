import { useCurrentAccount, useSuiClientQuery } from "@mysten/dapp-kit";
import { USDC_COIN_TYPE, WAL_COIN_TYPE } from "../lib/constants";

export function useBalances() {
  const acc = useCurrentAccount();
  const address = acc?.address;

  const { data: suiData } = useSuiClientQuery(
    "getBalance",
    { owner: address!, coinType: "0x2::sui::SUI" },
    { enabled: !!address },
  );

  const { data: usdcData } = useSuiClientQuery(
    "getBalance",
    { owner: address!, coinType: USDC_COIN_TYPE },
    { enabled: !!address },
  );

  const { data: walData } = useSuiClientQuery(
    "getBalance",
    { owner: address!, coinType: WAL_COIN_TYPE },
    { enabled: !!address },
  );

  if (!address) return null;

  const sui = suiData ? (Number(suiData.totalBalance) / 1e9).toFixed(3) : null;
  const usdc = usdcData ? (Number(usdcData.totalBalance) / 1e6).toFixed(2) : null;
  const wal = walData ? (Number(walData.totalBalance) / 1e9).toFixed(3) : null;

  return { sui, usdc, wal };
}
