// Componentes base do Design System Nuno.
// Seguem as regras de tokens.css: raio, sombra, cor e movimento exatos
// especificados no guia da marca. Importe daqui em vez de repetir classes
// Tailwind soltas pelas páginas.

/* ============================= BUTTON ============================= */
// variant: 'primary' | 'ghost' | 'danger'
// hero: true aplica --shadow-brand (só o CTA principal de uma tela deve usar isso)
export function Button({
  variant = 'primary',
  hero = false,
  icon: Icon,
  className = '',
  children,
  ...rest
}) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold text-sm rounded-control transition press-scale focus-ring disabled:bg-ink-100 disabled:text-ink-400 disabled:cursor-not-allowed disabled:shadow-none';

  const variants = {
    primary: `bg-violet-600 hover:bg-violet-hover active:bg-violet-active text-white ${hero ? 'shadow-brand' : 'shadow-xs'}`,
    ghost: 'bg-transparent hover:bg-violet-50 text-ink-700',
    danger: 'bg-transparent hover:bg-danger-bg text-danger',
  };

  return (
    <button className={`${base} ${variants[variant]} px-4 py-2.5 ${className}`} {...rest}>
      {Icon && <Icon size={20} strokeWidth={2} />}
      {children}
    </button>
  );
}

/* ============================== BADGE ============================== */
// Pílula de status. tone: 'brand' | 'success' | 'warning' | 'danger' | 'neutral'
// Regra semântica: verde só pra economia/aceita/disponível; âmbar pra prazo
// apertado; vermelho só pra erro/recusa. Nunca usar verde como cor de marca.
const BADGE_TONES = {
  brand: 'bg-violet-50 text-violet-600',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  neutral: 'bg-surface-sunken text-ink-700',
};

export function Badge({ tone = 'neutral', icon: Icon, children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${BADGE_TONES[tone]} ${className}`}>
      {Icon && <Icon size={16} strokeWidth={2} />}
      {children}
    </span>
  );
}

/* ============================== CARD ============================== */
// interactive: hover ganha shadow-md + leve elevação (só quando o card for clicável)
// selected: borda de marca + fundo violet-50, sem sombra extra
export function Card({ interactive = false, selected = false, className = '', children, ...rest }) {
  const base = 'bg-white rounded-card border transition';
  const state = selected
    ? 'border-[1.5px] border-violet-600 bg-violet-50'
    : interactive
      ? 'border-border-subtle shadow-xs hover:shadow-md hover:-translate-y-px hover:border-violet-200 cursor-pointer'
      : 'border-border-subtle shadow-xs';

  return (
    <div className={`${base} ${state} ${className}`} {...rest}>
      {children}
    </div>
  );
}

/* ============================ PRICE VALUE ============================ */
// Formata em BRL com centavos menores/apagados. economia=true usa a cor
// semântica de sucesso (é a única situação em que preço fica verde).
export function PriceValue({ value, economia = false, size = 'md' }) {
  const numero = Number(value || 0);
  const [reais, centavos] = numero.toFixed(2).split('.');
  const reaisFormatado = Number(reais).toLocaleString('pt-BR');

  const sizes = {
    sm: 'text-base',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  return (
    <span className={`font-display font-bold ${sizes[size]} ${economia ? 'text-success' : 'text-ink-700'}`}>
      R$ {reaisFormatado}
      <span className="text-[0.62em] font-semibold align-baseline text-ink-400">,{centavos}</span>
    </span>
  );
}

/* ============================ STEP PROGRESS ============================ */
// Barra de etapas de uma cotação. current = etapa atual (1-based), steps = total.
// A ponta do trecho preenchido usa um corte diagonal (motivo "lasca").
export function StepProgress({ current, steps = 4 }) {
  return (
    <div className="flex items-center gap-1.5 w-full">
      {Array.from({ length: steps }).map((_, i) => {
        const filled = i < current;
        const isTip = i === current - 1;
        return (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${filled ? 'bg-violet-600' : 'bg-ink-100'}`}
            style={isTip ? { clipPath: 'polygon(0 0, 88% 0, 100% 50%, 88% 100%, 0 100%)' } : undefined}
          />
        );
      })}
    </div>
  );
}
