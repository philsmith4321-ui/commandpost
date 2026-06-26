// Clickable LinkedIn / Facebook links for a named contact on a lead.
//
// If the lead's freeform `socials` field already contains a profile URL for the
// platform, we link straight to it ("direct"). Otherwise we build a pre-filled
// people-search URL so the operator can eyeball the results and click the real
// profile. Nothing here calls out to any API; it's all URL construction.

export interface SocialLink {
  href: string;
  direct: boolean; // true = a stored profile URL; false = a name search
}

export interface ContactSocialLinks {
  linkedin: SocialLink;
  facebook: SocialLink;
}

// Pull the first profile URL for `hostPattern` (a regex alternation of hostnames)
// out of a freeform socials string. Tolerates a missing protocol and trailing
// punctuation. Returns null when there's no explicit URL for that host.
function storedProfileUrl(socials: string | null | undefined, hostPattern: string): string | null {
  if (!socials) return null;
  const re = new RegExp(`(https?:\\/\\/)?[^\\s,;|]*(?:${hostPattern})\\/[^\\s,;|]+`, 'i');
  const m = socials.match(re);
  if (!m) return null;
  const raw = m[0].replace(/[.,;]+$/, ''); // drop trailing sentence punctuation
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

export function contactSocialLinks(
  name: string,
  company: string | null | undefined,
  socials: string | null | undefined
): ContactSocialLinks {
  const liStored = storedProfileUrl(socials, 'linkedin\\.com');
  const fbStored = storedProfileUrl(socials, 'facebook\\.com|fb\\.com');

  // Company helps disambiguate a common name on LinkedIn; Facebook search is name-only.
  const liQuery = encodeURIComponent([name, company].filter(Boolean).join(' '));
  const fbQuery = encodeURIComponent(name);

  return {
    linkedin: liStored
      ? { href: liStored, direct: true }
      : { href: `https://www.linkedin.com/search/results/people/?keywords=${liQuery}`, direct: false },
    facebook: fbStored
      ? { href: fbStored, direct: true }
      : { href: `https://www.facebook.com/search/people/?q=${fbQuery}`, direct: false },
  };
}
