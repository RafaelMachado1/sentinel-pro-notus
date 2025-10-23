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
// Removido ALCHEMY_APP_ID pois não estamos criando webhooks programaticamente agora
// const ALCHEMY_APP_ID = process.env.ALCHEMY_APP_ID;
// --- FIM CONFIGURAÇÃO ALCHEMY ---


// --- FUNÇÃO getPortfolioData (MODO DIAGNÓSTICO V5 - Foco no Fetch - Mantida) ---
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
    console.log(`[Alchemy Portfolio V5] Raw getTokenBalances response body:`, balancesBodyText.length < 1000 ? balancesBodyText : balancesBodyText.substring(0, 500) + '...');

    if (!balancesResponse.ok) {
        console.error(`[Alchemy Portfolio V5] getTokenBalances failed! Status: ${balancesResponse.status}, Body: ${balancesBodyText}`);
        return { totalUsdValue: 0, assets: [] }; // Não lança erro para UI
    }

    let balancesData;
    try {
        balancesData = JSON.parse(balancesBodyText);
    } catch (e) {
        console.error('[Alchemy Portfolio V5] Failed to parse JSON response from getTokenBalances:', e);
        console.error('[Alchemy Portfolio V5] Response body was:', balancesBodyText);
        return { totalUsdValue: 0, assets: [] }; // Retorna vazio
    }

    if (balancesData.error || !balancesData.result?.tokenBalances || !Array.isArray(balancesData.result.tokenBalances)) {
        console.error('[Alchemy Portfolio V5] Invalid response structure from getTokenBalances:', balancesData);
        return { totalUsdValue: 0, assets: [] };
    }
    const tokenBalances = balancesData.result.tokenBalances;
    console.log(`[Alchemy Portfolio V5] Found ${tokenBalances.length} raw token balances.`);

    // 2. Buscar metadados
    const assetsPromises = tokenBalances
      .filter((b: any) => b.tokenBalance && b.tokenBalance !== '0x0')
      .map(async (b: any): Promise<PortfolioAsset | null> => {
          const contractAddress = b.contractAddress;
          try {
              const metadataResponse = await fetch(alchemyRpcUrl, {
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
             try { nativeBalanceData = JSON.parse(nativeBalanceBodyText); } catch(e) {
                 console.error('[Alchemy Portfolio V5] Failed to parse eth_getBalance JSON:', e);
                 console.error('[Alchemy Portfolio V5] Response body was:', nativeBalanceBodyText);
                 nativeBalanceData = { result: null }; // Define um fallback
             }

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
             console.error(`[Alchemy Portfolio V5] eth_getBalance failed. Status: ${nativeBalanceResponse.status}, Body: ${nativeBalanceBodyText}`);
        }
    } catch (nativeError) {
        console.error('[Alchemy Portfolio V5] CRITICAL Error fetching native balance:', nativeError);
    }

    console.log(`[Alchemy Portfolio V5] Processed. Total assets (incl. native): ${validAssets.length}`);
    return { totalUsdValue: 0, assets: validAssets };

  } catch (error) {
    // Captura erros lançados pelos JSON.parse ou outros erros inesperados
    console.error('[Alchemy Portfolio V5] CRITICAL UNHANDLED Error:', error);
    return { totalUsdValue: 0, assets: [] };
  }
}


// --- FUNÇÃO createSentinelRule (SIMPLIFICADA - SEM CRIAÇÃO DE WEBHOOK EXTERNO) ---
export async function createSentinelRule(formData: FormData) {
  // Apenas extrai dados e salva no DB localmente
  console.log('[Webhook Create STUB v2] Received request to create rule.'); // Log Atualizado

  // 1. Extrair dados do formulário
  const ruleData = {
    name: formData.get('name') as string,
    ownerAddress: formData.get('ownerAddress') as string,
    networkId: formData.get('networkId') as string,
    contractAddress: formData.get('contractAddress') as string,
    eventName: formData.get('eventName') as string,
    discordUrl: formData.get('discordUrl') as string,
  };

  // *** BLOCO DE CHAMADA PARA ALCHEMY REMOVIDO ***
  console.warn('[Webhook Create STUB v2] Skipping actual Alchemy webhook creation.');
  // Usaremos um placeholder para o ID, pois não temos um ID real da Alchemy
  const placeholderWebhookId = `placeholder_${Date.now()}`;


  // 3. Salvar a regra no nosso DB (com placeholder ID)
  try {
    await prisma.rule.create({
      data: {
        name: ruleData.name,
        ownerAddress: ruleData.ownerAddress,
        networkId: ruleData.networkId,
        contractAddress: ruleData.contractAddress,
        eventName: ruleData.eventName,
        alchemyWebhookId: placeholderWebhookId, // Salva o placeholder no campo renomeado do schema
        action: {
          create: {
            type: 'DISCORD_WEBHOOK',
            targetUrl: ruleData.discordUrl,
            // webhookSecret foi removido do schema
          },
        },
      },
    });
     console.log(`[DB v2] Rule saved successfully with placeholder ID: ${placeholderWebhookId}`);
  } catch (dbError) {
    console.error('[DB v2] Failed to save rule:', dbError);
    throw new Error('Failed to save rule to database');
  }

  // 4. Revalidar o cache
  revalidatePath('/dashboard');
}


// --- FUNÇÃO getSentinelRules (Usa Prisma - Nenhuma mudança necessária) ---
export async function getSentinelRules(ownerAddress: string) {
  noStore();
   console.log(`[DB v2] Fetching rules for owner: ${ownerAddress}`);
  if (!prisma) {
      console.error("[DB v2] Prisma client is not initialized!");
      return [];
  }
  try {
      // Garante que o campo buscado no 'where' está correto
      const rules = await prisma.rule.findMany({ where: { ownerAddress }, orderBy: { createdAt: 'desc' } });
      console.log(`[DB v2] Found ${rules.length} rules.`);
      return rules;
  } catch (dbReadError) {
      console.error('[DB v2] Error fetching rules:', dbReadError);
      return []; // Retorna vazio em caso de erro de leitura
  }
}