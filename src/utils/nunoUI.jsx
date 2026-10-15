// Ícones, fontes e helpers visuais compartilhados das telas novas do Nuno.
// Ícones de traço (mesmo estilo do caminhão / loja / cartão). Nada de emoji.

/* ===================== Identidade visual do Nuno =====================
   Cores da marca: azul-marinho #00068F, roxo #5E17EB, lilás #935DFF.
   Texto #0E1033, texto secundário #5B5E7A, bordas #E4E2EF, fundo #F5F4FA.
   Verde (#0E7A4E) só pra economia/confirmado; âmbar (#8A5A00) pra prazo correndo. */

export const FONTE_TITULO = { fontFamily: "'Bricolage Grotesque', 'Manrope', system-ui, sans-serif" };
export const FONTE_TEXTO = { fontFamily: "'Manrope', system-ui, sans-serif" };

// Carrega as fontes da marca uma única vez (se preferir, mova esse <link> pro index.html)
export function carregarFontesNuno() {
  if (typeof document === 'undefined' || document.getElementById('fontes-nuno')) return;
  const link = document.createElement('link');
  link.id = 'fontes-nuno';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Manrope:wght@400;500;600;700;800&display=swap';
  document.head.appendChild(link);
}

// Ícones de traço (mesmo estilo do caminhão / loja / cartão). Nada de emoji.
export const ICONES = {
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
  pet: (<><circle cx="11" cy="4" r="2" /><circle cx="18" cy="8" r="2" /><circle cx="20" cy="16" r="2" /><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" /></>),
  carro: (<><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" /></>),
  farmacia: (<><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" /><path d="m8.5 8.5 7 7" /></>),
  papelaria: (<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />),
  construcao: (<><path d="M3 21h18" /><path d="M5 21V8l7-5 7 5v13" /><path d="M9 21v-6h6v6" /></>),
  escola: (<><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" /><path d="M22 10v6" /><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" /></>),
  lista: (<><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></>),
  grade: (<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>),
  raio: (<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />),
  gota: (<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />),
  rolo: (<><rect x="2" y="3" width="16" height="6" rx="2" /><path d="M10 9v3a2 2 0 0 1-2 2H6" /><path d="M18 6h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-8" /><rect x="10" y="16" width="4" height="6" rx="1" /></>),
  tijolo: (<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 12h20" /><path d="M12 4v8" /><path d="M7 12v8" /><path d="M17 12v8" /></>),
  chave: (<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />),
  telhado: (<><path d="M3 10 12 3l9 7" /><path d="M5 9v11h14V9" /></>),
  madeira: (<><rect x="3" y="5" width="18" height="5" rx="1" /><rect x="3" y="14" width="18" height="5" rx="1" /></>),
  balde: (<><path d="M4 7h16l-1.5 13h-13z" /><path d="M8 7V4h8v3" /></>),
  folha: (<><path d="M7 20h10" /><path d="M10 20c5.5-2.5.8-6.4 3-10" /><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" /><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" /></>),
  camadas: (<><path d="m12 2 10 5-10 5L2 7z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" /></>),
  martelo: (<><path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9" /><path d="m18 15 4-4" /><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5" /></>),
  ondas: (<><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" /><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" /><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" /></>),
  escudo: (<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />),
  lixeira: (<><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>),
  cima: (<path d="m18 15-6-6-6 6" />),
  editar: (<><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></>),
  repetir: (<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>),
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>),
  trofeu: (<><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></>),
  marcado: (<path d="m5 12 5 5 9-10" />),
  menos: (<path d="M5 12h14" />),
  enviar: (<><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></>),
  telefone: (<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />),
};

export function Icone({ nome, tamanho = 18, strokeWidth = 2, preenchido = false, className = '' }) {
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
export function FolhasNuno({ className = '' }) {
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

// Ícones disponíveis para setores e categorias (escolhidos no admin)
export const ICONES_CATEGORIA = [
  'papelaria', 'carro', 'pet', 'farmacia', 'construcao', 'tijolo', 'chave', 'raio', 'gota', 'rolo',
  'grade', 'telhado', 'madeira', 'balde', 'folha', 'camadas', 'martelo', 'ondas', 'escudo', 'caixa',
];

// Ícone padrão de uma categoria a partir do nome, quando o admin não escolheu
export function iconePorNome(nome = '') {
  const n = nome.toLowerCase();
  if (n.includes('papel')) return 'papelaria';
  if (n.includes('auto') || n.includes('pe\u00e7a') || n.includes('peca')) return 'carro';
  if (n.includes('pet')) return 'pet';
  if (n.includes('farm')) return 'farmacia';
  if (n.includes('el\u00e9tric') || n.includes('eletric')) return 'raio';
  if (n.includes('hidr')) return 'gota';
  if (n.includes('tinta')) return 'rolo';
  if (n.includes('ferrag') || n.includes('parafus')) return 'chave';
  if (n.includes('materia')) return 'tijolo';
  if (n.includes('revest') || n.includes('piso')) return 'grade';
  if (n.includes('telha') || n.includes('cobert')) return 'telhado';
  if (n.includes('madeira')) return 'madeira';
  if (n.includes('argamassa')) return 'balde';
  if (n.includes('jardin')) return 'folha';
  if (n.includes('gesso') || n.includes('drywall')) return 'camadas';
  if (n.includes('aluguel')) return 'martelo';
  if (n.includes('lazer') || n.includes('piscina')) return 'ondas';
  if (n.includes('impermeab')) return 'escudo';
  return 'caixa';
}

export const brl = (valor) => `R$ ${Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Texto sem acento e em minúsculas, para comparar e buscar
export const normalizar = (texto = '') => String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Monta a linha de destaque do card a partir das respostas marcadas "no card"
// respostas: [{ rotulo, valor, no_card }]
export function montarDestaque(respostasPedido = [], respostasPrimeiroItem = []) {
  const partes = [];
  [...respostasPedido, ...respostasPrimeiroItem].forEach(r => {
    if (!r || !r.no_card) return;
    if (r.valor === true) partes.push(r.rotulo);
    else if (r.valor === false || r.valor == null || r.valor === '') return;
    else partes.push(Array.isArray(r.valor) ? r.valor.join(', ') : String(r.valor));
  });
  return partes.join(' · ');
}
