# Sentinel Pro - Portfolio Multichain

## Descrição

Sentinel Pro é uma aplicação web para visualização de portfólio de ativos on-chain em múltiplas redes EVM. O objetivo é ser um projeto didático, 
explicando cada etapa, tecnologia e decisão de arquitetura para quem está estudando Web3, Next.js e integração com carteiras.

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
```tsx
"use client"; // 👈 Contexto: Marca este como um Componente Cliente. Essencial para usar hooks do React e do Wagmi (Web3).
import { useAccount } from "wagmi"; // Hook da Wagmi para obter status de conexão e o endereço da carteira.
import { useState, useEffect } from "react"; // Hooks fundamentais do React.
import { getPortfolioData, PortfolioData } from "./actions"; // Importa a Server Action e as interfaces de dados do backend.

// Importa os componentes de apresentação.
import PortfolioSummary from "@/components/dashboard/PortfolioSummary";
import PortfolioTable from "@/components/dashboard/PortfolioTable";

// Define o componente principal do Dashboard.
export default function DashboardPage() {
  // 1. Estados da Conexão Web3 (Wagmi)
  const { address, isConnected } = useAccount(); // O sensor que detecta a carteira.

  // 2. Estados Locais (React)
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null); // Estado para armazenar os dados de ativos.
  const [isLoading, setIsLoading] = useState(true); // Estado de carregamento (mostra spinner enquanto busca dados).
  const [selectedNetwork, setSelectedNetwork] = useState("sepolia-testnet"); // Estado da rede ativa, default é Sepolia.

  // 3. Mapeamento de Redes Suportadas (para o seletor)
  const networks = [
    { id: "mainnet", label: "Ethereum Mainnet" },
    { id: "sepolia-testnet", label: "Sepolia Testnet" },
    // ... mapeamento de outras redes EVM ...
  ];

  const [errorMsg, setErrorMsg] = useState<string | null>(null); // Estado para exibir mensagens de erro.

  // 4. Efeito de Busca de Dados (O Gatilho Central)
  useEffect(() => {
    setErrorMsg(null); // Reseta a mensagem de erro a cada nova busca.

    // 🎯 AÇÃO: Só prossegue se a carteira estiver CONECTADA e o ENDEREÇO estiver DISPONÍVEL.
    if (isConnected && address) {
      setIsLoading(true);

      // 📞 CHAMADA AO BACKEND (SERVER ACTION)
      getPortfolioData(address, selectedNetwork) // Envia o endereço e a rede selecionada para o servidor.
        .then((data) => {
          setPortfolioData(data);
          setIsLoading(false);

          // ⚠️ TRATAMENTO DE ERRO: Se a API retornar sucesso, mas o array de ativos estiver vazio.
          if (!data.assets || data.assets.length === 0) {
            setErrorMsg("Nenhum ativo encontrado nesta rede ou carteira.");
          }
        })
        .catch((error) => {
          // 🛑 TRATAMENTO DE ERRO CRÍTICO: Se a Server Action falhar (ex: API Key inválida, timeout).
          console.error("[DashboardPage] Error fetching portfolio:", error);
          setIsLoading(false);
          setErrorMsg(
            "Erro ao buscar ativos. Verifique a rede selecionada ou tente novamente mais tarde."
          );
        });
    } else {
      // Caso o usuário se desconecte, limpa os dados e encerra o carregamento.
      setPortfolioData(null);
      setIsLoading(false);
    }
  }, [isConnected, address, selectedNetwork]); // 🔑 DEPENDÊNCIAS: Este efeito roda novamente SEMPRE que a conexão, o endereço ou a rede mudar.

  // 5. Renderização Condicional - Desconectado
  if (!isConnected) {
    return (
      <div className="max-w-7xl mx-auto px-4 text-center py-20">
        <h2 className="text-2xl font-bold">Por favor, conecte sua carteira</h2>
        <p className="text-slate-400 mt-2">
          Conecte sua carteira para visualizar seu portfólio.
        </p>
      </div>
    );
  }

  // 6. Renderização Condicional - Carregando
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 text-center py-20">
        Carregando dados do portfólio...
      </div>
    );
  }

  // 7. Renderização Principal (Dados Carregados)
  return (
    <div className="max-w-7xl mx-auto px-4 pb-12">
      {/* Exibe o sumário (gráfico e valor total) */}
      <PortfolioSummary totalValue={portfolioData?.totalUsdValue ?? 0} />

      {/* Seletor de rede e Título */}
      <div className="flex items-center gap-4 mb-8 mt-10">
        <h2 className="text-2xl font-bold text-white">Meus Ativos</h2>
        <select
          value={selectedNetwork}
          // Atualiza o estado da rede, o que dispara o useEffect para buscar novos dados.
          onChange={(e) => setSelectedNetwork(e.target.value)} 
          className="bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none"
        >
          {networks.map((net) => (
            <option key={net.id} value={net.id}>
              {net.label}
            </option>
          ))}
        </select>
      </div>

      {/* Exibe a mensagem de erro, se houver */}
      {errorMsg && (
        <div className="text-slate-400 text-center py-4 mb-4 bg-slate-900/60 border border-slate-800 rounded-xl">
          {errorMsg}
        </div>
      )}

      {/* Exibe a tabela de ativos */}
      <PortfolioTable assets={portfolioData?.assets ?? []} isLoading={false} />
    </div>
  );
}
```

