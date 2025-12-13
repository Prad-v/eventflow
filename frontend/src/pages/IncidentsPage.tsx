/**
 * Incidents Page - List and filter incidents
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { useIncidents } from '../hooks/useApi';
import type { IncidentStatus, Severity } from '../api/client';

const STATUS_OPTIONS: { value: IncidentStatus | ''; label: string }[] = [
    { value: '', label: 'All Statuses' },
    { value: 'investigating', label: 'Investigating' },
    { value: 'identified', label: 'Identified' },
    { value: 'monitoring', label: 'Monitoring' },
    { value: 'resolved', label: 'Resolved' },
];

const SEVERITY_OPTIONS: { value: Severity | ''; label: string }[] = [
    { value: '', label: 'All Severities' },
    { value: 'critical', label: 'Critical' },
    { value: 'major', label: 'Major' },
    { value: 'minor', label: 'Minor' },
    { value: 'info', label: 'Info' },
];

export default function IncidentsPage() {
    const [statusFilter, setStatusFilter] = useState<IncidentStatus | ''>('');
    const [severityFilter, setSeverityFilter] = useState<Severity | ''>('');
    const [page, setPage] = useState(1);

    const { data, isLoading, error } = useIncidents({
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
        page,
    });

    return (
        <div>
            <div className="card-header" style={{ marginBottom: 'var(--space-6)' }}>
                <h1>Incidents</h1>
                <Link to="/admin/incidents/new" className="btn btn-primary">
                    Report Incident
                </Link>
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    <select
                        className="btn btn-secondary"
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value as IncidentStatus | '');
                            setPage(1);
                        }}
                    >
                        {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <select
                        className="btn btn-secondary"
                        value={severityFilter}
                        onChange={(e) => {
                            setSeverityFilter(e.target.value as Severity | '');
                            setPage(1);
                        }}
                    >
                        {SEVERITY_OPTIONS.map((opt) => (
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
                    Failed to load incidents. Please try again.
                </div>
            )}

            {/* Incidents List */}
            {data && (
                <>
                    {data.items.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">✓</div>
                            <p>No incidents found</p>
                        </div>
                    ) : (
                        <div>
                            {data.items.map((incident) => (
                                <Link
                                    key={incident.id}
                                    to={`/incidents/${incident.id}`}
                                    style={{ textDecoration: 'none', color: 'inherit' }}
                                >
                                    <div className={`incident-item ${incident.severity}`}>
                                        <div className="incident-header">
                                            <h4 className="incident-title">{incident.title}</h4>
                                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                                <span className={`severity-badge ${incident.severity}`}>
                                                    {incident.severity}
                                                </span>
                                                <span className={`status-badge ${incident.status}`}>
                                                    {incident.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="incident-meta">
                                            <span>Started: {format(new Date(incident.started_at), 'PPp')}</span>
                                            {incident.resolved_at && (
                                                <span>Resolved: {format(new Date(incident.resolved_at), 'PPp')}</span>
                                            )}
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
