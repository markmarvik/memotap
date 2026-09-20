# MemoTap

Tap-first **visual memo** authentication and a local account vault — memory-game unlock instead of typed passwords.

**Live demo:** [https://markmarvik.github.io/memotap/](https://markmarvik.github.io/memotap/)

## Try it (phone)

1. Open the live URL on your phone.
2. **Set my memo** — tap 4–6 friendly objects in order, then confirm.
3. Vault unlocks with demo accounts (encrypted in this browser).
4. Hit **Lock**, then unlock by tapping the same path among decoys.
5. Optional: toggle **Playful / Terminal** skin in the top bar.

## Run locally

Static site — no build step:

```bash
# from repo root
cd docs
python3 -m http.server 8080
# open http://localhost:8080
```

Or open `docs/index.html` directly (Web Crypto needs a secure context: `localhost` or HTTPS).

## What’s inside

| Feature | Detail |
|--------|--------|
| Visual memo | Short tap sequence (4–6) on emoji objects |
| Unlock | Same taps among decoys; large mobile tap targets |
| Vault | A few demo accounts; Lock button |
| Skins | Playful (default) + Terminal toggle |
| Crypto | Web Crypto **PBKDF2** + **AES-GCM**; salt in `localStorage`; raw sequence never stored |
| Backend | None — everything stays in the browser |

Site files live in `/docs` and are served via **GitHub Pages** (`main` → `/docs`).

## Privacy note

This is a demo. Secrets never leave your device, but clearing site data wipes the vault. Not a production password manager.
