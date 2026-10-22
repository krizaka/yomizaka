# Yomizaka for the Mac

Tauri 2 (Rust and a Vite page built from `@krizaka/ui` in Yomizaka's indigo, light and dark, French first). A library in a
folder of your Mac: documents stay where they are, only what a check needs is sent, then erased. Same account, same checks
and same signed PDF as the web and the phone ([ADR-005](https://github.com/krizaka/.github/blob/main/docs/adr/ADR-005-tauri-app-kit.md)).

| | |
| :-- | :-- |
| Folders | The native picker grants a folder (`krizaka-tauri-kit`'s scope: canonical paths, `..` and symlinks that leave a folder refused, the home, `/`, `~/.ssh`… never grantable) |
| Check | Pre-flight (the web's limits), upload for this one check, the Orazaka run, the plain-language note, the signed PDF saved next to the document |
| Drag and drop | A file dropped from Finder is allowed for this session only (one file, never its neighbours) |
| Session | The bearer token is in the Keychain; the page has no `fs`, no shell, no opener |
| URLs | The window's hash: `#/library/<folder>`, `#/check/<document>/<run>`, `#/settings` |

```bash
pnpm install
cd apps/desktop
pnpm check          # types, UI tests, Rust tests
pnpm tauri dev      # VITE_APP_URL=http://localhost:3000 points it at another backend
```

## Release

A `desktop-v<version>` tag builds the arm64 `.dmg` (workflow `desktop.yml`) and attaches it to the GitHub release. Until a
Developer ID Application certificate and notarisation credentials are secrets of the repository, the app is not signed:
right-click it, then Open. To sign, add the repository secrets `APPLE_CERTIFICATE` (the certificate exported as a base64
`.p12`), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_TEAM_ID`, `APPLE_API_ISSUER`, `APPLE_API_KEY` and
`APPLE_API_KEY_P8` (the App Store Connect key for notarisation); nothing in the code changes.

An unsigned debug build asks for the Keychain password at every launch: that is the missing signature, not the app.
