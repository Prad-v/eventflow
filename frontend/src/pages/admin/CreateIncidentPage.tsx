/**
 * Admin - Create Incident Page
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCreateIncident, useComponents } from '../../hooks/useApi';
import type { Severity, Impact, Component } from '../../api/client';

const SEVERITY_OPTIONS: { value: Severity; label: string }[] = [
    { value: 'critical', label: 'Critical - Major system failure' },
    { value: 'major', label: 'Major - Significant impact' },
    { value: 'minor', label: 'Minor - Limited impact' },
    { value: 'info', label: 'Info - Informational' },
];

export default function CreateIncidentPage() {
    const navigate = useNavigate();
    const createMutation = useCreateIncident();
    const { data: componentsData } = useComponents({ page: 1 });

    const [title, setTitle] = useState('');
    const [severity, setSeverity] = useState<Severity>('minor');
    const [message, setMessage] = useState('');
    const [selectedComponents, setSelectedComponents] = useState<{ id: string; impact: Impact }[]>([]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim() || !message.trim()) return;

        try {
            const result = await createMutation.mutateAsync({
                title: title.trim(),
                severity,
                message: message.trim(),
                components: selectedComponents.map(c => ({ component_id: c.id, impact: c.impact })),
            });
            navigate(`/incidents/${result.id}`);
        } catch (error) {
            console.error('Failed to create incident:', error);
        }
    };

    const toggleComponent = (id: string) => {
        setSelectedComponents(prev => {
            const existing = prev.find(c => c.id === id);
            if (existing) {
                return prev.filter(c => c.id !== id);
            }
            return [...prev, { id, impact: 'degraded' as Impact }];
        });
    };

    const setComponentImpact = (id: string, impact: Impact) => {
        setSelectedComponents(prev =>
            prev.map(c => c.id === id ? { ...c, impact } : c)
        );
    };

    return (
        <div>
            <div style={{ marginBottom: 'var(--space-4)' }}>
                <Link to="/incidents" style={{ color: 'var(--color-text-muted)' }}>
                    ← Back to Incidents
                </Link>
            </div>

            <h1 style={{ marginBottom: 'var(--space-6)' }}>Report New Incident</h1>

            <form onSubmit={handleSubmit}>
                <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Incident Details</h3>

                    {/* Title */}
                    <div style={{ marginBottom: 'var(--space-4)' }}>
                        <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
                            Title *
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Brief description of the incident"
                            style={{
                                width: '100%',
                                padding: 'var(--space-3)',
                                background: 'var(--color-bg-tertiary)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--color-text-primary)',
                                fontSize: '1rem',
                            }}
                            required
                        />
                    </div>

                    {/* Severity */}
                    <div style={{ marginBottom: 'var(--space-4)' }}>
                        <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
                            Severity *
                        </label>
                        <select
                            value={severity}
                            onChange={(e) => setSeverity(e.target.value as Severity)}
                            style={{
                                width: '100%',
                                padding: 'var(--space-3)',
                                background: 'var(--color-bg-tertiary)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--color-text-primary)',
                                fontSize: '1rem',
                            }}
                        >
                            {SEVERITY_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Initial Message */}
                    <div>
                        <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
                            Initial Update Message *
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Describe what's happening and current investigation status..."
                            style={{
                                width: '100%',
                                minHeight: '120px',
                                padding: 'var(--space-3)',
                                background: 'var(--color-bg-tertiary)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--color-text-primary)',
                                fontSize: '0.875rem',
                                fontFamily: 'inherit',
                                resize: 'vertical',
                            }}
                            required
                        />
                    </div>
                </div>

                {/* Affected Components */}
                <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Affected Components</h3>

                    {componentsData?.items.length === 0 ? (
                        <p style={{ color: 'var(--color-text-muted)' }}>No components available</p>
                    ) : (
                        <div className="component-list">
                            {componentsData?.items.map((component: Component) => {
                                const selected = selectedComponents.find(c => c.id === component.id);
                                return (
                                    <div
                                        key={component.id}
                                        className="component-item"
                                        style={{
                                            cursor: 'pointer',
                                            background: selected ? 'var(--color-bg-elevated)' : undefined,
                                            borderColor: selected ? 'var(--color-primary)' : undefined,
                                        }}
                                        onClick={() => toggleComponent(component.id)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                            <input
                                                type="checkbox"
                                                checked={!!selected}
                                                onChange={() => { }}
                                                style={{ accentColor: 'var(--color-primary)' }}
                                            />
                                            <span className="component-name">{component.name}</span>
                                        </div>
                                        {selected && (
                                            <select
                                                value={selected.impact}
                                                onChange={(e) => {
                                                    e.stopPropagation();
                                                    setComponentImpact(component.id, e.target.value as Impact);
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="btn btn-secondary"
                                                style={{ fontSize: '0.8125rem' }}
                                            >
                                                <option value="degraded">Degraded</option>
                                                <option value="outage">Outage</option>
                                            </select>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Submit */}
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={createMutation.isPending || !title.trim() || !message.trim()}
                    >
                        {createMutation.isPending ? 'Creating...' : 'Create Incident'}
                    </button>
                    <Link to="/incidents" className="btn btn-secondary">
                        Cancel
                    </Link>
                </div>

                {createMutation.isError && (
                    <div className="error-message" style={{ marginTop: 'var(--space-4)' }}>
                        Failed to create incident. Please try again.
                    </div>
                )}
            </form>
        </div>
    );
}
