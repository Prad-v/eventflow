/**
 * Main App Component
 */
import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LogtoProvider, useLogto } from '@logto/react';

import OverviewPage from './pages/OverviewPage';
import IncidentsPage from './pages/IncidentsPage';
import IncidentDetailPage from './pages/IncidentDetailPage';
import MaintenancePage from './pages/MaintenancePage';
import ComponentsPage from './pages/ComponentsPage';
import ApiDocsPage from './pages/ApiDocsPage';
import CreateIncidentPage from './pages/admin/CreateIncidentPage';
import CreateComponentPage from './pages/admin/CreateComponentPage';
import CreateMaintenancePage from './pages/admin/CreateMaintenancePage';
import CallbackPage from './pages/CallbackPage';

import { logtoConfig } from './config/logto';
import './index.css';
import { setAccessTokenGetter } from './api/client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30000,
    },
  },
});

function AuthSync() {
  const { getAccessToken } = useLogto();

  // Register the token getter with our Axios client
  // Logto's getAccessToken automatically handles refresh and caching
  setAccessTokenGetter(async () => {
    try {
      const token = await getAccessToken(logtoConfig.resources[0]);
      return token || '';
    } catch {
      // Ignore errors when not authenticated
      return '';
    }
  });

  return null;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, signIn } = useLogto();
  // location logic removed as it was unused and causing build error

  if (isLoading) return <div>Loading...</div>;

  if (!isAuthenticated) {
    signIn(window.location.origin + '/callback');
    return null;
  }

  return children;
}

function AuthButton() {
  const { isAuthenticated, signIn, signOut } = useLogto();

  if (isAuthenticated) {
    return (
      <button
        className="nav-link"
        onClick={() => signOut(window.location.origin)}
        style={{ border: 'none', background: 'none', cursor: 'pointer' }}
      >
        Sign Out
      </button>
    );
  }

  return (
    <button
      className="nav-link"
      onClick={() => signIn(window.location.origin + '/callback')}
      style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-primary)' }}
    >
      Sign In
    </button>
  );
}

function App() {
  return (
    <LogtoProvider config={logtoConfig}>
      <AuthSync />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <div className="app">
            {/* Header */}
            <header className="app-header">
              <div className="header-content">
                <div className="header-logo">
                  <span style={{ fontSize: '1.5rem' }}>🔮</span>
                  <h1>Status Page</h1>
                </div>
                <nav className="header-nav" style={{ alignItems: 'center' }}>
                  <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
                    Overview
                  </NavLink>
                  <NavLink to="/components" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    Components
                  </NavLink>
                  <NavLink to="/incidents" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    Incidents
                  </NavLink>
                  <NavLink to="/maintenance" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    Maintenance
                  </NavLink>
                  <NavLink to="/api-docs" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    API Docs
                  </NavLink>
                  <div style={{ width: '1px', height: '20px', background: 'var(--color-border)', margin: '0 8px' }}></div>
                  <AuthButton />
                </nav>
              </div>
            </header>

            {/* Main Content */}
            <main className="app-container">
              <Routes>
                <Route path="/" element={<OverviewPage />} />
                <Route path="/callback" element={<CallbackPage />} />

                <Route path="/components" element={<ComponentsPage />} />
                <Route path="/components/:id" element={<ComponentsPage />} />
                <Route path="/incidents" element={<IncidentsPage />} />
                <Route path="/incidents/:id" element={<IncidentDetailPage />} />
                <Route path="/maintenance" element={<MaintenancePage />} />
                <Route path="/maintenance/:id" element={<MaintenancePage />} />
                <Route path="/api-docs" element={<ApiDocsPage />} />

                {/* Admin Routes - Protected */}
                <Route path="/admin/incidents/new" element={
                  <RequireAuth>
                    <CreateIncidentPage />
                  </RequireAuth>
                } />
                <Route path="/admin/components/new" element={
                  <RequireAuth>
                    <CreateComponentPage />
                  </RequireAuth>
                } />
                <Route path="/admin/maintenance/new" element={
                  <RequireAuth>
                    <CreateMaintenancePage />
                  </RequireAuth>
                } />
              </Routes>
            </main>

            {/* Footer */}
            <footer style={{
              textAlign: 'center',
              padding: 'var(--space-6)',
              color: 'var(--color-text-muted)',
              fontSize: '0.8125rem',
              borderTop: '1px solid var(--color-border)',
              marginTop: 'var(--space-8)',
            }}>
              <p>Internal Status Page • Powered by EventFlow</p>
            </footer>
          </div>
        </BrowserRouter>
      </QueryClientProvider>
    </LogtoProvider>
  );
}

export default App;
