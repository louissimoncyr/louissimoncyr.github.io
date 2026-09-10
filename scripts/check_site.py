from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
IGNORED_PARTS = {".git", ".codex-backups", ".site-preview", ".venv", "outputs"}
CSS_URL = re.compile(r"url\(\s*(['\"]?)(.*?)\1\s*\)", re.IGNORECASE)
JS_LOCAL_ASSET = re.compile(r"['\"]((?:\.?\.?/)?(?:assets|data)/[^'\"?#]+(?:\?[^'\"#]*)?(?:#[^'\"]*)?)['\"]")


class PageParser(HTMLParser):
    def __init__(self, source: Path) -> None:
        super().__init__(convert_charrefs=True)
        self.source = source
        self.ids: set[str] = set()
        self.duplicate_ids: list[tuple[int, str]] = []
        self.references: list[tuple[int, str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        element_id = values.get("id")
        if element_id:
            if element_id in self.ids:
                self.duplicate_ids.append((self.getpos()[0], element_id))
            else:
                self.ids.add(element_id)
        for attribute in ("href", "src"):
            value = values.get(attribute)
            if value:
                self.references.append((self.getpos()[0], attribute, value))
        srcset = values.get("srcset")
        if srcset:
            for candidate in re.split(r",\s+", srcset):
                value = candidate.strip().split(maxsplit=1)[0]
                if value:
                    self.references.append((self.getpos()[0], "srcset", value))


def is_ignored(path: Path) -> bool:
    return any(part in IGNORED_PARTS for part in path.relative_to(ROOT).parts)


def local_target(source: Path, reference: str) -> tuple[Path | None, str]:
    parsed = urlsplit(reference)
    if parsed.scheme or parsed.netloc:
        return None, ""

    raw_path = unquote(parsed.path)
    if not raw_path:
        return source, unquote(parsed.fragment)

    if raw_path.startswith("/"):
        target = ROOT / raw_path.lstrip("/")
    else:
        target = source.parent / raw_path

    target = target.resolve()
    try:
        target.relative_to(ROOT)
    except ValueError:
        return target, unquote(parsed.fragment)

    if target.is_dir():
        target = target / "index.html"
    return target, unquote(parsed.fragment)


def check_reference(
    source: Path,
    line: int,
    label: str,
    reference: str,
    page_ids: dict[Path, set[str]],
) -> list[str]:
    if urlsplit(reference).scheme.lower() == "javascript":
        location = f"{source.relative_to(ROOT)}:{line}"
        return [f"{location}: unsafe javascript URL in {label}"]

    target, fragment = local_target(source, reference)
    if target is None:
        return []

    location = f"{source.relative_to(ROOT)}:{line}"
    try:
        target.relative_to(ROOT)
    except ValueError:
        return [f"{location}: {label} leaves the repository: {reference}"]

    if not target.exists():
        return [f"{location}: missing local target for {label}: {reference}"]

    if fragment and target.suffix.lower() in {".htm", ".html"}:
        if fragment not in page_ids.get(target, set()):
            return [f"{location}: missing fragment #{fragment} in {target.relative_to(ROOT)}"]
    return []


def main() -> int:
    errors: list[str] = []
    html_files = sorted(path for path in ROOT.rglob("*.html") if not is_ignored(path))
    parsers: dict[Path, PageParser] = {}

    for path in html_files:
        parser = PageParser(path)
        try:
            parser.feed(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeError) as exc:
            errors.append(f"{path.relative_to(ROOT)}: cannot read HTML: {exc}")
            continue
        for line, element_id in parser.duplicate_ids:
            errors.append(f"{path.relative_to(ROOT)}:{line}: duplicate id: {element_id}")
        parsers[path.resolve()] = parser

    page_ids = {path: parser.ids for path, parser in parsers.items()}
    for path, parser in parsers.items():
        for line, attribute, reference in parser.references:
            errors.extend(check_reference(path, line, attribute, reference, page_ids))

    for css_path in sorted(path for path in ROOT.rglob("*.css") if not is_ignored(path)):
        css_text = css_path.read_text(encoding="utf-8")
        for match in CSS_URL.finditer(css_text):
            reference = match.group(2).strip()
            line = css_text.count("\n", 0, match.start()) + 1
            errors.extend(check_reference(css_path, line, "CSS url", reference, page_ids))

    for js_path in sorted(path for path in ROOT.rglob("*.js") if not is_ignored(path)):
        js_text = js_path.read_text(encoding="utf-8")
        for match in JS_LOCAL_ASSET.finditer(js_text):
            line = js_text.count("\n", 0, match.start()) + 1
            errors.extend(check_reference(js_path, line, "JavaScript asset", match.group(1), page_ids))

    json_files = sorted(path for path in (ROOT / "data").rglob("*.json") if not is_ignored(path))
    for path in json_files:
        try:
            with path.open(encoding="utf-8") as handle:
                json.load(handle)
        except (OSError, UnicodeError, json.JSONDecodeError) as exc:
            errors.append(f"{path.relative_to(ROOT)}: invalid JSON: {exc}")

    if errors:
        print("Site check failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Site check passed: {len(html_files)} HTML page(s), {len(json_files)} JSON file(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
