# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1.0 | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in Hostella, please **do not** open a public GitHub issue.

Instead, report it privately via one of the following channels:

- **Telegram:** [@gulomovff](https://t.me/gulomovff)
- **Email:** *(добавьте при необходимости)*

Please include in your report:
- A clear description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Any suggested fix (optional)

We will acknowledge receipt within **48 hours** and aim to release a fix within **7 days** for critical issues.

## Security Considerations

### Authentication
- Admin access is protected via Firebase Authentication
- Admin passwords are hashed and stored in Firestore
- Session tokens are managed by Firebase SDK

### Data Storage
- All guest data is stored in **Google Firestore** with project-level access control
- The app is a desktop (Electron) application — no public-facing API endpoints
- Telegram Bot token is stored exclusively in **Firebase Cloud Functions environment config**, never in client-side code

### Cloud Functions
- `sendTelegramMessage` — validates input, reads recipient list from Firestore
- `verifyAdminPassword` — rate limiting is handled by Firebase
- `scanPassport` — processes images server-side, no data is retained after response

### Electron Security
- `nodeIntegration` is **disabled**
- `contextIsolation` is **enabled**
- All IPC communication goes through a typed `preload.js` bridge
- External navigation is blocked

### Dependency Updates
We follow Electron and Firebase release notes and apply security patches on each release cycle.
