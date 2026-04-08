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
 * Prefer the active tenant host for payment callbacks so users stay on the
 * same subdomain/custom domain after Paystack returns.
 */
export const getCallbackUrl = (path: string = '/payment/success'): string => {
  if (typeof window !== 'undefined') {
    const runtimeOrigin = window.location.origin;
    const configuredHost = new URL(appConfig.appUrl).hostname.toLowerCase();
    const runtimeHost = window.location.hostname.toLowerCase();

    if (runtimeHost === configuredHost || runtimeHost.endsWith(`.${configuredHost}`)) {
      return `${runtimeOrigin}${path}`;
    }
  }

  return `${appConfig.appUrl}${path}`;
};
