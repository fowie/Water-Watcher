/**
 * Input sanitization utilities for user-provided text.
 * Prevents XSS and enforces safe content in reviews, trip notes,
 * filter names, photo captions, and export filenames.
 */

/**
 * Strip dangerous HTML from user-provided text to prevent XSS.
 *
 * Removes:
 * - <script> tags and their content
 * - <iframe> tags and their content
 * - <object>, <embed>, <applet> tags and their content
 * - Event handler attributes (onclick, onerror, onload, etc.)
 * - javascript: URLs
 * - data: URLs in href/src (except standalone data: for images)
 * - All remaining HTML tags (preserves text content)
 */
export function sanitizeHtml(input: string): string {
  if (!input) return input;

  let sanitized = input;

  // Remove <script> tags and content (case-insensitive, dotAll for multiline)
  sanitized = sanitized.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");

  // Remove <iframe> tags and content
  sanitized = sanitized.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "");

  // Remove <object>, <embed>, <applet> tags and content
  sanitized = sanitized.replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, "");
  sanitized = sanitized.replace(/<embed\b[^>]*>\s*(?:<\/embed>)?/gi, "");
  sanitized = sanitized.replace(/<applet\b[^>]*>[\s\S]*?<\/applet>/gi, "");

  // Remove event handler attributes (on*)
  sanitized = sanitized.replace(
    /\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
    ""
  );

  // Remove javascript: URLs
  sanitized = sanitized.replace(/javascript\s*:/gi, "");

  // Remove data: URLs in href/src attributes (not standalone data: for images)
  sanitized = sanitized.replace(
    /(href|src)\s*=\s*(?:"data:[^"]*"|'data:[^']*')/gi,
    ""
  );

  // Remove all remaining HTML tags (preserves text content)
  sanitized = sanitized.replace(/<[^>]*>/g, "");

  // Decode common HTML entities back to readable text
  sanitized = sanitized
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");

  // Re-escape angle brackets to prevent any remaining injection
  sanitized = sanitized.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return sanitized.trim();
}

/**
 * Sanitize a filename for safe use in file downloads.
 *
 * - Replaces path separators and null bytes
 * - Removes characters unsafe for most filesystems
 * - Prevents directory traversal (../)
 * - Limits length to 255 characters
 * - Falls back to "download" if result is empty
 */
export function sanitizeFilename(input: string): string {
  if (!input) return "download";

  let safe = input;

  // Remove null bytes
  safe = safe.replace(/\0/g, "");

  // Remove path separators
  safe = safe.replace(/[/\\]/g, "_");

  // Remove directory traversal
  safe = safe.replace(/\.\.\/?/g, "");

  // Remove characters unsafe for most filesystems
  // Keep: alphanumeric, dash, underscore, dot, space
  safe = safe.replace(/[^a-zA-Z0-9\-_. ]/g, "");

  // Collapse multiple spaces/underscores/dashes
  safe = safe.replace(/[\s_-]+/g, "_");

  // Remove leading/trailing dots and spaces (problematic on Windows)
  safe = safe.replace(/^[.\s]+|[.\s]+$/g, "");

  // Limit length (most filesystems max 255 bytes)
  safe = safe.substring(0, 255);

  return safe || "download";
}

/**
 * Truncate a string to a maximum length, adding an ellipsis if truncated.
 *
 * @param input - The string to truncate
 * @param maxLength - Maximum allowed length (must be >= 4 for ellipsis)
 * @returns The truncated string with "..." appended if it was shortened
 */
export function truncate(input: string, maxLength: number): string {
  if (!input) return input;
  if (maxLength < 4) return input.substring(0, maxLength);
  if (input.length <= maxLength) return input;
  return input.substring(0, maxLength - 3) + "...";
}
