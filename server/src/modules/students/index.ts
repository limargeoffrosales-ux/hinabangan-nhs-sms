// Students feature module
import { Router } from 'express';
import { studentsRoutes } from './routes';

export const studentsModule = {
  routes: studentsRoutes,
  mountPath: '/api/v1/students',
};