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
