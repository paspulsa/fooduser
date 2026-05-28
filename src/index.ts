import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { jwt } from 'hono/jwt';
import { Bindings, Variables } from './types';

// Import Router Khusus User
import { authRouter } from './routes/auth';
import { orderRouter } from './routes/orders';
import { couponRouter } from './routes/coupons';
import { userRouter } from './routes/users';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

const api = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 1. RUTE PUBLIK 
api.route('/auth', authRouter);
api.route('/public/coupons', couponRouter);

// 2. MIDDLEWARE JWT GLOBAL (Area Terproteksi)
api.use('/protected/*', async (c, next) => {
  const middleware = jwt({ secret: c.env.JWT_SECRET, alg: 'HS256' });
  return middleware(c, next);
});

// 3. RUTE KHUSUS USER (Aplikasi Mobile)
api.route('/protected/user/orders', orderRouter);
api.route('/protected/user/profile', userRouter);

app.route('/api/v1', api);

export default app;