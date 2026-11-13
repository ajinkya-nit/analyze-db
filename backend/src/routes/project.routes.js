import { Router } from 'express';

import { requireAuth } from '../middleware/auth.middleware.js';
import { validateRequest,validateUuidParams } from '../middleware/validate.middleware.js';

import {
  validateCreateProject,
  validateUpdateProject,
} from '../validators/project.validator.js';

import {
  createProject,
  getUserProjects,
  getProjectById,
  updateProject,
  deleteProject,
} from '../controllers/project.controller.js';


const router = Router();

router.use(requireAuth);

router.post(
  '/projects',
  validateRequest(validateCreateProject),
  createProject
);

router.get('/projects', getUserProjects);

router.get('/projects/:id', validateUuidParams('id'),getProjectById);

router.patch(
  '/projects/:id',
  validateUuidParams('id'),
  validateRequest(validateUpdateProject),
  updateProject
);

router.delete('/projects/:id', 
  validateUuidParams('id'),
  deleteProject);

export default router;