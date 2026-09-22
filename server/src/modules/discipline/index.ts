import { Router } from 'express';
import { disciplineRoutes } from './routes';

export const disciplineModule = {
  routes: disciplineRoutes,
  mountPath: '/api/v1/discipline',
};