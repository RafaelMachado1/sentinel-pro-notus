### Definição Funcional: A "Sentinela"

Antes de começarmos, esta é a funcionalidade que vamos construir. O formulário "Criar Nova Sentinela" permitirá:

1.  **Gatilho:** Nome, Rede, Endereço do Contrato, Nome do Evento.
2.  **Condições (Filtros):** O usuário poderá adicionar filtros. Para este MVP (Minimum Viable Product), vamos simplificar para **um único filtro de valor** para demonstrar a lógica (ex: `amount` `é maior que` `[VALOR]`). Isso é suficiente para provar o conceito.
3.  **Ação:** Tipo (fixo em "Discord") e a URL do Webhook do Discord.

-----

### O Blueprint de Execução: Sentinel Pro (v4)

Este guia é seu "passo a passo". Execute cada comando e crie cada arquivo exatamente como descrito.

#### MARCO 0: A Fundação

**Objetivo:** Criar a estrutura do projeto, configurar as ferramentas e fazer o primeiro push.

**Ações Detalhadas:**

1.  **No GitHub:**

      * Crie um novo repositório público: `sentinel-pro-notus`.
      * Marque **Add a README file**.
      * Selecione `.gitignore` template: **Node**.
      * Clique em **Create repository**.

2.  **No seu Terminal:**

    ```bash
    git clone git@github.com:[SEU_USUARIO]/sentinel-pro-notus.git
    cd sentinel-pro-notus
    npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*"
    # Responda Y (Sim) para prosseguir e sobrescrever o .gitignore
    ```

3.  **Instalar e Configurar o Prisma:**

    ```bash
    npm install --save-dev prisma
    npx prisma init --datasource-provider vercel-postgres
    ```

      * Isso cria a pasta `/prisma` e o arquivo `schema.prisma`.

4.  **Versionamento:**

    ```bash
    git add .
    git commit -m "feat(init): initial project setup with next.js, ts, tailwind, and prisma"
    git push origin main
    ```

-----

#### MARCO 1: O Alvo (Smart Contract na Sepolia)

**Objetivo:** Implantar um contrato de teste na Sepolia para monitoramento.

**Ações Detalhadas:**

1.  **Remix IDE (`remix.ethereum.org`):**

      * Crie `TestVault.sol`, cole o código, compile-o (versão `0.8.20+`):
        ```solidity
        // SPDX-License-Identifier: MIT
        pragma solidity ^0.8.20;
        contract TestVault {
            // Evento simula ERC20 Transfer
            event Transfer(address indexed from, address indexed to, uint256 amount);
            // Nossa função de teste
            function moveFunds(address to, uint256 amount) public {
                emit Transfer(msg.sender, to, amount);
            }
        }
        ```
      * **IMPORTANTE:** Usamos `Transfer` como nome do evento, pois é universalmente entendido e os endpoints de preço da Notus são focados em tokens.

2.  **Deploy:**

      * Vá para a aba "Deploy".
      * Environment: **Injected Provider - MetaMask**.
      * Conecte sua carteira `0x445...` (rede Sepolia).
      * Clique em **Deploy** e confirme a transação.

3.  **Salvar Endereço:** Copie o endereço do contrato implantado (ex: `0x...`) e salve-o. esse é o endereço: 0x3ED4b286785c61b70A6A6aFa669E7D5F51300318


4.  **Versionamento:** Nenhum commit necessário.

-----

#### MARCO 2: Autenticação (Web3 Login)

**Objetivo:** Integrar o login com carteira (RainbowKit).

**Ações Detalhadas:**

1.  **Instalar Dependências:**

    ```bash
    npm install @rainbow-me/rainbowkit wagmi viem @tanstack/react-query
    ```

2.  **Obter Project ID:**

      * Vá para `cloud.walletconnect.com`, crie um projeto e copie seu `projectId`. ad3437032082220b3254f41aa1de99f7

