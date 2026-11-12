---
title: Redirect.app
date: 2019-07
status: released
category: product
tags:
  - web
url: https://www.redirect.app
links:
  source: https://github.com/arfct/redirect-app
media:
  - src: builder.png
    caption: The builder at redirect.app/edit/, with an address entered on the left, the redirect link made from it, and on the right the card that link will produce
    alt: A grey page headed "make a redirect" with a URL field, the generated redirect link and a preview card reading Home Assistant, Kitchen
unconfirmed: [date, status]
---

When the crawler of a chat app fetches a redirect.app link, it is answered with Open Graph tags built from the link's own path, while a person who follows the same link is forwarded to its target. The address www.redirect.app/Hello/d/World/u/:example.com/ is a preview with the title Hello and the description World, and it leads to example.com. Nothing about a link is stored, so the site needs no database.

The builder at /edit/, shown in the image, composes these links from a title, a description, a site name, an image and a target, and draws the resulting card in the styles of iMessage, Discord, Slack and Twitter. In the path a dash stands for a space, so that Kitchen---Home-Assistant reads back as Kitchen - Home Assistant.

Redirect.app began in 2019 as a plain forwarder, which takes its target after a # and can take a fallback as well. On a phone it tries a custom app scheme and goes to the fallback when the app does not open; for a web address it requests the site's favicon first. A Cast sender and receiver, added in 2026, put any web page on a Chromecast.

JavaScript, Netlify Edge Functions. 2019.
