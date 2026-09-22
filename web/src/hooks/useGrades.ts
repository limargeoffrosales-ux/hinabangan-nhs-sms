import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type {
  Grade,
  ClassGradesQuery,
  ClassGradesResponse,
  SaveGradesRequest,
  SaveGradesResponse,
  ReportCardQuery,
  ReportCardResponse,
  GradeExportQuery,
} from '@meridianed/shared';

const GRADES_KEY = ['grades'] as const;

export function useClassGrades(query: ClassGradesQuery) {
  return useQuery({
    queryKey: [...GRADES_KEY, 'class', query],
    queryFn: () => apiClient.get('/grades/class', { query }),
    enabled: !!query.section_id && !!query.subject_id && !!query.school_year && !!query.term,
  });
}

export function useSaveGrades() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveGradesRequest) => apiClient.post('/grades/class', data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...GRADES_KEY, 'class', {
          section_id: variables.section_id,
          subject_id: variables.subject_id,
          school_year: variables.school_year,
          term: variables.term,
        }],
      });
    },
  });
}

export function useReportCard(studentId: number, query: ReportCardQuery) {
  return useQuery({
    queryKey: [...GRADES_KEY, 'report-card', studentId, query],
    queryFn: () => apiClient.get(`/grades/report-card/${studentId}`, { query }),
    enabled: !!studentId && !!query.school_year && !!query.term,
  });
}

export function useGradeYears(studentId: number) {
  return useQuery({
    queryKey: [...GRADES_KEY, 'years', studentId],
    queryFn: () => apiClient.get(`/grades/years/${studentId}`),
    enabled: !!studentId,
  });
}

export function useGradeExport(query: GradeExportQuery) {
  return useMutation({
    mutationFn: () => apiClient.get('/grades/export', { query, responseType: 'blob' }),
  });
}



