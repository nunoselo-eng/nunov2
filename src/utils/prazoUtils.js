// Utilitários para calcular o prazo de um pedido levando em conta o
// horário de funcionamento dos lojistas elegíveis (mesma categoria + cidade).
//
// Regra: o prazo do pedido só "corre" enquanto pelo menos um lojista
// elegível estiver dentro do próprio horário de funcionamento. Quando
// todos estão fechados, o prazo pausa; volta a rodar quando o primeiro
// reabre.

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

export function diaSemanaKey(date) {
  return DIAS[date.getDay()];
}

function paraMinutos(horaStr) {
  if (!horaStr) return null;
  const [h, m] = horaStr.split(':').map(Number);
  if (isNaN(h)) return null;
  return h * 60 + (m || 0);
}

// Une os horários de todos os lojistas que funcionam num determinado dia
// da semana, retornando uma lista de intervalos [inicioMin, fimMin] sem
// sobreposição (minutos desde a meia-noite).
function janelasDoDia(lojistas, diaKey) {
  const intervalos = (lojistas || [])
    .filter(l => (l.dias_funcionamento || []).includes(diaKey) && l.horario_abertura && l.horario_fechamento)
    .map(l => [paraMinutos(l.horario_abertura), paraMinutos(l.horario_fechamento)])
    .filter(([ini, fim]) => ini != null && fim != null && fim > ini)
    .sort((a, b) => a[0] - b[0]);

  const unidos = [];
  for (const [ini, fim] of intervalos) {
    const ultimo = unidos[unidos.length - 1];
    if (ultimo && ini <= ultimo[1]) {
      ultimo[1] = Math.max(ultimo[1], fim);
    } else {
      unidos.push([ini, fim]);
    }
  }
  return unidos;
}

// Existe pelo menos um lojista elegível aberto agora?
export function estaAbertoAgora(lojistas, agora = new Date()) {
  const diaKey = diaSemanaKey(agora);
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
  return janelasDoDia(lojistas, diaKey).some(([ini, fim]) => minutosAgora >= ini && minutosAgora < fim);
}

// Próximo momento (Date) em que algum lojista elegível vai abrir.
// Retorna null se nenhum lojista tiver horário configurado.
export function proximaAbertura(lojistas, agora = new Date()) {
  for (let i = 0; i < 14; i++) {
    const dia = new Date(agora);
    dia.setDate(dia.getDate() + i);
    const diaKey = diaSemanaKey(dia);
    for (const [ini] of janelasDoDia(lojistas, diaKey)) {
      const candidato = new Date(dia);
      candidato.setHours(0, ini, 0, 0);
      if (candidato > agora) return candidato;
    }
  }
  return null;
}

// Quantos ms "úteis" (dentro do horário de pelo menos um lojista elegível)
// se passaram entre duas datas.
export function calcularMsUteisDecorridos(inicio, fim, lojistas) {
  if (!(fim > inicio)) return 0;
  let totalMin = 0;
  const cursor = new Date(inicio);
  cursor.setHours(0, 0, 0, 0);

  while (cursor < fim) {
    const diaKey = diaSemanaKey(cursor);
    for (const [iniMin, fimMin] of janelasDoDia(lojistas, diaKey)) {
      const janelaInicio = new Date(cursor); janelaInicio.setHours(0, iniMin, 0, 0);
      const janelaFim = new Date(cursor); janelaFim.setHours(0, fimMin, 0, 0);
      const clipInicio = janelaInicio < inicio ? inicio : janelaInicio;
      const clipFim = janelaFim > fim ? fim : janelaFim;
      if (clipFim > clipInicio) totalMin += (clipFim - clipInicio) / 60000;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return totalMin * 60000;
}

// Status completo do prazo de um pedido, pronto para exibir na tela.
// `order` precisa de created_at e expira_em. `lojistas` é a lista de
// perfis elegíveis (mesma categoria + cidade) com horario_abertura,
// horario_fechamento e dias_funcionamento.
export function getStatusPrazo(order, lojistas, agora = new Date()) {
  if (!order?.created_at || !order?.expira_em) {
    return { expirado: false, pausado: false, texto: '' };
  }

  if (!lojistas || lojistas.length === 0) {
    return {
      expirado: false,
      pausado: true,
      texto: 'Aguardando lojistas disponíveis nesta categoria/cidade',
      proximaAberturaData: null,
    };
  }

  const inicio = new Date(order.created_at);
  const prazoTotalMs = new Date(order.expira_em) - inicio;
  const decorridoMs = calcularMsUteisDecorridos(inicio, agora, lojistas);
  const restanteMs = prazoTotalMs - decorridoMs;

  if (restanteMs <= 0) {
    return { expirado: true, pausado: false, texto: 'Prazo Encerrado' };
  }

  if (!estaAbertoAgora(lojistas, agora)) {
    const proxima = proximaAbertura(lojistas, agora);
    const horaTexto = proxima
      ? proxima.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : 'em breve';
    return {
      expirado: false,
      pausado: true,
      texto: `Pausado até as lojas abrirem (${horaTexto})`,
      proximaAberturaData: proxima,
    };
  }

  const totalMin = Math.floor(restanteMs / 60000);
  const horas = Math.floor(totalMin / 60);
  const minutos = totalMin % 60;
  const texto = horas > 0
    ? `Recebendo propostas por mais ${horas}h ${minutos}m`
    : `Recebendo propostas por mais ${minutos}m`;

  return { expirado: false, pausado: false, texto, restanteMs };
}

// Busca no Supabase os lojistas elegíveis (ativos, da categoria e cidade
// informadas) já com os campos de horário necessários.
// Aplica uma penalidade automática de reputação (-0,5) pra um pedido que
// expirou sem resposta — de cliente (recebeu proposta e ignorou) ou de
// lojista (pedido era elegível e ele nunca orçou). Idempotente: cada
// combinação pedido+tipo+pessoa só é processada uma vez, graças à
// restrição única na tabela `penalidades_processadas`.
export async function aplicarPenalidadeSeNecessario(supabase, orderId, tipo, usuarioId) {
  if (!orderId || !usuarioId) return;
  try {
    const { data: existente } = await supabase
      .from('penalidades_processadas')
      .select('id')
      .eq('order_id', orderId)
      .eq('tipo', tipo)
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    if (existente) return;

    await supabase
      .from('penalidades_processadas')
      .insert([{ order_id: orderId, tipo, usuario_id: usuarioId }]);
    // A média é recalculada automaticamente por um gatilho no banco.
  } catch (e) {
    console.error('Erro ao aplicar penalidade automática:', e);
  }
}

export async function buscarLojistasElegiveis(supabase, categoriaId, cidadeNome) {
  if (!categoriaId) return [];

  const { data: vinculos } = await supabase
    .from('lojista_categorias')
    .select('lojista_id')
    .eq('categoria_id', categoriaId);

  const lojistaIds = Array.from(new Set((vinculos || []).map(v => v.lojista_id).filter(Boolean)));
  if (lojistaIds.length === 0) return [];

  const { data: lojistas } = await supabase
    .from('profiles')
    .select('id, cidade, ativo, horario_abertura, horario_fechamento, dias_funcionamento')
    .in('id', lojistaIds);

  const cidadeRef = (cidadeNome || '').trim().toLowerCase();

  return (lojistas || []).filter(l => {
    if (l.ativo === false) return false;
    if (!cidadeRef) return true;
    const cidadeLojista = (l.cidade || '').trim().toLowerCase();
    return cidadeLojista.includes(cidadeRef) || cidadeRef.includes(cidadeLojista);
  });
}