3.  **Criar `src/app/providers.tsx`:**

    ```typescript
    'use client';
    import '@rainbow-me/rainbowkit/styles.css';
    import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
    import { WagmiProvider } from 'wagmi';
    import { sepolia } from 'wagmi/chains';
    import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
    import { ReactNode } from 'react';

    // Substitua pelo seu ID do WalletConnect Cloud
    const WALLETCONNECT_PROJECT_ID = 'SEU_PROJECT_ID_AQUI'; 

    const config = getDefaultConfig({
      appName: 'Sentinel Pro',
      projectId: WALLETCONNECT_PROJECT_ID,
      chains: [sepolia], // Vamos focar na Sepolia para esta demo
      ssr: true,
    });

    const queryClient = new QueryClient();

    export function Providers({ children }: { children: ReactNode }) {
      return (
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider>
              {children}
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      );
    }
    ```

4.  **Criar `src/components/Header.tsx`:**

    ```typescript
    'use client';
    import { ConnectButton } from '@rainbow-me/rainbowkit';
    import Link from 'next/link';

    export default function Header() {
      return (
        <header className="w-full p-4 border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm fixed top-0 z-50">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold tracking-tight text-white">
              SENTINEL <span className="text-sky-500">PRO</span>
            </Link>
            <ConnectButton />
          </div>
        </header>
      );
    }
    ```

5.  **Atualizar `src/app/layout.tsx`:**

      * Modifique-o para importar e usar `Providers` e `Header`.

    ```typescript
    import type { Metadata } from "next";
    import { Inter } from "next/font/google";
    import "./globals.css";
    import { Providers } from "./providers"; // Importe
    import Header from "@/components/Header"; // Importe

    const inter = Inter({ subsets: ["latin"] });

    export const metadata: Metadata = {
      title: "Sentinel Pro",
      description: "Asset intelligence and security hub.",
    };

    export default function RootLayout({
      children,
    }: Readonly<{
      children: React.ReactNode;
    }>) {
      return (
        <html lang="en" className="dark">
          <body className={`${inter.className} bg-slate-950 text-white`}>
            <Providers>
              <Header />
              <main className="pt-20"> {/* Adiciona padding para o Header fixo */}
                {children}
              </main>
            </Providers>
          </body>
        </html>
      );
    }
    ```

6.  **Versionamento:**

    ```bash
    git add .
    git commit -m "feat(auth): integrate rainbowkit for wallet authentication"
    git push
    ```

-----

#### MARCO 3: O "UAU" (Landing Page 3D)

**Objetivo:** Construir a landing page 3D interativa.

**Ações Detalhadas:**

1.  **Instalar Dependências 3D:**

    ```bash
    npm install three @react-three/fiber @react-three/drei
    ```

2.  **Criar `src/components/3d-scene.tsx`:**

    ```typescript
    'use client';
    import { Canvas, useFrame, useThree } from '@react-three/fiber';
    import { Points, PointMaterial } from '@react-three/drei';
    import * as random from 'maath/random/dist/maath-random.esm';
    import { useState, useRef } from 'react';
    import * as THREE from 'three';

    function Stars(props: any) {
      const ref: any = useRef();
      const [sphere] = useState(() => 
        random.inSphere(new Float32Array(5000), { radius: 1.5 })
      );

      useFrame((_state, delta) => {
        ref.current.rotation.x -= delta / 10;
        ref.current.rotation.y -= delta / delta / 15;
      });

      return (
        <group rotation={[0, 0, Math.PI / 4]}>
          <Points ref={ref} positions={sphere} stride={3} frustumCulled {...props}>
            <PointMaterial
              transparent
              color="#0ea5e9"
              size={0.005}
              sizeAttenuation={true}
              depthWrite={false}
            />
          </Points>
        </group>
      );
    }

    function SceneCamera() {
      const { camera } = useThree();
      useFrame((state) => {
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, state.mouse.x * 0.5, 0.05);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, state.mouse.y * 0.5, 0.05);
      });
      return null;
    }

    export default function ThreeScene() {
      return (
        <div className="absolute top-0 left-0 w-full h-screen z-0">
          <Canvas camera={{ position: [0, 0, 1] }}>
            <ambientLight intensity={0.5} />
            <Stars />
            <SceneCamera />
          </Canvas>
        </div>
      );
    }
    ```

