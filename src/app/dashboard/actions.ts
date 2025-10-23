'use server';
// FORÇANDO UM NOVO BUILD EM: 23/10 11:42 (Hora atual)
import { unstable_noStore as noStore } from 'next/cache';
// Imports do Marco 7
import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';

// Cliente Prisma do Marco 7
const prisma = new PrismaClient();

// --- LÓGICA DO MARCO 5 ---
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

// FUNÇÃO getPortfolioData (CORRIGIDA + MODO DEBUG)
export async function getPortfolioData(walletAddress: string, networkId: string = 'sepolia-testnet'): Promise<PortfolioData> {
  noStore();
  if (!NOTUS_API_KEY) {
    throw new Error('NOTUS_API_KEY is not configured');
  }

  // --- CORREÇÃO 1: Testando formato do header ---
  const headers = {
    'Authorization': `Bearer ${NOTUS_API_KEY}`, // MUDADO DE X-Api-Key
    'Content-Type': 'application/json'
  };
  // --- FIM DA CORREÇÃO 1 ---

  const url = `${NOTUS_API_URL}/wallets/${walletAddress}/tokens?networkId=${networkId}`;

  try {
    console.log(`[DEBUG] Fetching Notus data from: ${url}`);
    const tokensResponse = await fetch(url, { headers });

    // --- BLOCO DE DEBUG (MANTIDO) ---
    if (!tokensResponse.ok) {
      const errorBody = await tokensResponse.text();
      console.error(`[DEBUG] Notus API Error! Status: ${tokensResponse.status}`);
      console.error(`[DEBUG] Notus API Body: ${errorBody}`);
      throw new Error(`Failed to fetch tokens. Status: ${tokensResponse.status}`);
    }
    // --- FIM DO BLOCO DE DEBUG ---

    const tokensData = await tokensResponse.json();

    const assets: PortfolioAsset[] = await Promise.all(
      tokensData.data.map(async (token: any): Promise<PortfolioAsset> => {
        let usdPrice = 0;
        try {
          // Usa os mesmos headers corrigidos para a chamada de preço
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
    const totalUsdValue = assets.reduce((acc, asset) => acc + asset.usdValue, 0);

    console.log(`[DEBUG] Portfolio data fetched successfully. Assets: ${assets.length}`);
    return {
      totalUsdValue,
      assets,
    };

  } catch (error) {
    console.error('Error fetching portfolio data:', error);
    return { totalUsdValue: 0, assets: [] };
  }
}


// --- LÓGICA DO MARCO 7 (REVISADA) ---

//
// FUNÇÃO PARA CRIAR A REGRA (CORRIGIDA)
//
export async function createSentinelRule(formData: FormData) {
  const NOTUS_API_KEY = process.env.NOTUS_API_KEY;
  const WEBHOOK_URL = `${process.env.NEXT_PUBLIC_SITE_URL}/api/notus-webhook`;

  // 1. Extrair dados do formulário
  const ruleData = {
    name: formData.get('name') as string,
    ownerAddress: formData.get('ownerAddress') as string,
    networkId: formData.get('networkId') as string,
    contractAddress: formData.get('contractAddress') as string,
    eventName: formData.get('eventName') as string,
    discordUrl: formData.get('discordUrl') as string,
  };

  // 2. Chamar a API da Notus para criar a subscrição
  const notusPayload = {
    networkId: ruleData.networkId,
    address: ruleData.contractAddress,
    webhookUrl: WEBHOOK_URL,
    // --- CORREÇÃO 2: String ABI ---
    abi: `[{ "type": "event", "name": "${ruleData.eventName}", "inputs": [] }]` // ASPAS CORRIGIDAS
    // --- FIM DA CORREÇÃO 2 ---
  };

  // --- Usa o mesmo formato de header corrigido ---
  const headers = {
    'Authorization': `Bearer ${NOTUS_API_KEY}`,
    'Content-Type': 'application/json'
  };
  // ---

  const response = await fetch(`${NOTUS_API_URL}/webhooks`, {
    method: 'POST',
    headers: headers, // Usa os headers corrigidos
    body: JSON.stringify(notusPayload),
  });

  if (!response.ok) {
    // Adiciona log de debug aqui também
    const errorBody = await response.text();
    console.error(`[DEBUG] Notus API Error (Webhook Creation)! Status: ${response.status}`);
    console.error(`[DEBUG] Notus API Body (Webhook Creation): ${errorBody}`);
    throw new Error(`Failed to create Notus webhook subscription. Status: ${response.status}`);
  }

  const notusData = await response.json();

  const subscriptionId = notusData.data.id;
  const webhookSecret = notusData.data.secret;

  if (!subscriptionId || !webhookSecret) {
    throw new Error('Notus API response is missing id or secret');
  }

  // 3. Salvar a regra e a ação no nosso DB (com o segredo)
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
    console.error('Failed to save rule to DB:', dbError);
    // TODO: Idealmente, deveríamos deletar a subscrição da Notus se o DB falhar.
    throw new Error('Failed to save rule to database');
  }

  // 4. Revalidar o cache do dashboard para mostrar a nova regra
  revalidatePath('/dashboard');
}

//
// FUNÇÃO PARA LER AS REGRAS (sem mudanças)
//
export async function getSentinelRules(ownerAddress: string) {
  noStore();
  const rules = await prisma.rule.findMany({
    where: { ownerAddress },
    orderBy: { createdAt: 'desc' },
  });
  return rules;
}