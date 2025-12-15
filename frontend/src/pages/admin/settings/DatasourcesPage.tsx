/**
 * Datasources Settings Page
 * Configure and manage external datasource integrations (PagerDuty, etc.)
 */
import { useState, useEffect } from 'react';
import { apiClient } from '../../../api/client';

interface Datasource {
    id: string;
    name: string;
    provider_type: string;
    enabled: boolean;
    last_sync_at: string | null;
    sync_status: string | null;
    sync_error: string | null;
    sync_interval_seconds: number;
    has_api_key: boolean;
    service_ids: string[];
    base_url: string | null;
    created_at: string;
}

interface SyncResult {
    success: boolean;
    created: number;
    updated: number;
    total_fetched: number;
    error: string | null;
}

export default function DatasourcesPage() {
    const [datasources, setDatasources] = useState<Datasource[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        provider_type: 'pagerduty',
        api_key: '',
        service_ids: '',
        sync_interval_seconds: 60,
        base_url: '',
    });

    // Test/Sync state
    const [testing, setTesting] = useState<string | null>(null);
    const [syncing, setSyncing] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<{ success: boolean, message: string } | null>(null);
    const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

    const fetchDatasources = async () => {
        try {
            const response = await apiClient.get('/settings/datasources');
            setDatasources(response.data);
            setError('');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to load datasources');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDatasources();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);
        setFormError('');

        try {
            const payload: any = {
                name: formData.name,
                provider_type: formData.provider_type,
                api_key: formData.api_key,
                service_ids: formData.service_ids.split(',').map(s => s.trim()).filter(Boolean),
                sync_interval_seconds: formData.sync_interval_seconds,
            };
            if (formData.base_url) {
                payload.base_url = formData.base_url;
            }

            if (editingId) {
                await apiClient.patch(`/settings/datasources/${editingId}`, payload);
            } else {
                await apiClient.post('/settings/datasources', payload);
            }

            setShowForm(false);
            setEditingId(null);
            setFormData({ name: '', provider_type: 'pagerduty', api_key: '', service_ids: '', sync_interval_seconds: 60, base_url: '' });
            fetchDatasources();
        } catch (err: any) {
            setFormError(err.response?.data?.detail || 'Failed to save datasource');
        } finally {
            setFormLoading(false);
        }
    };

    const handleEdit = (ds: Datasource) => {
        setEditingId(ds.id);
        setFormData({
            name: ds.name,
            provider_type: ds.provider_type,
            api_key: '',
            service_ids: ds.service_ids.join(', '),
            sync_interval_seconds: ds.sync_interval_seconds,
            base_url: ds.base_url || '',
        });
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this datasource? All synced incidents from this source will also be deleted.')) return;

        try {
            await apiClient.delete(`/settings/datasources/${id}`);
            fetchDatasources();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to delete');
        }
    };

    const handleToggle = async (ds: Datasource) => {
        try {
            await apiClient.patch(`/settings/datasources/${ds.id}`, { enabled: !ds.enabled });
            fetchDatasources();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to update');
        }
    };

    const handleTest = async (id: string) => {
        setTesting(id);
        setTestResult(null);
        try {
            const response = await apiClient.post(`/settings/datasources/${id}/test`);
            setTestResult(response.data);
        } catch (err: any) {
            setTestResult({ success: false, message: err.response?.data?.detail || 'Test failed' });
        } finally {
            setTesting(null);
        }
    };

    const handleSync = async (id: string) => {
        setSyncing(id);
        setSyncResult(null);
        try {
            const response = await apiClient.post(`/settings/datasources/${id}/sync`);
            setSyncResult(response.data);
            fetchDatasources();
        } catch (err: any) {
            setSyncResult({ success: false, error: err.response?.data?.detail || 'Sync failed', created: 0, updated: 0, total_fetched: 0 });
        } finally {
            setSyncing(null);
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'Never';
        return new Date(dateStr).toLocaleString();
    };

    const getSyncStatusBadge = (status: string | null) => {
        const colors: Record<string, string> = {
            success: 'var(--color-success)',
            syncing: 'var(--color-warning)',
            error: 'var(--color-danger)',
            idle: 'var(--color-text-muted)',
        };
        return (
            <span style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                background: colors[status || 'idle'] + '20',
                color: colors[status || 'idle'],
            }}>
                {status || 'idle'}
            </span>
        );
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>📡 Datasources</h1>
                    <p style={{ color: 'var(--color-text-muted)' }}>
                        Connect external incident sources like PagerDuty to sync incidents automatically.
                    </p>
                </div>
                <button className="btn-primary" onClick={() => { setShowForm(true); setEditingId(null); setFormData({ name: '', provider_type: 'pagerduty', api_key: '', service_ids: '', sync_interval_seconds: 60, base_url: '' }); }}>
                    + Add Datasource
                </button>
            </div>

            {error && (
                <div style={{ background: 'var(--color-danger)', color: 'white', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
                    {error}
                </div>
            )}

            {/* Add/Edit Form */}
            {showForm && (
                <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-6)' }}>
                    <h2 style={{ fontSize: '1.125rem', marginBottom: 'var(--space-4)' }}>
                        {editingId ? 'Edit Datasource' : 'Add New Datasource'}
                    </h2>

                    {formError && (
                        <div style={{ background: 'var(--color-danger)', color: 'white', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
                            {formError}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div style={{ display: 'grid', gap: 'var(--space-4)', gridTemplateColumns: '1fr 1fr' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    placeholder="Production PagerDuty"
                                    style={{ width: '100%', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-card-bg)', color: 'var(--color-text)' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>Provider</label>
                                <select
                                    value={formData.provider_type}
                                    onChange={(e) => setFormData({ ...formData, provider_type: e.target.value })}
                                    style={{ width: '100%', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-card-bg)', color: 'var(--color-text)' }}
                                >
                                    <option value="pagerduty">PagerDuty</option>
                                    <option value="opsgenie" disabled>OpsGenie (Coming Soon)</option>
                                </select>
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
                                    API Key {editingId && '(leave blank to keep existing)'}
                                </label>
                                <input
                                    type="password"
                                    value={formData.api_key}
                                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                                    required={!editingId}
                                    placeholder="PagerDuty API Key"
                                    style={{ width: '100%', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-card-bg)', color: 'var(--color-text)' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>Service IDs (comma-separated, optional)</label>
                                <input
                                    type="text"
                                    value={formData.service_ids}
                                    onChange={(e) => setFormData({ ...formData, service_ids: e.target.value })}
                                    placeholder="P123ABC, P456DEF (leave empty for all)"
                                    style={{ width: '100%', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-card-bg)', color: 'var(--color-text)' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>Sync Interval (seconds)</label>
                                <input
                                    type="number"
                                    min={30}
                                    max={3600}
                                    value={formData.sync_interval_seconds}
                                    onChange={(e) => setFormData({ ...formData, sync_interval_seconds: parseInt(e.target.value) })}
                                    style={{ width: '100%', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-card-bg)', color: 'var(--color-text)' }}
                                />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
                                    API Endpoint URL (optional, for mock services)
                                </label>
                                <input
                                    type="text"
                                    value={formData.base_url}
                                    onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                                    placeholder="http://mock-pagerduty (leave empty for real PagerDuty)"
                                    style={{ width: '100%', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-card-bg)', color: 'var(--color-text)' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
                            <button type="submit" className="btn-primary" disabled={formLoading}>
                                {formLoading ? 'Saving...' : (editingId ? 'Update' : 'Create')}
                            </button>
                            <button type="button" onClick={() => setShowForm(false)} style={{ padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Datasources List */}
            {loading ? (
                <div>Loading...</div>
            ) : datasources.length === 0 ? (
                <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <p style={{ fontSize: '1.125rem', marginBottom: 'var(--space-2)' }}>No datasources configured</p>
                    <p>Add a PagerDuty integration to automatically sync incidents.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {datasources.map((ds) => (
                        <div key={ds.id} className="card" style={{ padding: 'var(--space-5)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                                        <h3 style={{ fontSize: '1.125rem', margin: 0 }}>{ds.name}</h3>
                                        <span style={{
                                            display: 'inline-block',
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            fontSize: '0.75rem',
                                            background: ds.enabled ? 'var(--color-success)20' : 'var(--color-text-muted)20',
                                            color: ds.enabled ? 'var(--color-success)' : 'var(--color-text-muted)',
                                        }}>
                                            {ds.enabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                        {getSyncStatusBadge(ds.sync_status)}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                                        <div>
                                            <strong>Provider:</strong> {ds.provider_type === 'pagerduty' ? 'PagerDuty' : ds.provider_type}
                                        </div>
                                        <div>
                                            <strong>Last Sync:</strong> {formatDate(ds.last_sync_at)}
                                        </div>
                                        <div>
                                            <strong>Interval:</strong> {ds.sync_interval_seconds}s
                                        </div>
                                    </div>
                                    {ds.sync_error && (
                                        <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2)', background: 'var(--color-danger)10', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: 'var(--color-danger)' }}>
                                            Error: {ds.sync_error}
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                    <button
                                        onClick={() => handleTest(ds.id)}
                                        disabled={testing === ds.id}
                                        style={{ padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontSize: '0.875rem' }}
                                    >
                                        {testing === ds.id ? '...' : 'Test'}
                                    </button>
                                    <button
                                        onClick={() => handleSync(ds.id)}
                                        disabled={syncing === ds.id}
                                        style={{ padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-primary)', background: 'transparent', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.875rem' }}
                                    >
                                        {syncing === ds.id ? '...' : 'Sync Now'}
                                    </button>
                                    <button
                                        onClick={() => handleToggle(ds)}
                                        style={{ padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: ds.enabled ? 'var(--color-danger)20' : 'var(--color-success)20', color: ds.enabled ? 'var(--color-danger)' : 'var(--color-success)', cursor: 'pointer', fontSize: '0.875rem' }}
                                    >
                                        {ds.enabled ? 'Disable' : 'Enable'}
                                    </button>
                                    <button onClick={() => handleEdit(ds)} style={{ padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontSize: '0.875rem' }}>
                                        Edit
                                    </button>
                                    <button onClick={() => handleDelete(ds.id)} style={{ padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-danger)', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.875rem' }}>
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Test Result Toast */}
            {testResult && (
                <div style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    padding: 'var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    background: testResult.success ? 'var(--color-success)' : 'var(--color-danger)',
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    zIndex: 1000,
                }}>
                    {testResult.message}
                    <button onClick={() => setTestResult(null)} style={{ marginLeft: 'var(--space-3)', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>×</button>
                </div>
            )}

            {/* Sync Result Toast */}
            {syncResult && (
                <div style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    padding: 'var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    background: syncResult.success ? 'var(--color-success)' : 'var(--color-danger)',
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    zIndex: 1000,
                }}>
                    {syncResult.success
                        ? `Synced: ${syncResult.created} created, ${syncResult.updated} updated (${syncResult.total_fetched} total)`
                        : `Error: ${syncResult.error}`
                    }
                    <button onClick={() => setSyncResult(null)} style={{ marginLeft: 'var(--space-3)', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>×</button>
                </div>
            )}
        </div>
    );
}
