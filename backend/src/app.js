import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

import healthRoutes from './routes/health.routes.js';

const app = express();

app.use(helmet());  // Security-related HTTP headers
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api', healthRoutes);


export default app;