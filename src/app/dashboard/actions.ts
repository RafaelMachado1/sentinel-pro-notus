'use server';
import { unstable_noStore as noStore } from 'next/cache';
import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';
// Biblioteca para calcular o hash do tópico do evento (se necessário para filteredLogs)
// import { id as ethersId } from 'ethers/lib/utils'; // Exemplo com ethers v5

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
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY; // Para chamadas RPC (getBalance, getTokenMetadata)
const ALCHEMY_WEBHOOK_SIGNING_SECRET = process.env.ALCHEMY_WEBHOOK_SIGNING_SECRET; // Para autenticar a API REST de Webhooks e verificar assinaturas
const ALCHEMY_SEPOLIA_URL = `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const ALCHEMY_APP_ID = process.env.ALCHEMY_APP_ID; // Adicione esta variável ao .env.local e Vercel com seu App ID
// --- FIM CONFIGURAÇÃO ALCHEMY ---


// --- FUNÇÃO getPortfolioData (usando Alchemy - Mantida da versão anterior) ---
export async function getPortfolioData(walletAddress: string, networkId: string = 'sepolia-testnet'): Promise<PortfolioData> {
  noStore();
  console.log(`[Alchemy Portfolio] Fetching for ${walletAddress} on ${networkId}`);

  if (!ALCHEMY_API_KEY) throw new Error('ALCHEMY_API_KEY is not configured');
  if (networkId !== 'sepolia-testnet') {
      console.warn(`[Alchemy Portfolio] Network ${networkId} not supported yet.`);
      return { totalUsdValue: 0, assets: [] };
  }

  try {
    // 1. Buscar saldos ERC20
    console.log(`[Alchemy Portfolio] Calling alchemy_getTokenBalances`);
    const balancesResponse = await fetch(ALCHEMY_SEPOLIA_URL, { /* ... alchemy_getTokenBalances ... */ }); // Código omitido - igual anterior
    // ... (processamento da resposta de getTokenBalances) ...
    const balancesBodyText = await balancesResponse.text(); // Lê como texto para debug
    if (!balancesResponse.ok) { /* ... log e throw error ... */ }
    let balancesData; try { balancesData = JSON.parse(balancesBodyText); } catch(e) { /* ... log e throw error ... */ }
    if (balancesData.error || !balancesData.result?.tokenBalances) return { totalUsdValue: 0, assets: [] };
    const tokenBalances = balancesData.result.tokenBalances;

    // 2. Buscar metadados
    const assetsPromises = tokenBalances
      .filter((b: any) => b.tokenBalance && b.tokenBalance !== '0x0')
      .map(async (b: any): Promise<PortfolioAsset | null> => {
          const contractAddress = b.contractAddress;
          try {
              console.log(`[Alchemy Portfolio] Calling alchemy_getTokenMetadata for ${contractAddress}`);
              const metadataResponse = await fetch(ALCHEMY_SEPOLIA_URL, { /* ... alchemy_getTokenMetadata ... */ }); // Código omitido - igual anterior
             // ... (processamento da resposta de getTokenMetadata) ...
             const metadataBodyText = await metadataResponse.text(); // Lê como texto para debug
             if (!metadataResponse.ok) return null;
             let metadataData; try { metadataData = JSON.parse(metadataBodyText); } catch(e) { return null; }
             if (metadataData.error || !metadataData.result) return null;
             const metadata = metadataData.result;
             const decimals = (typeof metadata.decimals === 'number' && metadata.decimals >= 0) ? metadata.decimals : 18;
             const balanceBigInt = BigInt(b.tokenBalance);
             const balanceNumber = Number(balanceBigInt) / (10 ** decimals);
             const balanceFormatted = balanceNumber.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
             return { name: metadata.name || '?', symbol: metadata.symbol || '?', balance: balanceFormatted, usdPrice: 0, usdValue: 0 };
          } catch (metaError) { console.error(`[Alchemy Portfolio] Error processing metadata for ${contractAddress}:`, metaError); return null; }
      });
    const assetsResults = await Promise.all(assetsPromises);
    let validAssets = assetsResults.filter((a): a is PortfolioAsset => a !== null);

    // 3. Adicionar Saldo Nativo (ETH)
    let nativeBalanceFormatted = '0';
    try {
        console.log(`[Alchemy Portfolio] Calling eth_getBalance`);
        const nativeBalanceResponse = await fetch(ALCHEMY_SEPOLIA_URL, { /* ... eth_getBalance ... */ }); // Código omitido - igual anterior
        if (nativeBalanceResponse.ok) { /* ... processa e adiciona ETH ... */
            const nativeBalanceData = await nativeBalanceResponse.json();
             if (nativeBalanceData.result) {
                 const balanceWei = BigInt(nativeBalanceData.result);
                 const balanceEth = Number(balanceWei) / (10 ** 18);
                 nativeBalanceFormatted = balanceEth.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
                 validAssets.unshift({ name: 'Ethereum', symbol: 'ETH', balance: nativeBalanceFormatted, usdPrice: 0, usdValue: 0 });
             }
        } else { console.warn(`[Alchemy V1] eth_getBalance failed`); }
    } catch (nativeError) { console.error('[Alchemy Portfolio] Error fetching native balance:', nativeError); }

    console.log(`[Alchemy Portfolio] Processed. Assets: ${validAssets.length}`);
    return { totalUsdValue: 0, assets: validAssets };

  } catch (error) {
    console.error('[Alchemy Portfolio] CRITICAL Error:', error);
    return { totalUsdValue: 0, assets: [] };
  }
}


// --- FUNÇÃO createSentinelRule (REVISADA v3 - usando Alchemy API REST) ---
export async function createSentinelRule(formData: FormData) {
  const ALCHEMY_SIGNING_SECRET_LOCAL = process.env.ALCHEMY_WEBHOOK_SIGNING_SECRET; // Usado como Auth Token
  const WEBHOOK_CALLBACK_URL = `${process.env.NEXT_PUBLIC_SITE_URL}/api/alchemy-webhook`; // Novo endpoint listener
  const ALCHEMY_APP_ID_LOCAL = process.env.ALCHEMY_APP_ID; // Usa variável de ambiente

  if (!ALCHEMY_SIGNING_SECRET_LOCAL) throw new Error('ALCHEMY_WEBHOOK_SIGNING_SECRET env var is required');
  if (!ALCHEMY_APP_ID_LOCAL) throw new Error('ALCHEMY_APP_ID env var is required');

  // 1. Extrair dados do formulário
  const ruleData = {
    name: formData.get('name') as string,
    ownerAddress: formData.get('ownerAddress') as string, // Apenas para salvar no DB
    networkId: formData.get('networkId') as string, // Ex: "sepolia-testnet"
    contractAddress: formData.get('contractAddress') as string,
    eventName: formData.get('eventName') as string, // Ex: "Transfer" -> Usaremos para filtragem posterior
    discordUrl: formData.get('discordUrl') as string,
  };

  // Adapta o networkId para o formato da Alchemy (ex: ETH_SEPOLIA)
  let alchemyNetwork: string;
  if (ruleData.networkId === 'sepolia-testnet') {
      alchemyNetwork = 'ETH_SEPOLIA';
  } else {
      throw new Error(`Unsupported network: ${ruleData.networkId}`);
  }

  // 2. Chamar a API REST da Alchemy para criar a subscrição
  // Endpoint CORRETO: https://docs.alchemy.com/reference/create-webhook
  const ALCHEMY_CREATE_WEBHOOK_URL = 'https://dashboard.alchemy.com/api/create-webhook';

  // Usamos 'alchemy_minedTransactions' e filtramos pelo endereço.
  // Filtrar por evento específico aqui exigiria `alchemy_filteredLogs` e cálculo de `topics`.
  const alchemyPayload = {
      network: alchemyNetwork,
      webhook_type: "alchemy_minedTransactions",
      webhook_url: WEBHOOK_CALLBACK_URL,
      app_id: ALCHEMY_APP_ID_LOCAL, // App ID agora da env var
      addresses: [ruleData.contractAddress],
  };

   console.log('[Alchemy Webhook Create] Attempting creation with payload:', JSON.stringify(alchemyPayload));

  const response = await fetch(ALCHEMY_CREATE_WEBHOOK_URL, {
    method: 'POST',
    // Autenticação usa o Signing Secret como Bearer Token
    headers: {
        'Authorization': `Bearer ${ALCHEMY_SIGNING_SECRET_LOCAL}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
     },
    body: JSON.stringify(alchemyPayload),
  });

  const responseBodyText = await response.text();
  console.log(`[Alchemy Webhook Create] Response status: ${response.status}`);
  console.log(`[Alchemy Webhook Create] Raw response body:`, responseBodyText.substring(0, 500) + '...');

  if (!response.ok) {
    console.error(`[Alchemy Webhook Create] API Error! Status: ${response.status}`);
    console.error(`[Alchemy Webhook Create] API Body: ${responseBodyText}`);
    let errorDetail = responseBodyText;
    try { const errorJson = JSON.parse(responseBodyText); errorDetail = errorJson.message || errorJson.error || responseBodyText; } catch(e) {/* Ignore */}
    throw new Error(`Failed to create Alchemy webhook subscription. Status: ${response.status}. Detail: ${errorDetail}`);
  }

  let alchemyData;
  try {
      alchemyData = JSON.parse(responseBodyText);
  } catch(e) {
       console.error('[Alchemy Webhook Create] Failed to parse JSON response:', e);
       console.error('[Alchemy Webhook Create] Response body was:', responseBodyText);
       throw new Error('Failed to parse JSON response from Alchemy webhook creation');
  }

  // O ID do webhook criado pela Alchemy está em `data.id`
  const alchemyWebhookId = alchemyData?.data?.id;

  if (!alchemyWebhookId) {
      console.error('[Alchemy Webhook Create] Invalid response structure, missing data.id:', alchemyData);
    throw new Error('Alchemy API response is missing webhook ID (data.id)');
  }
   console.log(`[Alchemy Webhook Create] Webhook created successfully with ID: ${alchemyWebhookId}`);


  // 3. Salvar a regra no nosso DB
  try {
    await prisma.rule.create({
      data: {
        name: ruleData.name,
        ownerAddress: ruleData.ownerAddress,
        networkId: ruleData.networkId,
        contractAddress: ruleData.contractAddress,
        eventName: ruleData.eventName,
        alchemyWebhookId: alchemyWebhookId, // Salva o ID da Alchemy no campo renomeado
        action: {
          create: {
            type: 'DISCORD_WEBHOOK',
            targetUrl: ruleData.discordUrl,
            // webhookSecret não existe mais no schema
          },
        },
      },
    });
     console.log(`[DB] Rule saved successfully with Alchemy ID: ${alchemyWebhookId}`);
  } catch (dbError) {
    console.error('[DB] Failed to save rule:', dbError);
    // TODO: Implementar exclusão do webhook na Alchemy se o DB falhar
    throw new Error('Failed to save rule to database');
  }

  // 4. Revalidar o cache
  revalidatePath('/dashboard');
}


// --- FUNÇÃO getSentinelRules (Usa Prisma - Nenhuma mudança necessária aqui) ---
export async function getSentinelRules(ownerAddress: string) {
  noStore();
   console.log(`[DB] Fetching rules for owner: ${ownerAddress}`);
  const rules = await prisma.rule.findMany({ where: { ownerAddress }, orderBy: { createdAt: 'desc' } });
   console.log(`[DB] Found ${rules.length} rules.`);
  return rules;
}