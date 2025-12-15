/**
 * OIDC Configuration Page
 */
import { useState, useEffect } from 'react';
import { apiClient } from '../../../api/client';

interface OidcConfig {
    id: string;
    provider_name: string;
    enabled: boolean;
    issuer_url: string | null;
    client_id: string | null;
    audience: string | null;
    scopes: string[] | null;
    redirect_uri: string | null;
    admin_endpoint: string | null;
    m2m_app_id: string | null;
    is_provisioned: boolean;
    provisioned_at: string | null;
}

interface TestResult {
    success: boolean;
    message: string;
    details?: Record<string, any>;
}

export default function OidcConfigPage() {
    const [config, setConfig] = useState<OidcConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [provisioning, setProvisioning] = useState(false);
    const [testResult, setTestResult] = useState<TestResult | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Form state
    const [formData, setFormData] = useState({
        enabled: false,
        issuer_url: '',
        client_id: '',
        client_secret: '',
        audience: '',
        scopes: 'openid,profile,email',
        redirect_uri: '',
        admin_endpoint: '',
        m2m_app_id: '',
        m2m_app_secret: '',
    });

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const response = await apiClient.get('/settings/oidc');
            setConfig(response.data);
            setFormData({
                enabled: response.data.enabled,
                issuer_url: response.data.issuer_url || '',
                client_id: response.data.client_id || '',
                client_secret: '',
                audience: response.data.audience || '',
                scopes: response.data.scopes?.join(',') || 'openid,profile,email',
                redirect_uri: response.data.redirect_uri || '',
                admin_endpoint: response.data.admin_endpoint || '',
                m2m_app_id: response.data.m2m_app_id || '',
                m2m_app_secret: '',
            });
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to load configuration');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const payload: Record<string, any> = {
                enabled: formData.enabled,
                issuer_url: formData.issuer_url || null,
                client_id: formData.client_id || null,
                audience: formData.audience || null,
                scopes: formData.scopes.split(',').map(s => s.trim()).filter(Boolean),
                redirect_uri: formData.redirect_uri || null,
                admin_endpoint: formData.admin_endpoint || null,
                m2m_app_id: formData.m2m_app_id || null,
            };

            if (formData.client_secret) {
                payload.client_secret = formData.client_secret;
            }
            if (formData.m2m_app_secret) {
                payload.m2m_app_secret = formData.m2m_app_secret;
            }

            await apiClient.put('/settings/oidc', payload);
            setSuccess('Configuration saved successfully');
            fetchConfig();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to save configuration');
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);

        try {
            const response = await apiClient.post('/settings/oidc/test');
            setTestResult(response.data);
        } catch (err: any) {
            setTestResult({
                success: false,
                message: err.response?.data?.detail || 'Test failed',
            });
        } finally {
            setTesting(false);
        }
    };

    const handleProvision = async () => {
        setProvisioning(true);
        setTestResult(null);

        try {
            const response = await apiClient.post('/settings/oidc/provision');
            setTestResult(response.data);
            if (response.data.success) {
                fetchConfig();
            }
        } catch (err: any) {
            setTestResult({
                success: false,
                message: err.response?.data?.detail || 'Provisioning failed',
            });
        } finally {
            setProvisioning(false);
        }
    };

    if (loading) {
        return <div className="card" style={{ padding: 'var(--space-6)' }}>Loading...</div>;
    }

    return (
        <div>
            <div style={{ marginBottom: 'var(--space-6)' }}>
                <h1 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>
                    OIDC / SSO Configuration
                </h1>
                <p style={{ color: 'var(--color-text-muted)' }}>
                    Configure OpenID Connect for single sign-on authentication
                </p>
            </div>

            {error && (
                <div className="card" style={{
                    background: 'var(--color-danger)',
                    color: 'white',
                    padding: 'var(--space-4)',
                    marginBottom: 'var(--space-4)',
                }}>
                    {error}
                </div>
            )}

            {success && (
                <div className="card" style={{
                    background: 'var(--color-success)',
                    color: 'white',
                    padding: 'var(--space-4)',
                    marginBottom: 'var(--space-4)',
                }}>
                    {success}
                </div>
            )}

            <form onSubmit={handleSave}>
                <div className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-4)' }}>
                    <h3 style={{ marginBottom: 'var(--space-4)' }}>Provider Settings</h3>

                    <div style={{ marginBottom: 'var(--space-4)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <input
                                type="checkbox"
                                checked={formData.enabled}
                                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                            />
                            <span>Enable OIDC Authentication</span>
                        </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
                                Issuer URL
                            </label>
                            <input
                                type="text"
                                value={formData.issuer_url}
                                onChange={(e) => setFormData({ ...formData, issuer_url: e.target.value })}
                                placeholder="https://auth.example.com"
                                style={{
                                    width: '100%',
                                    padding: 'var(--space-3)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-border)',
                                    background: 'var(--color-card-bg)',
                                    color: 'var(--color-text)',
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
                                Audience
                            </label>
                            <input
                                type="text"
                                value={formData.audience}
                                onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                                placeholder="https://api.example.com"
                                style={{
                                    width: '100%',
                                    padding: 'var(--space-3)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-border)',
                                    background: 'var(--color-card-bg)',
                                    color: 'var(--color-text)',
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
                                Client ID
                            </label>
                            <input
                                type="text"
                                value={formData.client_id}
                                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: 'var(--space-3)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-border)',
                                    background: 'var(--color-card-bg)',
                                    color: 'var(--color-text)',
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
                                Client Secret
                            </label>
                            <input
                                type="password"
                                value={formData.client_secret}
                                onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
                                placeholder="••••••••"
                                style={{
                                    width: '100%',
                                    padding: 'var(--space-3)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-border)',
                                    background: 'var(--color-card-bg)',
                                    color: 'var(--color-text)',
                                }}
                            />
                            <small style={{ color: 'var(--color-text-muted)' }}>
                                Leave empty to keep existing secret
                            </small>
                        </div>

                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
                                Scopes (comma-separated)
                            </label>
                            <input
                                type="text"
                                value={formData.scopes}
                                onChange={(e) => setFormData({ ...formData, scopes: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: 'var(--space-3)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-border)',
                                    background: 'var(--color-card-bg)',
                                    color: 'var(--color-text)',
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-4)' }}>
                    <h3 style={{ marginBottom: 'var(--space-4)' }}>Logto Management API (Optional)</h3>
                    <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)', fontSize: '0.875rem' }}>
                        Configure M2M credentials to provision applications in Logto
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
                                M2M App ID
                            </label>
                            <input
                                type="text"
                                value={formData.m2m_app_id}
                                onChange={(e) => setFormData({ ...formData, m2m_app_id: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: 'var(--space-3)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-border)',
                                    background: 'var(--color-card-bg)',
                                    color: 'var(--color-text)',
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
                                M2M App Secret
                            </label>
                            <input
                                type="password"
                                value={formData.m2m_app_secret}
                                onChange={(e) => setFormData({ ...formData, m2m_app_secret: e.target.value })}
                                placeholder="••••••••"
                                style={{
                                    width: '100%',
                                    padding: 'var(--space-3)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-border)',
                                    background: 'var(--color-card-bg)',
                                    color: 'var(--color-text)',
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                    <button
                        type="submit"
                        disabled={saving}
                        className="btn-primary"
                        style={{ padding: 'var(--space-3) var(--space-5)' }}
                    >
                        {saving ? 'Saving...' : 'Save Configuration'}
                    </button>

                    <button
                        type="button"
                        onClick={handleTest}
                        disabled={testing || !formData.issuer_url}
                        style={{
                            padding: 'var(--space-3) var(--space-5)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-card-bg)',
                            color: 'var(--color-text)',
                            cursor: 'pointer',
                        }}
                    >
                        {testing ? 'Testing...' : 'Test Connection'}
                    </button>

                    <button
                        type="button"
                        onClick={handleProvision}
                        disabled={provisioning || !formData.m2m_app_id}
                        style={{
                            padding: 'var(--space-3) var(--space-5)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-card-bg)',
                            color: 'var(--color-text)',
                            cursor: 'pointer',
                        }}
                    >
                        {provisioning ? 'Provisioning...' : 'Provision to Logto'}
                    </button>

                    {config?.is_provisioned && (
                        <span style={{ color: 'var(--color-success)', fontSize: '0.875rem' }}>
                            ✓ Provisioned
                        </span>
                    )}
                </div>
            </form>

            {/* Test Result */}
            {testResult && (
                <div className="card" style={{
                    marginTop: 'var(--space-4)',
                    padding: 'var(--space-4)',
                    background: testResult.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    borderLeft: `4px solid ${testResult.success ? 'var(--color-success)' : 'var(--color-danger)'}`,
                }}>
                    <strong>{testResult.success ? '✓' : '✗'} {testResult.message}</strong>
                    {testResult.details && (
                        <pre style={{
                            marginTop: 'var(--space-3)',
                            fontSize: '0.75rem',
                            overflow: 'auto',
                        }}>
                            {JSON.stringify(testResult.details, null, 2)}
                        </pre>
                    )}
                </div>
            )}
        </div>
    );
}
