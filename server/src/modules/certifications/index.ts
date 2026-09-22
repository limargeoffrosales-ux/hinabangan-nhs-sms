import { Router } from 'express';
import { certificationsRoutes } from './routes';

export const certificationsModule = {
  routes: certificationsRoutes,
  mountPath: '/api/v1/certifications',
};