# Sentinel Pro - Portfolio Multichain

## Descrição

Sentinel Pro é uma aplicação web para visualização de portfólio de ativos on-chain em múltiplas redes EVM. O objetivo é ser um projeto didático, explicando cada etapa, tecnologia e decisão de arquitetura para quem está estudando Web3, Next.js e integração com carteiras.

---

## Índice

- [Funcionalidades](#funcionalidades)
- [Arquitetura e Fluxo de Dados](#arquitetura-e-fluxo-de-dados)
- [Tecnologias e Dependências](#tecnologias-e-dependências)
- [Explicação dos Arquivos e Códigos](#explicação-dos-arquivos-e-códigos)
- [Como Usar](#como-usar)
- [Redes Suportadas](#redes-suportadas)
- [Limitações](#limitações)
- [Guia de Arquitetura Avançado](#guia-de-arquitetura-avançado)
- [Instalação e Execução Local](#instalação-e-execução-local)
- [Deploy](#deploy)
- [Contribuição](#contribuição)
- [Licença](#licença)

---

## Funcionalidades

- Conexão com carteira Web3 (MetaMask, RainbowKit, etc.)
- Seleção de rede EVM (Ethereum, Polygon, Arbitrum, etc.)
- Exibição de saldo nativo e tokens ERC20, com nome, símbolo, saldo e logo
- Busca de logos via CoinGecko
- UI moderna, responsiva e com tratamento de erros

---

## Arquitetura e Fluxo de Dados

O fluxo principal é:

**Usuário (Carteira) → Frontend Next.js → Server Action → [Alchemy RPC + CoinGecko] → UI Vercel**

- O usuário conecta a carteira e seleciona a rede.
- O frontend dispara uma ação no servidor que busca dados via Alchemy (RPC) e CoinGecko (logos).
- Os dados são processados e exibidos na interface.

**Desacoplamento:**  
A lógica de dados (busca de ativos) é separada da UI, permitindo evolução independente.

---

## Tecnologias e Dependências

- **Next.js**: Framework React para aplicações web modernas.
- **React**: Biblioteca para construção de interfaces.
- **Tailwind CSS**: Framework de estilos utilitário.
- **Prisma**: ORM para banco de dados (opcional, usado em versões anteriores).
- **RainbowKit, Wagmi**: Autenticação Web3 e conexão de carteira.
- **Alchemy**: Provedor RPC para múltiplas redes EVM.
- **CoinGecko**: API pública para logos de tokens.
- **Chart.js, react-chartjs-2**: Gráficos de portfólio.
- **Vercel**: Plataforma de deploy.

**Principais dependências instaladas:**

```json
{
  "@prisma/client": "...",
  "@rainbow-me/rainbowkit": "...",
  "@react-three/drei": "...",
  "@react-three/fiber": "...",
  "@tanstack/react-query": "...",
  "maath": "...",
  "next": "...",
  "react": "...",
  "react-dom": "...",
  "three": "...",
  "viem": "...",
  "wagmi": "...",
  "chart.js": "...",
  "react-chartjs-2": "..."
}
```

---

## Explicação dos Arquivos e Códigos

### Estrutura do Projeto

```
src/
  app/
    dashboard/
      page.tsx         # Dashboard multichain (frontend)
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
ARCHITECTURE_GUIDE.md  # Guia técnico detalhado
```

---

### Explicação dos Principais Arquivos

#### 1. `src/app/dashboard/page.tsx` (Dashboard)

- **Função:** Renderiza o dashboard, conecta a carteira, permite seleção de rede e exibe os ativos.
- **Client Component:** Usa React e hooks para gerenciar estado.
- **useEffect:** Dispara a busca de dados sempre que a carteira ou rede muda.
- **Tratamento de erros:** Exibe mensagens amigáveis se não houver ativos ou ocorrer erro.

#### 2. `src/app/dashboard/actions.ts` (Backend de Dados)

- **Função:** Busca os ativos do usuário via Alchemy (RPC) e logos via CoinGecko.
- **getPortfolioData:** Função principal que:
  - Lê a chave `ALCHEMY_API_KEY` do ambiente.
  - Faz chamada JSON-RPC para buscar saldos e metadados.
  - Usa `Promise.all` para buscar logos em paralelo.
  - Converte saldos de BigInt (Wei) para decimal.
  - Busca saldo nativo separadamente.
  - Insere logos e dados no array de ativos.

#### 3. `src/app/layout.tsx` (Layout Global)

- Define o layout padrão da aplicação, incluindo o header fixo e o contexto de autenticação.

#### 4. `src/app/page.tsx` (Landing Page)

- Renderiza a tela inicial com animação 3D e botão para acessar o dashboard.

#### 5. `src/app/providers.tsx` (Contexto de Autenticação)

- Configura RainbowKit, Wagmi e React Query para autenticação e conexão de carteira.

#### 6. `src/components/dashboard/PortfolioSummary.tsx`

- Exibe o valor total do portfólio e um gráfico (mockado) de evolução.

#### 7. `src/components/dashboard/PortfolioTable.tsx`

- Renderiza a tabela de ativos, mostrando nome, símbolo, saldo, valor e logo.

#### 8. `src/components/Header.tsx`

- Exibe o header fixo com botão de conexão de carteira.

#### 9. `src/components/3d-scene.tsx`

- Renderiza a animação 3D da landing page usando Three.js.

#### 10. `prisma/schema.prisma` (Opcional)

- Define o schema do banco de dados (usado em versões anteriores para sentinelas).

#### 11. `.env.local`

- Armazena variáveis de ambiente, como `ALCHEMY_API_KEY` e `MANUAL_DB_URL`.

#### 12. `ARCHITECTURE_GUIDE.md`

- Guia técnico detalhado, explicando toda a arquitetura, decisões de engenharia e funcionamento do projeto.
- **[Leia o guia completo aqui.](./ARCHITECTURE_GUIDE.md)**

---

## Como Usar

1. Acesse o site ou rode localmente.
2. Conecte sua carteira.
3. Escolha a rede desejada.
4. Visualize seus ativos e logos.

---

## Redes Suportadas

- Ethereum Mainnet
- Sepolia Testnet
- Goerli Testnet
- Polygon Mainnet
- Polygon Mumbai
- Arbitrum One
- Optimism

---

## Limitações

- Apenas redes EVM (não inclui Bitcoin, Solana, etc.)
- Apenas tokens ERC20 e saldo nativo.
- NFTs não são exibidos.
- Depende do provedor RPC (Alchemy) e da rede selecionada.
- APIs públicas podem limitar o número de requisições.

---

## Guia de Arquitetura Avançado

Para um estudo aprofundado da arquitetura, decisões técnicas e funcionamento do Sentinel Pro, consulte o arquivo [ARCHITECTURE_GUIDE.md](./ARCHITECTURE_GUIDE.md).

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

## Contribuição

Pull requests são bem-vindos!  
Para sugerir melhorias, abra uma issue ou envie um PR.

---

## Licença

MIT
