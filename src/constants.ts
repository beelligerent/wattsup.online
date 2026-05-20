'use client';
/**
 * Cutoff date for email verification requirement.
 * Users created before this date do not need email verification.
 * Users created after this date MUST verify their email.
 * 
 * Cutoff: 2026-03-08T04:04:16-07:00
 */
export const EMAIL_VERIFICATION_CUTOFF = new Date('2026-03-08T11:04:16Z');
