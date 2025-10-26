"use client";
import { useAccount } from "wagmi";
import { useState, useEffect } from "react";
import { getPortfolioData, PortfolioData } from "./actions";

// Apenas componentes de portfólio são necessários agora
import PortfolioSummary from "@/components/dashboard/PortfolioSummary";
import PortfolioTable from "@/components/dashboard/PortfolioTable";
// Removidos: DashboardTabs e SentinelsGrid

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNetwork, setSelectedNetwork] = useState("sepolia-testnet");

  // Redes suportadas
  const networks = [
    { id: "mainnet", label: "Ethereum Mainnet" },
    { id: "sepolia-testnet", label: "Sepolia Testnet" },
    { id: "goerli-testnet", label: "Goerli Testnet" },
    { id: "polygon-mainnet", label: "Polygon Mainnet" },
    { id: "polygon-mumbai", label: "Polygon Mumbai" },
    { id: "arbitrum-mainnet", label: "Arbitrum One" },
    { id: "optimism-mainnet", label: "Optimism" },
    // Adicione outras redes conforme necessário
  ];

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  useEffect(() => {
    setErrorMsg(null);
    if (isConnected && address) {
      setIsLoading(true);
      getPortfolioData(address, selectedNetwork)
        .then((data) => {
          setPortfolioData(data);
          setIsLoading(false);
          if (!data.assets || data.assets.length === 0) {
            setErrorMsg("Nenhum ativo encontrado nesta rede ou carteira.");
          }
        })
        .catch((error) => {
          console.error("[DashboardPage] Error fetching portfolio:", error);
          setIsLoading(false);
          setErrorMsg(
            "Erro ao buscar ativos. Verifique a rede selecionada ou tente novamente mais tarde."
          );
        });
    } else {
      setPortfolioData(null);
      setIsLoading(false);
    }
  }, [isConnected, address, selectedNetwork]);

  if (!isConnected) {
    return (
      <div className="max-w-7xl mx-auto px-4 text-center py-20">
        <h2 className="text-2xl font-bold">Por favor, conecte sua carteira</h2>
        {/* Texto atualizado, removendo menção a sentinelas */}
        <p className="text-slate-400 mt-2">
          Conecte sua carteira para visualizar seu portfólio.
        </p>
      </div>
    );
  }

  // Se conectado, mas ainda carregando
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 text-center py-20">
        Carregando dados do portfólio...
      </div>
    );
  }

  // Se conectado e dados carregados (ou erro silencioso retornado vazio)
  return (
    <div className="max-w-7xl mx-auto px-4 pb-12">
      <PortfolioSummary totalValue={portfolioData?.totalUsdValue ?? 0} />

      {/* Seletor de rede */}
      <div className="flex items-center gap-4 mb-8 mt-10">
        <h2 className="text-2xl font-bold text-white">Meus Ativos</h2>
        <select
          value={selectedNetwork}
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

      {errorMsg && (
        <div className="text-slate-400 text-center py-4 mb-4 bg-slate-900/60 border border-slate-800 rounded-xl">
          {errorMsg}
        </div>
      )}

      <PortfolioTable assets={portfolioData?.assets ?? []} isLoading={false} />
    </div>
  );
}
