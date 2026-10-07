import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Restrict a route to the given application roles.
 * Usage: @Roles('administrator')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
