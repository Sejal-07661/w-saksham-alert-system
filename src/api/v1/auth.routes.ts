import { Router, Request, Response } from "express";
import { registerSchema, loginSchema } from "../../schemas/auth.schema";
import { UserModel } from "../../models/user.model";
import { hashPassword, comparePassword, signToken } from "../../services/auth.service";

const router = Router();

router.post("/register", async (req: Request, res: Response) => {
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

router.post("/login", async (req: Request, res: Response) => {
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