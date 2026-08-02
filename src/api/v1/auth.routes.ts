import { Router, Request, Response } from "express";
import { registerSchema, loginSchema } from "../../schemas/auth.schema";
import { UserModel } from "../../models/user.model";
import { hashPassword, comparePassword, signToken } from "../../services/auth.service";
import { rateLimit, usernameOrIpKeyFn, ipKeyFn } from "../../core/rateLimiter";
 
const router = Router();
 
// Login: 5 attempts per 15 minutes, keyed by username+IP combo — stops
// credential-stuffing against one account while not punishing everyone
// sharing an IP (e.g. college wifi, office NAT) for a single user's mistakes.
const loginLimiter = rateLimit({
  windowSeconds: 15 * 60,
  maxRequests: 5,
  keyPrefix: "login",
  keyFn: usernameOrIpKeyFn,
});
 
// Register: 10 per hour per IP — generous for real users, but stops
// automated mass account creation from a single source.
const registerLimiter = rateLimit({
  windowSeconds: 60 * 60,
  maxRequests: 10,
  keyPrefix: "register",
  keyFn: ipKeyFn,
});
 
router.post("/register", registerLimiter, async (req: Request, res: Response) => {
  const parseResult = registerSchema.safeParse(req.body);
 
  if (!parseResult.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: parseResult.error.flatten(),
    });
  }
 
  const { username, password } = parseResult.data;
 
  const existingUser = await UserModel.findOne({ username });
  if (existingUser) {
    return res.status(409).json({ error: "Username already taken" });
  }
 
  const passwordHash = await hashPassword(password);
  const user = await UserModel.create({ username, passwordHash });
 
  const token = signToken({
    userId: String(user._id),
    username: user.username,
    role: user.role,
  });
 
  return res.status(201).json({ token });
});
 
router.post("/login", loginLimiter, async (req: Request, res: Response) => {
  const parseResult = loginSchema.safeParse(req.body);
 
  if (!parseResult.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: parseResult.error.flatten(),
    });
  }
 
  const { username, password } = parseResult.data;
 
  const user = await UserModel.findOne({ username });
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
 
  const isValid = await comparePassword(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
 
  const token = signToken({
    userId: String(user._id),
    username: user.username,
    role: user.role,
  });
 
  return res.json({ token });
});
 
export default router;