import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Attaches req.user when a valid bearer token is present, and does
 * nothing when it is not. Never rejects.
 *
 * The scan endpoints need exactly this rather than a normal guard: the
 * landing page runs a scan before the visitor has an account, and a
 * WhatsApp deep link opens a report for someone who has never signed
 * in. Those flows must keep working, while a signed-in request still
 * gets its scan attributed to the right user.
 */
@Injectable()
export class OptionalJwtGuard extends AuthGuard("jwt") {
  handleRequest<TUser = AuthedUser>(_err: unknown, user: TUser | false): TUser {
    // Passport hands `false` through when there is no/invalid token.
    // Returning undefined leaves req.user unset instead of throwing.
    return (user || undefined) as TUser;
  }
}

/** Rejects when there is no valid token. For endpoints that are inherently per-user. */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}

/** Shape JwtStrategy.validate() puts on the request. */
export interface AuthedUser {
  userId: string;
  email: string;
}

export function userIdOf(req: { user?: AuthedUser }): string | undefined {
  return req.user?.userId;
}
