import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.svg';
import { getStatusPrazo, aplicarPenalidadeSeNecessario } from '../utils/prazoUtils';

export default function ClientDashboard() {
  const [orders, setOrders] = useState([]);
  const [bidsByOrder, setBidsByOrder] = useState({});
  const [bidItemsMap, setBidItemsMap] = useState({});
  const [lojistaPorBid, setLojistaPorBid] = useState({});
  const [lojistasElegiveisPorPedido, setLojistasElegiveisPorPedido] = useState({});
  const [orderItemsMap, setOrderItemsMap] = useState({});
  const [loading, setLoading] = useState(true);

  // Filtros e Busca
  const [statusFilter, setStatusFilter] = useState('todas');
  const [searchTerm, setSearchTerm] = useState('');

  // Filtro por data e ordenação (padrão: mais recentes primeiro)
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' = mais recentes primeiro, 'asc' = mais antigos primeiro

  // Modais e Detalhes
  const [showDetails, setShowDetails] = useState({});
  const [activeImage, setActiveImage] = useState(null);
  const [now, setNow] = useState(Date.now());

  // Encolher/expandir seções e cards individuais
  const [collapsedSections, setCollapsedSections] = useState({ abertas: false, confirmadas: false, encerradas: false });
  const [collapsedCards, setCollapsedCards] = useState(new Set());

  // Avisa o cliente, com banner fixo, quando chega uma proposta nova.
  // Guarda o CONJUNTO de pedidos com proposta ainda não vista.
  const [pedidosComPropostaNova, setPedidosComPropostaNova] = useState(new Set());
  const ordersIdsRef = useRef([]);

  // Ordenação das propostas dentro de cada pedido: por preço ou por prazo de entrega
  const [ordenarPropostasPor, setOrdenarPropostasPor] = useState('preco');

  const LABEL_PRAZO_ENTREGA = {
    em_2h: 'Em até 2 horas',
    hoje: 'Ainda hoje',
    amanha: 'Amanhã',
    '2_3_dias': '2 a 3 dias',
  };
  const PESO_PRAZO_ENTREGA = { em_2h: 2, hoje: 12, amanha: 24, '2_3_dias': 72 };
  const LABEL_FORMA_PAGAMENTO = {
    cartao: 'Cartão',
    a_vista: 'À vista',
    faturado: 'Faturado',
  };

  // Avaliações já enviadas pelo cliente (bid_id -> true), pra saber quais
  // pedidos entregues ainda precisam de pesquisa de satisfação.
  const [bidsJaAvaliados, setBidsJaAvaliados] = useState(new Set());
  const [notaSelecionada, setNotaSelecionada] = useState({});
  const [enviandoAvaliacao, setEnviandoAvaliacao] = useState(null);

  const toggleSection = (key) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleCard = (orderId) => {
    setCollapsedCards(prev => {
      const next = new Set(prev);
      const estavaColapsado = next.has(orderId);
      if (estavaColapsado) {
        next.delete(orderId);
        // Expandindo o card: se esse pedido tinha proposta nova, marca como visto.
        setPedidosComPropostaNova(prevSet => {
          if (!prevSet.has(orderId)) return prevSet;
          const novoSet = new Set(prevSet);
          novoSet.delete(orderId);
          return novoSet;
        });
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  // Dados do Perfil
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userId, setUserId] = useState(null);
  const [cashbackAtivo, setCashbackAtivo] = useState(false);
  const [saldoCashback, setSaldoCashback] = useState(0);
  const [meusCreditosCashback, setMeusCreditosCashback] = useState([]);
  const [bidAplicandoCashback, setBidAplicandoCashback] = useState(null);
  const [valorCashbackParaAplicar, setValorCashbackParaAplicar] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cidade, setCidade] = useState('');
  const [cities, setCities] = useState([]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchClientData();
  }, []);

  // Mantém a referência de "quais pedidos são meus" sempre atualizada,
  // pra conferir a relevância de uma proposta nova assim que ela chega.
  useEffect(() => {
    ordersIdsRef.current = orders.map(o => o.id);
  }, [orders]);

  // Penalidade automática: pedido expirou, teve pelo menos uma proposta,
  // e o cliente não aceitou nenhuma — perde 0,5 na reputação (uma única vez).
  useEffect(() => {
    if (!userId || orders.length === 0) return;

    orders.forEach((order) => {
      const status = getStatusPrazo(order, lojistasElegiveisPorPedido[order.id] || [], new Date());
      if (!status.expirado) return;

      const bids = bidsByOrder[String(order.id)] || [];
      const teveProposta = bids.length > 0;
      const aceitouAlguma = bids.some(b => b.status === 'Aceito');

      if (teveProposta && !aceitouAlguma) {
        aplicarPenalidadeSeNecessario(supabase, order.id, 'cliente', userId);
      }
    });
  }, [orders, bidsByOrder, lojistasElegiveisPorPedido, userId]);

  // Avisa o cliente, com banner fixo, quando um lojista envia uma proposta
  // nova pra algum dos pedidos dele.
  useEffect(() => {
    const channel = supabase
      .channel('realtime-bids-cliente')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids' }, (payload) => {
        const orderIdDaProposta = Number(payload?.new?.order_id || payload?.new?.pedido_id);
        const relevante = ordersIdsRef.current.includes(orderIdDaProposta);
        if (!relevante) return;

        setPedidosComPropostaNova(prev => new Set(prev).add(orderIdDaProposta));
        fetchClientData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchClientData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setUserEmail(user.email || '');
        setUserId(user.id);

        const { data: cashbackConfig } = await supabase.from('configuracoes_cashback').select('ativo').eq('id', 1).single();
        setCashbackAtivo(cashbackConfig?.ativo || false);

        if (cashbackConfig?.ativo) {
          const { data: creditos } = await supabase
            .from('cashback_creditos')
            .select('*')
            .eq('cliente_id', user.id)
            .eq('status', 'ativo')
            .gt('expira_em', new Date().toISOString());

          const { data: ajustes } = await supabase
            .from('cashback_ajustes_manuais')
            .select('valor')
            .eq('cliente_id', user.id);

          setMeusCreditosCashback(creditos || []);
          const saldoCreditos = (creditos || []).reduce(
            (soma, c) => soma + (parseFloat(c.valor) - parseFloat(c.valor_usado)),
            0
          );
          const saldoAjustes = (ajustes || []).reduce((soma, a) => soma + parseFloat(a.valor), 0);
          setSaldoCashback(Math.max(0, saldoCreditos + saldoAjustes));
        } else {
          setMeusCreditosCashback([]);
          setSaldoCashback(0);
        }

        const { data: avaliacoesFeitas } = await supabase
          .from('avaliacoes')
          .select('bid_id')
          .eq('avaliador_id', user.id);
        setBidsJaAvaliados(new Set((avaliacoesFeitas || []).map(a => a.bid_id)));

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

        const { data: ordersData } = await supabase
          .from('orders')
          .select('*')
          .eq('cliente_id', user.id)
          .order('created_at', { ascending: false });

        if (ordersData && ordersData.length > 0) {
          setOrders(ordersData);
          const orderIds = ordersData.map(o => o.id);

          // Lojistas elegíveis (mesma categoria + cidade) de cada pedido,
          // usados pra calcular se o prazo está correndo ou pausado.
          const categoriaIds = Array.from(new Set(ordersData.map(o => o.categoria_id).filter(Boolean)));
          if (categoriaIds.length > 0) {
            const { data: vinculosCat } = await supabase
              .from('lojista_categorias')
              .select('lojista_id, categoria_id')
              .in('categoria_id', categoriaIds);

            const lojistaIdsCandidatos = Array.from(new Set((vinculosCat || []).map(v => v.lojista_id).filter(Boolean)));
            let lojistasCandidatos = [];
            if (lojistaIdsCandidatos.length > 0) {
              const { data: lojistasData } = await supabase
                .from('profiles')
                .select('id, cidade, ativo, horario_abertura, horario_fechamento, dias_funcionamento')
                .in('id', lojistaIdsCandidatos);
              lojistasCandidatos = lojistasData || [];
            }

            const cidadeMapLocal = new Map((citiesData || []).map(c => [String(c.id), c.nome]));
            const vinculosPorCategoria = {};
            (vinculosCat || []).forEach(v => {
              if (!vinculosPorCategoria[v.categoria_id]) vinculosPorCategoria[v.categoria_id] = new Set();
              vinculosPorCategoria[v.categoria_id].add(v.lojista_id);
            });

            const mapaElegiveis = {};
            ordersData.forEach(o => {
              const idsDaCategoria = vinculosPorCategoria[o.categoria_id] || new Set();
              const cidadePedido = (cidadeMapLocal.get(String(o.cidade_id)) || '').trim().toLowerCase();
              mapaElegiveis[o.id] = lojistasCandidatos.filter(l => {
                if (!idsDaCategoria.has(l.id)) return false;
                if (l.ativo === false) return false;
                if (!cidadePedido) return true;
                const cidadeLojista = (l.cidade || '').trim().toLowerCase();
                return cidadeLojista.includes(cidadePedido) || cidadePedido.includes(cidadeLojista);
              });
            });
            setLojistasElegiveisPorPedido(mapaElegiveis);
          }

          const { data: itemsData } = await supabase
            .from('order_items')
            .select('*')
            .in('order_id', orderIds);

          const oItemsMap = {};
          (itemsData || []).forEach(item => {
            if (!oItemsMap[item.order_id]) oItemsMap[item.order_id] = [];
            oItemsMap[item.order_id].push(item);
          });
          setOrderItemsMap(oItemsMap);

          const { data: bidsData } = await supabase
            .from('bids')
            .select('*')
            .in('order_id', orderIds);

          if (bidsData && bidsData.length > 0) {
            const bidIds = bidsData.map(b => b.id);
            const { data: bItemsData } = await supabase
              .from('bid_items')
              .select('*')
              .in('bid_id', bidIds);

            const bItemsGroup = {};
            (bItemsData || []).forEach(bi => {
              if (!bItemsGroup[bi.bid_id]) bItemsGroup[bi.bid_id] = [];
              bItemsGroup[bi.bid_id].push(bi);
            });
            setBidItemsMap(bItemsGroup);

            const grouped = {};
            bidsData.forEach(b => {
              const orderKey = String(b.order_id || b.pedido_id);
              if (!grouped[orderKey]) grouped[orderKey] = [];
              grouped[orderKey].push(b);
            });

            Object.keys(grouped).forEach(orderKey => {
              grouped[orderKey].sort((a, b) => {
                if (a.is_completo !== b.is_completo) {
                  return a.is_completo ? -1 : 1;
                }
                const totalA = (parseFloat(a.preco || 0)) + (parseFloat(a.frete || 0));
                const totalB = (parseFloat(b.preco || 0)) + (parseFloat(b.frete || 0));
                return totalA - totalB;
              });
            });

            setBidsByOrder(grouped);

            // Dados do lojista de cada proposta (nome/telefone), pra liberar
            // o WhatsApp assim que o cliente aceitar uma proposta.
            const lojistaIds = Array.from(new Set(bidsData.map(b => b.lojista_id).filter(Boolean)));
            if (lojistaIds.length > 0) {
              const { data: lojistasData } = await supabase
                .from('profiles')
                .select('id, nome, telefone, reputacao_media, total_avaliacoes, logo_url')
                .in('id', lojistaIds);

              const lojistaMap = {};
              (lojistasData || []).forEach(l => { lojistaMap[l.id] = l; });
              setLojistaPorBid(lojistaMap);
            }
          }
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
    setLoading(false);
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ nome, telefone, cidade })
        .eq('id', user.id);

      if (error) throw error;

      alert('Dados atualizados com sucesso!');
      setIsProfileModalOpen(false);
    } catch (err) {
      alert('Erro ao atualizar perfil: ' + err.message);
    }
  };

  const handleAvaliarLojista = async (bid) => {
    const nota = notaSelecionada[bid.id];
    if (!nota) {
      alert('Selecione de 1 a 5 estrelas antes de enviar.');
      return;
    }
    setEnviandoAvaliacao(bid.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('avaliacoes').insert([{
        bid_id: bid.id,
        avaliador_id: user.id,
        avaliado_id: bid.lojista_id,
        nota: nota,
      }]);
      if (error) throw error;
      alert('Obrigado pela avaliação!');
      setBidsJaAvaliados(prev => new Set(prev).add(bid.id));
    } catch (err) {
      alert('Erro ao enviar avaliação: ' + err.message);
    } finally {
      setEnviandoAvaliacao(null);
    }
  };

  const handleAcceptBid = async (bidId, valorCashbackAplicado = 0) => {
    const confirm = window.confirm('Deseja realmente confirmar esta proposta? Ao confirmar, o lojista receberá seus dados para finalizar a entrega.');
    if (!confirm) return;

    const { error } = await supabase
      .from('bids')
      .update({ status: 'Aceito', accepted_at: new Date().toISOString(), cashback_aplicado: valorCashbackAplicado })
      .eq('id', bidId);

    if (!error) {
      if (valorCashbackAplicado > 0) {
        await aplicarResgateCashback(bidId, valorCashbackAplicado);
      }
      alert('Proposta confirmada com sucesso!');
      setBidAplicandoCashback(null);
      setValorCashbackParaAplicar('');
      fetchClientData();
    } else {
      alert('Erro ao confirmar proposta: ' + error.message);
    }
  };

  // Resgata cashback: registra o uso e desconta dos créditos mais
  // próximos de vencer primeiro, pra não deixar nada expirar à toa.
  const aplicarResgateCashback = async (bidId, valor) => {
    try {
      const todosBids = Object.values(bidsByOrder).flat();
      const bid = todosBids.find(b => b.id === bidId);
      if (!bid) return;

      await supabase.from('cashback_resgates').insert([{
        cliente_id: userId,
        lojista_id: bid.lojista_id,
        bid_id: bidId,
        valor: valor
      }]);

      let restante = valor;
      const creditosOrdenados = [...meusCreditosCashback].sort(
        (a, b) => new Date(a.expira_em) - new Date(b.expira_em)
      );

      for (const credito of creditosOrdenados) {
        if (restante <= 0) break;
        const disponivel = parseFloat(credito.valor) - parseFloat(credito.valor_usado);
        if (disponivel <= 0) continue;
        const usar = Math.min(disponivel, restante);
        await supabase
          .from('cashback_creditos')
          .update({ valor_usado: parseFloat(credito.valor_usado) + usar })
          .eq('id', credito.id);
        restante -= usar;
      }
    } catch (err) {
      console.error('Erro ao aplicar resgate de cashback:', err);
    }
  };

  const toggleDetails = (bidId) => {
    setShowDetails(prev => ({ ...prev, [bidId]: !prev[bidId] }));
  };

  const getRemainingTime = (order) => {
    if (!order?.expira_em) return { texto: 'Sem prazo', expirado: false, pausado: false };
    const status = getStatusPrazo(order, lojistasElegiveisPorPedido[order.id] || [], new Date(now));
    return { texto: status.texto, expirado: status.expirado, pausado: status.pausado };
  };

  const classifyOrder = (order) => {
    const orderBids = bidsByOrder[String(order.id)] || [];
    const tempo = getRemainingTime(order);
    const hasAcceptedBid = orderBids.some(b => b.status === 'Aceito');
    if (hasAcceptedBid) return 'confirmadas';
    if (tempo.expirado) return 'encerradas';
    return 'abertas';
  };

  const matchesSearch = (order) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const matchCodigo = order.codigo_pedido?.toLowerCase().includes(term);
    const matchDesc = order.descricao?.toLowerCase().includes(term);
    const items = orderItemsMap[order.id] || [];
    const matchItem = items.some(i => i.descricao?.toLowerCase().includes(term));
    return matchCodigo || matchDesc || matchItem;
  };

  // Verifica se um pedido cai dentro do período (data) selecionado
  const matchesDate = (order) => {
    if (!dateFrom && !dateTo) return true;
    const dataRef = order.created_at || order.criado_em;
    if (!dataRef) return true;
    const data = new Date(dataRef);
    if (dateFrom && data < new Date(dateFrom + 'T00:00:00')) return false;
    if (dateTo && data > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  };

  // Ordena uma lista de pedidos pela data de criação, respeitando o sortOrder
  const ordenarPorData = (lista) => {
    const copia = [...lista];
    copia.sort((a, b) => {
      const dataA = new Date(a.created_at || a.criado_em || 0).getTime();
      const dataB = new Date(b.created_at || b.criado_em || 0).getTime();
      return sortOrder === 'asc' ? dataA - dataB : dataB - dataA;
    });
    return copia;
  };

  const abertasOrders = ordenarPorData(orders.filter(o => classifyOrder(o) === 'abertas' && matchesSearch(o) && matchesDate(o)));
  const confirmadasOrders = ordenarPorData(orders.filter(o => classifyOrder(o) === 'confirmadas' && matchesSearch(o) && matchesDate(o)));
  const encerradasOrders = ordenarPorData(orders.filter(o => classifyOrder(o) === 'encerradas' && matchesSearch(o) && matchesDate(o)));

  const renderOrderCard = (order) => {
    const todasPropostas = bidsByOrder[String(order.id)] || [];
    const hasAcceptedBid = todasPropostas.some(b => b.status === 'Aceito');
    // Depois que uma proposta é aprovada, as outras ficam travadas — só
    // mostra a aceita. Pra ver outras opções, precisa criar uma cotação nova.
    const orderBids = hasAcceptedBid ? todasPropostas.filter(b => b.status === 'Aceito') : todasPropostas;
    const items = orderItemsMap[order.id] || [];
    const tempo = getRemainingTime(order);
    const isCardCollapsed = collapsedCards.has(order.id);

    return (
      <div key={order.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">

        {/* Cabeçalho do Pedido */}
        <div className={`flex flex-wrap justify-between items-start gap-2 ${isCardCollapsed ? '' : 'pb-3 border-b border-slate-100'}`}>
          <div className="flex items-start gap-2">
            <button
              onClick={() => toggleCard(order.id)}
              className="text-slate-400 hover:text-slate-600 text-xs mt-1 w-4"
              title={isCardCollapsed ? 'Expandir' : 'Encolher'}
            >
              {isCardCollapsed ? '▸' : '▾'}
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-lg">
                  Pedido #{order.codigo_pedido || order.id}
                </span>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                  tempo.expirado ? 'bg-slate-100 text-slate-600' : tempo.pausado ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {tempo.pausado ? '⏸️' : '⏱️'} {tempo.texto}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-800 mt-2">{order.descricao}</h2>
            </div>
          </div>
          <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
            {order.status || 'Aguardando Moderação'}
          </span>
        </div>

        {/* Lista de Propostas */}
        {!isCardCollapsed && (
          <div className="space-y-3">
            {orderBids.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">
                {tempo.expirado ? 'Nenhuma proposta foi enviada durante o prazo.' : 'Aguardando propostas dos lojistas...'}
              </p>
            ) : (
              <>
              {hasAcceptedBid && todasPropostas.length > 1 && (
                <p className="text-[11px] text-slate-400 italic bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  🔒 As outras {todasPropostas.length - 1} proposta(s) deste pedido ficaram ocultas após a aprovação. Para comparar outras opções, crie uma nova cotação.
                </p>
              )}
              {!hasAcceptedBid && orderBids.length > 1 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-semibold">Ordenar por:</span>
                  <button
                    onClick={() => setOrdenarPropostasPor('preco')}
                    className={`px-2.5 py-1 rounded-lg font-semibold border ${ordenarPropostasPor === 'preco' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}`}
                  >
                    Menor preço
                  </button>
                  <button
                    onClick={() => setOrdenarPropostasPor('prazo')}
                    className={`px-2.5 py-1 rounded-lg font-semibold border ${ordenarPropostasPor === 'prazo' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}`}
                  >
                    Entrega mais rápida
                  </button>
                </div>
              )}
              {[...orderBids].sort((a, b) => {
                if (a.is_completo !== b.is_completo) return a.is_completo ? -1 : 1;
                if (ordenarPropostasPor === 'prazo') {
                  const pesoA = PESO_PRAZO_ENTREGA[a.prazo_entrega] ?? 999;
                  const pesoB = PESO_PRAZO_ENTREGA[b.prazo_entrega] ?? 999;
                  if (pesoA !== pesoB) return pesoA - pesoB;
                }
                const totalA = (parseFloat(a.preco || 0)) + (parseFloat(a.frete || 0));
                const totalB = (parseFloat(b.preco || 0)) + (parseFloat(b.frete || 0));
                return totalA - totalB;
              }).map((bid, index) => {
                const total = (parseFloat(bid.preco || 0)) + (parseFloat(bid.frete || 0));
                const bItems = bidItemsMap[bid.id] || [];
                const isAccepted = bid.status === 'Aceito';

                return (
                  <div
                    key={bid.id}
                    className={`p-4 rounded-xl border ${
                      isAccepted
                        ? 'border-emerald-200 bg-emerald-50/40'
                        : bid.is_completo
                          ? 'border-slate-200 bg-slate-50/70'
                          : 'border-amber-200 bg-amber-50/40'
                    } space-y-3`}
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-600">Opção #{index + 1}</span>
                          {bid.is_completo ? (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                              Atendimento 100%
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                              Atendimento Parcial
                            </span>
                          )}
                        </div>

                        {isAccepted ? (
                          <div className="flex items-center gap-2 mt-1.5">
                            {lojistaPorBid[bid.lojista_id]?.logo_url && (
                              <img
                                src={lojistaPorBid[bid.lojista_id].logo_url}
                                alt="Logo da loja"
                                className="w-8 h-8 rounded-lg object-cover border border-slate-200"
                              />
                            )}
                            <div>
                              <p className="text-sm font-bold text-slate-800">{lojistaPorBid[bid.lojista_id]?.nome || 'Loja'}</p>
                              <p className="text-[11px] font-semibold text-amber-600">
                                ⭐ {Number(lojistaPorBid[bid.lojista_id]?.reputacao_media ?? 5).toFixed(1)}
                                <span className="text-slate-400 font-normal"> ({lojistaPorBid[bid.lojista_id]?.total_avaliacoes || 0} avaliações)</span>
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] font-semibold text-amber-600 mt-1">
                            ⭐ {Number(lojistaPorBid[bid.lojista_id]?.reputacao_media ?? 5).toFixed(1)}
                            <span className="text-slate-400 font-normal"> ({lojistaPorBid[bid.lojista_id]?.total_avaliacoes || 0} avaliações) · loja revelada após aprovar</span>
                          </p>
                        )}

                        <p className="text-xl font-bold text-slate-900 mt-1">
                          Total: R$ {total.toFixed(2)}{' '}
                          <span className="text-xs text-slate-500 font-normal">
                            (Frete R$ {parseFloat(bid.frete || 0).toFixed(2)})
                          </span>
                        </p>
                        {isAccepted && bid.cashback_aplicado > 0 && (
                          <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 mt-1 inline-block">
                            💰 R$ {parseFloat(bid.cashback_aplicado).toFixed(2)} de cashback aplicado · Total a pagar: R$ {(total - parseFloat(bid.cashback_aplicado)).toFixed(2)}
                          </p>
                        )}
                        {(bid.prazo_entrega || bid.garantia || (bid.formas_pagamento && bid.formas_pagamento.length > 0) || (cashbackAtivo && (bid.oferece_cashback || bid.aceita_cashback))) && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {bid.prazo_entrega && (
                              <span className="text-[11px] font-semibold bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full">
                                🚚 {LABEL_PRAZO_ENTREGA[bid.prazo_entrega] || bid.prazo_entrega}
                              </span>
                            )}
                            {bid.garantia && (
                              <span className="text-[11px] font-semibold bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full">
                                🛡️ Garantia: {bid.garantia}
                              </span>
                            )}
                            {(bid.formas_pagamento || []).map(fp => (
                              <span key={fp} className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                                💳 {LABEL_FORMA_PAGAMENTO[fp] || fp}
                              </span>
                            ))}
                            {cashbackAtivo && bid.oferece_cashback && bid.valor_cashback_oferecido > 0 && (
                              <span className="text-[11px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                                💰 Cashback: R$ {parseFloat(bid.valor_cashback_oferecido).toFixed(2)}
                              </span>
                            )}
                            {cashbackAtivo && bid.aceita_cashback && (
                              <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                                🪙 Aceita cashback como pagamento
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => toggleDetails(bid.id)}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          {showDetails[bid.id] ? 'Ocultar Itens' : 'Ver Detalhes / Fotos'}
                        </button>

                        {isAccepted ? (
                          <>
                            <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full flex items-center gap-1">
                              ✓ Proposta Confirmada
                            </span>
                            {lojistaPorBid[bid.lojista_id]?.telefone && (
                              <a
                                href={`https://wa.me/55${lojistaPorBid[bid.lojista_id].telefone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                  `Olá, ${lojistaPorBid[bid.lojista_id]?.nome || 'tudo bem'}! Sou ${nome || 'o cliente'} e vamos continuar com o pedido do ${order.descricao || 'produto'} - ${order.codigo_pedido || order.id}.${bid.cashback_aplicado > 0 ? ` Vou usar R$ ${parseFloat(bid.cashback_aplicado).toFixed(2)} de cashback nessa compra.` : ''}`
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1"
                              >
                                💬 WhatsApp
                              </a>
                            )}
                          </>
                        ) : bidAplicandoCashback !== bid.id ? (
                          <button
                            onClick={() => {
                              if (cashbackAtivo && bid.aceita_cashback && saldoCashback > 0) {
                                setBidAplicandoCashback(bid.id);
                                setValorCashbackParaAplicar('');
                              } else {
                                handleAcceptBid(bid.id, 0);
                              }
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm"
                          >
                            Confirmar Proposta
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {!isAccepted && bidAplicandoCashback === bid.id && (
                      <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 space-y-2">
                        <p className="text-xs font-bold text-amber-800">
                          Você tem R$ {saldoCashback.toFixed(2)} de cashback disponível. Quanto quer usar nessa compra?
                        </p>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={Math.min(saldoCashback, total)}
                          value={valorCashbackParaAplicar}
                          onChange={(e) => setValorCashbackParaAplicar(e.target.value)}
                          placeholder="0,00"
                          className="w-full p-2 rounded-lg border border-slate-300 text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAcceptBid(bid.id, 0)}
                            className="text-xs font-bold text-slate-500 px-3 py-1.5"
                          >
                            Não usar cashback
                          </button>
                          <button
                            onClick={() => handleAcceptBid(bid.id, Math.min(parseFloat(valorCashbackParaAplicar || 0), saldoCashback, total))}
                            className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition"
                          >
                            Confirmar usando R$ {parseFloat(valorCashbackParaAplicar || 0).toFixed(2)}
                          </button>
                          <button
                            onClick={() => setBidAplicandoCashback(null)}
                            className="text-xs font-bold text-slate-400 px-2"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {isAccepted && bid.entregue_em && !bidsJaAvaliados.has(bid.id) && (
                      <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 space-y-2">
                        <p className="text-xs font-bold text-amber-800">Como foi sua experiência com esse lojista?</p>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((estrela) => (
                            <button
                              key={estrela}
                              type="button"
                              onClick={() => setNotaSelecionada(prev => ({ ...prev, [bid.id]: estrela }))}
                              className="text-2xl leading-none"
                            >
                              {(notaSelecionada[bid.id] || 0) >= estrela ? '⭐' : '☆'}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => handleAvaliarLojista(bid)}
                          disabled={enviandoAvaliacao === bid.id}
                          className="bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white px-4 py-1.5 rounded-xl text-xs font-bold transition"
                        >
                          {enviandoAvaliacao === bid.id ? 'Enviando...' : 'Enviar Avaliação'}
                        </button>
                      </div>
                    )}

                    {/* Detalhes Expansíveis dos Itens */}
                    {showDetails[bid.id] && (
                      <div className="pt-3 border-t border-slate-200 space-y-2">
                        {items.map((oItem) => {
                          const bItem = bItems.find(bi => bi.order_item_id === oItem.id);
                          return (
                            <div
                              key={oItem.id}
                              className="text-xs text-slate-700 flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs"
                            >
                              <div>
                                <p className="font-bold text-slate-800">{oItem.descricao} (Qtd: {oItem.quantidade})</p>
                                <p className={`font-semibold mt-0.5 ${bItem?.atendido ? 'text-emerald-600' : 'text-rose-600 font-bold'}`}>
                                  {bItem?.atendido ? `R$ ${parseFloat(bItem.preco_unitario || 0).toFixed(2)} / unid` : 'Item indisponível'}
                                </p>
                              </div>

                              <div className="flex gap-2">
                                {oItem.imagem_url && (
                                  <div className="text-center">
                                    <p className="text-[10px] text-slate-400 font-medium mb-1">Cliente</p>
                                    <img
                                      src={oItem.imagem_url}
                                      alt="Cliente"
                                      onClick={() => setActiveImage(oItem.imagem_url)}
                                      className="w-9 h-9 object-cover rounded-lg border border-indigo-100 cursor-pointer hover:opacity-80 transition"
                                    />
                                  </div>
                                )}
                                {bItem?.imagem_url && (
                                  <div className="text-center">
                                    <p className="text-[10px] text-indigo-600 font-bold mb-1">Lojista</p>
                                    <img
                                      src={bItem.imagem_url}
                                      alt="Lojista"
                                      onClick={() => setActiveImage(bItem.imagem_url)}
                                      className="w-9 h-9 object-cover rounded-lg border border-indigo-200 cursor-pointer hover:opacity-80 transition"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                  </div>
                );
              })}
              </>
            )}
          </div>
        )}

      </div>
    );
  };

  const renderSection = (key, titulo, icone, corBg, corBorda, corTexto, listaOrders) => (
    <div className={`${corBg} border ${corBorda} rounded-2xl shadow-sm`}>
      <button
        onClick={() => toggleSection(key)}
        className="w-full flex items-center justify-between gap-2 px-6 py-4 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="text-lg">{icone}</span>
          <h2 className={`text-lg font-bold ${corTexto}`}>{titulo} ({listaOrders.length})</h2>
        </span>
        <span className="text-slate-400 text-xs font-semibold">
          {collapsedSections[key] ? '▸ Expandir' : '▾ Encolher'}
        </span>
      </button>

      {!collapsedSections[key] && (
        <div className="px-6 pb-6 space-y-4">
          {listaOrders.map((order) => renderOrderCard(order))}
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-[#f8f9fa] text-slate-700 min-h-screen flex flex-col justify-between font-sans">
      
      {/* Cabeçalho Principal (Header) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          
          {/* Logo Apenas Imagem (Sem texto) */}
          <Link to="/" className="flex items-center hover:opacity-90 transition">
            <img src={logo} alt="Logo" className="h-10 w-auto object-contain" />
          </Link>

          {/* Menu / Perfil */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {userEmail || 'cliente@nunoselo.com'}
            </div>

            {/* Botão Meus Dados no Cabeçalho */}
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5"
            >
              Meus Dados
            </button>

            <button
              onClick={handleLogout}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6 flex-1">

        {/* Alerta Visual de Proposta Nova — fica fixo até expandir o pedido ou fechar manualmente */}
        {pedidosComPropostaNova.size > 0 && (
          <div className="bg-indigo-600 text-white p-4 rounded-2xl shadow-lg font-bold text-center flex items-center justify-center gap-2 text-sm relative">
            <span>📨</span>
            {pedidosComPropostaNova.size > 1
              ? `Você recebeu novas propostas em ${pedidosComPropostaNova.size} pedidos!`
              : 'Você recebeu uma nova proposta!'}
            <button
              onClick={() => setPedidosComPropostaNova(new Set())}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white text-lg font-bold"
              aria-label="Fechar aviso"
            >
              ✕
            </button>
          </div>
        )}

        {/* Card de Boas-vindas com Botão de Nova Cotação Maior */}
        <div className="relative p-6 rounded-2xl shadow-sm overflow-hidden">
          {/* Camada base: roxo */}
          <div className="absolute inset-0" style={{ backgroundColor: '#5E17EB' }} />
          {/* Camada do meio: azul-marinho, recortada em ângulo */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: '#00068F', clipPath: 'polygon(4% 0, 62% 0, 54% 100%, -4% 100%)' }}
          />
          {/* Faixa fina roxo-clara na borda esquerda, mesmo ângulo */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: '#935DFF', clipPath: 'polygon(0 0, 4% 0, -4% 100%, -8% 100%)' }}
          />

          <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Painel do Cliente</h1>
              <p className="text-sm text-indigo-100 mt-0.5">Gerencie suas cotações e orçamentos recebidos</p>
              {cashbackAtivo && (
                <p className="text-xs font-bold text-amber-300 mt-1.5">
                  💰 Saldo de cashback: R$ {saldoCashback.toFixed(2)}
                </p>
              )}
            </div>

            <Link
              to="/create-request"
              className="w-full md:w-auto bg-white hover:bg-slate-50 active:bg-slate-100 text-indigo-900 px-6 py-3.5 rounded-2xl text-sm sm:text-base font-extrabold italic transition shadow-md flex items-center justify-center gap-2"
            >
              <span className="text-lg leading-none not-italic">+</span> Nova Cotação
            </Link>
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 overflow-x-auto">
            <button
              onClick={() => setStatusFilter('todas')}
              className={`px-3 py-1.5 rounded-lg transition ${statusFilter === 'todas' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50'}`}
            >
              Todas ({orders.length})
            </button>
            <button
              onClick={() => setStatusFilter('em_aberto')}
              className={`px-3 py-1.5 rounded-lg transition ${statusFilter === 'em_aberto' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50'}`}
            >
              Em Aberto ({abertasOrders.length})
            </button>
            <button
              onClick={() => setStatusFilter('confirmadas')}
              className={`px-3 py-1.5 rounded-lg transition ${statusFilter === 'confirmadas' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50'}`}
            >
              Confirmadas ({confirmadasOrders.length})
            </button>
            <button
              onClick={() => setStatusFilter('encerradas')}
              className={`px-3 py-1.5 rounded-lg transition ${statusFilter === 'encerradas' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50'}`}
            >
              Encerradas ({encerradasOrders.length})
            </button>
          </div>

          <div className="relative min-w-[240px]">
            <input
              type="text"
              placeholder="Buscar por pedido ou item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
          </div>
        </div>

        {/* Filtro por Data e Ordenação */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span>📅 Período:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-700 bg-slate-50"
            />
            <span className="text-slate-400">até</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-700 bg-slate-50"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="text-rose-600 font-bold hover:underline"
              >
                Limpar
              </button>
            )}
          </div>

          <div className="flex-1" />

          <button
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            {sortOrder === 'desc' ? '⬇ Mais recentes primeiro' : '⬆ Mais antigos primeiro'}
          </button>
        </div>

        {/* Lista de Cotações, organizada por prioridade: Abertas > Confirmadas > Encerradas */}
        {loading ? (
          <div className="bg-white rounded-2xl p-8 text-center text-slate-500 text-sm border border-slate-200">
            Carregando cotações...
          </div>
        ) : (abertasOrders.length === 0 && confirmadasOrders.length === 0 && encerradasOrders.length === 0) ? (
          <div className="bg-white rounded-2xl p-8 text-center text-slate-500 text-sm border border-slate-200">
            Nenhuma cotação encontrada para este filtro.
          </div>
        ) : (
          <div className="space-y-4">
            {(statusFilter === 'todas' || statusFilter === 'em_aberto') && abertasOrders.length > 0 &&
              renderSection('abertas', 'Em Aberto', '📋', 'bg-white', 'border-slate-200', 'text-slate-800', abertasOrders)}

            {(statusFilter === 'todas' || statusFilter === 'confirmadas') && confirmadasOrders.length > 0 &&
              renderSection('confirmadas', 'Confirmadas', '✅', 'bg-emerald-50/70', 'border-emerald-200', 'text-emerald-900', confirmadasOrders)}

            {(statusFilter === 'todas' || statusFilter === 'encerradas') && encerradasOrders.length > 0 &&
              renderSection('encerradas', 'Encerradas', '🔒', 'bg-slate-100/70', 'border-slate-300', 'text-slate-700', encerradasOrders)}
          </div>
        )}

      </main>

      {/* Rodapé Institucional */}
      <footer className="mt-12 bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="flex flex-wrap justify-center items-center gap-2 mb-1.5 text-slate-600 font-medium">
          <a href="#" className="hover:underline">Central de Ajuda</a>
          <span>•</span>
          <a href="#" className="hover:underline">Termos de Uso</a>
          <span>•</span>
          <a href="#" className="hover:underline">Privacidade</a>
        </div>
        <div>nunoselo.com — 2026 © Todos os direitos reservados</div>
      </footer>

      {/* Modal de Ampliação de Foto */}
      {activeImage && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setActiveImage(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl p-2 flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveImage(null)}
              className="absolute top-3 right-3 bg-slate-800 text-white w-9 h-9 rounded-full flex items-center justify-center font-bold hover:bg-slate-900 transition shadow-md z-10"
            >
              ✕
            </button>
            <img
              src={activeImage}
              alt="Visualização ampliada"
              className="max-w-full max-h-[80vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}

      {/* Modal de Edição dos Dados do Cliente */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800">Meus Dados</h3>
              <button type="button" onClick={() => setIsProfileModalOpen(false)} className="text-slate-400 font-bold text-lg">✕</button>
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
                className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500"
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
                className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Cidade</label>
              <select
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-900 bg-white text-sm focus:ring-2 focus:ring-indigo-500"
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
                className="w-1/2 bg-indigo-600 text-white p-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition shadow-sm text-sm"
              >
                Salvar Alterações
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
