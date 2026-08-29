import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { createClient } from '@supabase/supabase-js';

export default function AdminDashboard() {
  const [lojistas, setLojistas] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedCityFilter, setSelectedCityFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal de Cadastro de Lojista
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [novaCidade, setNovaCidade] = useState('');
  const [isNewCityCreate, setIsNewCityCreate] = useState(false);
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novasCategoriasIds, setNovasCategoriasIds] = useState([]);

  // Modal de Edição de Lojista
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLojistaId, setEditingLojistaId] = useState(null);
  const [editNome, setEditNome] = useState('');
  const [editCidade, setEditCidade] = useState('');
  const [isNewCityEdit, setIsNewCityEdit] = useState(false);
  const [editTelefone, setEditTelefone] = useState('');

  // Modal de Gerenciamento de Categorias
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('');
  const [editingCatId, setEditingCatId] = useState(null);
  const [editingCatNome, setEditingCatNome] = useState('');

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);

    // 1. Busca Lojistas
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .eq('tipo', 'lojista');

    // 2. Busca Categorias (Deduplicando pelo NOME)
    const { data: catsData } = await supabase.from('categories').select('*');
    const uniqueCategoriesMap = new Map();
    (catsData || []).forEach(cat => {
      const nomeChave = cat.nome?.trim().toLowerCase();
      if (nomeChave && !uniqueCategoriesMap.has(nomeChave)) {
        uniqueCategoriesMap.set(nomeChave, cat);
      }
    });

    // 3. Busca Cidades Cadastradas
    const { data: citiesData } = await supabase.from('cities').select('*');
    const uniqueCitiesMap = new Map();
    (citiesData || []).forEach(c => {
      if (c.nome && !uniqueCitiesMap.has(c.nome.trim().toLowerCase())) {
        uniqueCitiesMap.set(c.nome.trim().toLowerCase(), c);
      }
    });

    // 4. Busca Vínculos de Categorias
    const { data: vinculosData } = await supabase.from('lojista_categorias').select('*');

    const formatted = (profilesData || []).map(lojista => {
      const catIds = (vinculosData || [])
        .filter(v => v.lojista_id === lojista.id)
        .map(v => v.categoria_id);

      return {
        ...lojista,
        categoriasSelecionadas: catIds,
        ativo: lojista.ativo ?? true
      };
    });

    setLojistas(formatted);
    setCategories(Array.from(uniqueCategoriesMap.values()));
    setCities(Array.from(uniqueCitiesMap.values()));
    setLoading(false);
  }

  const saveCityIfNew = async (cityName) => {
    if (!cityName) return;
    const exists = cities.some(c => c.nome.toLowerCase() === cityName.trim().toLowerCase());
    if (!exists) {
      await supabase.from('cities').insert([{ nome: cityName.trim() }]);
    }
  };

  // Funções de Gestão de Categorias
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!novaCategoriaNome.trim()) return;

    try {
      const { error } = await supabase
        .from('categories')
        .insert([{ nome: novaCategoriaNome.trim() }]);

      if (error) throw error;

      alert('Categoria cadastrada com sucesso!');
      setNovaCategoriaNome('');
      fetchData();
    } catch (err) {
      alert('Erro ao cadastrar categoria: ' + err.message);
    }
  };

  const handleSaveEditCategory = async (catId) => {
    if (!editingCatNome.trim()) return;

    try {
      const { error } = await supabase
        .from('categories')
        .update({ nome: editingCatNome.trim() })
        .eq('id', catId);

      if (error) throw error;

      alert('Categoria atualizada com sucesso!');
      setEditingCatId(null);
      setEditingCatNome('');
      fetchData();
    } catch (err) {
      alert('Erro ao atualizar categoria: ' + err.message);
    }
  };

  const handleToggleAtivo = async (lojistaId, statusAtual) => {
    const novoStatus = !statusAtual;
    const { error } = await supabase
      .from('profiles')
      .update({ ativo: novoStatus })
      .eq('id', lojistaId);

    if (error) {
      alert('Erro ao atualizar status: ' + error.message);
    } else {
      setLojistas(lojistas.map(l => l.id === lojistaId ? { ...l, ativo: novoStatus } : l));
    }
  };

  const handleCategoryChange = async (lojistaId, catId) => {
    const lojista = lojistas.find(l => l.id === lojistaId);
    let novasCategorias = [...lojista.categoriasSelecionadas];

    if (novasCategorias.includes(catId)) {
      novasCategorias = novasCategorias.filter(id => id !== catId);
      await supabase
        .from('lojista_categorias')
        .delete()
        .eq('lojista_id', lojistaId)
        .eq('categoria_id', catId);
    } else {
      novasCategorias.push(catId);
      await supabase.from('lojista_categorias').insert([{ lojista_id: lojistaId, categoria_id: catId }]);
    }

    setLojistas(lojistas.map(l => l.id === lojistaId ? { ...l, categoriasSelecionadas: novasCategorias } : l));
  };

  const handleCreateLojista = async (e) => {
    e.preventDefault();
    try {
      const supabaseUrl = supabase.supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = supabase.supabaseKey || import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Credenciais do Supabase não encontradas no ambiente.');
      }

      const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false }
      });

      const { data: authData, error: authError } = await tempClient.auth.signUp({
        email: novoEmail,
        password: novaSenha,
      });

      if (authError) throw authError;

      const userId = authData.user?.id;
      if (!userId) throw new Error('Erro ao gerar ID do usuário.');

      if (novaCidade) {
        await saveCityIfNew(novaCidade);
      }

      const { error: profileError } = await supabase.from('profiles').insert([
        {
          id: userId,
          tipo: 'lojista',
          nome: novoNome,
          cidade: novaCidade,
          telefone: novoTelefone,
          ativo: true
        }
      ]);

      if (profileError) throw profileError;

      if (novasCategoriasIds.length > 0) {
        const vinculos = novasCategoriasIds.map(catId => ({
          lojista_id: userId,
          categoria_id: catId
        }));
        await supabase.from('lojista_categorias').insert(vinculos);
      }

      alert('Lojista cadastrado com sucesso!');
      setIsModalOpen(false);
      setNovoNome('');
      setNovoEmail('');
      setNovaSenha('');
      setNovaCidade('');
      setIsNewCityCreate(false);
      setNovoTelefone('');
      setNovasCategoriasIds([]);
      
      fetchData();
    } catch (err) {
      alert('Erro ao cadastrar lojista: ' + err.message);
    }
  };

  const handleOpenEditModal = (lojista) => {
    setEditingLojistaId(lojista.id);
    setEditNome(lojista.nome || '');
    setEditCidade(lojista.cidade || '');
    setIsNewCityEdit(false);
    setEditTelefone(lojista.telefone || '');
    setIsEditModalOpen(true);
  };

  const handleSaveEditLojista = async (e) => {
    e.preventDefault();
    try {
      if (editCidade) {
        await saveCityIfNew(editCidade);
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          nome: editNome,
          cidade: editCidade,
          telefone: editTelefone
        })
        .eq('id', editingLojistaId);

      if (error) throw error;

      alert('Dados atualizados com sucesso!');
      setIsEditModalOpen(false);
      fetchData();
    } catch (err) {
      alert('Erro ao atualizar dados: ' + err.message);
    }
  };

  const toggleModalCategory = (catId) => {
    if (novasCategoriasIds.includes(catId)) {
      setNovasCategoriasIds(novasCategoriasIds.filter(id => id !== catId));
    } else {
      setNovasCategoriasIds([...novasCategoriasIds, catId]);
    }
  };

  const filteredLojistas = lojistas.filter(l => {
    if (!selectedCityFilter) return true;
    return l.cidade?.toLowerCase() === selectedCityFilter.toLowerCase();
  });

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Painel do Administrador</h2>
            <p className="text-sm text-slate-500">Gerenciamento de Lojistas, Acessos e Categorias</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="bg-slate-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-900 transition shadow-sm"
            >
              Gerenciar Categorias
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-teal-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-teal-700 transition shadow-sm"
            >
              + Cadastrar Lojista
            </button>
            <button
              onClick={handleLogout}
              className="bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-300 transition"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Filtro de Cidades */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
          <label className="text-sm font-bold text-slate-700">Filtrar Lojistas por Cidade:</label>
          <select
            value={selectedCityFilter}
            onChange={(e) => setSelectedCityFilter(e.target.value)}
            className="p-2 rounded-xl border border-slate-300 text-slate-800 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Todas as Cidades ({lojistas.length})</option>
            {cities.map((city) => (
              <option key={city.id || city.nome} value={city.nome}>
                {city.nome}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-slate-500 text-center py-8">Carregando dados...</p>
        ) : filteredLojistas.length === 0 ? (
          <p className="text-slate-500 text-center py-8">Nenhum lojista encontrado para este filtro.</p>
        ) : (
          <div className="space-y-4">
            {filteredLojistas.map((lojista) => (
              <div key={lojista.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                
                <div className="space-y-1">
                  <h3 className="font-bold text-lg text-slate-800">{lojista.nome || 'Lojista'}</h3>
                  <p className="text-xs text-slate-500"><b>Cidade:</b> {lojista.cidade || 'Não informada'}</p>
                  <p className="text-xs text-slate-500"><b>Telefone:</b> {lojista.telefone || 'Não informado'}</p>
                  <div className="pt-1">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${lojista.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {lojista.ativo ? 'Pagamento em Dia (Ativo)' : 'Inadimplente (Bloqueado)'}
                    </span>
                  </div>
                </div>

                <div className="flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Categorias Atendidas:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {categories.map((cat) => {
                      const selecionada = lojista.categoriasSelecionadas.includes(cat.id);
                      return (
                        <label key={cat.id} className="flex items-center space-x-2 text-sm text-slate-700 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={selecionada}
                            onChange={() => handleCategoryChange(lojista.id, cat.id)}
                            className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                          />
                          <span>{cat.nome}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleOpenEditModal(lojista)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition border border-slate-300"
                  >
                    Editar Dados
                  </button>
                  <button
                    onClick={() => handleToggleAtivo(lojista.id, lojista.ativo)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                      lojista.ativo 
                        ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' 
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {lojista.ativo ? 'Bloquear Acesso' : 'Liberar Acesso'}
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}

        {/* Modal de Gerenciamento de Categorias */}
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="text-xl font-bold text-slate-800">Gerenciar Categorias</h3>
                <button
                  onClick={() => {
                    setIsCategoryModalOpen(false);
                    setEditingCatId(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg"
                >
                  ✕
                </button>
              </div>

              {/* Form para Nova Categoria */}
              <form onSubmit={handleCreateCategory} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nome da nova categoria..."
                  value={novaCategoriaNome}
                  onChange={(e) => setNovaCategoriaNome(e.target.value)}
                  className="flex-1 p-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm"
                  required
                />
                <button
                  type="submit"
                  className="bg-teal-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-teal-700 transition"
                >
                  Adicionar
                </button>
              </form>

              {/* Lista de Categorias Existentes */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Categorias Cadastradas:</p>
                <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto pr-1">
                  {categories.map((cat) => (
                    <div key={cat.id} className="py-2.5 flex justify-between items-center gap-3">
                      {editingCatId === cat.id ? (
                        <div className="flex-1 flex gap-2">
                          <input
                            type="text"
                            value={editingCatNome}
                            onChange={(e) => setEditingCatNome(e.target.value)}
                            className="flex-1 p-1.5 rounded-lg border border-slate-300 text-sm text-slate-900"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEditCategory(cat.id)}
                            className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-semibold hover:bg-green-700"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCatId(null)}
                            className="bg-slate-200 text-slate-700 px-3 py-1 rounded-lg text-xs font-semibold hover:bg-slate-300"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm font-medium text-slate-800">{cat.nome}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCatId(cat.id);
                              setEditingCatNome(cat.nome);
                            }}
                            className="text-xs text-teal-600 font-semibold hover:underline"
                          >
                            Editar
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-300 transition"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Cadastro de Lojista */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <form onSubmit={handleCreateLojista} className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-slate-800">Cadastrar Novo Lojista</h3>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Loja / Lojista</label>
                <input 
                  type="text" placeholder="Ex: Acústica Center" value={novoNome} 
                  onChange={(e) => setNovoNome(e.target.value)} 
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-900" required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">E-mail de Acesso</label>
                  <input 
                    type="email" placeholder="lojista@email.com" value={novoEmail} 
                    onChange={(e) => setNovoEmail(e.target.value)} 
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-900" required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Senha Inicial</label>
                  <input 
                    type="password" placeholder="******" value={novaSenha} 
                    onChange={(e) => setNovaSenha(e.target.value)} 
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-900" required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cidade</label>
                  {!isNewCityCreate ? (
                    <select
                      value={novaCidade}
                      onChange={(e) => {
                        if (e.target.value === 'NEW') {
                          setIsNewCityCreate(true);
                          setNovaCidade('');
                        } else {
                          setNovaCidade(e.target.value);
                        }
                      }}
                      className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-900 bg-white"
                    >
                      <option value="">Selecione...</option>
                      {cities.map((c) => (
                        <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>
                      ))}
                      <option value="NEW">+ Cadastrar Nova Cidade...</option>
                    </select>
                  ) : (
                    <div className="space-y-1">
                      <input 
                        type="text" placeholder="Nome da nova cidade" value={novaCidade} 
                        onChange={(e) => setNovaCidade(e.target.value)} 
                        className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-900" required
                      />
                      <button 
                        type="button" 
                        onClick={() => setIsNewCityCreate(false)}
                        className="text-xs text-teal-600 font-semibold hover:underline"
                      >
                        ← Selecionar da lista
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefone / WhatsApp</label>
                  <input 
                    type="text" placeholder="(22) 99999-9999" value={novoTelefone} 
                    onChange={(e) => setNovoTelefone(e.target.value)} 
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Categorias Atendidas</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {categories.map((cat) => (
                    <label key={cat.id} className="flex items-center space-x-2 text-sm text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={novasCategoriasIds.includes(cat.id)}
                        onChange={() => toggleModalCategory(cat.id)}
                        className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                      />
                      <span>{cat.nome}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/2 bg-slate-200 text-slate-700 p-2.5 rounded-xl font-semibold hover:bg-slate-300 transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="w-1/2 bg-teal-600 text-white p-2.5 rounded-xl font-semibold hover:bg-teal-700 transition shadow-sm"
                >
                  Salvar Lojista
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Modal de Edição de Lojista */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <form onSubmit={handleSaveEditLojista} className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-slate-200 space-y-4">
              <h3 className="text-xl font-bold text-slate-800">Editar Dados do Lojista</h3>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Loja / Lojista</label>
                <input 
                  type="text" value={editNome} 
                  onChange={(e) => setEditNome(e.target.value)} 
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-900" required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cidade</label>
                  {!isNewCityEdit ? (
                    <select
                      value={editCidade}
                      onChange={(e) => {
                        if (e.target.value === 'NEW') {
                          setIsNewCityEdit(true);
                          setEditCidade('');
                        } else {
                          setEditCidade(e.target.value);
                        }
                      }}
                      className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-900 bg-white"
                    >
                      <option value="">Selecione...</option>
                      {cities.map((c) => (
                        <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>
                      ))}
                      <option value="NEW">+ Cadastrar Nova Cidade...</option>
                    </select>
                  ) : (
                    <div className="space-y-1">
                      <input 
                        type="text" placeholder="Nome da nova cidade" value={editCidade} 
                        onChange={(e) => setEditCidade(e.target.value)} 
                        className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-900" required
                      />
                      <button 
                        type="button" 
                        onClick={() => setIsNewCityEdit(false)}
                        className="text-xs text-teal-600 font-semibold hover:underline"
                      >
                        ← Selecionar da lista
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefone / WhatsApp</label>
                  <input 
                    type="text" value={editTelefone} 
                    onChange={(e) => setEditTelefone(e.target.value)} 
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-900"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)}
                  className="w-1/2 bg-slate-200 text-slate-700 p-2.5 rounded-xl font-semibold hover:bg-slate-300 transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="w-1/2 bg-teal-600 text-white p-2.5 rounded-xl font-semibold hover:bg-teal-700 transition shadow-sm"
                >
                  Atualizar
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}