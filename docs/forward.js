/* Shared URL grammar for /view/ and /cast/receiver/.
   Same conventions as netlify/edge-functions/metadata.js:
   path segments are key/value pairs, ":host" is shorthand for "https://host",
   and a bare token with no dot or slash is treated as base64.

   Keys:
     u  target url
     t  title, shown while forwarding
     f  favicon: a url or a single emoji
     c  theme color, hex without the #
     m  mode: "t" top-level forward (default), "f" wrap in a frame
*/

var BLOCKED_SCHEMES = ["javascript:", "data:", "vbscript:", "blob:", "file:"];

// Matches metadata.js: "-" is a space, "--" a hyphen, "---" a spaced hyphen.
function decodePrettyComponent(s) {
  var replacements = { "---": " - ", "--": "-", "-": " " };
  return decodeURIComponent(s.replace(/-+/g, function (e) {
    return replacements[e] !== undefined ? replacements[e] : "-";
  }));
}

function decodeURL(s) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;
  if (s.charAt(0) === "." || s.charAt(0) === "/") return s;
  // A hostname or path is never base64, so only try atob on a bare token.
  if (s.indexOf(".") >= 0 || s.indexOf("/") >= 0) return s;
  try {
    var decoded = atob(s.replace(/=/g, ""));
    // "intranet" is valid base64 by accident and decodes to bytes, so only
    // accept a decode that came out as text and looks like a URL.
    return (/^[\x20-\x7e]+$/.test(decoded) && /[.:]/.test(decoded)) ? decoded : s;
  } catch (e) { return s; }
}

function hasScheme(u) {
  var m = /^([a-z][a-z0-9+.-]*):(.*)$/i.exec(u);
  if (!m) return false;
  // "example.com:8080" and "localhost:3000" are a host and port, not a scheme.
  // "tel:5551234" is a scheme, so only treat it as a port when the part before
  // the colon is a dotted name or localhost.
  var name = m[1].toLowerCase();
  if ((name.indexOf(".") >= 0 || name === "localhost") && /^\d+([/?#]|$)/.test(m[2])) return false;
  return true;
}

function defaultScheme(u) {
  var host = u.split("/")[0].split("?")[0].split("#")[0].split(":")[0].toLowerCase();
  // Numeric hosts, localhost and .local names are this machine or a device on
  // the local network, which rarely have certificates.
  var local = /^[0-9.]+$/.test(host) || host === "localhost" || /\.(local|localhost)$/.test(host);
  return (local ? "http://" : "https://") + u;
}

function normalizeTarget(v) {
  if (!v) return "";
  v = String(v).trim();
  if (v.charAt(0) === ":") return "https://" + v.substring(1);
  v = decodeURL(v);
  if (!hasScheme(v)) v = defaultScheme(v);
  return v;
}

// Custom app schemes are allowed (redirect.app forwards to them already),
// but script-bearing schemes never are.
function isSafeTarget(url) {
  var lower = String(url).toLowerCase();
  for (var i = 0; i < BLOCKED_SCHEMES.length; i++) {
    if (lower.indexOf(BLOCKED_SCHEMES[i]) === 0) return false;
  }
  return /^[a-z][a-z0-9+.-]*:/i.test(url);
}

function isFramable(url) {
  return /^https?:/i.test(url);
}

function iconToURL(f) {
  if (!f) return "";
  if (/^(https?:)?\/\//i.test(f) || f.charAt(0) === "/") return f;
  var points = Array.from(f).map(function (c) { return c.codePointAt(0).toString(16); });
  return "https://fonts.gstatic.com/s/e/notoemoji/14.0/" + points.join("_") + "/128.png";
}

function parseForwardPath(path, search, hash) {
  var info = { u: "", t: "", f: "", c: "", m: "t" };
  var parts = String(path || "").replace(/^\/+/, "").replace(/\/+$/, "").split("/");

  // Drop the route prefix ("view", "cast", "cast/receiver") left on the path
  // by the rewrite, so the rest is clean key/value pairs.
  while (parts.length && /^(view|cast|receiver)$/i.test(parts[0])) parts.shift();

  for (var i = 0; i < parts.length; i += 2) {
    var key = parts[i];
    var value = parts[i + 1];
    if (!key || !value) continue;
    info[key] = (key === "t") ? decodePrettyComponent(value) : decodeURIComponent(value);
  }

  // /view?u=... and /view#https://... both work, and win over the path.
  var query = new URLSearchParams(search || "");
  query.forEach(function (value, key) { if (value) info[key] = value; });

  var fragment = (hash || "").replace(/^#/, "");
  if (fragment) info.u = decodeURIComponent(fragment);

  info.u = normalizeTarget(info.u);
  return info;
}
