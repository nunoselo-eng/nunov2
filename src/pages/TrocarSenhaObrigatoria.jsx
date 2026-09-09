import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import logo from '../assets/logo.svg';

export default function TrocarSenhaObrigatoria() {
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const navigate = useNavigate();

  const handleSalvar = async (e) => {
    e.preventDefault();
    setErro('');

    if (novaSenha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não conferem.');
      return;
    }

    setSalvando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setErro('Sessão expirada. Faça login novamente.');
        navigate('/');
        return;
      }

      const { error: updateAuthErr } = await supabase.auth.updateUser({ password: novaSenha });
      if (updateAuthErr) throw updateAuthErr;

      const { error: updateProfileErr } = await supabase
        .from('profiles')
        .update({ precisa_trocar_senha: false })
        .eq('id', user.id);
      if (updateProfileErr) throw updateProfileErr;

      const { data: profile } = await supabase.from('profiles').select('tipo').eq('id', user.id).single();

      if (profile?.tipo === 'admin') navigate('/admin');
      else if (profile?.tipo === 'lojista') navigate('/lojista-dashboard');
      else if (profile?.tipo === 'criador_de_contas') navigate('/representante-dashboard');
      else navigate('/client-dashboard');
    } catch (err) {
      setErro('Erro ao salvar nova senha: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="bg-[#f8f9fa] text-slate-700 min-h-screen flex flex-col justify-center items-center py-8 px-4 font-sans">
      <div className="w-full max-w-[440px] flex flex-col items-center">
        <div className="w-full bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-slate-200/80 p-8 sm:p-10 flex flex-col items-center">
          <Link to="/" className="mb-4 flex items-center justify-center hover:opacity-90 transition">
            <img src={logo} alt="Logo" className="w-[260px] h-auto object-contain" />
          </Link>

          <h2 className="text-lg font-bold text-slate-800 mb-1 text-center">Defina sua senha</h2>
          <p className="text-xs text-slate-500 mb-6 text-center">
            Essa é a primeira vez que você acessa com a senha provisória. Antes de continuar, crie uma senha só sua.
          </p>

          {erro && (
            <div className="w-full mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl text-center">
              {erro}
            </div>
          )}

          <form className="w-full flex flex-col gap-4" onSubmit={handleSalvar}>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nova senha</label>
              <input
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                required
                minLength={6}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Confirmar nova senha</label>
              <input
                type="password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                required
                minLength={6}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
              />
            </div>

            <button
              type="submit"
              disabled={salvando}
              className={`w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold rounded-xl transition duration-150 shadow-sm shadow-indigo-200 ${
                salvando ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {salvando ? 'Salvando...' : 'Salvar e continuar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
