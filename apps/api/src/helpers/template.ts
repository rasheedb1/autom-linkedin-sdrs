import { capitalizeFromHandle, parseLinkedInIdentifier } from './linkedin.js';

/**
 * Lead data for template rendering
 */
export interface LeadTemplateData {
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  linkedin_url?: string;
}

/**
 * Render a message template with lead data
 *
 * Supported placeholders:
 * - {{nombre}} -> first_name (with fallback to handle-derived name or "there")
 * - {{first_name}} -> first_name
 * - {{last_name}} -> last_name
 * - {{company}} -> company
 * - {{full_name}} -> first_name + last_name
 *
 * @param template Message template with placeholders
 * @param lead Lead data for replacement
 * @returns Rendered message
 */
export function renderTemplate(template: string, lead: LeadTemplateData): string {
  if (!template) return '';

  let result = template;

  // Get first name with fallback logic
  const firstName = getFirstNameWithFallback(lead);

  // Replace {{nombre}} - Spanish placeholder, most common
  result = result.replace(/\{\{nombre\}\}/gi, firstName);

  // Replace {{first_name}}
  result = result.replace(/\{\{first_name\}\}/gi, firstName);

  // Replace {{last_name}}
  const lastName = lead.last_name || '';
  result = result.replace(/\{\{last_name\}\}/gi, lastName);

  // Replace {{company}}
  const company = lead.company || '';
  result = result.replace(/\{\{company\}\}/gi, company);

  // Replace {{full_name}}
  const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || firstName;
  result = result.replace(/\{\{full_name\}\}/gi, fullName);

  return result;
}

/**
 * Get first name with fallback chain:
 * 1. lead.first_name if available
 * 2. Capitalize first part of LinkedIn handle
 * 3. "there" as final fallback
 */
function getFirstNameWithFallback(lead: LeadTemplateData): string {
  // 1. Use first_name if available
  if (lead.first_name && lead.first_name.trim()) {
    return lead.first_name.trim();
  }

  // 2. Try to derive from LinkedIn URL
  if (lead.linkedin_url) {
    const handle = parseLinkedInIdentifier(lead.linkedin_url);
    if (handle) {
      const derivedName = capitalizeFromHandle(handle);
      if (derivedName) {
        return derivedName;
      }
    }
  }

  // 3. Final fallback
  return 'there';
}

/**
 * Validate that a template has valid placeholders
 * Returns array of invalid placeholder names found
 */
export function validateTemplate(template: string): string[] {
  const validPlaceholders = ['nombre', 'first_name', 'last_name', 'company', 'full_name'];
  const foundPlaceholders = template.match(/\{\{(\w+)\}\}/g) || [];

  const invalidPlaceholders: string[] = [];

  for (const match of foundPlaceholders) {
    const name = match.replace(/\{\{|\}\}/g, '').toLowerCase();
    if (!validPlaceholders.includes(name)) {
      invalidPlaceholders.push(name);
    }
  }

  return invalidPlaceholders;
}

/**
 * Extract all placeholder names from a template
 */
export function extractPlaceholders(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g) || [];
  return matches.map(m => m.replace(/\{\{|\}\}/g, '').toLowerCase());
}
