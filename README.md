# Louis-Simon Cyr website (GitHub Pages compatible)

This is a reset static website in `L:\website` using
- HTML, CSS, and JavaScript for all pages
- optional Python server for local testing
- optional Python updater for `data/weekly_counts.json`

## Run locally

From PowerShell:

```powershell
cd L:\website
python app.py --host 127.0.0.1 --port 8000
```

Then open <http://127.0.0.1:8000/>.

## Files

- `index.html` main page
- `styles.css` site styling
- `app.js` interactive behavior and chart rendering
- `app.py` local preview server
- `scripts/update_symplectic_stats.py` fetches arXiv data for math.SG
- `data/weekly_counts.json` cached tracker data

## Update arXiv data

```powershell
cd L:\website
python scripts/update_symplectic_stats.py
```

Commit the changed `data/weekly_counts.json` and push to GitHub when you want updates visible online.

## Automatic refresh after publishing

The included GitHub Actions workflow runs daily. It downloads recent `math.SG` records, preserves the full paper history in `data/papers.csv`, regenerates both weekly and monthly counts in `data/weekly_counts.json`, and commits changed data automatically. The page itself automatically selects the most recently completed calendar month for the same-month comparison.

## GitHub Pages

All pages are static and use only relative links, so they are safe to host on GitHub Pages.
If you publish later:

1. create/confirm a repo
2. put these files in the repo root
3. set GitHub Pages source to the branch root

`app.py` and local commands are for local preview only.
