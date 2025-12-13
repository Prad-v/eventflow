/**
 * Components Page - List all components
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useComponents, useComponentGroups } from '../hooks/useApi';

export default function ComponentsPage() {
    const [groupFilter, setGroupFilter] = useState<string>('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    const { data: groups } = useComponentGroups();
    const { data, isLoading, error } = useComponents({
        group_id: groupFilter || undefined,
        q: search || undefined,
        page,
    });

    return (
        <div>
            <div className="card-header" style={{ marginBottom: 'var(--space-6)' }}>
                <h1>Components</h1>
                <Link to="/admin/components/new" className="btn btn-primary">
                    Add Component
                </Link>
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    <input
                        type="text"
                        placeholder="Search components..."
                        className="btn btn-secondary"
                        style={{ minWidth: '200px' }}
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                    />
                    <select
                        className="btn btn-secondary"
                        value={groupFilter}
                        onChange={(e) => {
                            setGroupFilter(e.target.value);
                            setPage(1);
                        }}
                    >
                        <option value="">All Groups</option>
                        {groups?.map((group) => (
                            <option key={group.id} value={group.id}>{group.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="loading">
                    <div className="loading-spinner" />
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="error-message">
                    Failed to load components. Please try again.
                </div>
            )}

            {/* List */}
            {data && (
                <>
                    {data.items.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">📦</div>
                            <p>No components found</p>
                        </div>
                    ) : (
                        <div className="card">
                            <div className="component-list">
                                {data.items.map((component) => (
                                    <Link
                                        key={component.id}
                                        to={`/components/${component.id}`}
                                        style={{ textDecoration: 'none', color: 'inherit' }}
                                    >
                                        <div className="component-item">
                                            <div>
                                                <span className="component-name">{component.name}</span>
                                                {component.description && (
                                                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem', marginTop: 'var(--space-1)' }}>
                                                        {component.description}
                                                    </p>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                                                    Tier {component.tier}
                                                </span>
                                                <span className={`status-badge ${component.current_status}`}>
                                                    {component.current_status.replace('_', ' ')}
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>

                            {/* Pagination */}
                            {data.total > data.page_size && (
                                <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-4)', marginTop: 'var(--space-6)' }}>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                    >
                                        Previous
                                    </button>
                                    <span style={{ alignSelf: 'center', color: 'var(--color-text-muted)' }}>
                                        Page {page} of {Math.ceil(data.total / data.page_size)}
                                    </span>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => setPage((p) => p + 1)}
                                        disabled={page >= Math.ceil(data.total / data.page_size)}
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
