// Helpers de autenticação/cadastro, compartilhados entre Admin e Representante.

// Depois de um supabase.auth.signUp(), o registro em auth.users pode levar
// uma fração de segundo pra ficar totalmente disponível pro banco. Se a
// gente tentar inserir em `profiles` (que tem uma foreign key pra
// auth.users) exatamente nesse intervalo, a inserção falha com erro de
// foreign key constraint — mesmo que o usuário tenha sido criado com
// sucesso. Isso deixa um login "órfão": existe no Auth, mas sem perfil.
// Numa tentativa seguinte com o mesmo e-mail, o Supabase corretamente
// recusa com "usuário já existe".
//
// Essa função tenta de novo automaticamente (com uma pequena espera)
// quando o erro for especificamente de foreign key, evitando esse problema.
export async function inserirPerfilComRetry(supabase, perfilData, tentativas = 4, esperaMs = 600) {
  let ultimoErro = null;

  for (let i = 0; i < tentativas; i++) {
    const { error } = await supabase.from('profiles').insert([perfilData]);
    if (!error) return { error: null };

    ultimoErro = error;
    const ehErroDeTiming = error.code === '23503' || (error.message || '').toLowerCase().includes('foreign key');
    if (!ehErroDeTiming) break;

    await new Promise((resolve) => setTimeout(resolve, esperaMs));
  }

  return { error: ultimoErro };
}

// Aceita e-mail de verdade OU telefone no campo de cadastro. Se for
// telefone, monta um "e-mail interno" fixo baseado nos dígitos — a pessoa
// nunca precisa saber disso, é só pra satisfazer o Supabase Auth (que
// exige um e-mail por baixo dos panos, mesmo pra quem loga por telefone).
export function montarEmailDeCadastro(entradaBruta) {
  const entrada = (entradaBruta || '').trim();
  const somenteDigitos = entrada.replace(/\D/g, '');
  const pareceTelefone = !entrada.includes('@') && somenteDigitos.length >= 8 &&
    somenteDigitos.length === entrada.replace(/[\s\-().]/g, '').length;

  if (pareceTelefone) {
    return { email: `${somenteDigitos}@fone.nunoselo.app`, ehTelefone: true };
  }
  return { email: entrada, ehTelefone: false };
}
