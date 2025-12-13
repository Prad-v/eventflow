/**
 * Incident Detail Page - View incident with timeline
 */
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { useIncident, useResolveIncident, useAddIncidentUpdate } from '../hooks/useApi';
import { useState } from 'react';

export default function IncidentDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { data: incident, isLoading, error } = useIncident(id!);
    const resolveMutation = useResolveIncident();
    const addUpdateMutation = useAddIncidentUpdate();

    const [updateMessage, setUpdateMessage] = useState('');
    const [showUpdateForm, setShowUpdateForm] = useState(false);

    if (isLoading) {
        return (
            <div className="loading">
                <div className="loading-spinner" />
            </div>
        );
    }

    if (error || !incident) {
        return (
            <div className="error-message">
                Incident not found or failed to load.
            </div>
        );
    }

    const handleAddUpdate = async () => {
        if (!updateMessage.trim()) return;

        await addUpdateMutation.mutateAsync({
            id: incident.id,
            data: { message: updateMessage },
        });

        setUpdateMessage('');
        setShowUpdateForm(false);
    };

    const handleResolve = async () => {
        const message = prompt('Enter resolution message:');
        if (!message) return;

        await resolveMutation.mutateAsync({ id: incident.id, message });
    };

    return (
        <div>
            {/* Breadcrumb */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
                <Link to="/incidents" style={{ color: 'var(--color-text-muted)' }}>
                    ← Back to Incidents
                </Link>
            </div>

            {/* Header */}
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="card-header">
                    <div>
                        <h1 style={{ marginBottom: 'var(--space-2)' }}>{incident.title}</h1>
                        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                            <span className={`severity-badge ${incident.severity}`}>
                                {incident.severity}
                            </span>
                            <span className={`status-badge ${incident.status}`}>
                                {incident.status.replace('_', ' ')}
                            </span>
                        </div>
                    </div>
                    {incident.status !== 'resolved' && (
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowUpdateForm(!showUpdateForm)}
                            >
                                Add Update
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleResolve}
                                disabled={resolveMutation.isPending}
                            >
                                Resolve
                            </button>
                        </div>
                    )}
                </div>

                <div className="incident-meta">
                    <span>Started: {format(new Date(incident.started_at), 'PPpp')}</span>
                    {incident.resolved_at && (
                        <span>Resolved: {format(new Date(incident.resolved_at), 'PPpp')}</span>
                    )}
                    <span>Created by: {incident.created_by}</span>
                </div>
            </div>

            {/* Add Update Form */}
            {showUpdateForm && (
                <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Post Update</h3>
                    <textarea
                        style={{
                            width: '100%',
                            minHeight: '100px',
                            padding: 'var(--space-3)',
                            background: 'var(--color-bg-tertiary)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--color-text-primary)',
                            fontFamily: 'inherit',
                            fontSize: '0.875rem',
                            resize: 'vertical',
                        }}
                        placeholder="Describe the current status..."
                        value={updateMessage}
                        onChange={(e) => setUpdateMessage(e.target.value)}
                    />
                    <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)' }}>
                        <button
                            className="btn btn-primary"
                            onClick={handleAddUpdate}
                            disabled={addUpdateMutation.isPending || !updateMessage.trim()}
                        >
                            {addUpdateMutation.isPending ? 'Posting...' : 'Post Update'}
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setShowUpdateForm(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Affected Components */}
            {incident.components.length > 0 && (
                <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Affected Components</h3>
                    <div className="component-list">
                        {incident.components.map((comp) => (
                            <div key={comp.component_id} className="component-item">
                                <span className="component-name">
                                    {comp.component?.name || comp.component_id}
                                </span>
                                <span className={`status-badge ${comp.impact === 'outage' ? 'major_outage' : 'degraded'}`}>
                                    {comp.impact}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Timeline */}
            <div className="card">
                <h3 className="card-title" style={{ marginBottom: 'var(--space-6)' }}>Timeline</h3>
                <div className="timeline">
                    {incident.updates.map((update) => (
                        <div key={update.id} className="timeline-item">
                            <div className="timeline-time">
                                {format(new Date(update.created_at), 'PPp')} • {update.created_by}
                            </div>
                            <div className="timeline-content">
                                <div style={{ marginBottom: 'var(--space-2)' }}>
                                    <span className={`status-badge ${update.status_snapshot}`}>
                                        {update.status_snapshot.replace('_', ' ')}
                                    </span>
                                </div>
                                <p>{update.message}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
