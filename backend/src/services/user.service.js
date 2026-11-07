import * as userRepository from '../repositories/user.repository.js';
import ApiError from '../utils/ApiError.js';

export async function createUser({ email, fullName }) {
  if (!email || typeof email !== 'string' || !email.trim()) {
    throw new ApiError(400, 'A valid email is required.');
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    return await userRepository.createUser({
      email: normalizedEmail,
      fullName: fullName?.trim() || null,
    });
  } catch (error) {
    if (error.code === '23505') {
      throw new ApiError(409, 'A user with this email already exists.');
    }

    throw error;
  }
}

export async function getUserById(userId) {
  if (!userId) {
    throw new ApiError(400, 'User ID is required.');
  }

  const user = await userRepository.findUserById(userId);

  if (!user) {
    throw new ApiError(404, 'User not found.');
  }

  return user;
}

export async function getUserByEmail(email) {
  if (!email || typeof email !== 'string' || !email.trim()) {
    throw new ApiError(400, 'A valid email is required.');
  }

  const user = await userRepository.findUserByEmail(
    email.trim().toLowerCase()
  );

  if (!user) {
    throw new ApiError(404, 'User not found.');
  }

  return user;
}

export async function updateUser(userId, updates) {
  if (!userId) {
    throw new ApiError(400, 'User ID is required.');
  }

  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw new ApiError(400, 'Invalid user update data.');
  }

  const allowedFields = ['email', 'fullName'];
  const hasAllowedField = allowedFields.some(
    (field) => Object.hasOwn(updates, field)
  );

  if (!hasAllowedField) {
    throw new ApiError(400, 'No valid user fields were provided.');
  }

  if (Object.hasOwn(updates, 'email')) {
    if (
      typeof updates.email !== 'string' ||
      !updates.email.trim()
    ) {
      throw new ApiError(400, 'A valid email is required.');
    }

    updates.email = updates.email.trim().toLowerCase();
  }

  if (Object.hasOwn(updates, 'fullName')) {
    if (updates.fullName !== null && typeof updates.fullName !== 'string') {
      throw new ApiError(400, 'Full name must be a string.');
    }

    updates.fullName = updates.fullName?.trim() || null;
  }

  try {
    const user = await userRepository.updateUser(userId, updates);

    if (!user) {
      throw new ApiError(404, 'User not found.');
    }

    return user;
  } catch (error) {
    if (error.code === '23505') {
      throw new ApiError(409, 'A user with this email already exists.');
    }

    throw error;
  }
}