3.  **Atualizar `src/app/page.tsx` (Landing Page):**

    ```typescript
    import ThreeScene from "@/components/3d-scene";
    import Link from "next/link";

    export default function Home() {
      return (
        <div className="relative w-full h-screen flex items-center justify-center text-center -mt-20"> {/* -mt-20 para compensar o padding do layout */}
          <ThreeScene />
          
          <div className="relative z-10 p-8">
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter uppercase" 
                style={{ textShadow: '0 0 20px rgba(14, 165, 233, 0.5)' }}>
              Sentinel Pro
            </h1>
            <p className="mt-4 text-lg md:text-xl text-slate-400 max-w-2xl">
              A plataforma unificada para gerenciamento e segurança de ativos on-chain. Visibilidade total, controle reativo.
            </p>
            <Link 
              href="/dashboard" 
              className="mt-12 inline-block bg-sky-500 hover:bg-sky-600 text-white font-bold text-lg py-3 px-8 rounded-full transition-all duration-300 shadow-lg shadow-sky-500/30 hover:shadow-xl hover:shadow-sky-500/50"
            >
              Lançar Painel de Controle
            </Link>
          </div>
        </div>
      );
    }
    ```

4.  **Versionamento:**

    ```bash
    git add .
    git commit -m "feat(ui): implement 3d interactive landing page"
    git push
    ```

-----

#### MARCO 4: O Banco de Dados (Para as Sentinelas)

**Objetivo:** Configurar o Vercel Postgres e definir o schema do banco de dados.

**Ações Detalhadas:**

1.  **No Vercel:**

      * Crie um novo projeto e importe seu repositório `sentinel-pro-notus`.
      * Vá para a aba "Storage" -> "Postgres" -> "Create".
      * Siga os passos e conecte o banco ao seu projeto.

2.  **Configurar `.env.local`:**

      * Crie `src/.env.local` (ou na raiz, se preferir).
      * **CONFIRME** que `.env.local` está no seu `.gitignore`.
      * Copie as variáveis de ambiente (ex: `POSTGRES_PRISMA_URL`) do Vercel e cole-as no `.env.local`.

3.  **Definir o Schema (`prisma/schema.prisma`):**

    ```prisma
    generator client {
      provider = "prisma-client-js"
    }

    datasource db {
      provider = "postgresql"
      url      = env("POSTGRES_PRISMA_URL")
    }

    model Rule {
      id                  String    @id @default(cuid())
      name                String
      ownerAddress        String    // Endereço da carteira do criador
      networkId           String    // Ex: "sepolia-testnet"
      contractAddress     String
      eventName           String
      
      // Armazena o ID da subscrição da Notus para fácil referência
      notusSubscriptionId String    @unique
      
      // Relação com a Ação
      action              Action?
      
      createdAt           DateTime  @default(now())

      @@index([ownerAddress])
    }

    model Action {
      id        String   @id @default(cuid())
      ruleId    String   @unique
      rule      Rule     @relation(fields: [ruleId], references: [id], onDelete: Cascade)
      
      type      String   // Ex: "DISCORD_WEBHOOK"
      targetUrl String   // A URL do webhook do Discord
    }
    ```

4.  **Sincronizar o DB:**

    ```bash
    npx prisma migrate dev --name "init-sentinel-schema"
    ```

      * Isso também irá gerar o cliente Prisma (`@prisma/client`).

5.  **Versionamento:**

    ```bash
    git add .
    git commit -m "feat(db): setup vercel postgres and define prisma schema for sentinels"
    git push
    ```

-----

#### MARCO 5: O "Cérebro" do Portfólio (Backend com API Notus)

**Objetivo:** Criar o backend que busca e precifica o portfólio usando a Notus.

**Ações Detalhadas:**

1.  **Obter Chave da API Notus:**

      * Vá para `notus.team`, crie uma conta e gere uma chave de API.
      * Adicione-a ao seu `.env.local`:
        ```
        NOTUS_API_KEY="sk_..."
        ```

