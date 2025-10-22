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