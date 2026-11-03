import app from './app.js';
import { env } from './config/env.js';
import { closeDatabaseConnection } from './database/connection.js';

const PORT = env.port;

const server = app.listen(PORT, () => {
  console.log(`AnalyzeDB API running on port ${PORT}`);
});

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down AnalyzeDB...`);

  server.close(async (error) => {
    if (error) {
      console.error('Error closing HTTP server:', error);
      process.exitCode = 1;
    }

    try {
      await closeDatabaseConnection();
      console.log('Database connection pool closed.');
    } catch (dbError) {
      console.error('Error closing database pool:', dbError);
      process.exitCode = 1;
    }

    process.exit();
  });
}

// Handle termination signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));