import { Router } from 'express';
import { assignmentsRoutes } from './routes';

export const assignmentsModule = {
  routes: assignmentsRoutes,
  mountPath: '/api/v1/assignments',
};