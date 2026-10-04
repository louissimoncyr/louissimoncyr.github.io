**Louis-Simon Cyr's personal website**

The public site is [louissimoncyr.github.io](https://louissimoncyr.github.io/). This repository is its single editable source.

**Edit the site by prompting Codex**

Open the saved Codex project named `Personal Website` and describe the change in ordinary language. For example:

> Update the About paragraph to say that I work in symplectic and algebraic geometry. Preview the result and open a draft pull request.

The repository instructions tell Codex to:

1. start from the newest GitHub version;
2. make the edit on a separate branch;
3. preserve unrelated content and the site's restrained design;
4. run the local checks and preview the page;
5. push the branch and open a draft pull request;
6. leave the public site unchanged until the pull request is explicitly merged.

You can review the pull request on GitHub, ask Codex for revisions in the same project, and tell Codex when you want it merged.

**Local preview**

Run `python app.py --host 127.0.0.1 --port 8000`, then open `http://127.0.0.1:8000/`.

Run `python scripts/check_site.py` before proposing a change. GitHub repeats this check automatically for pull requests.

**Upcoming talks from Obsidian**

Edit `~/Work/Obsidian/Website/upcoming-talks.md` in Obsidian. On this laptop, the same note also appears in the website vault at `~/Documents/website/obsidian-notes/upcoming-talks.md`; that convenience link is excluded from website Git. The note may contain one optional Markdown heading, blank lines, HTML comments, and up to 50 top-level bullet items. Links in the list must use `http`, `https`, or `mailto`. For example:

```markdown
# Upcoming talks

- [Geometry seminar](https://example.org/seminar) — October 12, 2026
- Paper: A new result in symplectic geometry
```

Treat everything in this note as public: its contents are copied to a public GitHub branch and displayed on the website.

Obsidian Git's automatic commit triggers a local post-commit hook. The hook runs `.sync/publish-website-upcoming-talks.py`, which validates the note and copies only this file into `data/upcoming-talks.md` in the dedicated worktree `~/Documents/website-upcoming-talks-sync`. That worktree tracks the public `upcoming-talks-content` branch; the publisher commits and pushes the changed file, and the website reads the raw file from that branch.

Updates normally appear within about one to six minutes of an Obsidian Git commit, including the public-file cache. Synchronization runs only while Obsidian and this laptop are online. The publisher always uses the committed note, never an in-progress draft. To retry a failed automatic sync of the latest committed version, run:

```bash
python ~/Work/Obsidian/.sync/publish-website-upcoming-talks.py
```

The website's code and the public list stay separate: normal website changes go through pull requests in the default branch, while the local publisher is allowed to update only `data/upcoming-talks.md` on `upcoming-talks-content`.

If a publish fails, the hook shows a desktop notification and writes details to `~/Work/Obsidian/.git/website-upcoming-talks.log`.

**Repository layout**

- `index.html` contains the page content and structure.
- `styles.css` controls the visual design.
- `app.js` renders the arXiv tracker.
- `assets/` contains images and PDFs.
- `data/` contains tracker data.
- `data/cumulative_counts.json` contains January-through-month totals from 2015 onward. The daily arXiv workflow regenerates it from completed months, and the site uses its cutoff to choose the latest available month.
- `data/old_august_2026_tracker.json` is the frozen data for the **old august 2026 tracker**. The “See the previous tracker” link shows that version on the homepage; keep this snapshot unchanged when refreshing current data.
- `data/upcoming-talks.md` is the public, generated copy of the Obsidian list.
- `scripts/check_upcoming_talks.py` validates that generated Markdown before publishing.
- `scripts/update_symplectic_stats.py` refreshes the tracker data.

Use this repository—not a separate website folder—as the source of the public site.
