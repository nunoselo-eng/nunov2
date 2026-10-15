import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Icone, normalizar, FONTE_TITULO } from '../utils/nunoUI';

/* Admin · Listas escolares.
   Escola → série → ano letivo → itens. A lista só aparece para o cliente
   quando está "Publicada". Os itens podem ser colados de uma vez. */

const ENTRADA = 'w-full h-11 px-3 rounded-xl border border-[#E4E2EF] bg-white text-sm text-[#0E1033] focus:outline-none focus:border-[#5E17EB] focus:ring-2 focus:ring-[#5E17EB]/20';
const ROTULO = 'block text-[13px] font-semibold text-[#0E1033] mb-1.5';
const ANO_ATUAL = new Date().getFullYear();

// "4 cadernos universitários 10 matérias (Tilibra)" → { quantidade: 4, descricao: 'cadernos…', marca_sugerida: 'Tilibra' }
export function separarItensDaLista(texto) {
  return texto
    .split(/\r?\n/)
    .map(linha => linha.replace(/^\s*(?:[-•*·]|\d+[.)])\s+/, '').trim())
    .filter(Boolean)
    .map(linha => {
      let quantidade = 1;
      let resto = linha;
      const qtdInicio = resto.match(/^(\d{1,3})\s*(?:x|un\.?|und\.?|unidades?|p[çc]s?\.?)?\s*[-–:]?\s+(.+)$/i);
      if (qtdInicio) {
        quantidade = parseInt(qtdInicio[1], 10) || 1;
        resto = qtdInicio[2];
      } else {
        const qtdFim = resto.match(/^(.+?)\s*[-–:]\s*(\d{1,3})\s*(?:x|un\.?|und\.?|unidades?)?$/i);
        if (qtdFim) {
          quantidade = parseInt(qtdFim[2], 10) || 1;
          resto = qtdFim[1];
        }
      }
      let marca = '';
      const parenteses = resto.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
      if (parenteses) {
        resto = parenteses[1];
        marca = parenteses[2].trim();
      }
      const descricao = resto.charAt(0).toUpperCase() + resto.slice(1);
      return { descricao: descricao.trim(), quantidade, marca_sugerida: marca, observacao: '' };
    })
    .filter(item => item.descricao);
}

const LISTA_VAZIA = { id: null, escola_id: '', serie: '', ano_letivo: ANO_ATUAL + 1, status: 'rascunho' };

