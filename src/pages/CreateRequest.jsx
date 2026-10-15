import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, useLocation } from 'react-router-dom';
import { uploadImageToStorage } from '../utils/uploadImage';
import { calcularMsUteisDecorridos, proximaAbertura, estaAbertoAgora } from '../utils/prazoUtils';
import { Icone, FONTE_TITULO, FONTE_TEXTO, carregarFontesNuno, iconePorNome, normalizar, montarDestaque } from '../utils/nunoUI';

/* Nova cotação
   setor → categoria → (papelaria: um produto / minha lista / lista escolar)
   → perguntas da categoria (do pedido e de cada produto) → revisar → enviar.
   As perguntas vêm do admin (tabela categoria_perguntas). */

const ITEM_VAZIO = () => ({ descricao: '', quantidade: 1, imagem_url: '', respostas: {} });

const ENTRADA = 'w-full h-12 px-3.5 rounded-xl border border-[#E4E2EF] bg-white text-[15px] text-[#0E1033] placeholder-[#8B88A6] focus:outline-none focus:border-[#5E17EB] focus:ring-2 focus:ring-[#5E17EB]/20 transition';
const ROTULO = 'block text-[13px] font-semibold text-[#0E1033] mb-1.5';
const SECAO = 'text-xs font-bold text-[#5B5E7A] uppercase tracking-wide';
const CHIP = (ativo) => `inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 rounded-xl text-sm transition ${ativo ? 'border-2 border-[#5E17EB] bg-[#EFE9FF] text-[#3C0DA8] font-bold' : 'border border-[#E4E2EF] bg-white text-[#0E1033] font-semibold hover:border-[#935DFF]'}`;

const OPCOES_RECEBIMENTO = [
  { key: 'entrega', titulo: 'Entrega', icone: 'caminhao' },
  { key: 'retirada', titulo: 'Retirada', icone: 'loja' },
  { key: 'ambos', titulo: 'Os dois', icone: 'grade' },
];
const OPCOES_PRAZO = [
  { key: 'urgente', titulo: 'Urgente', sub: 'até 1 hora', horas: 1 },
  { key: 'padrao', titulo: 'Padrão', sub: 'até 6 horas', horas: 6 },
  { key: 'sem_pressa', titulo: 'Sem pressa', sub: 'até 24 horas', horas: 24 },
];

const textoVeiculo = (v) => (v ? [v.modelo, v.versao, v.ano].filter(Boolean).join(' ').trim() : '');

