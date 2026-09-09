from __future__ import annotations
import sys
sys.dont_write_bytecode = True


import argparse
import pathlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


def make_handler() -> type[SimpleHTTPRequestHandler]:
    class QuietHandler(SimpleHTTPRequestHandler):
        def log_message(self, format: str, *args) -> None:  # pragma: no cover
            return

        def end_headers(self) -> None:
            self.send_header("Cache-Control", "no-cache")
            super().end_headers()

    return QuietHandler


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve the static site from a local folder.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--dir", default=".", help="Folder to serve")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    working_dir = pathlib.Path(args.dir).resolve()
    if not working_dir.exists():
        raise SystemExit(f"Directory does not exist: {working_dir}")

    handler = make_handler()
    with ThreadingHTTPServer((args.host, args.port), handler) as httpd:
        httpd.server_name = "academic-site"
        print(f"Serving from {working_dir} on http://{args.host}:{args.port}/")
        print("Press Ctrl+C to stop")
        pathlib.Path.cwd()
        import os
        os.chdir(working_dir)
        httpd.serve_forever()


if __name__ == "__main__":
    main()

