**Purpose**

This repository is the single editable source for `https://louissimoncyr.github.io/`. Treat this checkout as the source to edit and publish.

**Required workflow for every website request**

1. Treat `origin/main` as read-only. Never commit to or push directly to `main`.
2. Before editing, fetch `origin` and base the work on the newest `origin/main`.
3. For a new request, use a fresh branch or Codex worktree named `codex/YYYY-MM-DD-short-description`. Derive the description from the user's prompt instead of asking for a branch name. If the user asks to revise an open pull request, continue its existing branch instead of creating a duplicate pull request.
4. If unrelated changes already exist, preserve them. Isolate the requested work or stop and explain the overlap; never reset or discard the user's work.
5. Make only the requested change. Preserve the current static HTML, CSS, and JavaScript approach and the restrained academic design unless the user asks for a redesign.
6. Never commit local backups, preview output, credentials, tokens, or secrets.
7. Run `python scripts/check_site.py` after every change.
8. For visual or content changes, serve the site only on `127.0.0.1`, confirm an HTTP 200 response, and inspect the affected desktop and mobile layouts.
9. Commit the finished change, push only the feature branch, and open a draft pull request against `main`. The pull request must contain a concise summary and the checks performed.
10. Never merge the pull request or otherwise publish to `main` without an explicit user request.

**Site conventions**

- Keep the site dependency-light and compatible with GitHub Pages.
- Preserve unrelated wording, links, assets, generated data, and automation.
- Keep local links relative and verify that referenced files exist.
- Keep accessibility labels, semantic headings, keyboard navigation, and responsive behavior intact.
- Do not change repository settings, GitHub Pages settings, workflow permissions, or branch rules unless the user specifically requests that change.

**Completion standard**

A normal editing prompt is complete only when the requested change is verified locally and a draft pull request exists, or when a concrete authentication or permission blocker has been reported to the user. A local edit alone is not complete.
