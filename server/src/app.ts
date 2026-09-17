import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { handleRazorpayWebhook } from './routes/webhook.routes';
import { categoriesRouter } from './routes/categories.routes';
import { productsRouter } from './routes/products.routes';
import { ordersRouter } from './routes/orders.routes';

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

export default app;