---

#### 2. `src/app/dashboard/actions.ts` (Backend de Dados)

- **Função:** Busca os ativos do usuário via Alchemy (RPC) e logos via CoinGecko.
- **getPortfolioData:** Função principal que:
  - Lê a chave `ALCHEMY_API_KEY` do ambiente.
  - Faz chamada JSON-RPC para buscar saldos e metadados.
  - Usa `Promise.all` para buscar logos em paralelo.
  - Converte saldos de BigInt (Wei) para decimal.
  - Busca saldo nativo separadamente.
  - Insere logos e dados no array de ativos.

```tsx

"use server"; // 👈 Contexto de Segurança: Garante que este código só roda no servidor, protegendo a ALCHEMY_API_KEY.
import { unstable_noStore as noStore } from "next/cache"; // Desativa o cache de requisições de dados do Next.js (garante dados frescos).

// Interfaces não mais necessárias para o Prisma ou revalidatePath foram removidas.

// --- Interfaces (Contrato de Dados) ---
export interface PortfolioAsset {
  name: string;
  symbol: string;
  balance: string;
  usdPrice: number; // 💡 Placeholder: Dados de preço não são buscados (valor 0).
  usdValue: number; // Placeholder: Valor total não é calculado.
  logoUrl?: string | null; // Adicionado para logos da CoinGecko.
}
// ... (PortfolioData interface similar)

// --- CONFIGURAÇÃO ALCHEMY ---
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY; // 🔑 Chave sensível lida do ambiente.
// --- FIM CONFIGURAÇÃO ALCHEMY ---

// --- FUNÇÃO getPortfolioData (O Centro de Comando) ---
export async function getPortfolioData(
  walletAddress: string,
  networkId: string = "sepolia-testnet"
): Promise<PortfolioData> {
  noStore(); // Reafirma o no-caching para garantir dados em tempo real.
  
  if (!ALCHEMY_API_KEY) {
    console.error("[Portfolio Final] CRITICAL: ALCHEMY_API_KEY is not configured!");
    return { totalUsdValue: 0, assets: [] }; // Falha de segurança/configuração retorna vazio.
  }

  // 🗺️ Mapeamento Multi-Chain (Flexibilidade e Escalabilidade)
  const rpcUrls: Record<string, string> = {
    // Mapeia IDs de rede (usados na UI) para os endpoints RPC CORRETOS da Alchemy.
    mainnet: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    "sepolia-testnet": `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    // ... outros mapeamentos
  };
  const alchemyRpcUrl = rpcUrls[networkId];
  if (!alchemyRpcUrl) {
    console.warn(`[Portfolio Final] Network ${networkId} not supported.`);
    return { totalUsdValue: 0, assets: [] }; // Retorna vazio se a rede não for suportada.
  }

  // 🌐 Mapeamento CoinGecko (Conexão off-chain)
  const coingeckoPlatforms: Record<string, string> = {
    // Mapeia IDs de rede para os IDs de 'plataforma' usados pela CoinGecko (e.g., Ethereum = 'ethereum', Polygon = 'polygon-pos').
    mainnet: "ethereum",
    "polygon-mainnet": "polygon-pos",
    // ...
  };
  const coingeckoPlatform = coingeckoPlatforms[networkId] || "ethereum"; // Fallback para 'ethereum'.

  try {
    // 1. Busca Principal: Saldos ERC20 (JSON-RPC)
    console.log(`[Portfolio Final] Calling alchemy_getTokenBalances`);
    const balancesResponse = await fetch(alchemyRpcUrl, {
      method: "POST", // 👈 JSON-RPC usa o método POST.
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getTokenBalances", // 👈 Método Alchemy para buscar todos os saldos ERC20 de uma vez.
        params: [walletAddress, "erc20"], // Parâmetros: Endereço do usuário e filtro para ERC20.
      }),
      cache: "no-store", // Garante que a chamada RPC não seja cacheada.
    });
    
    // ... (Tratamento de erro de rede e parsing inicial)
    const balancesBodyText = await balancesResponse.text();
    if (!balancesResponse.ok) { /* ... log de erro e return ... */ }
    let balancesData; try { balancesData = JSON.parse(balancesBodyText); } catch (e) { return { totalUsdValue: 0, assets: [] }; }

    // 🛡️ Validação da estrutura de dados da API.
    if (balancesData.error || !balancesData.result?.tokenBalances || !Array.isArray(balancesData.result.tokenBalances)) {
      console.error("[Portfolio Final] Invalid structure getTokenBalances:", balancesData);
      return { totalUsdValue: 0, assets: [] };
    }
    const tokenBalances = balancesData.result.tokenBalances;


    // 2. Processamento Paralelo: Metadados e Logos (O Fan-Out)
    const assetsPromises = tokenBalances
      // Filtra tokens com saldo zero ('0x0').
      .filter((b: any) => b.tokenBalance && b.tokenBalance !== "0x0")
      // Mapeia cada token restante para uma Promise assíncrona de busca de metadados/logo.
      .map(async (b: any): Promise<PortfolioAsset | null> => {
        const contractAddress = b.contractAddress;
        let name = "Unknown Token", symbol = "???", decimals = 18, logoUrl: string | null = null; // Defaults

        // 2a. Busca Metadados Alchemy (Nome, Símbolo, Decimais)
        try {
          const metadataResponse = await fetch(alchemyRpcUrl, { /* ... alchemy_getTokenMetadata payload ... */ });
          // ... (Lógica de extração e tratamento de erro/fallback para name, symbol, decimals)
        } catch (metaError) { /* ... log error ... */ }

        // 2b. Busca Logo CoinGecko (Enriquecimento Visual - Marco Y)
        try {
          const coingeckoUrl = `https://api.coingecko.com/api/v3/coins/${coingeckoPlatform}/contract/${contractAddress}`;
          const geckoResponse = await fetch(coingeckoUrl); // 🔑 API REST pública (sem chave)
          if (geckoResponse.ok) {
            const geckoData = await geckoResponse.json();
            logoUrl = geckoData?.image?.small || geckoData?.image?.thumb || null; // Extrai URL do logo
          } else if (geckoResponse.status !== 404) {
            console.warn(`[CoinGecko] Logo fetch fail ${contractAddress} Status: ${geckoResponse.status}`);
          }
          // ⚠️ Mitigação de Risco: Pausa de 300ms contra Rate Limit. (Trade-off: latência).
          await new Promise((resolve) => setTimeout(resolve, 300));
        } catch (geckoError) { /* ... log error ... */ }

        // 🔢 Conversão de Saldo (BigInt para decimal)
        const balanceBigInt = BigInt(b.tokenBalance); // Lendo o saldo em sua menor unidade (Wei) como BigInt
        const balanceNumber = Number(balanceBigInt) / 10 ** decimals; // Conversão para formato humano (decimal)
        const balanceFormatted = balanceNumber.toLocaleString("en-US", { /* ... */ });

        return { /* ... Objeto PortfolioAsset final com logoUrl ... */ };
      });
      
    const assetsResults = await Promise.all(assetsPromises); // 🚀 Executa todas as buscas em paralelo
    let validAssets = assetsResults.filter((a): a is PortfolioAsset => a !== null);

    // 3. Adicionar Saldo Nativo (ETH/MATIC)
    let nativeBalanceFormatted = "0.0000";
    try {
      console.log(`[Portfolio Final] Calling eth_getBalance`);
      const nativeBalanceResponse = await fetch(alchemyRpcUrl, {
        method: "POST",
        body: JSON.stringify({
          method: "eth_getBalance", // 👈 Método RPC para saldo nativo
          params: [walletAddress, "latest"],
        }),
        cache: "no-store",
      });
      if (nativeBalanceResponse.ok) {
        // ... (Lógica de conversão de BigInt para decimal e inclusão do asset ETH)
        const balanceWei = BigInt(nativeBalanceData.result);
        validAssets.unshift({ /* ... asset ETH com logoUrl fixo ... */ });
      } else {
        console.error(`[Portfolio Final] eth_getBalance failed. Status: ${nativeBalanceResponse.status}`);
      }
    } catch (nativeError) {
      console.error("[Portfolio Final] Error fetching native balance:", nativeError);
    }

    // 🏁 Fim do Processo
    return { totalUsdValue: 0, assets: validAssets }; // Retorna o portfólio (Valor total é 0, pois não buscamos preço)
  } catch (error) {
    console.error("[Portfolio Final] CRITICAL UNHANDLED Error:", error);
    return { totalUsdValue: 0, assets: [] }; // Fallback de segurança
  }
}
```
---
#### 3. `src/app/layout.tsx` (Layout Global)

- Define o layout padrão da aplicação, incluindo o header fixo e o contexto de autenticação.

```tsx
import type { Metadata } from "next"; // 👈 Tipo de metadados do Next.js para SEO e cabeçalhos.
import { Inter } from "next/font/google"; // 👈 Importa a fonte otimizada do Google (usando o Next.js Font Optimization).
import "../globals.css"; // 👈 Importa os estilos globais (Tailwind CSS, etc.).
import { Providers } from "./providers"; // 👈 Importa o componente que envolve o contexto Web3 (Wagmi/RainbowKit).
import Header from "@/components/Header"; // 👈 Importa o cabeçalho fixo da aplicação.

