import { z } from 'zod';
import { VALIDATION_LIMITS } from './constants';

export const usernameSchema = z
  .string()
  .min(VALIDATION_LIMITS.USERNAME_MIN_LENGTH, 'Username must be at least 1 character')
  .max(VALIDATION_LIMITS.USERNAME_MAX_LENGTH, `Username must be at most ${VALIDATION_LIMITS.USERNAME_MAX_LENGTH} characters`)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens, and underscores')
  .trim();

export const roomIdSchema = z
  .string()
  .min(VALIDATION_LIMITS.ROOM_ID_MIN_LENGTH, 'Room ID must be at least 1 character')
  .max(VALIDATION_LIMITS.ROOM_ID_MAX_LENGTH, `Room ID must be at most ${VALIDATION_LIMITS.ROOM_ID_MAX_LENGTH} characters`)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Room ID can only contain letters, numbers, hyphens, and underscores')
  .trim();

export const messageTextSchema = z
  .string()
  .min(VALIDATION_LIMITS.MESSAGE_MIN_LENGTH, 'Message cannot be empty')
  .max(VALIDATION_LIMITS.MESSAGE_MAX_LENGTH, `Message must be at most ${VALIDATION_LIMITS.MESSAGE_MAX_LENGTH} characters`)
  .trim();

export const messageDataSchema = z.object({
  text: messageTextSchema,
  roomId: roomIdSchema,
});

export const joinEventSchema = z.object({
  username: usernameSchema,
  roomId: roomIdSchema,
});

export const messageCountSchema = z.number().int().positive().max(1000).optional();

export const typingEventSchema = z.boolean();

export type ValidatedMessageData = z.infer<typeof messageDataSchema>;
export type ValidatedJoinEvent = z.infer<typeof joinEventSchema>;
export type ValidatedUsername = z.infer<typeof usernameSchema>;
export type ValidatedRoomId = z.infer<typeof roomIdSchema>;
export type ValidatedMessageText = z.infer<typeof messageTextSchema>;

export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  
  const errorMessages = result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
  return { success: false, error: errorMessages };
}
