import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export interface AccessTokenPayload {
  sub: string; // userId
  tenantId: string | null;
  roles: string[];
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  tenantId: string | null;
  type: "refresh";
}

export function signAccessToken(payload: Omit<AccessTokenPayload, "type">): string {
  return jwt.sign({ ...payload, type: "access" }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as SignOptions);
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, "type">): string {
  return jwt.sign({ ...payload, type: "refresh" }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}
