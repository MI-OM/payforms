import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { isOriginAllowed, parseOriginAllowList, resolveCallbackUrl, resolveParentOrigin } from './embed-security.util';

describe('embed-security.util', () => {
  describe('parseOriginAllowList', () => {
    it('splits and trims comma-delimited values', () => {
      expect(parseOriginAllowList(' https://a.com , *.b.com ,,')).toEqual([
        'https://a.com',
        '*.b.com',
      ]);
    });
  });

  describe('isOriginAllowed', () => {
    it('allows any origin when allowlist is empty', () => {
      expect(isOriginAllowed('https://example.com', [])).toBe(true);
    });

    it('matches exact origins and host-only rules', () => {
      expect(isOriginAllowed('https://payforms.com', ['payforms.com'])).toBe(true);
      expect(isOriginAllowed('https://payforms.com', ['https://payforms.com'])).toBe(true);
      expect(isOriginAllowed('http://payforms.com', ['https://payforms.com'])).toBe(false);
    });

    it('matches wildcard host rules', () => {
      expect(isOriginAllowed('https://embed.payforms.com', ['*.payforms.com'])).toBe(true);
      expect(isOriginAllowed('https://payforms.com', ['*.payforms.com'])).toBe(true);
      expect(isOriginAllowed('https://payforms.com', ['*.other.com'])).toBe(false);
    });

    it('matches protocol-scoped wildcard rules', () => {
      expect(isOriginAllowed('https://embed.payforms.com', ['https://*.payforms.com'])).toBe(true);
      expect(isOriginAllowed('http://embed.payforms.com', ['https://*.payforms.com'])).toBe(false);
    });
  });

  describe('resolveParentOrigin', () => {
    it('returns parsed origin when allowed', () => {
      expect(resolveParentOrigin('https://example.com/page', ['example.com'])).toBe('https://example.com');
    });

    it('throws when missing and allowlist is set', () => {
      expect(() => resolveParentOrigin(undefined, ['example.com'])).toThrow(BadRequestException);
    });

    it('throws when origin is not allowed', () => {
      expect(() => resolveParentOrigin('https://bad.com', ['example.com'])).toThrow(UnauthorizedException);
    });
  });

  describe('resolveCallbackUrl', () => {
    it('uses fallback when callback is empty', () => {
      const resolved = resolveCallbackUrl('', 'https://fallback.com/cb', []);
      expect(resolved).toBe('https://fallback.com/cb');
    });

    it('rejects non-http urls', () => {
      expect(() => resolveCallbackUrl('ftp://example.com', 'https://fallback.com', [])).toThrow(
        BadRequestException,
      );
    });

    it('enforces allowed origins', () => {
      expect(() =>
        resolveCallbackUrl('https://bad.com/path', 'https://fallback.com', ['example.com']),
      ).toThrow(BadRequestException);
    });
  });
});
