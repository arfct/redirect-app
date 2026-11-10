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
    caption: The builder at redirect.app/edit/, with a URL entered, the redirect link generated from it and the preview card on the right
    alt: A grey page headed "make a redirect" with a URL field, the generated redirect link and a preview card reading Home Assistant, Kitchen
unconfirmed:
  - date
---

Redirect.app is a URL redirector that keeps no data on a server. Each redirect is encoded in the path of its own link, so one static site handles all of them without a database.

It has three uses. A link preview is written into a URL as a title, a description, an image and a target; crawlers that fetch the link receive Open Graph tags, and people are forwarded to the target. The builder at /edit/ composes these links and previews the card in the styles of iMessage, Twitter, Slack and Discord. A second route tries a custom app scheme and falls back to another URL when the app is not installed. A Cast sender and receiver display any web page on a Chromecast.

JavaScript, Netlify Edge Functions. 2019.
