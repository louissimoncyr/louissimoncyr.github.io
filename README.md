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

**Repository layout**

- `index.html` contains the page content and structure.
- `styles.css` controls the visual design.
- `app.js` renders the arXiv tracker.
- `assets/` contains images and PDFs.
- `data/` contains tracker data.
- `scripts/update_symplectic_stats.py` refreshes the tracker data.

Use this repository—not a separate website folder—as the source of the public site.
