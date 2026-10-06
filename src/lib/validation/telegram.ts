import { z } from "zod";

export const connectTelegramSchema = z
  .object({
    botToken: z.string().min(1).max(512),
  })
  .strict();

export const telegramUpdateSchema = z
  .object({
    update_id: z.number().int().nonnegative().safe(),
    message: z
      .object({
        message_id: z.number().int().nonnegative(),
        chat: z.object({ id: z.number().int().safe() }).passthrough(),
        from: z
          .object({
            id: z.number().int().nonnegative().safe(),
            is_bot: z.boolean().optional(),
            first_name: z.string().optional(),
            last_name: z.string().optional(),
            username: z.string().optional(),
          })
          .passthrough()
          .optional(),
        text: z.string().max(4_096).optional(),
        date: z.number().int().nonnegative().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();
