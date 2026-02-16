import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@getmocha/users-service/react';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import SessionsPage from './pages/SessionsPage';
import ProductsPage from './pages/ProductsPage';
import UsersPage from './pages/UsersPage';
import CountingPage from './pages/CountingPage';
import ManagerVerifyPage from './pages/ManagerVerifyPage';
import AdjustmentOrdersPage from './pages/AdjustmentOrdersPage';
import AdjustmentOrderDetailPage from './pages/AdjustmentOrderDetailPage';
import AuthCallbackPage from './pages/AuthCallbackPage';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={
            <ProtectedRoute>
              <Layout><SessionsPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/products" element={
            <ProtectedRoute>
              <Layout><ProductsPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/users" element={
            <ProtectedRoute>
              <Layout><UsersPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/adjustment-orders" element={
            <ProtectedRoute>
              <Layout><AdjustmentOrdersPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/adjustment-orders/:id" element={
            <ProtectedRoute>
              <Layout><AdjustmentOrderDetailPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/session/:id/count" element={
            <ProtectedRoute>
              <CountingPage />
            </ProtectedRoute>
          } />
          <Route path="/session/:id/verify" element={
            <ProtectedRoute>
              <ManagerVerifyPage />
            </ProtectedRoute>
          } />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
