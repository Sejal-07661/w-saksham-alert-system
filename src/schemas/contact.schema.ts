import { z } from "zod";
 
export const addContactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});
 
export type AddContactInput = z.infer<typeof addContactSchema>;