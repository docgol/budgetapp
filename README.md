# Coin Quest Budget

A retro 8-bit budget tracker for your phone, starring Penny the piggy bank. Plain HTML, CSS and JS: no build step and no dependencies.

## Features
- **World**: money left this month, a power bar for budget used, income / spent / net, top categories, recent entries
- **+ block**: add an expense or income (tap any entry to edit or delete it)
- **Cats**: categories with their own monthly limits
- **Log**: spending by category, a 6-month income vs spending chart, all entries
- **Menu**: monthly budget (carries forward), currency symbol, sound, export / import backup, reset
- **Coin Run** mini game: tap to jump, hold to jump higher, stomp the bills and grab coins. Each run uses a life, and logging an entry earns one back (max 3). Stay under budget this month to start runs with a shield.

Data is stored in your browser's `localStorage` on that device only. Use **Menu → Export backup** now and then.

## Run it on your computer
```sh
python3 -m http.server 8000
```
Open http://localhost:8000. To try it on your phone, connect to the same Wi-Fi and open `http://<your-mac's-ip>:8000`. Find the IP with `ipconfig getifaddr en0`.

## Put it on your phone for real
Host the folder on any static HTTPS host, then open it on your phone and use **Share → Add to Home Screen** (iOS) or **Install app** (Android). It then runs full screen and works offline.

- **GitHub Pages**: push this repo, then Settings → Pages → deploy from `main` / root
- **Netlify Drop**: drag this folder onto https://app.netlify.com/drop
- Cloudflare Pages, Vercel or any static host also works

When you change files, bump `VERSION` in `sw.js` so installed copies pick up the update.
