# Sentinel Pro - Portfolio Multichain

## Descrição

Sentinel Pro é uma aplicação web que permite ao usuário visualizar e acompanhar seu portfólio de ativos 
on-chain em múltiplas redes EVM. O app conecta sua carteira (MetaMask, RainbowKit, etc.), busca saldos 
nativos e tokens ERC20, exibe logos dos ativos e permite alternar entre diferentes redes suportadas.

---

## Funcionalidades

- **Conexão com carteira Web3**: Suporte a MetaMask, RainbowKit e outras carteiras compatíveis.
- **Seleção de rede**: Visualize seus ativos em Ethereum Mainnet, Sepolia, Goerli, Polygon, Arbitrum, 
Optimism e outras redes EVM.
- **Exibição de portfólio**: Mostra saldo nativo (ETH, MATIC, etc.) e tokens ERC20, com nome, símbolo, 
saldo e logo.
- **Busca de logos**: Integração com CoinGecko para exibir o logo de cada token.
- **UI moderna**: Interface responsiva, dark mode, feedbacks claros e tratamento de erros.

---

## Como Usar

1. **Acesse o site** (em produção ou local).
2. **Conecte sua carteira** usando o botão no topo.
3. **Escolha a rede** desejada no seletor do dashboard.
4. **Visualize seus ativos**: saldo nativo e tokens ERC20, com logos e informações detalhadas.

---

## Redes Suportadas

- Ethereum Mainnet
- Sepolia Testnet
- Goerli Testnet
- Polygon Mainnet
- Polygon Mumbai
- Arbitrum One
- Optimism

_(Outras redes EVM podem ser adicionadas facilmente)_

---

## Limitações

- **Apenas redes EVM**: Não suporta Bitcoin, Solana ou outras redes não-EVM.
- **Apenas tokens ERC20 e saldo nativo**: NFTs e outros tipos de ativos não são exibidos.
- **Dependência de provedores RPC**: O saldo e tokens dependem do Alchemy (ou outro RPC) e da rede 
selecionada.
- **Limite de requisições**: APIs públicas (ex: CoinGecko) podem limitar o número de requisições por 
minuto.

---

## Instalação e Execução Local

```bash
# Instale as dependências
npm install

# Configure a variável de ambiente
# Crie um arquivo .env.local e adicione sua chave do Alchemy:
ALCHEMY_API_KEY=seu_token_aqui

# Rode o servidor de desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000) para usar o app.

---

## Deploy

- O deploy pode ser feito facilmente na Vercel.
- Após o push para o repositório, a Vercel faz o deploy automático.
- Certifique-se de configurar a variável `ALCHEMY_API_KEY` no ambiente de produção.

---

## Estrutura do Projeto

```
src/
  app/
    dashboard/
      page.tsx         # Dashboard multichain
      actions.ts       # Backend de busca de ativos
    layout.tsx         # Layout global
    page.tsx           # Landing page
    providers.tsx      # Contexto de autenticação
  components/
    dashboard/
      PortfolioSummary.tsx
      PortfolioTable.tsx
    Header.tsx
    3d-scene.tsx
prisma/
  schema.prisma        # Configuração do banco (opcional)
public/
  ...                  # Assets públicos
.env.local             # Variáveis de ambiente
README.md              # Documentação
```

---

## Tecnologias Utilizadas

- Next.js (React)
- Tailwind CSS
- Prisma (opcional)
- RainbowKit, Wagmi (autenticação Web3)
- Alchemy (RPC multichain)
- CoinGecko (logos de tokens)
- Chart.js (gráficos)
- Vercel (deploy)

---

## Contribuição

Pull requests são bem-vindos!  
Para sugerir melhorias, abra uma issue ou envie um PR.

---

## Licença

MIT
