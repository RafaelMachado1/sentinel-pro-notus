import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();
// Lê o segredo de assinatura GLOBAL da Alchemy do ambiente
const ALCHEMY_SIGNING_SECRET = process.env.ALCHEMY_WEBHOOK_SIGNING_SECRET;

// --- NOVA FUNÇÃO verifySignature (usando Alchemy global secret) ---
async function verifySignature(request: NextRequest, body: string): Promise<boolean> {
  // Alchemy envia a assinatura no header 'x-alchemy-signature'
  const signature = request.headers.get('x-alchemy-signature');

  if (!signature || !ALCHEMY_SIGNING_SECRET) {
    console.warn('[Alchemy Listener] Webhook signature or secret missing.');
    return false;
  }

  try {
    // Calcula o HMAC-SHA256 do corpo RAW usando o segredo global
    const hash = crypto
      .createHmac('sha256', ALCHEMY_SIGNING_SECRET)
      .update(body, 'utf8') // Especifica a codificação do corpo
      .digest('hex'); // A assinatura da Alchemy geralmente está em hexadecimal

    // Comparação segura contra ataques de temporização
    // Garante que ambos os buffers tenham o mesmo tamanho antes de comparar
    const trusted = Buffer.from(hash, 'hex');
    const untrusted = Buffer.from(signature, 'hex');
    if (trusted.length !== untrusted.length) {
        console.warn('[Alchemy Listener] Signature length mismatch.');
        return false;
    }

    return crypto.timingSafeEqual(trusted, untrusted);

  } catch (error) {
    console.error('[Alchemy Listener] Error during signature verification:', error);
    return false;
  }
}

// --- FUNÇÃO sendDiscordAlert (ADAPTADA para payload Alchemy - PRECISA TESTAR/AJUSTAR) ---
async function sendDiscordAlert(targetUrl: string, ruleName: string, payload: any) {
    // O payload da Alchemy para 'alchemy_minedTransactions' é complexo.
    // Veja: https://docs.alchemy.com/reference/alchemy-minedtransactions
    // Precisamos extrair os dados relevantes. O payload principal está em 'event.data.block.transactions'

    console.log('[Alchemy Listener] Preparing Discord alert. Raw payload:', JSON.stringify(payload, null, 2).substring(0, 1000) + '...');

    const activity = payload?.event?.data?.block?.transactions?.[0]; // Assume uma única transação no webhook para simplificar
    const txHash = activity?.hash;
    const blockNum = activity?.blockNumber ? parseInt(activity.blockNumber, 16) : null; // Vem em Hex
    const network = payload?.event?.network; // Ex: ETH_SEPOLIA
    const fromAddr = activity?.from;
    const toAddr = activity?.to; // Pode ser o endereço do contrato

    // Tenta encontrar o endereço do nosso contrato nos logs (se houver) para mais contexto
    // Isso é complexo e depende da decodificação. Para MVP, focamos na transação.
    const contractAddress = toAddr; // Simplificação - assume que 'to' é o contrato monitorado

    const eventName = "Transaction Detected"; // Simplificado, pois não decodificamos logs aqui

    // Tenta extrair 'value' se existir
    let ethValue = '0';
    if (activity?.value) {
        try {
            const valueWei = BigInt(activity.value);
            const valueEth = Number(valueWei) / (10 ** 18);
            ethValue = valueEth.toLocaleString('en-US', {minimumFractionDigits: 4, maximumFractionDigits: 8});
        } catch(e) { console.warn("Could not parse transaction value", activity.value); }
    }


    const explorerUrl = network === 'ETH_SEPOLIA' && txHash ? `https://sepolia.etherscan.io/tx/${txHash}` : '#';

    const message = {
      content: `🚨 **ALERTA SENTINEL (${ruleName})** 🚨`,
      embeds: [
        {
          title: `\`${eventName}\``,
          description: `Uma transação foi detectada envolvendo o endereço monitorado.`,
          color: 3447003, // Cor Azul Alchemy
          fields: [
            { name: 'Rede', value: network || 'N/A', inline: true },
            { name: 'Bloco', value: blockNum ? `#${blockNum}` : 'N/A', inline: true },
            { name: 'De', value: fromAddr ? `\`${fromAddr}\``: 'N/A', inline: false },
            { name: 'Para (Contrato?)', value: contractAddress ? `\`${contractAddress}\`` : 'N/A', inline: false },
            { name: 'Valor ETH', value: `${ethValue} ETH`, inline: true }, // Se for transferência de ETH
            { name: 'Transação (Tx)', value: txHash ? `[Ver no Explorer](${explorerUrl})` : 'N/A', inline: false },
          ],
          footer: { text: 'Sentinel Pro by Alchemy' },
          timestamp: new Date(payload?.event?.id ? payload.event.id.substring(payload.event.id.lastIndexOf(':')+1) * 1000 : Date.now()).toISOString(), // Tenta extrair timestamp do ID do evento
        },
      ],
    };

    const resp = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!resp.ok) {
      console.error('[Alchemy Listener] Failed to send Discord alert:', await resp.text());
    } else {
         console.log('[Alchemy Listener] Discord alert sent successfully.');
    }
}

