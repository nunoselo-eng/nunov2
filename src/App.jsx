import { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Login from './pages/Login';
import ClientDashboard from './pages/ClientDashboard';
import LojistaDashboard from './pages/LojistaDashboard';
import AdminDashboard from './pages/AdminDashboard';
import CreateRequest from './pages/CreateRequest';

export default function App() {
  // Corrige o "deslogamento" em atalhos salvos na tela inicial (Android):
  // quando o app fica em segundo plano, o sistema pode pausar o timer que o
  // Supabase usa pra renovar a sessão sozinho. Aqui a gente pausa esse timer
  // de propósito ao sair de foco (economiza recurso, já que não rodaria
  // direito mesmo) e força uma checagem/renovação assim que o app volta a
  // ficar visível — pega o token antes que ele vença de vez.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    handleVisibilityChange();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <Router>
      <Routes>
        {/* Rota Inicial e Login */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />

        {/* Rotas do Cliente */}
        <Route path="/client-dashboard" element={<ClientDashboard />} />
        <Route path="/my-requests" element={<ClientDashboard />} />
        <Route path="/create-request" element={<CreateRequest />} />

        {/* Rotas do Lojista */}
        <Route path="/lojista-dashboard" element={<LojistaDashboard />} />

        {/* Rotas do Administrador */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />

        {/* Redirecionamento padrão */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
