import * as projectService from '../services/project.service.js';

export async function createProject(req, res) {
  const project = await projectService.createProject(
    req.user.id,
    req.body
  );

  return res.status(201).json({
    success: true,
    message: 'Project created successfully.',
    data: project,
  });
}

export async function getUserProjects(req, res) {
  const projects = await projectService.getUserProjects(req.user.id);

  return res.status(200).json({
    success: true,
    message: 'Projects retrieved successfully.',
    data: projects,
  });
}

export async function getProjectById(req, res) {
  const project = await projectService.getProjectById(
    req.params.id,
    req.user.id
  );

  return res.status(200).json({
    success: true,
    message: 'Project retrieved successfully.',
    data: project,
  });
}

export async function updateProject(req, res) {
  const project = await projectService.updateProject(
    req.params.id,
    req.user.id,
    req.body
  );

  return res.status(200).json({
    success: true,
    message: 'Project updated successfully.',
    data: project,
  });
}

export async function deleteProject(req, res) {
  await projectService.deleteProject(req.params.id, req.user.id);

  return res.status(200).json({
    success: true,
    message: 'Project deleted successfully.',
  });
}