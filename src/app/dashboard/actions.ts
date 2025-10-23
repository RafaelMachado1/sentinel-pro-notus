'use server';
import { unstable_noStore as noStore } from 'next/cache';
import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';

const prisma = new PrismaClient(); // Mantido para getSentinelRules/createSentinelRule

// Interfaces (mantidas, mas usdPrice/usdValue serão 0 por enquanto)
export interface PortfolioAsset {
  name: string;
  symbol: string;
  balance: string;
  usdPrice: number;
  usdValue: number;
}
export interface PortfolioData {
  totalUsdValue: number;
  assets: PortfolioAsset[];
}

// --- CONFIGURAÇÃO DAS APIS ---
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const ALCHEMY_SEPOLIA_URL = `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

const NOTUS_API_KEY = process.env.NOTUS_API_KEY; // Mantido para Webhooks
const NOTUS_API_URL = 'https://api.notus.team/v1'; // Mantido para Webhooks
// --- FIM CONFIGURAÇÃO DAS APIS ---


// --- NOVA FUNÇÃO getPortfolioData (usando Alchemy) ---
export async function getPortfolioData(walletAddress: string, networkId: string = 'sepolia-testnet'): Promise<PortfolioData> {
  noStore();
  console.log(`[Alchemy V1] Fetching portfolio for ${walletAddress} on ${networkId}`);

  if (!ALCHEMY_API_KEY) {
    console.error('[Alchemy V1] ALCHEMY_API_KEY is not configured');
    throw new Error('ALCHEMY_API_KEY is not configured');
  }
  if (networkId !== 'sepolia-testnet') {
      console.warn(`[Alchemy V1] Network ${networkId} not supported by this implementation yet, only Sepolia.`);
      return { totalUsdValue: 0, assets: [] }; // Retorna vazio se não for Sepolia
  }

  try {
    // 1. Buscar saldos de tokens ERC20 usando alchemy_getTokenBalances
    console.log(`[Alchemy V1] Calling alchemy_getTokenBalances for address: ${walletAddress}`);
    const balancesResponse = await fetch(ALCHEMY_SEPOLIA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1, // Use different IDs if running parallel requests, but not necessary here
        method: "alchemy_getTokenBalances",
        params: [
          walletAddress,
          "erc20" // Pede apenas tokens ERC20
        ]
      }),
      cache: 'no-store' // Garante dados frescos
    });

    console.log(`[Alchemy V1] Balances response status: ${balancesResponse.status}`);
    const balancesBodyText = await balancesResponse.text(); // Lê como texto para debug
    console.log(`[Alchemy V1] Raw getTokenBalances response body:`, balancesBodyText.substring(0, 500) + (balancesBodyText.length > 500 ? '...' : ''));

    if (!balancesResponse.ok) {
        console.error(`[Alchemy V1] getTokenBalances failed! Status: ${balancesResponse.status}, Body: ${balancesBodyText}`);
        throw new Error(`Failed to fetch token balances from Alchemy. Status: ${balancesResponse.status}`);
    }

    let balancesData;
    try {
        balancesData = JSON.parse(balancesBodyText);
    } catch (parseError) {
        console.error('[Alchemy V1] Failed to parse JSON response from getTokenBalances:', parseError);
        console.error('[Alchemy V1] Response body was:', balancesBodyText);
        throw new Error('Failed to parse JSON response from Alchemy getTokenBalances');
    }

    if (balancesData.error || !balancesData.result || !Array.isArray(balancesData.result.tokenBalances)) {
        console.error('[Alchemy V1] Invalid response structure from getTokenBalances:', balancesData);
        // Não lance erro, apenas retorne vazio se a estrutura estiver errada
        return { totalUsdValue: 0, assets: [] };
    }

    const tokenBalances = balancesData.result.tokenBalances;
    console.log(`[Alchemy V1] Found ${tokenBalances.length} token balances (including zero balances).`);

    // 2. Buscar metadados (nome, símbolo, decimais) para cada token COM SALDO
    const assetsPromises = tokenBalances
      .filter((balanceInfo: any) => balanceInfo.tokenBalance && balanceInfo.tokenBalance !== '0x0') // Filtra saldos zero AQUI
      .map(async (balanceInfo: any): Promise<PortfolioAsset | null> => {
        const contractAddress = balanceInfo.contractAddress;
        try {
          console.log(`[Alchemy V1] Calling alchemy_getTokenMetadata for token: ${contractAddress}`);
          const metadataResponse = await fetch(ALCHEMY_SEPOLIA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 2, // Use um ID diferente para esta chamada
              method: "alchemy_getTokenMetadata",
              params: [contractAddress]
            }),
            cache: 'no-store'
          });

          console.log(`[Alchemy V1] Metadata response status for ${contractAddress}: ${metadataResponse.status}`);
          const metadataBodyText = await metadataResponse.text(); // Lê como texto para debug
          // Log menos verboso para metadados, exceto em erro
          // console.log(`[Alchemy V1] Raw getTokenMetadata response for ${contractAddress}:`, metadataBodyText.substring(0, 200) + '...');

          if (!metadataResponse.ok) {
              console.warn(`[Alchemy V1] getTokenMetadata failed for ${contractAddress}. Status: ${metadataResponse.status}, Body: ${metadataBodyText}`);
              return null; // Não consegue obter metadados, ignora o token
          }

          let metadataData;
            try {
                metadataData = JSON.parse(metadataBodyText);
            } catch (parseError) {
                console.error(`[Alchemy V1] Failed to parse JSON response from getTokenMetadata for ${contractAddress}:`, parseError);
                console.error(`[Alchemy V1] Response body was:`, metadataBodyText);
                return null; // Falha no parse, ignora token
            }


          if (metadataData.error || !metadataData.result) {
              console.warn(`[Alchemy V1] Invalid response structure from getTokenMetadata for ${contractAddress}:`, metadataData);
              return null;
          }

          const metadata = metadataData.result;
          const decimals = metadata.decimals ?? 18;
          const balanceBigInt = BigInt(balanceInfo.tokenBalance);
          // Conversão cuidadosa para número antes de formatar
          const balanceNumber = Number(balanceBigInt) / (10 ** decimals);
          const balanceFormatted = balanceNumber.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }); // Formata com vírgulas e decimais


          return {
            name: metadata.name || 'Unknown Token',
            symbol: metadata.symbol || '???',
            balance: balanceFormatted, // Usa o saldo formatado
            usdPrice: 0, // PREÇO OMITIDO NESTA VERSÃO
            usdValue: 0, // PREÇO OMITIDO NESTA VERSÃO
          };
        } catch (metaError) {
          console.error(`[Alchemy V1] Error processing metadata for ${contractAddress}:`, metaError);
          return null;
        }
      });

    const assetsResults = await Promise.all(assetsPromises);
    const validAssets = assetsResults.filter((asset): asset is PortfolioAsset => asset !== null);

    // 3. Adicionar Saldo Nativo (ETH) - Usando eth_getBalance
    let nativeBalanceFormatted = '0';
    try {
        console.log(`[Alchemy V1] Calling eth_getBalance for address: ${walletAddress}`);
        const nativeBalanceResponse = await fetch(ALCHEMY_SEPOLIA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 3, // ID diferente
                method: "eth_getBalance",
                params: [walletAddress, "latest"]
            }),
            cache: 'no-store'
        });
        if (nativeBalanceResponse.ok) {
            const nativeBalanceData = await nativeBalanceResponse.json();
            if (nativeBalanceData.result) {
                const balanceWei = BigInt(nativeBalanceData.result);
                const balanceEth = Number(balanceWei) / (10 ** 18);
                nativeBalanceFormatted = balanceEth.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
                console.log(`[Alchemy V1] Native balance found: ${nativeBalanceFormatted} ETH`);
                // Adiciona ETH à lista de ativos
                validAssets.unshift({ // Adiciona no início da lista
                    name: 'Ethereum',
                    symbol: 'ETH',
                    balance: nativeBalanceFormatted,
                    usdPrice: 0, // PREÇO OMITIDO
                    usdValue: 0, // PREÇO OMITIDO
                });
            }
        } else {
             console.warn(`[Alchemy V1] eth_getBalance failed. Status: ${nativeBalanceResponse.status}`);
        }
    } catch (nativeError) {
        console.error('[Alchemy V1] Error fetching native balance:', nativeError);
    }

    // 4. Calcular Total (será 0 sem preços)
    const totalUsdValue = 0;

    console.log(`[Alchemy V1] Portfolio processed. Total valid assets (including native): ${validAssets.length}`);
    return {
      totalUsdValue,
      assets: validAssets,
    };

  } catch (error) {
    console.error('[Alchemy V1] CRITICAL Error fetching portfolio data:', error);
    return { totalUsdValue: 0, assets: [] }; // Retorna vazio em caso de erro
  }
}


// --- FUNÇÃO createSentinelRule (Mantida como estava, usando Notus) ---
export async function createSentinelRule(formData: FormData) {
  const NOTUS_API_KEY_WEBHOOK = process.env.NOTUS_API_KEY; // Renomeia para clareza
  const WEBHOOK_URL = `${process.env.NEXT_PUBLIC_SITE_URL}/api/notus-webhook`;

  if (!NOTUS_API_KEY_WEBHOOK) throw new Error('NOTUS_API_KEY is required for webhooks');

  const ruleData = {
    name: formData.get('name') as string,
    ownerAddress: formData.get('ownerAddress') as string,
    networkId: formData.get('networkId') as string,
    contractAddress: formData.get('contractAddress') as string,
    eventName: formData.get('eventName') as string,
    discordUrl: formData.get('discordUrl') as string,
  };

  const notusPayload = {
    networkId: ruleData.networkId,
    address: ruleData.contractAddress,
    webhookUrl: WEBHOOK_URL,
    abi: `[{ "type": "event", "name": "${ruleData.eventName}", "inputs": [] }]` // ABI Corrigido
  };

  const headers = { 'X-Api-Key': NOTUS_API_KEY_WEBHOOK, 'Content-Type': 'application/json' }; // Usa header da Notus

  const response = await fetch(`${NOTUS_API_URL}/webhooks`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(notusPayload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[Notus Webhook] API Error (Webhook Creation)! Status: ${response.status}`);
    console.error(`[Notus Webhook] API Body (Webhook Creation): ${errorBody}`);
    throw new Error(`Failed to create Notus webhook subscription. Status: ${response.status}`);
  }

  const notusData = await response.json();
  const subscriptionId = notusData?.data?.id;
  const webhookSecret = notusData?.data?.secret;

  if (!subscriptionId || !webhookSecret) {
    console.error('[Notus Webhook] Invalid response structure from Notus webhook creation:', notusData);
    throw new Error('Notus API response is missing id or secret');
  }

  try {
    await prisma.rule.create({
      data: {
        name: ruleData.name,
        ownerAddress: ruleData.ownerAddress,
        networkId: ruleData.networkId,
        contractAddress: ruleData.contractAddress,
        eventName: ruleData.eventName,
        notusSubscriptionId: subscriptionId,
        action: {
          create: {
            type: 'DISCORD_WEBHOOK',
            targetUrl: ruleData.discordUrl,
            webhookSecret: webhookSecret,
          },
        },
      },
    });
  } catch (dbError) {
    console.error('[Notus Webhook] Failed to save rule to DB:', dbError);
    throw new Error('Failed to save rule to database');
  }
  revalidatePath('/dashboard');
}

// --- FUNÇÃO getSentinelRules (Mantida como estava) ---
export async function getSentinelRules(ownerAddress: string) {
  noStore();
  const rules = await prisma.rule.findMany({ where: { ownerAddress }, orderBy: { createdAt: 'desc' } });
  return rules;
}