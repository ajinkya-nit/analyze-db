
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

import { toNodeHandler } from 'better-auth/node';
import { auth } from './config/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import healthRoutes from './routes/health.routes.js';
import { requestLogger } from './middleware/request-logger.middleware.js';
import databaseRoutes from './routes/database.routes.js';
import authRoutes from './routes/auth.routes.js';
import projectRoutes from './routes/project.routes.js';

const app = express();

app.use(requestLogger);
app.use(helmet());

app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  })
);

app.all('/api/auth/*splat', toNodeHandler(auth));

app.use(express.json({ limit: '1mb' }));

app.use('/api', healthRoutes);
app.use('/api', databaseRoutes);
app.use('/api', authRoutes);
app.use('/api', projectRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
