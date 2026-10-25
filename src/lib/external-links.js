const allowedOrigins = (origin) => {
  const canonical = new URL(origin);
  const origins = new Set([canonical.origin]);
  if (canonical.hostname.toLowerCase() === 'daybytes.com') {
    origins.add(`${canonical.protocol}//www.daybytes.com`);
    origins.add('http://daybytes.com');
    origins.add('http://www.daybytes.com');
  }
  return origins;
};

export const isExternalHref = (href, origin) => {
  if (typeof href !== 'string' || !/^https?:\/\//i.test(href)) return false;

  try {
    return !allowedOrigins(origin).has(new URL(href).origin);
  } catch {
    return false;
  }
};

export const externalLinkAttributes = (href, origin, additionalRel = '') =>
  isExternalHref(href, origin)
    ? { target: '_blank', rel: [...new Set(['noopener', 'noreferrer', ...additionalRel.split(/\s+/).filter(Boolean)])].join(' ') }
    : {};