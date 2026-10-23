import type { RoleName } from "@parts-inventory-system/database";

export interface AuthenticatedUser {
  id: string;
  tenantId: string | null;
  roles: RoleName[];
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      requestId?: string;
    }
  }
}

export {};
