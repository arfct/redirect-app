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

Redirect.app is a redirector that keeps all of its data in the URL. One static endpoint serves every redirect, because the path encodes everything it needs. There is no database and no stored state.

It has three uses. A link preview is authored in a URL and built in a visual editor; it serves Open Graph tags to bots and forwards people to the destination. A deep-link redirector tries a custom app scheme and falls back when the app is not installed. A Cast receiver displays any page given to it.

JavaScript on Netlify, with an edge function for the previews. 2019.
