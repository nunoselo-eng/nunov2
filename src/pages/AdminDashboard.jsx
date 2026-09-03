import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { createClient } from '@supabase/supabase-js';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('lojistas'); // 'lojistas' ou 'pedidos'

  // --- ESTADOS DA ABA LOJISTAS E CATEGORIAS ---
  const [lojistas, setLojistas] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedCityFilter, setSelectedCityFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Modais de Lojista e Categoria
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [novaCidade, setNovaCidade] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novasCategoriasIds, setNovasCategoriasIds] = useState([]);
  const [novoHorarioAbertura, setNovoHorarioAbertura] = useState('08:00');
  const [novoHorarioFechamento, setNovoHorarioFechamento] = useState('18:00');
  const [novosDiasFuncionamento, setNovosDiasFuncionamento] = useState(['seg', 'ter', 'qua', 'qui', 'sex', 'sab']);

  // Modal de Cadastro de Cliente
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [novoNomeCliente, setNovoNomeCliente] = useState('');
  const [novoEmailCliente, setNovoEmailCliente] = useState('');
  const [novaSenhaCliente, setNovaSenhaCliente] = useState('');
  const [novoTelefoneCliente, setNovoTelefoneCliente] = useState('');
  const [novaCidadeCliente, setNovaCidadeCliente] = useState('');

  // Modal de Cadastro de Representante Comercial
  const [isRepModalOpen, setIsRepModalOpen] = useState(false);
  const [novoNomeRep, setNovoNomeRep] = useState('');
  const [novoEmailRep, setNovoEmailRep] = useState('');
  const [novaSenhaRep, setNovaSenhaRep] = useState('');

  // Modal de Som de Notificação do Lojista
  const [isSomModalOpen, setIsSomModalOpen] = useState(false);
  const [arquivoSom, setArquivoSom] = useState(null);
  const [enviandoSom, setEnviandoSom] = useState(false);
  const [somAtualUrl, setSomAtualUrl] = useState(null);

  // Modal de Avaliações (contestações e correções de reputação)
  const [isAvaliacoesModalOpen, setIsAvaliacoesModalOpen] = useState(false);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [filtroAvaliacoes, setFiltroAvaliacoes] = useState('contestadas');
  const [penalidadesAutomaticas, setPenalidadesAutomaticas] = useState([]);
  const [avaliacaoEditando, setAvaliacaoEditando] = useState(null);
  const [notaEditada, setNotaEditada] = useState('');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLojistaId, setEditingLojistaId] = useState(null);
  const [editNome, setEditNome] = useState('');
  const [editCidade, setEditCidade] = useState('');
  const [editTelefone, setEditTelefone] = useState('');
  const [editHorarioAbertura, setEditHorarioAbertura] = useState('08:00');
  const [editHorarioFechamento, setEditHorarioFechamento] = useState('18:00');
  const [editDiasFuncionamento, setEditDiasFuncionamento] = useState(['seg', 'ter', 'qua', 'qui', 'sex', 'sab']);
  const [arquivoLogo, setArquivoLogo] = useState(null);
  const [logoAtualUrl, setLogoAtualUrl] = useState(null);

  const DIAS_SEMANA = [
    { key: 'dom', label: 'Dom' },
    { key: 'seg', label: 'Seg' },
    { key: 'ter', label: 'Ter' },
    { key: 'qua', label: 'Qua' },
    { key: 'qui', label: 'Qui' },
    { key: 'sex', label: 'Sex' },
    { key: 'sab', label: 'Sáb' },
  ];

  const toggleDia = (dias, setDias, diaKey) => {
    if (dias.includes(diaKey)) setDias(dias.filter(d => d !== diaKey));
    else setDias([...dias, diaKey]);
  };

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('');
  const [editingCatId, setEditingCatId] = useState(null);
  const [editingCatNome, setEditingCatNome] = useState('');

  // --- ESTADOS DA ABA COTAÇÕES E PROPOSTAS ---
  const [orders, setOrders] = useState([]);
  const [bidsByOrder, setBidsByOrder] = useState({});
  const [clients, setClients] = useState([]);
  const [stores, setStores] = useState([]);
  const [profilesMap, setProfilesMap] = useState(new Map());
  const [orderItemsMap, setOrderItemsMap] = useState({});
  const [bidItemsMap, setBidItemsMap] = useState({});

  // Filtros de Cotações
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  const [dataFiltroDe, setDataFiltroDe] = useState('');
  const [dataFiltroAte, setDataFiltroAte] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modais de Imagem e Detalhes
  const [showDetails, setShowDetails] = useState({});
  const [activeImage, setActiveImage] = useState(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  async function fetchAllData() {
    setLoading(true);

    // 1. Perfis e Lojistas
    const { data: profilesData } = await supabase.from('profiles').select('*');
    const pMap = new Map((profilesData || []).map(p => [String(p.id), p]));
    setProfilesMap(pMap);

    const lojistasList = (profilesData || []).filter(p => p.tipo === 'lojista');
    setClients(profilesData || []);

    // 2. Categorias
    const { data: catsData } = await supabase.from('categories').select('*');
    const uniqueCategoriesMap = new Map();
    (catsData || []).forEach(cat => {
      const nomeChave = cat.nome?.trim().toLowerCase();
      if (nomeChave && !uniqueCategoriesMap.has(nomeChave)) {
        uniqueCategoriesMap.set(nomeChave, cat);
      }
    });

    // 3. Cidades
    const { data: citiesData } = await supabase.from('cities').select('*');
    const uniqueCitiesMap = new Map();
    (citiesData || []).forEach(c => {
      if (c.nome && !uniqueCitiesMap.has(c.nome.trim().toLowerCase())) {
        uniqueCitiesMap.set(c.nome.trim().toLowerCase(), c);
      }
    });
    const citiesMap = new Map((citiesData || []).map(c => [String(c.id), c.nome]));

    // 4. Vínculos Lojista-Categorias
    const { data: vinculosData } = await supabase.from('lojista_categorias').select('*');

    const formattedLojistas = lojistasList.map(lojista => {
      const catIds = (vinculosData || [])
        .filter(v => v.lojista_id === lojista.id)
        .map(v => v.categoria_id);

      return {
        ...lojista,
        categoriasSelecionadas: catIds,
        ativo: lojista.ativo ?? true
      };
    });

    setLojistas(formattedLojistas);
    setCategories(Array.from(uniqueCategoriesMap.values()));
    setCities(Array.from(uniqueCitiesMap.values()));

    // 5. Cotações e Itens
    const { data: ordersData } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    const { data: orderItemsData } = await supabase.from('order_items').select('*');
    
    const oItemsMap = {};
    (orderItemsData || []).forEach(item => {
      if (!oItemsMap[item.order_id]) oItemsMap[item.order_id] = [];
      oItemsMap[item.order_id].push(item);
    });
    setOrderItemsMap(oItemsMap);

    // 6. Busca de Propostas (Bids) por IDs dos Pedidos
    let bidsData = [];
    if (ordersData && ordersData.length > 0) {
      const orderIds = ordersData.map(o => o.id);
      
      const { data: bData } = await supabase.from('bids').select('*').in('order_id', orderIds);
      if (bData) bidsData = bData;

      // Fallback por pedido_id
      const { data: fallbackBids } = await supabase.from('bids').select('*').in('pedido_id', orderIds);
      if (fallbackBids && fallbackBids.length > 0) {
        fallbackBids.forEach(fb => {
          if (!bidsData.some(b => b.id === fb.id)) {
            bidsData.push(fb);
          }
        });
      }
    }

    // Busca itens de todas as propostas encontradas
    if (bidsData.length > 0) {
      const bidIds = bidsData.map(b => b.id);
      const { data: bidItemsData } = await supabase.from('bid_items').select('*').in('bid_id', bidIds);

      const bItemsMap = {};
      (bidItemsData || []).forEach(item => {
        if (!bItemsMap[item.bid_id]) bItemsMap[item.bid_id] = [];
        bItemsMap[item.bid_id].push(item);
      });
      setBidItemsMap(bItemsMap);
    }

    // Mapeamento Agrupado de Propostas por Pedido
    const groupedBids = {};
    bidsData.forEach(bid => {
      const key1 = bid.order_id ? String(bid.order_id) : null;
      const key2 = bid.pedido_id ? String(bid.pedido_id) : null;

      if (key1) {
        if (!groupedBids[key1]) groupedBids[key1] = [];
        if (!groupedBids[key1].some(b => b.id === bid.id)) groupedBids[key1].push(bid);
      }
      if (key2) {
        if (!groupedBids[key2]) groupedBids[key2] = [];
        if (!groupedBids[key2].some(b => b.id === bid.id)) groupedBids[key2].push(bid);
      }
    });
    setBidsByOrder(groupedBids);

    const lojistaIdsInBids = Array.from(new Set(bidsData.map(b => b.lojista_id).filter(Boolean)));
    setStores((profilesData || []).filter(p => lojistaIdsInBids.includes(p.id)));

    if (ordersData) {
      const formattedOrders = ordersData.map(o => ({
        ...o,
        cidade_nome_exibicao: citiesMap.get(String(o.cidade_id)) || o.cidade_id || 'Não informada',
        cliente: pMap.get(String(o.cliente_id))
      }));
      setOrders(formattedOrders);
    }

    setLoading(false);
  }

  // Helper de Cidades
  const saveCityIfNew = async (cityName) => {
    if (!cityName) return;
    const exists = cities.some(c => c.nome.toLowerCase() === cityName.trim().toLowerCase());
    if (!exists) {
      const { error } = await supabase.from('cities').insert([{ nome: cityName.trim() }]);
      if (error) throw error;
    }
  };

  // Funções da Aba de Lojistas
  const handleToggleAtivo = async (lojistaId, statusAtual) => {
    const novoStatus = !statusAtual;
    const { error } = await supabase.from('profiles').update({ ativo: novoStatus }).eq('id', lojistaId);
    if (error) alert('Erro ao atualizar status: ' + error.message);
    else setLojistas(lojistas.map(l => l.id === lojistaId ? { ...l, ativo: novoStatus } : l));
  };

  const handleCategoryChange = async (lojistaId, catId) => {
    const lojista = lojistas.find(l => l.id === lojistaId);
    let novasCategorias = [...lojista.categoriasSelecionadas];

    if (novasCategorias.includes(catId)) {
      novasCategorias = novasCategorias.filter(id => id !== catId);
      await supabase.from('lojista_categorias').delete().eq('lojista_id', lojistaId).eq('categoria_id', catId);
    } else {
      novasCategorias.push(catId);
      await supabase.from('lojista_categorias').insert([{ lojista_id: lojistaId, categoria_id: catId }]);
    }

    setLojistas(lojistas.map(l => l.id === lojistaId ? { ...l, categoriasSelecionadas: novasCategorias } : l));
  };

  const handleCreateLojista = async (e) => {
    e.preventDefault();
    try {
      const supabaseUrl = supabase.supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = supabase.supabaseKey || import.meta.env.VITE_SUPABASE_ANON_KEY;

      const tempClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
      const { data: authData, error: authError } = await tempClient.auth.signUp({ email: novoEmail, password: novaSenha });
      if (authError) throw authError;

      const userId = authData.user?.id;
      if (novaCidade) await saveCityIfNew(novaCidade);

      const { error: profileError } = await supabase.from('profiles').insert([{
        id: userId,
        tipo: 'lojista',
        nome: novoNome,
        cidade: novaCidade,
        telefone: novoTelefone,
        ativo: true,
        horario_abertura: novoHorarioAbertura,
        horario_fechamento: novoHorarioFechamento,
        dias_funcionamento: novosDiasFuncionamento
      }]);

      if (profileError) throw profileError;

      if (novasCategoriasIds.length > 0) {
        const vinculos = novasCategoriasIds.map(catId => ({ lojista_id: userId, categoria_id: catId }));
        await supabase.from('lojista_categorias').insert(vinculos);
      }

      alert('Lojista cadastrado com sucesso!');
      setIsModalOpen(false);
      setNovoNome(''); setNovoEmail(''); setNovaSenha(''); setNovaCidade(''); setNovoTelefone(''); setNovasCategoriasIds([]);
      setNovoHorarioAbertura('08:00'); setNovoHorarioFechamento('18:00'); setNovosDiasFuncionamento(['seg', 'ter', 'qua', 'qui', 'sex', 'sab']);
      fetchAllData();
    } catch (err) {
      alert('Erro ao cadastrar lojista: ' + err.message);
    }
  };

  const handleCreateCliente = async (e) => {
    e.preventDefault();
    try {
      const supabaseUrl = supabase.supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = supabase.supabaseKey || import.meta.env.VITE_SUPABASE_ANON_KEY;

      const tempClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
      const { data: authData, error: authError } = await tempClient.auth.signUp({ email: novoEmailCliente, password: novaSenhaCliente });
      if (authError) throw authError;

      const userId = authData.user?.id;
      if (novaCidadeCliente) await saveCityIfNew(novaCidadeCliente);

      const { error: profileError } = await supabase.from('profiles').insert([{
        id: userId,
        tipo: 'cliente',
        nome: novoNomeCliente,
        cidade: novaCidadeCliente,
        telefone: novoTelefoneCliente,
        ativo: true
      }]);

      if (profileError) throw profileError;

      alert('Cliente cadastrado com sucesso!');
      setIsClientModalOpen(false);
      setNovoNomeCliente(''); setNovoEmailCliente(''); setNovaSenhaCliente(''); setNovaCidadeCliente(''); setNovoTelefoneCliente('');
      fetchAllData();
    } catch (err) {
      alert('Erro ao cadastrar cliente: ' + err.message);
    }
  };

  const handleCreateRepresentante = async (e) => {
    e.preventDefault();
    try {
      const supabaseUrl = supabase.supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = supabase.supabaseKey || import.meta.env.VITE_SUPABASE_ANON_KEY;

      // O representante não usa e-mail de verdade: montamos um e-mail interno
      // a partir do usuário escolhido, só pra satisfazer o Supabase Auth.
      const usuarioLimpo = novoEmailRep.trim().toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '');
      const emailInterno = `${usuarioLimpo}@interno.nunoselo.app`;

      const tempClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
      const { data: authData, error: authError } = await tempClient.auth.signUp({ email: emailInterno, password: novaSenhaRep });
      if (authError) throw authError;

      const userId = authData.user?.id;

      const { error: profileError } = await supabase.from('profiles').insert([{
        id: userId,
        tipo: 'criador_de_contas',
        nome: novoNomeRep,
        ativo: true
      }]);

      if (profileError) throw profileError;

      alert(`Representante cadastrado! Usuário para login: ${usuarioLimpo}`);
      setIsRepModalOpen(false);
      setNovoNomeRep(''); setNovoEmailRep(''); setNovaSenhaRep('');
      fetchAllData();
    } catch (err) {
      alert('Erro ao cadastrar representante: ' + err.message);
    }
  };

  // Caminho fixo do arquivo dentro do bucket 'audio' — sempre sobrescreve
  // o mesmo arquivo, então o lojista sempre busca a versão mais recente.
  const CAMINHO_SOM_NOTIFICACAO = 'notificacao-lojista';

  const carregarSomAtual = () => {
    const { data } = supabase.storage.from('audio').getPublicUrl(CAMINHO_SOM_NOTIFICACAO);
    setSomAtualUrl(data?.publicUrl ? `${data.publicUrl}?t=${Date.now()}` : null);
  };

  const handleUploadSom = async (e) => {
    e.preventDefault();
    if (!arquivoSom) {
      alert('Escolha um arquivo de som primeiro.');
      return;
    }
    setEnviandoSom(true);
    try {
      const { error } = await supabase.storage
        .from('audio')
        .upload(CAMINHO_SOM_NOTIFICACAO, arquivoSom, {
          upsert: true,
          contentType: arquivoSom.type || 'audio/mpeg',
        });

      if (error) throw error;

      alert('Som de notificação atualizado! Já vale para todos os lojistas.');
      setArquivoSom(null);
      carregarSomAtual();
    } catch (err) {
      alert('Erro ao enviar o som: ' + err.message);
    } finally {
      setEnviandoSom(false);
    }
  };

  const carregarAvaliacoes = async (filtro) => {
    setFiltroAvaliacoes(filtro);
    let query = supabase.from('avaliacoes').select('*').order('criado_em', { ascending: false });
    if (filtro === 'contestadas') query = query.eq('contestada', true).eq('desconsiderada', false);
    const { data: avaliacoesData } = await query;

    const ids = Array.from(new Set((avaliacoesData || []).flatMap(a => [a.avaliador_id, a.avaliado_id]).filter(Boolean)));
    let nomesMap = {};
    if (ids.length > 0) {
      const { data: perfis } = await supabase.from('profiles').select('id, nome').in('id', ids);
      (perfis || []).forEach(p => { nomesMap[p.id] = p.nome; });
    }

    setAvaliacoes((avaliacoesData || []).map(a => ({
      ...a,
      nomeAvaliador: nomesMap[a.avaliador_id] || 'Desconhecido',
      nomeAvaliado: nomesMap[a.avaliado_id] || 'Desconhecido',
    })));
  };

  const handleSalvarNotaEditada = async (avaliacaoId) => {
    const nota = parseInt(notaEditada);
    if (!nota || nota < 1 || nota > 5) {
      alert('A nota precisa ser de 1 a 5.');
      return;
    }
    try {
      const { error } = await supabase.from('avaliacoes').update({ nota, contestada: false }).eq('id', avaliacaoId);
      if (error) throw error;
      alert('Nota corrigida! A média foi recalculada automaticamente.');
      setAvaliacaoEditando(null);
      carregarAvaliacoes(filtroAvaliacoes);
    } catch (err) {
      alert('Erro ao corrigir nota: ' + err.message);
    }
  };

  const handleDesconsiderarAvaliacao = async (avaliacaoId, desconsiderar) => {
    try {
      const { error } = await supabase.from('avaliacoes').update({ desconsiderada: desconsiderar, contestada: false }).eq('id', avaliacaoId);
      if (error) throw error;
      carregarAvaliacoes(filtroAvaliacoes);
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  };

  const carregarPenalidades = async () => {
    setFiltroAvaliacoes('penalidades');
    const { data: penalidadesData } = await supabase
      .from('penalidades_processadas')
      .select('*')
      .order('criado_em', { ascending: false });

    const ids = Array.from(new Set((penalidadesData || []).map(p => p.usuario_id).filter(Boolean)));
    const orderIds = Array.from(new Set((penalidadesData || []).map(p => p.order_id).filter(Boolean)));

    let nomesMap = {};
    if (ids.length > 0) {
      const { data: perfis } = await supabase.from('profiles').select('id, nome').in('id', ids);
      (perfis || []).forEach(p => { nomesMap[p.id] = p.nome; });
    }
    let pedidosMap = {};
    if (orderIds.length > 0) {
      const { data: pedidos } = await supabase.from('orders').select('id, codigo_pedido').in('id', orderIds);
      (pedidos || []).forEach(o => { pedidosMap[o.id] = o.codigo_pedido; });
    }

    setPenalidadesAutomaticas((penalidadesData || []).map(p => ({
      ...p,
      nomeUsuario: nomesMap[p.usuario_id] || 'Desconhecido',
      codigoPedido: pedidosMap[p.order_id] || p.order_id,
    })));
  };

  const handleReverterPenalidade = async (penalidadeId) => {
    if (!window.confirm('Reverter essa penalidade automática? A reputação da pessoa volta a subir.')) return;
    try {
      const { error } = await supabase.from('penalidades_processadas').delete().eq('id', penalidadeId);
      if (error) throw error;
      carregarPenalidades();
    } catch (err) {
      alert('Erro ao reverter: ' + err.message);
    }
  };

  const handleSaveEditLojista = async (e) => {
    e.preventDefault();
    try {
      if (editCidade) await saveCityIfNew(editCidade);

      let logoUrl;
      if (arquivoLogo) {
        const extensao = arquivoLogo.name.split('.').pop();
        const caminho = `${editingLojistaId}.${extensao}`;
        const { error: uploadErr } = await supabase.storage
          .from('logos')
          .upload(caminho, arquivoLogo, { upsert: true, contentType: arquivoLogo.type });
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('logos').getPublicUrl(caminho);
        logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      }

      const dadosParaAtualizar = {
        nome: editNome,
        cidade: editCidade,
        telefone: editTelefone,
        horario_abertura: editHorarioAbertura,
        horario_fechamento: editHorarioFechamento,
        dias_funcionamento: editDiasFuncionamento,
      };
      if (logoUrl) dadosParaAtualizar.logo_url = logoUrl;

      const { error } = await supabase.from('profiles').update(dadosParaAtualizar).eq('id', editingLojistaId);

      if (error) throw error;
      alert('Dados atualizados com sucesso!');
      setIsEditModalOpen(false);
      setArquivoLogo(null);
      fetchAllData();
    } catch (err) {
      alert('Erro ao atualizar dados: ' + err.message);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!novaCategoriaNome.trim()) return;
    try {
      const { error } = await supabase.from('categories').insert([{ nome: novaCategoriaNome.trim() }]);
      if (error) throw error;
      alert('Categoria cadastrada com sucesso!');
      setNovaCategoriaNome('');
      fetchAllData();
    } catch (err) {
      alert('Erro ao cadastrar categoria: ' + err.message);
    }
  };

  const handleSaveEditCategory = async (catId) => {
    if (!editingCatNome.trim()) return;
    try {
      await supabase.from('categories').update({ nome: editingCatNome.trim() }).eq('id', catId);
      alert('Categoria atualizada com sucesso!');
      setEditingCatId(null);
      setEditingCatNome('');
      fetchAllData();
    } catch (err) {
      alert('Erro ao atualizar categoria: ' + err.message);
    }
  };

  const handleDeleteCategory = async (catId) => {
    if (!confirm('Deseja realmente excluir esta categoria?')) return;
    try {
      const { error } = await supabase.from('categories').delete().eq('id', catId);
      if (error) throw error;
      alert('Categoria excluída com sucesso!');
      fetchAllData();
    } catch (err) {
      alert('Erro ao excluir categoria: ' + err.message);
    }
  };

  // Filtro de Pedidos
  const filteredOrders = orders.filter(order => {
    if (selectedCity && String(order.cidade_id) !== String(selectedCity) && order.cidade_nome_exibicao !== selectedCity) return false;
    if (selectedClient && String(order.cliente_id) !== String(selectedClient)) return false;
    if (selectedStore) {
      const orderBids = bidsByOrder[String(order.id)] || [];
      if (!orderBids.some(b => String(b.lojista_id) === String(selectedStore))) return false;
    }
    if (dataFiltroDe && new Date(order.created_at) < new Date(dataFiltroDe + 'T00:00:00')) return false;
    if (dataFiltroAte && new Date(order.created_at) > new Date(dataFiltroAte + 'T23:59:59')) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchDesc = order.descricao?.toLowerCase().includes(term);
      const matchCodigo = order.codigo_pedido?.toLowerCase().includes(term);
      const matchCliente = order.cliente?.nome?.toLowerCase().includes(term);
      if (!matchDesc && !matchCodigo && !matchCliente) return false;
    }
    return true;
  });

  // Exporta os pedidos filtrados (respeitando cidade/cliente/lojista/data/busca) em CSV
  const handleExportarCSV = () => {
    const linhas = [
      ['Codigo Pedido', 'Data', 'Cliente', 'Cidade', 'Descricao', 'Status', 'Lojista Aceito', 'Valor Total'].join(';')
    ];

    filteredOrders.forEach((order) => {
      const orderBids = bidsByOrder[String(order.id)] || [];
      const bidAceito = orderBids.find(b => b.status === 'Aceito');
      const lojistaAceito = bidAceito ? (stores.find(st => String(st.id) === String(bidAceito.lojista_id))?.nome || '') : '';
      const valorTotal = bidAceito ? (parseFloat(bidAceito.preco || 0) + parseFloat(bidAceito.frete || 0)).toFixed(2) : '';

      const linha = [
        order.codigo_pedido || order.id,
        formatDataHora(order.created_at),
        order.cliente?.nome || '',
        order.cidade_nome_exibicao || '',
        (order.descricao || '').replace(/;/g, ','),
        order.status || '',
        lojistaAceito,
        valorTotal
      ].map(campo => `"${String(campo).replace(/"/g, '""')}"`).join(';');

      linhas.push(linha);
    });

    const csvContent = '\uFEFF' + linhas.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `pedidos_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleDetails = (id) => setShowDetails(prev => ({ ...prev, [id]: !prev[id] }));

  // Formata data/hora curta, ex: 30/08 14:35
  const formatDataHora = (dataStr) => {
    if (!dataStr) return 'Não informado';
    const d = new Date(dataStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
           d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  // Formata a diferença entre duas datas em texto tipo "2h 15min" ou "35min"
  const formatDuracao = (inicioStr, fimStr) => {
    if (!inicioStr || !fimStr) return null;
    const diffMs = new Date(fimStr) - new Date(inicioStr);
    if (isNaN(diffMs) || diffMs < 0) return null;
    const totalMin = Math.floor(diffMs / 60000);
    const horas = Math.floor(totalMin / 60);
    const minutos = totalMin % 60;
    if (horas > 0) return `${horas}h ${minutos}min`;
    return `${minutos}min`;
  };

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Painel do Administrador</h2>
            <p className="text-sm text-slate-500">Gerenciamento Geral da Plataforma</p>
          </div>
          <button onClick={handleLogout} className="bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-300 transition">
            Sair
          </button>
        </div>

        {/* Seleção de Abas */}
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
          <button
            onClick={() => setActiveTab('lojistas')}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition ${activeTab === 'lojistas' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Gestão de Lojistas & Categorias
          </button>
          <button
            onClick={() => setActiveTab('pedidos')}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition ${activeTab === 'pedidos' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Monitoramento de Pedidos & Propostas
          </button>
        </div>

        {/* ABA 1: GESTÃO DE LOJISTAS */}
        {activeTab === 'lojistas' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-3">
                <label className="text-sm font-bold text-slate-700">Filtrar por Cidade:</label>
                <select
                  value={selectedCityFilter}
                  onChange={(e) => setSelectedCityFilter(e.target.value)}
                  className="p-2 rounded-xl border border-slate-300 text-slate-800 bg-slate-50 text-sm font-medium"
                >
                  <option value="">Todas as Cidades ({lojistas.length})</option>
                  {cities.map((city) => (
                    <option key={city.id || city.nome} value={city.nome}>{city.nome}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setIsCategoryModalOpen(true)} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-semibold">Gerenciar Categorias</button>
                <button onClick={() => { carregarSomAtual(); setIsSomModalOpen(true); }} className="bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-semibold">🔊 Som de Notificação</button>
                <button onClick={() => { carregarAvaliacoes('contestadas'); setIsAvaliacoesModalOpen(true); }} className="bg-rose-600 text-white px-4 py-2 rounded-xl text-xs font-semibold">⭐ Avaliações</button>
                <button onClick={() => setIsClientModalOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-semibold">+ Cadastrar Cliente</button>
                <button onClick={() => setIsRepModalOpen(true)} className="bg-purple-600 text-white px-4 py-2 rounded-xl text-xs font-semibold">+ Cadastrar Representante</button>
                <button onClick={() => setIsModalOpen(true)} className="bg-teal-600 text-white px-4 py-2 rounded-xl text-xs font-semibold">+ Cadastrar Lojista</button>
              </div>
            </div>

            {loading ? <p className="text-center py-8 text-slate-500">Carregando...</p> : (
              <div className="space-y-4">
                {lojistas.filter(l => !selectedCityFilter || l.cidade?.toLowerCase() === selectedCityFilter.toLowerCase()).map((lojista) => (
                  <div key={lojista.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex gap-3">
                      {lojista.logo_url ? (
                        <img src={lojista.logo_url} alt={lojista.nome} className="w-14 h-14 rounded-xl object-cover border border-slate-200 flex-shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-xl flex-shrink-0">🏬</div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg text-slate-800">{lojista.nome || 'Lojista'}</h3>
                          <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            ⭐ {lojista.reputacao_media != null ? Number(lojista.reputacao_media).toFixed(1) : '5.0'}
                            <span className="text-slate-400 font-normal"> ({lojista.total_avaliacoes || 0})</span>
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">Cidade: {lojista.cidade || 'Não informada'} | Tel: {lojista.telefone || 'Não informado'}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          <b>Horário:</b>{' '}
                          {lojista.horario_abertura && lojista.horario_fechamento
                            ? `${lojista.horario_abertura.slice(0, 5)} às ${lojista.horario_fechamento.slice(0, 5)}`
                            : 'Não definido'}
                          {' · '}
                          {lojista.dias_funcionamento && lojista.dias_funcionamento.length > 0
                            ? DIAS_SEMANA.filter(d => lojista.dias_funcionamento.includes(d.key)).map(d => d.label).join(', ')
                            : 'Dias não definidos'}
                        </p>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full inline-block mt-2 ${lojista.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {lojista.ativo ? 'Ativo (Liberado)' : 'Inadimplente (Bloqueado)'}
                        </span>
                      </div>
                    </div>

                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-500 mb-2">Categorias Atendidas:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {categories.map((cat) => (
                          <label key={cat.id} className="flex items-center space-x-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={lojista.categoriasSelecionadas.includes(cat.id)}
                              onChange={() => handleCategoryChange(lojista.id, cat.id)}
                              className="w-4 h-4 text-teal-600 rounded"
                            />
                            <span>{cat.nome}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <button onClick={() => {
                        setEditingLojistaId(lojista.id);
                        setEditNome(lojista.nome || '');
                        setEditCidade(lojista.cidade || '');
                        setEditTelefone(lojista.telefone || '');
                        setEditHorarioAbertura((lojista.horario_abertura || '08:00:00').slice(0, 5));
                        setEditHorarioFechamento((lojista.horario_fechamento || '18:00:00').slice(0, 5));
                        setEditDiasFuncionamento(lojista.dias_funcionamento || ['seg', 'ter', 'qua', 'qui', 'sex', 'sab']);
                        setLogoAtualUrl(lojista.logo_url || null);
                        setArquivoLogo(null);
                        setIsEditModalOpen(true);
                      }} className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
                        Editar Dados
                      </button>
                      <button onClick={() => handleToggleAtivo(lojista.id, lojista.ativo)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${lojista.ativo ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-600 text-white'}`}>
                        {lojista.ativo ? 'Bloquear Acesso' : 'Liberar Acesso'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA 2: MONITORAMENTO DE PEDIDOS */}
        {activeTab === 'pedidos' && (
          <div className="space-y-6">
            {/* Filtros */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cidade</label>
                <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-900 bg-slate-50 text-sm">
                  <option value="">Todas as Cidades</option>
                  {cities.map((c) => <option key={c.id || c.nome} value={c.id || c.nome}>{c.nome}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cliente</label>
                <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-900 bg-slate-50 text-sm">
                  <option value="">Todos os Clientes</option>
                  {clients.map((cli) => <option key={cli.id} value={cli.id}>{cli.nome || cli.email}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Lojista / Loja</label>
                <select value={selectedStore} onChange={(e) => setSelectedStore(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-900 bg-slate-50 text-sm">
                  <option value="">Todos os Lojistas</option>
                  {stores.map((st) => <option key={st.id} value={st.id}>{st.nome || st.email}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Buscar por Código / Nome</label>
                <input type="text" placeholder="Ex: #855-1..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-900 bg-slate-50 text-sm" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">De</label>
                <input type="date" value={dataFiltroDe} onChange={(e) => setDataFiltroDe(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-900 bg-slate-50 text-sm" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Até</label>
                <input type="date" value={dataFiltroAte} onChange={(e) => setDataFiltroAte(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-900 bg-slate-50 text-sm" />
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => { setSelectedCity(''); setSelectedClient(''); setSelectedStore(''); setSearchTerm(''); setDataFiltroDe(''); setDataFiltroAte(''); }}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-600 bg-white text-sm font-semibold hover:bg-slate-50"
                >
                  Limpar Filtros
                </button>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleExportarCSV}
                  className="w-full p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-1.5"
                >
                  ⬇ Exportar CSV
                </button>
              </div>
            </div>

            {/* Lista de Cotações */}
            <div className="bg-white shadow-xl rounded-2xl border border-slate-200 p-6 space-y-4">
              <h3 className="text-xl font-bold text-slate-800">Cotações Encontradas ({filteredOrders.length})</h3>

              {filteredOrders.map((order) => {
                const orderBids = bidsByOrder[String(order.id)] || [];
                const orderItems = orderItemsMap[order.id] || [];

                return (
                  <div key={order.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-3 border-b border-slate-200">
                      <div>
                        <span className="text-xs font-bold text-teal-800 bg-teal-100 border border-teal-200 px-2.5 py-1 rounded-lg">
                          Pedido #{order.codigo_pedido || order.id}
                        </span>
                        <h4 className="text-lg font-bold text-slate-800 mt-2">{order.descricao}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">Cliente: {order.cliente?.nome || 'Não informado'} | Tel: {order.cliente?.telefone || 'Não informado'} | Cidade: {order.cidade_nome_exibicao}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Pedido feito em: {formatDataHora(order.created_at)}</p>
                      </div>
                      <button onClick={() => toggleDetails(order.id)} className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200">
                        {showDetails[order.id] ? 'Ocultar Detalhes' : `Ver Detalhes (${orderBids.length} Propostas)`}
                      </button>
                    </div>

                    {showDetails[order.id] && (
                      <div className="space-y-4 pt-2">
                        {/* Itens do Cliente */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                          <p className="text-xs font-bold text-slate-500 uppercase">Itens da Cotação:</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {orderItems.map((item) => (
                              <div key={item.id} className="flex justify-between items-center p-2 rounded bg-slate-50 border text-xs">
                                <span><b>{item.descricao}</b> (Qtd: {item.quantidade})</span>
                                {item.imagem_url && <img src={item.imagem_url} alt="Cliente" onClick={() => setActiveImage(item.imagem_url)} className="w-8 h-8 object-cover rounded border cursor-pointer hover:opacity-80" />}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Propostas */}
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-slate-500 uppercase">Propostas Enviadas:</p>
                          {orderBids.length === 0 ? <p className="text-xs text-slate-500 italic">Nenhuma proposta enviada ainda.</p> : orderBids.map((bid) => {
                            const lojista = profilesMap.get(String(bid.lojista_id));
                            const bItems = bidItemsMap[bid.id] || [];
                            const total = (parseFloat(bid.preco || 0)) + (parseFloat(bid.frete || 0));

                            return (
                              <div key={bid.id} className={`p-4 rounded-xl border ${bid.status === 'Aceito' ? 'border-green-300 bg-green-50/50' : 'border-slate-200 bg-white'} space-y-2`}>
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p className="font-bold text-slate-800 text-sm">Loja: {lojista?.nome || `Lojista #${bid.lojista_id}`}</p>
                                    <p className="text-xs text-slate-500">Contato: {lojista?.telefone || 'Não informado'}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                      Proposta enviada em: {formatDataHora(bid.created_at)}
                                      {formatDuracao(order.created_at, bid.created_at) && (
                                        <span> · lojista respondeu em {formatDuracao(order.created_at, bid.created_at)}</span>
                                      )}
                                    </p>
                                    {bid.status === 'Aceito' && bid.accepted_at && (
                                      <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                                        Cliente aceitou em: {formatDataHora(bid.accepted_at)}
                                        {formatDuracao(bid.created_at, bid.accepted_at) && (
                                          <span> · levou {formatDuracao(bid.created_at, bid.accepted_at)} para aceitar</span>
                                        )}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <p className="text-base font-extrabold text-slate-900">Total: R$ {total.toFixed(2)}</p>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${bid.status === 'Aceito' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>{bid.status}</span>
                                  </div>
                                </div>

                                {bItems.length > 0 && (
                                  <div className="pt-2 border-t border-slate-100 space-y-1">
                                    {bItems.map((bItem) => {
                                      const origItem = orderItems.find(i => i.id === bItem.order_item_id);
                                      return (
                                        <div key={bItem.id} className="text-[11px] flex justify-between items-center bg-slate-50 p-2 rounded">
                                          <span><b>{origItem?.descricao || 'Item'}:</b> {bItem.atendido ? `R$ ${parseFloat(bItem.preco_unitario || 0).toFixed(2)}` : 'Indisponível'}</span>
                                          {bItem.imagem_url && <img src={bItem.imagem_url} alt="Lojista" onClick={() => setActiveImage(bItem.imagem_url)} className="w-6 h-6 object-cover rounded border cursor-pointer hover:opacity-80" />}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Modal Ampliação de Imagem */}
        {activeImage && (
          <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setActiveImage(null)}>
            <div className="relative max-w-3xl max-h-[90vh] bg-white rounded-2xl overflow-hidden p-2" onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => setActiveImage(null)} className="absolute top-3 right-3 bg-slate-800 text-white w-8 h-8 rounded-full font-bold">✕</button>
              <img src={activeImage} alt="Ampliada" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
            </div>
          </div>
        )}

        {/* Modal de Cadastro de Cliente */}
        {isClientModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <form onSubmit={handleCreateCliente} className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center pb-2 border-b">
                <h3 className="text-xl font-bold text-slate-800">Cadastrar Novo Cliente</h3>
                <button type="button" onClick={() => setIsClientModalOpen(false)} className="text-slate-400 font-bold">✕</button>
              </div>
              <input type="text" placeholder="Nome do Cliente" value={novoNomeCliente} onChange={(e) => setNovoNomeCliente(e.target.value)} className="w-full p-2.5 rounded-lg border text-sm" required />
              <input type="email" placeholder="E-mail" value={novoEmailCliente} onChange={(e) => setNovoEmailCliente(e.target.value)} className="w-full p-2.5 rounded-lg border text-sm" required />
              <input type="password" placeholder="Senha Inicial" value={novaSenhaCliente} onChange={(e) => setNovaSenhaCliente(e.target.value)} className="w-full p-2.5 rounded-lg border text-sm" required />
              <input type="text" placeholder="Cidade" value={novaCidadeCliente} onChange={(e) => setNovaCidadeCliente(e.target.value)} className="w-full p-2.5 rounded-lg border text-sm" />
              <input type="text" placeholder="Telefone / WhatsApp" value={novoTelefoneCliente} onChange={(e) => setNovoTelefoneCliente(e.target.value)} className="w-full p-2.5 rounded-lg border text-sm" />

              <div className="flex space-x-3 pt-3">
                <button type="button" onClick={() => setIsClientModalOpen(false)} className="w-1/2 bg-slate-200 text-slate-700 p-2 rounded-xl font-semibold text-sm">Cancelar</button>
                <button type="submit" className="w-1/2 bg-indigo-600 text-white p-2 rounded-xl font-semibold text-sm">Salvar</button>
              </div>
            </form>
          </div>
        )}

        {/* Modal de Som de Notificação do Lojista */}
        {isSomModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <form onSubmit={handleUploadSom} className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b">
                <h3 className="text-xl font-bold text-slate-800">🔊 Som de Notificação do Lojista</h3>
                <button type="button" onClick={() => setIsSomModalOpen(false)} className="text-slate-400 font-bold">✕</button>
              </div>

              <p className="text-xs text-slate-500">
                Esse som toca automaticamente pra todos os lojistas quando chega um pedido novo relevante pra categoria deles. Envie um arquivo MP3 (recomendo 2 a 5 segundos, bem audível).
              </p>

              {somAtualUrl && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-slate-600">Som atual:</p>
                  <audio controls src={somAtualUrl} className="w-full h-10" />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">Novo arquivo (MP3)</label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setArquivoSom(e.target.files?.[0] || null)}
                  className="w-full text-sm p-2 rounded-lg border bg-slate-50"
                />
              </div>

              <div className="flex space-x-3 pt-3">
                <button type="button" onClick={() => setIsSomModalOpen(false)} className="w-1/2 bg-slate-200 text-slate-700 p-2 rounded-xl font-semibold text-sm">Cancelar</button>
                <button type="submit" disabled={enviandoSom} className="w-1/2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white p-2 rounded-xl font-semibold text-sm">
                  {enviandoSom ? 'Enviando...' : 'Salvar Som'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Modal de Avaliações (contestações e correções) */}
        {isAvaliacoesModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center pb-2 border-b">
                <h3 className="text-xl font-bold text-slate-800">⭐ Avaliações</h3>
                <button type="button" onClick={() => setIsAvaliacoesModalOpen(false)} className="text-slate-400 font-bold">✕</button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => carregarAvaliacoes('contestadas')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${filtroAvaliacoes === 'contestadas' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-300'}`}
                >
                  Contestadas
                </button>
                <button
                  onClick={() => carregarAvaliacoes('todas')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${filtroAvaliacoes === 'todas' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-300'}`}
                >
                  Todas
                </button>
                <button
                  onClick={() => carregarPenalidades()}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${filtroAvaliacoes === 'penalidades' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-300'}`}
                >
                  Penalidades Automáticas
                </button>
              </div>

              {filtroAvaliacoes === 'penalidades' ? (
                penalidadesAutomaticas.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">Nenhuma penalidade automática registrada.</p>
                ) : (
                  <div className="space-y-2">
                    {penalidadesAutomaticas.map((p) => (
                      <div key={p.id} className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-800">{p.nomeUsuario} <span className="text-xs font-normal text-slate-500">({p.tipo})</span></p>
                          <p className="text-xs text-slate-500">Pedido #{p.codigoPedido} · {new Date(p.criado_em).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <button onClick={() => handleReverterPenalidade(p.id)} className="text-xs font-bold text-emerald-600 whitespace-nowrap">
                          Reverter
                        </button>
                      </div>
                    ))}
                  </div>
                )
              ) : avaliacoes.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">Nenhuma avaliação encontrada com esse filtro.</p>
              ) : (
                <div className="space-y-2">
                  {avaliacoes.map((av) => (
                    <div key={av.id} className={`p-3 rounded-xl border space-y-2 ${av.desconsiderada ? 'border-slate-200 bg-slate-50 opacity-60' : av.contestada ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white'}`}>
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="text-xs text-slate-500"><b>Lojista avaliado:</b> {av.nomeAvaliado}</p>
                          <p className="text-xs text-slate-500"><b>Cliente:</b> {av.nomeAvaliador}</p>
                          {avaliacaoEditando === av.id ? (
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="number"
                                min="1"
                                max="5"
                                value={notaEditada}
                                onChange={(e) => setNotaEditada(e.target.value)}
                                className="w-16 p-1.5 rounded-lg border text-sm"
                              />
                              <button onClick={() => handleSalvarNotaEditada(av.id)} className="text-xs font-bold text-emerald-600">Salvar</button>
                              <button onClick={() => setAvaliacaoEditando(null)} className="text-xs font-bold text-slate-500">Cancelar</button>
                            </div>
                          ) : (
                            <p className="text-sm font-bold text-amber-600 mt-1">{'⭐'.repeat(av.nota)}{'☆'.repeat(5 - av.nota)}</p>
                          )}
                          {av.comentario && <p className="text-xs text-slate-600 mt-1">{av.comentario}</p>}
                          <p className="text-[11px] text-slate-400 mt-1">{new Date(av.criado_em).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          {av.contestada && !av.desconsiderada && (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">Contestada</span>
                          )}
                          {av.desconsiderada && (
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full">Desconsiderada</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-3 pt-1 border-t border-slate-100">
                        {avaliacaoEditando !== av.id && (
                          <button onClick={() => { setAvaliacaoEditando(av.id); setNotaEditada(String(av.nota)); }} className="text-xs font-bold text-indigo-600">
                            Corrigir nota
                          </button>
                        )}
                        <button
                          onClick={() => handleDesconsiderarAvaliacao(av.id, !av.desconsiderada)}
                          className="text-xs font-bold text-slate-600"
                        >
                          {av.desconsiderada ? 'Reconsiderar' : 'Desconsiderar'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal de Cadastro de Representante Comercial */}
        {isRepModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <form onSubmit={handleCreateRepresentante} className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center pb-2 border-b">
                <h3 className="text-xl font-bold text-slate-800">Cadastrar Novo Representante</h3>
                <button type="button" onClick={() => setIsRepModalOpen(false)} className="text-slate-400 font-bold">✕</button>
              </div>
              <input type="text" placeholder="Nome do Representante" value={novoNomeRep} onChange={(e) => setNovoNomeRep(e.target.value)} className="w-full p-2.5 rounded-lg border text-sm" required />
              <input type="text" placeholder="Usuário (ex: joao.comercial)" value={novoEmailRep} onChange={(e) => setNovoEmailRep(e.target.value)} className="w-full p-2.5 rounded-lg border text-sm" required />
              <input type="password" placeholder="Senha Inicial" value={novaSenhaRep} onChange={(e) => setNovaSenhaRep(e.target.value)} className="w-full p-2.5 rounded-lg border text-sm" required />

              <div className="flex space-x-3 pt-3">
                <button type="button" onClick={() => setIsRepModalOpen(false)} className="w-1/2 bg-slate-200 text-slate-700 p-2 rounded-xl font-semibold text-sm">Cancelar</button>
                <button type="submit" className="w-1/2 bg-purple-600 text-white p-2 rounded-xl font-semibold text-sm">Salvar</button>
              </div>
            </form>
          </div>
        )}

        {/* Modal de Cadastro de Lojista */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <form onSubmit={handleCreateLojista} className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-slate-800">Cadastrar Novo Lojista</h3>
              <input type="text" placeholder="Nome da Loja" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} className="w-full p-2.5 rounded-lg border text-sm" required />
              <input type="email" placeholder="E-mail" value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)} className="w-full p-2.5 rounded-lg border text-sm" required />
              <input type="password" placeholder="Senha Inicial" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} className="w-full p-2.5 rounded-lg border text-sm" required />
              <input type="text" placeholder="Cidade" value={novaCidade} onChange={(e) => setNovaCidade(e.target.value)} className="w-full p-2.5 rounded-lg border text-sm" required />
              <input type="text" placeholder="Telefone / WhatsApp" value={novoTelefone} onChange={(e) => setNovoTelefone(e.target.value)} className="w-full p-2.5 rounded-lg border text-sm" />

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">Horário de Funcionamento</label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="time"
                    value={novoHorarioAbertura}
                    onChange={(e) => setNovoHorarioAbertura(e.target.value)}
                    className="flex-1 p-2 rounded-lg border text-sm"
                  />
                  <span className="text-xs text-slate-400">até</span>
                  <input
                    type="time"
                    value={novoHorarioFechamento}
                    onChange={(e) => setNovoHorarioFechamento(e.target.value)}
                    className="flex-1 p-2 rounded-lg border text-sm"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DIAS_SEMANA.map((dia) => (
                    <button
                      key={dia.key}
                      type="button"
                      onClick={() => toggleDia(novosDiasFuncionamento, setNovosDiasFuncionamento, dia.key)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                        novosDiasFuncionamento.includes(dia.key)
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-slate-50 text-slate-500 border-slate-300'
                      }`}
                    >
                      {dia.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">Categorias Atendidas</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border">
                  {categories.map((cat) => (
                    <label key={cat.id} className="flex items-center space-x-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={novasCategoriasIds.includes(cat.id)}
                        onChange={() => {
                          if (novasCategoriasIds.includes(cat.id)) setNovasCategoriasIds(novasCategoriasIds.filter(id => id !== cat.id));
                          else setNovasCategoriasIds([...novasCategoriasIds, cat.id]);
                        }}
                        className="w-4 h-4 text-teal-600 rounded"
                      />
                      <span>{cat.nome}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3 pt-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="w-1/2 bg-slate-200 text-slate-700 p-2 rounded-xl font-semibold text-sm">Cancelar</button>
                <button type="submit" className="w-1/2 bg-teal-600 text-white p-2 rounded-xl font-semibold text-sm">Salvar</button>
              </div>
            </form>
          </div>
        )}

        {/* Modal de Edição de Lojista */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <form onSubmit={handleSaveEditLojista} className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center pb-2 border-b">
                <h3 className="text-xl font-bold text-slate-800">Editar Dados do Lojista</h3>
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="text-slate-400 font-bold">✕</button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nome da Loja</label>
                <input type="text" placeholder="Nome da Loja" value={editNome} onChange={(e) => setEditNome(e.target.value)} className="w-full p-2.5 rounded-xl border text-sm" required />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Logo da Loja</label>
                <div className="flex items-center gap-3">
                  {logoAtualUrl && (
                    <img src={logoAtualUrl} alt="Logo atual" className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setArquivoLogo(e.target.files?.[0] || null)}
                    className="flex-1 text-xs p-2 rounded-lg border bg-slate-50"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Só aparece pro cliente depois que ele confirma a proposta desse lojista.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cidade</label>
                <input type="text" placeholder="Cidade (Ex: Campos dos Goytacazes)" value={editCidade} onChange={(e) => setEditCidade(e.target.value)} className="w-full p-2.5 rounded-xl border text-sm" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Telefone / WhatsApp</label>
                <input type="text" placeholder="Telefone" value={editTelefone} onChange={(e) => setEditTelefone(e.target.value)} className="w-full p-2.5 rounded-xl border text-sm" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Horário de Funcionamento</label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="time"
                    value={editHorarioAbertura}
                    onChange={(e) => setEditHorarioAbertura(e.target.value)}
                    className="flex-1 p-2 rounded-lg border text-sm"
                  />
                  <span className="text-xs text-slate-400">até</span>
                  <input
                    type="time"
                    value={editHorarioFechamento}
                    onChange={(e) => setEditHorarioFechamento(e.target.value)}
                    className="flex-1 p-2 rounded-lg border text-sm"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DIAS_SEMANA.map((dia) => (
                    <button
                      key={dia.key}
                      type="button"
                      onClick={() => toggleDia(editDiasFuncionamento, setEditDiasFuncionamento, dia.key)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                        editDiasFuncionamento.includes(dia.key)
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-slate-50 text-slate-500 border-slate-300'
                      }`}
                    >
                      {dia.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3 pt-3 border-t">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="w-1/2 bg-slate-200 text-slate-700 p-2.5 rounded-xl font-semibold text-sm">Cancelar</button>
                <button type="submit" className="w-1/2 bg-teal-600 hover:bg-teal-700 text-white p-2.5 rounded-xl font-semibold text-sm">Atualizar</button>
              </div>
            </form>
          </div>
        )}

        {/* Modal de Gestão de Categorias */}
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center pb-2 border-b">
                <h3 className="text-xl font-bold text-slate-800">Gerenciar Categorias</h3>
                <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 font-bold">✕</button>
              </div>

              <form onSubmit={handleCreateCategory} className="flex gap-2">
                <input type="text" placeholder="Nova categoria..." value={novaCategoriaNome} onChange={(e) => setNovaCategoriaNome(e.target.value)} className="flex-1 p-2 rounded-lg border text-sm" required />
                <button type="submit" className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">Adicionar</button>
              </form>

              <div className="divide-y max-h-60 overflow-y-auto">
                {categories.map((cat) => (
                  <div key={cat.id} className="py-2 flex justify-between items-center text-sm">
                    {editingCatId === cat.id ? (
                      <div className="flex gap-2 flex-1">
                        <input type="text" value={editingCatNome} onChange={(e) => setEditingCatNome(e.target.value)} className="flex-1 p-1 rounded border text-sm" />
                        <button type="button" onClick={() => handleSaveEditCategory(cat.id)} className="bg-green-600 text-white px-2 py-1 rounded text-xs">Salvar</button>
                      </div>
                    ) : (
                      <>
                        <span className="font-medium text-slate-800">{cat.nome}</span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => { setEditingCatId(cat.id); setEditingCatNome(cat.nome); }} className="text-xs text-teal-600 font-bold">Editar</button>
                          <button type="button" onClick={() => handleDeleteCategory(cat.id)} className="text-xs text-rose-600 font-bold">Excluir</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t flex justify-end">
                <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold">Fechar</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
