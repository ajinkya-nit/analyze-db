
import {
  discoverAndSaveSchema,
  getSavedSchemaMetadata,
} from '../services/schema-discovery.service.js';

export async function discoverSchema(req, res) {
  const result = await discoverAndSaveSchema(
    req.params.projectId,
    req.user.id,
    req.params.connectionId
  );

  return res.status(200).json({
    success: true,
    message: 'Database schema discovered and saved successfully.',
    data: result,
  });
}

export async function getSchema(req, res) {
  const metadata = await getSavedSchemaMetadata(
    req.params.projectId,
    req.user.id,
    req.params.connectionId
  );

  return res.status(200).json({
    success: true,
    message: 'Schema metadata retrieved successfully.',
    data: metadata,
  });
}
