/**
 * Admin - Create Component Page
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useComponentGroups } from '../../hooks/useApi';
import { componentsApi } from '../../api/client';
import type { ComponentGroup } from '../../api/client';

const TIER_OPTIONS = [
    { value: 0, label: 'Tier 0 - Critical Infrastructure' },
    { value: 1, label: 'Tier 1 - Core Services' },
    { value: 2, label: 'Tier 2 - Standard Services' },
    { value: 3, label: 'Tier 3 - Non-critical' },
];

export default function CreateComponentPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { data: groups } = useComponentGroups();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [groupId, setGroupId] = useState<string>('');
    const [tier, setTier] = useState(2);
    const [serviceOwner, setServiceOwner] = useState('');

    const createMutation = useMutation({
        mutationFn: componentsApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['components'] });
            navigate('/components');
        },
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) return;

        try {
            await createMutation.mutateAsync({
                name: name.trim(),
                description: description.trim() || undefined,
                group_id: groupId || undefined,
                tier,
            });
        } catch (error) {
            console.error('Failed to create component:', error);
        }
    };

    return (
        <div>
            <div style={{ marginBottom: 'var(--space-4)' }}>
                <Link to="/components" style={{ color: 'var(--color-text-muted)' }}>
                    ← Back to Components
                </Link>
            </div>

            <h1 style={{ marginBottom: 'var(--space-6)' }}>Add New Component</h1>

            <form onSubmit={handleSubmit}>
                <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Component Details</h3>

                    {/* Name */}
                    <div style={{ marginBottom: 'var(--space-4)' }}>
                        <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
                            Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., API Gateway, User Service"
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
                            placeholder="Brief description of what this component does..."
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

                    {/* Group */}
                    <div style={{ marginBottom: 'var(--space-4)' }}>
                        <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
                            Component Group
                        </label>
                        <select
                            value={groupId}
                            onChange={(e) => setGroupId(e.target.value)}
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
                            <option value="">No Group</option>
                            {groups?.map((group: ComponentGroup) => (
                                <option key={group.id} value={group.id}>{group.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Tier */}
                    <div style={{ marginBottom: 'var(--space-4)' }}>
                        <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
                            Tier *
                        </label>
                        <select
                            value={tier}
                            onChange={(e) => setTier(Number(e.target.value))}
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
                            {TIER_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                        <p style={{ marginTop: 'var(--space-1)', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                            Tier affects how the component status impacts global status
                        </p>
                    </div>

                    {/* Service Owner */}
                    <div>
                        <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
                            Service Owner
                        </label>
                        <input
                            type="text"
                            value={serviceOwner}
                            onChange={(e) => setServiceOwner(e.target.value)}
                            placeholder="Team or person responsible"
                            style={{
                                width: '100%',
                                padding: 'var(--space-3)',
                                background: 'var(--color-bg-tertiary)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--color-text-primary)',
                                fontSize: '1rem',
                            }}
                        />
                    </div>
                </div>

                {/* Submit */}
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={createMutation.isPending || !name.trim()}
                    >
                        {createMutation.isPending ? 'Creating...' : 'Create Component'}
                    </button>
                    <Link to="/components" className="btn btn-secondary">
                        Cancel
                    </Link>
                </div>

                {createMutation.isError && (
                    <div className="error-message" style={{ marginTop: 'var(--space-4)' }}>
                        Failed to create component. Please try again.
                    </div>
                )}
            </form>
        </div>
    );
}
