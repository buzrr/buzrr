# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Instead, report them privately via
[GitHub's private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
(the **Security → Report a vulnerability** tab on this repository), or email the
maintainer directly at <ansarialan31@gmail.com>.

Please include:

- a description of the vulnerability and its impact,
- steps to reproduce (a proof of concept if possible),
- affected version/commit.

We aim to acknowledge reports within a few business days and will keep you
updated on the fix. Please give us a reasonable window to address the issue
before any public disclosure.

## Handling secrets

- All `.env*` files are gitignored — **never commit real credentials.**
- If a secret is ever exposed (in a commit, log, or issue), **rotate it
  immediately**: Google OAuth client secret, `BETTER_AUTH_SECRET`, database
  passwords, `GEMINI_API_KEY`, Cloudinary keys, and Upstash tokens.
- Production secrets belong in your host's environment settings (Vercel, Render,
  etc.), not in the repository.

## Supported versions

This project is under active development; only the latest `main` receives
security fixes.
