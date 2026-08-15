import { SetMetadata } from '@nestjs/common';

export const ALLOW_PENDING_PASSWORD_CHANGE_KEY = 'allowPendingPasswordChange';

// Marks a route as reachable even while the caller's mustChangePassword
// flag is set — see MustChangePasswordGuard. Only /auth/change-password,
// /auth/logout, and /auth/me carry this; everything else is blocked until
// the temporary password is replaced.
export const AllowPendingPasswordChange = () => SetMetadata(ALLOW_PENDING_PASSWORD_CHANGE_KEY, true);
