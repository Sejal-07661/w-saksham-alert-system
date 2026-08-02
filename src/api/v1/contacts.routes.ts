import { Router, Response } from "express";
import { addContactSchema } from "../../schemas/contact.schema";
import { UserModel } from "../../models/user.model";
import { requireAuth, AuthenticatedRequest } from "../../core/authMiddleware";
 
const router = Router();
 
router.use(requireAuth);
 
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  const user = await UserModel.findById(req.user!.userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json({ contacts: user.trustedContacts });
});
 
router.post("/", async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = addContactSchema.safeParse(req.body);
 
  if (!parseResult.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: parseResult.error.flatten(),
    });
  }
 
  const user = await UserModel.findById(req.user!.userId);
  if (!user) return res.status(404).json({ error: "User not found" });
 
  if (user.trustedContacts.length >= 5) {
    return res.status(400).json({ error: "Maximum of 5 trusted contacts allowed" });
  }
 
  const alreadyExists = user.trustedContacts.some(
    (c) => c.email.toLowerCase() === parseResult.data.email.toLowerCase()
  );
  if (alreadyExists) {
    return res.status(409).json({ error: "Contact already exists" });
  }
 
  user.trustedContacts.push(parseResult.data);
  await user.save();
 
  return res.status(201).json({ contacts: user.trustedContacts });
});
 
router.delete("/:email", async (req: AuthenticatedRequest, res: Response) => {
  const user = await UserModel.findById(req.user!.userId);
  if (!user) return res.status(404).json({ error: "User not found" });
 
  user.trustedContacts = user.trustedContacts.filter(
    (c) => c.email.toLowerCase() !== String(req.params.email).toLowerCase()
  );
  await user.save();
 
  return res.json({ contacts: user.trustedContacts });
});
 
export default router;