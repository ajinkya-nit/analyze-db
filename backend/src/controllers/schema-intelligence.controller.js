
import {
  getSchemaRelationships,
  getSchemaSummary,
  getSchemaObject,
} from '../services/schema-intelligence.service.js';

export async function getRelationships(req, res) {
  const result = await getSchemaRelationships(
    req.params.projectId,
    req.user.id,
    req.params.connectionId
  );

  return res.status(200).json({
    success: true,
    message: 'Schema relationships retrieved successfully.',
    data: result,
  });
}

export async function getSummary(req, res) {
  const result = await getSchemaSummary(
    req.params.projectId,
    req.user.id,
    req.params.connectionId
  );

  return res.status(200).json({
    success: true,
    message: 'Schema summary generated successfully.',
    data: result,
  });
}

export async function getObject(req, res) {
  const { schemaName, objectName } = req.query;

  if (
    typeof schemaName !== 'string' ||
    typeof objectName !== 'string' ||
    !schemaName.trim() ||
    !objectName.trim()
  ) {
    return res.status(400).json({
      success: false,
      message: 'schemaName and objectName query parameters are required.',
      errors: [],
    });
  }

  const result = await getSchemaObject(
    req.params.projectId,
    req.user.id,
    req.params.connectionId,
    schemaName,
    objectName
  );

  return res.status(200).json({
    success: true,
    message: 'Schema object retrieved successfully.',
    data: result,
  });
}