// --- Handler principal da API Route (REVISADO para Alchemy) ---
export async function POST(request: NextRequest) {
  const body = await request.text(); // Corpo RAW para assinatura

  console.log('[Alchemy Listener] Received webhook request.');
  // Log dos headers para debug (remova em produção se sensível)
  // console.log('[Alchemy Listener] Headers:', JSON.stringify(Object.fromEntries(request.headers.entries())));

  // 1. Verificar Assinatura (usando segredo GLOBAL)
  if (!await verifySignature(request, body)) {
    // Retorna 401 se a assinatura for inválida
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  console.log('[Alchemy Listener] Signature verified successfully.');


  // Assinatura válida, parsear o JSON
  let payload;
  try {
      payload = JSON.parse(body);
  } catch(e) {
      console.error('[Alchemy Listener] Failed to parse webhook JSON body:', e);
      console.error('[Alchemy Listener] Body was:', body.substring(0, 500) + '...');
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // 2. Lógica de Negócio: Encontrar a Regra correspondente
  // Como o webhook é 'alchemy_minedTransactions' filtrado por endereço,
  // precisamos encontrar a(s) regra(s) que monitora(m) esse endereço.
  const activities = payload?.event?.data?.block?.transactions;
  if (!Array.isArray(activities) || activities.length === 0) {
      console.warn('[Alchemy Listener] Webhook payload missing transaction activity.');
       console.log('[Alchemy Listener] Payload received:', JSON.stringify(payload, null, 2));
      return NextResponse.json({ error: 'Webhook payload missing activity' }, { status: 400 });
  }

  // Vamos iterar pelas transações (geralmente será 1) e encontrar as regras correspondentes
  // Usaremos um Set para evitar enviar múltiplos alertas para a mesma regra se houver múltiplas txs no bloco
  const notifiedRuleIds = new Set<string>();

  for (const activity of activities) {
      // O endereço do contrato pode estar em 'to' ou 'from' ou nos logs (mais complexo)
      // Para 'alchemy_minedTransactions' com filtro de 'addresses', o endereço monitorado
      // estará envolvido na transação (de/para).
      const involvedAddresses = [activity?.from, activity?.to].filter(Boolean).map(addr => addr.toLowerCase());
       console.log(`[Alchemy Listener] Tx ${activity?.hash} involves addresses: ${involvedAddresses.join(', ')}`);


      if (involvedAddresses.length === 0) continue;

      try {
        // Busca TODAS as regras que monitoram QUALQUER um dos endereços envolvidos na transação
        const rules = await prisma.rule.findMany({
          where: {
            contractAddress: {
              in: involvedAddresses,
              mode: 'insensitive' // Compara endereços ignorando caixa alta/baixa
            }
          },
          include: { action: true },
        });

        if (rules.length === 0) {
           console.log(`[Alchemy Listener] No matching rules found for addresses involved in tx ${activity?.hash}`);
          continue; // Nenhuma regra para esta transação específica
        }

        console.log(`[Alchemy Listener] Found ${rules.length} matching rules for tx ${activity?.hash}`);

        for (const rule of rules) {
            if (!rule.action || notifiedRuleIds.has(rule.id)) {
                continue; // Regra sem ação ou já notificada neste webhook
            }

            console.log(`[Alchemy Listener] Processing rule: ${rule.name} (ID: ${rule.id})`);

            // 3. (Futuro) Avaliar Condições: Filtrar eventos aqui se necessário
            //    Ex: Se rule.eventName é 'Transfer', verificar logs da transação
            //        Isso exigiria decodificação de logs (complexo)
            //        Por enquanto, notificamos sobre qualquer transação no endereço.

            // 4. Executar a Ação
            if (rule.action.type === 'DISCORD_WEBHOOK') {
              await sendDiscordAlert(rule.action.targetUrl, rule.name, payload); // Passa o payload completo
              notifiedRuleIds.add(rule.id); // Marca como notificada
            } else {
                console.warn(`[Alchemy Listener] Unsupported action type for rule ${rule.id}: ${rule.action.type}`);
            }
        } // Fim do loop de regras

      } catch (error) {
        console.error(`[Alchemy Listener] Error processing rules for tx ${activity?.hash}:`, error);
        // Não retorna erro 500 para não fazer a Alchemy tentar reenviar, a menos que seja crítico
      }
  } // Fim do loop de atividades

  console.log(`[Alchemy Listener] Webhook processing finished. Notified ${notifiedRuleIds.size} rules.`);
  // Retorna 200 OK para a Alchemy saber que recebemos com sucesso
  return NextResponse.json({ success: true }, { status: 200 });
}