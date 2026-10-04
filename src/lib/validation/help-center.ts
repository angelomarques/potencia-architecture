import { z } from "zod";

export const helpCenterInputSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(254, "Email must be at most 254 characters")
    .email("Enter a valid email address"),
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters")
    .max(2000, "Message must be at most 2000 characters"),
});

export type HelpCenterInput = z.infer<typeof helpCenterInputSchema>;

export const helpCenterSchema = helpCenterInputSchema;
