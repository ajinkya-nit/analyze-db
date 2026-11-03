import ApiError from '../utils/ApiError.js';

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