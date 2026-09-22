import { Router } from 'express';
import { usersRoutes } from './routes';

export const usersModule = {
  routes: usersRoutes,
  mountPath: '/api/v1/users',
};