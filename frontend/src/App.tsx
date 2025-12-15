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
import LocalLoginPage from './pages/LocalLoginPage';
import SettingsPage from './pages/admin/SettingsPage';

import { logtoConfig } from './config/logto';
import './index.css';
import { setAccessTokenGetter } from './api/client';
import { OidcStatusProvider, useOidcStatus } from './context/OidcStatusContext';

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
  // First check for local auth token, then fall back to Logto
  setAccessTokenGetter(async () => {
    // Check for local auth token first (breakglass)
    const localToken = localStorage.getItem('local_auth_token');
    if (localToken) {
      return localToken;
    }

    // Fall back to Logto token
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

  if (isLoading) return <div>Loading...</div>;

  if (!isAuthenticated) {
    signIn(window.location.origin + '/callback');
    return null;
  }

  return children;
}

/**
 * Conditionally require auth based on OIDC status.
 * When OIDC is not active, allow access without authentication.
 */
function ConditionalAuth({ children }: { children: React.ReactNode }) {
  const { status, loading } = useOidcStatus();

  // While loading OIDC status, show loading
  if (loading) {
    return <div>Loading...</div>;
  }

  // If OIDC is active (enabled AND provisioned), require auth
  if (status?.oidc_active) {
    return <RequireAuth>{children}</RequireAuth>;
  }

  // Otherwise, allow access without auth
  return <>{children}</>;
}

function SetupBanner() {
  const { status, loading } = useOidcStatus();

  if (loading || status?.oidc_active) return null;

  return (
    <div style={{
      background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
      color: 'white',
      padding: 'var(--space-3) var(--space-4)',
      textAlign: 'center',
      fontSize: '0.875rem',
    }}>
      ⚙️ <strong>Setup Required:</strong> OIDC is not configured.
      {' '}
      <a href="/admin/settings/oidc" style={{ color: 'white', textDecoration: 'underline' }}>
        Configure OIDC/SSO
      </a>
      {' '}or use{' '}
      <a href="/login/local" style={{ color: 'white', textDecoration: 'underline' }}>
        local admin login
      </a>
    </div>
  );
}

function AuthButton() {
  const { isAuthenticated, signIn, signOut } = useLogto();
  const { status } = useOidcStatus();

  // Check for local auth
  const localUser = localStorage.getItem('local_auth_user');
  if (localUser) {
    const user = JSON.parse(localUser);
    return (
      <button
        className="nav-link"
        onClick={() => {
          localStorage.removeItem('local_auth_token');
          localStorage.removeItem('local_auth_user');
          window.location.href = '/';
        }}
        style={{ border: 'none', background: 'none', cursor: 'pointer' }}
      >
        Sign Out ({user.username})
      </button>
    );
  }

  // If OIDC not active, just show local login link
  if (!status?.oidc_active) {
    return (
      <a href="/login/local" className="nav-link" style={{ color: 'var(--color-primary)' }}>
        Admin Login
      </a>
    );
  }

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
        <OidcStatusProvider>
          <BrowserRouter>
            <div className="app">
              {/* Setup Banner */}
              <SetupBanner />

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

                  {/* Admin Routes - Conditionally Protected */}
                  <Route path="/admin/incidents/new" element={
                    <ConditionalAuth>
                      <CreateIncidentPage />
                    </ConditionalAuth>
                  } />
                  <Route path="/admin/components/new" element={
                    <ConditionalAuth>
                      <CreateComponentPage />
                    </ConditionalAuth>
                  } />
                  <Route path="/admin/maintenance/new" element={
                    <ConditionalAuth>
                      <CreateMaintenancePage />
                    </ConditionalAuth>
                  } />
                  <Route path="/admin/settings/*" element={
                    <ConditionalAuth>
                      <SettingsPage />
                    </ConditionalAuth>
                  } />

                  {/* Local Login (Breakglass) */}
                  <Route path="/login/local" element={<LocalLoginPage />} />
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
        </OidcStatusProvider>
      </QueryClientProvider>
    </LogtoProvider>
  );
}

export default App;

