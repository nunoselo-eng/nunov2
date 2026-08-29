import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function LojistaDashboard() {
  const [orders, setOrders] = useState([]);
  const [acceptedBids, setAcceptedBids] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [preco, setPreco] = useState('');
  const [frete, setFrete] = useState('');
  const [observacao, setObservacao] = useState('');

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [myCategories, setMyCategories] = useState([]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  useEffect(() => {
    fetchLojistaData();
  }, []);

  async function fetchLojistaData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserEmail(user.email || '');

      // 1. Perfil do lojista
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileData) setProfile(profileData);

      // 2. Categorias vinculadas
      const { data: allowedCategories } = await supabase
        .from('lojista_categorias')
        .select('categoria_id')
        .eq('lojista_id', user.id);

      const categoryIds = allowedCategories?.map(c => c.categoria_id) || [];

      if (categoryIds.length > 0) {
        const { data: catsData } = await supabase.from('categories').select('*');
        const { data: citiesData } = await supabase.from('cities').select('*');

        const catsMap = new Map((catsData || []).map(c => [String(c.id), c.nome]));
        const citiesMap = new Map((citiesData || []).map(c => [String(c.id), c.nome]));

        setMyCategories((catsData || []).filter(c => categoryIds.includes(c.id)));

        // 3. Cotações Abertas
        const { data: ordersData } = await supabase
          .from('orders')
          .select('*')
          .in('categoria_id', categoryIds)
          .order('created_at', { ascending: false });

        if (ordersData) {
          const formatted = ordersData.map(o => ({
            ...o,
            categoria_nome_exibicao: catsMap.get(String(o.categoria_id)) || o.categoria_nome || 'Geral',
            cidade_nome_exibicao: citiesMap.get(String(o.cidade_id)) || o.cidade_id || 'Não informada'
          }));
          setOrders(formatted);
        }
      } else {
        setOrders([]);
        setMyCategories([]);
      }

      // 4. Busca Vendas Confirmadas (Independente do filtro de categorias)
      const { data: bidsAceitos } = await supabase
        .from('bids')
        .select('*')
        .eq('lojista_id', user.id)
        .eq('status', 'Aceito');

      if (bidsAceitos && bidsAceitos.length > 0) {
        // Converte IDs para número e texto para garantir compatibilidade com o banco
        const rawOrderIds = bidsAceitos.map(b => b.order_id || b.pedido_id).filter(Boolean);
        const numericOrderIds = rawOrderIds.map(id => Number(id)).filter(id => !isNaN(id));

        let ordersAceitos = [];
        if (numericOrderIds.length > 0) {
          const { data: oData } = await supabase
            .from('orders')
            .select('*')
            .in('id', numericOrderIds);
          if (oData) ordersAceitos = oData;
        }

        const clientIds = ordersAceitos.map(o => o.cliente_id).filter(Boolean);
        let clientProfiles = [];
        if (clientIds.length > 0) {
          const { data: pData } = await supabase
            .from('profiles')
            .select('id, nome, telefone')
            .in('id', clientIds);
          if (pData) clientProfiles = pData;
        }

        const clientMap = new Map(clientProfiles.map(p => [String(p.id), p]));
        const orderMap = new Map(ordersAceitos.map(o => [String(o.id), {
          ...o,
          cliente: clientMap.get(String(o.cliente_id))
        }]));

        const formattedBids = bidsAceitos.map(b => ({
          ...b,
          pedido: orderMap.get(String(b.order_id || b.pedido_id))
        }));

        setAcceptedBids(formattedBids);
      } else {
        setAcceptedBids([]);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do lojista:', err);
    }
  }

  const handleSendBid = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('bids').insert([
        {
          order_id: selectedOrder.id,
          pedido_id: selectedOrder.id,
          lojista_id: user?.id,
          preco: parseFloat(preco),
          valor: parseFloat(preco),
          frete: parseFloat(frete || 0),
          observacao: observacao,
          status: 'Enviado'
        }
      ]);

      if (error) {
        alert('Erro ao enviar orçamento: ' + error.message);
      } else {
        alert('Orçamento enviado com sucesso!');
        setSelectedOrder(null);
        setPreco('');
        setFrete('');
        setObservacao('');
        fetchLojistaData();
      }
    } catch (err) {
      alert('Erro ao processar envio.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-8 relative">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Cabeçalho */}
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Painel do Lojista</h2>
            <p className="text-sm text-slate-500">Cotações das Suas Categorias</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="bg-slate-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-900 transition shadow-sm"
            >
              Meus Dados
            </button>
            <button
              onClick={handleLogout}
              className="bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-300 transition"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Vendas Confirmadas com Dados do Cliente */}
        {acceptedBids.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-xl font-bold text-green-800">🎉 Vendas Confirmadas (Contatos Liberados)</h3>
            <div className="space-y-3">
              {acceptedBids.map((bid) => {
                const total = (parseFloat(bid.preco || bid.valor || 0)) + (parseFloat(bid.frete || 0));
                const telefone = bid.pedido?.cliente?.telefone || '';
                const telefoneLimpo = telefone.replace(/\D/g, '');

                return (
                  <div key={bid.id} className="bg-white p-4 rounded-xl border border-green-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <p className="font-bold text-slate-800">{bid.pedido?.descricao || 'Cotação'}</p>
                      <p className="text-sm text-slate-600 mt-1">
                        <b>Cliente:</b> {bid.pedido?.cliente?.nome || 'Cliente'}
                      </p>
                      <p className="text-sm text-teal-700 font-bold">
                        <b>WhatsApp / Tel:</b> {telefone || 'Não informado'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        <b>Total da Proposta:</b> R$ {total.toFixed(2)}
                      </p>
                    </div>
                    {telefoneLimpo ? (
                      <a
                        href={`https://wa.me/55${telefoneLimpo}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 transition shadow-sm"
                      >
                        Chamar no WhatsApp
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Telefone não cadastrado</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cotações Disponíveis */}
        <div className="bg-white shadow-xl rounded-2xl border border-slate-200 overflow-hidden p-6">
          <h3 className="text-xl font-bold text-slate-800 mb-4">Cotações Disponíveis</h3>
          {orders.length === 0 ? (
            <p className="text-slate-500 text-center py-4">Nenhuma cotação disponível para as suas categorias no momento.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {orders.map((order) => (
                <li key={order.id} className="py-4 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-slate-800 text-lg">{order.descricao}</p>
                    <p className="text-sm text-slate-600 mt-1">
                      <b>Cidade:</b> {order.cidade_nome_exibicao} {order.bairro && `| Bairro: ${order.bairro}`} | <b>Categoria:</b> {order.categoria_nome_exibicao}
                    </p>
                    <span className="text-xs text-slate-400">Criado em: {new Date(order.created_at || order.criado_em).toLocaleDateString()}</span>
                  </div>
                  <button 
                    onClick={() => setSelectedOrder(order)}
                    className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-teal-700 transition"
                  >
                    Enviar Orçamento
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Modal de Envio de Proposta */}
        {selectedOrder && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <form onSubmit={handleSendBid} className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200 space-y-3">
              <h3 className="text-xl font-bold text-slate-800">Enviar Proposta</h3>
              <p className="text-sm text-slate-600"><b>Pedido:</b> {selectedOrder.descricao}</p>
              <p className="text-sm text-slate-500">
                <b>Entrega:</b> {selectedOrder.cidade_nome_exibicao} {selectedOrder.bairro ? `- Bairro ${selectedOrder.bairro}` : ''}
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Preço Produto (R$)</label>
                  <input 
                    type="number" step="0.01" placeholder="0.00" 
                    value={preco} onChange={(e) => setPreco(e.target.value)} 
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-900 bg-slate-50" required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Frete (R$)</label>
                  <input 
                    type="number" step="0.01" placeholder="0.00" 
                    value={frete} onChange={(e) => setFrete(e.target.value)} 
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-900 bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observações / Validade</label>
                <textarea 
                  placeholder="Prazo de entrega, detalhes adicionais..." 
                  value={observacao} onChange={(e) => setObservacao(e.target.value)} 
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-900 h-24 resize-none bg-slate-50"
                />
              </div>

              <div className="flex space-x-3 pt-3">
                <button 
                  type="button" 
                  onClick={() => setSelectedOrder(null)}
                  className="w-1/2 bg-slate-200 text-slate-700 p-2.5 rounded-lg font-semibold hover:bg-slate-300 transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="w-1/2 bg-teal-600 text-white p-2.5 rounded-lg font-semibold hover:bg-teal-700 transition"
                >
                  Confirmar Envio
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Modal de Perfil do Lojista */}
        {isProfileModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200 space-y-5">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="text-xl font-bold text-slate-800">Meus Dados</h3>
                <button
                  onClick={() => setIsProfileModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-sm text-slate-700">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nome da Loja</p>
                  <p className="font-bold text-slate-800 text-base">{profile?.nome || 'Não informado'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">E-mail</p>
                  <p className="font-medium text-slate-800">{userEmail || 'Não informado'}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="w-full bg-slate-800 text-white p-2.5 rounded-xl font-semibold hover:bg-slate-900 transition"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}