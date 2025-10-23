'use server';
import { unstable_noStore as noStore } from 'next/cache';
import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';

const prisma = new PrismaClient();

// --- Interfaces ---
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

// --- CONFIGURAÇÃO ALCHEMY ---
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const ALCHEMY_WEBHOOK_SIGNING_SECRET = process.env.ALCHEMY_WEBHOOK_SIGNING_SECRET; // Para webhook listener
const ALCHEMY_SEPOLIA_URL = `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const ALCHEMY_APP_ID = process.env.ALCHEMY_APP_ID; // Para criar webhooks
// --- FIM CONFIGURAÇÃO ALCHEMY ---


// --- FUNÇÃO getPortfolioData (MODO DIAGNÓSTICO V5 - Foco no Fetch) ---
export async function getPortfolioData(walletAddress: string, networkId: string = 'sepolia-testnet'): Promise<PortfolioData> {
  noStore();
  console.log(`[Alchemy Portfolio V5] Fetching for ${walletAddress} on ${networkId}`);

  if (!ALCHEMY_API_KEY) {
    console.error('[Alchemy Portfolio V5] ALCHEMY_API_KEY is not configured');
    throw new Error('ALCHEMY_API_KEY is not configured');
  }
  if (networkId !== 'sepolia-testnet') {
      console.warn(`[Alchemy Portfolio V5] Network ${networkId} not supported yet.`);
      return { totalUsdValue: 0, assets: [] };
  }

  try {
    // 1. Buscar saldos ERC20
    console.log(`[Alchemy Portfolio V5] Calling alchemy_getTokenBalances for address: ${walletAddress}`);

    // --- LOGS DE DIAGNÓSTICO V5 AO REDOR DO FETCH ---
    console.log(`[DIAG V5] Attempting fetch to: ${ALCHEMY_SEPOLIA_URL}`);
    const balancesResponse = await fetch(ALCHEMY_SEPOLIA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "alchemy_getTokenBalances",
            params: [ walletAddress, "erc20" ]
        }),
        cache: 'no-store'
    });
    console.log(`[DIAG V5] Fetch completed. Status: ${balancesResponse.status}`);
    // --- FIM LOGS DE DIAGNÓSTICO V5 ---

    console.log(`[Alchemy Portfolio V5] Balances response status: ${balancesResponse.status}`);
    const balancesBodyText = await balancesResponse.text();
    console.log(`[Alchemy Portfolio V5] Raw getTokenBalances response body:`, balancesBodyText.substring(0, 500) + (balancesBodyText.length > 500 ? '...' : ''));

    if (!balancesResponse.ok) {
        console.error(`[Alchemy Portfolio V5] getTokenBalances failed! Status: ${balancesResponse.status}, Body: ${balancesBodyText}`);
        throw new Error(`Failed to fetch token balances from Alchemy. Status: ${balancesResponse.status}`);
    }

    let balancesData;
    try { balancesData = JSON.parse(balancesBodyText); } catch (e) { /* ... log e throw error ... */
        console.error('[Alchemy Portfolio V5] Failed to parse JSON response from getTokenBalances:', e);
        console.error('[Alchemy Portfolio V5] Response body was:', balancesBodyText);
        throw new Error('Failed to parse JSON response from Alchemy getTokenBalances');
    }

    if (balancesData.error || !balancesData.result?.tokenBalances) {
        console.error('[Alchemy Portfolio V5] Invalid response structure from getTokenBalances:', balancesData);
        return { totalUsdValue: 0, assets: [] };
    }
    const tokenBalances = balancesData.result.tokenBalances;
    console.log(`[Alchemy Portfolio V5] Found ${tokenBalances.length} token balances.`);

    // 2. Buscar metadados (código igual à versão anterior)
    const assetsPromises = tokenBalances
      .filter((b: any) => b.tokenBalance && b.tokenBalance !== '0x0')
      .map(async (b: any): Promise<PortfolioAsset | null> => { /* ... busca metadata ... */
          const contractAddress = b.contractAddress;
          try {
              // console.log(`[Alchemy Portfolio V5] Calling alchemy_getTokenMetadata for ${contractAddress}`); // Menos verboso agora
              const metadataResponse = await fetch(ALCHEMY_SEPOLIA_URL, { /* ... alchemy_getTokenMetadata payload ... */ });
              const metadataBodyText = await metadataResponse.text();
              if (!metadataResponse.ok) { console.warn(`[Alchemy Portfolio V5] getTokenMetadata fail ${contractAddress} Status: ${metadataResponse.status}`); return null; }
              let metadataData; try { metadataData = JSON.parse(metadataBodyText); } catch(e) { console.error(`[Alchemy Portfolio V5] Parse fail metadata ${contractAddress}`); return null; }
              if (metadataData.error || !metadataData.result) { console.warn(`[Alchemy Portfolio V5] Invalid metadata structure ${contractAddress}`); return null; }
              const metadata = metadataData.result;
              const decimals = (typeof metadata.decimals === 'number' && metadata.decimals >= 0) ? metadata.decimals : 18;
              const balanceBigInt = BigInt(b.tokenBalance);
              const balanceNumber = Number(balanceBigInt) / (10 ** decimals);
              const balanceFormatted = balanceNumber.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
              return { name: metadata.name || '?', symbol: metadata.symbol || '?', balance: balanceFormatted, usdPrice: 0, usdValue: 0 };
          } catch (metaError) { console.error(`[Alchemy Portfolio V5] Error processing metadata for ${contractAddress}:`, metaError); return null; }
      });
    const assetsResults = await Promise.all(assetsPromises);
    let validAssets = assetsResults.filter((a): a is PortfolioAsset => a !== null);

    // 3. Adicionar Saldo Nativo (ETH) (código igual à versão anterior)
    let nativeBalanceFormatted = '0';
    try {
        console.log(`[Alchemy Portfolio V5] Calling eth_getBalance`);
        const nativeBalanceResponse = await fetch(ALCHEMY_SEPOLIA_URL, { /* ... eth_getBalance payload ... */ });
        if (nativeBalanceResponse.ok) {
             const nativeBalanceData = await nativeBalanceResponse.json();
             if (nativeBalanceData.result) {
                 const balanceWei = BigInt(nativeBalanceData.result);
                 const balanceEth = Number(balanceWei) / (10 ** 18);
                 nativeBalanceFormatted = balanceEth.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
                 console.log(`[Alchemy Portfolio V5] Native balance found: ${nativeBalanceFormatted} ETH`);
                 validAssets.unshift({ name: 'Ethereum', symbol: 'ETH', balance: nativeBalanceFormatted, usdPrice: 0, usdValue: 0 });
             } else { console.warn(`[Alchemy Portfolio V5] eth_getBalance ok but no result.`); }
        } else { console.warn(`[Alchemy Portfolio V5] eth_getBalance failed. Status: ${nativeBalanceResponse.status}`); }
    } catch (nativeError) { console.error('[Alchemy Portfolio V5] Error fetching native balance:', nativeError); }

    console.log(`[Alchemy Portfolio V5] Processed. Assets: ${validAssets.length}`);
    return { totalUsdValue: 0, assets: validAssets };

  } catch (error) {
    console.error('[Alchemy Portfolio V5] CRITICAL Error:', error);
    return { totalUsdValue: 0, assets: [] };
  }
}


// --- FUNÇÃO createSentinelRule (REVISADA v3 - usando Alchemy API REST) ---
export async function createSentinelRule(formData: FormData) {
    const ALCHEMY_SIGNING_SECRET_LOCAL = process.env.ALCHEMY_WEBHOOK_SIGNING_SECRET;
    const WEBHOOK_CALLBACK_URL = `${process.env.NEXT_PUBLIC_SITE_URL}/api/alchemy-webhook`;
    const ALCHEMY_APP_ID_LOCAL = process.env.ALCHEMY_APP_ID;

    if (!ALCHEMY_SIGNING_SECRET_LOCAL) throw new Error('ALCHEMY_WEBHOOK_SIGNING_SECRET env var is required');
    if (!ALCHEMY_APP_ID_LOCAL) throw new Error('ALCHEMY_APP_ID env var is required');

    const ruleData = { /* ... extrai dados ... */
        name: formData.get('name') as string,
        ownerAddress: formData.get('ownerAddress') as string,
        networkId: formData.get('networkId') as string,
        contractAddress: formData.get('contractAddress') as string,
        eventName: formData.get('eventName') as string,
        discordUrl: formData.get('discordUrl') as string,
    };
    let alchemyNetwork: string;
    if (ruleData.networkId === 'sepolia-testnet') { alchemyNetwork = 'ETH_SEPOLIA'; }
    else { throw new Error(`Unsupported network: ${ruleData.networkId}`); }

    const ALCHEMY_CREATE_WEBHOOK_URL = 'https://dashboard.alchemy.com/api/create-webhook';
    const alchemyPayload = {
        network: alchemyNetwork,
        webhook_type: "alchemy_minedTransactions",
        webhook_url: WEBHOOK_CALLBACK_URL,
        app_id: ALCHEMY_APP_ID_LOCAL,
        addresses: [ruleData.contractAddress],
    };

    console.log('[Alchemy Webhook Create] Attempting creation:', JSON.stringify(alchemyPayload));
    const response = await fetch(ALCHEMY_CREATE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${ALCHEMY_SIGNING_SECRET_LOCAL}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(alchemyPayload),
    });

    const responseBodyText = await response.text();
    console.log(`[Alchemy Webhook Create] Response status: ${response.status}`);
    console.log(`[Alchemy Webhook Create] Raw response body:`, responseBodyText.substring(0, 500) + '...');

    if (!response.ok) { /* ... log e throw error ... */
        console.error(`[Alchemy Webhook Create] API Error! Status: ${response.status}`);
        console.error(`[Alchemy Webhook Create] API Body: ${responseBodyText}`);
        let errorDetail = responseBodyText; try { const errorJson = JSON.parse(responseBodyText); errorDetail = errorJson.message || errorJson.error || responseBodyText; } catch(e) {/* Ignore */}
        throw new Error(`Failed to create Alchemy webhook subscription. Status: ${response.status}. Detail: ${errorDetail}`);
    }

    let alchemyData; try { alchemyData = JSON.parse(responseBodyText); } catch(e) { /* ... log e throw error ... */
        console.error('[Alchemy Webhook Create] Failed to parse JSON response:', e);
        console.error('[Alchemy Webhook Create] Response body was:', responseBodyText);
        throw new Error('Failed to parse JSON response from Alchemy webhook creation');
    }
    const alchemyWebhookId = alchemyData?.data?.id;
    if (!alchemyWebhookId) { /* ... log e throw error ... */
        console.error('[Alchemy Webhook Create] Invalid response structure, missing data.id:', alchemyData);
        throw new Error('Alchemy API response is missing webhook ID (data.id)');
    }
    console.log(`[Alchemy Webhook Create] Webhook created successfully ID: ${alchemyWebhookId}`);

    try {
        await prisma.rule.create({ data: { /* ... dados da regra ... */
            name: ruleData.name, ownerAddress: ruleData.ownerAddress, networkId: ruleData.networkId,
            contractAddress: ruleData.contractAddress, eventName: ruleData.eventName,
            alchemyWebhookId: alchemyWebhookId, // Salva ID Alchemy
            action: { create: { type: 'DISCORD_WEBHOOK', targetUrl: ruleData.discordUrl, } }
        }});
        console.log(`[DB] Rule saved successfully ID: ${alchemyWebhookId}`);
    } catch (dbError) { /* ... log e throw error ... */
        console.error('[DB] Failed to save rule:', dbError);
        throw new Error('Failed to save rule to database');
    }
    revalidatePath('/dashboard');
}


// --- FUNÇÃO getSentinelRules (Usa Prisma - Nenhuma mudança necessária) ---
export async function getSentinelRules(ownerAddress: string) {
  noStore();
   console.log(`[DB] Fetching rules for owner: ${ownerAddress}`);
  const rules = await prisma.rule.findMany({ where: { ownerAddress }, orderBy: { createdAt: 'desc' } });
   console.log(`[DB] Found ${rules.length} rules.`);
  return rules;
}