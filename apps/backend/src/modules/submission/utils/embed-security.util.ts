import { BadRequestException, UnauthorizedException } from '@nestjs/common';

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

export function parseOriginAllowList(raw: string | null | undefined): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
}

export function isOriginAllowed(origin: string, allowList: string[]): boolean {
  if (!allowList.length) {
    return true;
  }

  const candidate = parseHttpUrl(origin);
  if (!candidate) {
    return false;
  }

  return allowList.some(rule => originMatchesRule(candidate, rule));
}

export function resolveParentOrigin(
  parentOrigin: string | undefined,
  allowList: string[],
): string {
  if (!parentOrigin?.trim()) {
    if (allowList.length) {
      throw new BadRequestException('parent_origin query parameter is required');
    }
    return '';
  }

  const parsed = parseHttpUrl(parentOrigin.trim());
  if (!parsed) {
    throw new BadRequestException('parent_origin must be a valid http(s) URL');
  }

  if (allowList.length && !isOriginAllowed(parsed.origin, allowList)) {
    throw new UnauthorizedException('Embedding origin is not allowed');
  }

  return parsed.origin;
}

export function resolveCallbackUrl(
  callbackUrl: string | undefined,
  fallbackUrl: string,
  allowList: string[],
): string {
  const raw = callbackUrl?.trim() || fallbackUrl;
  const parsed = parseHttpUrl(raw);
  if (!parsed) {
    throw new BadRequestException('callback_url must be a valid absolute http(s) URL');
  }

  if (allowList.length && !isOriginAllowed(parsed.origin, allowList)) {
    throw new BadRequestException('callback_url origin is not allowed');
  }

  return parsed.toString();
}

function originMatchesRule(candidate: URL, rawRule: string): boolean {
  const rule = rawRule.trim().toLowerCase();
  if (!rule) {
    return false;
  }
  if (rule === '*') {
    return true;
  }

  const candidateHost = normalizeHost(candidate.hostname);
  const candidateOrigin = candidate.origin.toLowerCase();

  if (rule.startsWith('http://*.') || rule.startsWith('https://*.')) {
    const [protocol, hostPart] = rule.split('://');
    const suffix = normalizeHost(hostPart.replace(/^\*\./, ''));
    return (
      candidate.protocol === `${protocol}:` &&
      (candidateHost === suffix || candidateHost.endsWith(`.${suffix}`))
    );
  }

  if (rule.startsWith('*.')) {
    const suffix = normalizeHost(rule.replace(/^\*\./, ''));
    return candidateHost === suffix || candidateHost.endsWith(`.${suffix}`);
  }

  if (rule.startsWith('http://') || rule.startsWith('https://')) {
    const parsedRule = parseHttpUrl(rule);
    return !!parsedRule && parsedRule.origin.toLowerCase() === candidateOrigin;
  }

  // Host-only rule, e.g. "example.com"
  const hostRule = normalizeHost(rule);
  return candidateHost === hostRule;
}

function parseHttpUrl(value: string): URL | null {
  try {
    const parsed = new URL(value);
    if (!HTTP_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, '');
}
