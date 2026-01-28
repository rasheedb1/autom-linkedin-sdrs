/**
 * LinkedIn URL parsing utilities
 */

/**
 * Extract LinkedIn public identifier (handle) from a profile URL
 *
 * Supports formats:
 * - https://linkedin.com/in/john-doe/
 * - https://www.linkedin.com/in/john-doe
 * - https://linkedin.com/in/john-doe?param=value
 * - linkedin.com/in/john-doe
 *
 * @param url LinkedIn profile URL
 * @returns The public identifier (handle) or null if invalid
 */
export function parseLinkedInIdentifier(url: string): string | null {
  if (!url) return null;

  try {
    // Normalize URL - add protocol if missing
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    const urlObj = new URL(normalizedUrl);

    // Check if it's a LinkedIn domain
    const hostname = urlObj.hostname.toLowerCase();
    if (!hostname.includes('linkedin.com')) {
      return null;
    }

    // Extract path and find /in/ segment
    const pathname = urlObj.pathname;
    const inMatch = pathname.match(/\/in\/([^/?#]+)/);

    if (inMatch && inMatch[1]) {
      // Remove trailing slash if present and return handle
      return inMatch[1].replace(/\/$/, '');
    }

    return null;
  } catch {
    // Invalid URL format
    return null;
  }
}

/**
 * Validate if a string is a valid LinkedIn profile URL
 */
export function isValidLinkedInUrl(url: string): boolean {
  return parseLinkedInIdentifier(url) !== null;
}

/**
 * Build a LinkedIn profile URL from a handle
 */
export function buildLinkedInUrl(handle: string): string {
  return `https://www.linkedin.com/in/${handle}/`;
}

/**
 * Extract company identifier from LinkedIn company URL
 *
 * Supports:
 * - https://linkedin.com/company/acme-corp/
 */
export function parseLinkedInCompanyIdentifier(url: string): string | null {
  if (!url) return null;

  try {
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    const urlObj = new URL(normalizedUrl);

    if (!urlObj.hostname.toLowerCase().includes('linkedin.com')) {
      return null;
    }

    const companyMatch = urlObj.pathname.match(/\/company\/([^/?#]+)/);

    if (companyMatch && companyMatch[1]) {
      return companyMatch[1].replace(/\/$/, '');
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Capitalize first letter of each word in a hyphenated string
 * Used as fallback for names from handles
 *
 * @example "john-doe" -> "John"
 * @example "rasheed-bayter-ii" -> "Rasheed"
 */
export function capitalizeFromHandle(handle: string): string {
  if (!handle) return '';

  // Split by hyphen and take first part (first name)
  const parts = handle.split('-');
  const firstName = parts[0];

  if (!firstName) return '';

  // Capitalize first letter
  return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
}
