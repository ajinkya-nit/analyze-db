import express from 'express';
import { testDatabaseConnection } from '../database/connection.js';

const router = express.Router();

router.get('/health', async (req, res) => {
  try {
    await testDatabaseConnection();

    return res.status(200).json({
      status: 'ok',
      message: 'AnalyzeDB API is running',
      database: {
        status: 'connected',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check failed:', error.message);

    return res.status(503).json({
      status: 'error',
      message: 'AnalyzeDB database connection is unavailable',
      database: {
        status: 'disconnected',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;