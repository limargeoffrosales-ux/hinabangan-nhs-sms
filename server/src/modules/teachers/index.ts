import { Router } from 'express';
import { teachersRoutes } from './routes';

export const teachersModule = {
  routes: teachersRoutes,
  mountPath: '/api/v1/teachers',
};