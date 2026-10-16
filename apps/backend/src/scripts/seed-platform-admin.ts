import { config } from 'dotenv';
import * as bcrypt from 'bcrypt';

config({ path: '.env' });

import AppDataSource from '../data-source';
import { PlatformUser } from '../modules/platform-auth/entities/platform-user.entity';

const PASSWORD_STRENGTH_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{12,}$/;

/**
 * Creates (or resets) a platform admin account.
 *
 * Usage:
 *   npm run seed:platform-admin -- admin@payforms.com.ng 'StrongPass123!'
 * or set PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_PASSWORD in the environment.
 *
 * Idempotent: running it again for an existing email resets the password and
 * re-activates the account.
 */
async function main() {
  const email = String(process.argv[2] || process.env.PLATFORM_ADMIN_EMAIL || '')
    .trim()
    .toLowerCase();
  const password = String(process.argv[3] || process.env.PLATFORM_ADMIN_PASSWORD || '');
  const firstName = String(process.env.PLATFORM_ADMIN_FIRST_NAME || 'Platform').trim();
  const lastName = String(process.env.PLATFORM_ADMIN_LAST_NAME || 'Admin').trim();

  if (!email || !password) {
    throw new Error(
      'Provide the admin email and password as arguments, or set PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_PASSWORD.',
    );
  }

  if (!PASSWORD_STRENGTH_REGEX.test(password)) {
    throw new Error(
      'Password must be at least 12 characters long and include uppercase, lowercase, number, and special character.',
    );
  }

  await AppDataSource.initialize();
  const repository = AppDataSource.getRepository(PlatformUser);
  const password_hash = await bcrypt.hash(password, 10);

  const existing = await repository.findOne({ where: { email } });

  if (existing) {
    await repository.update(existing.id, { password_hash, is_active: true });
    console.log(`Updated existing platform admin: ${email}`);
  } else {
    const created = repository.create({
      email,
      password_hash,
      role: 'SUPER',
      first_name: firstName,
      last_name: lastName,
      is_active: true,
    });
    await repository.save(created);
    console.log(`Created platform admin: ${email}`);
  }

  await AppDataSource.destroy();
}

main().catch(async (error: any) => {
  console.error('Failed to seed platform admin:', error?.message || error);
  try {
    await AppDataSource.destroy();
  } catch {
    // ignore
  }
  process.exit(1);
});
