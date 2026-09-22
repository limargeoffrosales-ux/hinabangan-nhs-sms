// Dashboard feature module (stub - full migration pending)
import { Router } from 'express';

export const dashboardRoutes = Router();
export const dashboardModule = {
  routes: dashboardRoutes,
  mountPath: '/api/v1/dashboard',
};