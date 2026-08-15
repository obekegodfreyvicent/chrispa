import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_PENDING_PASSWORD_CHANGE_KEY } from '../decorators/allow-pending-password-change.decorator';

// Global guard (registered in app.module.ts) so it can't be forgotten on a
// new module — blocks every request from a user whose mustChangePassword
// flag is set (a one-time temp password was just issued, see
// EmployeesService.createLoginInternal()) except the small allowlist
// marked with @AllowPendingPasswordChange(). "The first thing they do
// should be a password reset before any operation" — per user decision.
//
// This only *decodes* the JWT's mustChangePassword claim, without verifying
// the signature — that's deliberate, not a shortcut: signature verification
// is JwtAuthGuard's job (via Passport), and it still runs per-controller
// after this one. A tampered/forged token might slip past this guard's
// decode-only read, but JwtAuthGuard will reject it with 401 regardless of
// what this guard decided, since the signature won't match. That means this
// guard needs no JWT secret or database access — it's a pure, cheap,
// stateless pre-check.
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD_CHANGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers?.authorization;
    if (!authHeader?.startsWith('Bearer ')) return true;

    try {
      // JWT segments are base64url (RFC 7515), not plain base64 — decoding
      // as plain base64 would silently mangle any payload whose encoded
      // bytes happen to contain '-' or '_'.
      const segment = authHeader.slice(7).split('.')[1];
      const payload = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
      if (payload.mustChangePassword) {
        throw new ForbiddenException('You must set a new password before continuing. Use POST /auth/change-password.');
      }
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      // Malformed/invalid token — let JwtAuthGuard reject it properly with 401.
    }
    return true;
  }
}
