import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type {
  Attendance,
  AttendanceListQuery,
  AttendanceBulkRequest,
  AttendanceCheckRequest,
  StudentAttendanceQuery,
  StudentAttendanceResponse,
  AttendanceExportQuery,
} from '@meridianed/shared';

const ATTENDANCE_KEY = ['attendance'] as const;

export function useAttendance(query?: AttendanceListQuery) {
  return useQuery({
    queryKey: [...ATTENDANCE_KEY, query],
    queryFn: () => apiClient.get('/attendance', { query }),
  });
}

export function useBulkAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AttendanceBulkRequest) => apiClient.post('/attendance/bulk', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_KEY });
    },
  });
}

export function useCheckAttendance() {
  return useMutation({
    mutationFn: ({ studentId, data }: { studentId: number; data: AttendanceCheckRequest }) =>
      apiClient.post(`/attendance/${studentId}/check`, data),
  });
}

export function useStudentAttendance(studentId: number, query?: StudentAttendanceQuery) {
  return useQuery({
    queryKey: [...ATTENDANCE_KEY, 'student', studentId, query],
    queryFn: () => apiClient.get(`/attendance/student/${studentId}`, { query }),
    enabled: !!studentId,
  });
}

export function useAttendanceExport(query?: AttendanceExportQuery) {
  return useMutation({
    mutationFn: () => apiClient.get('/attendance/export', { query, responseType: 'blob' }),
  });
}



