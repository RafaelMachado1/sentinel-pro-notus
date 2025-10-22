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