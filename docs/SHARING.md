# Sharing tournament links (Open Graph)

Public tournament URLs (`/tournaments/{slug}`) expose Open Graph and Twitter metadata for Facebook, Messenger, iMessage, and X.

## What organizers control

- **Cover photo** on the event drives the large preview image when set. Upload a wide poster (about **1200×630** px) so Facebook does not crop important text.
- If there is no cover, the site uses [`public/og-tournament-default.jpg`](../public/og-tournament-default.jpg).

## Production

1. Set **`NEXT_PUBLIC_APP_URL`** to your public HTTPS origin (e.g. `https://www.regmytourna.com`) so `og:url` and fallback images are absolute URLs.
2. Deploy.
3. For each event you care about, open [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/), paste the tournament URL, and click **Scrape Again** to refresh Facebook’s cache after you change the cover or metadata.

## Verifying tags

View HTML source on a tournament page or fetch with a crawler user-agent. You should see `og:title`, `og:description`, and `og:image`.

Tournament-specific copy is built in [`src/lib/tournaments/share-metadata.ts`](../src/lib/tournaments/share-metadata.ts).