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
const ALCHEMY_WEBHOOK_SIGNING_SECRET = process.env.ALCHEMY_WEBHOOK_SIGNING_SECRET; // Para webhook listener e API REST Auth
const ALCHEMY_SEPOLIA_URL = `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const ALCHEMY_APP_ID = process.env.ALCHEMY_APP_ID; // Para criar webhooks
// --- FIM CONFIGURAÇÃO ALCHEMY ---


// --- FUNÇÃO getPortfolioData (MODO DIAGNÓSTICO V5 - Foco no Fetch) ---
export async function getPortfolioData(walletAddress: string, networkId: string = 'sepolia-testnet'): Promise<PortfolioData> {
  noStore();
  console.log(`[Alchemy Portfolio V5] Fetching for ${walletAddress} on ${networkId}`);

  // Verifica se a API Key existe ANTES de construir a URL
  if (!ALCHEMY_API_KEY) {
    console.error('[Alchemy Portfolio V5] CRITICAL: ALCHEMY_API_KEY is not configured!');
    throw new Error('ALCHEMY_API_KEY is not configured');
  } else {
    console.log(`[Alchemy Portfolio V5] Using ALCHEMY_API_KEY starting with: ${ALCHEMY_API_KEY.substring(0, 5)}...`);
  }

  // Verifica se networkId é suportado
  if (networkId !== 'sepolia-testnet') {
      console.warn(`[Alchemy Portfolio V5] Network ${networkId} not supported by this implementation yet.`);
      return { totalUsdValue: 0, assets: [] };
  }

  // Constrói a URL aqui, após verificar a key
  const alchemyRpcUrl = `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

  try {
    // 1. Buscar saldos ERC20
    console.log(`[Alchemy Portfolio V5] Calling alchemy_getTokenBalances for address: ${walletAddress}`);

    // --- LOGS DE DIAGNÓSTICO V5 AO REDOR DO FETCH ---
    console.log(`[DIAG V5] Attempting fetch (getTokenBalances) to: ${alchemyRpcUrl}`);
    const balancesResponse = await fetch(alchemyRpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1, // Static ID is fine for sequential requests
            method: "alchemy_getTokenBalances",
            params: [ walletAddress, "erc20" ]
        }),
        cache: 'no-store'
    });
    console.log(`[DIAG V5] Fetch (getTokenBalances) completed. Status: ${balancesResponse.status}`);
    // --- FIM LOGS DE DIAGNÓSTICO V5 ---

    console.log(`[Alchemy Portfolio V5] Balances response status: ${balancesResponse.status}`);
    const balancesBodyText = await balancesResponse.text(); // Lê como texto primeiro
    // Log do corpo completo se for pequeno, senão truncado
    console.log(`[Alchemy Portfolio V5] Raw getTokenBalances response body:`, balancesBodyText.length < 1000 ? balancesBodyText : balancesBodyText.substring(0, 500) + '...');

    if (!balancesResponse.ok) {
        console.error(`[Alchemy Portfolio V5] getTokenBalances failed! Status: ${balancesResponse.status}, Body: ${balancesBodyText}`);
        // Retorna vazio para o usuário, mas o erro já está logado
        return { totalUsdValue: 0, assets: [] };
        // throw new Error(`Failed to fetch token balances from Alchemy. Status: ${balancesResponse.status}`); // Não lança erro para não quebrar UI
    }

    let balancesData;
    try {
        balancesData = JSON.parse(balancesBodyText);
    } catch (e) {
        console.error('[Alchemy Portfolio V5] Failed to parse JSON response from getTokenBalances:', e);
        console.error('[Alchemy Portfolio V5] Response body was:', balancesBodyText);
        return { totalUsdValue: 0, assets: [] }; // Retorna vazio se não puder parsear
    }

    // Verifica estrutura ANTES de acessar .result
    if (balancesData.error || !balancesData.result?.tokenBalances || !Array.isArray(balancesData.result.tokenBalances)) {
        console.error('[Alchemy Portfolio V5] Invalid response structure from getTokenBalances:', balancesData);
        return { totalUsdValue: 0, assets: [] };
    }
    const tokenBalances = balancesData.result.tokenBalances;
    console.log(`[Alchemy Portfolio V5] Found ${tokenBalances.length} raw token balances.`);

    // 2. Buscar metadados
    const assetsPromises = tokenBalances
      .filter((b: any) => b.tokenBalance && b.tokenBalance !== '0x0') // Filtra saldos zero
      .map(async (b: any): Promise<PortfolioAsset | null> => {
          const contractAddress = b.contractAddress;
          try {
              // console.log(`[Alchemy Portfolio V5] Calling alchemy_getTokenMetadata for ${contractAddress}`); // Opcional
              const metadataResponse = await fetch(alchemyRpcUrl, { // Usa a mesma URL RPC
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      jsonrpc: "2.0",
                      id: 2, // ID diferente
                      method: "alchemy_getTokenMetadata",
                      params: [contractAddress]
                  }),
                  cache: 'no-store'
               });
              const metadataBodyText = await metadataResponse.text();
              if (!metadataResponse.ok) { console.warn(`[Alchemy Portfolio V5] getTokenMetadata fail ${contractAddress} Status: ${metadataResponse.status}`); return null; }
              let metadataData; try { metadataData = JSON.parse(metadataBodyText); } catch(e) { console.error(`[Alchemy Portfolio V5] Parse fail metadata ${contractAddress}`); return null; }
              if (metadataData.error || !metadataData.result) { console.warn(`[Alchemy Portfolio V5] Invalid metadata structure ${contractAddress}`); return null; }

              const metadata = metadataData.result;
              const decimals = (typeof metadata.decimals === 'number' && metadata.decimals >= 0) ? metadata.decimals : 18;
              const balanceBigInt = BigInt(b.tokenBalance);
              const balanceNumber = Number(balanceBigInt) / (10 ** decimals);
              // Formatação consistente
              const balanceFormatted = balanceNumber.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
              return {
                  name: metadata.name || 'Unknown Token',
                  symbol: metadata.symbol || '???',
                  balance: balanceFormatted,
                  usdPrice: 0, // Placeholder
                  usdValue: 0 // Placeholder
                };
          } catch (metaError) { console.error(`[Alchemy Portfolio V5] Error processing metadata for ${contractAddress}:`, metaError); return null; }
      });
    const assetsResults = await Promise.all(assetsPromises);
    let validAssets = assetsResults.filter((a): a is PortfolioAsset => a !== null);
    console.log(`[Alchemy Portfolio V5] Successfully fetched metadata for ${validAssets.length} non-zero assets.`);


    // 3. Adicionar Saldo Nativo (ETH)
    let nativeBalanceFormatted = '0.0000'; // Default formatado
    try {
        console.log(`[Alchemy Portfolio V5] Calling eth_getBalance`);
         // --- LOGS DE DIAGNÓSTICO V5 AO REDOR DO FETCH ---
        console.log(`[DIAG V5] Attempting fetch (eth_getBalance) to: ${alchemyRpcUrl}`);
        const nativeBalanceResponse = await fetch(alchemyRpcUrl, {
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
        console.log(`[DIAG V5] Fetch (eth_getBalance) completed. Status: ${nativeBalanceResponse.status}`);
        // --- FIM LOGS DE DIAGNÓSTICO V5 ---

        const nativeBalanceBodyText = await nativeBalanceResponse.text(); // Lê como texto primeiro
        console.log(`[Alchemy Portfolio V5] Raw eth_getBalance response body:`, nativeBalanceBodyText);

        if (nativeBalanceResponse.ok) {
             let nativeBalanceData;
             try { nativeBalanceData = JSON.parse(nativeBalanceBodyText); } catch(e) { throw new Error('Failed to parse eth_getBalance JSON');} // Lança erro se falhar aqui

             if (nativeBalanceData.result) {
                 const balanceWei = BigInt(nativeBalanceData.result);
                 const balanceEth = Number(balanceWei) / (10 ** 18);
                 nativeBalanceFormatted = balanceEth.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
                 console.log(`[Alchemy Portfolio V5] Native balance found: ${nativeBalanceFormatted} ETH`);
                 validAssets.unshift({ name: 'Ethereum', symbol: 'ETH', balance: nativeBalanceFormatted, usdPrice: 0, usdValue: 0 });
             } else {
                 console.warn(`[Alchemy Portfolio V5] eth_getBalance ok but no result. Data:`, nativeBalanceData);
             }
        } else {
             // O log de erro agora está aqui, não precisamos do [DIAG V5] novamente
             console.error(`[Alchemy Portfolio V5] eth_getBalance failed. Status: ${nativeBalanceResponse.status}, Body: ${nativeBalanceBodyText}`);
             // Não lança erro fatal, apenas não adiciona ETH
        }
    } catch (nativeError) {
        console.error('[Alchemy Portfolio V5] CRITICAL Error fetching native balance:', nativeError);
         // Não lança erro fatal, apenas não adiciona ETH
    }

    console.log(`[Alchemy Portfolio V5] Processed. Total assets (incl. native): ${validAssets.length}`);
    return { totalUsdValue: 0, assets: validAssets }; // Sempre retorna 0 para valor total por enquanto

  } catch (error) {
    // Captura erros lançados pelos JSON.parse ou outros erros inesperados
    console.error('[Alchemy Portfolio V5] CRITICAL UNHANDLED Error:', error);
    return { totalUsdValue: 0, assets: [] };
  }
}