const inter = Inter({ subsets: ["latin"] }); // 👈 Carrega a fonte Inter para otimização e performance.

// 🌐 Metadados (SEO)
export const metadata: Metadata = {
  title: "Sentinel Pro", // Título que aparece na aba do navegador.
  description: "Asset intelligence and security hub.", // Descrição para motores de busca.
};

// 🏗️ Componente de Layout Principal
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Define a linguagem e ativa o dark mode como padrão.
    <html lang="pt-BR" className="dark">
      <body className={`${inter.className} bg-slate-950 text-white`}>
        
        {/* 🧩 Provedores de Contexto Web3 */}
        {/* O componente Providers envolve toda a aplicação, disponibilizando o contexto Wagmi, RainbowKit e QueryClient. */}
        <Providers> 
          
          {/* 🖼️ Cabeçalho Fixo */}
          <Header /> 
          
          {/* 💻 Área de Conteúdo Principal */}
          <main className="pt-20">
            {/* O pt-20 (padding-top de 5rem) é crucial. 
               Ele evita que o conteúdo principal fique escondido ou sobreposto 
               pelo Header, que é posicionado de forma fixa (fixed). */}
            {children} {/* 👈 O conteúdo da página atual (e.g., dashboard/page.tsx) é renderizado aqui. */}
          </main>
        </Providers>
      </body>
    </html>
  );
}

