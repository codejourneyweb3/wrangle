import { SuiClientProvider, WalletProvider, createNetworkConfig } from "@mysten/dapp-kit";
import { JsonRpcHTTPTransport, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import type { ReactNode } from "react";

const { networkConfig } = createNetworkConfig({
  testnet: { network: "testnet", transport: new JsonRpcHTTPTransport({ url: getJsonRpcFullnodeUrl("testnet") }) },
  mainnet: { network: "mainnet", transport: new JsonRpcHTTPTransport({ url: getJsonRpcFullnodeUrl("mainnet") }) },
});

export function SuiProviders({ children }: { children: ReactNode }) {
  return (
    <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
      <WalletProvider autoConnect>{children}</WalletProvider>
    </SuiClientProvider>
  );
}
