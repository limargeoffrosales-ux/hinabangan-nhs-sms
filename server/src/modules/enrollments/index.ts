import { Router } from 'express';
import { enrollmentsRoutes } from './routes';

export const enrollmentsModule = {
  routes: enrollmentsRoutes,
  mountPath: '/api/v1/enrollments',
};