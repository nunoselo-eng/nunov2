import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Icone, ICONES_CATEGORIA, iconePorNome, normalizar, FONTE_TITULO } from '../utils/nunoUI';

/* Admin · Setores, categorias e perguntas de cada categoria.
   - Setor só organiza a tela do cliente (Construção → Elétrico, Tintas…).
   - Cada categoria tem suas perguntas: do pedido inteiro ou de cada produto.
   - Categorias com o mesmo nome (duplicadas) são tratadas como uma só. */

const TIPOS = [
  { value: 'texto', label: 'Texto' },
  { value: 'numero', label: 'Número' },
  { value: 'escolha_unica', label: 'Escolha única (botões)' },
  { value: 'escolha_multipla', label: 'Escolha múltipla' },
  { value: 'sim_nao', label: 'Sim / não' },
  { value: 'foto', label: 'Foto' },
  { value: 'veiculo', label: 'Veículo (marca, modelo, ano, versão)' },
];
const NOME_TIPO = Object.fromEntries(TIPOS.map(t => [t.value, t.label]));

const PERGUNTA_VAZIA = {
  id: null, nivel: 'pedido', rotulo: '', tipo: 'texto', opcoes: [], unidade: '', ajuda: '', placeholder: '',
  obrigatoria: false, mostrar_no_card: false, condicao_pergunta_id: null, condicao_valor: '', responde_lojista: false,
};

const ENTRADA = 'w-full h-11 px-3 rounded-xl border border-[#E4E2EF] bg-white text-sm text-[#0E1033] focus:outline-none focus:border-[#5E17EB] focus:ring-2 focus:ring-[#5E17EB]/20';
const ROTULO = 'block text-[13px] font-semibold text-[#0E1033] mb-1.5';

