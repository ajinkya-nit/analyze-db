export function validateCreateProject(req) {
  const errors = [];
  const { name, description } = req.body ?? {};

  if (typeof name !== 'string' || !name.trim()) {
    errors.push('Project name is required.');
  } else if (name.trim().length > 150) {
    errors.push('Project name cannot exceed 150 characters.');
  }

  if (
    description !== undefined &&
    description !== null &&
    typeof description !== 'string'
  ) {
    errors.push('Project description must be a string or null.');
  }

  return errors;
}

export function validateUpdateProject(req) {
  const errors = [];
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return ['Request body must be a JSON object.'];
  }

  const fields = Object.keys(body);
  const allowedFields = ['name', 'description'];

  if (
    fields.length === 0 ||
    fields.some((field) => !allowedFields.includes(field))
  ) {
    errors.push('Only name and description can be updated.');
    return errors;
  }

  if (Object.hasOwn(body, 'name')) {
    if (
      typeof body.name !== 'string' ||
      !body.name.trim() ||
      body.name.trim().length > 150
    ) {
      errors.push('Project name must be between 1 and 150 characters.');
    }
  }

  if (
    Object.hasOwn(body, 'description') &&
    body.description !== null &&
    typeof body.description !== 'string'
  ) {
    errors.push('Description must be a string or null.');
  }

  return errors;
}