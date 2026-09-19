# redirect.app

A redirector where the URL is the data.

One static endpoint stands in for unlimited specific things, because everything
it needs is encoded in the path. There is no database and no stored state. That
one idea shows up three times: as link previews you author in a URL, as a
deep-link redirector with a fallback, and as a Cast receiver that will display
any page you hand it.

Hosted on Netlify at <https://www.redirect.app>. The apex 301s to `www`.

## Routes

| Route | What it does |
|---|---|
| `/#<url>` | Forward to a URL. `?FALLBACK=` adds a second chance — see below. |
| `/<Title>/d/<desc>/u/<url>/` | A link preview authored entirely in the path. Bots get Open Graph tags, people get forwarded. |
| `/m/<Title>/…` | The same, but forces the metadata response for any user agent. Useful for checking your work. |
| `/edit/` | Visual builder for those preview URLs, with per-platform previews. |
| `/view/u/<url>/` | Forward to a target, or wrap it in a frame with `m/f`. |
| `/cast#<url>` | Cast sender. Pushes one URL to a Chromecast. |
| `/cast/receiver/` | The registered Cast receiver. Not meant to be opened directly. |
| `/bot/link` | Discord slash-command endpoint for `/embed`. |

## Path grammar

Paths are `/key/value/` pairs. The first segment is the title, so
`/Hello/d/World/` means title `Hello`, description `World`.

| Key | Meaning |
|---|---|
| `t` | Title (implicit in the first segment) |
| `d` | Description |
| `s` | Site name |
| `u` | Target URL |
| `i` | Image (`og:image`), with `iw` / `ih` for dimensions |
| `v` | Video (`og:video`), with `vw` / `vh` |
| `f` | Favicon: a URL, or a single emoji |
| `c` | Theme colour, hex without the `#` |
| `y` | `og:type` |
| `m` | `/view/` only — `t` forwards (default), `f` wraps in a frame |

Three encodings keep these readable:

- **Dashes are spaces.** `-` is a space, `--` a hyphen, `---` a spaced hyphen.
  So `Kitchen---Home-Assistant` reads back as `Kitchen - Home Assistant`.
- **`:host` means `https://host`.** `u/:example.com/` saves the boilerplate.
- **Bare tokens may be base64.** A token with no dot or slash is treated as
  base64, which is how long image URLs stay manageable.

An emoji in `f` becomes a favicon via Google's Noto emoji PNGs, so
`f/%F0%9F%8F%A0/` gives you a house.

### Scheme defaulting

A target with no scheme gets one, chosen by what the host looks like:

| Input | Result |
|---|---|
| `example.com` | `https://example.com` |
| `example.com:8080` | `https://example.com:8080` |
| `192.168.1.50:8123` | `http://192.168.1.50:8123` |
| `localhost:3000` | `http://localhost:3000` |
| `nas1.local` | `http://nas1.local` |

Numeric hosts, `localhost` and `.local` names are this machine or a device on
the local network, which rarely have certificates. Everything else gets https.

Telling a host and port from a scheme takes some care, since `example.com` is
made of characters that are legal in a scheme. It reads as a host and port only
when the name is dotted or is `localhost` *and* what follows the colon is
purely a number — so `localhost:3000` is a host, and `tel:5551234` is still a
scheme.

## Fallbacks

`/#<primary>?FALLBACK=<fallback>` tries the primary and falls back if it looks
unreachable. Custom schemes are probed with a hidden iframe and a timing
heuristic; http(s) targets are probed by loading their favicon. The fallback
can be another URL, or a message to show before continuing to the primary.

This is what makes a custom app scheme safe to put in a link that strangers
will open on devices where the app isn't installed.

## Casting

Registered Cast receiver, published and usable by anyone:

```
App ID    CCAB7FD4
Receiver  https://www.redirect.app/cast/receiver/
Sender    https://www.redirect.app/cast
```

Open the sender, pick a device, send a URL. `/cast#<url>` prefills the field,
so one bookmark per dashboard works.

**Forwarding is the default.** The receiver navigates the whole page to your
target rather than framing it. That reaches sites which refuse framing, and it
reaches plain-http dashboards on your LAN, because a top-level navigation is
not mixed content. It also ends the Cast session — the receiver is gone, so to
change what's on screen you cast again. Tick "wrap in a frame" to keep
redirect.app on top instead, where the target permits it.

### Namespaces

```
urn:x-cast:app.redirect       {"url": "…", "mode": "t" | "f"}
urn:x-cast:es.offd.dashcast   {"url": "…", "force": true | false}
```

The second is [DashCast](https://github.com/stestagg/dashcast)'s own namespace
and message shape, so `catt` and the Home Assistant DashCast component work
against this app ID unchanged. DashCast frames unless told to `force`; this one
forwards unless told to wrap. Each namespace keeps its own default.

## Layout

```
docs/                       published by Netlify
  index.html                hash redirector with fallback probing
  edit.html                 link preview builder
  view.html                 forward or wrap a target
  cast.html                 Cast sender
  cast-receiver.html        Cast receiver (this URL is registered with Google)
  forward.js                shared URL grammar for view + receiver
netlify/
  edge-functions/
    metadata.js             renders Open Graph tags from the path
  functions/
    linkbot.js              Discord /embed slash command
bookmarklet/                builds a preview URL from the page you're on
netlify.toml                routing — order matters, see below
```

Routing rules in `netlify.toml` must stay above the `/*` catch-all, and
`/cast/receiver` must stay above `/cast/*`. Netlify serves real files before
applying rewrites, which is why `/forward.js` resolves.

The metadata edge function matches `/*/*` and skips `/view/` and `/cast/`
explicitly — without that it would treat them as link previews and redirect
bots to their targets.

## Development

Node 22, pinned in `.nvmrc`.

```sh
npm install
npx netlify dev --dir docs
```

Then <http://localhost:8888>. Edge functions need network access to fetch their
Deno bootstrap; if that fails, static routing and the redirect rules still work,
but `/…/u/…/` won't render metadata locally.

To check a preview URL against the real thing, deploy and fetch it as a bot:

```sh
curl -A "Twitterbot/1.0" "https://www.redirect.app/Some-Title/d/A-description/u/:example.com/"
```

## Working on the Cast receiver

The receiver URL is registered with Google and cannot move without updating the
[Cast Developer Console](https://cast.google.com/publish). If you change where
`cast-receiver.html` is served from, change the registration to match.

Receiver changes are live as soon as Netlify deploys — the device fetches the
page fresh on each launch, and nothing about the page is cached in the
registration. Only the URL itself is.