2.  **Criar o "Cérebro" (`src/app/dashboard/actions.ts`):**

    ```typescript
    'use server';
    import { unstable_noStore as noStore } from 'next/cache';

    // Tipos de dados para o nosso portfólio
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

    export async function getPortfolioData(walletAddress: string, networkId: string = 'sepolia-testnet'): Promise<PortfolioData> {
      noStore(); // Marca esta função como dinâmica
      if (!NOTUS_API_KEY) {
        throw new Error('NOTUS_API_KEY is not configured');
      }

      const headers = { 'X-Api-Key': NOTUS_API_KEY, 'Content-Type': 'application/json' };

      try {
        // 1. Buscar os tokens da carteira
        const tokensResponse = await fetch(`${NOTUS_API_URL}/wallets/${walletAddress}/tokens?networkId=${networkId}`, { headers });
        if (!tokensResponse.ok) throw new Error('Failed to fetch tokens');
        const tokensData = await tokensResponse.json();

        // 2. Buscar os preços desses tokens
        const tokenAddresses = tokensData.data.map((token: any) => token.address);
        
        const assets: PortfolioAsset[] = await Promise.all(
          tokensData.data.map(async (token: any): Promise<PortfolioAsset> => {
            let usdPrice = 0;
            try {
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
        
        // 3. Calcular o total
        const totalUsdValue = assets.reduce((acc, asset) => acc + asset.usdValue, 0);
        
        return {
          totalUsdValue,
          assets,
        };

      } catch (error) {
        console.error('Error fetching portfolio data:', error);
        return { totalUsdValue: 0, assets: [] };
      }
    }
    ```

3.  **Versionamento:**

    ```bash
    git add .
    git commit -m "feat(core/portfolio): implement backend logic to fetch and price portfolio via notus api"
    git push
    ```

-----

#### MARCO 6: A "Visão" do Portfólio (Frontend Conectado)

**Objetivo:** Construir a UI do dashboard e conectá-la ao backend Notus.

**Ações Detalhadas:**

1.  **Instalar Gráficos 2D:**

    ```bash
    npm install chart.js react-chartjs-2
    ```

2.  **Criar `src/app/dashboard/page.tsx`:**

    ```typescript
    'use client';
    import { useAccount } from 'wagmi';
    import { useState, useEffect } from 'react';
    import { getPortfolioData, PortfolioData } from './actions';

    // Importe os componentes que criaremos a seguir
    import PortfolioSummary from '@/components/dashboard/PortfolioSummary';
    import DashboardTabs from '@/components/dashboard/DashboardTabs';
    import PortfolioTable from '@/components/dashboard/PortfolioTable';
    import SentinelsGrid from '@/components/dashboard/SentinelsGrid';

    export default function DashboardPage() {
      const { address, isConnected } = useAccount();
      const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
      const [isLoading, setIsLoading] = useState(true);
      const [activeTab, setActiveTab] = useState<'portfolio' | 'sentinels'>('portfolio');

      useEffect(() => {
        if (isConnected && address) {
          setIsLoading(true);
          getPortfolioData(address, 'sepolia-testnet') // Hardcode Sepolia para a demo
            .then(data => {
              setPortfolioData(data);
              setIsLoading(false);
            })
            .catch(error => {
              console.error(error);
              setIsLoading(false);
            });
        }
      }, [isConnected, address]);

      if (!isConnected) {
        return (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold">Por favor, conecte sua carteira</h2>
            <p className="text-slate-400">Conecte sua carteira para ver seu portfólio e gerenciar suas sentinelas.</p>
          </div>
        );
      }
      
      return (
        <div className="max-w-7xl mx-auto px-4 pb-12">
          {isLoading ? (
            <div className="text-center py-20">Carregando dados do portfólio...</div>
          ) : (
            <PortfolioSummary totalValue={portfolioData?.totalUsdValue ?? 0} />
          )}
          
          <DashboardTabs activeTab={activeTab} setActiveTab={setActiveTab} />
          
          <div className={activeTab === 'portfolio' ? '' : 'hidden'}>
            <PortfolioTable assets={portfolioData?.assets ?? []} isLoading={isLoading} />
          </div>
          
          <div className={activeTab === 'sentinels' ? '' : 'hidden'}>
            <SentinelsGrid />
          </div>
        </div>
      );
    }
    ```

