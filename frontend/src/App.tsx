/**
 * Main App Component
 */
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import OverviewPage from './pages/OverviewPage';
import IncidentsPage from './pages/IncidentsPage';
import IncidentDetailPage from './pages/IncidentDetailPage';
import MaintenancePage from './pages/MaintenancePage';
import ComponentsPage from './pages/ComponentsPage';
import ApiDocsPage from './pages/ApiDocsPage';
import CreateIncidentPage from './pages/admin/CreateIncidentPage';
import CreateComponentPage from './pages/admin/CreateComponentPage';
import CreateMaintenancePage from './pages/admin/CreateMaintenancePage';

import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30000,
    },
  },
});

function App() {
  return (
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
              <nav className="header-nav">
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
              </nav>
            </div>
          </header>

          {/* Main Content */}
          <main className="app-container">
            <Routes>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/components" element={<ComponentsPage />} />
              <Route path="/components/:id" element={<ComponentsPage />} />
              <Route path="/incidents" element={<IncidentsPage />} />
              <Route path="/incidents/:id" element={<IncidentDetailPage />} />
              <Route path="/maintenance" element={<MaintenancePage />} />
              <Route path="/maintenance/:id" element={<MaintenancePage />} />
              <Route path="/api-docs" element={<ApiDocsPage />} />
              {/* Admin Routes */}
              <Route path="/admin/incidents/new" element={<CreateIncidentPage />} />
              <Route path="/admin/components/new" element={<CreateComponentPage />} />
              <Route path="/admin/maintenance/new" element={<CreateMaintenancePage />} />
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
  );
}

export default App;
