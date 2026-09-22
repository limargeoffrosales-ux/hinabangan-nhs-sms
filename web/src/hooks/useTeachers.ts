import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type {
  Teacher,
  CreateTeacherRequest,
  UpdateTeacherRequest,
  TeacherListQuery,
} from '@meridianed/shared';

const TEACHERS_KEY = ['teachers'] as const;

export function useTeachers(query?: TeacherListQuery) {
  return useQuery({
    queryKey: [...TEACHERS_KEY, query],
    queryFn: () => apiClient.get('/teachers', { query }),
  });
}

export function useTeacher(id: number) {
  return useQuery({
    queryKey: [...TEACHERS_KEY, id],
    queryFn: () => apiClient.get(`/teachers/${id}`),
    enabled: !!id,
  });
}

export function useCreateTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTeacherRequest) => apiClient.post('/teachers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEACHERS_KEY });
    },
  });
}

export function useUpdateTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateTeacherRequest }) =>
      apiClient.patch(`/teachers/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: TEACHERS_KEY });
      queryClient.invalidateQueries({ queryKey: [...TEACHERS_KEY, id] });
    },
  });
}

export function useDeleteTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/teachers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEACHERS_KEY });
    },
  });
}