// --- FUNÇÃO createSentinelRule (REVISADA v3 - usando Alchemy API REST) ---
export async function createSentinelRule(formData: FormData) {
  const ALCHEMY_SIGNING_SECRET_LOCAL = process.env.ALCHEMY_WEBHOOK_SIGNING_SECRET;
  const WEBHOOK_CALLBACK_URL = `${process.env.NEXT_PUBLIC_SITE_URL}/api/alchemy-webhook`; // Endpoint do Alchemy Listener
  const ALCHEMY_APP_ID_LOCAL = process.env.ALCHEMY_APP_ID;

  if (!ALCHEMY_SIGNING_SECRET_LOCAL) throw new Error('ALCHEMY_WEBHOOK_SIGNING_SECRET env var is required');
  if (!ALCHEMY_APP_ID_LOCAL) throw new Error('ALCHEMY_APP_ID env var is required');

  const ruleData = {
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
      webhook_type: "alchemy_minedTransactions", // Monitora txs de/para o endereço
      webhook_url: WEBHOOK_CALLBACK_URL,
      app_id: ALCHEMY_APP_ID_LOCAL,
      addresses: [ruleData.contractAddress],
  };

  console.log('[Alchemy Webhook Create V3] Attempting creation:', JSON.stringify(alchemyPayload));
  const response = await fetch(ALCHEMY_CREATE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
          'Authorization': `Bearer ${ALCHEMY_SIGNING_SECRET_LOCAL}`, // Autenticação CORRETA
          'Content-Type': 'application/json',
          'Accept': 'application/json'
       },
      body: JSON.stringify(alchemyPayload),
  });

  const responseBodyText = await response.text();
  console.log(`[Alchemy Webhook Create V3] Response status: ${response.status}`);
  console.log(`[Alchemy Webhook Create V3] Raw response body:`, responseBodyText.substring(0, 500) + '...');

  if (!response.ok) {
      console.error(`[Alchemy Webhook Create V3] API Error! Status: ${response.status}`);
      console.error(`[Alchemy Webhook Create V3] API Body: ${responseBodyText}`);
      let errorDetail = responseBodyText; try { const errorJson = JSON.parse(responseBodyText); errorDetail = errorJson.message || errorJson.error || responseBodyText; } catch(e) {/* Ignore */}
      throw new Error(`Failed to create Alchemy webhook subscription. Status: ${response.status}. Detail: ${errorDetail}`);
  }

  let alchemyData; try { alchemyData = JSON.parse(responseBodyText); } catch(e) {
      console.error('[Alchemy Webhook Create V3] Failed to parse JSON response:', e);
      console.error('[Alchemy Webhook Create V3] Response body was:', responseBodyText);
      throw new Error('Failed to parse JSON response from Alchemy webhook creation');
  }

  // A estrutura CORRETA da resposta parece ser { data: { id: "wh_..." } }
  const alchemyWebhookId = alchemyData?.data?.id;
  if (!alchemyWebhookId) {
      console.error('[Alchemy Webhook Create V3] Invalid response structure, missing data.id:', alchemyData);
      throw new Error('Alchemy API response is missing webhook ID (data.id)');
  }
  console.log(`[Alchemy Webhook Create V3] Webhook created successfully ID: ${alchemyWebhookId}`);

  try {
      await prisma.rule.create({ data: {
          name: ruleData.name, ownerAddress: ruleData.ownerAddress, networkId: ruleData.networkId,
          contractAddress: ruleData.contractAddress, eventName: ruleData.eventName,
          alchemyWebhookId: alchemyWebhookId, // Salva ID Alchemy no campo renomeado
          action: { create: { type: 'DISCORD_WEBHOOK', targetUrl: ruleData.discordUrl } }
      }});
      console.log(`[DB] Rule saved successfully ID: ${alchemyWebhookId}`);
  } catch (dbError) {
      console.error('[DB] Failed to save rule:', dbError);
      // TODO: Implementar exclusão do webhook na Alchemy se o DB falhar
      throw new Error('Failed to save rule to database');
  }
  revalidatePath('/dashboard');
}


// --- FUNÇÃO getSentinelRules (Usa Prisma - Nenhuma mudança necessária) ---
export async function getSentinelRules(ownerAddress: string) {
  noStore();
   console.log(`[DB] Fetching rules for owner: ${ownerAddress}`);
  // Verifica se o prisma client foi inicializado corretamente (debug)
  if (!prisma) {
      console.error("[DB] Prisma client is not initialized!");
      return [];
  }
  try {
      const rules = await prisma.rule.findMany({ where: { ownerAddress }, orderBy: { createdAt: 'desc' } });
      console.log(`[DB] Found ${rules.length} rules.`);
      return rules;
  } catch (dbReadError) {
      console.error('[DB] Error fetching rules:', dbReadError);
      return []; // Retorna vazio em caso de erro de leitura
  }
}