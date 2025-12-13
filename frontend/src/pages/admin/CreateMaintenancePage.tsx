/**
 * Admin - Schedule Maintenance Page
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCreateMaintenance, useComponents } from '../../hooks/useApi';
import type { Impact, Component } from '../../api/client';

export default function CreateMaintenancePage() {
    const navigate = useNavigate();
    const createMutation = useCreateMaintenance();
    const { data: componentsData } = useComponents({ page: 1 });

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [startAt, setStartAt] = useState('');
    const [endAt, setEndAt] = useState('');
    const [selectedComponents, setSelectedComponents] = useState<{ id: string; impact: Impact }[]>([]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim() || !startAt || !endAt) return;

        try {
            await createMutation.mutateAsync({
                title: title.trim(),
                description: description.trim() || undefined,
                start_at: new Date(startAt).toISOString(),
                end_at: new Date(endAt).toISOString(),
                components: selectedComponents.map(c => ({ component_id: c.id, expected_impact: c.impact })),
            });
            navigate('/maintenance');
        } catch (error) {
            console.error('Failed to create maintenance:', error);
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
                <Link to="/maintenance" style={{ color: 'var(--color-text-muted)' }}>
                    ← Back to Maintenance
                </Link>
            </div>

            <h1 style={{ marginBottom: 'var(--space-6)' }}>Schedule Maintenance</h1>

            <form onSubmit={handleSubmit}>
                <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Maintenance Details</h3>

                    {/* Title */}
                    <div style={{ marginBottom: 'var(--space-4)' }}>
                        <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
                            Title *
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Database Migration, Infrastructure Upgrade"
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

                    {/* Description */}
                    <div style={{ marginBottom: 'var(--space-4)' }}>
                        <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Details about the maintenance and expected impact..."
                            style={{
                                width: '100%',
                                minHeight: '80px',
                                padding: 'var(--space-3)',
                                background: 'var(--color-bg-tertiary)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--color-text-primary)',
                                fontSize: '0.875rem',
                                fontFamily: 'inherit',
                                resize: 'vertical',
                            }}
                        />
                    </div>

                    {/* Schedule */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
                                Start Time *
                            </label>
                            <input
                                type="datetime-local"
                                value={startAt}
                                onChange={(e) => setStartAt(e.target.value)}
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
                        <div>
                            <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
                                End Time *
                            </label>
                            <input
                                type="datetime-local"
                                value={endAt}
                                onChange={(e) => setEndAt(e.target.value)}
                                min={startAt}
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
                                            borderColor: selected ? 'var(--color-maintenance)' : undefined,
                                        }}
                                        onClick={() => toggleComponent(component.id)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                            <input
                                                type="checkbox"
                                                checked={!!selected}
                                                onChange={() => { }}
                                                style={{ accentColor: 'var(--color-maintenance)' }}
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
                        disabled={createMutation.isPending || !title.trim() || !startAt || !endAt}
                    >
                        {createMutation.isPending ? 'Scheduling...' : 'Schedule Maintenance'}
                    </button>
                    <Link to="/maintenance" className="btn btn-secondary">
                        Cancel
                    </Link>
                </div>

                {createMutation.isError && (
                    <div className="error-message" style={{ marginTop: 'var(--space-4)' }}>
                        Failed to schedule maintenance. Please try again.
                    </div>
                )}
            </form>
        </div>
    );
}