```

---

#### 4. `src/app/page.tsx` (Landing Page)

- Renderiza a tela inicial com animação 3D e botão para acessar o dashboard.

```tsx
// 🌐 Importa o componente de animação 3D. O Next.js trata este como um Módulo JS normal.
import ThreeScene from "../components/3d-scene"; 
// 🔗 Importa o componente Link do Next.js, otimizado para navegação interna (SPA - Single Page Application).
import Link from "next/link"; 

// Define o componente da Rota Raiz (/)
export default function Home() {
  return (
    // 1. Container Principal (Layout)
    //    - relative w-full h-screen: Garante que a div ocupe toda a altura da tela.
    //    - flex items-center justify-center: Centraliza o conteúdo (bloco de texto) no meio da tela.
    //    - -mt-20: Compensa o padding-top de 5rem (pt-20) que o layout.tsx aplica para o Header fixo.
    <div className="relative w-full h-screen flex items-center justify-center text-center -mt-20">
      
      {/* 2. Animação 3D: É o fundo visualmente impactante. */}
      <ThreeScene />

      {/* 3. Bloco de Conteúdo (Texto e Botão)
        - relative z-10: CRUCIAL. Eleva este bloco ACIMA da cena 3D, que é o fundo (z-0).
      */}
      <div className="relative z-10 p-8 flex flex-col items-center">
        
        {/* Título Principal (com efeito gradiente) */}
        <h1
          className="text-6xl md:text-8xl font-black tracking-tighter uppercase bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400"
          style={{ textShadow: "0 0 30px rgba(14, 165, 233, 0.5)" }}
        >
          Sentinel Pro
        </h1>
        
        {/* Descrição Curta */}
        <p className="mt-4 text-lg md:text-xl text-slate-400 max-w-2xl">
          Visualize e acompanhe seu portfólio de ativos on-chain em tempo real.
          Simples, rápido e seguro.
        </p>
        
        {/* Botão de Chamada para Ação (Call to Action) */}
        <Link
          href="/dashboard" // 🎯 Direciona para a rota /dashboard (nosso Dashboard Principal)
          // Estilização com efeitos de transição (hover:scale-105)
          className="mt-12 inline-block bg-sky-500 hover:bg-sky-600 text-white font-bold text-lg py-3 px-8 rounded-full transition-all duration-300 transform hover:scale-105 shadow-lg shadow-sky-500/30 hover:shadow-xl hover:shadow-sky-500/50"
        >
          Ver meu Portfólio
        </Link>
      </div>
    </div>
  );
}

