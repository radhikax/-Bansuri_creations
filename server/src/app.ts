import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { categoriesRouter } from './routes/categories.routes';

export const app = express();

app.use(cors({ origin: process.env.FRONTEND_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/categories', categoriesRouter);

export default app;