3.  **Criar Componentes do Dashboard:**

      * Crie a pasta `/src/components/dashboard`.
      * **`src/components/dashboard/PortfolioSummary.tsx`:**
        ```typescript
        'use client';
        import { Line } from 'react-chartjs-2';
        import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';

        ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

        // Dados mockados para o gráfico
        const chartData = {
          labels: ['-7d', '-6d', '-5d', '-4d', '-3d', '-2d', 'Hoje'],
          datasets: [{
              data: [1180, 1195, 1210, 1205, 1220, 1230, 1248],
              backgroundColor: 'rgba(14, 165, 233, 0.2)',
              borderColor: '#0ea5e9',
              borderWidth: 2,
              pointRadius: 0,
              tension: 0.4,
              fill: true,
          }]
        };

        const chartOptions: any = {
          responsive: true,
          maintainAspectRatio: false,
          scales: { x: { display: false }, y: { display: false } },
          plugins: { legend: { display: false }, tooltip: { enabled: false } }
        };

        export default function PortfolioSummary({ totalValue }: { totalValue: number }) {
          return (
            <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl p-6 mb-8 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div>
                <p className="text-slate-400 text-sm">Valor Total do Portfólio</p>
                <p className="text-4xl font-bold text-white">
                  ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-green-400 font-semibold">+2.5% (24h)</p>
              </div>
              <div className="md:col-span-2 h-32">
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>
        );
      }
        ```

      * **`src/components/dashboard/DashboardTabs.tsx`:**
        ```typescript
        'use client';
        type Tab = 'portfolio' | 'sentinels';

        interface Props {
          activeTab: Tab;
          setActiveTab: (tab: Tab) => void;
        }

        export default function DashboardTabs({ activeTab, setActiveTab }: Props) {
          const activeClass = "text-sky-500 border-sky-500";
          const inactiveClass = "text-slate-400 border-transparent hover:text-slate-200";

          return (
            <div className="border-b border-slate-800 mb-8">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('portfolio')}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg ${activeTab === 'portfolio' ? activeClass : inactiveClass}`}
                >
                  Portfólio
                </button>
                <button
                  onClick={() => setActiveTab('sentinels')}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg ${activeTab === 'sentinels' ? activeClass : inactiveClass}`}
                >
                  Sentinelas
                </button>
              </nav>
            </div>
          );
        }
        ```

      * **`src/components/dashboard/PortfolioTable.tsx`:**
        ```typescript
        import { PortfolioAsset } from '@/app/dashboard/actions';

        interface Props {
          assets: PortfolioAsset[];
          isLoading: boolean;
        }

        export default function PortfolioTable({ assets, isLoading }: Props) {
          if (isLoading) return null; // O loading é tratado na página
          if (assets.length === 0) return <p className="text-slate-400">Nenhum ativo encontrado nesta carteira.</p>;

          return (
            <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-slate-900/80">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Ativo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Preço</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Saldo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {assets.map((asset) => (
                    <tr key={asset.symbol} className="hover:bg-slate-800/40">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{asset.name} ({asset.symbol})</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">${asset.usdPrice.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{parseFloat(asset.balance).toFixed(4)} {asset.symbol}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">${asset.usdValue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        ```

      * **`src/components/dashboard/SentinelsGrid.tsx`:** (Arquivo placeholder por enquanto)
        ```typescript
        'use client';
        export default function SentinelsGrid() {
          // A lógica de criação e listagem virá no Marco 7
          return (
            <div>
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-white">Meus Alertas de Segurança</h2>
                <button className="sentinel-btn bg-sky-500 hover:bg-sky-600 font-medium py-2 px-5 rounded-lg flex items-center space-x-2">
                  <span>Criar Nova Sentinela</span>
                </button>
              </div>
              <div className="text-slate-400 text-center py-12 bg-slate-900/60 border border-slate-800 rounded-xl">
                <p>Você ainda não criou nenhuma Sentinela.</p>
                <p>Clique em "Criar Nova Sentinela" para começar.</p>
              </div>
            </div>
          );
        }
        ```

4.  **Versionamento:**

    ```bash
    git add .
    git commit -m "feat(ui/dashboard): build and connect portfolio UI to live notus api data"
    git push
    ```

-----

#### MARCO 7: A Ferramenta (Backend das Sentinelas)

**Objetivo:** Implementar a criação de regras "Sentinela", conectando ao Prisma e à API de Webhooks da Notus.

