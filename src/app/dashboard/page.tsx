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
      <div className="max-w-7xl mx-auto px-4 text-center py-20">
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