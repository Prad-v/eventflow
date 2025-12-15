/**
 * Local Users Management Page
 */
import { useState, useEffect } from 'react';
import { apiClient } from '../../../api/client';

interface LocalUser {
    id: string;
    username: string;
    email: string | null;
    display_name: string | null;
    is_active: boolean;
    is_superadmin: boolean;
    last_login: string | null;
    created_at: string;
}

export default function LocalUsersPage() {
    const [users, setUsers] = useState<LocalUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showResetModal, setShowResetModal] = useState<LocalUser | null>(null);

    // Create user form
    const [newUser, setNewUser] = useState({
        username: '',
        password: '',
        email: '',
        display_name: '',
        is_superadmin: false,
    });
    const [creating, setCreating] = useState(false);
    const [resetPassword, setResetPassword] = useState('');
    const [resetting, setResetting] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await apiClient.get('/admin/users');
            setUsers(response.data);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        setError('');

        try {
            await apiClient.post('/admin/users', {
                username: newUser.username,
                password: newUser.password,
                email: newUser.email || null,
                display_name: newUser.display_name || null,
                is_superadmin: newUser.is_superadmin,
            });
            setShowCreateModal(false);
            setNewUser({ username: '', password: '', email: '', display_name: '', is_superadmin: false });
            fetchUsers();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to create user');
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (user: LocalUser) => {
        if (!confirm(`Delete user "${user.username}"? This cannot be undone.`)) {
            return;
        }

        try {
            await apiClient.delete(`/admin/users/${user.id}`);
            fetchUsers();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to delete user');
        }
    };

    const handleToggleActive = async (user: LocalUser) => {
        try {
            await apiClient.patch(`/admin/users/${user.id}`, {
                is_active: !user.is_active,
            });
            fetchUsers();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to update user');
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!showResetModal) return;
        setResetting(true);

        try {
            await apiClient.post(`/admin/users/${showResetModal.id}/reset-password`, {
                new_password: resetPassword,
            });
            setShowResetModal(null);
            setResetPassword('');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to reset password');
        } finally {
            setResetting(false);
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'Never';
        return new Date(dateStr).toLocaleString();
    };

    if (loading) {
        return <div className="card" style={{ padding: 'var(--space-6)' }}>Loading...</div>;
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>
                        Local Admin Users
                    </h1>
                    <p style={{ color: 'var(--color-text-muted)' }}>
                        Manage local admin accounts for breakglass access
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn-primary"
                    style={{ padding: 'var(--space-3) var(--space-4)' }}
                >
                    + Add User
                </button>
            </div>

            {error && (
                <div className="card" style={{
                    background: 'var(--color-danger)',
                    color: 'white',
                    padding: 'var(--space-4)',
                    marginBottom: 'var(--space-4)',
                }}>
                    {error}
                    <button
                        onClick={() => setError('')}
                        style={{ float: 'right', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
                    >
                        ✕
                    </button>
                </div>
            )}

            <div className="card" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <th style={{ textAlign: 'left', padding: 'var(--space-3) var(--space-4)', fontWeight: 500 }}>User</th>
                            <th style={{ textAlign: 'left', padding: 'var(--space-3) var(--space-4)', fontWeight: 500 }}>Email</th>
                            <th style={{ textAlign: 'left', padding: 'var(--space-3) var(--space-4)', fontWeight: 500 }}>Role</th>
                            <th style={{ textAlign: 'left', padding: 'var(--space-3) var(--space-4)', fontWeight: 500 }}>Status</th>
                            <th style={{ textAlign: 'left', padding: 'var(--space-3) var(--space-4)', fontWeight: 500 }}>Last Login</th>
                            <th style={{ textAlign: 'right', padding: 'var(--space-3) var(--space-4)', fontWeight: 500 }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                    No local users configured. Add one to enable breakglass access.
                                </td>
                            </tr>
                        ) : (
                            users.map(user => (
                                <tr key={user.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                        <div>
                                            <strong>{user.display_name || user.username}</strong>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>@{user.username}</div>
                                        </div>
                                    </td>
                                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>
                                        {user.email || '-'}
                                    </td>
                                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                        {user.is_superadmin ? (
                                            <span style={{
                                                background: 'var(--color-primary-subtle)',
                                                color: 'var(--color-primary)',
                                                padding: '2px 8px',
                                                borderRadius: 'var(--radius-sm)',
                                                fontSize: '0.75rem',
                                            }}>
                                                Super Admin
                                            </span>
                                        ) : (
                                            <span style={{
                                                background: 'var(--color-secondary-subtle)',
                                                padding: '2px 8px',
                                                borderRadius: 'var(--radius-sm)',
                                                fontSize: '0.75rem',
                                            }}>
                                                Viewer
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                        {user.is_active ? (
                                            <span style={{ color: 'var(--color-success)' }}>● Active</span>
                                        ) : (
                                            <span style={{ color: 'var(--color-text-muted)' }}>○ Inactive</span>
                                        )}
                                    </td>
                                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                                        {formatDate(user.last_login)}
                                    </td>
                                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                                        <button
                                            onClick={() => setShowResetModal(user)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--color-primary)',
                                                cursor: 'pointer',
                                                marginRight: 'var(--space-2)',
                                            }}
                                        >
                                            Reset Password
                                        </button>
                                        <button
                                            onClick={() => handleToggleActive(user)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--color-text-muted)',
                                                cursor: 'pointer',
                                                marginRight: 'var(--space-2)',
                                            }}
                                        >
                                            {user.is_active ? 'Disable' : 'Enable'}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(user)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--color-danger)',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create User Modal */}
            {showCreateModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                }} onClick={() => setShowCreateModal(false)}>
                    <div className="card" style={{
                        padding: 'var(--space-6)',
                        width: '400px',
                        maxWidth: '90vw',
                    }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: 'var(--space-4)' }}>Create Local User</h2>
                        <form onSubmit={handleCreate}>
                            <div style={{ marginBottom: 'var(--space-4)' }}>
                                <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
                                    Username *
                                </label>
                                <input
                                    type="text"
                                    required
                                    minLength={3}
                                    value={newUser.username}
                                    onChange={e => setNewUser({ ...newUser, username: e.target.value })}
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
                            <div style={{ marginBottom: 'var(--space-4)' }}>
                                <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
                                    Password *
                                </label>
                                <input
                                    type="password"
                                    required
                                    minLength={8}
                                    value={newUser.password}
                                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: 'var(--space-3)',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--color-border)',
                                        background: 'var(--color-card-bg)',
                                        color: 'var(--color-text)',
                                    }}
                                />
                                <small style={{ color: 'var(--color-text-muted)' }}>Minimum 8 characters</small>
                            </div>
                            <div style={{ marginBottom: 'var(--space-4)' }}>
                                <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
                                    Display Name
                                </label>
                                <input
                                    type="text"
                                    value={newUser.display_name}
                                    onChange={e => setNewUser({ ...newUser, display_name: e.target.value })}
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
                            <div style={{ marginBottom: 'var(--space-4)' }}>
                                <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={newUser.email}
                                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
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
                            <div style={{ marginBottom: 'var(--space-6)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                    <input
                                        type="checkbox"
                                        checked={newUser.is_superadmin}
                                        onChange={e => setNewUser({ ...newUser, is_superadmin: e.target.checked })}
                                    />
                                    <span>Super Admin (full access)</span>
                                </label>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    style={{
                                        padding: 'var(--space-3) var(--space-4)',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--color-border)',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="btn-primary"
                                    style={{ padding: 'var(--space-3) var(--space-4)' }}
                                >
                                    {creating ? 'Creating...' : 'Create User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {showResetModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                }} onClick={() => setShowResetModal(null)}>
                    <div className="card" style={{
                        padding: 'var(--space-6)',
                        width: '400px',
                        maxWidth: '90vw',
                    }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: 'var(--space-4)' }}>Reset Password</h2>
                        <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
                            Set a new password for <strong>{showResetModal.username}</strong>
                        </p>
                        <form onSubmit={handleResetPassword}>
                            <div style={{ marginBottom: 'var(--space-6)' }}>
                                <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
                                    New Password
                                </label>
                                <input
                                    type="password"
                                    required
                                    minLength={8}
                                    value={resetPassword}
                                    onChange={e => setResetPassword(e.target.value)}
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
                            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowResetModal(null)}
                                    style={{
                                        padding: 'var(--space-3) var(--space-4)',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--color-border)',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={resetting}
                                    className="btn-primary"
                                    style={{ padding: 'var(--space-3) var(--space-4)' }}
                                >
                                    {resetting ? 'Resetting...' : 'Reset Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
