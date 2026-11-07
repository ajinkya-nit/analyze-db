import * as projectRepository from '../repositories/project.repository.js';
import ApiError from '../utils/ApiError.js';

export async function createProject(userId, data) {
  if (!userId) {
    throw new ApiError(401, 'Authentication required.');
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new ApiError(400, 'Invalid project data.');
  }

  const { name, description } = data;

  if (typeof name !== 'string' || !name.trim()) {
    throw new ApiError(400, 'Project name is required.');
  }

  if (name.trim().length > 150) {
    throw new ApiError(400, 'Project name cannot exceed 150 characters.');
  }

  if (
    description !== undefined &&
    description !== null &&
    typeof description !== 'string'
  ) {
    throw new ApiError(400, 'Project description must be a string or null.');
  }

  return projectRepository.createProject({
    userId,
    name: name.trim(),
    description: typeof description === 'string'
      ? description.trim() || null
      : null,
  });
}

export async function getUserProjects(userId) {
  if (!userId) {
    throw new ApiError(401, 'Authentication required.');
  }

  return projectRepository.findProjectsByUserId(userId);
}

export async function getProjectById(projectId, userId) {
  if (!projectId || !userId) {
    throw new ApiError(400, 'Project ID and user ID are required.');
  }

  const project = await projectRepository.findProjectById(
    projectId,
    userId
  );

  if (!project) {
    throw new ApiError(404, 'Project not found.');
  }

  return project;
}

export async function updateProject(projectId, userId, updates) {
  if (!projectId || !userId) {
    throw new ApiError(400, 'Project ID and user ID are required.');
  }

  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw new ApiError(400, 'Invalid project update data.');
  }

  const allowedFields = ['name', 'description'];
  const suppliedFields = Object.keys(updates);

  if (
    suppliedFields.length === 0 ||
    suppliedFields.some((field) => !allowedFields.includes(field))
  ) {
    throw new ApiError(400, 'Only name and description can be updated.');
  }

  if (Object.hasOwn(updates, 'name')) {
    if (
      typeof updates.name !== 'string' ||
      !updates.name.trim() ||
      updates.name.trim().length > 150
    ) {
      throw new ApiError(
        400,
        'Project name must be between 1 and 150 characters.'
      );
    }
  }

  if (
    Object.hasOwn(updates, 'description') &&
    updates.description !== null &&
    typeof updates.description !== 'string'
  ) {
    throw new ApiError(400, 'Description must be a string or null.');
  }

  const cleanUpdates = {};

  if (Object.hasOwn(updates, 'name')) {
    cleanUpdates.name = updates.name.trim();
  }

  if (Object.hasOwn(updates, 'description')) {
    cleanUpdates.description = updates.description?.trim() || null;
  }

  const project = await projectRepository.updateProject(
    projectId,
    userId,
    cleanUpdates
  );

  if (!project) {
    throw new ApiError(404, 'Project not found.');
  }

  return project;
}

export async function deleteProject(projectId, userId) {
  if (!projectId || !userId) {
    throw new ApiError(400, 'Project ID and user ID are required.');
  }

  const deleted = await projectRepository.deleteProject(
    projectId,
    userId
  );

  if (!deleted) {
    throw new ApiError(404, 'Project not found.');
  }

  return { deleted: true };
}