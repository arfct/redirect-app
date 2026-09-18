import { describe, it, expect } from "vitest";
import { resolveImageUrl, RENDER_ORIGIN } from "../netlify/edge-functions/metadata.js";

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="315"><rect width="600" height="315" fill="teal"/></svg>';

// What docs/edit.html writes into the path for an image value.
const asEditorEncodes = (value) => utf8Base64(value).replace(/=/g, "");

// UTF-8-safe base64, matching the repo's existing utoa() helper.
const utf8Base64 = (value) => btoa(unescape(encodeURIComponent(value)));

describe("resolveImageUrl", () => {
  it("sends SVG markup pasted into the editor to the renderer", () => {
    // The editor base64s the value with no svg: marker, so after decoding we
    // hold raw markup. This previously produced "https://<svg ...".
    const out = resolveImageUrl(asEditorEncodes(SVG));
    expect(out.startsWith(`${RENDER_ORIGIN}/png?s=`)).toBe(true);
  });

  it("never produces an https:// prefixed blob of markup", () => {
    const out = resolveImageUrl(asEditorEncodes(SVG));
    expect(out).not.toContain("https://<svg");
  });

  it("still handles an explicit svg: marker", () => {
    const out = resolveImageUrl(`svg:${asEditorEncodes(SVG)}`);
    expect(out.startsWith(`${RENDER_ORIGIN}/png?s=`)).toBe(true);
  });

  it("sends a bare fragment to the renderer", () => {
    // og-svg wraps a fragment in an <svg> root with a default viewport.
    const out = resolveImageUrl(asEditorEncodes('<circle cx="60" cy="60" r="50"/>'));
    expect(out.startsWith(`${RENDER_ORIGIN}/png?s=`)).toBe(true);
  });

  it("round-trips the markup through the renderer payload", () => {
    const out = resolveImageUrl(asEditorEncodes(SVG));
    const payload = decodeURIComponent(new URL(out).searchParams.get("s"));
    // The payload must decode back to the original markup, base64 or otherwise.
    const decoded = /^</.test(payload) ? payload : atob(payload);
    expect(decoded).toContain('fill="teal"');
  });

  it("preserves non-ASCII text in pasted SVG", () => {
    // btoa is Latin-1 only, so 'é' arrives as a raw 0xE9 byte that is not valid
    // UTF-8. Decoding must recover the character, or resvg rejects the document.
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">' +
      '<text x="30" y="120">café</text></svg>';
    const out = resolveImageUrl(utf8Base64(svg));
    const payload = decodeURIComponent(new URL(out).searchParams.get("s"));
    const decoded = /^</.test(payload) ? payload : payload;
    expect(decoded).toContain("café");
  });

  it("tolerates a Latin-1 encoded payload from the old editor", () => {
    // Links built before the editor switched to UTF-8-safe base64.
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>café</text></svg>';
    const latin1 = btoa(svg).replace(/=/g, "");
    expect(() => resolveImageUrl(latin1)).not.toThrow();
    expect(resolveImageUrl(latin1)).toContain(`${RENDER_ORIGIN}/png?s=`);
  });

  it("leaves an absolute https url alone", () => {
    const url = "https://cdn.example.com/a.jpg";
    expect(resolveImageUrl(url)).toBe(url);
  });

  it("leaves an absolute http url alone", () => {
    const url = "http://cdn.example.com/a.jpg";
    expect(resolveImageUrl(url)).toBe(url);
  });

  it("resolves a relative path against the target url", () => {
    expect(resolveImageUrl("/img/a.png", "https://example.com/page")).toBe(
      "https://example.com/img/a.png",
    );
  });

  it("resolves a dot-relative path against the target url", () => {
    expect(resolveImageUrl("./a.png", "https://example.com/dir/page")).toBe(
      "https://example.com/dir/a.png",
    );
  });

  it("prefixes a bare hostname with https", () => {
    expect(resolveImageUrl("cdn.example.com/a.jpg")).toBe("https://cdn.example.com/a.jpg");
  });

  it("returns an empty string for no input", () => {
    expect(resolveImageUrl(undefined)).toBe("");
  });

  it("does not treat a base64 payload that decodes to a url as svg", () => {
    const out = resolveImageUrl(asEditorEncodes("https://cdn.example.com/b.jpg"));
    expect(out).toBe("https://cdn.example.com/b.jpg");
  });
});
