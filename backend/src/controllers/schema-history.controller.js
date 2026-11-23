import { isValidUuid } from "../utils/validate.js";

import {
  getSchemaSnapshotHistory,
  getSchemaChangeReport,
} from "../services/schema-history.service.js";

export async function getSnapshots(req, res) {
  const result = await getSchemaSnapshotHistory(
    req.params.projectId,
    req.user.id,
    req.params.connectionId,
  );

  return res.status(200).json({
    success: true,
    message: "Schema snapshot history retrieved successfully.",
    data: result,
  });
}


export async function getChanges(req, res) {
  const { fromSnapshotId, toSnapshotId } = req.query;

  if (
    (fromSnapshotId && !isValidUuid(fromSnapshotId)) ||
    (toSnapshotId && !isValidUuid(toSnapshotId))
  ) {
    return res.status(400).json({
      success: false,
      message: 'Snapshot IDs must be valid UUIDs.',
      errors: [],
    });
  }

  const result = await getSchemaChangeReport(
    req.params.projectId,
    req.user.id,
    req.params.connectionId,
    fromSnapshotId,
    toSnapshotId
  );

  return res.status(200).json({
    success: true,
    message: 'Schema changes detected successfully.',
    data: result,
  });
}
