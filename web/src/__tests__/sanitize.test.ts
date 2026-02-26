/**
 * Tests for input sanitization utilities (web/src/lib/sanitize.ts).
 *
 * Tests:
 * - sanitizeHtml: strips <script>, <iframe>, event handlers, javascript: URLs,
 *   preserves normal text and safe entities, handles empty/null-ish, nested/malformed tags
 * - sanitizeFilename: replaces unsafe characters, handles empty/whitespace-only
 * - truncate: enforces max length, adds ellipsis, preserves short strings
 */

import { describe, it, expect } from "vitest";
import { sanitizeHtml, sanitizeFilename, truncate } from "@/lib/sanitize";

// ─── sanitizeHtml ─────────────────────────────────────────

describe("sanitizeHtml", () => {
  // ─── Script Tag Removal ────────────────────────────────

  it("strips <script> tags and content", () => {
    const input = "Hello <script>alert('xss')</script> World";
    const result = sanitizeHtml(input);
    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert");
    expect(result).toContain("Hello");
    expect(result).toContain("World");
  });

  it("strips <script> tags with attributes", () => {
    const input = '<script type="text/javascript" src="evil.js"></script>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("<script");
    expect(result).not.toContain("evil.js");
  });

  it("strips multiline <script> tags", () => {
    const input = `before<script>
      var x = 1;
      document.cookie;
    </script>after`;
    const result = sanitizeHtml(input);
    expect(result).not.toContain("document.cookie");
    expect(result).toContain("before");
    expect(result).toContain("after");
  });

  it("strips <script> tags case-insensitively", () => {
    const input = '<SCRIPT>alert(1)</SCRIPT>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("alert");
  });

  // ─── Iframe Tag Removal ────────────────────────────────

  it("strips <iframe> tags and content", () => {
    const input = 'Text <iframe src="https://evil.com"></iframe> more';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("<iframe");
    expect(result).not.toContain("evil.com");
    expect(result).toContain("Text");
    expect(result).toContain("more");
  });

  it("strips <iframe> with nested content", () => {
    const input = '<iframe><p>inner</p></iframe>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("<iframe");
  });

  // ─── Event Handler Removal ────────────────────────────

  it("strips onclick event handler", () => {
    const input = '<div onclick="alert(1)">Click me</div>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("onclick");
    expect(result).not.toContain("alert");
    expect(result).toContain("Click me");
  });

  it("strips onerror event handler", () => {
    const input = '<img onerror="alert(1)" src="x">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("onerror");
    expect(result).not.toContain("alert");
  });

  it("strips onload event handler", () => {
    const input = '<body onload="evil()">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("onload");
    expect(result).not.toContain("evil");
  });

  it("strips multiple event handlers", () => {
    const input = '<div onclick="a()" onmouseover="b()" onfocus="c()">text</div>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("onclick");
    expect(result).not.toContain("onmouseover");
    expect(result).not.toContain("onfocus");
    expect(result).toContain("text");
  });

  it("strips event handlers with single quotes", () => {
    const input = "<a onclick='steal()'>link</a>";
    const result = sanitizeHtml(input);
    expect(result).not.toContain("onclick");
    expect(result).not.toContain("steal");
  });

  // ─── javascript: URL Removal ──────────────────────────

  it("strips javascript: URLs", () => {
    const input = '<a href="javascript:alert(1)">click</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("javascript:");
  });

  it("strips javascript: URLs with whitespace", () => {
    const input = "<a href=\"javascript :alert(1)\">click</a>";
    const result = sanitizeHtml(input);
    expect(result).not.toContain("javascript");
  });

  it("strips javascript: URLs case-insensitively", () => {
    const input = '<a href="JAVASCRIPT:void(0)">link</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("JAVASCRIPT:");
  });

  // ─── Object/Embed/Applet Removal ─────────────────────

  it("strips <object> tags", () => {
    const input = '<object data="flash.swf">fallback</object>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("<object");
    expect(result).not.toContain("flash.swf");
  });

  it("strips <embed> tags", () => {
    const input = '<embed src="plugin.swf">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("<embed");
    expect(result).not.toContain("plugin.swf");
  });

  it("strips <applet> tags", () => {
    const input = '<applet code="Evil.class">fallback</applet>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("<applet");
  });

  // ─── All Remaining HTML Tags ──────────────────────────

  it("strips generic HTML tags but preserves text", () => {
    const input = "<p>Hello</p> <strong>World</strong>";
    const result = sanitizeHtml(input);
    expect(result).not.toContain("<p>");
    expect(result).not.toContain("<strong>");
    expect(result).toContain("Hello");
    expect(result).toContain("World");
  });

  // ─── Preserves Normal Text and Entities ───────────────

  it("preserves normal plain text", () => {
    const input = "Just a normal river description with no HTML.";
    expect(sanitizeHtml(input)).toBe(input);
  });

  it("preserves text with ampersands and common characters", () => {
    const input = "Camping & fishing are great activities";
    expect(sanitizeHtml(input)).toBe("Camping & fishing are great activities");
  });

  it("preserves numeric content", () => {
    expect(sanitizeHtml("Flow rate: 1500 cfs")).toBe("Flow rate: 1500 cfs");
  });

  it("preserves unicode characters", () => {
    const input = "River 🏞️ with rapids 🌊";
    expect(sanitizeHtml(input)).toBe("River 🏞️ with rapids 🌊");
  });

  // ─── Empty / Null-ish Inputs ──────────────────────────

  it("handles empty string", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("returns empty-ish values unchanged", () => {
    // sanitizeHtml has the guard `if (!input) return input`
    // which returns falsy values as-is
    expect(sanitizeHtml(null as unknown as string)).toBeNull();
    expect(sanitizeHtml(undefined as unknown as string)).toBeUndefined();
  });

  // ─── Nested / Malformed Tags ──────────────────────────

  it("handles nested script tags", () => {
    const input = '<script><script>alert(1)</script></script>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("alert");
    expect(result).not.toContain("<script");
  });

  it("handles unclosed tags", () => {
    const input = "<div>unclosed <span>nested";
    const result = sanitizeHtml(input);
    expect(result).toContain("unclosed");
    expect(result).toContain("nested");
    expect(result).not.toContain("<div");
    expect(result).not.toContain("<span");
  });

  it("handles malformed attributes", () => {
    const input = '<img src=x onerror=alert(1) />';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("onerror");
    expect(result).not.toContain("alert");
  });

  it("handles deeply nested dangerous content", () => {
    const input = '<div><p><a href="javascript:void(0)"><script>x</script></a></p></div>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("<script");
    expect(result).not.toContain("javascript:");
    expect(result).not.toContain("<div");
  });

  // ─── Angle bracket re-escaping ────────────────────────

  it("re-escapes angle brackets after stripping tags", () => {
    // After decoding &lt; → <, the function re-escapes to prevent injection
    const input = "value &lt; 100 &amp; value &gt; 0";
    const result = sanitizeHtml(input);
    expect(result).toContain("&lt;");
    expect(result).toContain("&gt;");
  });

  it("trims whitespace from result", () => {
    const input = "  hello  ";
    expect(sanitizeHtml(input)).toBe("hello");
  });
});

// ─── sanitizeFilename ─────────────────────────────────────

describe("sanitizeFilename", () => {
  it("returns filename unchanged when safe (no special chars)", () => {
    expect(sanitizeFilename("myfile.csv")).toBe("myfile.csv");
  });

  it("collapses dashes into underscores", () => {
    // The [\ s_-]+ regex collapses dashes along with spaces/underscores
    expect(sanitizeFilename("my-file_name.csv")).toBe("my_file_name.csv");
  });

  it("replaces path separators with underscores", () => {
    expect(sanitizeFilename("path/to/file")).toBe("path_to_file");
    expect(sanitizeFilename("path\\to\\file")).toBe("path_to_file");
  });

  it("removes unsafe characters", () => {
    const result = sanitizeFilename("file<>:?*|name.txt");
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
    expect(result).not.toContain(":");
    expect(result).not.toContain("?");
    expect(result).not.toContain("*");
    expect(result).not.toContain("|");
  });

  it("removes null bytes", () => {
    expect(sanitizeFilename("file\0name")).not.toContain("\0");
  });

  it("removes directory traversal sequences", () => {
    const result = sanitizeFilename("../../etc/passwd");
    expect(result).not.toContain("..");
    expect(result).not.toContain("/");
  });

  it("collapses multiple spaces/underscores/dashes", () => {
    expect(sanitizeFilename("file   name")).toBe("file_name");
    expect(sanitizeFilename("file___name")).toBe("file_name");
    expect(sanitizeFilename("file---name")).toBe("file_name");
  });

  it("removes leading and trailing dots", () => {
    const result = sanitizeFilename(".hidden.file.");
    expect(result).not.toMatch(/^\./);
    expect(result).not.toMatch(/\.$/);
  });

  it("handles empty string by returning 'download'", () => {
    expect(sanitizeFilename("")).toBe("download");
  });

  it("handles whitespace-only input", () => {
    // Spaces pass the [^a-zA-Z0-9\-_. ] filter, then [\s_-]+ collapses to "_"
    // Leading/trailing space stripping removes spaces but not underscores
    // Result is "_" (not empty, so no "download" fallback)
    const result = sanitizeFilename("   ");
    expect(result).toBeTruthy();
    expect(result).not.toContain(" ");
  });

  it("handles null/undefined by returning 'download'", () => {
    expect(sanitizeFilename(null as unknown as string)).toBe("download");
    expect(sanitizeFilename(undefined as unknown as string)).toBe("download");
  });

  it("limits filename length to 255 characters", () => {
    const longName = "a".repeat(300) + ".txt";
    const result = sanitizeFilename(longName);
    expect(result.length).toBeLessThanOrEqual(255);
  });

  it("handles all-unsafe-characters input by returning 'download'", () => {
    expect(sanitizeFilename("!@#$%^&*()")).toBe("download");
  });

  it("preserves alphanumeric characters", () => {
    expect(sanitizeFilename("ABC123def")).toBe("ABC123def");
  });
});

// ─── truncate ─────────────────────────────────────────────

describe("truncate", () => {
  it("preserves strings shorter than maxLength", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("preserves strings equal to maxLength", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("truncates strings longer than maxLength and adds ellipsis", () => {
    expect(truncate("hello world", 8)).toBe("hello...");
  });

  it("ellipsis counts toward maxLength", () => {
    const result = truncate("abcdefghij", 7);
    expect(result).toBe("abcd...");
    expect(result.length).toBe(7);
  });

  it("handles maxLength of exactly 4 (minimum for ellipsis)", () => {
    const result = truncate("abcdef", 4);
    expect(result).toBe("a...");
    expect(result.length).toBe(4);
  });

  it("returns substring without ellipsis when maxLength < 4", () => {
    expect(truncate("abcdef", 3)).toBe("abc");
    expect(truncate("abcdef", 1)).toBe("a");
  });

  it("handles maxLength of 0", () => {
    expect(truncate("hello", 0)).toBe("");
  });

  it("handles empty string", () => {
    expect(truncate("", 10)).toBe("");
  });

  it("handles null/undefined input", () => {
    expect(truncate(null as unknown as string, 10)).toBeNull();
    expect(truncate(undefined as unknown as string, 10)).toBeUndefined();
  });

  it("handles very long strings", () => {
    const long = "x".repeat(10000);
    const result = truncate(long, 100);
    expect(result.length).toBe(100);
    expect(result.endsWith("...")).toBe(true);
  });

  it("preserves unicode in truncated strings", () => {
    const input = "Hello 🌊🏞️ river world";
    const result = truncate(input, 10);
    expect(result.length).toBeLessThanOrEqual(10);
    expect(result.endsWith("...")).toBe(true);
  });
});
