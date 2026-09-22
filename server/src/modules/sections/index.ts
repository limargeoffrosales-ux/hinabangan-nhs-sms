import { Router } from 'express';
import { sectionsRoutes } from './routes';

export const sectionsModule = {
  routes: sectionsRoutes,
  mountPath: '/api/v1/sections',
};