import {
  analyzeQueryPerformance,
} from '../services/query-performance.service.js';

export async function analyzeQuery(req, res) {
  const result = await analyzeQueryPerformance(
    req.params.projectId,
    req.user.id,
    req.params.connectionId,
    req.body.sql
  );

  return res.status(200).json({
    success: true,
    message: 'Query performance analysis completed successfully.',
    data: result,
  });
}