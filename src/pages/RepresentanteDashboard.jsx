import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { createClient } from '@supabase/supabase-js';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.svg';

export default function RepresentanteDashboard() {
  const [userEmail, setUserEmail] = useState('');
  const [profile, setProfile] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const DIAS_SEMANA = [
    { key: 'dom', label: 'Dom' },
    { key: 'seg', label: 'Seg' },
    { key: 'ter', label: 'Ter' },
    { key: 'qua', label: 'Qua' },
    { key: 'qui', label: 'Qui' },
    { key: 'sex', label: 'Sex' },
    { key: 'sab', label: 'Sáb' },
  ];

  const toggleDia = (dias, setDias, diaKey) => {
    if (dias.includes(diaKey)) setDias(dias.filter(d => d !== diaKey));
    else setDias([...dias, diaKey]);
  };

  // --- Modal de Cadastro de Cliente ---
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [novoNomeCliente, setNovoNomeCliente] = useState('');
  const [novoEmailCliente, setNovoEmailCliente] = useState('');
  const [novaSenhaCliente, setNovaSenhaCliente] = useState('');
  const [novoTelefoneCliente, setNovoTelefoneCliente] = useState('');
  const [novaCidadeCliente, setNovaCidadeCliente] = useState('');

  // --- Modal de Cadastro de Lojista ---
  const [isLojistaModalOpen, setIsLojistaModalOpen] = useState(false);
  const [novoNomeLojista, setNovoNomeLojista] = useState('');
  const [novoEmailLojista, setNovoEmailLojista] = useState('');
  const [novaSenhaLojista, setNovaSenhaLojista] = useState('');
  const [novaCidadeLojista, setNovaCidadeLojista] = useState('');
  const [novoTelefoneLojista, setNovoTelefoneLojista] = useState('');
  const [novasCategoriasIds, setNovasCategoriasIds] = useState([]);
  const [novoHorarioAbertura, setNovoHorarioAbertura] = useState('08:00');
  const [novoHorarioFechamento, setNovoHorarioFechamento] = useState('18:00');
  const [novosDiasFuncionamento, setNovosDiasFuncionamento] = useState(['seg', 'ter', 'qua', 'qui', 'sex', 'sab']);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  useEffect(() => {
    fetchDadosIniciais();
  }, []);

  async function fetchDadosIniciais() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email || '');

      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (profileData) setProfile(profileData);

      const { data: catsData } = await supabase.from('categories').select('*');
      setCategories(catsData || []);
    } catch (err) {
      console.error('Erro:', err);
    }
    setLoading(false);
  }

  const saveCityIfNew = async (cityName) => {
    if (!cityName) return;
    const { data: existentes } = await supabase.from('cities').select('nome').ilike('nome', cityName.trim());
    if (!existentes || existentes.length === 0) {
      await supabase.from('cities').insert([{ nome: cityName.trim() }]);
    }
  };

  const handleCreateCliente = async (e) => {
    e.preventDefault();
    try {
      const supabaseUrl = supabase.supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = supabase.supabaseKey || import.meta.env.VITE_SUPABASE_ANON_KEY;

      const tempClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
      const { data: authData, error: authError } = await tempClient.auth.signUp({ email: novoEmailCliente, password: novaSenhaCliente });
      if (authError) throw authError;

      const userId = authData.user?.id;
      if (novaCidadeCliente) await saveCityIfNew(novaCidadeCliente);

      const { error: profileError } = await supabase.from('profiles').insert([{
        id: userId,
        tipo: 'cliente',
        nome: novoNomeCliente,
        cidade: novaCidadeCliente,
        telefone: novoTelefoneCliente,
        ativo: true
      }]);

      if (profileError) throw profileError;

      alert('Cliente cadastrado com sucesso!');
      setIsClientModalOpen(false);
      setNovoNomeCliente(''); setNovoEmailCliente(''); setNovaSenhaCliente(''); setNovaCidadeCliente(''); setNovoTelefoneCliente('');
    } catch (err) {
      alert('Erro ao cadastrar cliente: ' + err.message);
    }
  };

  const handleCreateLojista = async (e) => {
    e.preventDefault();
    try {
      const supabaseUrl = supabase.supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = supabase.supabaseKey || import.meta.env.VITE_SUPABASE_ANON_KEY;

      const tempClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
      const { data: authData, error: authError } = await tempClient.auth.signUp({ email: novoEmailLojista, password: novaSenhaLojista });
      if (authError) throw authError;

      const userId = authData.user?.id;
      if (novaCidadeLojista) await saveCityIfNew(novaCidadeLojista);

      const { error: profileError } = await supabase.from('profiles').insert([{
        id: userId,
        tipo: 'lojista',
        nome: novoNomeLojista,
        cidade: novaCidadeLojista,
        telefone: novoTelefoneLojista,
        ativo: true,
        horario_abertura: novoHorarioAbertura,
        horario_fechamento: novoHorarioFechamento,
        dias_funcionamento: novosDiasFuncionamento
      }]);

      if (profileError) throw profileError;

      if (novasCategoriasIds.length > 0) {
        const vinculos = novasCategoriasIds.map(catId => ({ lojista_id: userId, categoria_id: catId }));
        await supabase.from('lojista_categorias').insert(vinculos);
      }

      alert('Lojista cadastrado com sucesso!');
      setIsLojistaModalOpen(false);
      setNovoNomeLojista(''); setNovoEmailLojista(''); setNovaSenhaLojista(''); setNovaCidadeLojista(''); setNovoTelefoneLojista(''); setNovasCategoriasIds([]);
      setNovoHorarioAbertura('08:00'); setNovoHorarioFechamento('18:00'); setNovosDiasFuncionamento(['seg', 'ter', 'qua', 'qui', 'sex', 'sab']);
    } catch (err) {
      alert('Erro ao cadastrar lojista: ' + err.message);
    }
  };

  return (
    <div className="bg-[#f8f9fa] text-slate-700 min-h-screen flex flex-col justify-between font-sans">

      {/* Cabeçalho */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center hover:opacity-90 transition">
            <img src={logo} alt="Logo" className="h-10 w-auto object-contain" />
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {profile?.nome || userEmail || 'Representante'}
            </div>
            <button
              onClick={handleLogout}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6 flex-1">

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Painel do Representante</h1>
          <p className="text-sm text-slate-500 mt-0.5">Cadastre novos clientes e lojistas na plataforma</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setIsClientModalOpen(true)}
            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-left hover:border-indigo-300 hover:shadow-md transition space-y-2"
          >
            <span className="text-3xl">🧑</span>
            <h2 className="text-lg font-bold text-slate-800">Cadastrar Cliente</h2>
            <p className="text-xs text-slate-500">Cria um novo login de cliente com e-mail e senha.</p>
          </button>

          <button
            onClick={() => setIsLojistaModalOpen(true)}
            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-left hover:border-teal-300 hover:shadow-md transition space-y-2"
          >
            <span className="text-3xl">🏬</span>
            <h2 className="text-lg font-bold text-slate-800">Cadastrar Lojista</h2>
            <p className="text-xs text-slate-500">Cria um novo login de lojista, com categorias e horário.</p>
          </button>
        </div>

      </main>

      {/* Rodapé */}
      <footer className="mt-12 bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div>nunoselo.com — 2026 © Todos os direitos reservados</div>
      </footer>

      {/* Modal de Cadastro de Cliente */}
      {isClientModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateCliente} className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b">
              <h3 className="text-xl font-bold text-slate-800">Cadastrar Novo Cliente</h3>
              <button type="button" onClick={() => setIsClientModalOpen(false)} className="text-slate-400 font-bold">✕</button>
            </div>
            <input type="text" placeholder="Nome do Cliente" value={novoNomeCliente} onChange={(e) => setNovoNomeCliente(e.target.value)} className="w-full p-2.5 rounded-lg border text-sm" required />
            <input type="email" placeholder="E-mail" value={novoEmailCliente} onChange={(e) => setNovoEmailCliente(e.target.value)} className="w-full p-2.5 rounded-lg border text-sm" required />
            <input type="password" placeholder="Senha Inicial" value={novaSenhaCliente} onChange={(e) => setNovaSenhaCliente(e.target.value)} className="w-full p-2.5 rounded-lg border text-sm" required />
            <input type="text" placeholder="Cidade" value={novaCidadeCliente} onChange={(e) => setNovaCidadeCliente(e.target.value)} className="w-full p-2.5 rounded-lg border text-sm" />
            <input type="text" placeholder="Telefone / WhatsApp" value={novoTelefoneCliente} onChange={(e) => setNovoTelefoneCliente(e.target.value)} className="w-full p-2.5 rounded-lg border text-sm" />

            <div className="flex space-x-3 pt-3">
              <button type="button" onClick={() => setIsClientModalOpen(false)} className="w-1/2 bg-slate-200 text-slate-700 p-2 rounded-xl font-semibold text-sm">Cancelar</button>
              <button type="submit" className="w-1/2 bg-indigo-600 text-white p-2 rounded-xl font-semibold text-sm">Salvar</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal de Cadastro de Lojista */}
      {isLojistaModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateLojista} className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b">
              <h3 className="text-xl font-bold text-slate-800">Cadastrar Novo Lojista</h3>
              <button type="button" onClick={() => setIsLojistaModalOpen(false)} className="text-slate-400 font-bold">✕</button>
            </div>
            <input type="text" placeholder="Nome da Loja" value={novoNomeLojista} onChange={(e) => setNovoNomeLojista(e.target.value)} className="w-full p-2.5 rounded-lg border text-sm" required />
            <input type="email" placeholder="E-mail" value={novoEmailLojista} onChange={(e) => setNovoEmailLojista(e.target.value)} className="w-full p-2.5 rounded-lg border text-sm" required />
            <input type="password" placeholder="Senha Inicial" value={novaSenhaLojista} onChange={(e) => setNovaSenhaLojista(e.target.value)} className="w-full p-2.5 rounded-lg border text-sm" required />
            <input type="text" placeholder="Cidade" value={novaCidadeLojista} onChange={(e) => setNovaCidadeLojista(e.target.value)} className="w-full p-2.5 rounded-lg border text-sm" required />
            <input type="text" placeholder="Telefone / WhatsApp" value={novoTelefoneLojista} onChange={(e) => setNovoTelefoneLojista(e.target.value)} className="w-full p-2.5 rounded-lg border text-sm" />

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">Horário de Funcionamento</label>
              <div className="flex items-center gap-2 mb-2">
                <input type="time" value={novoHorarioAbertura} onChange={(e) => setNovoHorarioAbertura(e.target.value)} className="flex-1 p-2 rounded-lg border text-sm" />
                <span className="text-xs text-slate-400">até</span>
                <input type="time" value={novoHorarioFechamento} onChange={(e) => setNovoHorarioFechamento(e.target.value)} className="flex-1 p-2 rounded-lg border text-sm" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DIAS_SEMANA.map((dia) => (
                  <button
                    key={dia.key}
                    type="button"
                    onClick={() => toggleDia(novosDiasFuncionamento, setNovosDiasFuncionamento, dia.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                      novosDiasFuncionamento.includes(dia.key)
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-slate-50 text-slate-500 border-slate-300'
                    }`}
                  >
                    {dia.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">Categorias Atendidas</label>
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border">
                {categories.map((cat) => (
                  <label key={cat.id} className="flex items-center space-x-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={novasCategoriasIds.includes(cat.id)}
                      onChange={() => {
                        if (novasCategoriasIds.includes(cat.id)) setNovasCategoriasIds(novasCategoriasIds.filter(id => id !== cat.id));
                        else setNovasCategoriasIds([...novasCategoriasIds, cat.id]);
                      }}
                      className="w-4 h-4 text-teal-600 rounded"
                    />
                    <span>{cat.nome}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex space-x-3 pt-3">
              <button type="button" onClick={() => setIsLojistaModalOpen(false)} className="w-1/2 bg-slate-200 text-slate-700 p-2 rounded-xl font-semibold text-sm">Cancelar</button>
              <button type="submit" className="w-1/2 bg-teal-600 text-white p-2 rounded-xl font-semibold text-sm">Salvar</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