export default function AdminListasEscolares() {
  const [escolas, setEscolas] = useState([]);
  const [listas, setListas] = useState([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState(null);
  const [itens, setItens] = useState([]);
  const [textoColado, setTextoColado] = useState('');
  const [novaEscola, setNovaEscola] = useState(null); // { nome, cidade, parceira }
  const [salvando, setSalvando] = useState(false);
  const [mostrarTodosItens, setMostrarTodosItens] = useState(false);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setCarregando(true);
    const [{ data: e, error: e1 }, { data: l, error: e2 }] = await Promise.all([
      supabase.from('escolas').select('*').order('nome'),
      supabase.from('listas_escolares').select('*').order('ano_letivo', { ascending: false }),
    ]);
    if (e1 || e2) alert('Erro ao carregar: ' + (e1 || e2).message + '\n\nVocê já rodou o SQL categorias_fase1_estrutura.sql?');
    setEscolas(e || []);
    setListas(l || []);
    setCarregando(false);
  }

  const escolasFiltradas = escolas.filter(e => !busca || normalizar(e.nome).includes(normalizar(busca)));
  const escolaDoForm = escolas.find(e => String(e.id) === String(form?.escola_id));

  async function abrirLista(lista) {
    setForm({ ...lista });
    setTextoColado('');
    setMostrarTodosItens(false);
    const { data, error } = await supabase.from('lista_escolar_itens').select('*').eq('lista_id', lista.id).order('ordem');
    if (error) { alert('Erro ao carregar itens: ' + error.message); return; }
    setItens((data || []).map(i => ({ descricao: i.descricao, quantidade: i.quantidade, marca_sugerida: i.marca_sugerida || '', observacao: i.observacao || '' })));
  }

  const novaLista = (escolaId = '') => {
    setForm({ ...LISTA_VAZIA, escola_id: escolaId });
    setItens([]);
    setTextoColado('');
  };

  async function salvarEscola() {
    if (!novaEscola?.nome?.trim()) { alert('Dê o nome da escola.'); return; }
    const dados = { nome: novaEscola.nome.trim(), cidade: novaEscola.cidade?.trim() || null, parceira: !!novaEscola.parceira };
    const { data, error } = novaEscola.id
      ? await supabase.from('escolas').update(dados).eq('id', novaEscola.id).select().single()
      : await supabase.from('escolas').insert([dados]).select().single();
    if (error) { alert('Erro ao salvar escola: ' + error.message); return; }
    setNovaEscola(null);
    await carregar();
    if (form && !form.escola_id && data) setForm(f => ({ ...f, escola_id: data.id }));
  }

  async function excluirEscola(escola) {
    const qtd = listas.filter(l => l.escola_id === escola.id).length;
    if (!window.confirm(`Excluir a escola "${escola.nome}"${qtd ? ` e as ${qtd} lista(s) dela` : ''}? Pedidos já feitos não são apagados.`)) return;
    const { error } = await supabase.from('escolas').delete().eq('id', escola.id);
    if (error) { alert('Erro ao excluir: ' + error.message); return; }
    setForm(null);
    carregar();
  }

  const separarColado = () => {
    const novos = separarItensDaLista(textoColado);
    if (novos.length === 0) { alert('Não encontrei itens. Cole um item por linha.'); return; }
    setItens(prev => [...prev, ...novos]);
    setTextoColado('');
  };

  const mudarItem = (i, campo, valor) => setItens(prev => prev.map((it, j) => (j === i ? { ...it, [campo]: valor } : it)));

  async function salvarLista(status) {
    if (!form.escola_id) { alert('Escolha a escola.'); return; }
    if (!form.serie.trim()) { alert('Escreva a série / ano (ex: 3º ano).'); return; }
    const itensValidos = itens.filter(i => i.descricao.trim());
    if (status === 'publicada' && itensValidos.length === 0) { alert('A lista precisa de pelo menos 1 item para ser publicada.'); return; }
    setSalvando(true);
    try {
      const dados = { escola_id: form.escola_id, serie: form.serie.trim(), ano_letivo: Number(form.ano_letivo) || ANO_ATUAL, status, atualizado_em: new Date().toISOString() };
      let listaId = form.id;
      if (listaId) {
        const { error } = await supabase.from('listas_escolares').update(dados).eq('id', listaId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('listas_escolares').insert([dados]).select().single();
        if (error) throw error;
        listaId = data.id;
      }
      // Regrava os itens (mais simples e seguro que comparar um por um)
      const { error: errDel } = await supabase.from('lista_escolar_itens').delete().eq('lista_id', listaId);
      if (errDel) throw errDel;
      if (itensValidos.length > 0) {
        const { error: errIns } = await supabase.from('lista_escolar_itens').insert(itensValidos.map((it, i) => ({
          lista_id: listaId,
          ordem: i + 1,
          descricao: it.descricao.trim(),
          quantidade: parseInt(it.quantidade, 10) || 1,
          marca_sugerida: it.marca_sugerida?.trim() || null,
          observacao: it.observacao?.trim() || null,
        })));
        if (errIns) throw errIns;
      }
      setForm(f => ({ ...f, id: listaId, status }));
      await carregar();
      alert(status === 'publicada' ? 'Lista publicada! Já aparece para os clientes.' : 'Rascunho salvo.');
    } catch (err) {
      alert('Erro ao salvar lista: ' + err.message + (String(err.message).includes('duplicate') ? '\n\nJá existe uma lista dessa escola para essa série e esse ano.' : ''));
    } finally {
      setSalvando(false);
    }
  }

  async function excluirLista() {
    if (!form?.id) { setForm(null); return; }
    if (!window.confirm('Excluir esta lista? Pedidos já feitos com ela não são apagados.')) return;
    const { error } = await supabase.from('listas_escolares').delete().eq('id', form.id);
    if (error) { alert('Erro ao excluir: ' + error.message); return; }
    setForm(null);
    carregar();
  }

  if (carregando) {
    return <div className="bg-white rounded-2xl border border-[#E4E2EF] p-8 text-center text-sm text-[#5B5E7A]">Carregando listas escolares...</div>;
  }

  const itensVisiveis = mostrarTodosItens ? itens : itens.slice(0, 15);

  return (
    <div className="flex flex-col lg:flex-row gap-5 items-start text-[#0E1033]">

      {/* Escolas e listas */}
      <aside className="w-full lg:w-72 shrink-0 bg-white border border-[#E4E2EF] rounded-2xl p-2.5 space-y-2">
        <label className="flex items-center gap-2 h-11 px-3 border border-[#E4E2EF] rounded-xl">
          <Icone nome="busca" tamanho={16} className="text-[#5B5E7A]" />
          <span className="sr-only">Buscar escola</span>
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar escola" className="flex-1 min-w-0 border-none outline-none text-sm bg-transparent" />
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={() => setNovaEscola({ nome: '', cidade: '', parceira: true })} className="flex-1 h-10 rounded-xl border border-[#E4E2EF] text-[13px] font-bold hover:bg-[#F5F4FA]">+ Escola</button>
          <button type="button" onClick={() => novaLista()} className="flex-1 h-10 rounded-xl bg-[#5E17EB] text-white text-[13px] font-bold">+ Lista</button>
        </div>
        {escolasFiltradas.length === 0 && <p className="text-[13px] text-[#8B88A6] text-center py-4">Nenhuma escola cadastrada.</p>}
        {escolasFiltradas.map(escola => {
          const listasEscola = listas.filter(l => l.escola_id === escola.id).sort((a, b) => b.ano_letivo - a.ano_letivo || a.serie.localeCompare(b.serie, 'pt-BR', { numeric: true }));
          return (
            <div key={escola.id} className="pb-1">
              <div className="flex items-center gap-1.5 px-2 pt-2">
                <p className="text-[13px] font-bold flex-1 min-w-0 truncate">{escola.nome}</p>
                {escola.parceira && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#E3F5EC] text-[#0E7A4E]">Parceira</span>}
                <button type="button" aria-label={`Editar escola ${escola.nome}`} onClick={() => setNovaEscola({ ...escola, cidade: escola.cidade || '' })} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5B5E7A] hover:bg-[#F5F4FA]"><Icone nome="editar" tamanho={14} /></button>
              </div>
              {listasEscola.map(l => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => abrirLista(l)}
                  className={`w-full flex items-center justify-between min-h-[38px] pl-4 pr-2.5 rounded-xl text-left text-sm transition ${form?.id === l.id ? 'bg-[#EFE9FF] text-[#3C0DA8] font-bold' : 'font-semibold hover:bg-[#F5F4FA]'}`}
                >
                  <span>{l.serie} · {l.ano_letivo}</span>
                  <span className={`text-[11px] font-bold ${l.status === 'publicada' ? 'text-[#0E7A4E]' : 'text-[#8A5A00]'}`}>{l.status === 'publicada' ? 'Publicada' : 'Rascunho'}</span>
                </button>
              ))}
              <button type="button" onClick={() => novaLista(escola.id)} className="w-full text-left min-h-[34px] pl-4 text-[12px] font-bold text-[#5E17EB]">+ Nova lista desta escola</button>
            </div>
          );
        })}
      </aside>

      <section className="flex-1 min-w-0 w-full space-y-4">

        {/* Cadastro / edição de escola */}
        {novaEscola && (
          <div className="bg-white border-2 border-[#5E17EB] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">{novaEscola.id ? 'Editar escola' : 'Nova escola'}</h3>
              <button type="button" aria-label="Fechar" onClick={() => setNovaEscola(null)} className="w-10 h-10 rounded-xl flex items-center justify-center text-[#5B5E7A] hover:bg-[#F5F4FA]"><Icone nome="fechar" tamanho={18} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label><span className={ROTULO}>Nome</span><input className={ENTRADA} value={novaEscola.nome} onChange={(e) => setNovaEscola({ ...novaEscola, nome: e.target.value })} placeholder="Ex: Colégio Objetivo" /></label>
              <label><span className={ROTULO}>Cidade</span><input className={ENTRADA} value={novaEscola.cidade} onChange={(e) => setNovaEscola({ ...novaEscola, cidade: e.target.value })} placeholder="Ex: Macaé" /></label>
            </div>
            <label className="flex items-center gap-3 min-h-[44px] text-sm font-semibold cursor-pointer">
              <input type="checkbox" checked={!!novaEscola.parceira} onChange={(e) => setNovaEscola({ ...novaEscola, parceira: e.target.checked })} className="w-5 h-5 accent-[#5E17EB]" />
              Escola parceira (mostra o selo para o cliente)
            </label>
            <div className="flex gap-2">
              {novaEscola.id && <button type="button" onClick={() => excluirEscola(novaEscola)} className="h-11 px-4 rounded-xl border border-[#E4E2EF] text-sm font-bold text-[#C53036] hover:bg-[#FDECEC]">Excluir escola</button>}
              <button type="button" onClick={salvarEscola} className="h-11 px-5 rounded-xl bg-[#5E17EB] text-white text-sm font-bold ml-auto">Salvar escola</button>
            </div>
          </div>
        )}

        {!form && !novaEscola && (
          <div className="bg-white border border-dashed border-[#D6D3E6] rounded-2xl p-8 text-center text-sm text-[#5B5E7A]">
            Escolha uma lista à esquerda ou crie uma nova. Primeiro cadastre a escola.
          </div>
        )}

        {form && (
          <>
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[13px] font-semibold text-[#5B5E7A]">Lista sugerida {form.status === 'publicada' ? '· publicada' : '· rascunho'}</p>
                <h2 style={FONTE_TITULO} className="text-2xl font-bold tracking-tight">
                  {escolaDoForm ? escolaDoForm.nome : 'Nova lista'}{form.serie ? ` · ${form.serie}` : ''} · {form.ano_letivo}
                </h2>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={excluirLista} className="h-11 px-4 rounded-xl border border-[#E4E2EF] bg-white text-sm font-bold text-[#C53036] hover:bg-[#FDECEC]">{form.id ? 'Excluir' : 'Cancelar'}</button>
                <button type="button" onClick={() => salvarLista('rascunho')} disabled={salvando} className="h-11 px-4 rounded-xl border border-[#E4E2EF] bg-white text-sm font-bold disabled:opacity-60">Salvar rascunho</button>
                <button type="button" onClick={() => salvarLista('publicada')} disabled={salvando} className="h-11 px-5 rounded-xl bg-[#5E17EB] hover:bg-[#3C0DA8] text-white text-sm font-bold disabled:opacity-60">{salvando ? 'Salvando...' : 'Publicar lista'}</button>
              </div>
            </div>

            <div className="bg-white border border-[#E4E2EF] rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-[1.6fr_1fr_1fr] gap-3">
              <label>
                <span className={ROTULO}>Escola</span>
                <select className={ENTRADA} value={form.escola_id} onChange={(e) => setForm({ ...form, escola_id: e.target.value })}>
                  <option value="">Escolha...</option>
                  {escolas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              </label>
              <label><span className={ROTULO}>Série / ano</span><input className={ENTRADA} value={form.serie} onChange={(e) => setForm({ ...form, serie: e.target.value })} placeholder="Ex: 3º ano" /></label>
              <label><span className={ROTULO}>Ano letivo</span><input type="number" className={ENTRADA} value={form.ano_letivo} onChange={(e) => setForm({ ...form, ano_letivo: e.target.value })} /></label>
            </div>

            <div className="bg-white border border-[#E4E2EF] rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="text-base font-bold">Colar a lista da escola</h3>
                <span className="text-[13px] text-[#5B5E7A]">Um item por linha. A quantidade no começo e a marca entre parênteses.</span>
              </div>
              <textarea
                rows={5}
                value={textoColado}
                onChange={(e) => setTextoColado(e.target.value)}
                aria-label="Lista colada"
                placeholder={'4 cadernos universitários 10 matérias (Tilibra)\n1 caixa de lápis de cor 24 cores\n2 borrachas brancas'}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E4E2EF] font-mono text-[13px] leading-relaxed resize-y focus:outline-none focus:border-[#5E17EB]"
              />
              <button type="button" onClick={separarColado} disabled={!textoColado.trim()} className="h-11 px-4 rounded-xl bg-[#EFE9FF] text-[#3C0DA8] text-sm font-bold disabled:opacity-50">Separar em itens</button>
            </div>

            <div className="bg-white border border-[#E4E2EF] rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold">Itens da lista <span className="text-[#5B5E7A] font-semibold">· {itens.length}</span></h3>
                <button type="button" onClick={() => setItens(prev => [...prev, { descricao: '', quantidade: 1, marca_sugerida: '', observacao: '' }])} className="h-10 px-3.5 rounded-xl border-[1.5px] border-dashed border-[#C9C6E0] text-[13px] font-bold">+ Adicionar item</button>
              </div>
              {itens.length === 0 ? (
                <p className="text-sm text-[#8B88A6] text-center py-6 border border-dashed border-[#D6D3E6] rounded-xl">Cole a lista acima ou adicione item por item.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse min-w-[640px]">
                    <thead>
                      <tr className="text-left text-xs font-bold text-[#5B5E7A] uppercase tracking-wide border-b border-[#E4E2EF]">
                        <th className="py-2 pr-2 w-8">#</th><th className="py-2 pr-2">Item</th><th className="py-2 pr-2 w-20">Qtd</th><th className="py-2 pr-2 w-44">Marca sugerida</th><th className="py-2 pr-2 w-44">Observação</th><th className="py-2 w-10"><span className="sr-only">Remover</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {itensVisiveis.map((it, i) => (
                        <tr key={i} className="border-b border-[#F0EFF5]">
                          <td className="py-1.5 pr-2 text-[#8B88A6]">{i + 1}</td>
                          <td className="py-1.5 pr-2"><input className="w-full h-10 px-2.5 rounded-lg border border-[#E4E2EF]" value={it.descricao} aria-label={`Item ${i + 1}`} onChange={(e) => mudarItem(i, 'descricao', e.target.value)} /></td>
                          <td className="py-1.5 pr-2"><input type="number" min="1" className="w-full h-10 px-2.5 rounded-lg border border-[#E4E2EF]" value={it.quantidade} aria-label={`Quantidade do item ${i + 1}`} onChange={(e) => mudarItem(i, 'quantidade', e.target.value)} /></td>
                          <td className="py-1.5 pr-2"><input className="w-full h-10 px-2.5 rounded-lg border border-[#E4E2EF]" value={it.marca_sugerida} aria-label={`Marca do item ${i + 1}`} onChange={(e) => mudarItem(i, 'marca_sugerida', e.target.value)} /></td>
                          <td className="py-1.5 pr-2"><input className="w-full h-10 px-2.5 rounded-lg border border-[#E4E2EF]" value={it.observacao} aria-label={`Observação do item ${i + 1}`} onChange={(e) => mudarItem(i, 'observacao', e.target.value)} /></td>
                          <td className="py-1.5"><button type="button" aria-label={`Remover item ${i + 1}`} onClick={() => setItens(prev => prev.filter((_, j) => j !== i))} className="w-10 h-10 rounded-lg flex items-center justify-center text-[#8B88A6] hover:text-[#C53036] hover:bg-[#FDECEC]"><Icone nome="fechar" tamanho={16} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {itens.length > 15 && (
                <button type="button" onClick={() => setMostrarTodosItens(v => !v)} className="w-full min-h-[44px] rounded-xl bg-[#F7F3FF] text-[#3C0DA8] text-sm font-bold">
                  {mostrarTodosItens ? 'Mostrar menos' : `Mostrar todos os ${itens.length} itens`}
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
