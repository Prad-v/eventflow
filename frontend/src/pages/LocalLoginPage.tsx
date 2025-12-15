/**
 * Local Login Page - Breakglass admin access
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';

export default function LocalLoginPage() {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Password change state
    const [mustChangePassword, setMustChangePassword] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await apiClient.post('/auth/local/login', {
                username,
                password,
            });

            // Store the token
            const { access_token, user } = response.data;
            localStorage.setItem('local_auth_token', access_token);
            localStorage.setItem('local_auth_user', JSON.stringify(user));

            // Check if password change is required
            if (user.must_change_password) {
                setCurrentPassword(password);
                setMustChangePassword(true);
                setLoading(false);
                return;
            }

            // Redirect to home
            navigate('/');
            window.location.reload();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Invalid username or password');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setLoading(true);

        try {
            await apiClient.post('/auth/local/change-password', {
                current_password: currentPassword,
                new_password: newPassword,
            });

            // Redirect to home after successful password change
            navigate('/');
            window.location.reload();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to change password');
        } finally {
            setLoading(false);
        }
    };

    const cardStyle = {
        maxWidth: '400px',
        width: '100%',
        padding: 'var(--space-8)',
    };

    const inputStyle = {
        width: '100%',
        padding: 'var(--space-3)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-card-bg)',
        color: 'var(--color-text)',
        fontSize: '1rem',
    };

    // Password change form
    if (mustChangePassword) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '60vh',
                padding: 'var(--space-6)',
            }}>
                <div className="card" style={cardStyle}>
                    <h1 style={{
                        textAlign: 'center',
                        marginBottom: 'var(--space-2)',
                        fontSize: '1.5rem',
                    }}>
                        🔑 Change Password
                    </h1>
                    <p style={{
                        textAlign: 'center',
                        color: 'var(--color-text-muted)',
                        marginBottom: 'var(--space-6)',
                        fontSize: '0.875rem',
                    }}>
                        You must change your password before continuing
                    </p>

                    {error && (
                        <div style={{
                            background: 'var(--color-danger)',
                            color: 'white',
                            padding: 'var(--space-3)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 'var(--space-4)',
                            fontSize: '0.875rem',
                        }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handlePasswordChange}>
                        <div style={{ marginBottom: 'var(--space-4)' }}>
                            <label style={{
                                display: 'block',
                                marginBottom: 'var(--space-2)',
                                fontWeight: 500,
                            }}>
                                New Password
                            </label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                minLength={8}
                                autoComplete="new-password"
                                style={inputStyle}
                            />
                        </div>

                        <div style={{ marginBottom: 'var(--space-6)' }}>
                            <label style={{
                                display: 'block',
                                marginBottom: 'var(--space-2)',
                                fontWeight: 500,
                            }}>
                                Confirm Password
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={8}
                                autoComplete="new-password"
                                style={inputStyle}
                            />
                            <small style={{ color: 'var(--color-text-muted)' }}>
                                Minimum 8 characters
                            </small>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary"
                            style={{
                                width: '100%',
                                padding: 'var(--space-3)',
                                fontSize: '1rem',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.7 : 1,
                            }}
                        >
                            {loading ? 'Updating...' : 'Update Password'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // Login form
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            padding: 'var(--space-6)',
        }}>
            <div className="card" style={cardStyle}>
                <h1 style={{
                    textAlign: 'center',
                    marginBottom: 'var(--space-2)',
                    fontSize: '1.5rem',
                }}>
                    🔐 Local Admin Login
                </h1>
                <p style={{
                    textAlign: 'center',
                    color: 'var(--color-text-muted)',
                    marginBottom: 'var(--space-6)',
                    fontSize: '0.875rem',
                }}>
                    Breakglass access for when OIDC is unavailable
                </p>

                {error && (
                    <div style={{
                        background: 'var(--color-danger)',
                        color: 'white',
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: 'var(--space-4)',
                        fontSize: '0.875rem',
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin}>
                    <div style={{ marginBottom: 'var(--space-4)' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: 'var(--space-2)',
                            fontWeight: 500,
                        }}>
                            Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            autoComplete="username"
                            style={inputStyle}
                        />
                    </div>

                    <div style={{ marginBottom: 'var(--space-6)' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: 'var(--space-2)',
                            fontWeight: 500,
                        }}>
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                            style={inputStyle}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary"
                        style={{
                            width: '100%',
                            padding: 'var(--space-3)',
                            fontSize: '1rem',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.7 : 1,
                        }}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div style={{
                    marginTop: 'var(--space-6)',
                    paddingTop: 'var(--space-4)',
                    borderTop: '1px solid var(--color-border)',
                    textAlign: 'center',
                }}>
                    <p style={{
                        color: 'var(--color-text-muted)',
                        fontSize: '0.75rem',
                        marginBottom: 'var(--space-2)',
                    }}>
                        Default credentials: admin / admin
                    </p>
                    <a
                        href="/"
                        style={{
                            color: 'var(--color-primary)',
                            textDecoration: 'none',
                            fontSize: '0.875rem',
                        }}
                    >
                        ← Back to Status Page
                    </a>
                </div>
            </div>
        </div>
    );
}

