import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type {
  Subject,
  CreateSubjectRequest,
  UpdateSubjectRequest,
  SubjectListQuery,
} from '@meridianed/shared';

const SUBJECTS_KEY = ['subjects'] as const;

export function useSubjects(query?: SubjectListQuery) {
  return useQuery({
    queryKey: [...SUBJECTS_KEY, query],
    queryFn: () => apiClient.get('/subjects', { query }),
  });
}

export function useSubject(id: number) {
  return useQuery({
    queryKey: [...SUBJECTS_KEY, id],
    queryFn: () => apiClient.get(`/subjects/${id}`),
    enabled: !!id,
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSubjectRequest) => apiClient.post('/subjects', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUBJECTS_KEY });
    },
  });
}

export function useUpdateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateSubjectRequest }) =>
      apiClient.patch(`/subjects/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: SUBJECTS_KEY });
      queryClient.invalidateQueries({ queryKey: [...SUBJECTS_KEY, id] });
    },
  });
}

export function useDeleteSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/subjects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUBJECTS_KEY });
    },
  });
}



