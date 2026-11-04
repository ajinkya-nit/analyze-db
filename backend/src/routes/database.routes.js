import express from 'express';

import {
  validateRequest,
} from '../middleware/validate.middleware.js';

import {
  validateDatabaseConnection,
} from '../validators/database.validator.js';

import {
  verifyDatabaseConnection,
} from '../services/database-connection.service.js';

const router = express.Router();

// POST /api/database/connections/validate
router.post(
  '/database/connections/validate',
  validateRequest(validateDatabaseConnection),
  async (req, res) => {
    const result = await verifyDatabaseConnection(req.body);

    return res.status(200).json({
      success: true,
      message: 'Database connection verified successfully',
      data: result,
    });
  }
);

export default router;