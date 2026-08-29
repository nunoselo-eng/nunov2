import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function CreateRequest() {
  const [categories, setCategories] = useState([]);
  const [cities, setCities] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [cityId, setCityId] = useState('');
  const [bairro, setBairro] = useState('');
  const [description, setDescription] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function loadData() {
      const { data: catData } = await supabase.from('categories').select('*');
      const { data: cityData } = await supabase.from('cities').select('*');

      if (catData) {
        const uniqueCats = catData.filter((item, index, self) =>
          index === self.findIndex((t) => t.nome?.trim().toLowerCase() === item.nome?.trim().toLowerCase())
        );
        setCategories(uniqueCats);
      }

      if (cityData) {
        const uniqueCities = cityData.filter((item, index, self) =>
          index === self.findIndex((t) => t.nome?.trim().toLowerCase() === item.nome?.trim().toLowerCase())
        );
        setCities(uniqueCities);
      }
    }
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Sessão expirada. Faça login novamente.');
      return;
    }

    const newOrder = {
      cliente_id: user.id,
      categoria_id: categoryId,
      cidade_id: cityId,
      bairro: bairro,
      descricao: description,
      status: 'Aguardando Moderação'
    };

    const { error } = await supabase.from('orders').insert([newOrder]);
    if (error) {
      alert('Erro ao criar cotação: ' + error.message);
      return;
    }

    alert('Pedido criado com sucesso!');
    navigate('/my-requests');
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-100 p-4">
      <form onSubmit={handleSubmit} className="p-8 bg-white shadow-xl rounded-2xl w-full max-w-md border border-slate-200 space-y-4">
        <h2 className="text-2xl font-bold text-slate-800 text-center">Criar Cotação</h2>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full p-2.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-900"
            required
          >
            <option value="">Selecione...</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.nome}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Cidade</label>
          <select
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
            className="w-full p-2.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-900"
            required
          >
            <option value="">Selecione...</option>
            {cities.map((city) => (
              <option key={city.id || city.nome} value={city.id || city.nome}>{city.nome}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Bairro para Entrega</label>
          <input
            type="text"
            placeholder="Ex: Centro, Pelinca, Parque Tamandaré..."
            value={bairro}
            onChange={(e) => setBairro(e.target.value)}
            className="w-full p-2.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-900"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Descrição do Serviço/Produto</label>
          <textarea
            placeholder="Descreva o que você precisa..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 h-28 resize-none"
            required
          />
        </div>

        <button type="submit" className="w-full bg-teal-600 text-white p-2.5 rounded-xl font-semibold hover:bg-teal-700 transition shadow-sm">
          Enviar para Moderação
        </button>
      </form>
    </div>
  );
}