/**
 * UserService — current user (/me) via Edge.
 */
import { fetchMe } from '../lib/platformApi';
import type { ServiceResult } from '../types/platform';

export interface UserService {
  getMe(): Promise<ServiceResult<unknown>>;
}

class UserServiceImpl implements UserService {
  async getMe(): Promise<ServiceResult<unknown>> {
    try {
      const data = await fetchMe();
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const userService: UserService = new UserServiceImpl();
