
import {
  getIndexIntelligence,
} from '../services/index-intelligence.service.js';

export async function getIndexAnalysis(req, res) {
  const result = await getIndexIntelligence(
    req.params.projectId,
    req.user.id,
    req.params.connectionId
  );

  return res.status(200).json({
    success: true,
    message: 'Index intelligence analysis completed successfully.',
    data: result,
  });
}
