import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { handleRazorpayWebhook } from './routes/webhook.routes';
import { categoriesRouter } from './routes/categories.routes';
import { productsRouter } from './routes/products.routes';
import { ordersRouter } from './routes/orders.routes';
import { adminAuthRouter } from './routes/admin/auth.routes';
import { adminProductsRouter } from './routes/admin/products.routes';
import { adminCategoriesRouter } from './routes/admin/categories.routes';
import { adminOrdersRouter } from './routes/admin/orders.routes';
import { adminSettingsRouter } from './routes/admin/settings.routes';

export const app = express();

app.use(cors({ origin: process.env.FRONTEND_ORIGIN, credentials: true }));
app.use(cookieParser());

app.post('/api/orders/razorpay-webhook', express.raw({ type: 'application/json' }), handleRazorpayWebhook);

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/categories', categoriesRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/admin', adminAuthRouter);
app.use('/api/admin/products', adminProductsRouter);
app.use('/api/admin/categories', adminCategoriesRouter);
app.use('/api/admin/orders', adminOrdersRouter);
app.use('/api/admin/settings', adminSettingsRouter);

// Terminal error handler: anything forwarded via next(err) (including rejections
// caught by asyncHandler) lands here instead of crashing the process.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
