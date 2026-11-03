import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import healthRoutes from './routes/health.routes.js';
import { requestLogger } from './middleware/request-logger.middleware.js';

const app = express();

app.use(requestLogger);  // Log incoming requests
app.use(helmet());  // Security-related HTTP headers
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api', healthRoutes);
app.use(notFoundHandler);
app.use(errorHandler);


export default app;