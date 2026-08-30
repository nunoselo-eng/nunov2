import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

// Painel correto de cada tipo de usuário, usado para redirecionar
// quem tenta acessar uma área que não é a dele.
const DASHBOARD_BY_ROLE = {
  admin: '/admin',
  lojista: '/lojista-dashboard',
  representante: '/representante-dashboard',
  cliente: '/client-dashboard',
};

/**
 * Bloqueia o acesso a uma rota até confirmar, direto no Supabase,
 * que o usuário logado tem o "tipo" (papel) permitido para ela.
 *
 * Uso:
 *   <Route path="/lojista-dashboard" element={
 *     <ProtectedRoute allowedRole="lojista">
 *       <LojistaDashboard />
 *     </ProtectedRoute>
 *   } />
 */
export default function ProtectedRoute({ allowedRole, children }) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'authorized' | 'blocked'
  const [redirectTo, setRedirectTo] = useState('/login');

  useEffect(() => {
    let ativo = true;

    async function verificarAcesso() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        if (ativo) {
          setRedirectTo('/login');
          setStatus('blocked');
        }
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('tipo, ativo')
        .eq('id', user.id)
        .single();

      if (error || !profile) {
        // Perfil não encontrado ou inacessível: não deixa passar.
        await supabase.auth.signOut();
        if (ativo) {
          setRedirectTo('/login');
          setStatus('blocked');
        }
        return;
      }

      if (profile.ativo === false) {
        await supabase.auth.signOut();
        if (ativo) {
          setRedirectTo('/login');
          setStatus('blocked');
        }
        return;
      }

      const role = profile.tipo === 'admin'
        ? 'admin'
        : profile.tipo === 'lojista'
          ? 'lojista'
          : profile.tipo === 'representante'
            ? 'representante'
            : 'cliente';

      if (role === allowedRole) {
        if (ativo) setStatus('authorized');
      } else {
        // Logado, mas na área errada: manda para o painel que É dele,
        // em vez de jogar de volta pro login (evita loop confuso).
        if (ativo) {
          setRedirectTo(DASHBOARD_BY_ROLE[role] || '/login');
          setStatus('blocked');
        }
      }
    }

    verificarAcesso();
    return () => { ativo = false; };
  }, [allowedRole]);

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Verificando permissões...</p>
      </div>
    );
  }

  if (status === 'blocked') {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}
