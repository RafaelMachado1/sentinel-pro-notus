'use server';
import { unstable_noStore as noStore } from 'next/cache';

// Tipos de dados para o nosso portfólio
export interface PortfolioAsset {
  name: string;
  symbol: string;
  balance: string; // Saldo formatado
  usdPrice: number;
  usdValue: number;
}

export interface PortfolioData {
  totalUsdValue: number;
  assets: PortfolioAsset[];
}

const NOTUS_API_KEY = process.env.NOTUS_API_KEY;
const NOTUS_API_URL = 'https://api.notus.team/v1';

export async function getPortfolioData(walletAddress: string, networkId: string = 'sepolia-testnet'): Promise<PortfolioData> {
  noStore(); // Marca esta função como dinâmica
  if (!NOTUS_API_KEY) {
    throw new Error('NOTUS_API_KEY is not configured');
  }

  const headers = { 'X-Api-Key': NOTUS_API_KEY, 'Content-Type': 'application/json' };

  try {
    // 1. Buscar os tokens da carteira
    const tokensResponse = await fetch(`${NOTUS_API_URL}/wallets/${walletAddress}/tokens?networkId=${networkId}`, { headers });
    if (!tokensResponse.ok) throw new Error('Failed to fetch tokens');
    const tokensData = await tokensResponse.json();

    // 2. Buscar os preços desses tokens
    const tokenAddresses = tokensData.data.map((token: any) => token.address);

    const assets: PortfolioAsset[] = await Promise.all(
      tokensData.data.map(async (token: any): Promise<PortfolioAsset> => {
        let usdPrice = 0;
        try {
          const priceResponse = await fetch(`${NOTUS_API_URL}/tokens/${token.address}/price?networkId=${networkId}`, { headers });
          if (priceResponse.ok) {
            const priceData = await priceResponse.json();
            usdPrice = priceData.data.usdPrice;
          }
        } catch (priceError) {
          console.warn(`Could not fetch price for ${token.symbol}: ${priceError}`);
        }

        const balance = (BigInt(token.balance) / BigInt(10 ** token.decimals)).toString();
        const usdValue = parseFloat(balance) * usdPrice;

        return {
          name: token.name,
          symbol: token.symbol,
          balance: balance,
          usdPrice: usdPrice,
          usdValue: usdValue,
        };
      })
    );

    // 3. Calcular o total
    const totalUsdValue = assets.reduce((acc, asset) => acc + asset.usdValue, 0);

    return {
      totalUsdValue,
      assets,
    };

  } catch (error) {
    console.error('Error fetching portfolio data:', error);
    return { totalUsdValue: 0, assets: [] };
  }
}