**Ações Detalhadas:**

1.  **Segredos Adicionais:**

      * Precisamos da URL do nosso site em produção. Adicione ao `.env.local` por enquanto:
        ```
        # Mude isso para sua URL da Vercel quando fizer o deploy
        NEXT_PUBLIC_SITE_URL="http://localhost:3000" 
        ```

2.  **Atualizar o "Cérebro" (`src/app/dashboard/actions.ts`):**

      * Adicione as funções `createSentinelRule` e `getSentinelRules`.

    ```typescript
    // ... (no topo do arquivo 'actions.ts', adicione os imports)
    import { PrismaClient } from '@prisma/client';
    import { revalidatePath } from 'next/cache';

    const prisma = new PrismaClient();

    // ... (getPortfolioData function
    // ...

    // FUNÇÃO PARA CRIAR A REGRA
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
        // Por enquanto, vamos monitorar todos os eventos do contrato.
        // A lógica de filtro (condições) será aplicada no *receptor* (Marco 8)
        abi: `[{ "type": "event", "name": "${ruleData.eventName}", "inputs": [] }]` // ABI simplificado
      };

      const response = await fetch(`${NOTUS_API_URL}/webhooks`, {
        method: 'POST',
        headers: { 'X-Api-Key': NOTUS_API_KEY!, 'Content-Type': 'application/json' },
        body: JSON.stringify(notusPayload),
      });

      if (!response.ok) {
        console.error(await response.json());
        throw new Error('Failed to create Notus webhook subscription');
      }

      const notusData = await response.json();
      const subscriptionId = notusData.data.id;

      // 3. Salvar a regra e a ação no nosso DB
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

    // FUNÇÃO PARA LER AS REGRAS
    export async function getSentinelRules(ownerAddress: string) {
      noStore();
      const rules = await prisma.rule.findMany({
        where: { ownerAddress },
        orderBy: { createdAt: 'desc' },
      });
      return rules;
    }
    ```

