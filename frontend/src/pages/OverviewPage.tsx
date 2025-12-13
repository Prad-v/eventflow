/**
 * Overview Page - Main status dashboard
 */
import { format } from 'date-fns';
import { useStatusOverview } from '../hooks/useApi';
import type { ComponentStatus } from '../api/client';
import { Link } from 'react-router-dom';

const STATUS_LABELS: Record<ComponentStatus, string> = {
    operational: 'All Systems Operational',
    degraded: 'Some Systems Degraded',
    partial_outage: 'Partial System Outage',
    major_outage: 'Major System Outage',
    maintenance: 'System Under Maintenance',
};

const STATUS_ICONS: Record<ComponentStatus, string> = {
    operational: '✓',
    degraded: '⚠',
    partial_outage: '⚡',
    major_outage: '✕',
    maintenance: '🔧',
};

export default function OverviewPage() {
    const { data: overview, isLoading, error } = useStatusOverview();

    if (isLoading) {
        return (
            <div className="loading">
                <div className="loading-spinner" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-message">
                Failed to load status. Please try again later.
            </div>
        );
    }

    if (!overview) {
        return null;
    }

    return (
        <div>
            {/* Global Status Banner */}
            <div className={`global-status-banner ${overview.global_status}`}>
                <div className="status-icon">
                    {STATUS_ICONS[overview.global_status]}
                </div>
                <div className="status-text">
                    <h2>{STATUS_LABELS[overview.global_status]}</h2>
                    <p>Last updated: {format(new Date(overview.last_updated), 'PPpp')}</p>
                </div>
            </div>

            {/* Active Incidents */}
            {overview.active_incidents.length > 0 && (
                <section className="incidents-section">
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Active Incidents</h3>
                            <Link to="/incidents" className="btn btn-secondary">View All</Link>
                        </div>
                        {overview.active_incidents.map((incident) => (
                            <Link
                                key={incident.id}
                                to={`/incidents/${incident.id}`}
                                style={{ textDecoration: 'none', color: 'inherit' }}
                            >
                                <div className={`incident-item ${incident.severity}`}>
                                    <div className="incident-header">
                                        <h4 className="incident-title">{incident.title}</h4>
                                        <span className={`severity-badge ${incident.severity}`}>
                                            {incident.severity}
                                        </span>
                                    </div>
                                    <div className="incident-meta">
                                        <span>Started: {format(new Date(incident.started_at), 'PPp')}</span>
                                        <span>Affecting {incident.affected_components} component(s)</span>
                                        <span className={`status-badge ${incident.status}`}>
                                            {incident.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Component Groups */}
            <section style={{ marginTop: 'var(--space-8)' }}>
                <h2 style={{ marginBottom: 'var(--space-6)' }}>System Status</h2>
                {overview.groups.map((group) => (
                    <div key={group.id || 'ungrouped'} className="component-group card">
                        <div className="group-header">
                            <h3>{group.name}</h3>
                        </div>
                        <div className="component-list">
                            {group.components.map((component) => (
                                <Link
                                    key={component.id}
                                    to={`/components/${component.id}`}
                                    style={{ textDecoration: 'none', color: 'inherit' }}
                                >
                                    <div className="component-item">
                                        <span className="component-name">{component.name}</span>
                                        <span className={`status-badge ${component.status}`}>
                                            {component.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                ))}
            </section>

            {/* Upcoming Maintenance */}
            {overview.upcoming_maintenance.length > 0 && (
                <section style={{ marginTop: 'var(--space-8)' }}>
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Scheduled Maintenance</h3>
                            <Link to="/maintenance" className="btn btn-secondary">View All</Link>
                        </div>
                        {overview.upcoming_maintenance.map((maint) => (
                            <Link
                                key={maint.id}
                                to={`/maintenance/${maint.id}`}
                                style={{ textDecoration: 'none', color: 'inherit' }}
                            >
                                <div className="incident-item" style={{ borderLeftColor: 'var(--color-maintenance)' }}>
                                    <div className="incident-header">
                                        <h4 className="incident-title">{maint.title}</h4>
                                        <span className="status-badge maintenance">Scheduled</span>
                                    </div>
                                    <div className="incident-meta">
                                        <span>Starts: {format(new Date(maint.start_at), 'PPp')}</span>
                                        <span>Ends: {format(new Date(maint.end_at), 'PPp')}</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
