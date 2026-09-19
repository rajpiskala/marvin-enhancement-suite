# Store assets

These files are ready for the Chrome Web Store and Firefox Add-ons dashboards:

- `icon-128.png`: square listing icon;
- `screenshot-popup-1280x800.png`: required full-bleed product screenshot;
- `promo-small-440x280.png`: required Chrome promotional tile; and
- `promo-marquee-1400x560.png`: optional Chrome marquee artwork.

The artwork uses only the MES identity. It intentionally avoids Amazing Marvin logos and personal task data.

Run `npm run marketplace:prepare` to package this artwork with the verified Chrome and Firefox uploads, listing copy, checksums, and a field-by-field upload checklist in `.output/marketplace/`.
