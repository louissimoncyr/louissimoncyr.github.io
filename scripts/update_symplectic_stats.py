#!/usr/bin/env python3
"""Refresh first-version math.SG counts for the static tracker."""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

API = "https://export.arxiv.org/api/query"
ROOT = Path(__file__).resolve().parents[1]
PAPERS_PATH = ROOT / "data" / "papers.csv"
OUTPUT_PATH = ROOT / "data" / "weekly_counts.json"
ATOM = {
    "atom": "http://www.w3.org/2005/Atom",
    "opensearch": "http://a9.com/-/spec/opensearch/1.1/",
}
USER_AGENT = "symplectic-arxiv-census/1.0 (academic statistics project)"


def request_page(search_query: str, start: int, page_size: int) -> tuple[list[dict[str, str]], int]:
    params = urllib.parse.urlencode({
        "search_query": search_query,
        "start": start,
        "max_results": page_size,
        "sortBy": "submittedDate",
        "sortOrder": "ascending",
    })
    request = urllib.request.Request(f"{API}?{params}", headers={"User-Agent": USER_AGENT})
    root = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                root = ET.fromstring(response.read())
            break
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
            if attempt == 3:
                raise RuntimeError(f"Could not fetch arXiv data: {exc}") from exc
            delay = 6 * (attempt + 1)
            print(f"arXiv request failed; retrying in {delay} seconds")
            time.sleep(delay)

    if root is None:
        raise RuntimeError("arXiv returned no response")

    total = int(root.findtext("opensearch:totalResults", "0", ATOM))
    rows = []
    for entry in root.findall("atom:entry", ATOM):
        identifier = entry.findtext("atom:id", "", ATOM).rsplit("/", 1)[-1]
        identifier = identifier.split("v", 1)[0] if "v" in identifier else identifier
        rows.append({
            "id": identifier,
            "published": entry.findtext("atom:published", "", ATOM)[:10],
            "title": " ".join(entry.findtext("atom:title", "", ATOM).split()),
            "categories": " ".join(node.attrib["term"] for node in entry.findall("atom:category", ATOM)),
        })
    return rows, total


def fetch(search_query: str, page_size: int = 500) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    start = 0
    total = None
    while total is None or start < total:
        page, total = request_page(search_query, start, page_size)
        if not page:
            break
        rows.extend(page)
        start += len(page)
        print(f"Fetched {min(start, total):,} of {total:,}")
        if start < total:
            time.sleep(3)
    return rows


def bootstrap_by_year(papers: dict[str, dict[str, str]]) -> dict[str, dict[str, str]]:
    """Avoid the arXiv deep-pagination limit and save a checkpoint after each year."""
    current_year = dt.datetime.now(dt.timezone.utc).year
    for year in range(1991, current_year + 1):
        start = f"{year}01010000"
        end = f"{year}12312359"
        print(f"Fetching {year}")
        rows = fetch(f"cat:math.SG AND submittedDate:[{start} TO {end}]")
        papers.update({row["id"]: row for row in rows})
        write_papers(papers)
    return papers


def load_existing() -> dict[str, dict[str, str]]:
    if not PAPERS_PATH.exists():
        return {}
    with PAPERS_PATH.open(encoding="utf-8", newline="") as handle:
        return {row["id"]: row for row in csv.DictReader(handle)}


def write_papers(papers: dict[str, dict[str, str]]) -> None:
    PAPERS_PATH.parent.mkdir(parents=True, exist_ok=True)
    rows = sorted(papers.values(), key=lambda row: (row["published"], row["id"]))
    with PAPERS_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["id", "published", "title", "categories"])
        writer.writeheader()
        writer.writerows(rows)


def complete_monday(today: dt.date) -> dt.date:
    this_monday = today - dt.timedelta(days=today.weekday())
    return this_monday - dt.timedelta(days=7)


def last_completed_month(today: dt.date) -> dt.date:
    return today.replace(day=1) - dt.timedelta(days=1)


def write_statistics(papers: dict[str, dict[str, str]], output_path: Path) -> None:
    dates = [dt.date.fromisoformat(row["published"]) for row in papers.values() if row.get("published")]
    if not dates:
        raise RuntimeError("No papers found")

    today = dt.datetime.now(dt.timezone.utc).date()
    first_date = min(dates)
    first_week = first_date - dt.timedelta(days=first_date.weekday())
    last_week = complete_monday(today)
    weekly_counts: dict[dt.date, int] = {}
    for date in dates:
        week = date - dt.timedelta(days=date.weekday())
        if week <= last_week:
            weekly_counts[week] = weekly_counts.get(week, 0) + 1

    weeks = []
    cursor = first_week
    while cursor <= last_week:
        weeks.append({"week": cursor.isoformat(), "count": weekly_counts.get(cursor, 0)})
        cursor += dt.timedelta(days=7)

    final_month = last_completed_month(today)
    first_month = first_date.replace(day=1)
    monthly_counts: dict[dt.date, int] = {}
    for date in dates:
        month = date.replace(day=1)
        if month <= final_month:
            monthly_counts[month] = monthly_counts.get(month, 0) + 1

    months = []
    cursor = first_month
    while cursor <= final_month:
        months.append({"month": cursor.strftime("%Y-%m"), "count": monthly_counts.get(cursor, 0)})
        if cursor.month == 12:
            cursor = cursor.replace(year=cursor.year + 1, month=1)
        else:
            cursor = cursor.replace(month=cursor.month + 1)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated": dt.datetime.now(dt.timezone.utc).isoformat(),
        "last_published": max(dates).isoformat(),
        "weeks": weeks,
        "months": months,
    }
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bootstrap", action="store_true", help="Fetch the complete math.SG history")
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH, help="Output JSON path")
    args = parser.parse_args()

    papers = load_existing()
    if args.bootstrap or not papers:
        papers = bootstrap_by_year(papers)
    else:
        start = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=21)
        end = dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=1)
        date_range = f"submittedDate:[{start:%Y%m%d%H%M} TO {end:%Y%m%d%H%M}]"
        new_rows = fetch(f"cat:math.SG AND {date_range}")
        papers.update({row["id"]: row for row in new_rows})

    write_papers(papers)
    write_statistics(papers, args.output)
    print(f"Stored {len(papers):,} unique math.SG papers")


if __name__ == "__main__":
    main()
