import { Router } from 'express';
import { subjectsRoutes } from './routes';

export const subjectsModule = {
  routes: subjectsRoutes,
  mountPath: '/api/v1/subjects',
};