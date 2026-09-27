#!/usr/bin/env python3
"""Validate the small Markdown feed used for the upcoming-talks list."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit


MAX_BYTES = 32 * 1024
MAX_ITEMS = 50
ALLOWED_LINK_SCHEMES = {"http", "https", "mailto"}

HEADING = re.compile(r"^#{1,6}[ \t]+(?P<title>.+?)[ \t]*$")
INLINE_LINK = re.compile(r"\[([^\]]+)]\((?P<destination>[^)]+)\)")


def _without_html_comments(text: str) -> tuple[str, list[str]]:
    """Remove HTML comments while preserving newlines and line numbers."""

    pieces: list[str] = []
    cursor = 0
    while True:
        start = text.find("<!--", cursor)
        if start == -1:
            pieces.append(text[cursor:])
            return "".join(pieces), []

        pieces.append(text[cursor:start])
        end = text.find("-->", start + 4)
        if end == -1:
            line = text.count("\n", 0, start) + 1
            return text, [f"line {line}: unclosed HTML comment"]

        comment = text[start : end + 3]
        pieces.append("".join("\n" if character == "\n" else " " for character in comment))
        cursor = end + 3


def _link_error(destination: str) -> str | None:
    destination = destination.strip()
    if not destination:
        return "Markdown links must have a destination"
    if any(ord(character) < 32 or ord(character) == 127 for character in destination):
        return "Markdown link destinations cannot contain control characters"

    try:
        scheme = urlsplit(destination).scheme.lower()
    except ValueError as exc:
        return f"invalid Markdown link destination: {exc}"
    if scheme not in ALLOWED_LINK_SCHEMES:
        allowed = ", ".join(sorted(ALLOWED_LINK_SCHEMES))
        return f"link protocol must be one of {allowed}: {destination}"
    return None


def validate_upcoming_talks(path: Path) -> list[str]:
    """Return human-readable validation errors for *path*."""

    try:
        size = path.stat().st_size
    except OSError as exc:
        return [f"cannot read file: {exc}"]

    if size > MAX_BYTES:
        return [f"file is {size} bytes; maximum is {MAX_BYTES} bytes"]

    try:
        raw = path.read_bytes()
    except OSError as exc:
        return [f"cannot read file: {exc}"]

    if len(raw) > MAX_BYTES:
        return [f"file is {len(raw)} bytes; maximum is {MAX_BYTES} bytes"]

    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        return [f"file is not valid UTF-8: {exc}"]

    if text.startswith("\ufeff"):
        text = text.removeprefix("\ufeff")

    text, comment_errors = _without_html_comments(text)
    if comment_errors:
        return comment_errors

    errors: list[str] = []
    heading_count = 0
    item_count = 0

    for line_number, line in enumerate(text.split("\n"), start=1):
        # Match the browser parser: accept LF and CRLF, but not embedded/lone CRs.
        line = line.removesuffix("\r")
        if "\r" in line:
            errors.append(f"line {line_number}: unsupported carriage return")
            continue
        if not line.strip():
            continue

        heading_match = HEADING.fullmatch(line)
        if heading_match:
            title = re.sub(r"[ \t]+#+[ \t]*$", "", heading_match.group("title")).strip()
            if not title:
                errors.append(f"line {line_number}: heading cannot be empty")
            heading_count += 1
            if heading_count > 1:
                errors.append(f"line {line_number}: only one Markdown heading is allowed")
            continue

        bullet = re.fullmatch(r"[-*+][ \t]+(?P<item>.*)", line)
        if not bullet:
            errors.append(
                f"line {line_number}: expected a top-level Markdown bullet such as '- Talk title'"
            )
            continue

        item = bullet.group("item").strip()
        if not item:
            errors.append(f"line {line_number}: bullet item cannot be empty")
            continue

        item_count += 1
        for match in INLINE_LINK.finditer(item):
            destination = match.group("destination")
            error = _link_error(destination)
            if error:
                errors.append(f"line {line_number}: {error}")

    if item_count > MAX_ITEMS:
        errors.append(f"list has {item_count} items; maximum is {MAX_ITEMS}")

    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "path",
        nargs="?",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "upcoming-talks.md",
        help="Markdown file to validate (default: data/upcoming-talks.md)",
    )
    arguments = parser.parse_args(argv)
    errors = validate_upcoming_talks(arguments.path)

    if errors:
        print(f"Upcoming-talks validation failed for {arguments.path}:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Upcoming-talks validation passed: {arguments.path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
