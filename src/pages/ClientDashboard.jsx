import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.svg';
import { getStatusPrazo, aplicarPenalidadeSeNecessario } from '../utils/prazoUtils';
import { Icone, FolhasNuno, FONTE_TITULO, FONTE_TEXTO, carregarFontesNuno, iconePorNome, normalizar } from '../utils/nunoUI';


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
  // Índice da foto mostrada no carrossel de cada proposta (bid_id -> índice)
  const [fotoIndicePorBid, setFotoIndicePorBid] = useState({});
  const [activeImage, setActiveImage] = useState(null);
  const [now, setNow] = useState(Date.now());

  // Encolher/expandir seções e cards individuais
  const [collapsedSections, setCollapsedSections] = useState({ abertas: false, confirmadas: false, encerradas: false });
  const [collapsedCards, setCollapsedCards] = useState(new Set());
  const [abaSelecionada, setAbaSelecionada] = useState('aberto');
  const [pedidoModalId, setPedidoModalId] = useState(null);

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
  const [entregaNoPrazoSelecionada, setEntregaNoPrazoSelecionada] = useState({});
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
  const [isCashbackWalletModalOpen, setIsCashbackWalletModalOpen] = useState(false);
  const [extratoCashback, setExtratoCashback] = useState([]);
  const [expirandoEm7Dias, setExpirandoEm7Dias] = useState(0);
  const [carregandoExtrato, setCarregandoExtrato] = useState(false);
  const [nome, setNome] = useState('');
  const [nomeCategoriaPorId, setNomeCategoriaPorId] = useState({});
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
        const { data: categoriasData } = await supabase.from('categories').select('id, nome');
        setNomeCategoriaPorId(Object.fromEntries((categoriasData || []).map(c => [String(c.id), c.nome])));
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
                .select('id, nome, telefone, reputacao_media, total_avaliacoes, logo_url, percentual_entrega_no_prazo, plano')
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
    const entregaNoPrazo = entregaNoPrazoSelecionada[bid.id];
    if (!nota) {
      alert('Selecione de 1 a 5 estrelas antes de enviar.');
      return;
    }
    if (entregaNoPrazo === undefined) {
      alert('Diz pra gente se a entrega chegou no prazo combinado.');
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
        entrega_no_prazo: entregaNoPrazo,
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

  // Monta o extrato completo (ganhos + usos) pro modal de carteira do cliente
  const carregarExtratoCashback = async () => {
    setCarregandoExtrato(true);
    try {
      const [{ data: creditos }, { data: resgates }] = await Promise.all([
        supabase.from('cashback_creditos').select('*').eq('cliente_id', userId).order('criado_em', { ascending: false }),
        supabase.from('cashback_resgates').select('*').eq('cliente_id', userId).order('criado_em', { ascending: false }),
      ]);

      const lojistaIds = Array.from(new Set([
        ...(creditos || []).map(c => c.lojista_id),
        ...(resgates || []).map(r => r.lojista_id),
      ].filter(Boolean)));

      let nomesMap = {};
      if (lojistaIds.length > 0) {
        const { data: perfis } = await supabase.from('profiles').select('id, nome').in('id', lojistaIds);
        (perfis || []).forEach(p => { nomesMap[p.id] = p.nome; });
      }

      const buscarPedidoDoBid = (bidId) => {
        for (const order of orders) {
          const bidsDoPedido = bidsByOrder[String(order.id)] || [];
          if (bidsDoPedido.some(b => b.id === bidId)) return order;
        }
        return null;
      };

      const itensGanhos = (creditos || []).map(c => ({
        tipo: 'ganho',
        data: c.criado_em,
        valor: parseFloat(c.valor),
        saldoRestante: parseFloat(c.valor) - parseFloat(c.valor_usado),
        lojistaNome: nomesMap[c.lojista_id] || 'Loja',
        status: c.status,
        expiraEm: c.expira_em,
        pedido: buscarPedidoDoBid(c.bid_id),
      }));

      const itensUsos = (resgates || []).map(r => ({
        tipo: 'uso',
        data: r.criado_em,
        valor: parseFloat(r.valor),
        lojistaNome: nomesMap[r.lojista_id] || 'Loja',
        pedido: buscarPedidoDoBid(r.bid_id),
      }));

      const extrato = [...itensGanhos, ...itensUsos].sort((a, b) => new Date(b.data) - new Date(a.data));
      setExtratoCashback(extrato);

      const em7Dias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const totalExpirando = (creditos || [])
        .filter(c => c.status === 'ativo' && new Date(c.expira_em) <= em7Dias && new Date(c.expira_em) > new Date())
        .reduce((soma, c) => soma + (parseFloat(c.valor) - parseFloat(c.valor_usado)), 0);
      setExpirandoEm7Dias(totalExpirando);
    } catch (err) {
      console.error('Erro ao carregar extrato de cashback:', err);
    } finally {
      setCarregandoExtrato(false);
    }
  };

  const toggleDetails = (bidId) => {
    setShowDetails(prev => ({ ...prev, [bidId]: !prev[bidId] }));
  };

  const getRemainingTime = (order) => {
    if (!order?.expira_em) return { texto: 'Sem prazo', expirado: false, pausado: false };
    const status = getStatusPrazo(order, lojistasElegiveisPorPedido[order.id] || [], new Date(now));

    const orderBids = bidsByOrder[String(order.id)] || [];
    const bidAceito = orderBids.find(b => b.status === 'Aceito');

    // Já entregue e ainda não avaliado: pede a avaliação em vez de mostrar
    // qualquer coisa sobre prazo (o pedido já foi concluído).
    if (bidAceito && bidAceito.entregue_em && !bidsJaAvaliados.has(bidAceito.id)) {
      return { texto: 'Avalie sua compra!', expirado: false, pausado: false, precisaAvaliar: true };
    }

    // Se todas as lojas elegíveis já responderam E ainda não tem proposta
    // aceita, não faz sentido continuar mostrando contagem regressiva — o
    // cliente já pode decidir. (Some depois que ele confirma alguma.)
    const elegiveis = lojistasElegiveisPorPedido[order.id] || [];
    if (!status.expirado && !bidAceito && elegiveis.length > 0 && orderBids.length >= elegiveis.length) {
      return { texto: 'Todos os lojistas já responderam — escolha sua proposta!', expirado: false, pausado: false, todosResponderam: true };
    }

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

  // Resumo completo do pedido + proposta, usado na mensagem do WhatsApp
  const LABEL_TIPO_RECEBIMENTO = { entrega: 'Entrega', retirada: 'Retirada na loja', ambos: 'Entrega ou retirada' };
  const montarResumoPedido = (order, bid) => {
    const itens = orderItemsMap[order.id] || [];
    const bItens = bidItemsMap[bid.id] || [];
    const linhas = [];
    linhas.push(`*Pedido #${order.codigo_pedido || order.id}*`);
    linhas.push(`Feito em: ${order.created_at ? new Date(order.created_at).toLocaleString('pt-BR') : '-'}`);
    if (order.tipo_recebimento) linhas.push(`Recebimento: ${LABEL_TIPO_RECEBIMENTO[order.tipo_recebimento] || order.tipo_recebimento}`);
    if (order.bairro) linhas.push(`Bairro: ${order.bairro}`);
    linhas.push('');
    linhas.push('*Itens:*');
    itens.forEach(item => {
      const ofertas = bItens.filter(bi => bi.order_item_id === item.id);
      if (ofertas.length === 0) {
        linhas.push(`- ${item.descricao} (Qtd: ${item.quantidade})`);
        return;
      }
      ofertas.forEach(bi => {
        const partes = [`- ${item.descricao}${bi.nome_opcao ? ` (${bi.nome_opcao})` : ''} · Qtd: ${item.quantidade}`];
        partes.push(bi.atendido ? `R$ ${parseFloat(bi.preco_unitario || 0).toFixed(2)}/unid` : 'sem estoque');
        if (bi.garantia_opcao) partes.push(`garantia: ${bi.garantia_opcao}`);
        if (bi.observacao_opcao) partes.push(`obs: ${bi.observacao_opcao}`);
        if (bi.atendido) respostasDaLoja(bi.respostas).forEach(r => partes.push(r.valor === true ? r.rotulo : `${r.rotulo}: ${Array.isArray(r.valor) ? r.valor.join(', ') : r.valor}`));
        linhas.push(partes.join(' · '));
      });
    });
    linhas.push('');
    linhas.push(`Produto: R$ ${parseFloat(bid.preco || 0).toFixed(2)}${bid.preco_faixa_maximo ? ` até R$ ${parseFloat(bid.preco_faixa_maximo).toFixed(2)}` : ''}`);
    if (bid.preco_kit != null) linhas.push(`Kit fechado: R$ ${parseFloat(bid.preco_kit).toFixed(2)}`);
    if ((order.tipo_recebimento || 'ambos') !== 'retirada') {
      linhas.push(`Frete: ${parseFloat(bid.frete || 0) === 0 ? 'grátis' : `R$ ${parseFloat(bid.frete || 0).toFixed(2)}`}`);
    }
    if (bid.retirada_disponivel) linhas.push('Retirada na loja disponível');
    if (bid.prazo_entrega) linhas.push(`Prazo de entrega: ${LABEL_PRAZO_ENTREGA[bid.prazo_entrega] || bid.prazo_entrega}`);
    if (bid.formas_pagamento && bid.formas_pagamento.length > 0) {
      linhas.push(`Pagamento: ${bid.formas_pagamento.map(fp => LABEL_FORMA_PAGAMENTO[fp] || fp).join(', ')}${bid.parcelas_sem_juros > 1 ? ` (até ${bid.parcelas_sem_juros}x sem juros no cartão)` : ''}`);
    }
    if (bid.garantia) linhas.push(`Garantia: ${bid.garantia}`);
    if (bid.observacao) linhas.push(`Observações: ${bid.observacao}`);
    respostasDaLoja(bid.respostas_lojista).forEach(r => linhas.push(r.valor === true ? r.rotulo : `${r.rotulo}: ${Array.isArray(r.valor) ? r.valor.join(', ') : r.valor}`));
    if (bid.cashback_aplicado > 0) linhas.push(`Cashback usado: R$ ${parseFloat(bid.cashback_aplicado).toFixed(2)}`);
    return linhas.join('\n');
  };

  // "há 12 min", "há 3 h", "há 2 dias"
  const tempoRelativo = (dataStr) => {
    if (!dataStr) return '';
    const diffMin = Math.max(0, Math.floor((now - new Date(dataStr).getTime()) / 60000));
    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `há ${diffMin} min`;
    const horas = Math.floor(diffMin / 60);
    if (horas < 24) return `há ${horas} h`;
    const dias = Math.floor(horas / 24);
    return `há ${dias} dia${dias > 1 ? 's' : ''}`;
  };

  // Fotos do produto pra o carrossel: primeiro as fotos que a loja enviou
  // (uma por item ou opção da faixa); se a loja não mandou nenhuma, usa as
  // fotos de referência que o próprio cliente anexou ao pedido.
  const montarFotosProposta = (bid, items) => {
    const bItens = bidItemsMap[bid.id] || [];
    const fotosLoja = bItens
      .filter(bi => bi.imagem_url && bi.atendido !== false)
      .map(bi => {
        const item = items.find(i => i.id === bi.order_item_id);
        return {
          url: bi.imagem_url,
          legenda: `${item?.descricao || 'Produto'}${bi.nome_opcao ? ` · ${bi.nome_opcao}` : ''}`,
          preco: bi.preco_unitario != null ? brl(bi.preco_unitario) : '',
          daLoja: true,
        };
      });
    if (fotosLoja.length > 0) return fotosLoja;
    return items
      .filter(i => i.imagem_url)
      .map(i => ({ url: i.imagem_url, legenda: `${i.descricao} · sua foto de referência`, preco: '', daLoja: false }));
  };

  // Loja patrocinada = lojista do plano Premium
  const ehPatrocinada = (bid) => lojistaPorBid[bid.lojista_id]?.plano === 'premium';
  // Proposta sem nenhum item em estoque (preço zerado) não é oferta de preço de verdade
  const semEstoqueTotal = (bid) => parseFloat(bid.preco || 0) === 0;

  // Valor usado pra comparar propostas, de acordo com como o cliente quer
  // receber: só retirada = só o produto; só entrega = produto + frete;
  // "ver ambas" = só o produto quando a loja deixa retirar, senão + frete.
  // Lista escolar: quantos itens a loja atende e quais estão em falta
  const ehListaEscolar = (order) => order?.tipo === 'lista_escolar' || !!order?.lista_escolar_id;
  const coberturaDaProposta = (bid, items) => {
    const bItens = bidItemsMap[bid.id] || [];
    const daLista = items.filter(i => !i.fora_da_lista);
    const tem = (item) => bItens.some(bi => bi.order_item_id === item.id && bi.atendido !== false);
    const emFalta = items.filter(i => !tem(i));
    return {
      atendeLista: daLista.filter(tem).length,
      totalLista: daLista.length,
      foraAtende: items.filter(i => i.fora_da_lista && tem(i)).length,
      foraTotal: items.filter(i => i.fora_da_lista).length,
      emFalta,
      similares: bItens.filter(bi => bi.atendido !== false && bi.marca_similar).length,
    };
  };

  const valorComparacao = (bid, order) => {
    const preco = parseFloat(bid.preco_kit != null ? bid.preco_kit : (bid.preco || 0));
    const frete = parseFloat(bid.frete || 0);
    const tipo = order?.tipo_recebimento || 'ambos';
    if (tipo === 'retirada') return preco;
    if (tipo === 'entrega') return preco + frete;
    return bid.retirada_disponivel ? preco : preco + frete;
  };


  /* ============================ NOVO LAYOUT ============================ */

  const [menuContaAberto, setMenuContaAberto] = useState(false);
  const [mostrarPeriodo, setMostrarPeriodo] = useState(false);

  useEffect(() => {
    carregarFontesNuno();
  }, []);

  const brl = (valor) => `R$ ${Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const primeiroNome = (nome || '').trim().split(/\s+/)[0] || '';
  const iniciais = (nome || userEmail || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(parte => parte[0].toUpperCase())
    .join('') || '?';

  const abrirCarteira = () => {
    carregarExtratoCashback();
    setIsCashbackWalletModalOpen(true);
  };

  const abrirPedido = (orderId) => {
    setPedidoModalId(orderId);
    if (pedidosComPropostaNova.has(orderId)) {
      setPedidosComPropostaNova(prev => {
        const novo = new Set(prev);
        novo.delete(orderId);
        return novo;
      });
    }
  };

  // Selo de situação do pedido: texto curto + ícone + cor
  const chipDoPedido = (order) => {
    const tempo = getRemainingTime(order);
    const bidAceito = (bidsByOrder[String(order.id)] || []).find(b => b.status === 'Aceito');
    if (tempo.precisaAvaliar) return { texto: 'Avalie sua compra', icone: 'estrela', preenchido: true, cls: 'bg-[#EFE9FF] text-[#3C0DA8]' };
    if (bidAceito) return { texto: bidAceito.entregue_em ? 'Entregue' : 'Confirmada', icone: 'check', cls: 'bg-[#E3F5EC] text-[#0E7A4E]' };
    if (tempo.todosResponderam) return { texto: 'Todos responderam', icone: 'check', cls: 'bg-[#E3F5EC] text-[#0E7A4E]' };
    if (tempo.expirado) return { texto: tempo.texto, icone: 'relogio', cls: 'bg-[#F0EFF5] text-[#5B5E7A]' };
    if (tempo.pausado) return { texto: tempo.texto, icone: 'pausa', cls: 'bg-[#E7EEFF] text-[#1D4ED8]' };
    return { texto: tempo.texto, icone: 'relogio', cls: 'bg-[#FFF3D6] text-[#8A5A00]' };
  };

  const renderChip = (chip) => (
    <span className={`inline-flex items-center gap-1.5 min-h-[30px] px-2.5 py-1 rounded-full text-xs font-bold ${chip.cls}`}>
      <Icone nome={chip.icone} tamanho={14} strokeWidth={2.2} preenchido={chip.preenchido} />
      <span className="break-words">{chip.texto}</span>
    </span>
  );

  // Barra dividida em pedaços: um pedaço por loja que pode responder
  const renderBarra = (feitas, total, cor, vazio = '#E4E2EF') => {
    if (!total) return null;
    if (total > 12) {
      return (
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: vazio }} aria-hidden="true">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, (feitas / total) * 100)}%`, background: cor }} />
        </div>
      );
    }
    return (
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }} aria-hidden="true">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className="h-1.5 rounded-full" style={{ background: i < feitas ? cor : vazio }} />
        ))}
      </div>
    );
  };

  /* --------------------- Carrossel de fotos da proposta --------------------- */
  const renderCarrosselFotos = (bid, items, selo) => {
    const fotos = montarFotosProposta(bid, items);
    const indice = fotos.length > 0 ? Math.min(fotoIndicePorBid[bid.id] || 0, fotos.length - 1) : 0;
    const foto = fotos[indice];
    const irPara = (novo) => setFotoIndicePorBid(prev => ({ ...prev, [bid.id]: (novo + fotos.length) % fotos.length }));

    return (
      <div className="relative h-48 bg-[#F1EDFB]">
        {foto ? (
          <img
            src={foto.url}
            alt={foto.legenda}
            onClick={() => setActiveImage(foto.url)}
            className="w-full h-full object-contain bg-white cursor-zoom-in"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-[#8B88A6]">
            <Icone nome="camera" tamanho={28} strokeWidth={1.8} />
            <span className="text-xs font-semibold">A loja não enviou foto</span>
          </div>
        )}

        {selo}

        {fotos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => irPara(indice - 1)}
              aria-label="Foto anterior"
              className="absolute left-2 top-[42%] -translate-y-1/2 w-11 h-11 rounded-full bg-white/95 shadow-sm text-[#0E1033] flex items-center justify-center hover:bg-white"
            >
              <Icone nome="esquerda" tamanho={18} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              onClick={() => irPara(indice + 1)}
              aria-label="Próxima foto"
              className="absolute right-2 top-[42%] -translate-y-1/2 w-11 h-11 rounded-full bg-white/95 shadow-sm text-[#0E1033] flex items-center justify-center hover:bg-white"
            >
              <Icone nome="direita" tamanho={18} strokeWidth={2.2} />
            </button>
            <span className="absolute top-3 right-3 h-[26px] px-2.5 rounded-full bg-[#0E1033]/70 text-white text-xs font-bold inline-flex items-center">
              {indice + 1}/{fotos.length}
            </span>
          </>
        )}

        {foto && (
          <div className="absolute bottom-0 inset-x-0 flex items-center justify-between gap-2 px-3 py-1.5 bg-white/90 border-t border-[#E4E2EF]">
            <p className="text-[11px] text-[#5B5E7A] truncate">{foto.legenda}{foto.preco && ` · ${foto.preco}`}</p>
            {fotos.length > 1 && (
              <div className="flex gap-1 shrink-0">
                {fotos.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => irPara(i)}
                    aria-label={`Foto ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${i === indice ? 'w-4 bg-[#5E17EB]' : 'w-1.5 bg-[#0E1033]/25'}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  /* ------------------------- Formulário de avaliação ------------------------- */
  const renderFormAvaliacao = (bid) => (
    <div className="space-y-3">
      <div>
        <p className="text-[13px] font-bold text-[#0E1033] mb-2">Como foi o atendimento dessa loja?</p>
        <div role="radiogroup" aria-label="Nota de 1 a 5" className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((estrela) => {
            const ativa = (notaSelecionada[bid.id] || 0) >= estrela;
            return (
              <button
                key={estrela}
                type="button"
                role="radio"
                aria-checked={notaSelecionada[bid.id] === estrela}
                aria-label={`${estrela} estrela${estrela > 1 ? 's' : ''}`}
                onClick={() => setNotaSelecionada(prev => ({ ...prev, [bid.id]: estrela }))}
                className={`w-11 h-11 rounded-xl border flex items-center justify-center transition ${
                  ativa ? 'border-[#5E17EB] bg-[#EFE9FF] text-[#5E17EB]' : 'border-[#E4E2EF] bg-white text-[#C9C6E0] hover:border-[#935DFF]'
                }`}
              >
                <Icone nome="estrela" tamanho={22} strokeWidth={1.8} preenchido={ativa} />
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-[13px] font-bold text-[#0E1033] mb-2">A entrega chegou no prazo combinado?</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setEntregaNoPrazoSelecionada(prev => ({ ...prev, [bid.id]: true }))}
            className={`h-11 rounded-xl text-sm font-bold border transition ${
              entregaNoPrazoSelecionada[bid.id] === true ? 'bg-[#0E7A4E] text-white border-[#0E7A4E]' : 'bg-white text-[#0E1033] border-[#E4E2EF] hover:border-[#0E7A4E]'
            }`}
          >
            Sim, no prazo
          </button>
          <button
            type="button"
            onClick={() => setEntregaNoPrazoSelecionada(prev => ({ ...prev, [bid.id]: false }))}
            className={`h-11 rounded-xl text-sm font-bold border transition ${
              entregaNoPrazoSelecionada[bid.id] === false ? 'bg-[#E5484D] text-white border-[#E5484D]' : 'bg-white text-[#0E1033] border-[#E4E2EF] hover:border-[#E5484D]'
            }`}
          >
            Não, atrasou
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => handleAvaliarLojista(bid)}
        disabled={enviandoAvaliacao === bid.id}
        className="w-full h-11 rounded-xl bg-[#0E1033] hover:bg-black disabled:opacity-60 text-white text-sm font-bold transition"
      >
        {enviandoAvaliacao === bid.id ? 'Enviando...' : 'Enviar avaliação'}
      </button>
    </div>
  );

  /* ---------------------------- Card de proposta ---------------------------- */
  // Respostas que a loja deu às perguntas da categoria (ex.: marca da peça, "serve nesse veículo")
  const respostasDaLoja = (lista) => (Array.isArray(lista) ? lista : []).filter(r => r && r.valor !== false && r.valor != null && r.valor !== '' && !(Array.isArray(r.valor) && r.valor.length === 0));
  const renderRespostasLoja = (lista, chave) => {
    const respostas = respostasDaLoja(lista);
    if (respostas.length === 0) return null;
    return (
      <ul key={chave} className="flex flex-wrap gap-1.5">
        {respostas.map((r, i) => (
          <li
            key={i}
            className={`inline-flex items-center gap-1.5 min-h-[28px] px-2.5 py-1 rounded-lg text-[13px] ${r.valor === true ? 'bg-[#E3F5EC] text-[#0E7A4E] font-bold' : 'bg-[#F5F4FA] text-[#0E1033]'}`}
          >
            {r.valor === true
              ? <><Icone nome="check" tamanho={14} strokeWidth={2.4} /> {r.rotulo}</>
              : <><span className="text-[#5B5E7A]">{r.rotulo}:</span> <b>{Array.isArray(r.valor) ? r.valor.join(', ') : String(r.valor)}</b></>}
          </li>
        ))}
      </ul>
    );
  };

  const renderPropostaCard = (bid, order, items, posicaoPorBid) => {
    const tipoRecebimento = order.tipo_recebimento || 'ambos';
    const precoProduto = parseFloat(bid.preco || 0);
    const valorFrete = parseFloat(bid.frete || 0);
    // Total que o cliente paga: só o produto quando ele só quer retirar
    const total = tipoRecebimento === 'retirada' ? precoProduto : precoProduto + valorFrete;
    const temFaixaDePreco = bid.preco_faixa_maximo != null && parseFloat(bid.preco_faixa_maximo) > precoProduto;
    const precoProdutoMax = temFaixaDePreco ? parseFloat(bid.preco_faixa_maximo) : null;
    const mostraEntrega = tipoRecebimento !== 'retirada';
    const mostraRetirada = tipoRecebimento === 'retirada' || (tipoRecebimento === 'ambos' && bid.retirada_disponivel);
    const bItems = bidItemsMap[bid.id] || [];
    const isAccepted = bid.status === 'Aceito';
    const patrocinada = ehPatrocinada(bid);
    const posicao = posicaoPorBid[bid.id];

    const lojista = lojistaPorBid[bid.lojista_id] || {};
    const revelaLoja = isAccepted || patrocinada;
    const iniciaisLoja = (lojista.nome || 'Loja').trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join('');
    const formasTexto = (bid.formas_pagamento || []).map(fp => {
      const label = LABEL_FORMA_PAGAMENTO[fp] || fp;
      return fp === 'cartao' && bid.parcelas_sem_juros > 1 ? `${label} em até ${bid.parcelas_sem_juros}x sem juros` : label;
    }).join(', ');
    const prazoTexto = bid.prazo_entrega ? (LABEL_PRAZO_ENTREGA[bid.prazo_entrega] || bid.prazo_entrega).toLowerCase() : '';

    const selo = isAccepted ? (
      <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-[#0E7A4E] text-white text-xs font-bold shadow-sm">
        <Icone nome="check" tamanho={14} strokeWidth={2.2} /> Proposta confirmada
      </span>
    ) : patrocinada ? (
      <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-[#5E17EB] text-white text-xs font-bold shadow-sm">
        <Icone nome="estrela" tamanho={13} preenchido /> Loja patrocinada
      </span>
    ) : posicao ? (
      <span className={`absolute top-3 left-3 inline-flex items-center h-7 px-2.5 rounded-full text-xs font-bold shadow-sm ${
        posicao === 1 ? 'bg-[#0E7A4E] text-white' : 'bg-white text-[#0E1033] border border-[#E4E2EF]'
      }`}>
        {posicao}º lugar
      </span>
    ) : null;

    const linkWhatsApp = isAccepted && lojista.telefone
      ? `https://wa.me/55${lojista.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(
        `Olá, ${lojista.nome || 'tudo bem'}! Sou ${nome || 'o cliente'} e confirmei sua proposta pelo Nuno. Segue o resumo:\n\n${montarResumoPedido(order, bid)}`
      )}`
      : null;
    const mostraConfirmar = !isAccepted && bidAplicandoCashback !== bid.id;
    const temBotaoPrincipal = Boolean(linkWhatsApp) || mostraConfirmar;

    return (
      <article
        key={bid.id}
        className={`bg-white rounded-2xl overflow-hidden flex flex-col ${
          isAccepted ? 'border-2 border-[#0E7A4E]' : patrocinada ? 'border-2 border-[#935DFF]' : 'border border-[#E4E2EF]'
        }`}
      >
        {renderCarrosselFotos(bid, items, selo)}

        <div className="p-4 flex flex-col gap-3 flex-1">
          {/* Loja */}
          <div className="flex items-center gap-2.5">
            {revelaLoja && lojista.logo_url ? (
              <img
                src={lojista.logo_url}
                alt={`Logo de ${lojista.nome || 'loja'}`}
                onClick={() => setActiveImage(lojista.logo_url)}
                className="w-10 h-10 rounded-xl object-cover border border-[#E4E2EF] cursor-zoom-in shrink-0"
              />
            ) : revelaLoja ? (
              <span className="w-10 h-10 rounded-xl bg-[#EFE9FF] text-[#3C0DA8] text-sm font-bold flex items-center justify-center shrink-0">{iniciaisLoja}</span>
            ) : (
              <span className="w-10 h-10 rounded-xl bg-[#F5F4FA] text-[#5B5E7A] flex items-center justify-center shrink-0">
                <Icone nome="cadeado" tamanho={18} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-[#0E1033] truncate">
                {revelaLoja ? (lojista.nome || 'Loja') : 'Loja revelada ao confirmar'}
              </p>
              <p className="text-xs text-[#5B5E7A] flex items-center gap-1 flex-wrap">
                <Icone nome="estrela" tamanho={12} preenchido className="text-[#935DFF]" />
                {Number(lojista.reputacao_media ?? 5).toFixed(1)}
                {lojista.percentual_entrega_no_prazo != null && <span>· {lojista.percentual_entrega_no_prazo}% no prazo</span>}
                {bid.created_at && <span>· recebida {tempoRelativo(bid.created_at)}</span>}
              </p>
            </div>
          </div>

          {!bid.is_completo && (
            <span className="self-start inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-[#FFF3D6] text-[#8A5A00] text-xs font-bold">
              <Icone nome="info" tamanho={14} strokeWidth={2.2} /> Atende parte dos itens
            </span>
          )}

          {ehListaEscolar(order) && (() => {
            const cob = coberturaDaProposta(bid, items);
            const completa = cob.emFalta.length === 0;
            return (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span>{completa ? <b>Completa: </b> : null}{cob.atendeLista} de {cob.totalLista} itens da lista</span>
                  {completa
                    ? <span className="inline-flex h-[26px] px-2.5 rounded-full bg-[#E3F5EC] text-[#0E7A4E] text-xs font-bold items-center">Tudo</span>
                    : <span className="inline-flex h-[26px] px-2.5 rounded-full bg-[#FDECEC] text-[#C53036] text-xs font-bold items-center">{cob.emFalta.length} em falta</span>}
                </div>
                <div className="h-1.5 rounded-full bg-[#E4E2EF] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${cob.totalLista ? (cob.atendeLista / cob.totalLista) * 100 : 0}%`, background: completa ? '#0E7A4E' : '#5E17EB' }} /></div>
                {(cob.foraTotal > 0 || cob.similares > 0) && (
                  <p className="text-xs text-[#5B5E7A]">
                    {[cob.foraTotal > 0 ? `${cob.foraAtende} de ${cob.foraTotal} fora da lista` : null, cob.similares > 0 ? `${cob.similares} com marca similar` : null].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            );
          })()}

          {/* Preço do produto em destaque */}
          {ehListaEscolar(order) ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-[#F5F4FA] px-3 py-2.5">
                <p className="text-xs text-[#5B5E7A]">Soma dos itens</p>
                <p style={FONTE_TITULO} className="text-xl font-bold tracking-tight leading-tight">{brl(precoProduto)}</p>
              </div>
              {bid.preco_kit != null ? (
                <div className="rounded-xl bg-[#E3F5EC] px-3 py-2.5">
                  <p className="text-xs font-bold text-[#0E7A4E]">Kit fechado</p>
                  <p style={FONTE_TITULO} className="text-xl font-bold tracking-tight leading-tight">{brl(bid.preco_kit)}</p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[#D6D3E6] px-3 py-2.5">
                  <p className="text-xs text-[#5B5E7A]">Kit fechado</p>
                  <p className="text-[13px] font-semibold text-[#8B88A6] pt-1">não ofereceu</p>
                </div>
              )}
            </div>
          ) : (
          <div>
            <p className="text-xs text-[#5B5E7A]">Produto</p>
            <p style={FONTE_TITULO} className="text-[26px] font-bold tracking-tight text-[#0E1033] leading-tight">
              {brl(precoProduto)}
              {temFaixaDePreco && (
                <span style={FONTE_TEXTO} className="text-sm font-semibold text-[#5B5E7A] tracking-normal"> a {brl(precoProdutoMax)}</span>
              )}
            </p>
          </div>
          )}

          {/* O que a loja respondeu (no card só quando o pedido tem um produto) */}
          {!ehListaEscolar(order) && (() => {
            const doItem = items.length === 1 ? respostasDaLoja(bItems.find(bi => bi.order_item_id === items[0].id && bi.atendido !== false)?.respostas) : [];
            const doPedido = respostasDaLoja(bid.respostas_lojista);
            if (doItem.length === 0 && doPedido.length === 0) return null;
            return renderRespostasLoja([...doItem, ...doPedido], 'resp-card');
          })()}

          {/* Entrega, retirada e pagamento: uma linha cada */}
          <ul className="space-y-2 text-sm text-[#0E1033]">
            {mostraEntrega && (
              <li className="flex items-start gap-2.5">
                <Icone nome="caminhao" tamanho={18} className={`mt-0.5 ${valorFrete === 0 ? 'text-[#0E7A4E]' : 'text-[#5B5E7A]'}`} />
                <span>
                  {valorFrete === 0 ? <b className="text-[#0E7A4E]">Entrega grátis</b> : <>Entrega <b>+ {brl(valorFrete)}</b></>}
                  {prazoTexto && <span className="text-[#5B5E7A]"> · {prazoTexto}</span>}
                </span>
              </li>
            )}
            {mostraRetirada && (
              <li className="flex items-start gap-2.5">
                <Icone nome="loja" tamanho={18} className="mt-0.5 text-[#5B5E7A]" />
                <span>
                  Retirada na loja, <b className="text-[#0E7A4E]">sem frete</b>
                  {!mostraEntrega && prazoTexto && <span className="text-[#5B5E7A]"> · {prazoTexto}</span>}
                </span>
              </li>
            )}
            {tipoRecebimento === 'ambos' && !bid.retirada_disponivel && (
              <li className="flex items-start gap-2.5 text-[#8B88A6]">
                <Icone nome="loja" tamanho={18} className="mt-0.5" />
                <span>Essa loja não oferece retirada</span>
              </li>
            )}
            {formasTexto && (
              <li className="flex items-start gap-2.5">
                <Icone nome="cartao" tamanho={18} className="mt-0.5 text-[#5B5E7A]" />
                <span>{formasTexto}</span>
              </li>
            )}
            {isAccepted && bid.cashback_aplicado > 0 && (
              <li className="flex items-start gap-2.5 font-bold text-[#8A5A00]">
                <Icone nome="carteira" tamanho={18} className="mt-0.5" />
                <span>{brl(bid.cashback_aplicado)} de cashback aplicado · você paga {brl(total - parseFloat(bid.cashback_aplicado))}</span>
              </li>
            )}
          </ul>

          {/* Botões sempre no mesmo lugar */}
          <div className={`grid gap-2 mt-auto pt-1 ${temBotaoPrincipal ? 'grid-cols-[1fr_1.4fr]' : 'grid-cols-1'}`}>
            <button
              type="button"
              onClick={() => toggleDetails(bid.id)}
              aria-expanded={Boolean(showDetails[bid.id])}
              className="h-12 rounded-xl border border-[#E4E2EF] bg-white text-[15px] font-bold text-[#0E1033] hover:bg-[#F5F4FA] transition"
            >
              {showDetails[bid.id] ? 'Ocultar detalhes' : 'Ver detalhes'}
            </button>
            {linkWhatsApp && (
              <a
                href={linkWhatsApp}
                target="_blank"
                rel="noreferrer"
                className="h-12 rounded-xl bg-[#0E7A4E] hover:bg-[#0B6340] text-white text-[15px] font-bold transition inline-flex items-center justify-center gap-2"
              >
                <Icone nome="mensagem" tamanho={18} /> WhatsApp
              </a>
            )}
            {mostraConfirmar && (
              <button
                type="button"
                onClick={() => {
                  if (cashbackAtivo && bid.aceita_cashback && saldoCashback > 0) {
                    setBidAplicandoCashback(bid.id);
                    setValorCashbackParaAplicar('');
                  } else {
                    handleAcceptBid(bid.id, 0);
                  }
                }}
                className="h-12 rounded-xl bg-[#5E17EB] hover:bg-[#3C0DA8] text-white text-[15px] font-bold transition"
              >
                {ehListaEscolar(order) && bid.preco_kit != null ? 'Confirmar kit' : 'Confirmar'}
              </button>
            )}
          </div>

          {!isAccepted && bidAplicandoCashback === bid.id && (
            <div className="p-3 rounded-xl border border-[#F3DFA8] bg-[#FFF3D6] space-y-2.5">
              <p className="text-[13px] font-bold text-[#8A5A00] flex items-start gap-2">
                <Icone nome="carteira" tamanho={16} className="mt-0.5" />
                Você tem {brl(saldoCashback)} de cashback. Quanto quer usar nessa compra?
              </p>
              <label className="block">
                <span className="sr-only">Valor do cashback</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={Math.min(saldoCashback, total)}
                  value={valorCashbackParaAplicar}
                  onChange={(e) => setValorCashbackParaAplicar(e.target.value)}
                  placeholder="0,00"
                  className="w-full h-11 px-3 rounded-xl border border-[#E4E2EF] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#5E17EB]/30"
                />
              </label>
              <button
                type="button"
                onClick={() => handleAcceptBid(bid.id, Math.min(parseFloat(valorCashbackParaAplicar || 0), saldoCashback, total))}
                className="w-full h-11 rounded-xl bg-[#5E17EB] hover:bg-[#3C0DA8] text-white text-sm font-bold transition"
              >
                Confirmar usando {brl(parseFloat(valorCashbackParaAplicar || 0))}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleAcceptBid(bid.id, 0)}
                  className="h-11 rounded-xl border border-[#E4E2EF] bg-white text-sm font-bold text-[#0E1033]"
                >
                  Não usar cashback
                </button>
                <button
                  type="button"
                  onClick={() => setBidAplicandoCashback(null)}
                  className="h-11 rounded-xl text-sm font-bold text-[#5B5E7A]"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {isAccepted && bid.entregue_em && !bidsJaAvaliados.has(bid.id) && (
            <div className="p-3 rounded-xl border border-[#D9C8FF] bg-[#F7F3FF]">
              {renderFormAvaliacao(bid)}
            </div>
          )}

          {/* Detalhes sob demanda */}
          {showDetails[bid.id] && (
            <div className="pt-3 border-t border-[#E4E2EF] space-y-3 text-[13px] text-[#5B5E7A]">
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-[#8B88A6] uppercase tracking-wide">Itens</p>
                {items.map((oItem) => {
                  const ofertas = bItems.filter(bi => bi.order_item_id === oItem.id);
                  if (ofertas.length === 0 || ofertas.every(o => o.atendido === false)) {
                    return (
                      <p key={oItem.id} className="text-[#C53036] font-semibold">
                        {oItem.descricao} · Qtd {oItem.quantidade} · em falta
                      </p>
                    );
                  }
                  return (
                    <div key={oItem.id} className="space-y-1">
                      {ofertas.map((op, opIdx) => (
                        <div key={op.id || opIdx}>
                          <p>
                            <b className="text-[#0E1033]">
                              {ofertas.length > 1 ? `Opção ${opIdx + 1}` : oItem.descricao}
                              {op.nome_opcao && ` · ${op.nome_opcao}`}
                            </b>
                            {ofertas.length > 1 && <span className="text-[#8B88A6]"> ({oItem.descricao})</span>}
                            {' · '}Qtd {oItem.quantidade} · {brl(op.preco_unitario)}/unid
                          </p>
                          {op.marca_enviada && (
                            <p className={op.marca_similar ? 'font-bold text-[#8A5A00]' : (oItem.marca_sugerida && oItem.preferencia_marca === 'marca' ? 'font-bold text-[#0E7A4E]' : '')}>
                              {op.marca_similar ? `Similar: ${op.marca_enviada}` : oItem.marca_sugerida && oItem.preferencia_marca === 'marca' ? `${op.marca_enviada}, como você pediu` : `Marca: ${op.marca_enviada}`}
                            </p>
                          )}
                          {op.garantia_opcao && <p>Garantia: {op.garantia_opcao}</p>}
                          {op.observacao_opcao && <p>Obs: {op.observacao_opcao}</p>}
                          {op.atendido !== false && (ofertas.length === 1 || opIdx === 0) && respostasDaLoja(op.respostas).length > 0 && (
                            <div className="pt-1">{renderRespostasLoja(op.respostas, `resp-${op.id || opIdx}`)}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              {(bid.garantia || bid.observacao || respostasDaLoja(bid.respostas_lojista).length > 0) && (
                <div className="space-y-1">
                  {bid.garantia && <p><b className="text-[#0E1033]">Garantia:</b> {bid.garantia}</p>}
                  {bid.observacao && <p><b className="text-[#0E1033]">Observações da loja:</b> {bid.observacao}</p>}
                  {respostasDaLoja(bid.respostas_lojista).map((r, i) => (
                    <p key={`rl-${i}`}>
                      <b className="text-[#0E1033]">{r.rotulo}{r.valor === true ? '' : ':'}</b>
                      {r.valor === true ? ' Sim' : ` ${Array.isArray(r.valor) ? r.valor.join(', ') : r.valor}`}
                    </p>
                  ))}
                </div>
              )}

              {mostraEntrega && valorFrete > 0 && (
                <p>
                  <b className="text-[#0E1033]">Total com entrega:</b>{' '}
                  {temFaixaDePreco
                    ? `${brl(precoProduto + valorFrete)} a ${brl(precoProdutoMax + valorFrete)}`
                    : brl(precoProduto + valorFrete)}
                </p>
              )}

              {cashbackAtivo && (bid.oferece_cashback || bid.aceita_cashback) && (
                <div className="space-y-1">
                  {bid.oferece_cashback && bid.valor_cashback_oferecido > 0 && (
                    <p className="flex items-center gap-2">
                      <Icone nome="presente" tamanho={16} className="text-[#5E17EB]" />
                      Você ganha {brl(bid.valor_cashback_oferecido)} de cashback
                    </p>
                  )}
                  {bid.aceita_cashback && (
                    <p className="flex items-center gap-2">
                      <Icone nome="carteira" tamanho={16} className="text-[#5E17EB]" />
                      Aceita seu cashback como parte do pagamento
                    </p>
                  )}
                </div>
              )}

              {items.some(i => i.imagem_url) && (
                <div>
                  <p className="text-[11px] font-bold text-[#8B88A6] uppercase tracking-wide mb-1.5">Suas fotos de referência</p>
                  <div className="flex gap-2 flex-wrap">
                    {items.filter(i => i.imagem_url).map(i => (
                      <img
                        key={i.id}
                        src={i.imagem_url}
                        alt={i.descricao}
                        onClick={() => setActiveImage(i.imagem_url)}
                        className="w-14 h-14 object-cover rounded-xl border border-[#E4E2EF] cursor-zoom-in"
                      />
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-[#8B88A6]">
                Recebida em {bid.created_at ? new Date(bid.created_at).toLocaleString('pt-BR') : '-'}
                {isAccepted && bid.accepted_at && ` · confirmada em ${new Date(bid.accepted_at).toLocaleString('pt-BR')}`}
              </p>
            </div>
          )}
        </div>
      </article>
    );
  };

  /* ------------------ Conteúdo do pedido (comparar propostas) ------------------ */
  const renderOrderCard = (order) => {
    const todasPropostas = bidsByOrder[String(order.id)] || [];
    const hasAcceptedBid = todasPropostas.some(b => b.status === 'Aceito');
    // Depois que uma proposta é aprovada, as outras ficam travadas — só
    // mostra a aceita. Pra ver outras opções, precisa criar uma cotação nova.
    const orderBids = hasAcceptedBid ? todasPropostas.filter(b => b.status === 'Aceito') : todasPropostas;
    const items = orderItemsMap[order.id] || [];
    const tempo = getRemainingTime(order);
    const elegiveis = (lojistasElegiveisPorPedido[order.id] || []).length;

    // Ranking: lojas patrocinadas sempre no topo (ordenadas pelo menor preço
    // entre elas); depois as demais, numeradas a partir de 1.
    // Propostas sem estoque ficam fora do ranking de preço.
    const porValor = (a, b) => valorComparacao(a, order) - valorComparacao(b, order);
    const comPreco = orderBids.filter(b => !semEstoqueTotal(b));
    const rankingPatrocinadas = comPreco.filter(ehPatrocinada).sort(porValor);
    const rankingDemais = comPreco.filter(b => !ehPatrocinada(b)).sort(porValor);
    const posicaoPorBid = {};
    rankingDemais.forEach((b, i) => { posicaoPorBid[b.id] = i + 1; });
    const qtdSemEstoque = orderBids.filter(b => semEstoqueTotal(b) && b.status !== 'Aceito').length;

    const propostasVisiveis = [...orderBids].filter(b => !semEstoqueTotal(b) || b.status === 'Aceito').sort((a, b) => {
      // Sem estoque sempre por último
      if (semEstoqueTotal(a) !== semEstoqueTotal(b)) return semEstoqueTotal(a) ? 1 : -1;
      // Patrocinadas sempre no topo
      if (ehPatrocinada(a) !== ehPatrocinada(b)) return ehPatrocinada(a) ? -1 : 1;
      if (a.is_completo !== b.is_completo) return a.is_completo ? -1 : 1;
      if (ordenarPropostasPor === 'prazo') {
        const pesoA = PESO_PRAZO_ENTREGA[a.prazo_entrega] ?? 999;
        const pesoB = PESO_PRAZO_ENTREGA[b.prazo_entrega] ?? 999;
        if (pesoA !== pesoB) return pesoA - pesoB;
      }
      if (ordenarPropostasPor === 'reputacao') {
        const repA = Number(lojistaPorBid[a.lojista_id]?.reputacao_media ?? 0);
        const repB = Number(lojistaPorBid[b.lojista_id]?.reputacao_media ?? 0);
        if (repA !== repB) return repB - repA;
      }
      return valorComparacao(a, order) - valorComparacao(b, order);
    });

    const textoRespostas = elegiveis > 0
      ? `${todasPropostas.length} de ${elegiveis} loja${elegiveis > 1 ? 's' : ''} ${todasPropostas.length === 1 ? 'respondeu' : 'responderam'}`
      : `${todasPropostas.length} proposta${todasPropostas.length === 1 ? '' : 's'} recebida${todasPropostas.length === 1 ? '' : 's'}`;

    return (
      <div className="space-y-4">

        {/* Cabeçalho do pedido */}
        <section className="space-y-2">
          <p className="text-xs font-semibold text-[#5B5E7A]">
            {items.length} {items.length === 1 ? 'item' : 'itens'}
            {order.created_at && ` · feito ${tempoRelativo(order.created_at)}`}
          </p>
          <h2 style={FONTE_TITULO} className="text-[26px] sm:text-[30px] font-bold leading-[1.15] tracking-tight text-[#0E1033]">
            {order.descricao}
          </h2>
          {order.destaque && (
            <p className="flex items-center gap-2 bg-white border border-[#E4E2EF] rounded-xl px-3 py-2 text-sm">
              <Icone nome={ehListaEscolar(order) ? 'escola' : iconePorNome(nomeCategoriaPorId[String(order.categoria_id)] || '')} tamanho={16} className="text-[#5E17EB]" />
              <b>{order.destaque}</b>
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {renderChip(chipDoPedido(order))}
            {order.tipo_recebimento && (
              <span className="inline-flex items-center min-h-[30px] px-2.5 rounded-full bg-white border border-[#E4E2EF] text-[#5B5E7A] text-xs font-bold">
                {LABEL_TIPO_RECEBIMENTO[order.tipo_recebimento] || order.tipo_recebimento}
              </span>
            )}
            {order.status && (
              <span className="inline-flex items-center min-h-[30px] px-2.5 rounded-full bg-white border border-[#E4E2EF] text-[#5B5E7A] text-xs font-bold">
                {order.status}
              </span>
            )}
          </div>
        </section>

        {/* Resumo das respostas + ranking */}
        {!hasAcceptedBid && (
          <section aria-label="Resumo das respostas" className="bg-[#00068F] rounded-2xl p-4 sm:p-5 text-white space-y-3">
            <div className="flex justify-between items-baseline gap-2">
              <span className="font-bold text-[15px]">{textoRespostas}</span>
              {elegiveis > todasPropostas.length && !tempo.expirado && (
                <span className="text-xs text-[#C9C6FF]">{elegiveis - todasPropostas.length} aguardando</span>
              )}
            </div>
            {renderBarra(todasPropostas.length, elegiveis, '#935DFF', 'rgba(255,255,255,0.2)')}
            {comPreco.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {rankingPatrocinadas.map((bid) => (
                  <div key={bid.id} className="shrink-0 min-w-[108px] rounded-xl bg-white/10 px-3 py-2">
                    <p className="text-[11px] font-semibold text-[#C9C6FF] flex items-center gap-1">
                      <Icone nome="estrela" tamanho={11} preenchido /> Patrocinada
                    </p>
                    <p className="font-bold text-[15px]">
                      {bid.preco_faixa_maximo && <span className="text-[11px] font-semibold">a partir de </span>}
                      {brl(valorComparacao(bid, order))}
                    </p>
                  </div>
                ))}
                {rankingDemais.map((bid, i) => (
                  <div key={bid.id} className={`shrink-0 min-w-[108px] rounded-xl px-3 py-2 ${i === 0 ? 'bg-white text-[#0E1033]' : 'bg-white/10'}`}>
                    <p className={`text-[11px] ${i === 0 ? 'font-bold text-[#0E7A4E]' : 'font-semibold text-[#C9C6FF]'}`}>{i + 1}º lugar</p>
                    <p className="font-bold text-[15px]">
                      {bid.preco_faixa_maximo && <span className="text-[11px] font-semibold">a partir de </span>}
                      {brl(valorComparacao(bid, order))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Propostas */}
        {orderBids.length === 0 ? (
          <div className="bg-white border border-dashed border-[#D6D3E6] rounded-2xl p-8 text-center flex flex-col items-center gap-2 text-sm text-[#5B5E7A]">
            <Icone nome={tempo.expirado ? 'relogio' : 'sino'} tamanho={26} className="text-[#8B88A6]" />
            {tempo.expirado ? 'Nenhuma proposta foi enviada durante o prazo.' : 'Aguardando propostas dos lojistas. Avisamos você quando chegar.'}
          </div>
        ) : (
          <>
            {hasAcceptedBid && todasPropostas.length > 1 && (
              <p className="flex items-start gap-2 text-[13px] text-[#5B5E7A] bg-white border border-[#E4E2EF] rounded-xl px-3 py-2.5">
                <Icone nome="cadeado" tamanho={16} className="mt-0.5" />
                As outras {todasPropostas.length - 1} proposta(s) deste pedido ficaram ocultas após a aprovação. Para comparar outras opções, crie uma nova cotação.
              </p>
            )}

            {!hasAcceptedBid && propostasVisiveis.length > 1 && (
              <div role="group" aria-label="Ordenar propostas" className="flex gap-2 overflow-x-auto pb-1">
                {[
                  ['preco', 'Menor preço'],
                  ['prazo', 'Entrega mais rápida'],
                  ['reputacao', 'Reputação'],
                ].map(([chave, rotulo]) => (
                  <button
                    key={chave}
                    type="button"
                    aria-pressed={ordenarPropostasPor === chave}
                    onClick={() => setOrdenarPropostasPor(chave)}
                    className={`shrink-0 h-10 px-4 rounded-full text-[13px] font-bold transition ${
                      ordenarPropostasPor === chave
                        ? 'bg-[#0E1033] text-white'
                        : 'bg-white border border-[#E4E2EF] text-[#0E1033] hover:border-[#935DFF]'
                    }`}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
            )}

            <div className={`grid grid-cols-1 gap-4 ${propostasVisiveis.length > 1 ? 'md:grid-cols-2' : 'max-w-xl'}`}>
              {propostasVisiveis.map((bid) => renderPropostaCard(bid, order, items, posicaoPorBid))}
            </div>

            {qtdSemEstoque > 0 && (
              <p className="px-4 py-3 border border-dashed border-[#D6D3E6] rounded-xl text-[13px] text-[#5B5E7A] text-center">
                {qtdSemEstoque === 1 ? '1 loja respondeu sem estoque' : `${qtdSemEstoque} lojas responderam sem estoque`} · fora do comparativo
              </p>
            )}
          </>
        )}
      </div>
    );
  };

  /* --------------------------- Card da lista de pedidos --------------------------- */
  const renderOrderRow = (order) => {
    const orderBids = bidsByOrder[String(order.id)] || [];
    const tempo = getRemainingTime(order);
    const chip = chipDoPedido(order);
    const bidAceito = orderBids.find(b => b.status === 'Aceito');
    const temPropostaNova = pedidosComPropostaNova.has(order.id);
    const temAvisoNovo = temPropostaNova || tempo.precisaAvaliar;

    const qtdElegiveis = (lojistasElegiveisPorPedido[order.id] || []).length;
    const qtdResponderam = orderBids.length;
    const comPreco = orderBids.filter(b => !semEstoqueTotal(b));
    const melhor = comPreco.reduce((m, b) => (!m || valorComparacao(b, order) < valorComparacao(m, order) ? b : m), null);

    const tom = bidAceito || tempo.todosResponderam ? 'sucesso' : tempo.expirado ? 'neutro' : 'marca';
    const TONS_ICONE = {
      marca: 'bg-[#EFE9FF] text-[#5E17EB]',
      sucesso: 'bg-[#E3F5EC] text-[#0E7A4E]',
      neutro: 'bg-[#F0EFF5] text-[#5B5E7A]',
    };
    const corBarra = tom === 'sucesso' ? '#0E7A4E' : tom === 'neutro' ? '#8B88A6' : '#5E17EB';

    let textoProgresso;
    if (qtdElegiveis > 0) {
      textoProgresso = qtdResponderam >= qtdElegiveis
        ? (qtdElegiveis === 1 ? 'A loja respondeu' : `Todas as ${qtdElegiveis} lojas responderam`)
        : `${qtdResponderam} de ${qtdElegiveis} loja${qtdElegiveis > 1 ? 's' : ''} ${qtdResponderam === 1 ? 'respondeu' : 'responderam'}`;
    } else {
      textoProgresso = qtdResponderam === 0
        ? 'Aguardando propostas'
        : `${qtdResponderam} proposta${qtdResponderam > 1 ? 's' : ''} recebida${qtdResponderam > 1 ? 's' : ''}`;
    }

    const preco = bidAceito
      ? { rotulo: 'Valor confirmado', valor: valorComparacao(bidAceito, order), aPartir: false }
      : melhor
        ? { rotulo: 'Melhor oferta', valor: valorComparacao(melhor, order), aPartir: Boolean(melhor.preco_faixa_maximo) }
        : null;

    let acao = { rotulo: 'Ver pedido', destaque: false };
    if (tempo.precisaAvaliar) acao = { rotulo: 'Avaliar compra', destaque: false };
    else if (bidAceito) acao = { rotulo: 'Ver pedido', destaque: false };
    else if (tempo.todosResponderam) acao = { rotulo: 'Escolher proposta', destaque: true };
    else if (qtdResponderam > 0 && !tempo.expirado) acao = { rotulo: 'Comparar propostas', destaque: false };

    return (
      <article
        key={order.id}
        onClick={() => abrirPedido(order.id)}
        className={`relative bg-white rounded-2xl border p-4 sm:p-5 cursor-pointer transition hover:shadow-[0_6px_20px_rgba(14,16,51,0.08)] ${
          temAvisoNovo ? 'border-[#F3B4B6]' : 'border-[#E4E2EF] hover:border-[#C9B6FB]'
        }`}
      >
        {temAvisoNovo && (
          <span className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-[#E5484D]" title="Novidade neste pedido" />
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex gap-3 items-start flex-1 min-w-0 pr-5 sm:pr-0">
            <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${TONS_ICONE[tom]}`}>
              <Icone nome={ehListaEscolar(order) ? 'escola' : iconePorNome(nomeCategoriaPorId[String(order.categoria_id)] || '')} tamanho={24} />
            </span>
            <div className="min-w-0 flex-1 space-y-2.5">
              <div>
                <p className="text-xs font-semibold text-[#5B5E7A]">
                  Pedido #{order.codigo_pedido || order.id}
                  {order.created_at && ` · ${tempoRelativo(order.created_at)}`}
                </p>
                <h3 className="text-base font-bold leading-snug text-[#0E1033] line-clamp-2">{order.descricao}</h3>
                {order.destaque && (
                  <p className="flex items-center gap-2 mt-1.5 bg-[#F5F4FA] rounded-xl px-2.5 py-1.5 text-[13px] text-[#0E1033]">
                    <Icone nome={ehListaEscolar(order) ? 'escola' : iconePorNome(nomeCategoriaPorId[String(order.categoria_id)] || '')} tamanho={15} className="text-[#5E17EB]" />
                    <span className="font-semibold line-clamp-2">{order.destaque}</span>
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between gap-2 text-[13px]">
                  <span className="text-[#5B5E7A]">{textoProgresso}</span>
                  {temPropostaNova ? (
                    <span className="font-bold text-[#3C0DA8] shrink-0">Proposta nova</span>
                  ) : tempo.todosResponderam ? (
                    <span className="font-bold text-[#0E7A4E] shrink-0">Pronto pra escolher</span>
                  ) : null}
                </div>
                {!bidAceito && renderBarra(qtdResponderam, qtdElegiveis, corBarra)}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2 sm:w-48 shrink-0">
            {preco ? (
              <div className="sm:text-right">
                <p className="text-xs text-[#5B5E7A]">{preco.rotulo}</p>
                <p style={FONTE_TITULO} className="text-[22px] font-bold tracking-tight text-[#0E1033] leading-tight">
                  {preco.aPartir && <span style={FONTE_TEXTO} className="text-xs font-semibold text-[#5B5E7A] tracking-normal">a partir de </span>}
                  {brl(preco.valor)}
                </p>
              </div>
            ) : (
              <p className="text-[13px] text-[#8B88A6]">Sem preço ainda</p>
            )}
            {renderChip(chip)}
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:justify-end gap-2">
          {bidAceito && bidAceito.entregue_em && !ehListaEscolar(order) && (
            <Link
              to={`/create-request?repetir=${order.id}`}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:w-auto min-h-[46px] px-5 rounded-xl text-[15px] font-bold inline-flex items-center justify-center gap-1.5 bg-[#5E17EB] hover:bg-[#3C0DA8] text-white transition"
            >
              <Icone nome="repetir" tamanho={18} /> Repetir pedido
            </Link>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); abrirPedido(order.id); }}
            className={`w-full sm:w-auto min-h-[46px] px-5 rounded-xl text-[15px] font-bold inline-flex items-center justify-center gap-1.5 transition ${
              acao.destaque ? 'bg-[#5E17EB] hover:bg-[#3C0DA8] text-white' : 'bg-[#EFE9FF] hover:bg-[#E3D8FF] text-[#3C0DA8]'
            }`}
          >
            {acao.rotulo}
            <Icone nome="direita" tamanho={16} strokeWidth={2.2} />
          </button>
        </div>
      </article>
    );
  };

  /* ------------------------------ Dados da página ------------------------------ */
  const avaliacoesPendentes = orders.flatMap(o =>
    (bidsByOrder[String(o.id)] || [])
      .filter(b => b.status === 'Aceito' && b.entregue_em && !bidsJaAvaliados.has(b.id))
      .map(b => ({ order: o, bid: b }))
  );

  const limite7Dias = now + 7 * 24 * 60 * 60 * 1000;
  const cashbackVencendo = meusCreditosCashback
    .filter(c => new Date(c.expira_em).getTime() <= limite7Dias)
    .reduce((soma, c) => soma + (parseFloat(c.valor) - parseFloat(c.valor_usado)), 0);

  const abas = [
    { key: 'aberto', label: 'Em aberto', lista: abertasOrders, aviso: abertasOrders.filter(o => pedidosComPropostaNova.has(o.id)).length },
    { key: 'confirmadas', label: 'Confirmadas', lista: confirmadasOrders, aviso: confirmadasOrders.filter(o => (bidsByOrder[String(o.id)] || []).some(b => b.status === 'Aceito' && b.entregue_em && !bidsJaAvaliados.has(b.id))).length },
    { key: 'encerradas', label: 'Encerradas', lista: encerradasOrders, aviso: 0 },
  ];
  const abaAtual = abas.find(a => a.key === abaSelecionada) || abas[0];
  const TEXTO_VAZIO = {
    aberto: 'Nenhum pedido em aberto.',
    confirmadas: 'Nenhum pedido confirmado ainda.',
    encerradas: 'Nenhum pedido encerrado.',
  };
  const filtrandoAlgo = Boolean(searchTerm || dateFrom || dateTo);
  const temColunaLateral = avaliacoesPendentes.length > 0 || cashbackAtivo;
  const fecharPedido = () => setPedidoModalId(null);

  return (
    <div className="bg-[#F5F4FA] text-[#0E1033] min-h-screen flex flex-col" style={FONTE_TEXTO}>

      {/* Cabeçalho */}
      <header className="bg-white/95 backdrop-blur border-b border-[#E4E2EF] sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center hover:opacity-90 transition" aria-label="Nuno, início">
            <img src={logo} alt="Nuno" className="h-9 w-auto object-contain" />
          </Link>

          <div className="flex items-center gap-2">
            {cashbackAtivo && (
              <button
                type="button"
                onClick={abrirCarteira}
                className="hidden sm:inline-flex items-center gap-2 h-11 px-4 rounded-full border border-[#E4E2EF] bg-white text-sm font-semibold text-[#0E1033] hover:border-[#935DFF] transition"
              >
                <Icone nome="presente" tamanho={18} className="text-[#5E17EB]" />
                {brl(saldoCashback)} de cashback
              </button>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuContaAberto(v => !v)}
                aria-expanded={menuContaAberto}
                aria-haspopup="menu"
                aria-label="Menu da conta"
                className="inline-flex items-center gap-2 h-11 pl-1.5 pr-3 rounded-full border border-[#E4E2EF] bg-white text-sm font-semibold text-[#0E1033] hover:border-[#935DFF] transition"
              >
                <span className="w-8 h-8 rounded-full bg-[#EFE9FF] text-[#3C0DA8] text-[13px] font-bold flex items-center justify-center">{iniciais}</span>
                <span className="hidden sm:inline max-w-[140px] truncate">{primeiroNome || 'Minha conta'}</span>
                <Icone nome="baixo" tamanho={16} className="text-[#5B5E7A]" />
              </button>

              {menuContaAberto && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuContaAberto(false)} />
                  <div role="menu" className="absolute right-0 mt-2 w-64 z-50 bg-white rounded-2xl border border-[#E4E2EF] shadow-[0_12px_32px_rgba(14,16,51,0.14)] p-2">
                    {userEmail && <p className="px-3 py-2 text-xs text-[#5B5E7A] truncate">{userEmail}</p>}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setMenuContaAberto(false); setIsProfileModalOpen(true); }}
                      className="w-full flex items-center gap-2.5 h-11 px-3 rounded-xl text-sm font-semibold text-[#0E1033] hover:bg-[#F5F4FA]"
                    >
                      <Icone nome="usuario" tamanho={18} className="text-[#5B5E7A]" /> Meus dados
                    </button>
                    {cashbackAtivo && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setMenuContaAberto(false); abrirCarteira(); }}
                        className="w-full flex items-center gap-2.5 h-11 px-3 rounded-xl text-sm font-semibold text-[#0E1033] hover:bg-[#F5F4FA]"
                      >
                        <Icone nome="carteira" tamanho={18} className="text-[#5B5E7A]" /> Minha carteira
                      </button>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 h-11 px-3 rounded-xl text-sm font-semibold text-[#C53036] hover:bg-[#FDECEC]"
                    >
                      <Icone nome="sair" tamanho={18} /> Sair
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-5 sm:py-8 space-y-6 flex-1">

        {/* Aviso de proposta nova — fica até abrir o pedido ou fechar o aviso */}
        {pedidosComPropostaNova.size > 0 && (
          <div className="bg-white border border-[#C9B6FB] rounded-2xl p-2 pl-3 flex items-center gap-3" role="status">
            <span className="w-10 h-10 rounded-xl bg-[#5E17EB] text-white flex items-center justify-center shrink-0">
              <Icone nome="sino" tamanho={20} />
            </span>
            <p className="flex-1 text-sm font-bold text-[#0E1033]">
              {pedidosComPropostaNova.size > 1
                ? `Você recebeu propostas novas em ${pedidosComPropostaNova.size} pedidos`
                : 'Você recebeu uma proposta nova'}
            </p>
            <button
              type="button"
              onClick={() => setPedidosComPropostaNova(new Set())}
              aria-label="Fechar aviso"
              className="w-11 h-11 rounded-xl text-[#5B5E7A] hover:bg-[#F5F4FA] flex items-center justify-center"
            >
              <Icone nome="fechar" tamanho={18} />
            </button>
          </div>
        )}

        {/* Boas-vindas + Nova cotação */}
        <section className="relative overflow-hidden bg-[#00068F] rounded-3xl px-5 py-6 sm:px-10 sm:py-9 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <FolhasNuno className="absolute -right-24 -top-4 w-48 h-48 opacity-40 sm:opacity-100 sm:w-80 sm:h-80 sm:-right-10 sm:-top-16 pointer-events-none" />
          <div className="relative space-y-1.5 max-w-xl">
            <p className="text-sm font-semibold text-[#C9C6FF]">{primeiroNome ? `Olá, ${primeiroNome}` : 'Olá!'}</p>
            <h1 style={FONTE_TITULO} className="text-[30px] sm:text-[40px] leading-[1.1] font-bold tracking-tight text-white">
              Do que você precisa hoje?
            </h1>
            <p className="text-sm sm:text-[15px] text-[#C9C6FF]">
              Descreva o produto e as lojas da sua cidade mandam o preço pra você comparar.
            </p>
          </div>
          <div className="relative flex flex-col gap-3 sm:items-end">
            <Link
              to="/create-request"
              className="inline-flex items-center justify-center gap-2.5 h-14 px-7 rounded-2xl bg-white text-[#00068F] text-[17px] font-bold hover:bg-[#EFE9FF] transition shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
            >
              <Icone nome="mais" tamanho={22} strokeWidth={2.5} className="text-[#5E17EB]" />
              Nova cotação
            </Link>
            {cashbackAtivo && (
              <button
                type="button"
                onClick={abrirCarteira}
                className="sm:hidden flex items-center justify-between min-h-[44px] px-3.5 rounded-xl bg-white/10 text-white text-sm"
              >
                <span className="flex items-center gap-2">
                  <Icone nome="presente" tamanho={18} className="text-[#C9C6FF]" /> Cashback disponível
                </span>
                <b>{brl(saldoCashback)}</b>
              </button>
            )}
          </div>
        </section>

        <div className={`grid grid-cols-1 gap-6 items-start ${temColunaLateral ? 'lg:grid-cols-[minmax(0,1fr)_320px]' : ''}`}>

          {/* Coluna dos pedidos */}
          <div className="space-y-4 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <h2 style={FONTE_TITULO} className="text-2xl font-bold tracking-tight text-[#0E1033]">Meus pedidos</h2>
              <div role="tablist" aria-label="Situação dos pedidos" className="grid grid-cols-3 sm:inline-flex gap-1 p-1 bg-white border border-[#E4E2EF] rounded-2xl">
                {abas.map((aba) => {
                  const ativa = abaSelecionada === aba.key;
                  return (
                    <button
                      key={aba.key}
                      type="button"
                      role="tab"
                      aria-selected={ativa}
                      onClick={() => setAbaSelecionada(aba.key)}
                      className={`relative inline-flex items-center justify-center gap-1.5 h-10 px-2 sm:px-4 rounded-xl text-[13px] sm:text-sm transition ${
                        ativa ? 'bg-[#5E17EB] text-white font-bold' : 'text-[#5B5E7A] font-semibold hover:text-[#0E1033]'
                      }`}
                    >
                      {aba.label}
                      <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold items-center justify-center ${
                        ativa ? 'inline-flex bg-white text-[#3C0DA8]' : 'hidden sm:inline-flex bg-[#F0EFF5] text-[#5B5E7A]'
                      }`}>
                        {aba.lista.length}
                      </span>
                      {aba.aviso > 0 && (
                        <span
                          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#E5484D] text-white text-[10px] font-bold flex items-center justify-center"
                          aria-label={`${aba.aviso} novidade(s)`}
                        >
                          {aba.aviso}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Busca, período e ordenação */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <label className="w-full sm:flex-1 flex items-center gap-2.5 h-12 px-3.5 bg-white border border-[#E4E2EF] rounded-xl focus-within:border-[#5E17EB] focus-within:ring-2 focus-within:ring-[#5E17EB]/20 transition">
                  <Icone nome="busca" tamanho={18} className="text-[#5B5E7A]" />
                  <span className="sr-only">Buscar pedido</span>
                  <input
                    type="search"
                    placeholder="Buscar produto ou nº do pedido"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm text-[#0E1033] placeholder-[#8B88A6]"
                  />
                </label>
                <div className="grid grid-cols-2 sm:flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMostrarPeriodo(v => !v)}
                    aria-expanded={mostrarPeriodo}
                    className={`inline-flex items-center justify-center gap-2 h-12 px-4 rounded-xl border text-sm font-semibold transition ${
                      dateFrom || dateTo ? 'border-[#5E17EB] bg-[#EFE9FF] text-[#3C0DA8]' : 'border-[#E4E2EF] bg-white text-[#0E1033] hover:border-[#935DFF]'
                    }`}
                  >
                    <Icone nome="calendario" tamanho={18} />
                    Período
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))}
                    className="inline-flex items-center justify-center gap-2 h-12 px-4 rounded-xl border border-[#E4E2EF] bg-white text-sm font-semibold text-[#0E1033] hover:border-[#935DFF] transition whitespace-nowrap"
                  >
                    <Icone nome="ordenar" tamanho={18} />
                    {sortOrder === 'desc' ? 'Mais recentes' : 'Mais antigos'}
                  </button>
                </div>
              </div>

              {mostrarPeriodo && (
                <div className="flex flex-wrap items-end gap-3 bg-white border border-[#E4E2EF] rounded-xl p-3">
                  <label className="flex flex-col gap-1 text-xs font-semibold text-[#5B5E7A]">
                    De
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="h-11 px-3 rounded-xl border border-[#E4E2EF] text-sm text-[#0E1033] bg-white"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold text-[#5B5E7A]">
                    Até
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="h-11 px-3 rounded-xl border border-[#E4E2EF] text-sm text-[#0E1033] bg-white"
                    />
                  </label>
                  {(dateFrom || dateTo) && (
                    <button
                      type="button"
                      onClick={() => { setDateFrom(''); setDateTo(''); }}
                      className="h-11 px-3 rounded-xl text-sm font-bold text-[#C53036] hover:bg-[#FDECEC]"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Lista de pedidos da aba selecionada */}
            {loading ? (
              <div className="bg-white rounded-2xl p-8 text-center text-[#5B5E7A] text-sm border border-[#E4E2EF]">
                Carregando seus pedidos...
              </div>
            ) : abaAtual.lista.length === 0 ? (
              <div className="bg-white border border-dashed border-[#D6D3E6] rounded-2xl p-8 text-center flex flex-col items-center gap-3">
                <span className="w-12 h-12 rounded-2xl bg-[#F5F4FA] text-[#8B88A6] flex items-center justify-center">
                  <Icone nome={filtrandoAlgo ? 'busca' : 'caixa'} tamanho={24} />
                </span>
                <p className="text-sm text-[#5B5E7A]">
                  {filtrandoAlgo ? 'Nenhum pedido encontrado com esses filtros.' : TEXTO_VAZIO[abaAtual.key]}
                </p>
                {abaAtual.key === 'aberto' && !filtrandoAlgo && (
                  <Link to="/create-request" className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-[#EFE9FF] text-[#3C0DA8] text-sm font-bold">
                    <Icone nome="mais" tamanho={16} strokeWidth={2.4} /> Fazer uma cotação
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {abaAtual.lista.map((order) => renderOrderRow(order))}
              </div>
            )}
          </div>

          {/* Coluna lateral: avaliação pendente e carteira */}
          {temColunaLateral && (
            <aside className="space-y-4">
              {avaliacoesPendentes.map(({ order, bid }) => (
                <section
                  key={bid.id}
                  aria-label="Avalie sua compra"
                  className="bg-white border border-[#E4E2EF] border-l-4 border-l-[#935DFF] rounded-2xl p-4 space-y-3"
                >
                  <div>
                    <h2 className="text-base font-bold text-[#0E1033]">Avalie sua compra</h2>
                    <p className="text-[13px] text-[#5B5E7A]">
                      {order.descricao} · {lojistaPorBid[bid.lojista_id]?.nome || 'Loja'}
                    </p>
                  </div>
                  {renderFormAvaliacao(bid)}
                </section>
              ))}

              {cashbackAtivo && (
                <section aria-label="Sua carteira" className="bg-white border border-[#E4E2EF] rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-xl bg-[#EFE9FF] text-[#5E17EB] flex items-center justify-center">
                      <Icone nome="carteira" tamanho={18} />
                    </span>
                    <h2 className="text-base font-bold text-[#0E1033]">Sua carteira</h2>
                  </div>
                  <div>
                    <p style={FONTE_TITULO} className="text-[28px] font-bold tracking-tight text-[#0E1033] leading-tight">{brl(saldoCashback)}</p>
                    <p className="text-[13px] text-[#5B5E7A]">Cashback pra usar nas lojas parceiras do Nuno.</p>
                  </div>
                  {cashbackVencendo > 0 && (
                    <p className="flex items-center gap-2 text-[13px] font-semibold text-[#8A5A00] bg-[#FFF3D6] rounded-xl px-3 py-2">
                      <Icone nome="relogio" tamanho={16} />
                      {brl(cashbackVencendo)} vencem nos próximos 7 dias
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={abrirCarteira}
                    className="w-full h-11 rounded-xl border border-[#E4E2EF] text-sm font-bold text-[#0E1033] hover:bg-[#F5F4FA] transition"
                  >
                    Ver extrato
                  </button>
                </section>
              )}
            </aside>
          )}
        </div>
      </main>

      {/* Pedido aberto: comparar propostas (tela cheia no celular) */}
      {pedidoModalId && (() => {
        const pedido = orders.find(o => o.id === pedidoModalId);
        if (!pedido) return null;
        return (
          <div className="fixed inset-0 z-[60] bg-[#0E1033]/60 backdrop-blur-sm flex sm:items-center justify-center sm:p-4" onClick={fecharPedido}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Pedido ${pedido.codigo_pedido || pedido.id}`}
              className="bg-[#F5F4FA] w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-5xl sm:rounded-3xl overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 bg-white border-b border-[#E4E2EF] flex items-center gap-1 px-2 sm:px-4 h-14">
                <button
                  type="button"
                  onClick={fecharPedido}
                  aria-label="Voltar para Meus pedidos"
                  className="sm:hidden w-11 h-11 rounded-xl text-[#0E1033] flex items-center justify-center"
                >
                  <Icone nome="esquerda" tamanho={22} strokeWidth={2.2} />
                </button>
                <span className="flex-1 font-bold text-base text-[#0E1033] sm:pl-1">Pedido #{pedido.codigo_pedido || pedido.id}</span>
                <button
                  type="button"
                  onClick={fecharPedido}
                  aria-label="Fechar"
                  className="hidden sm:flex w-11 h-11 rounded-xl text-[#5B5E7A] hover:bg-[#F5F4FA] items-center justify-center"
                >
                  <Icone nome="fechar" tamanho={20} />
                </button>
              </div>
              <div className="p-4 sm:p-6">
                {renderOrderCard(pedido)}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Rodapé institucional */}
      <footer className="mt-12 bg-white border-t border-[#E4E2EF]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row justify-between gap-3 text-[13px] text-[#5B5E7A]">
          <span>nunoselo.com · 2026 · Todos os direitos reservados</span>
          <nav aria-label="Links institucionais" className="flex flex-wrap gap-x-5 gap-y-2">
            <a href="https://www.comprecomnuno.com.br/contato" target="_blank" rel="noreferrer" className="text-[#5E17EB] hover:underline">Central de ajuda</a>
            <a href="https://www.comprecomnuno.com.br/termos" target="_blank" rel="noreferrer" className="text-[#5E17EB] hover:underline">Termos de uso</a>
            <a href="https://www.comprecomnuno.com.br/privacidade" target="_blank" rel="noreferrer" className="text-[#5E17EB] hover:underline">Privacidade</a>
          </nav>
        </div>
      </footer>

      {/* Carteira / extrato de cashback */}
      {isCashbackWalletModalOpen && (
        <div className="fixed inset-0 z-[60] bg-[#0E1033]/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setIsCashbackWalletModalOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Minha carteira de cashback"
            className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 style={FONTE_TITULO} className="text-xl font-bold text-[#0E1033] flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-[#EFE9FF] text-[#5E17EB] flex items-center justify-center">
                  <Icone nome="carteira" tamanho={18} />
                </span>
                Minha carteira
              </h3>
              <button
                type="button"
                onClick={() => setIsCashbackWalletModalOpen(false)}
                aria-label="Fechar"
                className="w-11 h-11 rounded-xl text-[#5B5E7A] hover:bg-[#F5F4FA] flex items-center justify-center"
              >
                <Icone nome="fechar" tamanho={20} />
              </button>
            </div>

            <div className="bg-[#00068F] rounded-2xl p-5 text-white">
              <p className="text-xs font-semibold text-[#C9C6FF]">Saldo disponível</p>
              <p style={FONTE_TITULO} className="text-[32px] font-bold tracking-tight leading-tight">{brl(saldoCashback)}</p>
              <p className="text-xs text-[#C9C6FF] mt-1">Use em qualquer loja parceira que aceite cashback.</p>
            </div>

            {expirandoEm7Dias > 0 && (
              <div className="flex items-start gap-2 bg-[#FFF3D6] rounded-xl p-3 text-[13px] font-semibold text-[#8A5A00]">
                <Icone nome="alerta" tamanho={16} className="mt-0.5" />
                {brl(expirandoEm7Dias)} vai expirar nos próximos 7 dias. Aproveite antes de perder!
              </div>
            )}

            <div>
              <p className="text-xs font-bold text-[#8B88A6] uppercase tracking-wide mb-2">Extrato</p>
              {carregandoExtrato ? (
                <p className="text-sm text-[#8B88A6] text-center py-4">Carregando...</p>
              ) : extratoCashback.length === 0 ? (
                <p className="text-sm text-[#8B88A6] text-center py-4">Nenhuma movimentação ainda.</p>
              ) : (
                <div className="divide-y divide-[#E4E2EF] border border-[#E4E2EF] rounded-2xl">
                  {extratoCashback.map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 px-3.5 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0E1033]">
                          {item.tipo === 'ganho' ? `Ganho na ${item.lojistaNome}` : `Usado na ${item.lojistaNome}`}
                          {item.pedido && <span className="text-[#8B88A6] font-normal"> · Pedido #{item.pedido.codigo_pedido || item.pedido.id}</span>}
                        </p>
                        <p className="text-xs text-[#8B88A6]">
                          {new Date(item.data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {item.tipo === 'ganho' && item.status === 'expirado' && <span className="text-[#C53036] font-semibold"> · Expirado</span>}
                          {item.tipo === 'ganho' && item.status === 'ativo' && (
                            <span> · Vence em {new Date(item.expiraEm).toLocaleDateString('pt-BR')}</span>
                          )}
                        </p>
                      </div>
                      <p className={`text-sm font-bold whitespace-nowrap ${item.tipo === 'ganho' ? 'text-[#0E7A4E]' : 'text-[#C53036]'}`}>
                        {item.tipo === 'ganho' ? '+' : '-'}{brl(item.valor)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Foto ampliada */}
      {activeImage && (
        <div
          className="fixed inset-0 z-[100] bg-[#0E1033]/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setActiveImage(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] bg-white rounded-3xl overflow-hidden shadow-2xl p-2 flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveImage(null)}
              aria-label="Fechar foto"
              className="absolute top-3 right-3 bg-[#0E1033] text-white w-11 h-11 rounded-full flex items-center justify-center hover:bg-black transition shadow-md z-10"
            >
              <Icone nome="fechar" tamanho={20} />
            </button>
            <img
              src={activeImage}
              alt="Visualização ampliada"
              className="max-w-full max-h-[80vh] object-contain rounded-2xl"
            />
          </div>
        </div>
      )}

      {/* Meus dados */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[60] bg-[#0E1033]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveProfile} className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 style={FONTE_TITULO} className="text-xl font-bold text-[#0E1033]">Meus dados</h3>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                aria-label="Fechar"
                className="w-11 h-11 rounded-xl text-[#5B5E7A] hover:bg-[#F5F4FA] flex items-center justify-center"
              >
                <Icone nome="fechar" tamanho={20} />
              </button>
            </div>

            <label className="block">
              <span className="block text-[13px] font-semibold text-[#5B5E7A] mb-1">E-mail (não editável)</span>
              <input
                type="email"
                value={userEmail}
                disabled
                className="w-full h-12 px-3 rounded-xl border border-[#E4E2EF] bg-[#F5F4FA] text-[#5B5E7A] cursor-not-allowed text-sm"
              />
            </label>

            <label className="block">
              <span className="block text-[13px] font-semibold text-[#0E1033] mb-1">Nome completo</span>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
                className="w-full h-12 px-3 rounded-xl border border-[#E4E2EF] text-[#0E1033] text-sm focus:outline-none focus:border-[#5E17EB] focus:ring-2 focus:ring-[#5E17EB]/20"
                required
              />
            </label>

            <label className="block">
              <span className="block text-[13px] font-semibold text-[#0E1033] mb-1">Telefone / WhatsApp</span>
              <input
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(22) 99999-9999"
                className="w-full h-12 px-3 rounded-xl border border-[#E4E2EF] text-[#0E1033] text-sm focus:outline-none focus:border-[#5E17EB] focus:ring-2 focus:ring-[#5E17EB]/20"
                required
              />
            </label>

            <label className="block">
              <span className="block text-[13px] font-semibold text-[#0E1033] mb-1">Cidade</span>
              <select
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                className="w-full h-12 px-3 rounded-xl border border-[#E4E2EF] text-[#0E1033] bg-white text-sm focus:outline-none focus:border-[#5E17EB] focus:ring-2 focus:ring-[#5E17EB]/20"
              >
                <option value="">Selecione sua cidade...</option>
                {cities.map((c) => (
                  <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="h-12 rounded-xl border border-[#E4E2EF] text-[#0E1033] font-bold hover:bg-[#F5F4FA] transition text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="h-12 rounded-xl bg-[#5E17EB] hover:bg-[#3C0DA8] text-white font-bold transition text-sm"
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
