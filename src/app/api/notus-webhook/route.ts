import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Função para verificar a assinatura (REVISADA E SEGURA)
// Esta lógica segue a documentação da Notus/Svix
async function verifySignature(request: NextRequest, body: string, secret: string): Promise<boolean> {
  const svix_id = request.headers.get('svix-id');
  const svix_timestamp = request.headers.get('svix-timestamp');
  const svix_signature = request.headers.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature || !secret) {
    console.warn('Webhook headers or secret missing for verification.');
    return false;
  }

  // 1. Extrair o segredo (remover o prefixo 'whsec_')
  const secretBytes = Buffer.from(secret.split("_")[1], "base64");

  // 2. Criar o conteúdo assinado
  const signedContent = `${svix_id}.${svix_timestamp}.${body}`;

  // 3. Gerar a assinatura HMAC
  const signature = crypto
    .createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");

  // 4. Comparar as assinaturas
  // A assinatura do header pode ter múltiplas versões (ex: "v1,signature")
  const providedSignatures = svix_signature.split(" ");

  for (const versionedSignature of providedSignatures) {
    const [version, signatureBase64] = versionedSignature.split(",");
    if (version !== 'v1') {
      continue; // Ignorar versões desconhecidas
    }

    // Comparação segura contra ataques de temporização
    try {
      if (crypto.timingSafeEqual(Buffer.from(signatureBase64), Buffer.from(signature))) {
        return true; // Sucesso!
      }
    } catch (e) {
      // Ocorre se os buffers tiverem tamanhos diferentes
      continue;
    }
  }

  console.warn('Webhook signature verification failed.');
  return false;
}

// (A função sendDiscordAlert permanece a mesma)
async function sendDiscordAlert(targetUrl: string, payload: any) {
    const eventData = payload.data.log;
    const txHash = payload.data.txHash;
    const network = payload.networkId;

    const message = {
      content: `🚨 **ALERTA SENTINEL** 🚨`,
      embeds: [
        {
          title: `Evento Detectado: \`${eventData.name}\``,
          color: 15105570, // Laranja/Vermelho
          fields: [
            { name: 'Rede', value: network, inline: true },
            { name: 'Contrato', value: `\`${payload.address}\``, inline: false },
            ...eventData.params.map((p: any) => ({
              name: p.name,
              value: `\`${p.value}\``,
              inline: true,
            })),
            { name: 'Transação (Tx)', value: `[Ver no Explorer](https://sepolia.etherscan.io/tx/${txHash})`, inline: false },
          ],
          footer: { text: 'Sentinel Pro by Notus' },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const resp = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!resp.ok) {
      console.error('Failed to send Discord alert:', await resp.text());
    }
}

// O Handler principal da API Route (REVISADO)
export async function POST(request: NextRequest) {
  const body = await request.text(); // Precisamos do corpo cru (raw)
  const payload = JSON.parse(body);

  // 1. Lógica de Negócio: Encontrar a Regra PRIMEIRO
  let rule;
  try {
    const subscriptionId = payload.subscriptionId; // Este é o 'id' (ex: ep_...)

    // 2. Encontrar a Regra e o Segredo no nosso DB
    rule = await prisma.rule.findUnique({
      where: { notusSubscriptionId: subscriptionId },
      include: { action: true }, // Inclui a Ação (com o segredo)
    });

    if (!rule || !rule.action || !rule.action.webhookSecret) {
      console.warn(`Rule, action, or secret not found for subscriptionId: ${subscriptionId}`);
      return NextResponse.json({ error: 'Rule or secret not found' }, { status: 404 });
    }

    // 3. Verificar Assinatura (usando o segredo do DB)
    const secret = rule.action.webhookSecret;
    if (!await verifySignature(request, body, secret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 4. (Opcional) Avaliar Condições:
    // ... (lógica futura aqui) ...

    // 5. Executar a Ação
    if (rule.action.type === 'DISCORD_WEBHOOK') {
      await sendDiscordAlert(rule.action.targetUrl, payload);
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}