3.  **Atualizar `src/components/dashboard/SentinelsGrid.tsx`:**

      * Vamos transformá-lo em um componente funcional que lista regras e abre um modal para criar novas.
      * (Este é um componente grande, mostrando a UI completa)

    ```typescript
    'use client';
    import { useState, useEffect } from 'react';
    import { createSentinelRule, getSentinelRules } from '@/app/dashboard/actions';
    import { useAccount } from 'wagmi';
    import type { Rule } from '@prisma/client';

    export default function SentinelsGrid() {
      const { address } = useAccount();
      const [showModal, setShowModal] = useState(false);
      const [rules, setRules] = useState<Rule[]>([]);
      const [isLoading, setIsLoading] = useState(true);

      // Buscar as regras quando o componente carregar
      useEffect(() => {
        if (address) {
          setIsLoading(true);
          getSentinelRules(address).then(data => {
            setRules(data);
            setIsLoading(false);
          });
        }
      }, [address]);
      
      // Ação do formulário
      async function handleCreateRule(formData: FormData) {
        if (!address) return;
        formData.append('ownerAddress', address);
        
        try {
          await createSentinelRule(formData);
          // Recarregar a lista de regras e fechar o modal
          const newRules = await getSentinelRules(address);
          setRules(newRules);
          setShowModal(false);
        } catch (error) {
          console.error(error);
          alert('Falha ao criar Sentinela. Verifique o console.');
        }
      }

      return (
        <div>
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-white">Meus Alertas de Segurança</h2>
            <button
              onClick={() => setShowModal(true)} 
              className="bg-sky-500 hover:bg-sky-600 text-white font-medium py-2 px-5 rounded-lg flex items-center space-x-2 transition-all"
            >
              <span>Criar Nova Sentinela</span>
            </button>
          </div>

          {/* Grade de Regras */}
          {isLoading && <p>Carregando Sentinelas...</p>}
          {!isLoading && rules.length === 0 && (
            <div className="text-slate-400 text-center py-12 bg-slate-900/60 border border-slate-800 rounded-xl">
              <p>Você ainda não criou nenhuma Sentinela.</p>
              <p>Clique em "Criar Nova Sentinela" para começar.</p>
            </div>
          )}
          {!isLoading && rules.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rules.map(rule => (
                <div key={rule.id} className="bg-slate-900/60 backdrop-blur-md border border-slate-800 p-6 rounded-xl border-l-4 border-sky-500">
                  <div className="flex justify-between items-start">
                    <h3 className="text-xl font-bold text-white mb-2">{rule.name}</h3>
                    <span className="bg-green-500/20 text-green-400 text-xs font-semibold px-2.5 py-0.5 rounded-full">Ativo</span>
                  </div>
                  <p className="text-sm text-slate-400 mb-4">Monitora evento: <span className="font-medium text-slate-300">{rule.eventName}</span></p>
                  <div className="font-mono text-xs bg-slate-800/50 p-2 rounded-md text-slate-300 break-all" title={rule.contractAddress}>
                    {rule.contractAddress.substring(0, 10)}...{rule.contractAddress.substring(rule.contractAddress.length - 8)}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Modal de Criação */}
          {showModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-6">Criar Nova Sentinela</h2>
                <form action={handleCreateRule} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Nome</label>
                    <input name="name" required className="w-full p-2 bg-slate-800 border border-slate-700 rounded-md" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Rede</label>
                    <select name="networkId" required className="w-full p-2 bg-slate-800 border border-slate-700 rounded-md">
                      <option value="sepolia-testnet">Sepolia (Testnet)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Endereço do Contrato</label>
                    <input name="contractAddress" required placeholder="0x..." className="w-full p-2 bg-slate-800 border border-slate-700 rounded-md font-mono" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Nome do Evento</label>
                    <input name="eventName" required placeholder="Ex: Transfer" className="w-full p-2 bg-slate-800 border border-slate-700 rounded-md" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">URL do Webhook do Discord</label>
                    <input name="discordUrl" type="url" required placeholder="https://discord.com/api/webhooks/..." className="w-full p-2 bg-slate-800 border border-slate-700 rounded-md" />
                  </div>
                  <div className="flex justify-end space-x-4 pt-4">
                    <button type="button" onClick={() => setShowModal(false)} className="bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg">Cancelar</button>
                    <button type="submit" className="bg-sky-500 hover:bg-sky-600 text-white font-medium py-2 px-4 rounded-lg">Criar</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      );
    }
    ```

4.  **Versionamento:**

    ```bash
    git add .
    git commit -m "feat(app/sentinel): implement sentinel creation and listing UI/backend"
    git push
    ```

-----

#### MARCO 8: O "Ouvinte" (Receptor do Webhook)

**Objetivo:** Criar o endpoint que recebe alertas da Notus, verifica e age.

**Ações Detalhadas:**

1.  **Segredos Finais:**

      * Vá ao dashboard da Notus, encontre seu "Webhook Secret".
      * Adicione ao `.env.local`:
        ```
        NOTUS_WEBHOOK_SECRET="whsec_..."
        ```

