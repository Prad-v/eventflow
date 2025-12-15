import { useHandleSignInCallback } from '@logto/react';
import { useNavigate } from 'react-router-dom';

export default function CallbackPage() {
    const navigate = useNavigate();
    const { isLoading } = useHandleSignInCallback(() => {
        // Navigate to root after successful login
        navigate('/');
    });

    if (isLoading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)'
            }}>
                <h2>Authenticating...</h2>
            </div>
        );
    }

    return null;
}
