/**
 * Settings Layout Page
 */
import { NavLink, Routes, Route } from 'react-router-dom';
import OidcConfigPage from './settings/OidcConfigPage';
import LocalUsersPage from './settings/LocalUsersPage';
import DatasourcesPage from './settings/DatasourcesPage';

export default function SettingsPage() {
    return (
        <div style={{ display: 'flex', gap: 'var(--space-6)' }}>
            {/* Sidebar */}
            <aside style={{
                width: '220px',
                flexShrink: 0,
            }}>
                <div className="card" style={{ padding: 'var(--space-4)' }}>
                    {/* Authentication Section */}
                    <h3 style={{
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--color-text-muted)',
                        marginBottom: 'var(--space-3)',
                    }}>
                        Authentication
                    </h3>
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', marginBottom: 'var(--space-5)' }}>
                        <NavLink
                            to="/admin/settings/oidc"
                            className={({ isActive }) => `settings-nav-item ${isActive ? 'active' : ''}`}
                            style={({ isActive }) => ({
                                display: 'block',
                                padding: 'var(--space-2) var(--space-3)',
                                borderRadius: 'var(--radius-md)',
                                textDecoration: 'none',
                                color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
                                background: isActive ? 'var(--color-primary-subtle)' : 'transparent',
                                fontWeight: isActive ? 500 : 400,
                            })}
                        >
                            🔐 OIDC / SSO
                        </NavLink>
                        <NavLink
                            to="/admin/settings/users"
                            className={({ isActive }) => `settings-nav-item ${isActive ? 'active' : ''}`}
                            style={({ isActive }) => ({
                                display: 'block',
                                padding: 'var(--space-2) var(--space-3)',
                                borderRadius: 'var(--radius-md)',
                                textDecoration: 'none',
                                color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
                                background: isActive ? 'var(--color-primary-subtle)' : 'transparent',
                                fontWeight: isActive ? 500 : 400,
                            })}
                        >
                            👥 Local Users
                        </NavLink>
                    </nav>

                    {/* Integrations Section */}
                    <h3 style={{
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--color-text-muted)',
                        marginBottom: 'var(--space-3)',
                    }}>
                        Integrations
                    </h3>
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                        <NavLink
                            to="/admin/settings/datasources"
                            className={({ isActive }) => `settings-nav-item ${isActive ? 'active' : ''}`}
                            style={({ isActive }) => ({
                                display: 'block',
                                padding: 'var(--space-2) var(--space-3)',
                                borderRadius: 'var(--radius-md)',
                                textDecoration: 'none',
                                color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
                                background: isActive ? 'var(--color-primary-subtle)' : 'transparent',
                                fontWeight: isActive ? 500 : 400,
                            })}
                        >
                            📡 Datasources
                        </NavLink>
                    </nav>
                </div>
            </aside>

            {/* Main Content */}
            <main style={{ flex: 1 }}>
                <Routes>
                    <Route index element={<OidcConfigPage />} />
                    <Route path="oidc" element={<OidcConfigPage />} />
                    <Route path="users" element={<LocalUsersPage />} />
                    <Route path="datasources" element={<DatasourcesPage />} />
                </Routes>
            </main>
        </div>
    );
}
