---
title: Redirect App
date: 2019-07
category: product
tags:
  - web
url: https://www.redirect.app
links:
  source: https://github.com/arfct/redirect-app
media:
  - src: builder.png
    caption: The builder, composing a link preview from a URL
    alt: A grey page headed "make a redirect" with a URL field, the generated redirect link and a preview card reading Home Assistant, Kitchen
unconfirmed:
  - date
---

The link knows where it wants to go; the browser disagrees. Redirect.app is a redirector where the URL is the data: one static endpoint stands in for unlimited specific things, because everything it needs is encoded in the path. No database, no stored state.

That one idea shows up three times. A link preview you author in a URL, with Open Graph tags for bots and a forward for people, built in a visual editor. A deep-link redirector that tries a custom app scheme and falls back if the app isn't there. A Cast receiver that will display any page you hand it.

JavaScript on Netlify, with an edge function for the previews. 2019.
