'use client';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// Dados mockados para o gráfico (em produção, viriam da API)
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