```

---

#### 5. `src/app/providers.tsx` (Contexto de Autenticação)

- Configura RainbowKit, Wagmi e React Query para autenticação e conexão de carteira.

```tsx
'use client'; // 👈 Contexto: Necessário para usar hooks do React e do Wagmi/RainbowKit.

// Importa os estilos CSS do RainbowKit (interface visual).
import '@rainbow-me/rainbowkit/styles.css'; 
// Funções principais para configurar e prover a interface do RainbowKit.
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
// O provedor central da Wagmi, que gerencia o estado da conexão e os dados da blockchain.
import { WagmiProvider } from 'wagmi';
// Importa a definição da rede Sepolia (a testnet que usamos como foco).
import { sepolia } from 'wagmi/chains';
// Provedor e cliente para React Query, usado pelo Wagmi para caching e gerenciamento de requisições assíncronas.
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
// Tipo fundamental do React.
import { ReactNode } from 'react'; 

// 🔑 Variável Crítica: Project ID fornecido pelo WalletConnect Cloud.
// É essencial para conectar a carteira via QR code (MetaMask Mobile, Trust Wallet, etc.).
const WALLETCONNECT_PROJECT_ID = 'ad3437032082220b3254f41aa1de99f7'; 

// ⚙️ Configuração Base (Wagmi/RainbowKit)
const config = getDefaultConfig({
  appName: 'Sentinel Pro', // Nome do seu dApp, exibido na interface de conexão.
  projectId: WALLETCONNECT_PROJECT_ID, // Chave de serviço WalletConnect.
  chains: [sepolia], // Define as redes que o dApp suporta.
  ssr: true, // Habilita Server-Side Rendering para melhor SEO e carregamento inicial.
});

// Cria uma instância do cliente de query (caching)
const queryClient = new QueryClient();

