/**
 * Maintenance Page - List maintenance windows
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { useMaintenance } from '../hooks/useApi';
import type { MaintenanceStatus } from '../api/client';

const STATUS_OPTIONS: { value: MaintenanceStatus | ''; label: string }[] = [
    { value: '', label: 'All Statuses' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'canceled', label: 'Canceled' },
];

import { CodeSnippetModal } from '../components/CodeSnippetModal';

export default function MaintenancePage() {
    const [statusFilter, setStatusFilter] = useState<MaintenanceStatus | ''>('');
    const [page, setPage] = useState(1);
    const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);

    const { data, isLoading, error } = useMaintenance({
        status: statusFilter || undefined,
        page,
    });

    return (
        <div>
            <div className="card-header" style={{ marginBottom: 'var(--space-6)' }}>
                <h1>Scheduled Maintenance</h1>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <button
                        className="btn btn-secondary"
                        onClick={() => setIsCodeModalOpen(true)}
                    >
                        API Code
                    </button>
                    <Link to="/admin/maintenance/new" className="btn btn-primary">
                        Schedule Maintenance
                    </Link>
                </div>
            </div>

            <CodeSnippetModal
                isOpen={isCodeModalOpen}
                onClose={() => setIsCodeModalOpen(false)}
                entityType="maintenance"
            />

            {/* Filters */}
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                    <select
                        className="btn btn-secondary"
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value as MaintenanceStatus | '');
                            setPage(1);
                        }}
                    >
                        {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
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
                    Failed to load maintenance windows. Please try again.
                </div>
            )}

            {/* List */}
            {data && (
                <>
                    {data.items.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">🔧</div>
                            <p>No maintenance windows found</p>
                        </div>
                    ) : (
                        <div>
                            {data.items.map((maint) => (
                                <Link
                                    key={maint.id}
                                    to={`/maintenance/${maint.id}`}
                                    style={{ textDecoration: 'none', color: 'inherit' }}
                                >
                                    <div className="incident-item" style={{ borderLeftColor: 'var(--color-maintenance)' }}>
                                        <div className="incident-header">
                                            <h4 className="incident-title">{maint.title}</h4>
                                            <span className={`status-badge ${maint.status === 'in_progress' ? 'maintenance' : maint.status === 'completed' ? 'operational' : 'degraded'}`}>
                                                {maint.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                        {maint.description && (
                                            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                                                {maint.description}
                                            </p>
                                        )}
                                        <div className="incident-meta">
                                            <span>Start: {format(new Date(maint.start_at), 'PPp')}</span>
                                            <span>End: {format(new Date(maint.end_at), 'PPp')}</span>
                                        </div>
                                    </div>
                                </Link>
                            ))}

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
