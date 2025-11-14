import { z } from 'zod';

/**
 * Validation schemas for chat application
 * Provides runtime validation for all data types
 */

// Constants for validation
export const VALIDATION_LIMITS = {
  USERNAME_MIN_LENGTH: 1,
  USERNAME_MAX_LENGTH: 50,
  MESSAGE_MIN_LENGTH: 1,
  MESSAGE_MAX_LENGTH: 5000,
  ROOM_ID_MIN_LENGTH: 1,
  ROOM_ID_MAX_LENGTH: 100,
} as const;

// Username validation
export const usernameSchema = z
  .string()
  .min(VALIDATION_LIMITS.USERNAME_MIN_LENGTH, 'Username must be at least 1 character')
  .max(VALIDATION_LIMITS.USERNAME_MAX_LENGTH, `Username must be at most ${VALIDATION_LIMITS.USERNAME_MAX_LENGTH} characters`)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens, and underscores')
  .trim();

// Room ID validation
export const roomIdSchema = z
  .string()
  .min(VALIDATION_LIMITS.ROOM_ID_MIN_LENGTH, 'Room ID must be at least 1 character')
  .max(VALIDATION_LIMITS.ROOM_ID_MAX_LENGTH, `Room ID must be at most ${VALIDATION_LIMITS.ROOM_ID_MAX_LENGTH} characters`)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Room ID can only contain letters, numbers, hyphens, and underscores')
  .trim();

// Message text validation
export const messageTextSchema = z
  .string()
  .min(VALIDATION_LIMITS.MESSAGE_MIN_LENGTH, 'Message cannot be empty')
  .max(VALIDATION_LIMITS.MESSAGE_MAX_LENGTH, `Message must be at most ${VALIDATION_LIMITS.MESSAGE_MAX_LENGTH} characters`)
  .trim();

// Message data validation (what clients send)
export const messageDataSchema = z.object({
  text: messageTextSchema,
  roomId: roomIdSchema,
});

// Join event validation
export const joinEventSchema = z.object({
  username: usernameSchema,
  roomId: roomIdSchema,
});

// Message count validation
export const messageCountSchema = z.number().int().positive().max(1000).optional();

// Typing event validation
export const typingEventSchema = z.boolean();

// Export type inference helpers
export type ValidatedMessageData = z.infer<typeof messageDataSchema>;
export type ValidatedJoinEvent = z.infer<typeof joinEventSchema>;
export type ValidatedUsername = z.infer<typeof usernameSchema>;
export type ValidatedRoomId = z.infer<typeof roomIdSchema>;
export type ValidatedMessageText = z.infer<typeof messageTextSchema>;

/**
 * Safe validation wrapper that returns error details
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Format Zod errors into readable string
  const errorMessages = result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
  return { success: false, error: errorMessages };
}
