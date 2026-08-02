import { Request, Response, NextFunction } from "express";
import { redisClient } from "../services/redis.service";
 
interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
  keyPrefix: string;
  // How to derive the rate-limit key for a given request — e.g. by IP
  // (for unauthenticated routes like login) or by user id (for authenticated
  // routes, since one IP behind NAT could otherwise throttle many users).
  keyFn: (req: Request) => string;
}
 
/**
 * Fixed-window counter backed by Redis (INCR + EXPIRE). Deliberately NOT
 * in-memory — with 3 stateless app instances behind Nginx, an in-memory
 * counter would track each instance separately, silently tripling the
 * effective limit an attacker gets. Redis makes the counter global across
 * every instance, which is the only correct approach once you're horizontally
 * scaled.
 */
export function rateLimit(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const identifier = options.keyFn(req);
      const key = `ratelimit:${options.keyPrefix}:${identifier}`;
 
      const current = await redisClient.incr(key);
 
      if (current === 1) {
        await redisClient.expire(key, options.windowSeconds);
      }
 
      if (current > options.maxRequests) {
        const ttl = await redisClient.ttl(key);
        res.setHeader("Retry-After", ttl > 0 ? ttl : options.windowSeconds);
        return res.status(429).json({
          error: "Too many requests. Please try again later.",
          retryAfterSeconds: ttl > 0 ? ttl : options.windowSeconds,
        });
      }
 
      next();
    } catch (err) {
      // If Redis is unreachable, fail open rather than blocking all traffic —
      // availability of the core app matters more than rate limiting during
      // a Redis outage, which is already logged/alerting elsewhere.
      console.error("Rate limiter error (failing open):", err);
      next();
    }
  };
}
 
export function ipKeyFn(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}
 
export function usernameOrIpKeyFn(req: Request): string {
  const username = req.body?.username;
  return username ? `user:${username}` : `ip:${ipKeyFn(req)}`;
}
 
// For routes that run AFTER requireAuth middleware, so req.user is populated.
export function authenticatedUserKeyFn(req: Request): string {
  const user = (req as any).user;
  return user?.username ? `user:${user.username}` : `ip:${ipKeyFn(req)}`;
}