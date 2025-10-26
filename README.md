# Sentinel Pro - Portfolio Multichain

Aplicação web para visualização de portfólio de ativos on-chain em múltiplas redes EVM.

## Como usar

1. Acesse o site e conecte sua carteira (MetaMask, RainbowKit, etc).
2. Escolha a rede desejada no seletor do dashboard.
3. Visualize seus ativos (ETH, tokens ERC20) e seus logos.

## Redes suportadas

- Ethereum Mainnet
- Sepolia Testnet
- Goerli Testnet
- Polygon Mainnet
- Polygon Mumbai
- Arbitrum One
- Optimism

## Limitações

- Apenas redes EVM são suportadas (não inclui Bitcoin, Solana, etc).
- Apenas tokens ERC20 e saldo nativo são exibidos.
- NFTs e outros tipos de ativos não são mostrados.
- O saldo e tokens dependem do provedor RPC (Alchemy) e da rede selecionada.

## Ambiente

- Certifique-se de configurar a variável `ALCHEMY_API_KEY` no ambiente de produção.

## Deploy

O deploy pode ser feito facilmente na Vercel. Após o push para o repositório, a Vercel faz o deploy automático.

---

Projeto baseado em Next.js, React, Tailwind, Prisma e integração com Alchemy/CoinGecko.
