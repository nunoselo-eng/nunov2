import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import ClientDashboard from './pages/ClientDashboard';
import LojistaDashboard from './pages/LojistaDashboard';
import AdminDashboard from './pages/AdminDashboard';
import RepresentanteDashboard from './pages/RepresentanteDashboard';
import CreateRequest from './pages/CreateRequest';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Rota Inicial e Login */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />

        {/* Rotas do Cliente */}
        <Route path="/client-dashboard" element={
          <ProtectedRoute allowedRole="cliente"><ClientDashboard /></ProtectedRoute>
        } />
        <Route path="/my-requests" element={
          <ProtectedRoute allowedRole="cliente"><ClientDashboard /></ProtectedRoute>
        } />
        <Route path="/create-request" element={
          <ProtectedRoute allowedRole="cliente"><CreateRequest /></ProtectedRoute>
        } />

        {/* Rotas do Lojista */}
        <Route path="/lojista-dashboard" element={
          <ProtectedRoute allowedRole="lojista"><LojistaDashboard /></ProtectedRoute>
        } />

        {/* Rotas do Administrador */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRole="admin"><AdminDashboard /></ProtectedRoute>
        } />
        <Route path="/admin-dashboard" element={
          <ProtectedRoute allowedRole="admin"><AdminDashboard /></ProtectedRoute>
        } />

        {/* Rota do Representante Comercial */}
        <Route path="/representante-dashboard" element={
          <ProtectedRoute allowedRole="representante"><RepresentanteDashboard /></ProtectedRoute>
        } />

        {/* Redirecionamento padrão */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
