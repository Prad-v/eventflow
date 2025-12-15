/**
 * OIDC Status Context
 * Provides app-wide access to OIDC configuration status
 */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { apiClient } from '../api/client';

interface OidcStatus {
    oidc_configured: boolean;
    oidc_enabled: boolean;
    oidc_active: boolean;
    provider_name: string | null;
}

interface OidcStatusContextType {
    status: OidcStatus | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

const defaultStatus: OidcStatus = {
    oidc_configured: false,
    oidc_enabled: false,
    oidc_active: false,
    provider_name: null,
};

const OidcStatusContext = createContext<OidcStatusContextType>({
    status: null,
    loading: true,
    error: null,
    refetch: async () => { },
});

export function OidcStatusProvider({ children }: { children: ReactNode }) {
    const [status, setStatus] = useState<OidcStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStatus = async () => {
        try {
            const response = await apiClient.get('/system/oidc-status');
            setStatus(response.data);
            setError(null);
        } catch (err: any) {
            // If endpoint doesn't exist yet, assume OIDC is not configured
            setStatus(defaultStatus);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    return (
        <OidcStatusContext.Provider value={{ status, loading, error, refetch: fetchStatus }}>
            {children}
        </OidcStatusContext.Provider>
    );
}

export function useOidcStatus() {
    return useContext(OidcStatusContext);
}

export function isOidcActive(status: OidcStatus | null): boolean {
    return status?.oidc_active ?? false;
}