function Interruptor({ checked, onChange, rotulo, icone }) {
  return (
    <label className="flex items-center justify-between gap-3 min-h-[48px] cursor-pointer">
      <span className="flex items-center gap-2.5 text-sm font-semibold text-[#0E1033]">
        {icone && <Icone nome={icone} tamanho={18} className="text-[#5B5E7A]" />}
        {rotulo}
      </span>
      <input type="checkbox" className="sr-only peer" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden="true" className="relative shrink-0 w-12 h-7 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-[#5E17EB]/40" style={{ background: checked ? '#5E17EB' : '#D6D3E6' }}>
        <span className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow-sm transition-all ${checked ? 'left-[23px]' : 'left-[3px]'}`} />
      </span>
    </label>
  );
}

function Contador({ valor, onChange, rotulo, minimo = 1 }) {
  const n = parseInt(valor, 10) || minimo;
  return (
    <div className="inline-flex items-center gap-1 h-12 px-1 rounded-xl border border-[#E4E2EF] bg-white" role="group" aria-label={rotulo}>
      <button type="button" aria-label="Menos" disabled={n <= minimo} onClick={() => onChange(Math.max(minimo, n - 1))} className="w-10 h-10 rounded-lg flex items-center justify-center text-[#0E1033] disabled:opacity-30 hover:bg-[#F5F4FA]"><Icone nome="menos" tamanho={18} strokeWidth={2.4} /></button>
      <input
        type="number"
        min={minimo}
        inputMode="numeric"
        value={valor}
        aria-label={rotulo}
        onChange={(e) => onChange(e.target.value === '' ? '' : Math.max(minimo, parseInt(e.target.value, 10) || minimo))}
        className="w-12 text-center font-bold text-base bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button type="button" aria-label="Mais" onClick={() => onChange(n + 1)} className="w-10 h-10 rounded-lg flex items-center justify-center text-[#0E1033] hover:bg-[#F5F4FA]"><Icone nome="mais" tamanho={18} strokeWidth={2.4} /></button>
    </div>
  );
}

export default function CreateRequest() {
  const navigate = useNavigate();
  const location = useLocation();

  // Dados de apoio
  const [setores, setSetores] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [cities, setCities] = useState([]);
  const [perguntas, setPerguntas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  // Navegação entre passos
  const [passos, setPassos] = useState(['setor']);
  const passo = passos[passos.length - 1];
  const irPara = (p) => { setPassos(prev => [...prev, p]); window.scrollTo(0, 0); };
  const voltar = () => {
    if (passos.length <= 1) { navigate('/client-dashboard'); return; }
    setPassos(prev => prev.slice(0, -1));
    window.scrollTo(0, 0);
  };

  // Escolhas
  const [busca, setBusca] = useState('');
  const [setorId, setSetorId] = useState(null);
  const [categoryId, setCategoryId] = useState('');
  const [modo, setModo] = useState('produtos'); // 'produtos' | 'lista_escolar'
  const [cityId, setCityId] = useState('');
  const [bairro, setBairro] = useState('');
  const [tipoRecebimento, setTipoRecebimento] = useState('');
  const [prazoOpcao, setPrazoOpcao] = useState('padrao');
  const [respostasPedido, setRespostasPedido] = useState({});
  const [items, setItems] = useState([ITEM_VAZIO()]);
  const [veiculoNovo, setVeiculoNovo] = useState({ marca: '', modelo: '', ano: '', versao: '' });
  const [salvarVeiculo, setSalvarVeiculo] = useState(true);
  const [repetidoDe, setRepetidoDe] = useState(null);

  // Lista escolar
  const [escolas, setEscolas] = useState([]);
  const [listasPublicadas, setListasPublicadas] = useState([]);
  const [escolaId, setEscolaId] = useState(null);
  const [listaId, setListaId] = useState(null);
  const [itensLista, setItensLista] = useState([]);
  const [foraDaLista, setForaDaLista] = useState([]);
  const [buscaNaLista, setBuscaNaLista] = useState('');
  const [mostrarTodaLista, setMostrarTodaLista] = useState(false);

  const [uploading, setUploading] = useState(null); // chave do campo que está enviando foto
  const [enviando, setEnviando] = useState(false);
  const [eligibleStoresCount, setEligibleStoresCount] = useState(null);

  useEffect(() => { carregarFontesNuno(); }, []);

  useEffect(() => {
    async function carregar() {
      const [{ data: s }, { data: c }, { data: cid }, { data: { user } }] = await Promise.all([
        supabase.from('setores').select('*').order('ordem'),
        supabase.from('categories').select('*'),
        supabase.from('cities').select('*'),
        supabase.auth.getUser(),
      ]);
      setSetores((s || []).filter(x => x.ativo !== false));
      setCategorias((c || []).filter(x => x.ativo !== false));
      const cidadesUnicas = (cid || []).filter((item, i, arr) => arr.findIndex(t => normalizar(t.nome) === normalizar(item.nome)) === i);
      setCities(cidadesUnicas);

      if (user) {
        const [{ data: perfil }, { data: v }] = await Promise.all([
          supabase.from('profiles').select('cidade').eq('id', user.id).single(),
          supabase.from('veiculos_cliente').select('*').eq('cliente_id', user.id).order('criado_em', { ascending: false }),
        ]);
        setVeiculos(v || []);
        const cidadePerfil = cidadesUnicas.find(ci => normalizar(ci.nome) === normalizar(perfil?.cidade));
        if (cidadePerfil) setCityId(String(cidadePerfil.id || cidadePerfil.nome));
      }
      setCarregando(false);
    }
    carregar();
  }, []);

  /* ----------------------------- Categorias ----------------------------- */
  // Categorias com o mesmo nome contam como uma só (o banco pode ter repetidas)
  const categoriasUnicas = useMemo(
    () => categorias
      .filter((cat, i, arr) => arr.findIndex(o => normalizar(o.nome) === normalizar(cat.nome)) === i)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || (a.nome || '').localeCompare(b.nome || '', 'pt-BR')),
    [categorias]
  );
  const setorDe = (cat) => setores.find(s => String(s.id) === String(cat.setor_id));
  const SETOR_OUTROS = { id: 'outros', nome: 'Outros', icone: 'grade' };
  const temOutros = categoriasUnicas.some(c => !setorDe(c));
  const setoresVisiveis = [
    ...setores.filter(s => categoriasUnicas.some(c => String(c.setor_id) === String(s.id))),
    ...(temOutros ? [SETOR_OUTROS] : []),
  ];
  const categoriasDoSetor = (id) => categoriasUnicas.filter(c => (id === 'outros' ? !setorDe(c) : String(c.setor_id) === String(id)));
  const categoria = categorias.find(c => String(c.id) === String(categoryId));
  const idsMesmoNome = (cat) => categorias.filter(c => normalizar(c.nome) === normalizar(cat?.nome)).map(c => c.id);

  const resultadosBusca = busca.trim().length < 2 ? [] : categoriasUnicas.filter(c => {
    const termo = normalizar(busca);
    const alvo = normalizar([c.nome, c.palavras_busca, c.descricao_curta, setorDe(c)?.nome].filter(Boolean).join(' '));
    return termo.split(/\s+/).every(t => alvo.includes(t));
  });

  async function escolherCategoria(cat) {
    setCategoryId(cat.id);
    setSetorId(cat.setor_id || 'outros');
    setRespostasPedido({});
    setItems([ITEM_VAZIO()]);
    const { data } = await supabase.from('categoria_perguntas').select('*').in('categoria_id', idsMesmoNome(cat)).eq('ativo', true).order('ordem');
    // Se houver categorias repetidas com perguntas iguais, fica só uma de cada
    const unicas = (data || []).filter((p, i, arr) => arr.findIndex(o => normalizar(o.rotulo) === normalizar(p.rotulo) && o.nivel === p.nivel) === i);
    // Perguntas que o lojista responde não aparecem para o cliente
    setPerguntas(unicas.filter(p => !p.responde_lojista));
    if (cat.permite_lista_escolar) irPara('modo');
    else { setModo('produtos'); irPara('formulario'); }
  }

  function escolherSetor(setor) {
    setSetorId(setor.id);
    const cats = categoriasDoSetor(setor.id);
    if (cats.length === 1) escolherCategoria(cats[0]);
    else irPara('categoria');
  }

  /* --------------------------- Repetir pedido --------------------------- */
  useEffect(() => {
    const repetir = new URLSearchParams(location.search).get('repetir');
    if (!repetir || carregando || categorias.length === 0) return;
    (async () => {
      const { data: pedido } = await supabase.from('orders').select('*').eq('id', repetir).single();
      if (!pedido) return;
      const { data: itensPedido } = await supabase.from('order_items').select('*').eq('order_id', pedido.id);
      const cat = categorias.find(c => String(c.id) === String(pedido.categoria_id));
      if (!cat) return;
      await escolherCategoria(cat);
      setModo('produtos');
      setPassos(['setor', 'formulario']);
      setRepetidoDe(pedido.id);
      setTipoRecebimento(pedido.tipo_recebimento || '');
      setBairro(pedido.bairro || '');
      if (pedido.cidade_id) setCityId(String(pedido.cidade_id));
      const porId = (lista) => Object.fromEntries((lista || []).filter(r => r.pergunta_id).map(r => [r.pergunta_id, r.bruto ?? r.valor]));
      setRespostasPedido(porId(pedido.respostas));
      if (itensPedido?.length) {
        setItems(itensPedido.map(i => ({ descricao: i.descricao || '', quantidade: i.quantidade || 1, imagem_url: i.imagem_url || '', respostas: porId(i.respostas) })));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, carregando, categorias.length]);

  /* ------------------------------ Perguntas ------------------------------ */
  const perguntasPedido = perguntas.filter(p => p.nivel !== 'item');
  const perguntasItem = perguntas.filter(p => p.nivel === 'item');

  const valorParaCondicao = (v) => (v === true ? 'Sim' : v === false ? 'Não' : v);
  const perguntaVisivel = (p, respostasItem = {}) => {
    if (!p.condicao_pergunta_id) return true;
    const alvo = perguntas.find(x => x.id === p.condicao_pergunta_id);
    if (!alvo) return true;
    const resp = alvo.nivel === 'item' ? respostasItem[alvo.id] : respostasPedido[alvo.id];
    return normalizar(valorParaCondicao(resp)) === normalizar(p.condicao_valor);
  };

  const respostaVazia = (p, v) => {
    if (p.tipo === 'sim_nao') return false;
    if (p.tipo === 'veiculo') return !v || !v.modelo;
    if (Array.isArray(v)) return v.length === 0;
    return v == null || String(v).trim() === '';
  };

  async function enviarFoto(chave, arquivo, aoTerminar) {
    if (!arquivo) return;
    try {
      setUploading(chave);
      const url = await uploadImageToStorage(arquivo, 'cliente');
      aoTerminar(url);
    } catch (err) {
      alert('Erro ao enviar a foto: ' + err.message);
    } finally {
      setUploading(null);
    }
  }

  function renderCampoVeiculo(p) {
    const atual = respostasPedido[p.id];
    const escolherSalvo = (v) => setRespostasPedido(prev => ({ ...prev, [p.id]: { id: v.id, marca: v.marca, modelo: v.modelo, ano: v.ano, versao: v.versao } }));
    const usandoNovo = !atual || !atual.id;
    const mudarNovo = (campo, valor) => {
      const novo = { ...veiculoNovo, [campo]: valor };
      setVeiculoNovo(novo);
      setRespostasPedido(prev => ({ ...prev, [p.id]: { ...novo } }));
    };
    return (
      <div className="space-y-3">
        {veiculos.length > 0 && (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Meus veículos">
            {veiculos.map(v => (
              <button key={v.id} type="button" role="radio" aria-checked={atual?.id === v.id} onClick={() => escolherSalvo(v)} className={CHIP(atual?.id === v.id)}>
                {atual?.id === v.id && <Icone nome="marcado" tamanho={16} strokeWidth={2.4} />}{textoVeiculo(v)}
              </button>
            ))}
            <button type="button" role="radio" aria-checked={usandoNovo} onClick={() => setRespostasPedido(prev => ({ ...prev, [p.id]: { ...veiculoNovo } }))} className={CHIP(usandoNovo)}>
              <Icone nome="mais" tamanho={16} strokeWidth={2.4} /> Outro veículo
            </button>
          </div>
        )}
        {usandoNovo && (
          <div className="bg-white border border-[#E4E2EF] rounded-2xl p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label><span className={ROTULO}>Marca</span><input className={ENTRADA} value={veiculoNovo.marca} onChange={(e) => mudarNovo('marca', e.target.value)} placeholder="Ex: Volkswagen" /></label>
              <label><span className={ROTULO}>Modelo</span><input className={ENTRADA} value={veiculoNovo.modelo} onChange={(e) => mudarNovo('modelo', e.target.value)} placeholder="Ex: Gol" /></label>
              <label><span className={ROTULO}>Ano</span><input className={ENTRADA} inputMode="numeric" value={veiculoNovo.ano} onChange={(e) => mudarNovo('ano', e.target.value)} placeholder="Ex: 2015" /></label>
              <label><span className={ROTULO}>Motor / versão</span><input className={ENTRADA} value={veiculoNovo.versao} onChange={(e) => mudarNovo('versao', e.target.value)} placeholder="Ex: 1.0 Trendline" /></label>
            </div>
            <Interruptor checked={salvarVeiculo} onChange={setSalvarVeiculo} rotulo="Salvar em Meus veículos" />
          </div>
        )}
      </div>
    );
  }

  // Campo de uma pergunta. "valor" e "mudar" vêm do pedido ou do item.
  function renderCampo(p, valor, mudar, chaveFoto) {
    const rotulo = (
      <span className={ROTULO}>
        {p.rotulo}{!p.obrigatoria && p.tipo !== 'sim_nao' && <span className="font-normal text-[#8B88A6]"> (opcional)</span>}
      </span>
    );
    const ajuda = p.ajuda && <span className="block text-xs text-[#5B5E7A] mt-1.5">{p.ajuda}</span>;
    const opcoes = Array.isArray(p.opcoes) ? p.opcoes : [];

    if (p.tipo === 'veiculo') return <div key={p.id}>{rotulo}{renderCampoVeiculo(p)}{ajuda}</div>;
    if (p.tipo === 'sim_nao') return <div key={p.id}><Interruptor checked={!!valor} onChange={mudar} rotulo={p.rotulo} />{ajuda}</div>;
    if (p.tipo === 'escolha_unica') {
      return (
        <div key={p.id}>
          {rotulo}
          <div role="radiogroup" aria-label={p.rotulo} className={opcoes.length <= 3 ? 'grid gap-2' : 'flex flex-wrap gap-2'} style={opcoes.length <= 3 ? { gridTemplateColumns: `repeat(${opcoes.length}, minmax(0, 1fr))` } : undefined}>
            {opcoes.map(op => (
              <button key={op} type="button" role="radio" aria-checked={valor === op} onClick={() => mudar(valor === op && !p.obrigatoria ? '' : op)} className={CHIP(valor === op)}>{op}</button>
            ))}
          </div>
          {ajuda}
        </div>
      );
    }
    if (p.tipo === 'escolha_multipla') {
      const lista = Array.isArray(valor) ? valor : [];
      return (
        <div key={p.id}>
          {rotulo}
          <div role="group" aria-label={p.rotulo} className="flex flex-wrap gap-2">
            {opcoes.map(op => {
              const ativo = lista.includes(op);
              return (
                <button key={op} type="button" aria-pressed={ativo} onClick={() => mudar(ativo ? lista.filter(x => x !== op) : [...lista, op])} className={CHIP(ativo)}>
                  {ativo && <Icone nome="marcado" tamanho={16} strokeWidth={2.4} />}{op}
                </button>
              );
            })}
          </div>
          {ajuda}
        </div>
      );
    }
    if (p.tipo === 'foto') {
      return (
        <div key={p.id}>
          {rotulo}
          <div className="flex items-center gap-3">
            {valor && <img src={valor} alt={p.rotulo} className="w-16 h-16 rounded-xl object-cover border border-[#E4E2EF] shrink-0" />}
            <label className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl cursor-pointer text-sm font-bold ${valor ? 'border border-[#E4E2EF] bg-white text-[#0E1033]' : 'border-[1.5px] border-dashed border-[#C9B6FB] bg-[#F7F3FF] text-[#3C0DA8]'}`}>
              <Icone nome="camera" tamanho={18} />
              {uploading === chaveFoto ? 'Enviando...' : valor ? 'Trocar foto' : 'Tirar ou escolher foto'}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => enviarFoto(chaveFoto, e.target.files[0], mudar)} />
            </label>
          </div>
          {ajuda}
        </div>
      );
    }
    return (
      <label key={p.id} className="block">
        {rotulo}
        <span className="flex items-center gap-2 h-12 px-3.5 rounded-xl border border-[#E4E2EF] bg-white focus-within:border-[#5E17EB] focus-within:ring-2 focus-within:ring-[#5E17EB]/20">
          <input
            type={p.tipo === 'numero' ? 'number' : 'text'}
            inputMode={p.tipo === 'numero' ? 'decimal' : undefined}
            value={valor ?? ''}
            placeholder={p.placeholder || ''}
            onChange={(e) => mudar(e.target.value)}
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-[15px] text-[#0E1033] placeholder-[#8B88A6]"
          />
          {p.unidade && <span className="text-sm font-semibold text-[#5B5E7A]">{p.unidade}</span>}
        </span>
        {ajuda}
      </label>
    );
  }

  /* ---------------------------- Itens do pedido ---------------------------- */
  const mudarItem = (i, campo, valor) => setItems(prev => prev.map((it, j) => (j === i ? { ...it, [campo]: valor } : it)));
  const mudarRespostaItem = (i, perguntaId, valor) => setItems(prev => prev.map((it, j) => (j === i ? { ...it, respostas: { ...it.respostas, [perguntaId]: valor } } : it)));

  /* ------------------------------ Lista escolar ------------------------------ */
  async function abrirListaEscolar() {
    setModo('lista_escolar');
    const [{ data: e }, { data: l }] = await Promise.all([
      supabase.from('escolas').select('*').eq('ativo', true).order('nome'),
      supabase.from('listas_escolares').select('*').eq('status', 'publicada').order('ano_letivo', { ascending: false }),
    ]);
    setEscolas(e || []);
    setListasPublicadas(l || []);
    irPara('escola');
  }

  const cidadeSelecionada = cities.find(c => String(c.id) === String(cityId) || c.nome === cityId);
  const escolasComLista = escolas
    .filter(e => listasPublicadas.some(l => l.escola_id === e.id))
    .filter(e => !e.cidade || !cidadeSelecionada || normalizar(e.cidade) === normalizar(cidadeSelecionada.nome));
  const escola = escolas.find(e => e.id === escolaId);
  const lista = listasPublicadas.find(l => l.id === listaId);

  async function abrirItensDaLista() {
    const { data, error } = await supabase.from('lista_escolar_itens').select('*').eq('lista_id', listaId).order('ordem');
    if (error) { alert('Erro ao carregar a lista: ' + error.message); return; }
    setItensLista((data || []).map(i => ({
      lista_item_id: i.id, descricao: i.descricao, quantidade: i.quantidade || 1, marca_sugerida: i.marca_sugerida || '',
      observacao: i.observacao || '', marcado: true, preferencia: i.marca_sugerida ? 'marca' : null,
    })));
    setForaDaLista([]);
    setMostrarTodaLista(false);
    irPara('formulario');
  }

  const mudarItemLista = (i, campo, valor) => setItensLista(prev => prev.map((it, j) => (j === i ? { ...it, [campo]: valor } : it)));
  const marcadosLista = itensLista.filter(i => i.marcado);

  /* ------------------------- Lojas que vão receber ------------------------- */
  const buscarLojistasElegiveisAgora = async (catId, cidId) => {
    if (!catId || !cidId) return [];
    const cat = categorias.find(c => String(c.id) === String(catId));
    const ids = cat ? idsMesmoNome(cat) : [catId];
    const cityObj = cities.find(c => String(c.id) === String(cidId) || c.nome === cidId);
    const cityName = (cityObj ? cityObj.nome : String(cidId)).trim();
    const { data: lojistaCats } = await supabase.from('lojista_categorias').select('lojista_id').in('categoria_id', ids);
    const lojistaIds = Array.from(new Set((lojistaCats || []).map(lc => lc.lojista_id).filter(Boolean)));
    if (lojistaIds.length === 0) return [];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, cidade, ativo, tipo, horario_abertura, horario_fechamento, dias_funcionamento')
      .in('id', lojistaIds);
    return (profiles || []).filter(p => {
      const isLojista = p.tipo === 'lojista' || !p.tipo;
      const isAtivo = p.ativo !== false;
      const sameCity = p.cidade && normalizar(p.cidade).includes(normalizar(cityName));
      return isLojista && isAtivo && sameCity;
    });
  };

  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (!categoryId || !cityId) { setEligibleStoresCount(null); return; }
      try {
        const lojas = await buscarLojistasElegiveisAgora(categoryId, cityId);
        if (!cancelado) setEligibleStoresCount(lojas.length);
      } catch {
        if (!cancelado) setEligibleStoresCount(0);
      }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, cityId, categorias.length, cities.length]);

  /* ------------------------------- Validação ------------------------------- */
  function validarFormulario() {
    if (!cityId) return 'Escolha a sua cidade.';
    if (modo === 'lista_escolar') {
      if (marcadosLista.length === 0 && foraDaLista.filter(f => f.descricao.trim()).length === 0) return 'Marque pelo menos um item da lista.';
    } else {
      for (const p of perguntasPedido) {
        if (p.obrigatoria && perguntaVisivel(p) && respostaVazia(p, respostasPedido[p.id])) return `Responda: ${p.rotulo}`;
      }
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it.descricao.trim()) return items.length > 1 ? `Escreva o produto ${i + 1}.` : 'Escreva o que você precisa.';
        for (const p of perguntasItem) {
          if (p.obrigatoria && perguntaVisivel(p, it.respostas) && respostaVazia(p, it.respostas[p.id])) {
            return `${items.length > 1 ? `Produto ${i + 1}: ` : ''}responda "${p.rotulo}".`;
          }
        }
      }
    }
    if (!tipoRecebimento) return 'Escolha como quer receber: entrega, retirada ou os dois.';
    if (tipoRecebimento !== 'retirada' && !bairro.trim()) return 'Escreva o bairro para a entrega.';
    return null;
  }

  const irParaRevisao = () => {
    const erro = validarFormulario();
    if (erro) { alert(erro); return; }
    irPara('revisar');
  };

  /* ---------------------------- Respostas salvas ---------------------------- */
  const snapshot = (lista, respostas, respostasItem) => lista
    .filter(p => perguntaVisivel(p, respostasItem))
    .map(p => {
      const bruto = respostas[p.id];
      if (p.tipo !== 'sim_nao' && respostaVazia(p, bruto)) return null;
      const valor = p.tipo === 'veiculo' ? textoVeiculo(bruto) : p.tipo === 'sim_nao' ? !!bruto : bruto;
      if (p.tipo === 'sim_nao' && !valor && !p.obrigatoria) return { pergunta_id: p.id, rotulo: p.rotulo, tipo: p.tipo, valor: false, bruto: false, no_card: false };
      return {
        pergunta_id: p.id, rotulo: p.rotulo, tipo: p.tipo,
        valor: p.tipo === 'numero' && p.unidade ? `${valor} ${p.unidade}` : valor,
        bruto,
        no_card: !!p.mostrar_no_card,
      };
    })
    .filter(Boolean);

  const respostasPedidoSalvas = () => snapshot(perguntasPedido, respostasPedido, {});
  const respostasItemSalvas = (it) => snapshot(perguntasItem, it.respostas, it.respostas);

  const destaquePrevia = () => {
    if (modo === 'lista_escolar') {
      const fora = foraDaLista.filter(f => f.descricao.trim()).length;
      return [escola?.nome, lista?.ano_letivo, `${marcadosLista.length} da lista${fora ? ` + ${fora} fora` : ''}`].filter(Boolean).join(' · ');
    }
    return montarDestaque(respostasPedidoSalvas(), items[0] ? respostasItemSalvas(items[0]) : []);
  };

  /* -------------------------------- Envio -------------------------------- */
  async function handleSubmit() {
    if (enviando) return;
    const erro = validarFormulario();
    if (erro) { alert(erro); return; }
    if (uploading) { alert('Aguarde a foto terminar de enviar.'); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert('Sessão expirada. Faça login novamente.'); return; }

    setEnviando(true);
    try {
      // Salva o veículo novo em "Meus veículos"
      const pVeiculo = perguntasPedido.find(p => p.tipo === 'veiculo');
      if (pVeiculo && salvarVeiculo) {
        const v = respostasPedido[pVeiculo.id];
        if (v && !v.id && v.modelo) {
          const { data: salvo } = await supabase.from('veiculos_cliente').insert([{ cliente_id: user.id, marca: v.marca || '', modelo: v.modelo, ano: v.ano || null, versao: v.versao || null }]).select().single();
          if (salvo) setVeiculos(prev => [salvo, ...prev]);
        }
      }

      let itensParaSalvar;
      let descricaoResumo;
      if (modo === 'lista_escolar') {
        const fora = foraDaLista.filter(f => f.descricao.trim());
        itensParaSalvar = [
          ...marcadosLista.map(i => ({
            descricao: i.descricao, quantidade: parseInt(i.quantidade, 10) || 1, marca_sugerida: i.marca_sugerida || null,
            preferencia_marca: i.marca_sugerida ? (i.preferencia || 'marca') : null, observacao: i.observacao || null,
            lista_item_id: i.lista_item_id, fora_da_lista: false, respostas: [],
          })),
          ...fora.map(f => ({ descricao: f.descricao.trim(), quantidade: parseInt(f.quantidade, 10) || 1, observacao: f.observacao?.trim() || null, fora_da_lista: true, respostas: [] })),
        ];
        descricaoResumo = `Lista escolar ${lista?.serie || ''}`.trim();
      } else {
        itensParaSalvar = items.map(it => ({
          descricao: it.descricao.trim(), quantidade: parseInt(it.quantidade, 10) || 1, imagem_url: it.imagem_url || null,
          respostas: respostasItemSalvas(it),
        }));
        descricaoResumo = items.length === 1 ? items[0].descricao.trim() : `${items.length} produtos de ${categoria?.nome || 'lista'}`;
      }

      const horasAdd = (OPCOES_PRAZO.find(o => o.key === prazoOpcao) || OPCOES_PRAZO[1]).horas;
      const expiraEm = new Date(Date.now() + horasAdd * 60 * 60 * 1000).toISOString();

      const { data: newOrder, error: orderErr } = await supabase
        .from('orders')
        .insert([{
          cliente_id: user.id,
          categoria_id: categoryId,
          cidade_id: cityId,
          bairro: tipoRecebimento === 'retirada' ? null : bairro.trim(),
          tipo_recebimento: tipoRecebimento,
          descricao: descricaoResumo,
          status: 'Aberto para Propostas',
          tipo: modo === 'lista_escolar' ? 'lista_escolar' : (itensParaSalvar.length > 1 ? 'lista' : 'unico'),
          prazo_opcao: prazoOpcao,
          expira_em: expiraEm,
          respostas: modo === 'lista_escolar' ? [] : respostasPedidoSalvas(),
          destaque: destaquePrevia() || null,
          lista_escolar_id: modo === 'lista_escolar' ? listaId : null,
          repetido_de: repetidoDe,
        }])
        .select()
        .single();
      if (orderErr) throw orderErr;

      // Código do pedido: ID real + minuto + dia
      const agoraCriacao = new Date(newOrder.created_at || Date.now());
      const codigoPedido = `${String(newOrder.id).padStart(5, '0')}${String(agoraCriacao.getMinutes()).padStart(2, '0')}${String(agoraCriacao.getDate()).padStart(2, '0')}`;
      await supabase.from('orders').update({ codigo_pedido: codigoPedido }).eq('id', newOrder.id);

      const { error: itemsErr } = await supabase.from('order_items').insert(itensParaSalvar.map(it => ({ ...it, order_id: newOrder.id })));
      if (itemsErr) throw itemsErr;

      // Aviso sobre o horário das lojas, como antes
      let avisoFinal = '';
      try {
        const lojas = await buscarLojistasElegiveisAgora(categoryId, cityId);
        if (lojas.length > 0) {
          const agora = new Date();
          if (!estaAbertoAgora(lojas, agora)) {
            avisoFinal = proximaAbertura(lojas, agora)
              ? '\n\nAs lojas da sua região estão fora do horário de atendimento agora. Seu prazo começa a contar junto com o horário da primeira loja que abrir.'
              : '';
          } else {
            const fimSimulado = new Date(agora.getTime() + horasAdd * 60 * 60 * 1000);
            if (calcularMsUteisDecorridos(agora, fimSimulado, lojas) < horasAdd * 60 * 60 * 1000) {
              avisoFinal = '\n\nVocê está pedindo perto do horário de fechamento das lojas. Se não houver resposta até lá, o prazo pausa e volta a contar quando a primeira loja reabrir.';
            }
          }
        }
      } catch (err) {
        console.error('Erro ao calcular aviso de prazo:', err);
      }

      alert(`Pedido #${codigoPedido} criado com sucesso!${avisoFinal}`);
      navigate('/client-dashboard');
    } catch (err) {
      alert('Erro ao criar a cotação: ' + err.message);
    } finally {
      setEnviando(false);
    }
  }

  /* ================================= TELA ================================= */
  const setorAtual = setorId === 'outros' ? SETOR_OUTROS : setores.find(s => String(s.id) === String(setorId));
  const TITULOS = {
    setor: ['Nova cotação', 'O que você precisa?'],
    categoria: [setorAtual?.nome || 'Categoria', 'Qual categoria?'],
    modo: [categoria?.nome || '', 'Como você quer pedir?'],
    escola: ['Lista escolar', 'De qual escola é a lista?'],
    formulario: [categoria?.nome || '', modo === 'lista_escolar' ? `${lista?.serie || 'Lista'}` : 'Monte seu pedido'],
    revisar: ['Revisar pedido', 'Confere se está tudo certo'],
  };
  const [tituloTopo, tituloTela] = TITULOS[passo] || TITULOS.setor;

  const rodapeLojas = eligibleStoresCount === null ? null : eligibleStoresCount > 0
    ? <>Vai para <b className="text-[#0E1033]">{eligibleStoresCount} loja{eligibleStoresCount > 1 ? 's' : ''}</b> de {cidadeSelecionada?.nome || 'sua cidade'}</>
    : <>Ainda não há lojas dessa categoria na sua cidade. O pedido fica salvo para quando houver.</>;

  const renderLinhaCategoria = (cat, ativo) => (
    <button
      key={cat.id}
      type="button"
      aria-pressed={ativo}
      onClick={() => escolherCategoria(cat)}
      className={`w-full flex items-center gap-3 min-h-[64px] p-3 rounded-2xl text-left transition ${ativo ? 'border-2 border-[#5E17EB] bg-[#F7F3FF]' : 'bg-white border border-[#E4E2EF] hover:border-[#C9B6FB]'}`}
    >
      <span className="w-10 h-10 shrink-0 rounded-xl bg-[#EFE9FF] text-[#5E17EB] flex items-center justify-center"><Icone nome={iconePorNome(cat.nome)} tamanho={20} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-[#0E1033] leading-tight">{cat.nome}</span>
        {cat.descricao_curta && <span className="block text-[13px] text-[#5B5E7A] truncate">{cat.descricao_curta}</span>}
      </span>
      <Icone nome="direita" tamanho={18} className="text-[#8B88A6]" />
    </button>
  );

  return (
    <div className="min-h-screen bg-[#F5F4FA] text-[#0E1033]" style={FONTE_TEXTO}>
      <div className="max-w-xl mx-auto min-h-screen flex flex-col sm:py-6">
        <div className="flex-1 flex flex-col bg-[#F5F4FA] sm:bg-white sm:border sm:border-[#E4E2EF] sm:rounded-3xl sm:overflow-hidden">

          {/* Topo */}
          <header className="sticky top-0 z-20 bg-white border-b border-[#E4E2EF] flex items-center gap-1 px-2 h-16">
            <button type="button" onClick={voltar} aria-label={passos.length <= 1 ? 'Fechar e voltar aos meus pedidos' : 'Voltar'} className="w-11 h-11 rounded-xl flex items-center justify-center hover:bg-[#F5F4FA]">
              <Icone nome={passos.length <= 1 ? 'fechar' : 'esquerda'} tamanho={22} strokeWidth={2.2} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-base leading-tight truncate">{tituloTopo}</p>
              {repetidoDe && <p className="text-xs text-[#5E17EB] font-semibold">Repetindo um pedido anterior</p>}
            </div>
          </header>

          <main className="flex-1 px-4 pt-5 pb-36 space-y-5 sm:bg-[#F5F4FA]">
            <h1 style={FONTE_TITULO} className="text-[26px] sm:text-[28px] font-bold leading-[1.1] tracking-tight">{tituloTela}</h1>

            {carregando && <p className="text-sm text-[#5B5E7A]">Carregando...</p>}

            {/* ---------- 1. Setor ---------- */}
            {!carregando && passo === 'setor' && (
              <>
                <label className="flex items-center gap-2.5 h-12 px-3.5 bg-white border border-[#E4E2EF] rounded-xl focus-within:border-[#5E17EB] focus-within:ring-2 focus-within:ring-[#5E17EB]/20">
                  <Icone nome="busca" tamanho={18} className="text-[#5B5E7A]" />
                  <span className="sr-only">Buscar categoria ou produto</span>
                  <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar: cimento, ração, caderno…" className="flex-1 min-w-0 bg-transparent border-none outline-none text-[15px] placeholder-[#8B88A6]" />
                </label>

                {busca.trim().length >= 2 ? (
                  resultadosBusca.length === 0
                    ? <p className="text-sm text-[#5B5E7A] bg-white border border-dashed border-[#D6D3E6] rounded-xl p-4">Não achei nada com "{busca}". Tente outra palavra ou escolha um setor.</p>
                    : <div className="space-y-2">{resultadosBusca.map(cat => renderLinhaCategoria(cat, false))}</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {setoresVisiveis.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => escolherSetor(s)}
                        className="bg-white border border-[#E4E2EF] rounded-2xl p-3.5 min-h-[104px] flex flex-col items-start gap-2.5 text-left font-bold text-[15px] hover:border-[#C9B6FB] transition"
                      >
                        <span className="w-10 h-10 rounded-xl bg-[#EFE9FF] text-[#5E17EB] flex items-center justify-center"><Icone nome={s.icone || 'caixa'} tamanho={22} /></span>
                        {s.nome}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ---------- 2. Categoria do setor ---------- */}
            {passo === 'categoria' && (
              <>
                <p className="text-sm text-[#5B5E7A] -mt-2">O pedido vai só para as lojas dessa categoria.</p>
                <div className="space-y-2">{categoriasDoSetor(setorId).map(cat => renderLinhaCategoria(cat, String(cat.id) === String(categoryId)))}</div>
              </>
            )}

            {/* ---------- 3. Como pedir (papelaria) ---------- */}
            {passo === 'modo' && (
              <div className="space-y-2.5">
                {[
                  { key: 'produtos', titulo: 'Um produto ou minha lista', sub: 'Escreva o que precisa, item por item', icone: 'lista', acao: () => { setModo('produtos'); irPara('formulario'); } },
                  { key: 'lista_escolar', titulo: 'Lista escolar', sub: 'Listas prontas das escolas parceiras', icone: 'escola', novo: true, acao: abrirListaEscolar },
                ].map(op => (
                  <button key={op.key} type="button" onClick={op.acao} className="w-full flex items-center gap-3 min-h-[76px] p-3.5 rounded-2xl bg-white border border-[#E4E2EF] hover:border-[#C9B6FB] text-left transition">
                    <span className="w-11 h-11 shrink-0 rounded-xl bg-[#EFE9FF] text-[#5E17EB] flex items-center justify-center"><Icone nome={op.icone} tamanho={22} /></span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2 text-[15px] font-bold">{op.titulo}{op.novo && <span className="h-5 px-2 rounded-full bg-[#0E7A4E] text-white text-[11px] inline-flex items-center">Novo</span>}</span>
                      <span className="block text-[13px] text-[#5B5E7A]">{op.sub}</span>
                    </span>
                    <Icone nome="direita" tamanho={18} className="text-[#8B88A6]" />
                  </button>
                ))}
              </div>
            )}

            {/* ---------- 4. Escolher escola e série ---------- */}
            {passo === 'escola' && (
              <>
                {escolasComLista.length === 0 ? (
                  <div className="bg-white border border-dashed border-[#D6D3E6] rounded-2xl p-4 space-y-3">
                    <p className="text-sm text-[#5B5E7A]">Ainda não temos listas de escolas {cidadeSelecionada ? `de ${cidadeSelecionada.nome}` : 'da sua cidade'}.</p>
                    <button type="button" onClick={() => { setModo('produtos'); irPara('formulario'); }} className="min-h-[44px] px-4 rounded-xl border border-[#E4E2EF] bg-white text-sm font-bold">Digitar minha lista</button>
                  </div>
                ) : escolasComLista.map(e => {
                  const aberta = escolaId === e.id;
                  const series = listasPublicadas.filter(l => l.escola_id === e.id);
                  return (
                    <div key={e.id} className={`bg-white rounded-2xl p-3.5 space-y-3 ${aberta ? 'border-2 border-[#5E17EB]' : 'border border-[#E4E2EF]'}`}>
                      <button type="button" onClick={() => { setEscolaId(e.id); setListaId(series.length === 1 ? series[0].id : null); }} className="w-full flex items-center gap-3 text-left min-h-[44px]">
                        <span className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${aberta ? 'bg-[#EFE9FF] text-[#5E17EB]' : 'bg-[#F5F4FA] text-[#5B5E7A]'}`}><Icone nome="escola" tamanho={22} /></span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-bold">{e.nome}</span>
                          <span className="flex items-center gap-2 text-xs text-[#5B5E7A]">
                            {e.parceira && <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-[#E3F5EC] text-[#0E7A4E] font-bold"><Icone nome="marcado" tamanho={11} strokeWidth={3} />Escola parceira</span>}
                            {series.length} {series.length === 1 ? 'série' : 'séries'}
                          </span>
                        </span>
                        {!aberta && <Icone nome="direita" tamanho={18} className="text-[#8B88A6]" />}
                      </button>
                      {aberta && (
                        <div role="radiogroup" aria-label="Série" className="flex flex-wrap gap-2">
                          {series.map(l => (
                            <button key={l.id} type="button" role="radio" aria-checked={listaId === l.id} onClick={() => setListaId(l.id)} className={CHIP(listaId === l.id)}>
                              {l.serie} · {l.ano_letivo}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="bg-white border border-dashed border-[#D6D3E6] rounded-2xl p-3.5 space-y-2">
                  <p className="text-sm font-bold">Não achou sua escola?</p>
                  <p className="text-[13px] text-[#5B5E7A]">Digite a lista que a escola mandou, item por item.</p>
                  <button type="button" onClick={() => { setModo('produtos'); irPara('formulario'); }} className="min-h-[44px] px-4 rounded-xl border border-[#E4E2EF] bg-white text-sm font-bold">Digitar minha lista</button>
                </div>
              </>
            )}

            {/* ---------- 5. Formulário ---------- */}
            {passo === 'formulario' && (
              <>
                {categoria?.aviso && (
                  <div role="note" className="flex gap-2.5 items-start bg-[#E7EEFF] text-[#1D3A8A] rounded-2xl px-3.5 py-3 text-[13px]">
                    <Icone nome="info" tamanho={18} className="mt-0.5" />
                    <span>{categoria.aviso}</span>
                  </div>
                )}

                {/* Lista escolar */}
                {modo === 'lista_escolar' ? (
                  <>
                    <section className="bg-[#00068F] text-white rounded-2xl p-4 space-y-2.5">
                      <p className="text-[13px] text-[#C9C6FF] font-semibold">{escola?.nome} · lista sugerida de {lista?.ano_letivo}</p>
                      <div className="flex justify-between items-baseline text-sm">
                        <span><b>{marcadosLista.length} de {itensLista.length}</b> itens marcados</span>
                        {itensLista.length - marcadosLista.length > 0 && <span className="text-[13px] text-[#C9C6FF]">{itensLista.length - marcadosLista.length} você já tem</span>}
                      </div>
                      <div className="h-1.5 rounded-full bg-white/20 overflow-hidden"><div className="h-full rounded-full bg-[#935DFF]" style={{ width: `${itensLista.length ? (marcadosLista.length / itensLista.length) * 100 : 0}%` }} /></div>
                    </section>
                    <p className="text-sm text-[#5B5E7A]">Desmarque o que você já tem e ajuste as quantidades. Onde a escola sugeriu marca, escolha se quer essa marca ou aceita similar.</p>
                    {itensLista.length > 8 && (
                      <label className="flex items-center gap-2.5 h-12 px-3.5 bg-white border border-[#E4E2EF] rounded-xl">
                        <Icone nome="busca" tamanho={18} className="text-[#5B5E7A]" />
                        <span className="sr-only">Procurar na lista</span>
                        <input type="search" value={buscaNaLista} onChange={(e) => setBuscaNaLista(e.target.value)} placeholder="Procurar na lista" className="flex-1 min-w-0 bg-transparent border-none outline-none text-[15px]" />
                      </label>
                    )}
                    <ul className="bg-white border border-[#E4E2EF] rounded-2xl overflow-hidden divide-y divide-[#F0EFF5]" aria-label="Itens da lista">
                      {(() => {
                        const filtrados = itensLista.map((it, i) => ({ it, i })).filter(({ it }) => !buscaNaLista || normalizar(it.descricao).includes(normalizar(buscaNaLista)));
                        const visiveis = mostrarTodaLista || buscaNaLista ? filtrados : filtrados.slice(0, 12);
                        return (
                          <>
                            {visiveis.map(({ it, i }) => (
                              <li key={it.lista_item_id || i} className="flex gap-2 items-start py-3 pl-1.5 pr-3">
                                <button type="button" role="checkbox" aria-checked={it.marcado} aria-label={it.descricao} onClick={() => mudarItemLista(i, 'marcado', !it.marcado)} className="w-11 h-11 shrink-0 flex items-center justify-center">
                                  <span className={`w-6 h-6 rounded-[7px] flex items-center justify-center ${it.marcado ? 'bg-[#5E17EB] text-white' : 'border-2 border-[#C9C6E0]'}`}>{it.marcado && <Icone nome="marcado" tamanho={14} strokeWidth={3.2} />}</span>
                                </button>
                                <div className="flex-1 min-w-0 pt-2.5">
                                  <p className={`text-[15px] font-bold leading-tight ${it.marcado ? '' : 'text-[#8B88A6] line-through'}`}>{it.descricao}</p>
                                  {it.marca_sugerida && <p className="text-xs text-[#5B5E7A] mt-0.5">Escola sugere: {it.marca_sugerida}</p>}
                                  {it.observacao && <p className="text-xs text-[#5B5E7A] mt-0.5">Obs. da escola: {it.observacao}</p>}
                                  {!it.marcado && <span className="inline-flex mt-1.5 h-[22px] px-2 rounded-full bg-[#F0EFF5] text-[#5B5E7A] text-[11px] font-bold items-center">Já tenho</span>}
                                  {it.marcado && (
                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                      <Contador valor={it.quantidade} onChange={(v) => mudarItemLista(i, 'quantidade', v)} rotulo={`Quantidade de ${it.descricao}`} />
                                      {it.marca_sugerida && (
                                        <div role="radiogroup" aria-label="Marca" className="inline-flex border border-[#E4E2EF] rounded-xl overflow-hidden">
                                          {[['marca', 'Essa marca'], ['similar', 'Aceito similar']].map(([k, r]) => (
                                            <button key={k} type="button" role="radio" aria-checked={it.preferencia === k} onClick={() => mudarItemLista(i, 'preferencia', k)} className={`h-11 px-3 text-[13px] whitespace-nowrap ${it.preferencia === k ? 'bg-[#EFE9FF] text-[#3C0DA8] font-bold' : 'bg-white text-[#5B5E7A] font-semibold'}`}>{r}</button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </li>
                            ))}
                            {!mostrarTodaLista && !buscaNaLista && filtrados.length > 12 && (
                              <li><button type="button" onClick={() => setMostrarTodaLista(true)} className="w-full min-h-[52px] bg-[#F7F3FF] text-[#3C0DA8] text-sm font-bold">Ver os outros {filtrados.length - 12} itens</button></li>
                            )}
                          </>
                        );
                      })()}
                    </ul>

                    <section className="space-y-2.5">
                      <h2 className={SECAO}>Itens fora da lista</h2>
                      {foraDaLista.map((f, i) => (
                        <div key={i} className="bg-white border border-[#E4E2EF] rounded-2xl p-3.5 space-y-3">
                          <div className="flex gap-2 items-start">
                            <label className="flex-1"><span className="sr-only">Item fora da lista {i + 1}</span><input className={ENTRADA} value={f.descricao} placeholder="Ex: Mochila de rodinhas" onChange={(e) => setForaDaLista(prev => prev.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)))} /></label>
                            <button type="button" aria-label="Remover item" onClick={() => setForaDaLista(prev => prev.filter((_, j) => j !== i))} className="w-12 h-12 shrink-0 rounded-xl text-[#C53036] hover:bg-[#FDECEC] flex items-center justify-center"><Icone nome="lixeira" tamanho={18} /></button>
                          </div>
                          <div className="flex gap-2 items-center">
                            <Contador valor={f.quantidade} onChange={(v) => setForaDaLista(prev => prev.map((x, j) => (j === i ? { ...x, quantidade: v } : x)))} rotulo="Quantidade" />
                            <input className={ENTRADA} value={f.observacao || ''} placeholder="Cor, tamanho… (opcional)" onChange={(e) => setForaDaLista(prev => prev.map((x, j) => (j === i ? { ...x, observacao: e.target.value } : x)))} aria-label="Observação" />
                          </div>
                        </div>
                      ))}
                      <button type="button" onClick={() => setForaDaLista(prev => [...prev, { descricao: '', quantidade: 1, observacao: '' }])} className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl border-[1.5px] border-dashed border-[#C9C6E0] text-sm font-bold hover:border-[#935DFF]">
                        <Icone nome="mais" tamanho={18} strokeWidth={2.4} /> Adicionar item fora da lista
                      </button>
                      <p className="text-xs text-[#5B5E7A]">Coisas que a papelaria vende e não estão na lista. Entram no mesmo preço final.</p>
                    </section>
                  </>
                ) : (
                  <>
                    {/* Perguntas do pedido inteiro */}
                    {perguntasPedido.filter(p => perguntaVisivel(p)).length > 0 && (
                      <section className="space-y-2.5">
                        <h2 className={SECAO}>Sobre o pedido</h2>
                        <div className="bg-white border border-[#E4E2EF] rounded-2xl p-4 space-y-4">
                          {perguntasPedido.filter(p => perguntaVisivel(p)).map(p => renderCampo(p, respostasPedido[p.id], (v) => setRespostasPedido(prev => ({ ...prev, [p.id]: v })), `pedido-${p.id}`))}
                        </div>
                      </section>
                    )}

                    {/* Produtos */}
                    <section className="space-y-2.5">
                      <h2 className={SECAO}>{items.length > 1 ? 'Produtos' : 'O que você precisa'}</h2>
                      {items.map((it, i) => (
                        <div key={i} className="bg-white border border-[#E4E2EF] rounded-2xl p-4 space-y-4">
                          {items.length > 1 && (
                            <div className="flex justify-between items-center -mb-1">
                              <p className="font-bold">Produto {i + 1}</p>
                              <button type="button" onClick={() => setItems(prev => prev.filter((_, j) => j !== i))} className="min-h-[40px] px-3 rounded-xl text-sm font-bold text-[#C53036] hover:bg-[#FDECEC]">Remover</button>
                            </div>
                          )}
                          <label className="block">
                            <span className={ROTULO}>{categoria?.rotulo_item || 'Produto'}</span>
                            <input className={ENTRADA} value={it.descricao} onChange={(e) => mudarItem(i, 'descricao', e.target.value)} placeholder="Descreva o produto" />
                          </label>
                          <div>
                            <span className={ROTULO}>Quantidade</span>
                            <Contador valor={it.quantidade} onChange={(v) => mudarItem(i, 'quantidade', v)} rotulo={`Quantidade do produto ${i + 1}`} />
                          </div>
                          {perguntasItem.filter(p => perguntaVisivel(p, it.respostas)).map(p => renderCampo(p, it.respostas[p.id], (v) => mudarRespostaItem(i, p.id, v), `item-${i}-${p.id}`))}
                          {!perguntasItem.some(p => p.tipo === 'foto') && (
                            <div>
                              <span className={ROTULO}>Foto <span className="font-normal text-[#8B88A6]">(opcional)</span></span>
                              <div className="flex items-center gap-3">
                                {it.imagem_url && <img src={it.imagem_url} alt="Foto do produto" className="w-16 h-16 rounded-xl object-cover border border-[#E4E2EF] shrink-0" />}
                                <label className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl cursor-pointer text-sm font-bold ${it.imagem_url ? 'border border-[#E4E2EF] bg-white' : 'border-[1.5px] border-dashed border-[#C9B6FB] bg-[#F7F3FF] text-[#3C0DA8]'}`}>
                                  <Icone nome="camera" tamanho={18} />
                                  {uploading === `foto-${i}` ? 'Enviando...' : it.imagem_url ? 'Trocar foto' : 'Tirar ou escolher foto'}
                                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => enviarFoto(`foto-${i}`, e.target.files[0], (url) => mudarItem(i, 'imagem_url', url))} />
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={() => setItems(prev => [...prev, ITEM_VAZIO()])} className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl border-[1.5px] border-dashed border-[#C9C6E0] text-sm font-bold hover:border-[#935DFF]">
                        <Icone nome="mais" tamanho={18} strokeWidth={2.4} /> Adicionar outro produto
                      </button>
                    </section>
                  </>
                )}

                {/* Como receber */}
                <section className="space-y-2.5">
                  <h2 className={SECAO}>Como receber</h2>
                  <div className="bg-white border border-[#E4E2EF] rounded-2xl p-4 space-y-4">
                    <label className="block">
                      <span className={ROTULO}>Cidade</span>
                      <select className={ENTRADA} value={cityId} onChange={(e) => setCityId(e.target.value)}>
                        <option value="">Escolha...</option>
                        {cities.map(c => <option key={c.id || c.nome} value={c.id || c.nome}>{c.nome}</option>)}
                      </select>
                    </label>
                    <div role="radiogroup" aria-label="Como receber" className="grid grid-cols-3 gap-2">
                      {OPCOES_RECEBIMENTO.map(op => (
                        <button key={op.key} type="button" role="radio" aria-checked={tipoRecebimento === op.key} onClick={() => setTipoRecebimento(op.key)} className={`${CHIP(tipoRecebimento === op.key)} flex-col !gap-1 py-2`}>
                          <Icone nome={op.icone} tamanho={18} />{op.titulo}
                        </button>
                      ))}
                    </div>
                    {(tipoRecebimento === 'entrega' || tipoRecebimento === 'ambos') && (
                      <label className="block"><span className={ROTULO}>Bairro para entrega</span><input className={ENTRADA} value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Digite o seu bairro" autoComplete="off" /></label>
                    )}
                  </div>
                </section>

                {/* Prazo para as lojas responderem */}
                <section className="space-y-2.5">
                  <h2 className={SECAO}>Prazo para as lojas responderem</h2>
                  <div role="radiogroup" aria-label="Prazo" className="grid grid-cols-3 gap-2">
                    {OPCOES_PRAZO.map(op => (
                      <button key={op.key} type="button" role="radio" aria-checked={prazoOpcao === op.key} onClick={() => setPrazoOpcao(op.key)} className={`${CHIP(prazoOpcao === op.key)} flex-col !gap-0 py-2`}>
                        <span>{op.titulo}</span><span className="text-xs font-semibold opacity-80">{op.sub}</span>
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}

            {/* ---------- 6. Revisar ---------- */}
            {passo === 'revisar' && (
              <>
                <section className="bg-white border border-[#E4E2EF] rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="w-11 h-11 rounded-xl bg-[#EFE9FF] text-[#5E17EB] flex items-center justify-center shrink-0"><Icone nome={modo === 'lista_escolar' ? 'escola' : iconePorNome(categoria?.nome)} tamanho={22} /></span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#5B5E7A]">{categoria?.nome}</p>
                      <p className="font-bold leading-tight">{modo === 'lista_escolar' ? `Lista escolar ${lista?.serie || ''}` : items.length === 1 ? items[0].descricao : `${items.length} produtos`}</p>
                    </div>
                  </div>
                  {destaquePrevia() && (
                    <p className="flex items-center gap-2 bg-[#F5F4FA] rounded-xl px-3 py-2 text-[13px]"><Icone nome={modo === 'lista_escolar' ? 'escola' : iconePorNome(categoria?.nome)} tamanho={16} className="text-[#5E17EB]" /><b>{destaquePrevia()}</b></p>
                  )}
                  <ul className="text-sm divide-y divide-[#F0EFF5]">
                    {(modo === 'lista_escolar'
                      ? [...marcadosLista.map(i => ({ d: i.descricao, q: i.quantidade, e: i.preferencia === 'similar' ? 'aceita similar' : i.marca_sugerida || '' })), ...foraDaLista.filter(f => f.descricao.trim()).map(f => ({ d: f.descricao, q: f.quantidade, e: 'fora da lista' }))]
                      : items.map(it => ({ d: it.descricao, q: it.quantidade, e: respostasItemSalvas(it).filter(r => r.valor !== false).map(r => (r.valor === true ? r.rotulo : r.valor)).join(' · ') }))
                    ).slice(0, 8).map((linha, i) => (
                      <li key={i} className="flex justify-between gap-3 py-2">
                        <span className="min-w-0">{linha.d}{linha.e && <span className="block text-xs text-[#5B5E7A]">{linha.e}</span>}</span>
                        <span className="font-bold shrink-0">× {linha.q}</span>
                      </li>
                    ))}
                  </ul>
                  {modo === 'lista_escolar' && marcadosLista.length + foraDaLista.length > 8 && <p className="text-xs text-[#5B5E7A]">+ {marcadosLista.length + foraDaLista.filter(f => f.descricao.trim()).length - 8} itens</p>}
                </section>
                <section className="bg-white border border-[#E4E2EF] rounded-2xl p-4 text-sm space-y-2">
                  <p className="flex justify-between gap-3"><span className="text-[#5B5E7A]">Receber</span><b>{OPCOES_RECEBIMENTO.find(o => o.key === tipoRecebimento)?.titulo}{tipoRecebimento !== 'retirada' && bairro ? ` · ${bairro}` : ''}</b></p>
                  <p className="flex justify-between gap-3"><span className="text-[#5B5E7A]">Cidade</span><b>{cidadeSelecionada?.nome}</b></p>
                  <p className="flex justify-between gap-3"><span className="text-[#5B5E7A]">Prazo das lojas</span><b>{OPCOES_PRAZO.find(o => o.key === prazoOpcao)?.sub}</b></p>
                </section>
              </>
            )}
          </main>

          {/* Rodapé fixo */}
          {(passo === 'formulario' || passo === 'revisar' || (passo === 'escola' && escolasComLista.length > 0)) && (
            <div className="sticky bottom-0 z-20 bg-white border-t border-[#E4E2EF] px-4 pt-3 pb-5 shadow-[0_-8px_24px_rgba(14,16,51,0.06)]">
              {rodapeLojas && passo !== 'escola' && <p className="text-[13px] text-[#5B5E7A] text-center mb-2">{rodapeLojas}</p>}
              {passo === 'escola' && (
                <button type="button" disabled={!listaId} onClick={abrirItensDaLista} className="w-full h-[52px] rounded-2xl bg-[#5E17EB] hover:bg-[#3C0DA8] disabled:opacity-50 text-white text-base font-bold flex items-center justify-center gap-2">
                  {lista ? `Ver a lista do ${lista.serie}` : 'Escolha a escola e a série'} <Icone nome="direita" tamanho={18} strokeWidth={2.2} />
                </button>
              )}
              {passo === 'formulario' && (
                <button type="button" onClick={irParaRevisao} disabled={!!uploading} className="w-full h-[52px] rounded-2xl bg-[#5E17EB] hover:bg-[#3C0DA8] disabled:opacity-50 text-white text-base font-bold flex items-center justify-center gap-2">
                  Revisar pedido <Icone nome="direita" tamanho={18} strokeWidth={2.2} />
                </button>
              )}
              {passo === 'revisar' && (
                <button type="button" onClick={handleSubmit} disabled={enviando} className="w-full h-[52px] rounded-2xl bg-[#5E17EB] hover:bg-[#3C0DA8] disabled:opacity-50 text-white text-base font-bold flex items-center justify-center gap-2">
                  <Icone nome="enviar" tamanho={18} /> {enviando ? 'Enviando...' : 'Pedir cotação'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
