function decodePrettyComponent(s) {
  let replacements = {'---': ' - ', '--': '-','-' : ' '}
  return decodeURIComponent(s.replace(/-+/g, e => replacements[e] ?? '-'))
}

function decodeURL(s) {
  if (s.startsWith("http")) return s;
  if (s.startsWith(".")) return s;
  if (s.startsWith("/")) return s;
  try {
    const bytes = atob(s.replace(/=/g,''))
    // atob yields Latin-1. Recover UTF-8 so pasted SVG containing accents or
    // emoji survives; fall back to the raw bytes for genuinely Latin-1 payloads
    // written by older versions of the editor.
    let decoded;
    try {
      decoded = decodeURIComponent(escape(bytes))
    } catch (e) {
      decoded = bytes
    }
    // SVG markup goes to the renderer, so it may hold newlines and non-ASCII
    if (/^\s*</.test(decoded) || decoded.startsWith("svg:")) return decoded;
    // "intranet" is valid base64 by accident and decodes to bytes, so only
    // accept a decode that came out as text and looks like a URL.
    return (/^[\x20-\x7e]+$/.test(decoded) && /[.:]/.test(decoded)) ? decoded : s;
  } catch (e) {
    return s;
  }
}

function hasScheme(u) {
  let m = /^([a-z][a-z0-9+.-]*):(.*)$/i.exec(u);
  if (!m) return false;
  // "example.com:8080" and "localhost:3000" are a host and port, not a scheme.
  // "tel:5551234" is a scheme, so only treat it as a port when the part before
  // the colon is a dotted name or localhost.
  let name = m[1].toLowerCase();
  if ((name.indexOf(".") >= 0 || name === "localhost") && /^\d+([/?#]|$)/.test(m[2])) return false;
  return true;
}

function defaultScheme(u) {
  let host = u.split("/")[0].split("?")[0].split("#")[0].split(":")[0].toLowerCase();
  // Numeric hosts, localhost and .local names are this machine or a device on
  // the local network, which rarely have certificates.
  let local = /^[0-9.]+$/.test(host) || host === "localhost" || /\.(local|localhost)$/.test(host);
  return (local ? "http://" : "https://") + u;
}

function atou(b64) { return decodeURIComponent(escape(atob(b64))); }
function utoa(data) { return btoa(unescape(encodeURIComponent(data))); }

// Shared SVG->PNG renderer: https://github.com/arfct/og-svg
export const RENDER_ORIGIN = "https://og-svg.arfct.workers.dev";

// Builds a render URL from an SVG payload.
//
// The payload is passed through byte-for-byte rather than re-encoded, because it
// may be base64, percent-encoded, or raw markup depending on who wrote the URL.
// og-svg tries base64 first and falls back to percent-decoding, and wraps a bare
// fragment in an <svg> root, so all of those work.
function renderUrl(payload) {
  return `${RENDER_ORIGIN}/png?s=${encodeURIComponent(payload)}`;
}

/**
 * Resolves the `i` field to a final og:image URL.
 *
 * The editor base64-encodes whatever is in the image field with no marker
 * (docs/edit.html), so a user who pastes SVG code — which the prompt invites —
 * arrives here as raw markup. That used to fall through to the bare-hostname
 * branch and produce `og:image="https://<svg xmlns=..."`, i.e. no preview at
 * all. Markup is now detected directly, so both a pasted SVG and an explicit
 * `svg:` payload reach the renderer.
 *
 * @param {string|undefined} raw the `i` value from the path
 * @param {string|undefined} targetUrl the `u` value, for resolving relatives
 * @returns {string} the og:image URL, or "" when there is nothing to show
 */
export function resolveImageUrl(raw, targetUrl) {
  if (!raw) return "";

  const value = decodeURL(raw);

  if (value.startsWith("svg:")) return renderUrl(value.substring(4));

  // Raw SVG markup, or a bare fragment og-svg will wrap for us.
  if (value.trimStart().startsWith("<")) return renderUrl(value);

  if (value.startsWith("http")) return value;

  if (targetUrl && (value.startsWith(".") || value.startsWith("/"))) {
    return new URL(value, targetUrl).href;
  }

  return "https://" + value;
}

let urlValues = ["u","i","v","f"];
export function pathToMetadata(path) {
  let components = path.substring(1).split("/");
  components.unshift("t"); // Title designation for the first element
  let info = {}
  for (let i = 0; i < components.length; i+=2) {
    let key = components[i];
    let value = components[i+1];
    if (!value) continue;
    if (urlValues.includes(key)) {
      value = decodeURIComponent(value);
      if (value.startsWith(":")) value = "https://" + value.substring(1);
    } else {
      value = decodePrettyComponent(value);
    }
    if (key.length && value.length) info[key] = value;
  }
  return info;
}

// Metadata is user content headed for an HTML attribute sink, so every
// interpolated value is escaped.
export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function mProp(prop, content) { return `<meta property="${prop}" content="${escapeHtml(content)}"/>` }
function mName(name, content) { return `<meta name="${name}" content="${escapeHtml(content)}"/>` }
function mLink(rel, href, type) {
  return `<link rel="${rel}"${type ? ` type="${type}"` : ""} href="${escapeHtml(href)}">`
}

// Case-insensitive substrings. iMessage's fetcher claims facebookexternalhit
// and Twitterbot at once, so it matches here too.
const METADATA_BOTS = [
  "twitterbot", "facebookexternalhit", "slackbot-linkexpanding", "discordbot",
  "whatsapp", "telegrambot", "linkedinbot", "snapchat", "googlebot", "curl",
];

export function isMetadataBot(ua) {
  const lower = (ua || "").toLowerCase();
  return METADATA_BOTS.some(bot => lower.includes(bot));
}

// Apple's link-preview fetcher claims to be Safari, Facebook, and Twitter at
// once. No real Facebook or Twitter crawler claims Safari, so all four together
// identify it.
export function isIMessage(ua) {
  const lower = (ua || "").toLowerCase();
  return ["safari", "applewebkit", "facebookexternalhit", "twitterbot"].every(s => lower.includes(s));
}

function faviconUrl(value, targetUrl) {
  if (value.length > 9) {
    return decodeURL(targetUrl ? new URL(value, targetUrl).href : value);
  }
  // A short value is an emoji, served from Google's Noto PNG CDN
  let codepoints = Array.from(value).map(c => c.codePointAt(0).toString(16));
  return `https://fonts.gstatic.com/s/e/notoemoji/14.0/${codepoints.join("_")}/128.png`;
}

/**
 * Builds the <head> tags for a decoded path.
 *
 * Post style puts iMessage in its social-post layout. By default iMessage shows
 * only title and image, and drops the icon when there is an image. A page that
 * looks like a Fediverse post (og:type article plus an ActivityPub alternate
 * link) gets the description as body text and the icon beside the title.
 * iMessage falls back to the default layout when there is no description.
 *
 * Post style is on for iMessage unless the path has `p/0`; `p/1` turns it on
 * for every crawler. Other platforms ignore the alternate link. This rides on
 * an undocumented heuristic, so the default tags stay correct and the card
 * degrades to title and image if Apple changes it.
 *
 * @param {object} info the output of pathToMetadata
 * @param {{imessage?: boolean}} options imessage: the request is Apple's fetcher
 * @returns {string[]} the tags, one per entry
 */
export function buildTags(info, { imessage = false } = {}) {
  info = { ...info };
  let content = ['<meta charset="UTF-8">'];
  if (info.t) { content.push(`<title>${escapeHtml(info.t)}</title>`, mProp("og:title", info.t)) }
  if (info.s) { content.push(mProp("og:site_name", info.s)) }
  const post = info.p ? info.p !== "0" : imessage;
  if (post) {
    content.push(mProp("og:type", "article"));
    content.push(mLink("alternate", "", "application/activity+json"));
  } else if (info.y) {
    content.push(mProp("og:type", info.y));
  }
  if (info.d) { content.push(mProp("og:description", info.d), mName("description", info.d)) }
  if (info.c) { content.push(mName("theme-color", "#" + info.c)) }

  if (info.u) {
    info.u = decodeURL(info.u)
    if (!hasScheme(info.u)) info.u = defaultScheme(info.u);
    content.push(mProp("og:url", info.u));
    // JSON.stringify quotes the string; escaping < keeps </script> from closing the tag
    content.push(`<script>location.href=${JSON.stringify(info.u).replace(/</g, "\\u003c")}</script>`);
  }

  if (info.i) {
    content.push(mProp("og:image", resolveImageUrl(info.i, info.u)));
    if (info.iw) content.push(mProp("og:image:width", info.iw));
    if (info.ih) content.push(mProp("og:image:height", info.ih));
    content.push(mName("twitter:card", "summary_large_image"));
  }
  if (info.v) {
    content.push(mProp("og:video", decodeURL(info.v)));
    if (info.vw) content.push(mProp("og:video:width", info.vw));
    if (info.vh) content.push(mProp("og:video:height", info.vh));
  }
  if (info.f) {
    // iMessage reads either; apple-touch-icon is the higher-resolution source
    const icon = faviconUrl(info.f, info.u);
    content.push(mLink("icon", icon, "image/png"), mLink("apple-touch-icon", icon));
  }
  return content;
}

// Valid URL Chars A-Za-z0-9-._~:?@!$&()*;=+/
export default async (request, context) => {

  try {
    const ua = request.headers.get("user-agent");
    let url = new URL(request.url);
    let path = url.pathname;
    let geo = context?.geo?.city + ", " + context?.geo?.subdivision?.code + ", " + context?.geo?.country?.code

    // /view/ and /cast/ carry a target URL in the same key/value grammar, but
    // they are pages in their own right, not link previews. Let them through.
    if (/^\/(view|cast)(\/|$)/.test(path)) return;

    let uaArray = Deno.env.get("UA_ARRAY")?.split(",") || [];
    let uaMatch = uaArray.some(a => ua?.indexOf(a) != -1);
    if (uaMatch) { return new Response('', { status: 401 }); }

    if (path != "/" ) {

      let isBot = isMetadataBot(ua);

      // /m/ serves tags to every user-agent. The editor shares /m/ links, so
      // humans land here too and the script tag forwards them.
      if (path.startsWith("/m/")) {
        path = path.substring(2);
        isBot = true;
      }

      if (isBot && path.endsWith("/")) {
        console.log("parsing", path)
        let info = pathToMetadata(path)
        let content = buildTags(info, { imessage: isIMessage(ua) });

        console.log(["Metadata Request", JSON.stringify(info), geo, ua].join('\t'));
        return new Response(content.join("\n"), {
          headers: {
            "content-type": "text/html; charset=utf-8",
            // Let the CDN absorb crawler bursts while corrections still propagate
            "cache-control": "public, max-age=300, s-maxage=300",
          },
        });
      }
    } else {
      console.log(["Request", path, geo, request.headers.get("referer"), ua].join('\t'));
    }
  } catch (e) {
    console.log("Error:", request.url, e)
  }
}
