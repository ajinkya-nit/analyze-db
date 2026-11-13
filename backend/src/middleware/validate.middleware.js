import ApiError from '../utils/ApiError.js';
import { isValidUuid } from '../utils/validate.js';

export function validateRequest(validator) {
  return (req, res, next) => {
    try {
      const errors = validator(req);

      if (errors.length > 0) {
        return next(
          new ApiError(
            400,
            'Request validation failed',
            errors
          )
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validateUuidParams(...paramNames) {
  return validateRequest((req) => {
    const errors = [];

    for (const paramName of paramNames) {
      if (!isValidUuid(req.params[paramName])) {
        errors.push(`${paramName} must be a valid UUID.`);
      }
    }

    return errors;
  });
}