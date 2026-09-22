import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type {
  Section,
  CreateSectionRequest,
  UpdateSectionRequest,
  SectionListQuery,
} from '@meridianed/shared';

const SECTIONS_KEY = ['sections'] as const;

export function useSections(query?: SectionListQuery) {
  return useQuery({
    queryKey: [...SECTIONS_KEY, query],
    queryFn: () => apiClient.get('/sections', { query }),
  });
}

export function useSection(id: number) {
  return useQuery({
    queryKey: [...SECTIONS_KEY, id],
    queryFn: () => apiClient.get(`/sections/${id}`),
    enabled: !!id,
  });
}

export function useCreateSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSectionRequest) => apiClient.post('/sections', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SECTIONS_KEY });
    },
  });
}

export function useUpdateSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateSectionRequest }) =>
      apiClient.patch(`/sections/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: SECTIONS_KEY });
      queryClient.invalidateQueries({ queryKey: [...SECTIONS_KEY, id] });
    },
  });
}

export function useDeleteSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/sections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SECTIONS_KEY });
    },
  });
}

export function useSectionStudents(sectionId: number, query: { status?: string; limit?: number; offset?: number } = {}) {
  return useQuery({
    queryKey: [...SECTIONS_KEY, sectionId, 'students', query],
    queryFn: () => apiClient.get(`/sections/${sectionId}/students`, { query }),
    enabled: !!sectionId,
  });
}



