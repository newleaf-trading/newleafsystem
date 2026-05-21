import type { FastifyRequest, FastifyReply } from 'fastify';
import type { UserRole } from './auth.js';

const TIER_LEVEL: Record<UserRole, number> = {
  free: 0,
  basic: 1,
  premium: 2,
  admin: 3,
};

export function requireTier(minimumTier: UserRole) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userLevel = TIER_LEVEL[request.userRole] ?? 0;
    const requiredLevel = TIER_LEVEL[minimumTier];
    if (userLevel < requiredLevel) {
      return reply.code(403).send({
        error: 'Insufficient access tier',
        required: minimumTier,
        current: request.userRole,
      });
    }
  };
}
