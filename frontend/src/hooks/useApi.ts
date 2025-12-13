/**
 * TanStack Query hooks for data fetching
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    statusApi,
    componentsApi,
    incidentsApi,
    maintenanceApi,
} from '../api/client';
import type { IncidentStatus, Severity, MaintenanceStatus } from '../api/client';

// Query Keys
export const queryKeys = {
    statusOverview: ['status', 'overview'] as const,
    components: (params?: object) => ['components', params] as const,
    component: (id: string) => ['components', id] as const,
    componentGroups: ['components', 'groups'] as const,
    incidents: (params?: object) => ['incidents', params] as const,
    incident: (id: string) => ['incidents', id] as const,
    maintenance: (params?: object) => ['maintenance', params] as const,
    maintenanceItem: (id: string) => ['maintenance', id] as const,
};

// Status hooks
export function useStatusOverview() {
    return useQuery({
        queryKey: queryKeys.statusOverview,
        queryFn: statusApi.getOverview,
        refetchInterval: 30000, // Refresh every 30 seconds
        staleTime: 10000,
    });
}

// Component hooks
export function useComponents(params?: { group_id?: string; q?: string; page?: number }) {
    return useQuery({
        queryKey: queryKeys.components(params),
        queryFn: () => componentsApi.list(params),
    });
}

export function useComponent(id: string) {
    return useQuery({
        queryKey: queryKeys.component(id),
        queryFn: () => componentsApi.get(id),
        enabled: !!id,
    });
}

export function useComponentGroups() {
    return useQuery({
        queryKey: queryKeys.componentGroups,
        queryFn: componentsApi.listGroups,
    });
}

// Incident hooks
export function useIncidents(params?: { status?: IncidentStatus; severity?: Severity; page?: number }) {
    return useQuery({
        queryKey: queryKeys.incidents(params),
        queryFn: () => incidentsApi.list(params),
    });
}

export function useIncident(id: string) {
    return useQuery({
        queryKey: queryKeys.incident(id),
        queryFn: () => incidentsApi.get(id),
        enabled: !!id,
    });
}

export function useCreateIncident() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: incidentsApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['incidents'] });
            queryClient.invalidateQueries({ queryKey: queryKeys.statusOverview });
        },
    });
}

export function useAddIncidentUpdate() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: { message: string; status?: IncidentStatus } }) =>
            incidentsApi.addUpdate(id, data),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.incident(id) });
            queryClient.invalidateQueries({ queryKey: queryKeys.statusOverview });
        },
    });
}

export function useResolveIncident() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, message }: { id: string; message: string }) =>
            incidentsApi.resolve(id, message),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.incident(id) });
            queryClient.invalidateQueries({ queryKey: ['incidents'] });
            queryClient.invalidateQueries({ queryKey: queryKeys.statusOverview });
        },
    });
}

// Maintenance hooks
export function useMaintenance(params?: { status?: MaintenanceStatus; page?: number }) {
    return useQuery({
        queryKey: queryKeys.maintenance(params),
        queryFn: () => maintenanceApi.list(params),
    });
}

export function useMaintenanceItem(id: string) {
    return useQuery({
        queryKey: queryKeys.maintenanceItem(id),
        queryFn: () => maintenanceApi.get(id),
        enabled: !!id,
    });
}

export function useCreateMaintenance() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: maintenanceApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['maintenance'] });
            queryClient.invalidateQueries({ queryKey: queryKeys.statusOverview });
        },
    });
}
