"use server";
import { unstable_noStore as noStore } from "next/cache";
// PrismaClient e revalidatePath não são mais necessários neste arquivo.

// --- Interfaces (Apenas para Portfólio) ---
export interface PortfolioAsset {
  name: string;
  symbol: string;
  balance: string;
  usdPrice: number; // Placeholder
  usdValue: number; // Placeholder
  logoUrl?: string | null; // Adicionado para logos
}
export interface PortfolioData {
  totalUsdValue: number;
  assets: PortfolioAsset[];
}

// --- CONFIGURAÇÃO ALCHEMY (Apenas para Portfólio) ---
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
// --- FIM CONFIGURAÇÃO ALCHEMY ---

// --- FUNÇÃO getPortfolioData (usando Alchemy + CoinGecko Logos) ---
export async function getPortfolioData(
  walletAddress: string,
  networkId: string = "sepolia-testnet"
): Promise<PortfolioData> {
  noStore();
  console.log(
    `[Portfolio Final] Fetching for ${walletAddress} on ${networkId}`
  );

  if (!ALCHEMY_API_KEY) {
    console.error(
      "[Portfolio Final] CRITICAL: ALCHEMY_API_KEY is not configured!"
    );
    return { totalUsdValue: 0, assets: [] };
  }

  // Mapeamento de endpoints RPC por rede
  const rpcUrls: Record<string, string> = {
    mainnet: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    "sepolia-testnet": `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    "goerli-testnet": `https://eth-goerli.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    "polygon-mainnet": `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    "polygon-mumbai": `https://polygon-mumbai.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    "arbitrum-mainnet": `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    "optimism-mainnet": `https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    // Adicione outros endpoints conforme necessário
  };
  const alchemyRpcUrl = rpcUrls[networkId];
  if (!alchemyRpcUrl) {
    console.warn(`[Portfolio Final] Network ${networkId} not supported.`);
    return { totalUsdValue: 0, assets: [] };
  }

  // Mapeamento de plataforma CoinGecko por rede
  const coingeckoPlatforms: Record<string, string> = {
    mainnet: "ethereum",
    "sepolia-testnet": "ethereum",
    "goerli-testnet": "ethereum",
    "polygon-mainnet": "polygon-pos",
    "polygon-mumbai": "polygon-pos",
    "arbitrum-mainnet": "arbitrum-one",
    "optimism-mainnet": "optimistic-ethereum",
    // Adicione outros conforme necessário
  };
  const coingeckoPlatform = coingeckoPlatforms[networkId] || "ethereum";

  try {
    // 1. Buscar saldos ERC20
    console.log(`[Portfolio Final] Calling alchemy_getTokenBalances`);
    const balancesResponse = await fetch(alchemyRpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getTokenBalances",
        params: [walletAddress, "erc20"],
      }),
      cache: "no-store",
    });
    console.log(
      `[Portfolio Final] Balances status: ${balancesResponse.status}`
    );
    const balancesBodyText = await balancesResponse.text();

    if (!balancesResponse.ok) {
      console.error(
        `[Portfolio Final] getTokenBalances failed! Status: ${balancesResponse.status}, Body: ${balancesBodyText}`
      );
      return { totalUsdValue: 0, assets: [] };
    }

    let balancesData;
    try {
      balancesData = JSON.parse(balancesBodyText);
    } catch (e) {
      console.error(
        "[Portfolio Final] Failed to parse getTokenBalances JSON:",
        e
      );
      return { totalUsdValue: 0, assets: [] };
    }

    if (
      balancesData.error ||
      !balancesData.result?.tokenBalances ||
      !Array.isArray(balancesData.result.tokenBalances)
    ) {
      console.error(
        "[Portfolio Final] Invalid structure getTokenBalances:",
        balancesData
      );
      return { totalUsdValue: 0, assets: [] };
    }
    const tokenBalances = balancesData.result.tokenBalances;
    console.log(
      `[Portfolio Final] Found ${tokenBalances.length} raw balances.`
    );

    // 2. Buscar metadados Alchemy e logos CoinGecko
    const assetsPromises = tokenBalances
      .filter((b: any) => b.tokenBalance && b.tokenBalance !== "0x0")
      .map(async (b: any): Promise<PortfolioAsset | null> => {
        const contractAddress = b.contractAddress;
        let name = "Unknown Token",
          symbol = "???",
          decimals = 18,
          logoUrl: string | null = null; // Defaults

        // Busca Metadados Alchemy
        try {
          const metadataResponse = await fetch(alchemyRpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: Date.now(),
              method: "alchemy_getTokenMetadata",
              params: [contractAddress],
            }), // ID dinâmico
            cache: "no-store",
          });
          if (metadataResponse.ok) {
            const metadataData = await metadataResponse.json();
            if (metadataData.result) {
              name = metadataData.result.name || name;
              symbol = metadataData.result.symbol || symbol;
              decimals =
                typeof metadataData.result.decimals === "number" &&
                metadataData.result.decimals >= 0
                  ? metadataData.result.decimals
                  : decimals;
            }
          } else {
            console.warn(
              `[Portfolio Final] Metadata fetch fail ${contractAddress} Status: ${metadataResponse.status}`
            );
          }
        } catch (metaError) {
          console.error(
            `[Portfolio Final] Metadata fetch error ${contractAddress}:`,
            metaError
          );
        }

        // Busca Logo CoinGecko (MARCO Y)
        try {
          // Usa plataforma dinâmica para CoinGecko
          const coingeckoUrl = `https://api.coingecko.com/api/v3/coins/${coingeckoPlatform}/contract/${contractAddress}`;
          const geckoResponse = await fetch(coingeckoUrl); // Sem chave necessária
          if (geckoResponse.ok) {
            const geckoData = await geckoResponse.json();
            logoUrl =
              geckoData?.image?.small || geckoData?.image?.thumb || null;
          } else if (geckoResponse.status !== 404) {
            console.warn(
              `[CoinGecko] Logo fetch fail ${contractAddress} Status: ${geckoResponse.status}`
            );
          }
          await new Promise((resolve) => setTimeout(resolve, 300));
        } catch (geckoError) {
          console.error(
            `[CoinGecko] Logo fetch error ${contractAddress}:`,
            geckoError
          );
        }

        const balanceBigInt = BigInt(b.tokenBalance);
        const balanceNumber = Number(balanceBigInt) / 10 ** decimals;
        const balanceFormatted = balanceNumber.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 6,
        });

        return {
          name,
          symbol,
          balance: balanceFormatted,
          usdPrice: 0,
          usdValue: 0,
          logoUrl,
        };
      });
    const assetsResults = await Promise.all(assetsPromises);
    let validAssets = assetsResults.filter(
      (a): a is PortfolioAsset => a !== null
    );
    console.log(
      `[Portfolio Final] Processed metadata/logos for ${validAssets.length} assets.`
    );

    // 3. Adicionar Saldo Nativo (ETH)
    let nativeBalanceFormatted = "0.0000";
    try {
      console.log(`[Portfolio Final] Calling eth_getBalance`);
      const nativeBalanceResponse = await fetch(alchemyRpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "eth_getBalance",
          params: [walletAddress, "latest"],
        }),
        cache: "no-store",
      });
      if (nativeBalanceResponse.ok) {
        const nativeBalanceData = await nativeBalanceResponse.json();
        if (nativeBalanceData.result) {
          const balanceWei = BigInt(nativeBalanceData.result);
          const balanceEth = Number(balanceWei) / 10 ** 18;
          nativeBalanceFormatted = balanceEth.toLocaleString("en-US", {
            minimumFractionDigits: 4,
            maximumFractionDigits: 4,
          });
          console.log(
            `[Portfolio Final] Native balance: ${nativeBalanceFormatted} ETH`
          );
          validAssets.unshift({
            name: "Ethereum",
            symbol: "ETH",
            balance: nativeBalanceFormatted,
            usdPrice: 0,
            usdValue: 0,
            // Logo do ETH adicionado manualmente
            logoUrl:
              "https://assets.coingecko.com/coins/images/279/small/ethereum.png?1696501628",
          });
        }
      } else {
        console.error(
          `[Portfolio Final] eth_getBalance failed. Status: ${nativeBalanceResponse.status}`
        );
      }
    } catch (nativeError) {
      console.error(
        "[Portfolio Final] Error fetching native balance:",
        nativeError
      );
    }

    console.log(
      `[Portfolio Final] Processed. Total assets: ${validAssets.length}`
    );
    return { totalUsdValue: 0, assets: validAssets }; // Valor total ainda é 0
  } catch (error) {
    console.error("[Portfolio Final] CRITICAL UNHANDLED Error:", error);
    return { totalUsdValue: 0, assets: [] };
  }
}