2.  **Criar o Endpoint (`src/app/api/notus-webhook/route.ts`):**

    ```typescript
    import { NextRequest, NextResponse } from 'next/server';
    import { PrismaClient } from '@prisma/client';
    import * as crypto from 'crypto';

    const prisma = new PrismaClient();
    const NOTUS_WEBHOOK_SECRET = process.env.NOTUS_WEBHOOK_SECRET;

    // Função para verificar a assinatura (SEGURANÇA CRÍTICA)
    async function verifySignature(request: NextRequest, body: string): Promise<boolean> {
      const signature = request.headers.get('X-Notus-Signature');
      if (!signature || !NOTUS_WEBHOOK_SECRET) {
        return false;
      }

      const hash = crypto
        .createHmac('sha256', NOTUS_WEBHOOK_SECRET)
        .update(body)
        .digest('hex');
      
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hash));
    }

    // Função de lógica para enviar ao Discord
    async function sendDiscordAlert(targetUrl: string, payload: any) {
      const eventData = payload.data.log;
      const txHash = payload.data.txHash;
      const network = payload.networkId;
      
      // Formata uma mensagem bonita
      const message = {
        content: `🚨 **ALERTA SENTINEL** 🚨`,
        embeds: [
          {
            title: `Evento Detectado: \`${eventData.name}\``,
            color: 15105570, // Cor Laranja/Vermelho
            fields: [
              { name: 'Rede', value: network, inline: true },
              { name: 'Contrato', value: `\`${payload.address}\``, inline: false },
              // Adiciona parâmetros do evento (simplificado)
              ...eventData.params.map((p: any) => ({
                name: p.name,
                value: `\`${p.value}\``,
                inline: true,
              })),
              { name: 'Transação (Tx)', value: `[Ver no Explorer](https://sepolia.etherscan.io/tx/${txHash})`, inline: false },
            ],
          },
        ],
      };

      await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
    }

    export async function POST(request: NextRequest) {
      const body = await request.text();
      
      // 1. Verificar Assinatura
      if (!await verifySignature(request, body)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }

      const payload = JSON.parse(body);

      // 2. Lógica de Negócio
      try {
        const subscriptionId = payload.subscriptionId;

        // 3. Encontrar a Regra no nosso DB
        const rule = await prisma.rule.findUnique({
          where: { notusSubscriptionId: subscriptionId },
          include: { action: true },
        });

        if (!rule || !rule.action) {
          return NextResponse.json({ error: 'Rule or action not found' }, { status: 404 });
        }
        
        // 4. (Opcional) Avaliar Condições:
        // Aqui é onde você adicionaria a lógica de "amount > 10000".
        // Por ex: const amount = payload.data.log.params.find(p => p.name === 'amount').value;
        // if (BigInt(amount) > BigInt(rule.conditionValue)) { ... }
        
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
    ```

3.  **Versionamento:**

    ```bash
    git add .
    git commit -m "feat(core): implement notus webhook ingestor with signature verification and discord alerts"
    git push
    ```

-----

#### MARCO 9: O Show (Deployment e Teste E2E)

**Objetivo:** Fazer o deploy da aplicação e realizar o teste de ponta-a-ponta.

**Ações Detalhadas:**

1.  **Deploy:**

      * Vá ao seu projeto na Vercel.
      * Em "Settings" -> "Environment Variables", adicione **TODAS** as suas variáveis:
          * `POSTGRES_PRISMA_URL` (do Vercel Storage)
          * `NOTUS_API_KEY` (da Notus)
          * `NOTUS_WEBHOOK_SECRET` (da Notus)
          * `WALLETCONNECT_PROJECT_ID` (do WalletConnect)
          * `NEXT_PUBLIC_SITE_URL` (ex: `https://sentinel-pro-notus.vercel.app`)
      * Inicie um novo deploy (Redeploy) para que as variáveis sejam aplicadas.

2.  **O Teste (A Apresentação):**

      * **1 (UAU):** Abra seu site (`sentinel-pro-notus.vercel.app`). Mostre a Landing Page 3D.
      * **2 (VISÃO):** Conecte sua carteira Sepolia (`0x445...`). Mostre o dashboard do portfólio carregando **ao vivo** seu saldo de `0.208 SepoliaETH` e seu preço, vindo da API da Notus.
      * **3 (PROTEÇÃO):** Clique na aba "Sentinelas".
      * **4 (AÇÃO):** Clique em "Criar Nova Sentinela".
          * Nome: `Teste Cofre Sepolia`
          * Rede: `sepolia-testnet`
          * Endereço do Contrato: (Cole o endereço do `TestVault` do Marco 1)
          * Nome do Evento: `Transfer`
          * Discord URL: (Crie um webhook em um canal de teste do Discord e cole a URL)
      * **5 (GATILHO):** Abra o **Remix IDE**. Vá para o seu `TestVault` implantado.
      * **6 (PROVA):** Chame a função `moveFunds`. No campo `to`, coloque qualquer endereço. No campo `amount`, coloque `123456789`.
      * **7 (RESULTADO):** Confirme a transação. Em segundos, observe o seu canal do Discord. O alerta, formatado, deve aparecer.

3.  **Versionamento Final:**

    ```bash
    git commit -m "chore: final polish and prep for demo" --allow-empty
    git push
    ```

-----

**Plano Concluído.** Você tem todos os códigos, comandos e a lógica estrutural para construir o Sentinel Pro. A execução é sua.
