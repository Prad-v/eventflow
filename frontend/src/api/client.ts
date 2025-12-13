/**
 * API Client for Status Page
 */
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
    baseURL: `${API_BASE_URL}/v1`,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
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
        api.get<StatusOverview>('/status/overview').then(r => r.data),
};

export const componentsApi = {
    list: (params?: { group_id?: string; q?: string; page?: number }) =>
        api.get<PaginatedResponse<Component>>('/components', { params }).then(r => r.data),

    get: (id: string) =>
        api.get<Component>(`/components/${id}`).then(r => r.data),

    listGroups: () =>
        api.get<ComponentGroup[]>('/components/groups').then(r => r.data),

    create: (data: { name: string; description?: string; group_id?: string; tier?: number }) =>
        api.post<Component>('/components', data).then(r => r.data),
};

export const incidentsApi = {
    list: (params?: { status?: IncidentStatus; severity?: Severity; page?: number }) =>
        api.get<PaginatedResponse<Incident>>('/incidents', { params }).then(r => r.data),

    get: (id: string) =>
        api.get<IncidentDetail>(`/incidents/${id}`).then(r => r.data),

    create: (data: { title: string; severity: Severity; message: string; components?: { component_id: string; impact: Impact }[] }) =>
        api.post<IncidentDetail>('/incidents', data).then(r => r.data),

    addUpdate: (id: string, data: { message: string; status?: IncidentStatus }) =>
        api.post<IncidentUpdate>(`/incidents/${id}/updates`, data).then(r => r.data),

    resolve: (id: string, message: string) =>
        api.post<IncidentDetail>(`/incidents/${id}/resolve`, { message }).then(r => r.data),
};

export const maintenanceApi = {
    list: (params?: { status?: MaintenanceStatus; page?: number }) =>
        api.get<PaginatedResponse<MaintenanceWindow>>('/maintenance', { params }).then(r => r.data),

    get: (id: string) =>
        api.get<MaintenanceWindow>(`/maintenance/${id}`).then(r => r.data),

    create: (data: { title: string; description?: string; start_at: string; end_at: string; components?: { component_id: string; expected_impact: Impact }[] }) =>
        api.post<MaintenanceWindow>('/maintenance', data).then(r => r.data),
};
