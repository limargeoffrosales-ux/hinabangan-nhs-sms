import { Router } from 'express';
import { consentRoutes } from './routes';

export const consentModule = {
  routes: consentRoutes,
  mountPath: '/api/v1/consent',
};