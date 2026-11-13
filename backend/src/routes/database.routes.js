import express from 'express';

import { requireAuth } from '../middleware/auth.middleware.js';

import {
  validateRequest,
  validateUuidParams,
} from '../middleware/validate.middleware.js';

import {
  validateDatabaseConnection,
  validateCreateDatabaseConnection,
} from '../validators/database.validator.js';

import {
  verifyDatabaseConnection,
} from '../services/database-connection.service.js';

import {
  createConnection,
  getConnections,
  getConnection,
  deleteConnection,
  testSavedConnection,
} from '../controllers/database-connection.controller.js';

const router = express.Router();

// All database connection routes require authentication.
router.use(requireAuth);

// Test connection details before saving.
router.post(
  '/database/connections/validate',
  validateRequest(validateDatabaseConnection),
  async (req, res) => {
    const result = await verifyDatabaseConnection(req.body);

    return res.status(200).json({
      success: true,
      message: 'Database connection verified successfully.',
      data: result,
    });
  }
);

// Create a connection under a project.
router.post(
  '/projects/:projectId/connections',
  validateUuidParams('projectId'),
  validateRequest(validateCreateDatabaseConnection),
  createConnection
);

// List all connections belonging to a project.
router.get(
  '/projects/:projectId/connections',
  validateUuidParams('projectId'),
  getConnections
);

// Get one connection belonging to a project.
router.get(
  '/projects/:projectId/connections/:connectionId',
  validateUuidParams('projectId', 'connectionId'),
  getConnection
);

// Delete a connection belonging to a project.
router.delete(
  '/projects/:projectId/connections/:connectionId',
  validateUuidParams('projectId', 'connectionId'),
  deleteConnection
);

router.post(
  '/projects/:projectId/connections/:connectionId/test',
  validateUuidParams('projectId', 'connectionId'),
  testSavedConnection
);

export default router;