import { describe, it, expect } from "vitest";
import { buildTags, pathToMetadata, isMetadataBot } from "../netlify/edge-functions/metadata.js";

const IMESSAGE_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0";

const tagsFor = (path) => buildTags(pathToMetadata(path)).join("\n");

describe("post mode (p)", () => {
  it("emits the Fediverse-post signals iMessage looks for", () => {
    const html = tagsFor("/Launch--Day/d/We-shipped-it/p/1/u/:example.com/");
    expect(html).toContain('<meta property="og:type" content="article"/>');
    expect(html).toContain('<link rel="alternate" type="application/activity+json" href="">');
    expect(html).toContain('<meta property="og:description" content="We shipped it"/>');
  });

  it("overrides an explicit og:type", () => {
    const html = tagsFor("/Hi/y/website/p/1/");
    expect(html).toContain('content="article"');
    expect(html).not.toContain('content="website"');
  });

  it("is absent by default", () => {
    const html = tagsFor("/Hi/d/There/");
    expect(html).not.toContain("activity+json");
    expect(html).not.toContain("og:type");
  });
});

describe("buildTags", () => {
  it("escapes values interpolated into attributes and the title", () => {
    const html = tagsFor(`/Tom-%26-Jerry/d/${encodeURIComponent('"><script>x</script>')}/`);
    expect(html).toContain("<title>Tom &amp; Jerry</title>");
    expect(html).not.toContain("<script>x");
  });

  it("keeps the redirect script from being closed early", () => {
    const html = tagsFor(`/Hi/u/${encodeURIComponent("https://e.com/</script>")}/`);
    expect(html).not.toContain("e.com/</script>");
  });

  it("names image and video dimensions correctly", () => {
    const html = tagsFor("/Hi/i/:e.com%2Fa.png/iw/1200/ih/630/v/:e.com%2Fa.mp4/vw/640/vh/360/");
    expect(html).toContain('og:image:width" content="1200"');
    expect(html).toContain('og:image:height" content="630"');
    expect(html).toContain('og:video:width" content="640"');
    expect(html).toContain('og:video:height" content="360"');
  });

  it("serves an emoji favicon as both icon and apple-touch-icon", () => {
    const html = tagsFor(`/Hi/f/${encodeURIComponent("🚀")}/`);
    expect(html).toContain('<link rel="icon" type="image/png" href="https://fonts.gstatic.com/s/e/notoemoji/14.0/1f680/128.png">');
    expect(html).toContain('<link rel="apple-touch-icon" href="https://fonts.gstatic.com/s/e/notoemoji/14.0/1f680/128.png">');
  });

  it("accepts an absolute favicon URL without a forwarding URL", () => {
    expect(() => tagsFor(`/Hi/f/${encodeURIComponent("https://e.com/icon.png")}/`)).not.toThrow();
  });
});

describe("isMetadataBot", () => {
  it.each([
    IMESSAGE_UA,
    "WhatsApp/2.23",
    "TelegramBot (like TwitterBot)",
    "LinkedInBot/1.0",
    "slackbot-linkexpanding 1.0",
  ])("matches %s", (ua) => expect(isMetadataBot(ua)).toBe(true));

  it("ignores a regular browser", () => {
    expect(isMetadataBot("Mozilla/5.0 (iPhone) AppleWebKit Safari")).toBe(false);
  });
});
