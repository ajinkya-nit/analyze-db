import * as projectRepository from '../repositories/project.repository.js';
import * as userRepository from '../repositories/user.repository.js';
import ApiError from '../utils/ApiError.js';

export async function createProject(userId, { name, description }) {
  if (!userId) {
    throw new ApiError(400, 'User ID is required.');
  }

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
    throw new ApiError(400, 'Project description must be a string.');
  }

  const user = await userRepository.findUserById(userId);

  if (!user) {
    throw new ApiError(404, 'User not found.');
  }

  return projectRepository.createProject({
    userId,
    name: name.trim(),
    description: description?.trim() || null,
  });
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

export async function getUserProjects(userId) {
  if (!userId) {
    throw new ApiError(400, 'User ID is required.');
  }

  const user = await userRepository.findUserById(userId);

  if (!user) {
    throw new ApiError(404, 'User not found.');
  }

  return projectRepository.findProjectsByUserId(userId);
}

export async function updateProject(projectId, userId, updates) {
  if (!projectId || !userId) {
    throw new ApiError(400, 'Project ID and user ID are required.');
  }

  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw new ApiError(400, 'Invalid project update data.');
  }

  const allowedFields = ['name', 'description'];

  const hasAllowedField = allowedFields.some(
    (field) => Object.hasOwn(updates, field)
  );

  if (!hasAllowedField) {
    throw new ApiError(400, 'No valid project fields were provided.');
  }

  if (Object.hasOwn(updates, 'name')) {
    if (
      typeof updates.name !== 'string' ||
      !updates.name.trim() ||
      updates.name.trim().length > 150
    ) {
      throw new ApiError(400, 'Project name must be between 1 and 150 characters.');
    }
  }

  if (Object.hasOwn(updates, 'description')) {
    if (
      updates.description !== null &&
      typeof updates.description !== 'string'
    ) {
      throw new ApiError(400, 'Project description must be a string or null.');
    }
  }

  const project = await projectRepository.updateProject(
    projectId,
    userId,
    {
      name: updates.name?.trim(),
      description: updates.description?.trim() ?? updates.description,
    }
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