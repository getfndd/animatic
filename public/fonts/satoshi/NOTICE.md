# Satoshi

**Designer:** Deni Anggara
**Foundry:** Indian Type Foundry (ITF)
**Distributed by:** [Fontshare](https://www.fontshare.com/fonts/satoshi)

Vendored copies of Satoshi at 400 / 500 / 700 / 900 weights in WOFF2.
Source files fetched from Fontshare's CDN on 2026-04-18.

## License

Satoshi is distributed under the [Fontshare License](https://www.fontshare.com/terms), which permits unrestricted use in personal, commercial, and non-commercial work without attribution or payment. These font files are redistributed under the same terms.

## Why vendored

Previously the animation pipeline loaded Satoshi via Fontshare's CDN at render time. On poor connectivity (or offline renders) fonts would silently fall back to system defaults, corrupting brand finish. Vendoring makes renders deterministic regardless of network state.

See ANI-115 for context.
