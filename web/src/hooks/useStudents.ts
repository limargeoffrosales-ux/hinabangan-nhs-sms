import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type {
  Student,
  StudentListQuery,
  CreateStudentRequest,
  UpdateStudentRequest,
  StudentExportQuery,
} from '@meridianed/shared';

const STUDENTS_KEY = ['students'] as const;

export function useStudents(query?: StudentListQuery) {
  return useQuery({
    queryKey: [...STUDENTS_KEY, query],
    queryFn: () => apiClient.get('/students', { query }),
  });
}

export function useStudent(id: number) {
  return useQuery({
    queryKey: [...STUDENTS_KEY, id],
    queryFn: () => apiClient.get(`/students/${id}`),
    enabled: !!id,
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateStudentRequest) => apiClient.post('/students', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STUDENTS_KEY });
    },
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateStudentRequest }) =>
      apiClient.patch(`/students/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: STUDENTS_KEY });
      queryClient.invalidateQueries({ queryKey: [...STUDENTS_KEY, id] });
    },
  });
}

export function useDeleteStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/students/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STUDENTS_KEY });
    },
  });
}

export function useStudentExport(query?: StudentExportQuery) {
  return useMutation({
    mutationFn: () => apiClient.get('/students/export', { query, responseType: 'blob' }),
  });
}

// Student link requests
export function useLinkRequests(status?: 'pending' | 'approved' | 'rejected') {
  return useQuery({
    queryKey: ['link-requests', status],
    queryFn: () => apiClient.get('/students/link-requests', { query: { status } }),
  });
}

export function useApproveLinkRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.post(`/students/link-requests/${id}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['link-requests'] });
    },
  });
}

export function useRejectLinkRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string }) =>
      apiClient.post(`/students/link-requests/${id}/reject`, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['link-requests'] });
    },
  });
}



