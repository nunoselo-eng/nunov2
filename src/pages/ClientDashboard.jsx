import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';

export default function ClientDashboard() {
  const [orders, setOrders] = useState([]);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de Perfil do Cliente
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cidade, setCidade] = useState('');
  const [cities, setCities] = useState([]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  useEffect(() => {
    fetchClientData();
  }, []);

  async function fetchClientData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      setUserEmail(user.email || '');

      // 1. Busca perfil do cliente
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setNome(profileData.nome || '');
        setTelefone(profileData.telefone || '');
        setCidade(profileData.cidade || '');
      }

      // Busca Cidades Cadastradas para seleção no modal
      const { data: citiesData } = await supabase.from('cities').select('*');
      if (citiesData) {
        const uniqueCitiesMap = new Map();
        citiesData.forEach(c => {
          if (c.nome && !uniqueCitiesMap.has(c.nome.trim().toLowerCase())) {
            uniqueCitiesMap.set(c.nome.trim().toLowerCase(), c);
          }
        });
        setCities(Array.from(uniqueCitiesMap.values()));
      }

      // 2. Busca cotações criadas por este cliente
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('cliente_id', user.id)
        .order('created_at', { ascending: false });

      if (!ordersError && ordersData && ordersData.length > 0) {
        setOrders(ordersData);

        const orderIds = ordersData.map(o => o.id);
        const ordersMap = new Map(ordersData.map(o => [String(o.id), o]));

        // 3. Busca orçamentos das cotações
        let { data: bidsData } = await supabase
          .from('bids')
          .select('*')
          .in('order_id', orderIds);

        if (!bidsData || bidsData.length === 0) {
          const { data: fallbackBids } = await supabase
            .from('bids')
            .select('*')
            .in('pedido_id', orderIds);
          if (fallbackBids) bidsData = fallbackBids;
        }

        if (bidsData && bidsData.length > 0) {
          const formattedBids = bidsData.map(b => ({
            ...b,
            orders: ordersMap.get(String(b.order_id || b.pedido_id))
          }));

          formattedBids.sort((a, b) => {
            const totalA = (parseFloat(a.preco || a.valor || 0)) + (parseFloat(a.frete || 0));
            const totalB = (parseFloat(b.preco || b.valor || 0)) + (parseFloat(b.frete || 0));
            return totalA - totalB;
          });

          setBids(formattedBids);
        }
      }
    }
    setLoading(false);
  }

  // Função para salvar atualizações do perfil
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          nome: nome,
          telefone: telefone,
          cidade: cidade
        })
        .eq('id', user.id);

      if (error) throw error;

      alert('Dados atualizados com sucesso!');
      setIsProfileModalOpen(false);
    } catch (err) {
      alert('Erro ao atualizar perfil: ' + err.message);
    }
  };

  const handleAcceptBid = async (bidId) => {
    const confirm = window.confirm("Ao confirmar, o lojista receberá seu nome e telefone/WhatsApp para concluir o atendimento. Deseja prosseguir?");
    if (!confirm) return;

    const { error } = await supabase
      .from('bids')
      .update({ status: 'Aceito' })
      .eq('id', bidId);

    if (error) {
      alert('Erro ao confirmar proposta: ' + error.message);
    } else {
      alert('Proposta confirmada com sucesso! O lojista já tem acesso ao seu WhatsApp e entrará em contato.');
      setBids(bids.map(b => b.id === bidId ? { ...b, status: 'Aceito' } : b));
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Painel do Cliente</h2>
            <p className="text-sm text-slate-500">Minhas Solicitações e Orçamentos Recebidos</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="bg-slate-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-900 transition shadow-sm"
            >
              Meus Dados
            </button>
            <Link 
              to="/create-request" 
              className="bg-teal-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-teal-700 transition shadow-sm"
            >
              + Nova Cotação
            </Link>
            <button
              onClick={handleLogout}
              className="bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-300 transition"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Orçamentos Recebidos */}
        <div className="bg-white shadow-xl rounded-2xl border border-slate-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-slate-800">Orçamentos Recebidos</h3>
            <span className="text-xs text-slate-500 font-medium bg-slate-100 px-3 py-1 rounded-full">
              Ordenado do menor para o maior preço
            </span>
          </div>
          
          {loading ? (
            <p className="text-slate-500 text-center py-4">Carregando orçamentos...</p>
          ) : bids.length === 0 ? (
            <p className="text-slate-500 text-center py-4">Nenhum orçamento recebido nas suas cotações ainda.</p>
          ) : (
            <div className="space-y-4">
              {bids.map((bid) => {
                const valorProd = parseFloat(bid.preco || bid.valor || 0);
                const valorFrete = parseFloat(bid.frete || 0);
                const valorTotal = valorProd + valorFrete;

                return (
                  <div key={bid.id} className="p-5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-semibold bg-teal-100 text-teal-800 px-2.5 py-1 rounded-full">
                        Pedido: {bid.orders?.descricao || 'Cotação'}
                      </span>
                      
                      <div className="pt-2 flex flex-wrap gap-4 text-sm text-slate-700">
                        <p><b>Valor do Produto:</b> R$ {valorProd.toFixed(2)}</p>
                        <p><b>Frete:</b> {valorFrete > 0 ? `R$ ${valorFrete.toFixed(2)}` : 'Grátis'}</p>
                      </div>

                      <p className="text-2xl font-bold text-slate-900">
                        Total: R$ {valorTotal.toFixed(2)}
                      </p>

                      {bid.observacao && (
                        <p className="text-sm text-slate-600 italic pt-1">Obs do Lojista: "{bid.observacao}"</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${bid.status === 'Aceito' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {bid.status === 'Aceito' ? 'Proposta Confirmada' : bid.status}
                      </span>
                      {bid.status !== 'Aceito' && (
                        <button 
                          onClick={() => handleAcceptBid(bid.id)}
                          className="bg-teal-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-teal-700 transition shadow-sm"
                        >
                          Confirmar Proposta
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Minhas Cotações Criadas */}
        <div className="bg-white shadow-xl rounded-2xl border border-slate-200 p-6">
          <h3 className="text-xl font-bold text-slate-800 mb-4">Minhas Cotações Criadas</h3>
          {orders.length === 0 ? (
            <p className="text-slate-500 text-center py-4">Você ainda não criou nenhuma solicitação.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {orders.map((order) => (
                <li key={order.id} className="py-4 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-slate-800">{order.descricao}</p>
                    <span className="text-xs text-slate-400">Criado em: {new Date(order.created_at).toLocaleDateString()}</span>
                  </div>
                  <span className="text-xs font-medium bg-slate-200 text-slate-700 px-3 py-1 rounded-full">
                    {order.status || 'Ativo'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Modal de Edição dos Dados do Cliente */}
        {isProfileModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="text-xl font-bold text-slate-800">Meus Dados</h3>
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg"
                >
                  ✕
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">E-mail (Não editável)</label>
                <input 
                  type="email" 
                  value={userEmail} 
                  disabled 
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Nome Completo</label>
                <input 
                  type="text" 
                  value={nome} 
                  onChange={(e) => setNome(e.target.value)} 
                  placeholder="Seu nome"
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Telefone / WhatsApp</label>
                <input 
                  type="text" 
                  value={telefone} 
                  onChange={(e) => setTelefone(e.target.value)} 
                  placeholder="(22) 99999-9999"
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Cidade</label>
                <select
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-900 bg-white text-sm focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Selecione sua cidade...</option>
                  {cities.map((c) => (
                    <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>
                  ))}
                </select>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsProfileModalOpen(false)}
                  className="w-1/2 bg-slate-200 text-slate-700 p-2.5 rounded-xl font-semibold hover:bg-slate-300 transition text-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="w-1/2 bg-teal-600 text-white p-2.5 rounded-xl font-semibold hover:bg-teal-700 transition shadow-sm text-sm"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}