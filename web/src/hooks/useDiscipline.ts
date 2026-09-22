import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type {
  DisciplineIncident,
  CreateIncidentRequest,
  UpdateIncidentRequest,
  AddActionRequest,
  DisciplineListQuery,
  DisciplineKpi,
  DisciplineChart,
  DisciplineExportQuery,
} from '@meridianed/shared';

const DISCIPLINE_KEY = ['discipline'] as const;

export function useDisciplineIncidents(query?: DisciplineListQuery) {
  return useQuery({
    queryKey: [...DISCIPLINE_KEY, 'incidents', query],
    queryFn: () => apiClient.get('/discipline', { query }),
  });
}

export function useDisciplineIncident(id: number) {
  return useQuery({
    queryKey: [...DISCIPLINE_KEY, 'incidents', id],
    queryFn: () => apiClient.get(`/discipline/${id}`),
    enabled: !!id,
  });
}

export function useCreateIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateIncidentRequest) => apiClient.post('/discipline', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...DISCIPLINE_KEY, 'incidents'] });
    },
  });
}

export function useUpdateIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateIncidentRequest }) =>
      apiClient.patch(`/discipline/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [...DISCIPLINE_KEY, 'incidents'] });
      queryClient.invalidateQueries({ queryKey: [...DISCIPLINE_KEY, 'incidents', id] });
    },
  });
}

export function useAddAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AddActionRequest }) =>
      apiClient.post(`/discipline/${id}/actions`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [...DISCIPLINE_KEY, 'incidents', id] });
    },
  });
}

export function useDeleteIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/discipline/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...DISCIPLINE_KEY, 'incidents'] });
    },
  });
}

export function useDisciplineKpi() {
  return useQuery({
    queryKey: [...DISCIPLINE_KEY, 'kpi'],
    queryFn: () => apiClient.get('/discipline/kpi'),
  });
}

export function useDisciplineChart() {
  return useQuery({
    queryKey: [...DISCIPLINE_KEY, 'chart'],
    queryFn: () => apiClient.get('/discipline/chart'),
  });
}

export function useDisciplineExport(query?: DisciplineExportQuery) {
  return useMutation({
    mutationFn: () => apiClient.get('/discipline/export', { query, responseType: 'blob' }),
  });
}



