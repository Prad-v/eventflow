/**
 * API Client for Status Page
 */
import axios from 'axios';


// We'll trust that the Logto provider handles the token acquisition and the app logic
// passes it to the client, OR we can implement a method to set the token.
// A simpler approach for this architecture is to export a function to set the token,
// or use a class. Given the functional `useApi` hooks, let's add a token setter.


export const apiClient = axios.create({
    baseURL: window.env?.API_URL || import.meta.env.VITE_API_URL || '/v1',
    headers: {
        'Content-Type': 'application/json',
    },
});

let getAccessToken: (() => Promise<string>) | null = null;

export const setAccessTokenGetter = (getter: () => Promise<string>) => {
    getAccessToken = getter;
};

apiClient.interceptors.request.use(async (config) => {
    if (getAccessToken) {
        try {
            const token = await getAccessToken();
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        } catch (e) {
            console.warn('Failed to get access token', e);
        }
    }
    return config;
});

// Types
export interface ComponentGroup {
    id: string;
    name: string;
    description?: string;
    owner_team?: string;
    display_order: number;
    created_at: string;
    updated_at: string;
}

export interface Component {
    id: string;
    group_id?: string;
    name: string;
    description?: string;
    tier: number;
    service_owner?: string;
    tags: Record<string, string>;
    display_order: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    current_status: ComponentStatus;
}

export type ComponentStatus =
    | 'operational'
    | 'degraded'
    | 'partial_outage'
    | 'major_outage'
    | 'maintenance';

export type Severity = 'critical' | 'major' | 'minor' | 'info';
export type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved';
export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'canceled';
export type Impact = 'degraded' | 'outage';

export interface Incident {
    id: string;
    title: string;
    severity: Severity;
    status: IncidentStatus;
    started_at: string;
    resolved_at?: string;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface IncidentUpdate {
    id: string;
    message: string;
    status_snapshot: IncidentStatus;
    created_by: string;
    created_at: string;
}

export interface IncidentDetail extends Incident {
    updates: IncidentUpdate[];
    components: {
        component_id: string;
        impact: Impact;
        component?: Component;
    }[];
}

export interface MaintenanceWindow {
    id: string;
    title: string;
    description?: string;
    status: MaintenanceStatus;
    start_at: string;
    end_at: string;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface ComponentStatusInfo {
    id: string;
    name: string;
    status: ComponentStatus;
    tier: number;
}

export interface GroupStatusInfo {
    id: string | null;
    name: string;
    components: ComponentStatusInfo[];
}

export interface ActiveIncidentSummary {
    id: string;
    title: string;
    severity: Severity;
    status: IncidentStatus;
    started_at: string;
    affected_components: number;
}

export interface StatusOverview {
    global_status: ComponentStatus;
    groups: GroupStatusInfo[];
    active_incidents: ActiveIncidentSummary[];
    upcoming_maintenance: MaintenanceWindow[];
    last_updated: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    page: number;
    page_size: number;
    total: number;
}

// API Functions
export const statusApi = {
    getOverview: () =>
        apiClient.get<StatusOverview>('/status/overview').then(r => r.data),
};

export const componentsApi = {
    list: (params?: { group_id?: string; q?: string; page?: number }) =>
        apiClient.get<PaginatedResponse<Component>>('/components', { params }).then(r => r.data),

    get: (id: string) =>
        apiClient.get<Component>(`/components/${id}`).then(r => r.data),

    listGroups: () =>
        apiClient.get<ComponentGroup[]>('/components/groups').then(r => r.data),

    create: (data: { name: string; description?: string; group_id?: string; tier?: number }) =>
        apiClient.post<Component>('/components', data).then(r => r.data),
};

export const incidentsApi = {
    list: (params?: { status?: IncidentStatus; severity?: Severity; page?: number }) =>
        apiClient.get<PaginatedResponse<Incident>>('/incidents', { params }).then(r => r.data),

    get: (id: string) =>
        apiClient.get<IncidentDetail>(`/incidents/${id}`).then(r => r.data),

    create: (data: { title: string; severity: Severity; message: string; components?: { component_id: string; impact: Impact }[] }) =>
        apiClient.post<IncidentDetail>('/incidents', data).then(r => r.data),

    addUpdate: (id: string, data: { message: string; status?: IncidentStatus }) =>
        apiClient.post<IncidentUpdate>(`/incidents/${id}/updates`, data).then(r => r.data),

    resolve: (id: string, message: string) =>
        apiClient.post<IncidentDetail>(`/incidents/${id}/resolve`, { message }).then(r => r.data),
};

export const maintenanceApi = {
    list: (params?: { status?: MaintenanceStatus; page?: number }) =>
        apiClient.get<PaginatedResponse<MaintenanceWindow>>('/maintenance', { params }).then(r => r.data),

    get: (id: string) =>
        apiClient.get<MaintenanceWindow>(`/maintenance/${id}`).then(r => r.data),

    create: (data: { title: string; description?: string; start_at: string; end_at: string; components?: { component_id: string; expected_impact: Impact }[] }) =>
        apiClient.post<MaintenanceWindow>('/maintenance', data).then(r => r.data),
};
