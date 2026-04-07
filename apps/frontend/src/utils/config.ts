/**
 * Application configuration based on environment
 * Uses environment variables set in .env.local (dev) or .env.production (vercel)
 */

export const appConfig = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5701',
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'Payforms',
  isProduction: process.env.NODE_ENV === 'production',
};

/**
 * Get callback URL for Paystack redirect
 * Must use NEXT_PUBLIC_APP_URL from env, not window.location.origin (which varies by Vercel preview)
 */
export const getCallbackUrl = (path: string = '/payment/success'): string => {
  return `${appConfig.appUrl}${path}`;
};
