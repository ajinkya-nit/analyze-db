
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../config/auth.js';
import ApiError from '../utils/ApiError.js';

export async function requireAuth(req, res, next) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      return next(
        new ApiError(401, 'Authentication required.')
      );
    }

    req.user = session.user;
    req.authSession = session.session;

    next();
  } catch (error) {
    next(error);
  }
}