// 🏗️ Componente Provedor Principal
// Ele envolve toda a aplicação no layout.tsx.
export function Providers({ children }: { children: ReactNode }) {
  return (
    // 1. Provedor Wagmi: O nível mais baixo. Gerencia a conexão com a carteira (e.g., está conectado? qual endereço?).
    <WagmiProvider config={config}>
      {/* 2. Provedor React Query: Wagmi usa o React Query para buscar dados (saldos, metadados) e gerenciar o cache dessas chamadas. */}
      <QueryClientProvider client={queryClient}>
        {/* 3. Provedor RainbowKit: O nível superior. Fornece a interface visual (o modal "Connect Wallet"). */}
        <RainbowKitProvider>
          {children} {/* 👈 Renderiza todo o conteúdo do seu aplicativo. */}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

---

#### 6. `src/components/dashboard/PortfolioSummary.tsx`

- Exibe o valor total do portfólio e um gráfico (mockado) de evolução.
```tsx
'use client'; // 👈 Contexto: Necessário para usar hooks do React e bibliotecas interativas como react-chartjs-2.
import { Line } from 'react-chartjs-2'; // Importa o componente de gráfico de linha.
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js'; // Importa módulos essenciais do Chart.js.

// ⚙️ Registro de Componentes do Chart.js
// É necessário registrar manualmente cada componente (escalas, pontos, linhas, etc.) que será usado para evitar que o bundle final inclua partes não utilizadas.
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// 📊 Dados Mockados (Exemplo de Estrutura de Dados)
// Em uma versão completa, estes dados seriam buscados do backend (actions.ts) a partir de snapshots históricos.
const chartData = {
  labels: ['-7d', '-6d', '-5d', '-4d', '-3d', '-2d', 'Hoje'], // Rótulos para o eixo X (tempo)
  datasets: [{
      data: [1180, 1195, 1210, 1205, 1220, 1230, 1248], // Valores fictícios da evolução do portfólio em USD
      backgroundColor: 'rgba(14, 165, 233, 0.2)', // Cor de fundo abaixo da linha (transparente)
      borderColor: '#0ea5e9', // Cor da linha (sky-500)
      borderWidth: 2,
      pointRadius: 0, // Pontos desativados para um visual limpo de 'área'
      tension: 0.4, // Suaviza a curva da linha
      fill: true, // Habilita o preenchimento de área abaixo da linha
  }]
};

// ⚙️ Opções de Configuração do Gráfico (Design Minimalista)
const chartOptions: any = {
  responsive: true,
  maintainAspectRatio: false, // Permite que o gráfico use a altura da div pai (h-32)
  scales: { 
    x: { display: false }, // Esconde o eixo X (Rótulos)
    y: { display: false }  // Esconde o eixo Y (Valores)
  },
  plugins: { 
    legend: { display: false }, // Esconde a legenda
    tooltip: { enabled: false }  // Desativa tooltips ao passar o mouse para manter o visual limpo
  }
};

// 🏗️ Componente Principal
export default function PortfolioSummary({ totalValue }: { totalValue: number }) {
  return (
    // Container com estilo de cartão, layout de grade e sombra
    <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl p-6 mb-8 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
      
      {/* Coluna 1: Métricas de Valor */}
      <div>
        <p className="text-slate-400 text-sm">Valor Total do Portfólio</p>
        <p className="text-4xl font-bold text-white">
          {/* Formata o número total de ativos em moeda USD */}
          ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="text-green-400 font-semibold">+2.5% (24h)</p> {/* Mockado, mas representa dados de 24h */}
      </div>
      
      {/* Coluna 2/3: Gráfico de Tendência */}
      <div className="md:col-span-2 h-32">
        {/* Renderiza o gráfico de linha com os dados e opções configuradas */}
        <Line data={chartData} options={chartOptions} />
      </div>
    </div>
);
}
```
---

#### 7. `src/components/dashboard/PortfolioTable.tsx`

- Renderiza a tabela de ativos, mostrando nome, símbolo, saldo, valor e logo.
```tsx
import { PortfolioAsset } from "@/app/dashboard/actions"; // 👈 Importa a interface que define a estrutura de dados (incluindo logoUrl).

// Define as propriedades (props) que este componente espera receber.
interface Props {
  assets: PortfolioAsset[]; // O array de ativos processados pelo backend.
  isLoading: boolean; // Flag de carregamento (gerenciado pelo componente pai).
}

// 🏗️ Componente de Tabela Principal
export default function PortfolioTable({ assets, isLoading }: Props) {
  // 1. Proteção contra o estado de carregamento: 
  // O componente pai (DashboardPage) gerencia o spinner principal, então este retorna null.
  if (isLoading) return null; 

  // 2. Proteção contra dados vazios: Se não houver ativos, exibe uma mensagem amigável.
  if (assets.length === 0)
    return (
      <p className="text-slate-400">Nenhum ativo encontrado nesta carteira.</p>
    );

  return (
    // Container da tabela: Utiliza Tailwind para um estilo de cartão escuro (bg-slate-900)
    // e 'overflow-hidden' para garantir que os cantos arredondados sejam aplicados corretamente.
    <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl overflow-hidden">
      <table className="min-w-full">
        <thead>
          <tr>
            {/* Cabeçalhos das colunas */}
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Ativo</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Preço</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Saldo</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Valor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {/* Itera sobre o array de ativos para criar as linhas */}
          {assets.map((asset) => (
            <tr key={asset.symbol} className="hover:bg-slate-800/40">
              
              {/* 🖼️ Célula do Ativo (Nome + Logo) */}
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white flex items-center gap-2">
                
                {/* 🔑 Enriquecimento Visual: Renderiza a imagem APENAS se o logoUrl existir */}
                {asset.logoUrl && (
                  <img
                    src={asset.logoUrl} // URL obtida da API da CoinGecko
                    alt={asset.symbol + " logo"}
                    className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700" // Estilo da imagem
                  />
                )}
                <span>
                  {asset.name} ({asset.symbol})
                </span>
              </td>
              
              {/* Célula de Preço (dado off-chain, esperado 0.00) */}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                ${asset.usdPrice.toFixed(2)} // Formata para 2 casas decimais.
              </td>
              
              {/* Célula de Saldo (dado on-chain) */}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                {parseFloat(asset.balance).toFixed(4)} {asset.symbol} // Formata o saldo para 4 casas decimais para legibilidade.
              </td>
              
              {/* Célula de Valor Total (Saldo * Preço) */}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                ${asset.usdValue.toFixed(2)} // Formata o valor total.
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```
---

#### 8. `src/components/Header.tsx`

- Exibe o header fixo com botão de conexão de carteira.
```tsx
'use client'; // 👈 Contexto: Necessário para usar o componente interativo ConnectButton do RainbowKit.
import { ConnectButton } from '@rainbow-me/rainbowkit'; // 🔗 Componente pré-construído que gerencia o estado da carteira (Conectar/Desconectar/Endereço).
import Link from 'next/link'; // Componente de navegação otimizada do Next.js.

// 🏗️ Componente de Cabeçalho
export default function Header() {
  return (
    // 1. Container Principal (Barra de Navegação)
    //    - w-full p-4 border-b...: Estilo básico de barra horizontal.
    //    - bg-slate-950/50 backdrop-blur-sm: Cria um fundo semitransparente com efeito "vidro fosco" (blur).
    //    - fixed top-0 z-50: CRUCIAL. Fixa o cabeçalho no topo da tela e usa z-50 para garantir que ele fique acima de todo o conteúdo da página.
    <header className="w-full p-4 border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm fixed top-0 z-50">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        
        {/* 2. Logo e Link para Home */}
        <Link href="/" className="text-2xl font-bold tracking-tight text-white">
          {/* Logo do projeto: O <span> usa a cor de destaque (sky-500) */}
          SENTINEL <span className="text-sky-500">PRO</span>
        </Link>
        
        {/* 3. Botão de Conexão Web3 */}
        {/* 🎯 O ConnectButton é o componente que consome o contexto Wagmi/RainbowKit que configuramos em providers.tsx.
           Ele lida automaticamente com o estado: Mostra "Connect Wallet" ou o endereço da carteira. */}
        <ConnectButton />
      </div>
    </header>
  );
}
```
---


#### 9. `src/components/3d-scene.tsx`

- Renderiza a animação 3D da landing page usando Three.js.
```tsx
'use client'; // 👈 Contexto: Necessário para usar hooks do React e do @react-three/fiber (que é interativo).
import { Canvas, useFrame, useThree } from '@react-three/fiber'; // 🖼️ Canvas: O contêiner para a cena 3D. useFrame: Hook para rodar código a cada frame. useThree: Hook para acessar o estado da cena (câmera, mouse).
import { Points, PointMaterial } from '@react-three/drei'; // 📦 Helper: Componentes utilitários. Points renderiza muitos pontos 3D.
import * as random from 'maath/random/dist/maath-random.esm'; // 🎲 Biblioteca para gerar números aleatórios (usada para posicionar as estrelas).
import { useState, useRef } from 'react';
import * as THREE from 'three'; // Importa a biblioteca Three.js diretamente.

// --- Componente de Estrelas (O Campo de Pontos) ---
function Stars(props: any) {
  const ref: any = useRef(); // 🎯 Ref para acessar o objeto 3D diretamente (necessário para rotação).
  
  // 1. Geração de Posições: Cria um array com 5000 posições 3D aleatórias.
  const [sphere] = useState(() => 
    // random.inSphere: Coloca os 5000 pontos aleatoriamente dentro de uma esfera de raio 1.5.
    random.inSphere(new Float32Array(5000), { radius: 1.5 })
  );

  // 2. Animação de Frame: Roda a cada frame renderizado (aprox. 60 vezes por segundo).
  useFrame((_state, delta) => {
    // delta: Tempo decorrido desde o último frame. Usar delta garante que a rotação seja suave e consistente, independente da taxa de quadros (FPS).
    ref.current.rotation.x -= delta / 10; // Rotação lenta no eixo X (inclinação).
    ref.current.rotation.y -= delta / 15; // Rotação lenta no eixo Y (movimento de varredura).
  });

  return (
    // <group>: Container de transformação que aplica a rotação a todos os pontos.
    <group rotation={[0, 0, Math.PI / 4]}>
      {/* 🌟 Componente Points: Renderiza os pontos na tela. */}
      <Points ref={ref} positions={sphere} stride={3} frustumCulled {...props}>
        {/* ✨ Material do Ponto: Define a aparência das "estrelas". */}
        <PointMaterial
          transparent // Permite que a opacidade seja controlada.
          color="#0ea5e9" // Cor sky-500 (dá o brilho azul da Web3).
          size={0.005} // Tamanho pequeno para parecer distante.
          sizeAttenuation={true} // Faz os pontos parecerem menores à medida que se afastam da câmera.
          depthWrite={false} // Desativa a escrita de profundidade para evitar artefatos de renderização transparente.
        />
      </Points>
    </group>
  );
}

// --- Componente de Câmera (Interação com o Mouse) ---
function SceneCamera() {
  const { camera } = useThree(); // Acessa o objeto da câmera.

  // useFrame: Move a câmera suavemente para a posição do mouse.
  useFrame((state) => {
    // THREE.MathUtils.lerp (Interpolação Linear): Suaviza o movimento da câmera.
    // Move a câmera em direção à posição do mouse (state.mouse.x/y), mas apenas 5% por frame (0.05).
    // Isso cria um efeito "flutuante" e responsivo.
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, state.mouse.x * 0.5, 0.05);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, state.mouse.y * 0.5, 0.05);
  });
  return null; // Este componente é apenas lógica, não renderiza nada diretamente.
}

// 🏗️ Componente de Cena Principal
export default function ThreeScene() {
  return (
    // 1. Container HTML/Tailwind: Posiciona a cena 3D como um fundo fixo que cobre toda a tela.
    //    - absolute/fixed/z-0: Coloca esta cena na camada de fundo, atrás de todo o conteúdo.
    <div className="absolute top-0 left-0 w-full h-screen z-0">
      
      {/* 2. Componente Canvas: Inicializa o contexto WebGL e o motor de renderização. */}
      <Canvas camera={{ position: [0, 0, 1] }}>
        <ambientLight intensity={0.5} /> {/* 💡 Luz que ilumina uniformemente a cena. */}
        <Stars /> {/* 🌟 Renderiza o campo de estrelas animado. */}
        <SceneCamera /> {/* 🖱️ Adiciona a lógica de movimento da câmera. */}
      </Canvas>
    </div>
  );
}
```
---


#### 10. `prisma/schema.prisma` (Opcional)

- Define o schema do banco de dados (usado em versões anteriores para sentinelas).
```prisma
// ⚙️ Configuração do Cliente Prisma
generator client {
  provider = "prisma-client-js" // 👈 Define o motor que gera o cliente TypeScript para interagir com o DB.
}

// 💾 Configuração da Fonte de Dados
datasource db {
  provider = "postgresql" // 👈 Define o SGBD (Sistema Gerenciador de Banco de Dados) usado (PostgreSQL).
  // 🔑 URL de Conexão (Variável de Ambiente)
  url      = env("MANUAL_DB_URL") // 👈 A URL real é lida da variável de ambiente.
  // 💡 Decisão de Arquitetura: Usar MANUAL_DB_URL em vez de POSTGRES_PRISMA_URL 
  // contorna o problema de injeção automática de variáveis da Vercel.
}

// Modelos de dados (Como 'Rule' e 'Action' foram removidos, 
// este arquivo agora representa um banco de dados vazio, mas com a conexão ativa).
```
---


#### 11. `.env.local`

- Armazena variáveis de ambiente, como `ALCHEMY_API_KEY` e `MANUAL_DB_URL`.
# 🔒 Princípio de Segurança: Este arquivo é ignorado pelo Git (.gitignore) e NUNCA deve ser enviado para o repositório público.
# Ele contém as chaves e URLs secretas para conectar a API e o banco de dados.

# --- Variáveis Públicas (NEXT_PUBLIC_...) ---
# 🌐 Configuração do Host Local: Usada pelo Next.js para construir URLs de callback 
# no ambiente de desenvolvimento.
NEXT_PUBLIC_SITE_URL="http://localhost:3000"

# 🤝 Conexão Web3: ID do projeto fornecido pelo WalletConnect Cloud.
# Essencial para a biblioteca RainbowKit iniciar a comunicação com carteiras móveis.
WALLETCONNECT_PROJECT_ID="AD_DA3437_123456_FINAL_ID"

# --- Variáveis Privadas (Backend/Servidor) ---

# 🔑 Chave RPC: Sua chave de autenticação para a Alchemy API.
# Usada no actions.ts para buscar saldos (getTokenBalances) e metadados.
ALCHEMY_API_KEY="SUA_CHAVE_ALCHEMY_COMPLETA_AQUI"

# 💾 Conexão DB (Prisma): URL do seu banco de dados Vercel Postgres.
# 💡 Nota de Arquitetura: Renomeada para MANUAL_DB_URL para contornar a falha de injeção automática de variáveis na Vercel.
MANUAL_DB_URL="postgres://[USUARIO]:[SENHA_FORTE]@[HOST_VERCEL]:5432/[DB_NOME]?sslmode=require"

# --- Variáveis Legadas / Removidas do Código Final (Apenas para Documentação) ---

# 🛑 Legado (Webhook Auth): Segredo que a Alchemy usaria para verificar assinaturas de webhooks. 
# Não é usado no código final.
ALCHEMY_WEBHOOK_SIGNING_SECRET="WHSEC_SECRET_GLOBAL_PARA_VERIFICACAO"

# 🛑 Legado (Webhook Config): ID do aplicativo Alchemy.
# Não é usado no código final.
ALCHEMY_APP_ID="APP_ID_DO_DASHBOARD_ALCHEMY"

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

Para um estudo aprofundado da arquitetura, decisões técnicas e funcionamento do Sentinel Pro, consulte o arquivo [ARCHITECTURE_GUIDE.md](./
ARCHITECTURE_GUIDE.md).

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
