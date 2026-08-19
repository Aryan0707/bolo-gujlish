#!/usr/bin/env python3
"""
Bundle the project into single self-contained files.

    python3 build.py

Writes:
  dist/gujlish.html          complete standalone page — double-click to open
  dist/artifact-fragment.html same content minus the <!doctype>/<html>/<head>/<body>
                              wrapper, which is what the Artifact publisher expects

Nothing here touches the source files; edit app.js / styles.css / index.html
and re-run.
"""

import pathlib
import re

HERE = pathlib.Path(__file__).parent
DIST = HERE / "dist"


def read(name: str) -> str:
    return (HERE / name).read_text(encoding="utf-8")


def build_body() -> str:
    """The page content: title, inlined CSS, markup, inlined JS."""
    shell = read("index.html")

    # keep only what sits between <body> and </body>
    m = re.search(r"<body>(.*)</body>", shell, re.S | re.I)
    if not m:
        raise SystemExit("index.html: could not find a <body> block")
    markup = m.group(1)

    # drop the external <script src=...> tags; we inline them below
    markup = re.sub(r'\s*<script src="[^"]+"></script>', "", markup).strip()

    return "\n".join([
        "<title>Bolo Gujlish</title>",
        "",
        "<style>",
        read("styles.css").strip(),
        "</style>",
        "",
        markup,
        "",
        "<script>",
        read("app.js").strip(),
        "</script>",
        "",
    ])


def main() -> None:
    DIST.mkdir(exist_ok=True)
    body = build_body()

    fragment = DIST / "artifact-fragment.html"
    fragment.write_text(body, encoding="utf-8")

    standalone = DIST / "gujlish.html"
    standalone.write_text(
        "<!doctype html>\n<html lang=\"en\">\n<head>\n"
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + read("head-extras.html")
        + body.replace("<title>Bolo Gujlish</title>\n\n", "<title>Bolo Gujlish</title>\n</head>\n<body>\n", 1)
        + "</body>\n</html>\n",
        encoding="utf-8",
    )

    for f in (standalone, fragment):
        print(f"{f.relative_to(HERE)}  {f.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
