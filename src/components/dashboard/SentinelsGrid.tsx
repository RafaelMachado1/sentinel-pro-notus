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
      // Chama a Server Action
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
      {isLoading && <p className="text-slate-400">Carregando Sentinelas...</p>}
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
                {/* Aqui poderíamos ter um status vindo da Notus, por enquanto "Ativo" */}
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
            {/* O formulário usa a Server Action diretamente */}
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