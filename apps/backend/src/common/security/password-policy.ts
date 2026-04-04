import { BadRequestException } from '@nestjs/common';

export const PASSWORD_STRENGTH_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{12,}$/;
export const PASSWORD_STRENGTH_MESSAGE =
  'Password must be at least 12 characters long and include uppercase, lowercase, number, and special character.';

export function isPasswordStrong(password: string): boolean {
  return PASSWORD_STRENGTH_REGEX.test(password);
}

export function validatePasswordStrength(password: string) {
  if (!password || !isPasswordStrong(password)) {
    throw new BadRequestException(PASSWORD_STRENGTH_MESSAGE);
  }
}
