import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';
import { uploadImageToStorage } from '../utils/uploadImage';
import logo from '../assets/logo.svg';
import { getStatusPrazo, aplicarPenalidadeSeNecessario } from '../utils/prazoUtils';

/* ===================== Identidade visual do Nuno =====================
   Cores da marca: azul-marinho #00068F, roxo #5E17EB, lilás #935DFF.
   Texto #0E1033, texto secundário #5B5E7A, bordas #E4E2EF, fundo #F5F4FA.
   Verde (#0E7A4E) só pra economia/confirmado; âmbar (#8A5A00) pra prazo correndo. */

const FONTE_TITULO = { fontFamily: "'Bricolage Grotesque', 'Manrope', system-ui, sans-serif" };
const FONTE_TEXTO = { fontFamily: "'Manrope', system-ui, sans-serif" };

// Carrega as fontes da marca uma única vez (se preferir, mova esse <link> pro index.html)
function carregarFontesNuno() {
  if (typeof document === 'undefined' || document.getElementById('fontes-nuno')) return;
  const link = document.createElement('link');
  link.id = 'fontes-nuno';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Manrope:wght@400;500;600;700;800&display=swap';
  document.head.appendChild(link);
}

// Ícones de traço (mesmo estilo do caminhão / loja / cartão). Nada de emoji.
const ICONES = {
  caminhao: (<><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /><path d="M15 18H9" /><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" /><circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" /></>),
  loja: (<><path d="M3 21h18" /><path d="M5 21V8l7-5 7 5v13" /></>),
  cartao: (<><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>),
  relogio: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  pausa: (<><circle cx="12" cy="12" r="9" /><path d="M10 9v6" /><path d="M14 9v6" /></>),
  check: (<><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>),
  estrela: (<path d="m12 2.5 2.95 5.98 6.6.96-4.78 4.65 1.13 6.57L12 17.56 6.1 20.66l1.13-6.57-4.78-4.65 6.6-.96z" />),
  cadeado: (<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>),
  camera: (<><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" /><circle cx="12" cy="13" r="3" /></>),
  esquerda: (<path d="m15 18-6-6 6-6" />),
  direita: (<path d="m9 18 6-6-6-6" />),
  baixo: (<path d="m6 9 6 6 6-6" />),
  fechar: (<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>),
  busca: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>),
  calendario: (<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></>),
  ordenar: (<><path d="m21 16-4 4-4-4" /><path d="M17 20V4" /><path d="m3 8 4-4 4 4" /><path d="M7 4v16" /></>),
  presente: (<><path d="M20 12v8H4v-8" /><path d="M2 7h20v5H2z" /><path d="M12 22V7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></>),
  carteira: (<><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" /></>),
  mensagem: (<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.5A8.4 8.4 0 1 1 21 11.5z" />),
  sino: (<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>),
  alerta: (<><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>),
  mais: (<><path d="M12 5v14" /><path d="M5 12h14" /></>),
  sair: (<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>),
  usuario: (<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
  caixa: (<><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" /><path d="M12 22V12" /><path d="m3.3 7 8.7 5 8.7-5" /></>),
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>),
  trofeu: (<><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></>),
  marcado: (<path d="m5 12 5 5 9-10" />),
  menos: (<path d="M5 12h14" />),
  enviar: (<><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></>),
  telefone: (<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />),
};

function Icone({ nome, tamanho = 18, strokeWidth = 2, preenchido = false, className = '' }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill={preenchido ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {ICONES[nome]}
    </svg>
  );
}

// As duas folhas do logo, usadas como decoração no bloco de boas-vindas
function FolhasNuno({ className = '' }) {
  return (
    <svg viewBox="0 0 1000 1000" aria-hidden="true" className={className}>
      <g transform="matrix(0.833259,0,0,0.833259,-1060.976303,-327.355748)">
        <g transform="matrix(2.839638,0,0,2.707675,1036.059892,625.783551)">
          <path d="M85.311,351.156C82.833,349.869 84.021,349.314 84.166,346.506C86.886,293.652 76.346,170.842 94.466,115.49C131.732,1.652 205.442,7.748 218.499,7.763C254.939,7.803 323.161,7.69 323.358,7.803C325.764,9.181 98.703,329.951 85.311,351.156Z" fill="#935DFF" />
        </g>
        <g transform="matrix(-3.481229,0.000274,-0.000267,-3.398808,2764.277892,1602.719262)">
          <path d="M85.311,351.156C82.833,349.869 84.021,349.314 84.166,346.506C86.886,293.652 76.346,170.842 94.466,115.49C131.732,1.652 205.442,7.748 218.499,7.763C254.939,7.803 323.161,7.69 323.358,7.803C325.764,9.181 98.703,329.951 85.311,351.156Z" fill="#5E17EB" />
        </g>
      </g>
    </svg>
  );
}

export default function LojistaDashboard() {
  const [orders, setOrders] = useState([]);
  const [acceptedBids, setAcceptedBids] = useState([]);
  const [pendingBids, setPendingBids] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [bidItemsData, setBidItemsData] = useState([]);
  // Opções extras de preço pro item único (faixa de preço, Pro/Premium) —
  // cada uma vira outra linha em bid_items, ligada ao mesmo item do pedido.
  const [opcoesExtras, setOpcoesExtras] = useState([]);
  const [uploadingOpcaoIndex, setUploadingOpcaoIndex] = useState(null);
  const [frete, setFrete] = useState('');
  const [observacao, setObservacao] = useState('');
  const [prazoEntrega, setPrazoEntrega] = useState('');
  const [garantia, setGarantia] = useState('');
  const [retiradaDisponivel, setRetiradaDisponivel] = useState(false);
  const [parcelasSemJuros, setParcelasSemJuros] = useState('');
  const [formasPagamento, setFormasPagamento] = useState([]);
  const [ofereceCashback, setOfereceCashback] = useState(false);
  const [valorCashbackOferecido, setValorCashbackOferecido] = useState('');
  const [aceitaCashback, setAceitaCashback] = useState(false);

  const OPCOES_PRAZO_ENTREGA = [
    { value: 'em_2h', label: 'Em até 2 horas', peso: 2 },
    { value: 'hoje', label: 'Ainda hoje', peso: 12 },
    { value: 'amanha', label: 'Amanhã', peso: 24 },
    { value: '2_3_dias', label: '2 a 3 dias', peso: 72 },
  ];

  const OPCOES_PAGAMENTO = [
    { value: 'cartao', label: 'Cartão' },
    { value: 'a_vista', label: 'À vista' },
    { value: 'faturado', label: 'Faturado (você aprova o cadastro do cliente)' },
  ];

  const toggleFormaPagamento = (value) => {
    setFormasPagamento(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };
  const [loading, setLoading] = useState(true);

  // Filtros e Busca
  const [statusFilter, setStatusFilter] = useState('todas'); // 'todas', 'urgentes', 'confirmadas'
  const [searchTerm, setSearchTerm] = useState('');

  // Filtro por data e ordenação (padrão: mais recentes primeiro)
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' = mais recentes primeiro, 'asc' = mais antigos primeiro

  // Modais e Imagens
  const [activeImage, setActiveImage] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [cashbackAtivo, setCashbackAtivo] = useState(false);
  const [limiteDiarioBasico, setLimiteDiarioBasico] = useState(5);
  const [minhasAvaliacoes, setMinhasAvaliacoes] = useState([]);
  const [collapsedAvaliacoes, setCollapsedAvaliacoes] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [uploadingImageIndex, setUploadingImageIndex] = useState(null);

  const [now, setNow] = useState(Date.now());
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const [novosPedidosCount, setNovosPedidosCount] = useState(0);
  const [novaVendaConfirmadaCount, setNovaVendaConfirmadaCount] = useState(0);
  const [showVendaConfirmadaBanner, setShowVendaConfirmadaBanner] = useState(false);

  // Encolher/expandir seções e cards individuais
  const [collapsedSections, setCollapsedSections] = useState({ abertas: false, fechadas: false, enviadas: false });
  const [collapsedCards, setCollapsedCards] = useState(new Set());
  const [abaSelecionadaLojista, setAbaSelecionadaLojista] = useState('aberto');
  const [detalheBidAberto, setDetalheBidAberto] = useState(null);

  // Detalhes expandidos por card (itens, fotos, bairro, status da concorrência)
  const [expandedDetails, setExpandedDetails] = useState(new Set());
  const [pedidoItemsMap, setPedidoItemsMap] = useState({});
  const [minhaPropostaItemsMap, setMinhaPropostaItemsMap] = useState({});
  const [ordersFechadosComOutro, setOrdersFechadosComOutro] = useState(new Set());
  const [lojistasElegiveisPorPedido, setLojistasElegiveisPorPedido] = useState({});
  const [reputacaoClientesPorPedido, setReputacaoClientesPorPedido] = useState({});
  const [contagemPropostasPorPedido, setContagemPropostasPorPedido] = useState({});
  const [rankingAbertoBidId, setRankingAbertoBidId] = useState(null);
  const [rankingConcorrentes, setRankingConcorrentes] = useState([]);
  const [carregandoRanking, setCarregandoRanking] = useState(false);

  // Paginação (10 pedidos por página em cada seção)
  const ITENS_POR_PAGINA = 10;
  const [paginaAbertas, setPaginaAbertas] = useState(1);
  const [paginaFechadas, setPaginaFechadas] = useState(1);
  const [paginaEnviadas, setPaginaEnviadas] = useState(1);
  const [paginaEncerradas, setPaginaEncerradas] = useState(1);

  const toggleExpandedDetails = (cardKey) => {
    setExpandedDetails(prev => {
      const next = new Set(prev);
      if (next.has(cardKey)) next.delete(cardKey);
      else next.add(cardKey);
      return next;
    });
  };

  const toggleSection = (key) => {
    setCollapsedSections(prev => {
      const vaiExpandir = prev[key]; // estava colapsado, vai abrir agora
      if (key === 'fechadas' && vaiExpandir) {
        setNovaVendaConfirmadaCount(0);
        setShowVendaConfirmadaBanner(false);
      }
      return { ...prev, [key]: !prev[key] };
    });
  };

  const toggleCard = (cardKey) => {
    setCollapsedCards(prev => {
      const next = new Set(prev);
      if (next.has(cardKey)) next.delete(cardKey);
      else next.add(cardKey);
      return next;
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  // Guarda a lista de categorias do lojista sempre atualizada, pra
  // conferir a relevância de um pedido novo assim que ele chega via realtime.
  const categoryIdsRef = useRef([]);
  const openOrderIdsRef = useRef([]);

  // Contexto de áudio único e persistente. Navegadores só deixam tocar som
  // depois de alguma interação do usuário na página, então "destravamos"
  // ele no primeiro clique/tecla e reaproveitamos sempre o mesmo contexto.
  const audioCtxRef = useRef(null);

  // Elemento de áudio reaproveitado pra tocar o som (MP3) que o admin subiu.
  const notifAudioRef = useRef(null);

  useEffect(() => {
    const destravarAudio = () => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }

      // "Destrava" também o elemento de áudio pro navegador aceitar tocar
      // depois, sem precisar de outro clique.
      if (!notifAudioRef.current) {
        notifAudioRef.current = new Audio();
      }
      notifAudioRef.current.muted = true;
      notifAudioRef.current.play().then(() => {
        notifAudioRef.current.pause();
        notifAudioRef.current.currentTime = 0;
        notifAudioRef.current.muted = false;
      }).catch(() => {});
    };
    window.addEventListener('click', destravarAudio);
    window.addEventListener('keydown', destravarAudio);
    return () => {
      window.removeEventListener('click', destravarAudio);
      window.removeEventListener('keydown', destravarAudio);
    };
  }, []);

  const playBeep = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // 5 bipes espaçados ao longo de ~3 segundos, bem mais audível que um tom único.
      const qtdBipes = 5;
      const duracaoBipe = 0.35;
      const intervaloEntreBipes = 0.7;

      for (let i = 0; i < qtdBipes; i++) {
        const inicio = ctx.currentTime + i * intervaloEntreBipes;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(988, inicio);
        gain.gain.setValueAtTime(0.001, inicio);
        gain.gain.exponentialRampToValueAtTime(0.6, inicio + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.00001, inicio + duracaoBipe);
        osc.start(inicio);
        osc.stop(inicio + duracaoBipe);
      }
    } catch (e) {
      console.error('Erro áudio:', e);
    }
  };

  // Toca o som personalizado que o admin subiu (bucket 'audio'). Se não
  // existir ainda ou falhar por qualquer motivo, cai pro bipe sintetizado.
  const playNotificationSound = () => {
    try {
      const { data } = supabase.storage.from('audio').getPublicUrl('notificacao-lojista');
      const url = data?.publicUrl;
      if (!url) {
        playBeep();
        return;
      }

      if (!notifAudioRef.current) {
        notifAudioRef.current = new Audio();
      }
      const audio = notifAudioRef.current;
      audio.muted = false;
      audio.src = `${url}?t=${Date.now()}`;
      audio.play().catch(() => playBeep());
    } catch (e) {
      playBeep();
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sempre que um filtro mudar, volta todas as seções pra página 1
  useEffect(() => {
    setPaginaAbertas(1);
    setPaginaFechadas(1);
    setPaginaEnviadas(1);
    setPaginaEncerradas(1);
  }, [statusFilter, searchTerm, dateFrom, dateTo, sortOrder]);

  // Penalidade automática: pedido era elegível pra este lojista e expirou
  // sem que ele enviasse proposta nenhuma — perde 0,5 na reputação (uma única vez).
  useEffect(() => {
    if (!profile?.id || orders.length === 0) return;

    orders.forEach((order) => {
      const status = getStatusPrazo(order, lojistasElegiveisPorPedido[order.id] || [], new Date());
      if (status.expirado) {
        aplicarPenalidadeSeNecessario(supabase, order.id, 'lojista', profile.id);
      }
    });
  }, [orders, lojistasElegiveisPorPedido, profile]);

  // Mantém a lista de IDs dos pedidos abertos sempre atualizada, pra
  // conferir a relevância de uma proposta nova de concorrente assim que ela chega.
  useEffect(() => {
    openOrderIdsRef.current = orders.map(o => o.id);
  }, [orders]);

  // Contador de rivalidade: atualiza em tempo real quantos lojistas já
  // responderam a um pedido aberto, visível pra todo mundo (não só Premium).
  useEffect(() => {
    const channel = supabase
      .channel('realtime-bids-contagem')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids' }, (payload) => {
        const oid = Number(payload?.new?.order_id || payload?.new?.pedido_id);
        if (!openOrderIdsRef.current.includes(oid)) return;

        setContagemPropostasPorPedido(prev => ({ ...prev, [oid]: (prev[oid] || 0) + 1 }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    fetchLojistaData();

    const channel = supabase
      .channel('realtime-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const categoriaDoNovoPedido = payload?.new?.categoria_id;
        const relevantePraEsteLojista = categoryIdsRef.current.includes(categoriaDoNovoPedido);
        if (!relevantePraEsteLojista) return;

        playNotificationSound();
        setNewOrderAlert(true);
        setNovosPedidosCount(prev => prev + 1);
        fetchLojistaData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Avisa o lojista, com banner fixo, quando um cliente confirma uma
  // proposta dele (transição de status pra 'Aceito').
  useEffect(() => {
    let channel;

    async function setupVendaConfirmadaChannel() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel('realtime-bids-lojista')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'bids', filter: `lojista_id=eq.${user.id}` },
          (payload) => {
            if (payload?.new?.status === 'Aceito') {
              playNotificationSound();
              setNovaVendaConfirmadaCount(prev => prev + 1);
              setShowVendaConfirmadaBanner(true);
              fetchLojistaData();
            }
          }
        )
        .subscribe();
    }

    setupVendaConfirmadaChannel();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  async function fetchLojistaData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserEmail(user.email || '');

      const { data: cashbackConfig } = await supabase.from('configuracoes_cashback').select('ativo').eq('id', 1).single();
      setCashbackAtivo(cashbackConfig?.ativo || false);

      const { data: planosConfig } = await supabase.from('configuracoes_planos').select('limite_diario_basico').eq('id', 1).single();
      if (planosConfig?.limite_diario_basico != null) setLimiteDiarioBasico(planosConfig.limite_diario_basico);

      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (profileData) setProfile(profileData);

      const { data: avaliacoesData } = await supabase
        .from('avaliacoes')
        .select('*')
        .eq('avaliado_id', user.id)
        .order('criado_em', { ascending: false });
      setMinhasAvaliacoes(avaliacoesData || []);

      const { data: allowedCategories } = await supabase.from('lojista_categorias').select('categoria_id').eq('lojista_id', user.id);
      const categoryIds = allowedCategories?.map(c => c.categoria_id) || [];
      categoryIdsRef.current = categoryIds;

      // Busca TODAS as propostas já enviadas por este lojista (qualquer status),
      // para não deixar orçar de novo um pedido já orçado.
      const { data: myBids } = await supabase.from('bids').select('*').eq('lojista_id', user.id);
      const bidOrderIds = new Set(
        (myBids || [])
          .map(b => Number(b.order_id || b.pedido_id))
          .filter(id => !isNaN(id))
      );

      if (categoryIds.length > 0) {
        const { data: catsData } = await supabase.from('categories').select('*');
        const { data: citiesData } = await supabase.from('cities').select('*');

        const catsMap = new Map((catsData || []).map(c => [String(c.id), c.nome]));
        const citiesMap = new Map((citiesData || []).map(c => [String(c.id), c.nome]));

        const { data: ordersData } = await supabase
          .from('orders')
          .select('*')
          .in('categoria_id', categoryIds)
          .gte('created_at', profileData?.created_at || '1970-01-01')
          .order('created_at', { ascending: false });

        if (ordersData) {
          const formatted = ordersData
            .filter(o => !bidOrderIds.has(Number(o.id))) // esconde pedidos que já receberam proposta deste lojista
            .map(o => ({
              ...o,
              categoria_nome_exibicao: catsMap.get(String(o.categoria_id)) || 'Geral',
              cidade_nome_exibicao: citiesMap.get(String(o.cidade_id)) || 'Não informada'
            }));
          setOrders(formatted);

          // Reputação do cliente de cada pedido aberto, pro lojista decidir
          // se vale a pena orçar (cliente com histórico de sumir, por ex.)
          const clienteIds = Array.from(new Set(formatted.map(o => o.cliente_id).filter(Boolean)));
          if (clienteIds.length > 0) {
            const { data: clientesData } = await supabase
              .from('profiles')
              .select('id, reputacao_media, total_avaliacoes')
              .in('id', clienteIds);
            const mapaReputacao = {};
            (clientesData || []).forEach(c => {
              mapaReputacao[c.id] = c;
            });
            const reputacaoPorPedido = {};
            formatted.forEach(o => {
              reputacaoPorPedido[o.id] = mapaReputacao[o.cliente_id] || null;
            });
            setReputacaoClientesPorPedido(reputacaoPorPedido);
          }

          // Contagem de propostas já enviadas por concorrentes em cada
          // pedido aberto — pra mostrar "X lojistas já responderam".
          const idsAbertos = formatted.map(o => o.id);
          if (idsAbertos.length > 0) {
            const { data: propostasConcorrentes } = await supabase
              .from('bids')
              .select('order_id, pedido_id')
              .or(`order_id.in.(${idsAbertos.join(',')}),pedido_id.in.(${idsAbertos.join(',')})`);

            const contagem = {};
            (propostasConcorrentes || []).forEach(b => {
              const oid = Number(b.order_id || b.pedido_id);
              contagem[oid] = (contagem[oid] || 0) + 1;
            });
            setContagemPropostasPorPedido(contagem);
          }

          // Lojistas elegíveis (mesma categoria + cidade) de cada pedido,
          // pra saber se o prazo está correndo ou pausado (horário comercial).
          const categoriaIdsPresentes = Array.from(new Set(formatted.map(o => o.categoria_id).filter(Boolean)));
          if (categoriaIdsPresentes.length > 0) {
            const { data: vinculosCat } = await supabase
              .from('lojista_categorias')
              .select('lojista_id, categoria_id')
              .in('categoria_id', categoriaIdsPresentes);

            const lojistaIdsCandidatos = Array.from(new Set((vinculosCat || []).map(v => v.lojista_id).filter(Boolean)));
            let lojistasCandidatos = [];
            if (lojistaIdsCandidatos.length > 0) {
              const { data: lojistasHorarioData } = await supabase
                .from('profiles')
                .select('id, cidade, ativo, horario_abertura, horario_fechamento, dias_funcionamento')
                .in('id', lojistaIdsCandidatos);
              lojistasCandidatos = lojistasHorarioData || [];
            }

            const vinculosPorCategoria = {};
            (vinculosCat || []).forEach(v => {
              if (!vinculosPorCategoria[v.categoria_id]) vinculosPorCategoria[v.categoria_id] = new Set();
              vinculosPorCategoria[v.categoria_id].add(v.lojista_id);
            });

            const mapaElegiveis = {};
            formatted.forEach(o => {
              const idsDaCategoria = vinculosPorCategoria[o.categoria_id] || new Set();
              const cidadePedido = (o.cidade_nome_exibicao || '').trim().toLowerCase();
              mapaElegiveis[o.id] = lojistasCandidatos.filter(l => {
                if (!idsDaCategoria.has(l.id)) return false;
                if (l.ativo === false) return false;
                if (!cidadePedido || cidadePedido === 'não informada') return true;
                const cidadeLojista = (l.cidade || '').trim().toLowerCase();
                return cidadeLojista.includes(cidadePedido) || cidadePedido.includes(cidadeLojista);
              });
            });
            setLojistasElegiveisPorPedido(mapaElegiveis);
          }
        }
      }

      if (myBids && myBids.length > 0) {
        const numericOrderIds = Array.from(bidOrderIds);

        let ordersDosBids = [];
        if (numericOrderIds.length > 0) {
          const { data: oData } = await supabase.from('orders').select('*').in('id', numericOrderIds);
          if (oData) ordersDosBids = oData;
        }

        const clientIds = ordersDosBids.map(o => o.cliente_id).filter(Boolean);
        let clientProfiles = [];
        if (clientIds.length > 0) {
          const { data: pData } = await supabase.from('profiles').select('id, nome, telefone').in('id', clientIds);
          if (pData) clientProfiles = pData;
        }

        const clientMap = new Map(clientProfiles.map(p => [String(p.id), p]));
        const orderMap = new Map(ordersDosBids.map(o => [String(o.id), { ...o, cliente: clientMap.get(String(o.cliente_id)) }]));

        // Itens de cada pedido (com foto do cliente), pro detalhamento ao expandir o card
        let itemsPorPedido = {};
        if (numericOrderIds.length > 0) {
          const { data: itemsData } = await supabase.from('order_items').select('*').in('order_id', numericOrderIds);
          (itemsData || []).forEach(item => {
            if (!itemsPorPedido[item.order_id]) itemsPorPedido[item.order_id] = [];
            itemsPorPedido[item.order_id].push(item);
          });
        }
        setPedidoItemsMap(itemsPorPedido);

        // Itens que este lojista enviou em cada proposta (com foto e preço enviados)
        const myBidIds = myBids.map(b => b.id);
        let itensPorProposta = {};
        if (myBidIds.length > 0) {
          const { data: bItemsData } = await supabase.from('bid_items').select('*').in('bid_id', myBidIds);
          (bItemsData || []).forEach(item => {
            if (!itensPorProposta[item.bid_id]) itensPorProposta[item.bid_id] = [];
            itensPorProposta[item.bid_id].push(item);
          });
        }
        setMinhaPropostaItemsMap(itensPorProposta);

        // Todas as propostas (de qualquer lojista) para os mesmos pedidos,
        // pra saber se o cliente já fechou com outro concorrente.
        let pedidosFechadosComOutro = new Set();
        if (numericOrderIds.length > 0) {
          const { data: todasPropostas } = await supabase
            .from('bids')
            .select('order_id, pedido_id, lojista_id, status')
            .in('order_id', numericOrderIds);

          (todasPropostas || []).forEach(b => {
            if (b.status === 'Aceito' && b.lojista_id !== user.id) {
              pedidosFechadosComOutro.add(Number(b.order_id || b.pedido_id));
            }
          });
        }
        setOrdersFechadosComOutro(pedidosFechadosComOutro);

        const formattedBids = myBids.map(b => ({
          ...b,
          pedido: orderMap.get(String(b.order_id || b.pedido_id))
        }));

        setAcceptedBids(formattedBids.filter(b => b.status === 'Aceito'));
        setPendingBids(formattedBids.filter(b => b.status !== 'Aceito'));
      } else {
        setAcceptedBids([]);
        setPendingBids([]);
        setPedidoItemsMap({});
        setMinhaPropostaItemsMap({});
        setOrdersFechadosComOutro(new Set());
      }
    } catch (err) {
      console.error('Erro:', err);
    }
    setLoading(false);
  }

  const openBidModal = async (order) => {
    setSelectedOrder(order);
    const { data: items } = await supabase.from('order_items').select('*').eq('order_id', order.id);
    
    setOrderItems(items || []);
    setBidItemsData((items || []).map(item => ({
      order_item_id: item.id,
      preco_unitario: '',
      atendido: true,
      imagem_url: '',
      nome_opcao: '',
      garantia_opcao: '',
      observacao_opcao: ''
    })));
    setOpcoesExtras([]);
  };

  const handleBidItemChange = (index, field, value) => {
    const updated = [...bidItemsData];
    updated[index][field] = value;
    setBidItemsData(updated);
  };

  const handleLojistaImage = async (index, file) => {
    if (!file) return;
    try {
      setUploadingImageIndex(index);
      const url = await uploadImageToStorage(file, 'lojista');
      handleBidItemChange(index, 'imagem_url', url);
    } catch (err) {
      alert('Erro no envio da foto: ' + err.message);
    } finally {
      setUploadingImageIndex(null);
    }
  };

  const handleAdicionarOpcaoExtra = () => {
    setOpcoesExtras(prev => [...prev, { nome_opcao: '', preco_unitario: '', garantia_opcao: '', observacao_opcao: '', imagem_url: '' }]);
  };

  const handleOpcaoExtraChange = (index, field, value) => {
    setOpcoesExtras(prev => prev.map((op, i) => i === index ? { ...op, [field]: value } : op));
  };

  const handleRemoverOpcaoExtra = (index) => {
    setOpcoesExtras(prev => prev.filter((_, i) => i !== index));
  };

  const handleOpcaoExtraImagem = async (index, file) => {
    if (!file) return;
    try {
      setUploadingOpcaoIndex(index);
      const url = await uploadImageToStorage(file, 'lojista');
      handleOpcaoExtraChange(index, 'imagem_url', url);
    } catch (err) {
      alert('Erro no envio da foto: ' + err.message);
    } finally {
      setUploadingOpcaoIndex(null);
    }
  };

  const handleContestarAvaliacao = async (avaliacaoId) => {
    const motivo = window.prompt('Por que essa avaliação parece injusta? (opcional, ajuda o administrador a decidir)');
    try {
      const { error } = await supabase
        .from('avaliacoes')
        .update({ contestada: true, comentario: motivo ? `[Contestação do lojista] ${motivo}` : undefined })
        .eq('id', avaliacaoId);
      if (error) throw error;
      alert('Contestação enviada! O administrador vai revisar essa avaliação.');
      fetchLojistaData();
    } catch (err) {
      alert('Erro ao contestar avaliação: ' + err.message);
    }
  };

  const handleMarcarEntregue = async (bid) => {
    const confirmar = window.confirm('Confirma que o cliente comprou e recebeu o pedido? Isso vai disparar a pesquisa de avaliação para ele.');
    if (!confirmar) return;
    try {
      let valorFinalCashback = null;

      if (cashbackAtivo && bid.oferece_cashback) {
        const digitado = window.prompt(
          'Valor final do cashback pra esse cliente (ajuste se a compra mudou pelo WhatsApp):',
          String(bid.valor_cashback_oferecido || 0)
        );
        if (digitado !== null) {
          valorFinalCashback = parseFloat(digitado.replace(',', '.')) || 0;
        }
      }

      const dadosAtualizar = { entregue_em: new Date().toISOString() };
      if (valorFinalCashback !== null) dadosAtualizar.valor_cashback_oferecido = valorFinalCashback;

      const { error } = await supabase.from('bids').update(dadosAtualizar).eq('id', bid.id);
      if (error) throw error;

      if (valorFinalCashback && valorFinalCashback > 0) {
        const clienteId = bid.pedido?.cliente?.id;
        if (clienteId) {
          const { data: configData } = await supabase.from('configuracoes_cashback').select('dias_expiracao').eq('id', 1).single();
          const dias = configData?.dias_expiracao || 30;
          const expiraEm = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);

          await supabase.from('cashback_creditos').insert([{
            cliente_id: clienteId,
            lojista_id: profile?.id,
            bid_id: bid.id,
            valor: valorFinalCashback,
            expira_em: expiraEm.toISOString()
          }]);
        }
      }

      fetchLojistaData();
    } catch (err) {
      alert('Erro ao marcar como entregue: ' + err.message);
    }
  };

  const handleSendBid = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;

    if (uploadingImageIndex !== null) {
      alert('Aguarde o upload da foto ser concluído.');
      return;
    }

    if (atingiuLimiteBasico) {
      alert(`Você usou suas ${limiteDiarioBasico} propostas de hoje (plano Básico). Vire Pro e responda sem limite!`);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Trava extra: garante que este lojista ainda não enviou proposta para este pedido
      const { data: propostaExistente } = await supabase
        .from('bids')
        .select('id')
        .eq('lojista_id', user?.id)
        .or(`order_id.eq.${selectedOrder.id},pedido_id.eq.${selectedOrder.id}`)
        .maybeSingle();

      if (propostaExistente) {
        alert('Você já enviou uma proposta para este pedido. Não é possível enviar outra.');
        setSelectedOrder(null);
        fetchLojistaData();
        return;
      }

      let totalProdutos = 0;
      let totalProdutosMax = null;
      let atendeuTodos = true;

      // Faixa de preço: só pra pedido de item único, quando o lojista
      // adicionou opções extras de preço pro mesmo item.
      const temFaixaDePreco = orderItems.length === 1 && opcoesExtras.length > 0;

      if (temFaixaDePreco) {
        const qtd = orderItems[0]?.quantidade || 1;
        const totaisOpcoes = [bidItemsData[0], ...opcoesExtras]
          .map(op => parseFloat(op.preco_unitario || 0) * qtd)
          .filter(v => v > 0);
        totalProdutos = totaisOpcoes.length > 0 ? Math.min(...totaisOpcoes) : 0;
        totalProdutosMax = totaisOpcoes.length > 0 ? Math.max(...totaisOpcoes) : null;
        atendeuTodos = bidItemsData[0]?.atendido || false;
      } else {
        bidItemsData.forEach((bItem, idx) => {
          if (bItem.atendido) {
            const qtd = orderItems[idx]?.quantidade || 1;
            totalProdutos += (parseFloat(bItem.preco_unitario || 0) * qtd);
          } else {
            atendeuTodos = false;
          }
        });
      }

      const { data: newBid, error: bidErr } = await supabase
        .from('bids')
        .insert([{
          order_id: selectedOrder.id,
          pedido_id: selectedOrder.id,
          lojista_id: user?.id,
          preco: totalProdutos,
          valor: totalProdutos,
          preco_faixa_maximo: temFaixaDePreco && totalProdutosMax > totalProdutos ? totalProdutosMax : null,
          frete: (selectedOrder.tipo_recebimento || 'ambos') === 'retirada' ? 0 : parseFloat(frete || 0),
          observacao: observacao,
          status: 'Enviado',
          is_completo: atendeuTodos,
          prazo_entrega: prazoEntrega || null,
          garantia: garantia || null,
          retirada_disponivel: (selectedOrder.tipo_recebimento || 'ambos') === 'retirada'
            ? true
            : (selectedOrder.tipo_recebimento || 'ambos') === 'entrega' ? false : retiradaDisponivel,
          formas_pagamento: formasPagamento.length > 0 ? formasPagamento : null,
          parcelas_sem_juros: formasPagamento.includes('cartao') && parcelasSemJuros ? parseInt(parcelasSemJuros) : null,
          oferece_cashback: cashbackAtivo && (profile?.plano === 'pro' || profile?.plano === 'premium') ? ofereceCashback : false,
          valor_cashback_oferecido: cashbackAtivo && (profile?.plano === 'pro' || profile?.plano === 'premium') && ofereceCashback ? parseFloat(valorCashbackOferecido || 0) : null,
          aceita_cashback: cashbackAtivo && profile?.plano === 'premium' ? aceitaCashback : false
        }])
        .select()
        .single();

      if (bidErr) throw bidErr;

      const itemsToInsert = temFaixaDePreco
        ? [bidItemsData[0], ...opcoesExtras].map((op, i) => ({
            bid_id: newBid.id,
            order_item_id: orderItems[0].id,
            preco_unitario: parseFloat(op.preco_unitario || 0),
            price: parseFloat(op.preco_unitario || 0),
            atendido: true,
            available: true,
            imagem_url: op.imagem_url,
            nome_opcao: op.nome_opcao || null,
            garantia_opcao: op.garantia_opcao || null,
            observacao_opcao: op.observacao_opcao || null,
          }))
        : bidItemsData.map(bItem => ({
            bid_id: newBid.id,
            order_item_id: bItem.order_item_id,
            preco_unitario: parseFloat(bItem.preco_unitario || 0),
            price: parseFloat(bItem.preco_unitario || 0),
            atendido: bItem.atendido,
            available: bItem.atendido,
            imagem_url: bItem.imagem_url
          }));

      const { error: itemsErr } = await supabase.from('bid_items').insert(itemsToInsert);
      if (itemsErr) throw itemsErr;

      alert('Orçamento enviado com sucesso!');
      setSelectedOrder(null);
      setFrete('');
      setObservacao('');
      setPrazoEntrega('');
      setGarantia('');
      setRetiradaDisponivel(false);
      setParcelasSemJuros('');
      setFormasPagamento([]);
      setOfereceCashback(false);
      setValorCashbackOferecido('');
      setAceitaCashback(false);
      setOpcoesExtras([]);
      setNovosPedidosCount(prev => {
        const novo = Math.max(0, prev - 1);
        if (novo === 0) setNewOrderAlert(false);
        return novo;
      });
      fetchLojistaData();
    } catch (err) {
      alert('Erro ao enviar orçamento: ' + err.message);
    }
  };

  const getRemainingTime = (order) => {
    if (!order?.expira_em) return { texto: 'Sem prazo', expirado: false, pausado: false };
    const status = getStatusPrazo(order, lojistasElegiveisPorPedido[order.id] || [], new Date(now));
    return { texto: status.texto, expirado: status.expirado, pausado: status.pausado };
  };

  // Verifica se uma data (created_at) cai dentro do período selecionado
  const dentroDoPeriodo = (dataStr) => {
    if (!dataStr) return true;
    const data = new Date(dataStr);
    if (dateFrom && data < new Date(dateFrom + 'T00:00:00')) return false;
    if (dateTo && data > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  };

  // Ordena qualquer lista pela data de criação, respeitando o sortOrder
  const ordenarPorData = (lista, campoData = 'created_at') => {
    const copia = [...lista];
    copia.sort((a, b) => {
      const dataA = new Date(a[campoData] || 0).getTime();
      const dataB = new Date(b[campoData] || 0).getTime();
      return sortOrder === 'asc' ? dataA - dataB : dataB - dataA;
    });
    return copia;
  };

  // Filtragem
  const filteredOrders = ordenarPorData(orders.filter(order => {
    if (statusFilter === 'urgentes' && order.prazo_opcao !== 'urgente') return false;
    if (!dentroDoPeriodo(order.created_at)) return false;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchCodigo = order.codigo_pedido?.toLowerCase().includes(term);
      const matchDesc = order.descricao?.toLowerCase().includes(term);
      const matchBairro = order.bairro?.toLowerCase().includes(term);
      const matchCidade = order.cidade_nome_exibicao?.toLowerCase().includes(term);
      if (!matchCodigo && !matchDesc && !matchBairro && !matchCidade) return false;
    }

    return true;
  }));

  const acceptedBidsOrdenados = ordenarPorData(acceptedBids.filter(bid => dentroDoPeriodo(bid.created_at)));

  // Quantas propostas este lojista já enviou HOJE — usado só pro plano
  // Básico, que tem limite diário configurável pelo Admin.
  const inicioDeHoje = new Date();
  inicioDeHoje.setHours(0, 0, 0, 0);
  const propostasHojeCount = [...acceptedBids, ...pendingBids].filter(
    b => b.created_at && new Date(b.created_at) >= inicioDeHoje
  ).length;
  const atingiuLimiteBasico = profile?.plano === 'basico' && propostasHojeCount >= limiteDiarioBasico;
  const pendingBidsOrdenados = ordenarPorData(pendingBids.filter(bid => dentroDoPeriodo(bid.created_at)));
  const enviadasOrdenadas = pendingBidsOrdenados.filter(bid => !ordersFechadosComOutro.has(Number(bid.order_id || bid.pedido_id)));
  const encerradasOrdenadas = pendingBidsOrdenados.filter(bid => ordersFechadosComOutro.has(Number(bid.order_id || bid.pedido_id)));

  // Paginação (10 por página) de cada seção
  const totalPaginasAbertas = Math.max(1, Math.ceil(filteredOrders.length / ITENS_POR_PAGINA));
  const totalPaginasFechadas = Math.max(1, Math.ceil(acceptedBidsOrdenados.length / ITENS_POR_PAGINA));
  const totalPaginasEnviadas = Math.max(1, Math.ceil(enviadasOrdenadas.length / ITENS_POR_PAGINA));
  const totalPaginasEncerradas = Math.max(1, Math.ceil(encerradasOrdenadas.length / ITENS_POR_PAGINA));

  const paginatedAbertas = filteredOrders.slice((paginaAbertas - 1) * ITENS_POR_PAGINA, paginaAbertas * ITENS_POR_PAGINA);
  const paginatedFechadas = acceptedBidsOrdenados.slice((paginaFechadas - 1) * ITENS_POR_PAGINA, paginaFechadas * ITENS_POR_PAGINA);
  const paginatedEnviadas = enviadasOrdenadas.slice((paginaEnviadas - 1) * ITENS_POR_PAGINA, paginaEnviadas * ITENS_POR_PAGINA);
  const paginatedEncerradas = encerradasOrdenadas.slice((paginaEncerradas - 1) * ITENS_POR_PAGINA, paginaEncerradas * ITENS_POR_PAGINA);

  // Ranking anônimo das propostas concorrentes (recurso Premium) — só
  // disponível depois que o lojista já perdeu aquele pedido pra outro.
  const handleVerRankingConcorrentes = async (bid) => {
    const orderIdNum = Number(bid.order_id || bid.pedido_id);
    if (rankingAbertoBidId === bid.id) {
      setRankingAbertoBidId(null);
      return;
    }

    setCarregandoRanking(true);
    setRankingAbertoBidId(bid.id);
    try {
      const { data: todasPropostas } = await supabase
        .from('bids')
        .select('*')
        .or(`order_id.eq.${orderIdNum},pedido_id.eq.${orderIdNum}`);

      const pedidoCriadoEm = bid.pedido?.created_at ? new Date(bid.pedido.created_at) : null;

      const formatarTempoResposta = (bidCriadoEm) => {
        if (!pedidoCriadoEm || !bidCriadoEm) return 'Não disponível';
        const diffMin = (new Date(bidCriadoEm) - pedidoCriadoEm) / 60000;
        if (diffMin < 0) return 'Não disponível';
        const horas = Math.floor(diffMin / 60);
        const minutos = Math.round(diffMin % 60);
        return horas > 0 ? `${horas}h ${minutos}min` : `${minutos}min`;
      };

      const todasFormatadas = (todasPropostas || []).map(b => ({
        bidId: b.id,
        total: parseFloat(b.preco || 0) + parseFloat(b.frete || 0),
        frete: parseFloat(b.frete || 0),
        retirada: b.retirada_disponivel,
        formasPagamento: (b.formas_pagamento || []).map(fp => OPCOES_PAGAMENTO.find(o => o.value === fp)?.label || fp),
        tempoResposta: formatarTempoResposta(b.created_at),
        souEu: b.id === bid.id,
        // Sem nenhum item em estoque (preço zerado) não é uma oferta de
        // preço de verdade — não pode competir no ranking como "mais barato".
        semEstoque: parseFloat(b.preco || 0) === 0,
      }));

      const comEstoque = todasFormatadas
        .filter(item => !item.semEstoque)
        .sort((a, b2) => a.total - b2.total)
        .map((item, idx) => ({ ...item, posicao: idx + 1 }));

      const semEstoque = todasFormatadas.filter(item => item.semEstoque).map(item => ({ ...item, posicao: null }));

      const ranking = [...comEstoque, ...semEstoque];

      setRankingConcorrentes(ranking);
    } catch (err) {
      alert('Erro ao carregar ranking: ' + err.message);
      setRankingAbertoBidId(null);
    } finally {
      setCarregandoRanking(false);
    }
  };

  const LABEL_TIPO_RECEBIMENTO = { entrega: 'Entrega', retirada: 'Retirada na loja', ambos: 'Entrega ou retirada (ver as duas)' };

  // Resumo completo do pedido + proposta, usado na mensagem do WhatsApp
  const montarResumoPedido = (bid) => {
    const orderIdNum = Number(bid.order_id || bid.pedido_id);
    const itens = pedidoItemsMap[orderIdNum] || [];
    const bItens = minhaPropostaItemsMap[bid.id] || [];
    const pedido = bid.pedido || {};
    const linhas = [];
    linhas.push(`*Pedido #${pedido.codigo_pedido || pedido.id}*`);
    if (pedido.tipo_recebimento) linhas.push(`Recebimento: ${LABEL_TIPO_RECEBIMENTO[pedido.tipo_recebimento] || pedido.tipo_recebimento}`);
    if (pedido.bairro) linhas.push(`Bairro: ${pedido.bairro}`);
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
        linhas.push(partes.join(' · '));
      });
    });
    linhas.push('');
    linhas.push(`Produto: R$ ${parseFloat(bid.preco || 0).toFixed(2)}${bid.preco_faixa_maximo ? ` até R$ ${parseFloat(bid.preco_faixa_maximo).toFixed(2)}` : ''}`);
    if (pedido.tipo_recebimento !== 'retirada') {
      linhas.push(`Frete: ${parseFloat(bid.frete || 0) === 0 ? 'grátis' : `R$ ${parseFloat(bid.frete || 0).toFixed(2)}`}`);
    }
    if (bid.retirada_disponivel) linhas.push('Retirada na loja disponível');
    if (bid.prazo_entrega) linhas.push(`Prazo de entrega: ${OPCOES_PRAZO_ENTREGA.find(o => o.value === bid.prazo_entrega)?.label || bid.prazo_entrega}`);
    if (bid.formas_pagamento && bid.formas_pagamento.length > 0) {
      linhas.push(`Pagamento: ${bid.formas_pagamento.map(fp => OPCOES_PAGAMENTO.find(o => o.value === fp)?.label || fp).join(', ')}${bid.parcelas_sem_juros > 1 ? ` (até ${bid.parcelas_sem_juros}x sem juros no cartão)` : ''}`);
    }
    if (bid.garantia) linhas.push(`Garantia: ${bid.garantia}`);
    if (bid.observacao) linhas.push(`Observações: ${bid.observacao}`);
    if (bid.cashback_aplicado > 0) linhas.push(`Cashback usado pelo cliente: R$ ${parseFloat(bid.cashback_aplicado).toFixed(2)}`);
    return linhas.join('\n');
  };

  /* ============================ NOVO LAYOUT ============================ */

  const [menuContaAberto, setMenuContaAberto] = useState(false);
  const [mostrarPeriodo, setMostrarPeriodo] = useState(false);
  const [mostrarTodasAvaliacoes, setMostrarTodasAvaliacoes] = useState(false);

  useEffect(() => {
    carregarFontesNuno();
  }, []);

  const LINK_FALAR_COM_NUNO = 'https://www.comprecomnuno.com.br/contato';
  const NOME_PLANO = { basico: 'Básico', pro: 'Pro', premium: 'Premium' };
  const planoAtual = profile?.plano || null;
  const ehProOuPremium = planoAtual === 'pro' || planoAtual === 'premium';

  const brl = (valor) => `R$ ${Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const numeroBr = (valor, casas = 1) => Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  const labelPrazoEntrega = (valor) => OPCOES_PRAZO_ENTREGA.find(o => o.value === valor)?.label || valor;
  const labelPagamento = (valor) => {
    const label = OPCOES_PAGAMENTO.find(o => o.value === valor)?.label || valor;
    return valor === 'faturado' ? 'Faturado' : label;
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

  const iniciaisDe = (texto) => (texto || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(parte => parte[0].toUpperCase())
    .join('') || '?';

  const totalDaProposta = (bid) => parseFloat(bid.preco || 0) + parseFloat(bid.frete || 0);

  const irParaConfirmadas = () => {
    setAbaSelecionadaLojista('confirmadas');
    setNovaVendaConfirmadaCount(0);
    setShowVendaConfirmadaBanner(false);
  };

  // Barra dividida em pedaços (usada no limite diário do plano Básico)
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

  const renderChip = (texto, cls, icone, preenchido = false) => (
    <span className={`inline-flex items-center gap-1.5 min-h-[28px] px-2.5 py-0.5 rounded-full text-xs font-bold ${cls}`}>
      {icone && <Icone nome={icone} tamanho={13} strokeWidth={2.2} preenchido={preenchido} />}
      <span>{texto}</span>
    </span>
  );

  const renderEstrelas = (nota, tamanho = 16) => (
    <span className="inline-flex gap-0.5 text-[#5E17EB]" aria-label={`${nota} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map(i => (
        <Icone key={i} nome="estrela" tamanho={tamanho} strokeWidth={1.8} preenchido={i <= Math.round(nota)} className={i <= Math.round(nota) ? '' : 'text-[#C9C6E0]'} />
      ))}
    </span>
  );

  // Interruptor (liga/desliga) acessível, por cima de um checkbox de verdade
  const renderInterruptor = ({ checked, onChange, rotulo, icone, corLigado = '#5E17EB', classeTexto = 'text-[#0E1033]' }) => (
    <label className="flex items-center justify-between gap-3 min-h-[48px] cursor-pointer">
      <span className={`flex items-center gap-2.5 text-sm font-semibold ${classeTexto}`}>
        {icone && <Icone nome={icone} tamanho={18} className="text-[#5B5E7A]" />}
        {rotulo}
      </span>
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden="true"
        className="relative shrink-0 w-12 h-7 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-[#5E17EB]/40"
        style={{ background: checked ? corLigado : '#D6D3E6' }}
      >
        <span className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow-sm transition-all ${checked ? 'left-[23px]' : 'left-[3px]'}`} />
      </span>
    </label>
  );

  const CLASSE_ENTRADA = 'w-full h-12 px-3.5 rounded-xl border border-[#E4E2EF] bg-white text-[15px] text-[#0E1033] placeholder-[#8B88A6] focus:outline-none focus:border-[#5E17EB] focus:ring-2 focus:ring-[#5E17EB]/20 transition';
  const CLASSE_ROTULO = 'block text-[13px] font-semibold text-[#0E1033] mb-1.5';

  // Botão de enviar foto: um <label> grande por cima do input de arquivo escondido
  const renderEnvioFoto = ({ url, enviando, onArquivo, rotulo = 'Adicionar foto' }) => (
    <div className="flex items-center gap-3">
      {url && (
        <img
          src={url}
          alt="Foto enviada"
          onClick={() => setActiveImage(url)}
          className="w-16 h-16 rounded-xl object-cover border border-[#E4E2EF] cursor-zoom-in shrink-0"
        />
      )}
      <label className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl cursor-pointer text-sm font-bold transition ${
        url ? 'border border-[#E4E2EF] bg-white text-[#0E1033] hover:bg-[#F5F4FA]' : 'border-[1.5px] border-dashed border-[#C9B6FB] bg-[#F7F3FF] text-[#3C0DA8] hover:bg-[#EFE9FF]'
      }`}>
        <Icone nome="camera" tamanho={18} />
        {enviando ? 'Enviando...' : url ? 'Trocar foto' : rotulo}
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => onArquivo(e.target.files[0])} />
      </label>
    </div>
  );

  /* ------------------------------- Paginação ------------------------------- */
  const renderPaginacao = (paginaAtual, totalPaginas, setPagina) => {
    if (totalPaginas <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-2 pt-2">
        <button
          type="button"
          onClick={() => setPagina(p => Math.max(1, p - 1))}
          disabled={paginaAtual === 1}
          className="inline-flex items-center gap-1 h-11 px-3.5 rounded-xl border border-[#E4E2EF] bg-white text-sm font-semibold text-[#0E1033] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F5F4FA] transition"
        >
          <Icone nome="esquerda" tamanho={16} /> Anterior
        </button>
        <span className="text-sm font-semibold text-[#5B5E7A] px-2">
          {paginaAtual} de {totalPaginas}
        </span>
        <button
          type="button"
          onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
          disabled={paginaAtual === totalPaginas}
          className="inline-flex items-center gap-1 h-11 px-3.5 rounded-xl border border-[#E4E2EF] bg-white text-sm font-semibold text-[#0E1033] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F5F4FA] transition"
        >
          Próxima <Icone nome="direita" tamanho={16} />
        </button>
      </div>
    );
  };

  /* ---------------- "O que você enviou" + itens do pedido (detalhe) ---------------- */
  const renderDetalhesProposta = (bid) => {
    const orderIdNum = Number(bid.order_id || bid.pedido_id);
    const itensCliente = pedidoItemsMap[orderIdNum] || [];
    const itensEnviados = minhaPropostaItemsMap[bid.id] || [];
    const pedido = bid.pedido || {};

    const linhas = [
      ['Produto', `${brl(bid.preco)}${bid.preco_faixa_maximo != null ? ` a ${brl(bid.preco_faixa_maximo)}` : ''}`],
      pedido.tipo_recebimento !== 'retirada' ? ['Frete', parseFloat(bid.frete || 0) === 0 ? 'Grátis' : brl(bid.frete)] : null,
      ['Retirada na loja', bid.retirada_disponivel ? 'Sim' : 'Não'],
      ['Atendimento', bid.is_completo ? '100% dos itens' : 'Parcial'],
      bid.prazo_entrega ? ['Prazo de entrega', labelPrazoEntrega(bid.prazo_entrega)] : null,
      bid.formas_pagamento && bid.formas_pagamento.length > 0
        ? ['Pagamento', `${bid.formas_pagamento.map(labelPagamento).join(', ')}${bid.parcelas_sem_juros > 1 ? ` · até ${bid.parcelas_sem_juros}x sem juros` : ''}`]
        : null,
      bid.garantia ? ['Garantia', bid.garantia] : null,
      bid.observacao ? ['Observações', bid.observacao] : null,
      bid.oferece_cashback ? ['Cashback oferecido', brl(bid.valor_cashback_oferecido)] : null,
      bid.aceita_cashback ? ['Aceita cashback como pagamento', 'Sim'] : null,
      bid.cashback_aplicado > 0 ? ['Cashback usado pelo cliente', brl(bid.cashback_aplicado)] : null,
    ].filter(Boolean);

    return (
      <>
        <section className="bg-white border border-[#E4E2EF] rounded-2xl p-4">
          <h3 className="text-xs font-bold text-[#5B5E7A] uppercase tracking-wide mb-1">O que você enviou</h3>
          <dl>
            {linhas.map(([rotulo, valor], i) => (
              <div key={rotulo} className={`flex justify-between gap-3 py-2.5 text-sm ${i < linhas.length - 1 ? 'border-b border-[#F0EFF5]' : ''}`}>
                <dt className="text-[#5B5E7A]">{rotulo}</dt>
                <dd className="font-semibold text-right text-[#0E1033]">{valor}</dd>
              </div>
            ))}
          </dl>
        </section>

        {itensCliente.length > 0 && (
          <section className="bg-white border border-[#E4E2EF] rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-[#5B5E7A] uppercase tracking-wide">Itens do pedido</h3>
            {itensCliente.map((item) => {
              const enviados = itensEnviados.filter(ei => ei.order_item_id === item.id);
              const enviado = enviados[0];
              return (
                <div key={item.id} className="flex justify-between items-start gap-3 pb-3 border-b border-[#F0EFF5] last:border-b-0 last:pb-0">
                  <div className="space-y-1 text-sm min-w-0">
                    <p className="font-semibold text-[#0E1033]">{item.descricao} · Qtd {item.quantidade}</p>
                    {enviados.map((op, opIdx) => (
                      <div key={op.id || opIdx}>
                        <p className={op.atendido ? 'text-[#0E7A4E] font-semibold' : 'text-[#C53036] font-bold'}>
                          {enviados.length > 1 && `Opção ${opIdx + 1}${op.nome_opcao ? ` (${op.nome_opcao})` : ''}: `}
                          {enviados.length === 1 && op.nome_opcao && `${op.nome_opcao}: `}
                          {op.atendido ? `${brl(op.preco_unitario)} / unid.` : 'Marcado como sem estoque'}
                        </p>
                        {op.garantia_opcao && <p className="text-[#5B5E7A] text-[13px]">Garantia: {op.garantia_opcao}</p>}
                        {op.observacao_opcao && <p className="text-[#5B5E7A] text-[13px]">Obs: {op.observacao_opcao}</p>}
                        {enviados.length > 1 && op.imagem_url && (
                          <img
                            src={op.imagem_url}
                            alt="Foto da opção"
                            onClick={() => setActiveImage(op.imagem_url)}
                            className="w-12 h-12 object-cover rounded-lg border border-[#E4E2EF] cursor-zoom-in mt-1"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {item.imagem_url && (
                      <div className="text-center">
                        <p className="text-[10px] text-[#8B88A6] font-semibold mb-0.5">Cliente</p>
                        <img
                          src={item.imagem_url}
                          alt="Foto do cliente"
                          onClick={() => setActiveImage(item.imagem_url)}
                          className="w-12 h-12 object-cover rounded-lg border border-[#E4E2EF] cursor-zoom-in"
                        />
                      </div>
                    )}
                    {enviados.length <= 1 && enviado?.imagem_url && (
                      <div className="text-center">
                        <p className="text-[10px] text-[#5E17EB] font-bold mb-0.5">Sua foto</p>
                        <img
                          src={enviado.imagem_url}
                          alt="Sua foto"
                          onClick={() => setActiveImage(enviado.imagem_url)}
                          className="w-12 h-12 object-cover rounded-lg border border-[#E4E2EF] cursor-zoom-in"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        <p className="text-xs text-[#8B88A6] text-center">
          Pedido feito em {pedido.created_at ? new Date(pedido.created_at).toLocaleString('pt-BR') : '-'}
          {' · '}proposta enviada em {bid.created_at ? new Date(bid.created_at).toLocaleString('pt-BR') : '-'}
        </p>
      </>
    );
  };

  /* --------------------------- Card de cotação aberta --------------------------- */
  const renderCotacaoAberta = (order) => {
    const tempo = getRemainingTime(order);
    const urgente = order.prazo_opcao === 'urgente';
    const repCliente = reputacaoClientesPorPedido[order.id];
    const concorrentes = contagemPropostasPorPedido[order.id] || 0;
    const local = [order.bairro, order.cidade_nome_exibicao].filter(Boolean).join(', ');
    const abrir = () => { if (!tempo.expirado) openBidModal(order); };

    return (
      <article
        key={order.id}
        onClick={abrir}
        className={`bg-white rounded-2xl border p-4 sm:p-5 transition flex flex-col sm:flex-row sm:items-center gap-4 ${
          tempo.expirado
            ? 'border-[#E4E2EF] opacity-60'
            : `cursor-pointer hover:shadow-[0_6px_20px_rgba(14,16,51,0.08)] ${urgente ? 'border-[#F3B4B6]' : 'border-[#E4E2EF] hover:border-[#C9B6FB]'}`
        }`}
      >
        <div className="flex gap-3 items-start flex-1 min-w-0">
          <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
            tempo.expirado ? 'bg-[#F0EFF5] text-[#8B88A6]' : urgente ? 'bg-[#FDECEC] text-[#C53036]' : 'bg-[#EFE9FF] text-[#5E17EB]'
          }`}>
            <Icone nome={tempo.expirado ? 'relogio' : 'caixa'} tamanho={24} />
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <p className="text-xs font-semibold text-[#5B5E7A]">
                Pedido #{order.codigo_pedido || order.id}
                {order.created_at && ` · ${tempoRelativo(order.created_at)}`}
              </p>
              <h3 className="text-base font-bold leading-snug text-[#0E1033] line-clamp-2">{order.descricao}</h3>
              <p className="text-[13px] text-[#5B5E7A]">
                {[order.categoria_nome_exibicao, local, order.tipo_recebimento && LABEL_TIPO_RECEBIMENTO[order.tipo_recebimento]?.replace(' (ver as duas)', '')].filter(Boolean).join(' · ')}
              </p>
            </div>
            {!tempo.expirado && (
              <div className="flex gap-1.5 flex-wrap">
                {urgente && renderChip('Urgente · 1h', 'bg-[#E5484D] text-white')}
                {renderChip(tempo.texto, tempo.pausado ? 'bg-[#E7EEFF] text-[#1D4ED8]' : 'bg-[#FFF3D6] text-[#8A5A00]', tempo.pausado ? 'pausa' : 'relogio')}
                {repCliente && (repCliente.total_avaliacoes ?? 1) > 0
                  ? renderChip(
                    `Cliente ${numeroBr(repCliente.reputacao_media)}`,
                    Number(repCliente.reputacao_media) < 4 ? 'bg-[#FDECEC] text-[#C53036]' : 'bg-[#E3F5EC] text-[#0E7A4E]',
                    'estrela',
                    true
                  )
                  : renderChip('Cliente novo', 'bg-[#F0EFF5] text-[#5B5E7A]')}
                {concorrentes > 0 && renderChip(
                  `${concorrentes} ${concorrentes === 1 ? 'concorrente já respondeu' : 'concorrentes já responderam'}`,
                  'bg-[#E7EEFF] text-[#1D4ED8]',
                  'loja'
                )}
              </div>
            )}
          </div>
        </div>

        {tempo.expirado ? (
          <span className="w-full sm:w-auto inline-flex items-center justify-center min-h-[48px] px-5 rounded-xl bg-[#F0EFF5] text-[#8B88A6] text-sm font-bold">
            Prazo encerrado
          </span>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); abrir(); }}
            className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 min-h-[48px] px-5 rounded-xl bg-[#5E17EB] hover:bg-[#3C0DA8] text-white text-[15px] font-bold transition"
          >
            Enviar orçamento <Icone nome="direita" tamanho={16} strokeWidth={2.2} />
          </button>
        )}
      </article>
    );
  };

  /* ----------------- Card de proposta (enviadas / confirmadas / encerradas) ----------------- */
  const renderPropostaRow = (bid, tipo) => {
    const pedido = bid.pedido || {};
    const destacar = tipo === 'confirmadas' && !bid.visualizado_pelo_lojista && !bid.entregue_em;
    const abrir = () => {
      setDetalheBidAberto(bid);
      if (destacar) {
        supabase.from('bids').update({ visualizado_pelo_lojista: true }).eq('id', bid.id).then(() => fetchLojistaData());
      }
    };

    const CONFIG = {
      enviadas: { icone: 'relogio', tile: 'bg-[#FFF3D6] text-[#8A5A00]', chip: ['Aguardando o cliente', 'bg-[#FFF3D6] text-[#8A5A00]'], botao: 'Ver proposta', rotuloValor: 'Total enviado' },
      confirmadas: { icone: 'check', tile: 'bg-[#E3F5EC] text-[#0E7A4E]', chip: bid.entregue_em ? ['Entregue', 'bg-[#E3F5EC] text-[#0E7A4E]'] : ['Confirmada', 'bg-[#E3F5EC] text-[#0E7A4E]'], botao: 'Ver venda', rotuloValor: 'Total da venda' },
      encerradas: { icone: 'cadeado', tile: 'bg-[#F0EFF5] text-[#5B5E7A]', chip: ['Outro lojista venceu', 'bg-[#FDECEC] text-[#C53036]'], botao: 'Ver detalhes', rotuloValor: 'Total enviado' },
    }[tipo];

    return (
      <article
        key={bid.id}
        onClick={abrir}
        className={`rounded-2xl border p-4 sm:p-5 cursor-pointer transition flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-[0_6px_20px_rgba(14,16,51,0.08)] ${
          destacar ? 'bg-[#0E7A4E] border-[#0E7A4E] text-white' : tipo === 'confirmadas' ? 'bg-white border-[#A7DCC1]' : 'bg-white border-[#E4E2EF] hover:border-[#C9B6FB]'
        }`}
      >
        <div className="flex gap-3 items-start flex-1 min-w-0">
          <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${destacar ? 'bg-white/15 text-white' : CONFIG.tile}`}>
            <Icone nome={CONFIG.icone} tamanho={24} />
          </span>
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-semibold ${destacar ? 'text-[#CDEBDC]' : 'text-[#5B5E7A]'}`}>
              Pedido #{pedido.codigo_pedido || pedido.id}
              {tipo === 'confirmadas' && ` · ${pedido.cliente?.nome || 'Cliente'}`}
              {bid.created_at && ` · ${tempoRelativo(tipo === 'confirmadas' && bid.accepted_at ? bid.accepted_at : bid.created_at)}`}
            </p>
            <h3 className={`text-base font-bold leading-snug line-clamp-2 ${destacar ? 'text-white' : 'text-[#0E1033]'}`}>{pedido.descricao}</h3>
            <div className="mt-2">
              {destacar
                ? renderChip('Nova venda!', 'bg-white text-[#0E7A4E]', 'check')
                : renderChip(CONFIG.chip[0], CONFIG.chip[1])}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:flex-col sm:items-end gap-3 shrink-0">
          <div className="sm:text-right">
            <p className={`text-xs ${destacar ? 'text-[#CDEBDC]' : 'text-[#5B5E7A]'}`}>{CONFIG.rotuloValor}</p>
            <p style={FONTE_TITULO} className={`text-[22px] font-bold tracking-tight leading-tight ${destacar ? 'text-white' : 'text-[#0E1033]'}`}>
              {brl(totalDaProposta(bid))}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); abrir(); }}
            className={`inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl text-sm font-bold transition ${
              destacar ? 'bg-white text-[#0E7A4E]' : 'bg-[#EFE9FF] hover:bg-[#E3D8FF] text-[#3C0DA8]'
            }`}
          >
            {CONFIG.botao} <Icone nome="direita" tamanho={16} strokeWidth={2.2} />
          </button>
        </div>
      </article>
    );
  };

  /* ------------------------------ Dados da página ------------------------------ */
  const cotacoesValidas = orders.filter(o => !getRemainingTime(o).expirado).length;
  const urgentesCount = orders.filter(o => o.prazo_opcao === 'urgente' && !getRemainingTime(o).expirado).length;
  const hoje = new Date(now);
  const vendasEsteMes = acceptedBids.filter(b => {
    const d = new Date(b.accepted_at || b.created_at || 0);
    return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
  }).length;
  const avaliacoesValidas = minhasAvaliacoes.filter(av => !av.desconsiderada);
  const ultimasAvaliacoes = avaliacoesValidas.slice(0, 2);
  const reputacaoMedia = profile?.reputacao_media != null ? Number(profile.reputacao_media) : 5;

  const abas = [
    { key: 'aberto', label: 'Em aberto', count: filteredOrders.length, aviso: novosPedidosCount },
    { key: 'enviadas', label: 'Enviadas', count: enviadasOrdenadas.length, aviso: 0 },
    { key: 'confirmadas', label: 'Confirmadas', count: acceptedBidsOrdenados.length, aviso: novaVendaConfirmadaCount },
    { key: 'encerradas', label: 'Encerradas', count: encerradasOrdenadas.length, aviso: 0 },
  ];
  const filtrandoAlgo = Boolean(searchTerm || dateFrom || dateTo || (abaSelecionadaLojista === 'aberto' && statusFilter !== 'todas'));

  const renderVazio = (texto, icone = 'caixa') => (
    <div className="bg-white border border-dashed border-[#D6D3E6] rounded-2xl p-8 text-center flex flex-col items-center gap-3">
      <span className="w-12 h-12 rounded-2xl bg-[#F5F4FA] text-[#8B88A6] flex items-center justify-center">
        <Icone nome={filtrandoAlgo ? 'busca' : icone} tamanho={24} />
      </span>
      <p className="text-sm text-[#5B5E7A]">{filtrandoAlgo ? 'Nada encontrado com esses filtros.' : texto}</p>
    </div>
  );

  // Prévia do total enquanto o lojista preenche o orçamento (mesma conta do envio)
  const calcularPreviaOrcamento = () => {
    if (!selectedOrder) return null;
    const temFaixa = orderItems.length === 1 && opcoesExtras.length > 0;
    let minimo = 0;
    let maximo = null;
    if (temFaixa) {
      const qtd = orderItems[0]?.quantidade || 1;
      const totais = [bidItemsData[0], ...opcoesExtras]
        .map(op => parseFloat(op?.preco_unitario || 0) * qtd)
        .filter(v => v > 0);
      minimo = totais.length > 0 ? Math.min(...totais) : 0;
      maximo = totais.length > 1 ? Math.max(...totais) : null;
    } else {
      bidItemsData.forEach((bItem, idx) => {
        if (bItem.atendido) minimo += parseFloat(bItem.preco_unitario || 0) * (orderItems[idx]?.quantidade || 1);
      });
    }
    const tipo = selectedOrder.tipo_recebimento || 'ambos';
    const valorFrete = tipo === 'retirada' ? 0 : parseFloat(frete || 0);
    return { minimo, maximo: maximo != null && maximo > minimo ? maximo : null, valorFrete, tipo };
  };
  const previa = calcularPreviaOrcamento();
  const nParcelas = parseInt(parcelasSemJuros, 10) || 1;

  /* ================================== TELA ================================== */
  return (
    <div className="bg-[#F5F4FA] text-[#0E1033] min-h-screen flex flex-col" style={FONTE_TEXTO}>

      {/* Cabeçalho */}
      <header className="bg-white/95 backdrop-blur border-b border-[#E4E2EF] sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-90 transition" aria-label="Nuno, início">
            <img src={logo} alt="Nuno" className="h-9 w-auto object-contain" />
            <span className="hidden sm:inline-flex h-6 px-2.5 rounded-full bg-[#EFE9FF] text-[#3C0DA8] text-xs font-bold items-center">para lojistas</span>
          </Link>

          <div className="flex items-center gap-2">
            {planoAtual && (
              <span className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-[#EFE9FF] text-[#3C0DA8] text-[13px] font-bold">
                <Icone nome="estrela" tamanho={15} /> Plano {NOME_PLANO[planoAtual] || planoAtual}
              </span>
            )}
            <button
              type="button"
              onClick={() => (showVendaConfirmadaBanner ? irParaConfirmadas() : setAbaSelecionadaLojista('aberto'))}
              aria-label={newOrderAlert || showVendaConfirmadaBanner ? 'Novidades: ver agora' : 'Notificações'}
              className="relative w-11 h-11 rounded-full border border-[#E4E2EF] bg-white text-[#0E1033] flex items-center justify-center hover:border-[#935DFF] transition"
            >
              <Icone nome="sino" tamanho={20} />
              {(newOrderAlert || showVendaConfirmadaBanner) && (
                <span className="absolute top-2 right-2.5 w-2.5 h-2.5 rounded-full bg-[#E5484D] border-2 border-white" />
              )}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuContaAberto(v => !v)}
                aria-expanded={menuContaAberto}
                aria-haspopup="menu"
                aria-label="Menu da conta"
                className="inline-flex items-center gap-2 h-11 pl-1.5 pr-3 rounded-full border border-[#E4E2EF] bg-white text-sm font-semibold text-[#0E1033] hover:border-[#935DFF] transition"
              >
                {profile?.logo_url ? (
                  <img src={profile.logo_url} alt="" className="w-8 h-8 rounded-[10px] object-cover" />
                ) : (
                  <span className="w-8 h-8 rounded-[10px] bg-[#00068F] text-white text-xs font-bold flex items-center justify-center">{iniciaisDe(profile?.nome || userEmail)}</span>
                )}
                <span className="hidden sm:inline max-w-[160px] truncate">{profile?.nome || 'Minha loja'}</span>
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
                      <Icone nome="loja" tamanho={18} className="text-[#5B5E7A]" /> Dados da loja
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setMenuContaAberto(false); setMostrarTodasAvaliacoes(true); }}
                      className="w-full flex items-center gap-2.5 h-11 px-3 rounded-xl text-sm font-semibold text-[#0E1033] hover:bg-[#F5F4FA]"
                    >
                      <Icone nome="estrela" tamanho={18} className="text-[#5B5E7A]" /> Minhas avaliações
                    </button>
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
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-5 sm:py-8 space-y-5 flex-1">

        {/* Aviso de cotação nova — fica até o lojista responder */}
        {newOrderAlert && (
          <div className="bg-white border border-[#C9B6FB] rounded-2xl p-2 pl-3 flex items-center gap-3" role="status">
            <span className="w-10 h-10 rounded-xl bg-[#5E17EB] text-white flex items-center justify-center shrink-0 animate-pulse">
              <Icone nome="sino" tamanho={20} />
            </span>
            <p className="flex-1 text-sm text-[#0E1033]">
              <b>{novosPedidosCount > 1 ? `${novosPedidosCount} cotações novas chegaram!` : 'Chegou uma cotação nova!'}</b>
              <span className="text-[#5B5E7A]"> Responda para tirar o aviso.</span>
            </p>
            <button
              type="button"
              onClick={() => { setAbaSelecionadaLojista('aberto'); setStatusFilter('todas'); }}
              className="min-h-[44px] px-4 rounded-xl bg-[#EFE9FF] text-[#3C0DA8] text-sm font-bold shrink-0"
            >
              Ver
            </button>
          </div>
        )}

        {/* Aviso de venda confirmada */}
        {showVendaConfirmadaBanner && (
          <div className="bg-white border border-[#A7DCC1] rounded-2xl p-2 pl-3 flex items-center gap-3" role="status">
            <span className="w-10 h-10 rounded-xl bg-[#0E7A4E] text-white flex items-center justify-center shrink-0">
              <Icone nome="check" tamanho={20} />
            </span>
            <p className="flex-1 text-sm font-bold text-[#0E1033]">
              {novaVendaConfirmadaCount > 1 ? `O cliente confirmou ${novaVendaConfirmadaCount} vendas!` : 'O cliente confirmou uma venda!'}
            </p>
            <button
              type="button"
              onClick={irParaConfirmadas}
              className="min-h-[44px] px-4 rounded-xl bg-[#E3F5EC] text-[#0E7A4E] text-sm font-bold shrink-0"
            >
              Ver venda
            </button>
            <button
              type="button"
              onClick={() => { setShowVendaConfirmadaBanner(false); setNovaVendaConfirmadaCount(0); }}
              aria-label="Fechar aviso"
              className="w-11 h-11 rounded-xl text-[#5B5E7A] hover:bg-[#F5F4FA] flex items-center justify-center shrink-0"
            >
              <Icone nome="fechar" tamanho={18} />
            </button>
          </div>
        )}

        {/* Boas-vindas + números da loja */}
        <section className="relative overflow-hidden bg-[#00068F] rounded-3xl px-5 py-6 sm:px-10 sm:py-8 flex flex-col lg:flex-row lg:items-center justify-between gap-5 text-white">
          <FolhasNuno className="absolute -right-20 -top-10 w-56 h-56 sm:w-80 sm:h-80 opacity-30 pointer-events-none" />
          <div className="relative space-y-1.5 max-w-xl">
            <p className="text-sm font-semibold text-[#C9C6FF]">
              {[profile?.nome, profile?.cidade].filter(Boolean).join(' · ') || 'Painel do lojista'}
            </p>
            <h1 style={FONTE_TITULO} className="text-[28px] sm:text-[38px] leading-[1.1] font-bold tracking-tight">
              {cotacoesValidas === 0
                ? 'Nenhuma cotação aberta agora'
                : cotacoesValidas === 1
                  ? '1 cliente esperando seu preço'
                  : `${cotacoesValidas} clientes esperando seu preço`}
            </h1>
            <p className="text-sm sm:text-[15px] text-[#C9C6FF]">Cotações da sua cidade nas categorias que você atende.</p>
          </div>

          <div className="relative flex flex-col gap-3 lg:w-[460px]">
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              <div className="bg-white/10 rounded-2xl p-3 sm:p-3.5">
                <p className="text-[11px] sm:text-xs font-semibold text-[#C9C6FF]">Vendas<span className="hidden sm:inline"> fechadas</span></p>
                <p style={FONTE_TITULO} className="text-xl sm:text-[28px] font-bold leading-tight">{acceptedBids.length}</p>
                <p className="text-[11px] sm:text-xs text-[#C9C6FF]">{vendasEsteMes} este mês</p>
              </div>
              <div className="bg-white/10 rounded-2xl p-3 sm:p-3.5">
                <p className="text-[11px] sm:text-xs font-semibold text-[#C9C6FF]">Reputação</p>
                <p style={FONTE_TITULO} className="text-xl sm:text-[28px] font-bold leading-tight flex items-center gap-1.5">
                  {numeroBr(reputacaoMedia)} <Icone nome="estrela" tamanho={16} preenchido className="text-[#935DFF]" />
                </p>
                <p className="text-[11px] sm:text-xs text-[#C9C6FF]">{profile?.total_avaliacoes || 0} avaliações</p>
              </div>
              <div className="bg-white/10 rounded-2xl p-3 sm:p-3.5">
                <p className="text-[11px] sm:text-xs font-semibold text-[#C9C6FF]">No prazo</p>
                <p style={FONTE_TITULO} className="text-xl sm:text-[28px] font-bold leading-tight">
                  {profile?.percentual_entrega_no_prazo != null ? `${profile.percentual_entrega_no_prazo}%` : '—'}
                </p>
                <p className="text-[11px] sm:text-xs text-[#C9C6FF]">das entregas</p>
              </div>
            </div>

            {planoAtual === 'basico' && (
              <div className="bg-white text-[#0E1033] rounded-2xl p-3.5 space-y-2">
                <div className="flex justify-between items-baseline gap-2 text-[13px]">
                  <span className="font-bold">Plano Básico · propostas de hoje</span>
                  <span className={`font-bold ${atingiuLimiteBasico ? 'text-[#C53036]' : 'text-[#3C0DA8]'}`}>
                    {Math.min(propostasHojeCount, limiteDiarioBasico)} de {limiteDiarioBasico}
                  </span>
                </div>
                {renderBarra(propostasHojeCount, limiteDiarioBasico, atingiuLimiteBasico ? '#E5484D' : '#5E17EB')}
                <a
                  href={LINK_FALAR_COM_NUNO}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 min-h-[32px] text-[13px] font-bold text-[#5E17EB]"
                >
                  {atingiuLimiteBasico ? 'Limite de hoje atingido · responder sem limite com o Pro' : 'Responder sem limite com o Pro'}
                  <Icone nome="direita" tamanho={14} strokeWidth={2.2} />
                </a>
              </div>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">

          {/* Coluna das cotações */}
          <div className="space-y-4 min-w-0">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
              <h2 style={FONTE_TITULO} className="text-2xl font-bold tracking-tight">Cotações</h2>
              <div role="tablist" aria-label="Situação das cotações" className="flex gap-1 p-1 bg-white border border-[#E4E2EF] rounded-2xl overflow-x-auto">
                {abas.map((aba) => {
                  const ativa = abaSelecionadaLojista === aba.key;
                  return (
                    <button
                      key={aba.key}
                      type="button"
                      role="tab"
                      aria-selected={ativa}
                      onClick={() => (aba.key === 'confirmadas' ? irParaConfirmadas() : setAbaSelecionadaLojista(aba.key))}
                      className={`relative shrink-0 inline-flex items-center justify-center gap-1.5 h-10 px-3 sm:px-3.5 rounded-xl text-[13px] sm:text-sm transition ${
                        ativa ? 'bg-[#5E17EB] text-white font-bold' : 'text-[#5B5E7A] font-semibold hover:text-[#0E1033]'
                      }`}
                    >
                      {aba.label}
                      <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold inline-flex items-center justify-center ${
                        ativa ? 'bg-white text-[#3C0DA8]' : 'bg-[#F0EFF5] text-[#5B5E7A]'
                      }`}>
                        {aba.count}
                      </span>
                      {aba.aviso > 0 && (
                        <span
                          className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#E5484D] text-white text-[10px] font-bold flex items-center justify-center"
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
                  <span className="sr-only">Buscar cotação</span>
                  <input
                    type="search"
                    placeholder="Buscar pedido, item ou bairro"
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
                    <Icone nome="calendario" tamanho={18} /> Período
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
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-11 px-3 rounded-xl border border-[#E4E2EF] text-sm text-[#0E1033] bg-white" />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold text-[#5B5E7A]">
                    Até
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-11 px-3 rounded-xl border border-[#E4E2EF] text-sm text-[#0E1033] bg-white" />
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

              {abaSelecionadaLojista === 'aberto' && (
                <div role="group" aria-label="Filtrar cotações" className="flex gap-2">
                  <button
                    type="button"
                    aria-pressed={statusFilter === 'todas'}
                    onClick={() => setStatusFilter('todas')}
                    className={`h-10 px-4 rounded-full text-[13px] transition ${
                      statusFilter === 'todas' ? 'bg-[#0E1033] text-white font-bold' : 'bg-white border border-[#E4E2EF] text-[#0E1033] font-semibold hover:border-[#935DFF]'
                    }`}
                  >
                    Todas · {orders.length}
                  </button>
                  <button
                    type="button"
                    aria-pressed={statusFilter === 'urgentes'}
                    onClick={() => setStatusFilter('urgentes')}
                    className={`inline-flex items-center gap-2 h-10 px-4 rounded-full text-[13px] transition ${
                      statusFilter === 'urgentes' ? 'bg-[#0E1033] text-white font-bold' : 'bg-white border border-[#E4E2EF] text-[#0E1033] font-semibold hover:border-[#935DFF]'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#E5484D]" />
                    Urgentes (1h) · {urgentesCount}
                  </button>
                </div>
              )}
            </div>

            {/* Lista da aba selecionada */}
            {loading ? (
              <div className="bg-white rounded-2xl p-8 text-center text-[#5B5E7A] text-sm border border-[#E4E2EF]">
                Carregando...
              </div>
            ) : (
              <div className="space-y-3">
                {abaSelecionadaLojista === 'aberto' && (
                  filteredOrders.length === 0
                    ? renderVazio('Nenhuma cotação disponível agora para as suas categorias. Avisamos com som quando chegar uma nova.')
                    : <>
                      {paginatedAbertas.map((order) => renderCotacaoAberta(order))}
                      {renderPaginacao(paginaAbertas, totalPaginasAbertas, setPaginaAbertas)}
                    </>
                )}

                {abaSelecionadaLojista === 'enviadas' && (
                  enviadasOrdenadas.length === 0
                    ? renderVazio('Nenhuma proposta aguardando resposta do cliente.', 'enviar')
                    : <>
                      {paginatedEnviadas.map((bid) => renderPropostaRow(bid, 'enviadas'))}
                      {renderPaginacao(paginaEnviadas, totalPaginasEnviadas, setPaginaEnviadas)}
                    </>
                )}

                {abaSelecionadaLojista === 'confirmadas' && (
                  acceptedBidsOrdenados.length === 0
                    ? renderVazio('Nenhuma venda confirmada ainda.', 'check')
                    : <>
                      {paginatedFechadas.map((bid) => renderPropostaRow(bid, 'confirmadas'))}
                      {renderPaginacao(paginaFechadas, totalPaginasFechadas, setPaginaFechadas)}
                    </>
                )}

                {abaSelecionadaLojista === 'encerradas' && (
                  encerradasOrdenadas.length === 0
                    ? renderVazio('Nenhuma cotação perdida por aqui.', 'trofeu')
                    : <>
                      {paginatedEncerradas.map((bid) => renderPropostaRow(bid, 'encerradas'))}
                      {renderPaginacao(paginaEncerradas, totalPaginasEncerradas, setPaginaEncerradas)}
                    </>
                )}
              </div>
            )}
          </div>

          {/* Coluna lateral: plano e avaliações */}
          <aside className="space-y-4">
            {planoAtual && (
              <section aria-label="Seu plano" className="bg-white border border-[#E4E2EF] rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold">Seu plano</h2>
                  <span className="h-7 px-3 rounded-full bg-[#EFE9FF] text-[#3C0DA8] text-xs font-bold inline-flex items-center">
                    {NOME_PLANO[planoAtual] || planoAtual}
                  </span>
                </div>
                <ul className="space-y-2 text-sm">
                  {(planoAtual === 'basico'
                    ? [`Até ${limiteDiarioBasico} propostas por dia`, 'Foto do produto na proposta', 'Contato do cliente pelo WhatsApp']
                    : planoAtual === 'pro'
                      ? ['Propostas sem limite por dia', 'Faixa de preço com várias opções', 'Oferecer cashback']
                      : ['Loja patrocinada no topo', 'Nome e logo à mostra para o cliente', 'Ver o preço de quem venceu', 'Aceitar cashback como pagamento']
                  ).map(texto => (
                    <li key={texto} className="flex gap-2.5 items-center">
                      <Icone nome="check" tamanho={18} className="text-[#0E7A4E]" /> {texto}
                    </li>
                  ))}
                </ul>
                {planoAtual !== 'premium' && (
                  <div className="bg-[#F7F3FF] border border-[#D9C8FF] rounded-2xl p-3.5 space-y-2.5">
                    <p className="text-sm font-bold flex items-center gap-2">
                      <Icone nome="estrela" tamanho={16} preenchido className="text-[#5E17EB]" />
                      {planoAtual === 'basico' ? 'Pro' : 'Premium'}
                    </p>
                    <p className="text-[13px] text-[#5B5E7A]">
                      {planoAtual === 'basico'
                        ? 'Responda sem limite, mande faixa de preço com várias opções e ofereça cashback.'
                        : 'Sua loja aparece no topo como patrocinada, com nome e logo à mostra, e você vê o preço de quem venceu.'}
                    </p>
                    <a
                      href={LINK_FALAR_COM_NUNO}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center min-h-[44px] rounded-xl bg-[#5E17EB] hover:bg-[#3C0DA8] text-white text-sm font-bold transition"
                    >
                      Quero o {planoAtual === 'basico' ? 'Pro' : 'Premium'}
                    </a>
                  </div>
                )}
              </section>
            )}

            <section aria-label="Minhas avaliações" className="bg-white border border-[#E4E2EF] rounded-2xl p-4 sm:p-5 space-y-3">
              <h2 className="text-base font-bold">Minhas avaliações</h2>
              <div className="flex items-center gap-3">
                <p style={FONTE_TITULO} className="text-[34px] font-bold tracking-tight leading-none">{numeroBr(reputacaoMedia)}</p>
                <div>
                  {renderEstrelas(reputacaoMedia)}
                  <p className="text-[13px] text-[#5B5E7A] mt-0.5">
                    {profile?.total_avaliacoes || 0} avaliações
                    {profile?.percentual_entrega_no_prazo != null && ` · ${profile.percentual_entrega_no_prazo}% no prazo`}
                  </p>
                </div>
              </div>
              {ultimasAvaliacoes.length > 0 ? (
                <div className="border-t border-[#E4E2EF] pt-3 space-y-3">
                  {ultimasAvaliacoes.map(av => (
                    <div key={av.id}>
                      <p className="text-[13px] font-bold text-[#5E17EB]">
                        {av.nota} {av.nota === 1 ? 'estrela' : 'estrelas'}
                        <span className="text-[#5B5E7A] font-semibold"> · {new Date(av.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                      </p>
                      {av.comentario && <p className="text-[13px] text-[#0E1033] line-clamp-2">{av.comentario}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-[#5B5E7A]">Você ainda não recebeu avaliações. Elas aparecem aqui depois das entregas.</p>
              )}
              {minhasAvaliacoes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMostrarTodasAvaliacoes(true)}
                  className="w-full h-11 rounded-xl border border-[#E4E2EF] text-sm font-bold text-[#0E1033] hover:bg-[#F5F4FA] transition"
                >
                  Ver todas ({minhasAvaliacoes.length})
                </button>
              )}
            </section>
          </aside>
        </div>
      </main>

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

      {/* ============ Detalhe da proposta (Enviadas / Confirmadas / Encerradas) ============ */}
      {detalheBidAberto && (() => {
        const bid = detalheBidAberto;
        const pedido = bid.pedido || {};
        const orderIdNum = Number(bid.order_id || bid.pedido_id);
        const fechadoComOutro = ordersFechadosComOutro.has(orderIdNum);
        const ehVenda = bid.status === 'Aceito';
        const fechar = () => setDetalheBidAberto(null);
        const cliente = pedido.cliente || {};

        return (
          <div className="fixed inset-0 z-[60] bg-[#0E1033]/60 backdrop-blur-sm flex sm:items-center justify-center sm:p-4" onClick={fechar}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`${ehVenda ? 'Venda' : 'Proposta'} do pedido ${pedido.codigo_pedido || pedido.id}`}
              className="bg-[#F5F4FA] w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-3xl overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 bg-white border-b border-[#E4E2EF] flex items-center gap-1 px-2 sm:px-4 h-14">
                <button type="button" onClick={fechar} aria-label="Voltar" className="sm:hidden w-11 h-11 rounded-xl flex items-center justify-center">
                  <Icone nome="esquerda" tamanho={22} strokeWidth={2.2} />
                </button>
                <span className="flex-1 font-bold text-base sm:pl-1">{ehVenda ? 'Venda' : 'Pedido'} #{pedido.codigo_pedido || pedido.id}</span>
                <button type="button" onClick={fechar} aria-label="Fechar" className="hidden sm:flex w-11 h-11 rounded-xl text-[#5B5E7A] hover:bg-[#F5F4FA] items-center justify-center">
                  <Icone nome="fechar" tamanho={20} />
                </button>
              </div>

              <div className="p-4 sm:p-5 space-y-3.5">
                {/* Topo colorido com a situação */}
                <section className={`rounded-2xl p-4 sm:p-5 space-y-3 ${
                  ehVenda ? 'bg-[#0E7A4E] text-white' : fechadoComOutro ? 'bg-white border border-[#E4E2EF]' : 'bg-[#FFF3D6] text-[#0E1033]'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      ehVenda ? 'bg-white/15' : fechadoComOutro ? 'bg-[#FDECEC] text-[#C53036]' : 'bg-white text-[#8A5A00]'
                    }`}>
                      <Icone nome={ehVenda ? 'check' : fechadoComOutro ? 'cadeado' : 'relogio'} tamanho={22} />
                    </span>
                    <div>
                      <p className="font-bold text-base">
                        {ehVenda ? 'Venda confirmada' : fechadoComOutro ? 'Outro lojista venceu' : 'Aguardando o cliente'}
                      </p>
                      <p className={`text-[13px] ${ehVenda ? 'text-[#CDEBDC]' : 'text-[#5B5E7A]'}`}>
                        {ehVenda
                          ? `O cliente escolheu sua proposta ${tempoRelativo(bid.accepted_at || bid.created_at)}`
                          : fechadoComOutro
                            ? 'O cliente fechou com outra loja.'
                            : 'Sua proposta foi enviada e não pode mais ser editada.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-xs ${ehVenda ? 'text-[#CDEBDC]' : 'text-[#5B5E7A]'}`}>{pedido.descricao}</p>
                      <p style={FONTE_TITULO} className="text-[30px] font-bold tracking-tight leading-tight">{brl(totalDaProposta(bid))}</p>
                    </div>
                    {bid.prazo_entrega && (
                      <span className={`shrink-0 h-7 px-2.5 rounded-full text-xs font-bold inline-flex items-center ${ehVenda ? 'bg-white text-[#0E7A4E]' : 'bg-white text-[#5B5E7A] border border-[#E4E2EF]'}`}>
                        {labelPrazoEntrega(bid.prazo_entrega)}
                      </span>
                    )}
                  </div>
                </section>

                {/* Venda: cliente, WhatsApp e entrega */}
                {ehVenda && (
                  <section className="bg-white border border-[#E4E2EF] rounded-2xl p-4 space-y-3.5">
                    <h3 className="text-xs font-bold text-[#5B5E7A] uppercase tracking-wide">Cliente</h3>
                    <div className="flex items-center gap-3">
                      <span className="w-12 h-12 rounded-full bg-[#EFE9FF] text-[#3C0DA8] font-bold flex items-center justify-center shrink-0">{iniciaisDe(cliente.nome || 'Cliente')}</span>
                      <div className="min-w-0">
                        <p className="font-bold text-base truncate">{cliente.nome || 'Cliente'}</p>
                        <p className="text-[13px] text-[#5B5E7A] flex items-center gap-1.5">
                          <Icone nome="telefone" tamanho={13} /> {cliente.telefone || 'Telefone não informado'}
                        </p>
                      </div>
                    </div>
                    {(pedido.tipo_recebimento || pedido.bairro) && (
                      <p className="flex gap-2.5 items-center text-sm bg-[#F5F4FA] rounded-xl px-3 py-2.5">
                        <Icone nome={pedido.tipo_recebimento === 'retirada' ? 'loja' : 'caminhao'} tamanho={18} className="text-[#5B5E7A]" />
                        <span>
                          {pedido.tipo_recebimento && (LABEL_TIPO_RECEBIMENTO[pedido.tipo_recebimento] || pedido.tipo_recebimento).replace(' (ver as duas)', '')}
                          {pedido.bairro && <> · bairro <b>{pedido.bairro}</b></>}
                        </span>
                      </p>
                    )}
                    {cliente.telefone && (
                      <>
                        <a
                          href={`https://wa.me/55${cliente.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(
                            `Olá, ${cliente.nome || 'tudo bem'}! Sou da ${profile?.nome || 'loja'} e recebi a confirmação do seu pedido pelo Nuno. Segue o resumo:\n\n${montarResumoPedido(bid)}`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-2.5 min-h-[52px] rounded-2xl bg-[#0E7A4E] hover:bg-[#0B6340] text-white text-base font-bold transition"
                        >
                          <Icone nome="mensagem" tamanho={20} /> Chamar no WhatsApp
                        </a>
                        <p className="text-xs text-[#5B5E7A] text-center -mt-1.5">A mensagem já vai com o resumo do pedido</p>
                      </>
                    )}
                  </section>
                )}

                {renderDetalhesProposta(bid)}

                {ehVenda && (
                  bid.entregue_em ? (
                    <p className="flex items-center justify-center gap-2 min-h-[52px] rounded-2xl bg-[#E3F5EC] text-[#0E7A4E] text-sm font-bold">
                      <Icone nome="check" tamanho={18} /> Entregue em {new Date(bid.entregue_em).toLocaleDateString('pt-BR')}
                    </p>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleMarcarEntregue(bid)}
                        className="w-full flex items-center justify-center gap-2.5 min-h-[52px] rounded-2xl bg-[#0E1033] hover:bg-black text-white text-base font-bold transition"
                      >
                        <Icone nome="caixa" tamanho={20} /> Cliente comprou e recebeu
                      </button>
                      <p className="text-xs text-[#5B5E7A] text-center -mt-1.5">Toque depois de entregar. O cliente recebe o pedido de avaliação.</p>
                    </>
                  )
                )}

                {/* Encerradas: ranking dos concorrentes (Premium) ou convite */}
                {!ehVenda && fechadoComOutro && (
                  planoAtual === 'premium' ? (
                    <section className="bg-white border border-[#E4E2EF] rounded-2xl p-4 space-y-3">
                      <button
                        type="button"
                        onClick={() => handleVerRankingConcorrentes(bid)}
                        className="w-full flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-[#EFE9FF] text-[#3C0DA8] text-sm font-bold"
                      >
                        <Icone nome="trofeu" tamanho={18} />
                        {rankingAbertoBidId === bid.id ? 'Ocultar ranking' : 'Ver preço de quem venceu'}
                      </button>
                      {rankingAbertoBidId === bid.id && (
                        carregandoRanking ? (
                          <p className="text-sm text-[#8B88A6] text-center">Carregando ranking...</p>
                        ) : (
                          <div className="space-y-2">
                            {rankingConcorrentes.map((item) => (
                              <div
                                key={item.bidId}
                                className={`rounded-xl border p-3 text-sm ${item.souEu ? 'border-[#935DFF] bg-[#F7F3FF]' : 'border-[#E4E2EF] bg-white'}`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold">
                                    {item.semEstoque
                                      ? `Sem estoque · ${item.souEu ? 'você' : 'concorrente'}`
                                      : `${item.posicao}º · ${item.souEu ? 'você' : 'concorrente'}`}
                                  </span>
                                  {!item.semEstoque && <span className="font-bold">{brl(item.total)}</span>}
                                </div>
                                <p className="text-xs text-[#5B5E7A] mt-0.5">
                                  {[
                                    !item.semEstoque && item.frete === 0 ? 'Frete grátis' : null,
                                    !item.semEstoque && item.retirada ? 'Retirada disponível' : null,
                                    item.tempoResposta && item.tempoResposta !== 'Não disponível' ? `Respondeu em ${item.tempoResposta}` : null,
                                    item.formasPagamento.length > 0 ? item.formasPagamento.join(', ') : 'Pagamento não informado',
                                  ].filter(Boolean).join(' · ')}
                                </p>
                              </div>
                            ))}
                            <p className="text-xs text-[#8B88A6] text-center">Nomes e telefones das lojas concorrentes não são revelados.</p>
                          </div>
                        )
                      )}
                    </section>
                  ) : (
                    <section className="bg-[#F7F3FF] border border-[#D9C8FF] rounded-2xl p-4 space-y-2">
                      <p className="text-sm font-bold flex items-center gap-2"><Icone nome="trofeu" tamanho={18} className="text-[#5E17EB]" /> Quer saber o preço de quem venceu?</p>
                      <p className="text-[13px] text-[#5B5E7A]">No plano Premium você vê o ranking das propostas (sem os nomes das lojas).</p>
                      <a href={LINK_FALAR_COM_NUNO} target="_blank" rel="noreferrer" className="inline-flex items-center min-h-[44px] text-sm font-bold text-[#5E17EB]">
                        Quero o Premium <Icone nome="direita" tamanho={16} strokeWidth={2.2} />
                      </a>
                    </section>
                  )
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ================================ Enviar orçamento ================================ */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[60] bg-[#0E1033]/60 backdrop-blur-sm flex sm:items-center justify-center sm:p-4">
          <form
            onSubmit={handleSendBid}
            className="relative bg-[#F5F4FA] w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-3xl overflow-y-auto overflow-x-hidden shadow-2xl"
          >
            <div className="sticky top-0 z-10 bg-white border-b border-[#E4E2EF] flex items-center gap-1 px-2 sm:px-4 h-16">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                aria-label="Fechar sem enviar"
                className="w-11 h-11 rounded-xl text-[#0E1033] hover:bg-[#F5F4FA] flex items-center justify-center shrink-0"
              >
                <Icone nome="fechar" tamanho={22} strokeWidth={2.2} />
              </button>
              <div className="min-w-0">
                <p className="font-bold text-base leading-tight">Enviar orçamento</p>
                <p className="text-xs text-[#5B5E7A]">Pedido #{selectedOrder.codigo_pedido || selectedOrder.id}</p>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-5">
              {/* Resumo do pedido */}
              <section className="bg-white border border-[#E4E2EF] rounded-2xl p-4 space-y-3">
                <h2 style={FONTE_TITULO} className="text-[22px] font-bold leading-tight tracking-tight break-words">{selectedOrder.descricao}</h2>
                <p className="text-[13px] text-[#5B5E7A]">
                  {[orderItems.length === 1 ? `${orderItems[0]?.quantidade || 1} unidade(s)` : `${orderItems.length} itens`, selectedOrder.bairro, selectedOrder.cidade_nome_exibicao].filter(Boolean).join(' · ')}
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {(() => {
                    const t = getRemainingTime(selectedOrder);
                    return renderChip(t.texto, t.pausado ? 'bg-[#E7EEFF] text-[#1D4ED8]' : 'bg-[#FFF3D6] text-[#8A5A00]', t.pausado ? 'pausa' : 'relogio');
                  })()}
                  {reputacaoClientesPorPedido[selectedOrder.id] && renderChip(
                    `Cliente ${numeroBr(reputacaoClientesPorPedido[selectedOrder.id].reputacao_media)}`,
                    Number(reputacaoClientesPorPedido[selectedOrder.id].reputacao_media) < 4 ? 'bg-[#FDECEC] text-[#C53036]' : 'bg-[#E3F5EC] text-[#0E7A4E]',
                    'estrela',
                    true
                  )}
                  {(contagemPropostasPorPedido[selectedOrder.id] || 0) > 0 && renderChip(
                    `${contagemPropostasPorPedido[selectedOrder.id]} ${contagemPropostasPorPedido[selectedOrder.id] === 1 ? 'concorrente respondeu' : 'concorrentes responderam'}`,
                    'bg-[#E7EEFF] text-[#1D4ED8]'
                  )}
                </div>
                <p className="flex gap-2.5 items-center text-sm bg-[#F5F4FA] rounded-xl px-3 py-2.5">
                  <Icone nome={(selectedOrder.tipo_recebimento || 'ambos') === 'retirada' ? 'loja' : 'caminhao'} tamanho={18} className="text-[#5B5E7A]" />
                  <span>O cliente quer: <b>{(LABEL_TIPO_RECEBIMENTO[selectedOrder.tipo_recebimento || 'ambos'] || '').replace(' (ver as duas)', '').toLowerCase()}</b></span>
                </p>
              </section>

              {/* 1 · Produto */}
              <section className="space-y-2.5">
                <h3 className="text-xs font-bold text-[#5B5E7A] uppercase tracking-wide">1 · Produto</h3>
                {orderItems.map((oItem, idx) => {
                  const itemUnicoComOpcoes = idx === 0 && orderItems.length === 1 && ehProOuPremium;
                  const precoUnit = parseFloat(bidItemsData[idx]?.preco_unitario || 0);
                  return (
                    <div key={oItem.id} className="bg-white border border-[#E4E2EF] rounded-2xl p-4 space-y-3.5">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-[15px] break-words">{orderItems.length === 1 && itemUnicoComOpcoes && opcoesExtras.length > 0 ? 'Opção 1' : oItem.descricao}</p>
                          <p className="text-[13px] text-[#5B5E7A]">Quantidade: {oItem.quantidade}</p>
                        </div>
                        {oItem.imagem_url && (
                          <button type="button" onClick={() => setActiveImage(oItem.imagem_url)} className="shrink-0 text-center" aria-label="Ver foto do cliente">
                            <img src={oItem.imagem_url} alt="Foto do cliente" className="w-14 h-14 object-cover rounded-xl border border-[#E4E2EF]" />
                            <span className="block text-[10px] text-[#8B88A6] font-semibold mt-0.5">do cliente</span>
                          </button>
                        )}
                      </div>

                      {renderInterruptor({
                        checked: Boolean(bidItemsData[idx]?.atendido),
                        onChange: (v) => handleBidItemChange(idx, 'atendido', v),
                        rotulo: bidItemsData[idx]?.atendido ? 'Tenho em estoque' : 'Sem estoque deste item',
                      })}

                      {bidItemsData[idx]?.atendido && (
                        <div className="space-y-3.5 pt-1">
                          {itemUnicoComOpcoes && (
                            <label className="block">
                              <span className={CLASSE_ROTULO}>Nome do produto (opcional)</span>
                              <input
                                type="text"
                                placeholder="Ex: capa dura"
                                value={bidItemsData[idx]?.nome_opcao}
                                onChange={(e) => handleBidItemChange(idx, 'nome_opcao', e.target.value)}
                                className={CLASSE_ENTRADA}
                              />
                            </label>
                          )}
                          <label className="block">
                            <span className={CLASSE_ROTULO}>Preço por unidade</span>
                            <span className="flex items-center gap-2 h-12 px-3.5 rounded-xl border-2 border-[#E4E2EF] bg-white focus-within:border-[#5E17EB] transition">
                              <span className="text-[#5B5E7A] font-semibold">R$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                inputMode="decimal"
                                required
                                value={bidItemsData[idx]?.preco_unitario}
                                onChange={(e) => handleBidItemChange(idx, 'preco_unitario', e.target.value)}
                                placeholder="0,00"
                                className="flex-1 min-w-0 bg-transparent border-none outline-none text-[17px] font-bold text-[#0E1033]"
                              />
                            </span>
                            {precoUnit > 0 && (
                              <span className="block text-[13px] text-[#5B5E7A] mt-1.5">
                                {oItem.quantidade} × {brl(precoUnit)} = <b className="text-[#0E1033]">{brl(precoUnit * (oItem.quantidade || 1))}</b>
                              </span>
                            )}
                          </label>
                          <div>
                            <span className={CLASSE_ROTULO}>Foto do produto (opcional)</span>
                            {renderEnvioFoto({
                              url: bidItemsData[idx]?.imagem_url,
                              enviando: uploadingImageIndex === idx,
                              onArquivo: (arquivo) => handleLojistaImage(idx, arquivo),
                            })}
                          </div>
                          {itemUnicoComOpcoes && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <label className="block">
                                <span className={CLASSE_ROTULO}>Garantia (opcional)</span>
                                <input type="text" placeholder="Ex: 3 meses" value={bidItemsData[idx]?.garantia_opcao} onChange={(e) => handleBidItemChange(idx, 'garantia_opcao', e.target.value)} className={CLASSE_ENTRADA} />
                              </label>
                              <label className="block">
                                <span className={CLASSE_ROTULO}>Observação (opcional)</span>
                                <input type="text" placeholder="Ex: cor azul" value={bidItemsData[idx]?.observacao_opcao} onChange={(e) => handleBidItemChange(idx, 'observacao_opcao', e.target.value)} className={CLASSE_ENTRADA} />
                              </label>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Faixa de preço: opções extras pro item único (Pro/Premium) */}
                {orderItems.length === 1 && bidItemsData[0]?.atendido && ehProOuPremium && (
                  <>
                    {opcoesExtras.map((op, opIdx) => (
                      <div key={opIdx} className="bg-white border border-[#D9C8FF] rounded-2xl p-4 space-y-3.5">
                        <div className="flex justify-between items-center">
                          <p className="font-bold text-[15px]">Opção {opIdx + 2}</p>
                          <button type="button" onClick={() => handleRemoverOpcaoExtra(opIdx)} className="min-h-[40px] px-3 rounded-xl text-sm font-bold text-[#C53036] hover:bg-[#FDECEC]">
                            Remover
                          </button>
                        </div>
                        <div className="grid grid-cols-[1.3fr_1fr] gap-3">
                          <label className="block">
                            <span className={CLASSE_ROTULO}>Nome</span>
                            <input type="text" placeholder="Ex: capa dura" value={op.nome_opcao} onChange={(e) => handleOpcaoExtraChange(opIdx, 'nome_opcao', e.target.value)} className={CLASSE_ENTRADA} />
                          </label>
                          <label className="block">
                            <span className={CLASSE_ROTULO}>Preço/un. (R$)</span>
                            <input type="number" step="0.01" min="0" inputMode="decimal" required placeholder="0,00" value={op.preco_unitario} onChange={(e) => handleOpcaoExtraChange(opIdx, 'preco_unitario', e.target.value)} className={CLASSE_ENTRADA} />
                          </label>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className="block">
                            <span className={CLASSE_ROTULO}>Garantia (opcional)</span>
                            <input type="text" value={op.garantia_opcao} onChange={(e) => handleOpcaoExtraChange(opIdx, 'garantia_opcao', e.target.value)} className={CLASSE_ENTRADA} />
                          </label>
                          <label className="block">
                            <span className={CLASSE_ROTULO}>Observação (opcional)</span>
                            <input type="text" value={op.observacao_opcao} onChange={(e) => handleOpcaoExtraChange(opIdx, 'observacao_opcao', e.target.value)} className={CLASSE_ENTRADA} />
                          </label>
                        </div>
                        {renderEnvioFoto({
                          url: op.imagem_url,
                          enviando: uploadingOpcaoIndex === opIdx,
                          onArquivo: (arquivo) => handleOpcaoExtraImagem(opIdx, arquivo),
                        })}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={handleAdicionarOpcaoExtra}
                      className="w-full flex items-center justify-center gap-2 h-[50px] rounded-2xl border-[1.5px] border-dashed border-[#C9C6E0] text-sm font-bold text-[#0E1033] hover:border-[#935DFF] hover:bg-white transition"
                    >
                      <Icone nome="mais" tamanho={18} strokeWidth={2.4} /> Adicionar outra opção de preço
                    </button>
                    {previa?.maximo != null && (
                      <p className="text-xs text-[#5B5E7A] text-center">O cliente vê a faixa: {brl(previa.minimo)} a {brl(previa.maximo)}</p>
                    )}
                  </>
                )}
              </section>

              {/* 2 · Entrega */}
              <section className="space-y-2.5">
                <h3 className="text-xs font-bold text-[#5B5E7A] uppercase tracking-wide">2 · Entrega</h3>
                <div className="bg-white border border-[#E4E2EF] rounded-2xl p-4 space-y-3.5">
                  {(selectedOrder.tipo_recebimento || 'ambos') === 'retirada' ? (
                    <p className="flex items-center gap-2.5 text-sm bg-[#E7EEFF] text-[#1D4ED8] rounded-xl px-3 py-2.5 font-semibold">
                      <Icone nome="loja" tamanho={18} /> Pedido para retirada na loja, sem frete.
                    </p>
                  ) : (
                    <>
                      <label className="block">
                        <span className={CLASSE_ROTULO}>Valor do frete</span>
                        <span className="flex items-center gap-2 h-12 px-3.5 rounded-xl border border-[#E4E2EF] bg-white focus-within:border-[#5E17EB] focus-within:ring-2 focus-within:ring-[#5E17EB]/20 transition">
                          <span className="text-[#5B5E7A] font-semibold">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            inputMode="decimal"
                            value={frete}
                            onChange={(e) => setFrete(e.target.value)}
                            placeholder="0,00"
                            className="flex-1 min-w-0 bg-transparent border-none outline-none text-[15px] text-[#0E1033]"
                          />
                          {parseFloat(frete || 0) === 0 && (
                            <span className="h-6 px-2.5 rounded-full bg-[#E3F5EC] text-[#0E7A4E] text-xs font-bold inline-flex items-center">Grátis</span>
                          )}
                        </span>
                        <span className="block text-xs text-[#5B5E7A] mt-1">Deixe em branco ou 0 se a entrega for grátis.</span>
                      </label>
                      {(selectedOrder.tipo_recebimento || 'ambos') === 'ambos' && renderInterruptor({
                        checked: retiradaDisponivel,
                        onChange: setRetiradaDisponivel,
                        rotulo: 'Cliente também pode retirar na loja',
                        icone: 'loja',
                      })}
                    </>
                  )}

                  <div>
                    <span className={CLASSE_ROTULO}>Prazo de entrega</span>
                    <div role="radiogroup" aria-label="Prazo de entrega" className="grid grid-cols-2 gap-2">
                      {OPCOES_PRAZO_ENTREGA.map(op => {
                        const ativo = prazoEntrega === op.value;
                        return (
                          <button
                            key={op.value}
                            type="button"
                            role="radio"
                            aria-checked={ativo}
                            onClick={() => setPrazoEntrega(ativo ? '' : op.value)}
                            className={`h-12 rounded-xl text-sm transition ${
                              ativo ? 'border-2 border-[#5E17EB] bg-[#EFE9FF] text-[#3C0DA8] font-bold' : 'border border-[#E4E2EF] bg-white text-[#0E1033] font-semibold hover:border-[#935DFF]'
                            }`}
                          >
                            {op.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>

              {/* 3 · Pagamento */}
              <section className="space-y-2.5">
                <h3 className="text-xs font-bold text-[#5B5E7A] uppercase tracking-wide">3 · Pagamento</h3>
                <div className="bg-white border border-[#E4E2EF] rounded-2xl p-4 space-y-3.5">
                  <div role="group" aria-label="Formas de pagamento aceitas" className="flex flex-wrap gap-2">
                    {OPCOES_PAGAMENTO.map(op => {
                      const ativo = formasPagamento.includes(op.value);
                      return (
                        <button
                          key={op.value}
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => toggleFormaPagamento(op.value)}
                          className={`inline-flex items-center gap-1.5 h-11 px-4 rounded-xl text-sm transition ${
                            ativo ? 'border-2 border-[#5E17EB] bg-[#EFE9FF] text-[#3C0DA8] font-bold' : 'border border-[#E4E2EF] bg-white text-[#0E1033] font-semibold hover:border-[#935DFF]'
                          }`}
                        >
                          {ativo && <Icone nome="marcado" tamanho={16} strokeWidth={2.4} />}
                          {labelPagamento(op.value)}
                        </button>
                      );
                    })}
                  </div>
                  {formasPagamento.includes('faturado') && (
                    <p className="text-xs text-[#5B5E7A]">Faturado: você aprova o cadastro do cliente antes de vender a prazo.</p>
                  )}
                  {formasPagamento.includes('cartao') && (
                    <div className="flex items-center justify-between gap-3 bg-[#F5F4FA] rounded-xl py-2 pl-3.5 pr-2">
                      <span className="text-sm font-semibold">Cartão sem juros em até</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label="Menos parcelas"
                          onClick={() => setParcelasSemJuros(nParcelas <= 2 ? '' : String(nParcelas - 1))}
                          className="w-11 h-11 rounded-xl border border-[#E4E2EF] bg-white flex items-center justify-center text-[#0E1033] disabled:opacity-40"
                          disabled={nParcelas <= 1}
                        >
                          <Icone nome="menos" tamanho={18} strokeWidth={2.4} />
                        </button>
                        <span className="min-w-[40px] text-center font-bold text-base" aria-live="polite">{nParcelas}x</span>
                        <button
                          type="button"
                          aria-label="Mais parcelas"
                          onClick={() => setParcelasSemJuros(String(Math.min(24, nParcelas + 1)))}
                          className="w-11 h-11 rounded-xl border border-[#E4E2EF] bg-white flex items-center justify-center text-[#0E1033]"
                        >
                          <Icone nome="mais" tamanho={18} strokeWidth={2.4} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* 4 · Detalhes */}
              <section className="space-y-2.5">
                <h3 className="text-xs font-bold text-[#5B5E7A] uppercase tracking-wide">4 · Detalhes (opcional)</h3>
                <div className="bg-white border border-[#E4E2EF] rounded-2xl p-4 space-y-3.5">
                  <label className="block">
                    <span className={CLASSE_ROTULO}>Garantia</span>
                    <input type="text" placeholder="Ex: 3 meses, 1 ano..." value={garantia} onChange={(e) => setGarantia(e.target.value)} className={CLASSE_ENTRADA} />
                  </label>
                  <label className="block">
                    <span className={CLASSE_ROTULO}>Observações para o cliente</span>
                    <textarea
                      rows={3}
                      placeholder="Ex: marcas e cores disponíveis"
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value)}
                      className="w-full px-3.5 py-3 rounded-xl border border-[#E4E2EF] bg-white text-[15px] text-[#0E1033] placeholder-[#8B88A6] resize-none focus:outline-none focus:border-[#5E17EB] focus:ring-2 focus:ring-[#5E17EB]/20 transition"
                    />
                  </label>

                  {cashbackAtivo && ehProOuPremium && (
                    <div className="border border-[#F3DFA8] bg-[#FFFBF0] rounded-2xl px-3.5 py-2 space-y-1">
                      {renderInterruptor({
                        checked: ofereceCashback,
                        onChange: setOfereceCashback,
                        rotulo: 'Oferecer cashback nesta venda',
                        icone: 'presente',
                        corLigado: '#8A5A00',
                        classeTexto: 'text-[#8A5A00]',
                      })}
                      {ofereceCashback && (
                        <label className="block pb-2">
                          <span className="sr-only">Valor do cashback</span>
                          <span className="flex items-center gap-2 h-12 px-3.5 rounded-xl border border-[#F3DFA8] bg-white">
                            <span className="text-[#5B5E7A] font-semibold">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              inputMode="decimal"
                              placeholder="Valor do cashback"
                              value={valorCashbackOferecido}
                              onChange={(e) => setValorCashbackOferecido(e.target.value)}
                              className="flex-1 min-w-0 bg-transparent border-none outline-none text-[15px] text-[#0E1033]"
                            />
                          </span>
                        </label>
                      )}
                      {planoAtual === 'premium' && renderInterruptor({
                        checked: aceitaCashback,
                        onChange: setAceitaCashback,
                        rotulo: 'Aceito cashback como parte do pagamento',
                        icone: 'carteira',
                        corLigado: '#8A5A00',
                        classeTexto: 'text-[#8A5A00]',
                      })}
                    </div>
                  )}
                </div>
              </section>

              {atingiuLimiteBasico && (
                <p className="flex items-start gap-2 p-3 rounded-xl bg-[#FDECEC] text-[#C53036] text-sm font-semibold">
                  <Icone nome="alerta" tamanho={18} className="mt-0.5" />
                  Você usou suas {limiteDiarioBasico} propostas de hoje (plano Básico). Vire Pro para responder sem limite.
                </p>
              )}
            </div>

            {/* Rodapé fixo com o total e o botão de enviar */}
            <div className="sticky bottom-0 bg-white border-t border-[#E4E2EF] px-4 sm:px-6 pt-3 pb-4 flex items-center gap-3 shadow-[0_-8px_24px_rgba(14,16,51,0.06)]">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#5B5E7A]">Total da proposta</p>
                <p style={FONTE_TITULO} className="text-xl font-bold tracking-tight leading-tight">
                  {brl((previa?.minimo || 0) + (previa?.valorFrete || 0))}
                  {previa?.maximo != null && (
                    <span style={FONTE_TEXTO} className="text-[13px] font-semibold text-[#5B5E7A] tracking-normal"> a {brl(previa.maximo + previa.valorFrete)}</span>
                  )}
                </p>
                <p className={`text-xs font-bold ${previa?.tipo === 'retirada' || (previa?.valorFrete || 0) === 0 ? 'text-[#0E7A4E]' : 'text-[#5B5E7A]'}`}>
                  {previa?.tipo === 'retirada' ? 'Retirada na loja' : (previa?.valorFrete || 0) === 0 ? 'Entrega grátis' : `Inclui frete de ${brl(previa.valorFrete)}`}
                </p>
              </div>
              <button
                type="submit"
                disabled={atingiuLimiteBasico || uploadingImageIndex !== null || uploadingOpcaoIndex !== null}
                className="shrink-0 inline-flex items-center gap-2 h-[52px] px-5 sm:px-6 rounded-2xl bg-[#5E17EB] hover:bg-[#3C0DA8] disabled:opacity-50 disabled:cursor-not-allowed text-white text-base font-bold transition"
              >
                <Icone nome="enviar" tamanho={18} /> Enviar orçamento
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Todas as avaliações */}
      {mostrarTodasAvaliacoes && (
        <div className="fixed inset-0 z-[60] bg-[#0E1033]/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setMostrarTodasAvaliacoes(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Minhas avaliações"
            className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 style={FONTE_TITULO} className="text-xl font-bold">Minhas avaliações ({minhasAvaliacoes.length})</h3>
              <button type="button" onClick={() => setMostrarTodasAvaliacoes(false)} aria-label="Fechar" className="w-11 h-11 rounded-xl text-[#5B5E7A] hover:bg-[#F5F4FA] flex items-center justify-center">
                <Icone nome="fechar" tamanho={20} />
              </button>
            </div>
            {minhasAvaliacoes.length === 0 ? (
              <p className="text-sm text-[#5B5E7A] text-center py-4">Você ainda não recebeu avaliações.</p>
            ) : (
              <div className="divide-y divide-[#E4E2EF] border border-[#E4E2EF] rounded-2xl">
                {minhasAvaliacoes.map((av) => (
                  <div key={av.id} className={`p-3.5 flex items-start justify-between gap-3 ${av.desconsiderada ? 'opacity-60' : ''}`}>
                    <div className="min-w-0">
                      {renderEstrelas(av.nota, 15)}
                      {av.comentario && <p className="text-sm text-[#0E1033] mt-1">{av.comentario}</p>}
                      <p className="text-xs text-[#8B88A6] mt-1">
                        {new Date(av.criado_em).toLocaleDateString('pt-BR')}
                        {av.desconsiderada && ' · Desconsiderada pelo administrador'}
                        {av.contestada && !av.desconsiderada && ' · Contestação em análise'}
                      </p>
                    </div>
                    {!av.contestada && !av.desconsiderada && (
                      <button
                        type="button"
                        onClick={() => handleContestarAvaliacao(av.id)}
                        className="shrink-0 min-h-[40px] px-3 rounded-xl text-sm font-bold text-[#C53036] hover:bg-[#FDECEC]"
                      >
                        Contestar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Foto ampliada */}
      {activeImage && (
        <div className="fixed inset-0 z-[100] bg-[#0E1033]/85 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setActiveImage(null)}>
          <div className="relative max-w-3xl max-h-[90vh] bg-white rounded-3xl overflow-hidden shadow-2xl p-2 flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setActiveImage(null)}
              aria-label="Fechar foto"
              className="absolute top-3 right-3 bg-[#0E1033] text-white w-11 h-11 rounded-full flex items-center justify-center hover:bg-black transition shadow-md z-10"
            >
              <Icone nome="fechar" tamanho={20} />
            </button>
            <img src={activeImage} alt="Visualização ampliada" className="max-w-full max-h-[80vh] object-contain rounded-2xl" />
          </div>
        </div>
      )}

      {/* Dados da loja */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[60] bg-[#0E1033]/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setIsProfileModalOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Dados da loja" className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 style={FONTE_TITULO} className="text-xl font-bold">Dados da loja</h3>
              <button type="button" onClick={() => setIsProfileModalOpen(false)} aria-label="Fechar" className="w-11 h-11 rounded-xl text-[#5B5E7A] hover:bg-[#F5F4FA] flex items-center justify-center">
                <Icone nome="fechar" tamanho={20} />
              </button>
            </div>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-xs font-semibold text-[#5B5E7A]">Nome da loja</dt>
                <dd className="font-bold text-base">{profile?.nome || 'Não informado'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-[#5B5E7A]">E-mail de acesso</dt>
                <dd className="font-medium">{userEmail || 'Não informado'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-[#5B5E7A]">Cidade</dt>
                <dd className="font-medium">{profile?.cidade || 'Não informada'}</dd>
              </div>
              {planoAtual && (
                <div>
                  <dt className="text-xs font-semibold text-[#5B5E7A]">Plano</dt>
                  <dd className="font-medium">{NOME_PLANO[planoAtual] || planoAtual}</dd>
                </div>
              )}
            </dl>
            <button type="button" onClick={() => setIsProfileModalOpen(false)} className="w-full h-12 rounded-xl bg-[#0E1033] hover:bg-black text-white font-bold transition">
              Fechar
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