function Interruptor({ checked, onChange, rotulo, ajuda }) {
  return (
    <label className="flex items-center justify-between gap-3 min-h-[44px] cursor-pointer">
      <span className="text-sm font-semibold text-[#0E1033]">
        {rotulo}
        {ajuda && <span className="block text-xs font-normal text-[#5B5E7A]">{ajuda}</span>}
      </span>
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden="true" className="relative shrink-0 w-12 h-7 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-[#5E17EB]/40" style={{ background: checked ? '#5E17EB' : '#D6D3E6' }}>
        <span className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow-sm transition-all ${checked ? 'left-[23px]' : 'left-[3px]'}`} />
      </span>
    </label>
  );
}

export default function AdminCategorias() {
  const [setores, setSetores] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [selecao, setSelecao] = useState(null); // { tipo: 'setor' | 'categoria', id }
  const [formSetor, setFormSetor] = useState(null);
  const [formCategoria, setFormCategoria] = useState(null);
  const [perguntas, setPerguntas] = useState([]);
  const [editando, setEditando] = useState(null); // pergunta em edição
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setCarregando(true);
    const [{ data: s, error: e1 }, { data: c, error: e2 }] = await Promise.all([
      supabase.from('setores').select('*').order('ordem'),
      supabase.from('categories').select('*'),
    ]);
    if (e1 || e2) alert('Erro ao carregar: ' + (e1 || e2).message + '\n\nVocê já rodou o SQL categorias_fase1_estrutura.sql?');
    setSetores(s || []);
    setCategorias(c || []);
    setCarregando(false);
  }

  // Categorias únicas por nome (o banco pode ter nomes repetidos)
  const categoriasUnicas = categorias.filter((cat, i, arr) => arr.findIndex(o => normalizar(o.nome) === normalizar(cat.nome)) === i);
  const idsMesmoNome = (cat) => categorias.filter(c => normalizar(c.nome) === normalizar(cat?.nome)).map(c => c.id);
  const categoriaSelecionada = selecao?.tipo === 'categoria' ? categorias.find(c => String(c.id) === String(selecao.id)) : null;

  const ordenarCategorias = (lista) => [...lista].sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));

  async function carregarPerguntas(cat) {
    const { data, error } = await supabase
      .from('categoria_perguntas')
      .select('*')
      .in('categoria_id', idsMesmoNome(cat))
      .order('ordem');
    if (error) { alert('Erro ao carregar perguntas: ' + error.message); return; }
    setPerguntas(data || []);
  }

  const abrirSetor = (setor) => {
    setSelecao({ tipo: 'setor', id: setor?.id || null });
    setFormSetor(setor ? { ...setor } : { id: null, nome: '', icone: 'caixa', ordem: (setores.length + 1), ativo: true });
    setEditando(null);
  };

  const abrirCategoria = (cat) => {
    setSelecao({ tipo: 'categoria', id: cat.id });
    setFormCategoria({
      nome: cat.nome || '', setor_id: cat.setor_id || '', descricao_curta: cat.descricao_curta || '', rotulo_item: cat.rotulo_item || '',
      palavras_busca: cat.palavras_busca || '', aviso: cat.aviso || '', permite_lista_escolar: !!cat.permite_lista_escolar, ordem: cat.ordem || 0,
    });
    setEditando(null);
    carregarPerguntas(cat);
  };

  async function salvarSetor() {
    if (!formSetor.nome.trim()) { alert('Dê um nome ao setor.'); return; }
    setSalvando(true);
    const dados = { nome: formSetor.nome.trim(), icone: formSetor.icone, ordem: Number(formSetor.ordem) || 0, ativo: formSetor.ativo };
    const { error } = formSetor.id
      ? await supabase.from('setores').update(dados).eq('id', formSetor.id)
      : await supabase.from('setores').insert([dados]);
    setSalvando(false);
    if (error) { alert('Erro ao salvar setor: ' + error.message); return; }
    await carregar();
    alert('Setor salvo!');
  }

  async function excluirSetor() {
    if (!formSetor?.id) return;
    if (!window.confirm(`Excluir o setor "${formSetor.nome}"? As categorias dele ficam "sem setor", não são apagadas.`)) return;
    const { error } = await supabase.from('setores').delete().eq('id', formSetor.id);
    if (error) { alert('Erro ao excluir: ' + error.message); return; }
    setSelecao(null);
    carregar();
  }

  async function salvarCategoria() {
    setSalvando(true);
    const dados = {
      nome: formCategoria.nome.trim(),
      setor_id: formCategoria.setor_id || null,
      descricao_curta: formCategoria.descricao_curta.trim() || null,
      rotulo_item: formCategoria.rotulo_item.trim() || null,
      palavras_busca: formCategoria.palavras_busca.trim() || null,
      aviso: formCategoria.aviso.trim() || null,
      permite_lista_escolar: formCategoria.permite_lista_escolar,
      ordem: Number(formCategoria.ordem) || 0,
    };
    const { error } = await supabase.from('categories').update(dados).in('id', idsMesmoNome(categoriaSelecionada));
    setSalvando(false);
    if (error) { alert('Erro ao salvar categoria: ' + error.message); return; }
    await carregar();
    alert('Categoria salva!');
  }

  /* ----------------------------- Perguntas ----------------------------- */
  const novaPergunta = () => setEditando({ ...PERGUNTA_VAZIA });
  const editarPergunta = (p) => setEditando({
    ...PERGUNTA_VAZIA, ...p,
    opcoes: Array.isArray(p.opcoes) ? p.opcoes : [],
    unidade: p.unidade || '', ajuda: p.ajuda || '', placeholder: p.placeholder || '', condicao_valor: p.condicao_valor || '',
  });

  async function salvarPergunta() {
    const p = editando;
    if (!p.rotulo.trim()) { alert('Escreva o texto da pergunta.'); return; }
    if (p.responde_lojista && (p.tipo === 'veiculo' || p.tipo === 'foto')) { alert('O lojista não responde perguntas de veículo ou foto. Escolha outro tipo.'); return; }
    const usaOpcoes = p.tipo === 'escolha_unica' || p.tipo === 'escolha_multipla';
    const opcoes = usaOpcoes ? p.opcoes.map(o => o.trim()).filter(Boolean) : [];
    if (usaOpcoes && opcoes.length < 2) { alert('Coloque pelo menos 2 opções.'); return; }
    setSalvando(true);
    const dados = {
      categoria_id: p.id ? p.categoria_id : categoriaSelecionada.id,
      nivel: p.tipo === 'veiculo' ? 'pedido' : p.nivel,
      rotulo: p.rotulo.trim(),
      tipo: p.tipo,
      opcoes,
      unidade: p.tipo === 'numero' ? (p.unidade.trim() || null) : null,
      ajuda: p.ajuda.trim() || null,
      placeholder: p.placeholder.trim() || null,
      obrigatoria: p.obrigatoria,
      mostrar_no_card: p.responde_lojista ? false : p.mostrar_no_card,
      responde_lojista: !!p.responde_lojista,
      condicao_pergunta_id: p.condicao_pergunta_id || null,
      condicao_valor: p.condicao_pergunta_id ? (p.condicao_valor || null) : null,
      ordem: p.id ? p.ordem : (perguntas.reduce((m, x) => Math.max(m, x.ordem || 0), 0) + 1),
    };
    const { error } = p.id
      ? await supabase.from('categoria_perguntas').update(dados).eq('id', p.id)
      : await supabase.from('categoria_perguntas').insert([dados]);
    setSalvando(false);
    if (error) { alert('Erro ao salvar pergunta: ' + error.message); return; }
    setEditando(null);
    carregarPerguntas(categoriaSelecionada);
  }

  async function excluirPergunta(p) {
    if (!window.confirm(`Excluir a pergunta "${p.rotulo}"? Pedidos antigos continuam com as respostas que já têm.`)) return;
    const { error } = await supabase.from('categoria_perguntas').delete().eq('id', p.id);
    if (error) { alert('Erro ao excluir: ' + error.message); return; }
    if (editando?.id === p.id) setEditando(null);
    carregarPerguntas(categoriaSelecionada);
  }

  async function moverPergunta(indice, direcao) {
    const alvo = indice + direcao;
    if (alvo < 0 || alvo >= perguntas.length) return;
    const a = perguntas[indice];
    const b = perguntas[alvo];
    const ordemA = a.ordem ?? indice;
    const ordemB = b.ordem ?? alvo;
    await Promise.all([
      supabase.from('categoria_perguntas').update({ ordem: ordemB === ordemA ? alvo : ordemB }).eq('id', a.id),
      supabase.from('categoria_perguntas').update({ ordem: ordemB === ordemA ? indice : ordemA }).eq('id', b.id),
    ]);
    carregarPerguntas(categoriaSelecionada);
  }

  // Perguntas que podem servir de condição (escolha única ou sim/não)
  const perguntasCondicao = perguntas.filter(p => p.id !== editando?.id && (p.tipo === 'escolha_unica' || p.tipo === 'sim_nao'));
  const perguntaCondicao = perguntas.find(p => p.id === editando?.condicao_pergunta_id);
  const exemploDestaque = perguntas
    .filter(p => p.mostrar_no_card && !p.responde_lojista)
    .map(p => (p.tipo === 'veiculo' ? 'Gol 1.0 Trendline 2015' : p.tipo === 'sim_nao' ? p.rotulo : (p.opcoes?.[0] || `[${p.rotulo}]`)))
    .join(' · ');

  /* ------------------------------- Tela ------------------------------- */
  const grupos = [
    ...setores.map(s => ({ setor: s, cats: ordenarCategorias(categoriasUnicas.filter(c => String(c.setor_id) === String(s.id))) })),
    { setor: null, cats: ordenarCategorias(categoriasUnicas.filter(c => !c.setor_id || !setores.some(s => String(s.id) === String(c.setor_id)))) },
  ];

  if (carregando) {
    return <div className="bg-white rounded-2xl border border-[#E4E2EF] p-8 text-center text-sm text-[#5B5E7A]">Carregando setores e categorias...</div>;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-5 items-start text-[#0E1033]">

      {/* Coluna: setores e categorias */}
      <aside className="w-full lg:w-72 shrink-0 bg-white border border-[#E4E2EF] rounded-2xl p-2.5 space-y-1">
        <div className="flex items-center justify-between px-2 py-1.5">
          <p className="text-xs font-bold text-[#5B5E7A] uppercase tracking-wide">Setores e categorias</p>
          <button type="button" onClick={() => abrirSetor(null)} className="inline-flex items-center gap-1 h-9 px-2.5 rounded-lg text-xs font-bold text-[#5E17EB] hover:bg-[#F7F3FF]">
            <Icone nome="mais" tamanho={14} strokeWidth={2.4} /> Setor
          </button>
        </div>
        {grupos.map(({ setor, cats }) => (
          <div key={setor ? setor.id : 'sem'} className="pb-1">
            {setor ? (
              <button
                type="button"
                onClick={() => abrirSetor(setor)}
                className={`w-full flex items-center gap-2 min-h-[40px] px-2.5 rounded-xl text-left text-[13px] font-bold transition ${
                  selecao?.tipo === 'setor' && String(selecao.id) === String(setor.id) ? 'bg-[#EFE9FF] text-[#3C0DA8]' : 'hover:bg-[#F5F4FA]'
                } ${setor.ativo === false ? 'opacity-50' : ''}`}
              >
                <Icone nome={setor.icone || 'caixa'} tamanho={16} className="text-[#5E17EB]" />
                {setor.nome}
                <span className="ml-auto text-[11px] font-semibold text-[#8B88A6]">{cats.length}</span>
              </button>
            ) : cats.length > 0 && (
              <p className="flex items-center gap-2 min-h-[40px] px-2.5 text-[13px] font-bold text-[#C53036]">
                <Icone nome="alerta" tamanho={16} /> Sem setor
                <span className="ml-auto text-[11px] font-semibold">{cats.length}</span>
              </p>
            )}
            {cats.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => abrirCategoria(cat)}
                className={`w-full flex items-center gap-2 min-h-[40px] pl-8 pr-2.5 rounded-xl text-left text-sm transition ${
                  categoriaSelecionada && normalizar(categoriaSelecionada.nome) === normalizar(cat.nome) ? 'bg-[#EFE9FF] text-[#3C0DA8] font-bold' : 'font-semibold hover:bg-[#F5F4FA]'
                }`}
              >
                <span className="truncate">{cat.nome}</span>
                {cat.permite_lista_escolar && <Icone nome="escola" tamanho={14} className="text-[#0E7A4E] shrink-0" />}
              </button>
            ))}
          </div>
        ))}
        <p className="px-2.5 pt-2 text-[11px] text-[#8B88A6]">Para criar ou apagar categorias, use "Gerenciar Categorias" no menu.</p>
      </aside>

      {/* Coluna: edição */}
      <section className="flex-1 min-w-0 w-full space-y-4">
        {!selecao && (
          <div className="bg-white border border-dashed border-[#D6D3E6] rounded-2xl p-8 text-center text-sm text-[#5B5E7A]">
            Escolha um setor ou uma categoria na lista para editar.
          </div>
        )}

        {/* Editar setor */}
        {selecao?.tipo === 'setor' && formSetor && (
          <div className="bg-white border border-[#E4E2EF] rounded-2xl p-5 space-y-4">
            <h2 style={FONTE_TITULO} className="text-2xl font-bold tracking-tight">{formSetor.id ? 'Editar setor' : 'Novo setor'}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
              <label><span className={ROTULO}>Nome</span><input className={ENTRADA} value={formSetor.nome} onChange={(e) => setFormSetor({ ...formSetor, nome: e.target.value })} placeholder="Ex: Construção" /></label>
              <label><span className={ROTULO}>Ordem</span><input type="number" className={ENTRADA} value={formSetor.ordem} onChange={(e) => setFormSetor({ ...formSetor, ordem: e.target.value })} /></label>
            </div>
            <div>
              <span className={ROTULO}>Ícone</span>
              <div className="flex flex-wrap gap-2">
                {ICONES_CATEGORIA.map(ic => (
                  <button
                    key={ic}
                    type="button"
                    aria-label={`Ícone ${ic}`}
                    aria-pressed={formSetor.icone === ic}
                    onClick={() => setFormSetor({ ...formSetor, icone: ic })}
                    className={`w-11 h-11 rounded-xl flex items-center justify-center border transition ${formSetor.icone === ic ? 'border-2 border-[#5E17EB] bg-[#EFE9FF] text-[#5E17EB]' : 'border-[#E4E2EF] text-[#5B5E7A] hover:border-[#935DFF]'}`}
                  >
                    <Icone nome={ic} tamanho={20} />
                  </button>
                ))}
              </div>
            </div>
            <Interruptor checked={formSetor.ativo !== false} onChange={(v) => setFormSetor({ ...formSetor, ativo: v })} rotulo="Aparece para o cliente" />
            <div className="flex gap-2 pt-1">
              {formSetor.id && <button type="button" onClick={excluirSetor} className="h-11 px-4 rounded-xl border border-[#E4E2EF] text-sm font-bold text-[#C53036] hover:bg-[#FDECEC]">Excluir</button>}
              <button type="button" onClick={salvarSetor} disabled={salvando} className="h-11 px-5 rounded-xl bg-[#5E17EB] hover:bg-[#3C0DA8] disabled:opacity-60 text-white text-sm font-bold ml-auto">{salvando ? 'Salvando...' : 'Salvar setor'}</button>
            </div>
          </div>
        )}

        {/* Editar categoria */}
        {selecao?.tipo === 'categoria' && categoriaSelecionada && formCategoria && (
          <>
            <div className="bg-white border border-[#E4E2EF] rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-11 h-11 rounded-xl bg-[#EFE9FF] text-[#5E17EB] flex items-center justify-center"><Icone nome={iconePorNome(formCategoria.nome)} tamanho={22} /></span>
                <h2 style={FONTE_TITULO} className="text-2xl font-bold tracking-tight">{categoriaSelecionada.nome}</h2>
                {idsMesmoNome(categoriaSelecionada).length > 1 && (
                  <span className="text-xs font-semibold text-[#8A5A00] bg-[#FFF3D6] rounded-full px-2.5 py-1">{idsMesmoNome(categoriaSelecionada).length} cadastros com esse nome · mudo todos</span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label>
                  <span className={ROTULO}>Setor</span>
                  <select className={ENTRADA} value={formCategoria.setor_id} onChange={(e) => setFormCategoria({ ...formCategoria, setor_id: e.target.value })}>
                    <option value="">Sem setor</option>
                    {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                </label>
                <label><span className={ROTULO}>Ordem dentro do setor</span><input type="number" className={ENTRADA} value={formCategoria.ordem} onChange={(e) => setFormCategoria({ ...formCategoria, ordem: e.target.value })} /></label>
                <label><span className={ROTULO}>Frase de exemplo</span><input className={ENTRADA} value={formCategoria.descricao_curta} onChange={(e) => setFormCategoria({ ...formCategoria, descricao_curta: e.target.value })} placeholder="Ex: Fios, disjuntores, tomadas…" /></label>
                <label><span className={ROTULO}>Título do campo do produto</span><input className={ENTRADA} value={formCategoria.rotulo_item} onChange={(e) => setFormCategoria({ ...formCategoria, rotulo_item: e.target.value })} placeholder="Ex: Qual peça?" /></label>
                <label className="sm:col-span-2">
                  <span className={ROTULO}>Palavras para a busca</span>
                  <input className={ENTRADA} value={formCategoria.palavras_busca} onChange={(e) => setFormCategoria({ ...formCategoria, palavras_busca: e.target.value })} placeholder="Ex: cimento, areia, brita, tijolo" />
                  <span className="block text-xs text-[#5B5E7A] mt-1">Separe por vírgula. O cliente que buscar "cimento" encontra esta categoria.</span>
                </label>
                <label className="sm:col-span-2">
                  <span className={ROTULO}>Aviso fixo (opcional)</span>
                  <textarea rows={2} className="w-full px-3 py-2.5 rounded-xl border border-[#E4E2EF] text-sm resize-none focus:outline-none focus:border-[#5E17EB]" value={formCategoria.aviso} onChange={(e) => setFormCategoria({ ...formCategoria, aviso: e.target.value })} placeholder="Aparece no topo do formulário do pedido" />
                </label>
              </div>
              <Interruptor
                checked={formCategoria.permite_lista_escolar}
                onChange={(v) => setFormCategoria({ ...formCategoria, permite_lista_escolar: v })}
                rotulo="Tem lista escolar"
                ajuda="Mostra a opção Lista escolar ao pedir nesta categoria"
              />
              <div className="flex justify-end">
                <button type="button" onClick={salvarCategoria} disabled={salvando} className="h-11 px-5 rounded-xl bg-[#5E17EB] hover:bg-[#3C0DA8] disabled:opacity-60 text-white text-sm font-bold">{salvando ? 'Salvando...' : 'Salvar categoria'}</button>
              </div>
            </div>

            <div className="bg-white border border-[#E4E2EF] rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-base font-bold">Perguntas do pedido</h3>
                  <p className="text-[13px] text-[#5B5E7A]">O cliente responde ao pedir. Sem perguntas, a categoria usa só produto, quantidade e foto.</p>
                </div>
                <button type="button" onClick={novaPergunta} className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-[#5E17EB] hover:bg-[#3C0DA8] text-white text-sm font-bold">
                  <Icone nome="mais" tamanho={16} strokeWidth={2.4} /> Adicionar pergunta
                </button>
              </div>

              {exemploDestaque && (
                <p className="flex items-center gap-2 bg-[#F5F4FA] rounded-xl px-3 py-2 text-[13px]">
                  <Icone nome="info" tamanho={16} className="text-[#5E17EB]" />
                  <span><span className="text-[#5B5E7A]">Linha de destaque no card, por exemplo:</span> <b>{exemploDestaque}</b></span>
                </p>
              )}

              {perguntas.length === 0 ? (
                <p className="text-sm text-[#8B88A6] text-center py-6 border border-dashed border-[#D6D3E6] rounded-xl">Nenhuma pergunta ainda.</p>
              ) : (
                <ol className="space-y-2">
                  {perguntas.map((p, i) => (
                    <li key={p.id} className={`flex items-center gap-2 border rounded-xl p-2.5 ${editando?.id === p.id ? 'border-2 border-[#5E17EB] bg-[#F7F3FF]' : 'border-[#E4E2EF]'}`}>
                      <div className="flex flex-col shrink-0">
                        <button type="button" aria-label="Subir" onClick={() => moverPergunta(i, -1)} disabled={i === 0} className="w-8 h-6 flex items-center justify-center text-[#5B5E7A] disabled:opacity-30"><Icone nome="cima" tamanho={16} /></button>
                        <button type="button" aria-label="Descer" onClick={() => moverPergunta(i, 1)} disabled={i === perguntas.length - 1} className="w-8 h-6 flex items-center justify-center text-[#5B5E7A] disabled:opacity-30"><Icone nome="baixo" tamanho={16} /></button>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">{p.rotulo}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#F0EFF5] text-[#5B5E7A]">{p.nivel === 'item' ? 'Cada produto' : 'Pedido inteiro'}</span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#F0EFF5] text-[#5B5E7A]">{NOME_TIPO[p.tipo] || p.tipo}{(p.opcoes || []).length > 0 ? ` · ${(p.opcoes || []).length} opções` : ''}</span>
                          {p.obrigatoria && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FDECEC] text-[#C53036]">Obrigatória</span>}
                          {p.responde_lojista && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#E3F5EC] text-[#0E7A4E]">Lojista responde</span>}
                          {p.mostrar_no_card && !p.responde_lojista && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#EFE9FF] text-[#3C0DA8]">No card</span>}
                          {p.condicao_pergunta_id && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#E7EEFF] text-[#1D4ED8]">
                              Só se {perguntas.find(x => x.id === p.condicao_pergunta_id)?.rotulo || '?'} = {p.condicao_valor}
                            </span>
                          )}
                        </div>
                      </div>
                      <button type="button" onClick={() => editarPergunta(p)} aria-label={`Editar ${p.rotulo}`} className="w-10 h-10 rounded-xl border border-[#E4E2EF] flex items-center justify-center text-[#0E1033] hover:bg-[#F5F4FA]"><Icone nome="editar" tamanho={16} /></button>
                      <button type="button" onClick={() => excluirPergunta(p)} aria-label={`Excluir ${p.rotulo}`} className="w-10 h-10 rounded-xl flex items-center justify-center text-[#C53036] hover:bg-[#FDECEC]"><Icone nome="lixeira" tamanho={16} /></button>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* Editor da pergunta */}
            {editando && (
              <div className="bg-white border-2 border-[#5E17EB] rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold">{editando.id ? 'Editar pergunta' : 'Nova pergunta'}</h3>
                  <button type="button" onClick={() => setEditando(null)} aria-label="Fechar edição" className="w-10 h-10 rounded-xl flex items-center justify-center text-[#5B5E7A] hover:bg-[#F5F4FA]"><Icone nome="fechar" tamanho={18} /></button>
                </div>
                <div>
                  <span className={ROTULO}>Quem responde</span>
                  <div role="radiogroup" aria-label="Quem responde" className="grid grid-cols-2 gap-2">
                    {[[false, 'O cliente, ao pedir'], [true, 'O lojista, na proposta']].map(([v, r]) => (
                      <button
                        key={r}
                        type="button"
                        role="radio"
                        aria-checked={!!editando.responde_lojista === v}
                        onClick={() => setEditando({ ...editando, responde_lojista: v })}
                        className={`min-h-[44px] px-3 rounded-xl text-sm transition ${!!editando.responde_lojista === v ? 'border-2 border-[#5E17EB] bg-[#EFE9FF] text-[#3C0DA8] font-bold' : 'border border-[#E4E2EF] font-semibold'}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  {editando.responde_lojista && <p className="text-xs text-[#5B5E7A] mt-1.5">O cliente não vê esta pergunta ao pedir. Ele vê a resposta de cada loja na hora de comparar.</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="sm:col-span-2"><span className={ROTULO}>Texto da pergunta</span><input className={ENTRADA} value={editando.rotulo} onChange={(e) => setEditando({ ...editando, rotulo: e.target.value })} placeholder="Ex: Preferência" /></label>
                  <label>
                    <span className={ROTULO}>Tipo de resposta</span>
                    <select className={ENTRADA} value={editando.tipo} onChange={(e) => setEditando({ ...editando, tipo: e.target.value })}>
                      {TIPOS.filter(t => !editando.responde_lojista || (t.value !== 'veiculo' && t.value !== 'foto')).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className={ROTULO}>Vale para</span>
                    <select className={ENTRADA} value={editando.tipo === 'veiculo' ? 'pedido' : editando.nivel} disabled={editando.tipo === 'veiculo'} onChange={(e) => setEditando({ ...editando, nivel: e.target.value })}>
                      <option value="pedido">O pedido inteiro (responde 1 vez)</option>
                      <option value="item">Cada produto do pedido</option>
                    </select>
                  </label>
                  {editando.tipo === 'numero' && (
                    <label><span className={ROTULO}>Unidade</span><input className={ENTRADA} value={editando.unidade} onChange={(e) => setEditando({ ...editando, unidade: e.target.value })} placeholder="Ex: dias, kg, m²" /></label>
                  )}
                  {(editando.tipo === 'texto' || editando.tipo === 'numero') && (
                    <label><span className={ROTULO}>Exemplo dentro do campo</span><input className={ENTRADA} value={editando.placeholder} onChange={(e) => setEditando({ ...editando, placeholder: e.target.value })} placeholder="Ex: 500 mg" /></label>
                  )}
                  <label className="sm:col-span-2"><span className={ROTULO}>Texto de ajuda (opcional)</span><input className={ENTRADA} value={editando.ajuda} onChange={(e) => setEditando({ ...editando, ajuda: e.target.value })} placeholder="Aparece embaixo do campo" /></label>
                </div>

                {(editando.tipo === 'escolha_unica' || editando.tipo === 'escolha_multipla') && (
                  <div>
                    <span className={ROTULO}>Opções</span>
                    <div className="space-y-2">
                      {editando.opcoes.map((op, i) => (
                        <div key={i} className="flex gap-2">
                          <input className={ENTRADA} value={op} aria-label={`Opção ${i + 1}`} onChange={(e) => setEditando({ ...editando, opcoes: editando.opcoes.map((o, j) => (j === i ? e.target.value : o)) })} />
                          <button type="button" aria-label={`Remover opção ${i + 1}`} onClick={() => setEditando({ ...editando, opcoes: editando.opcoes.filter((_, j) => j !== i) })} className="w-11 h-11 shrink-0 rounded-xl bg-[#F5F4FA] text-[#5B5E7A] flex items-center justify-center"><Icone nome="fechar" tamanho={16} /></button>
                        </div>
                      ))}
                      <button type="button" onClick={() => setEditando({ ...editando, opcoes: [...editando.opcoes, ''] })} className="w-full h-11 rounded-xl border-[1.5px] border-dashed border-[#C9C6E0] text-sm font-bold">+ Adicionar opção</button>
                    </div>
                  </div>
                )}

                <div className="border-t border-[#E4E2EF] pt-2">
                  <Interruptor checked={editando.obrigatoria} onChange={(v) => setEditando({ ...editando, obrigatoria: v })} rotulo="Obrigatória" />
                  {!editando.responde_lojista && (
                    <Interruptor checked={editando.mostrar_no_card} onChange={(v) => setEditando({ ...editando, mostrar_no_card: v })} rotulo="Mostrar no card do pedido" ajuda="Entra na linha de destaque que o lojista vê" />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label>
                    <span className={ROTULO}>Mostrar só quando</span>
                    <select className={ENTRADA} value={editando.condicao_pergunta_id || ''} onChange={(e) => setEditando({ ...editando, condicao_pergunta_id: e.target.value ? Number(e.target.value) : null, condicao_valor: '' })}>
                      <option value="">Sempre</option>
                      {perguntasCondicao.map(p => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
                    </select>
                  </label>
                  {perguntaCondicao && (
                    <label>
                      <span className={ROTULO}>For igual a</span>
                      <select className={ENTRADA} value={editando.condicao_valor} onChange={(e) => setEditando({ ...editando, condicao_valor: e.target.value })}>
                        <option value="">Escolha...</option>
                        {(perguntaCondicao.tipo === 'sim_nao' ? ['Sim', 'Não'] : (perguntaCondicao.opcoes || [])).map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </label>
                  )}
                </div>

                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setEditando(null)} className="h-11 px-4 rounded-xl border border-[#E4E2EF] text-sm font-bold">Cancelar</button>
                  <button type="button" onClick={salvarPergunta} disabled={salvando} className="h-11 px-5 rounded-xl bg-[#5E17EB] hover:bg-[#3C0DA8] disabled:opacity-60 text-white text-sm font-bold">{salvando ? 'Salvando...' : 'Salvar pergunta'}</button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
