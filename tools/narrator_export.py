"""Erzählersprüche für die Vertonung exportieren (Booxter).

Aufruf: python tools/narrator_export.py
Schreibt nach assets/narrator/:
  vertonung.epub   ein Kapitel pro Spruch, Kapiteltitel = ID (z. B. kampf_sieg_03), im Text steht nur der Spruch
  vertonung.txt    zur Kontrolle: ID<TAB>Text
Nur Sprüche ohne {Platzhalter}, bereits vertonte (Datei in audio/) werden übersprungen.
Danach: tools/narrator_import.py holt die fertigen Audiodateien ab.
"""
import html
import sys
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server"))
from narrator import AUDIO_EXT, Narrator  # noqa: E402

folder = ROOT / "assets" / "narrator"


def lines_to_voice():
    rows = []
    for kind, lines in Narrator(folder).all_lines().items():
        for line_id, text in lines:
            if "{" in text:
                continue
            if any((folder / "audio" / (line_id + ext)).exists() for ext in AUDIO_EXT):
                continue
            rows.append((line_id, text))
    return rows


def write_epub(rows, path):
    book_id = "urn:uuid:" + str(uuid.uuid4())
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    chapters = [(f"k{i + 1:03d}.xhtml", line_id, text) for i, (line_id, text) in enumerate(rows)]

    def xhtml(title, body):
        return ('<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n'
                '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="de">\n'
                f"<head><meta charset=\"utf-8\"/><title>{html.escape(title)}</title></head>\n<body>\n{body}\n</body>\n</html>\n")

    manifest = "\n".join(f'    <item id="c{i}" href="{f}" media-type="application/xhtml+xml"/>'
                         for i, (f, _, _) in enumerate(chapters))
    spine = "\n".join(f'    <itemref idref="c{i}"/>' for i in range(len(chapters)))
    opf = f'''<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="de">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">{book_id}</dc:identifier>
    <dc:title>Erzaehler Hoehlenspiel</dc:title>
    <dc:language>de</dc:language>
    <dc:subject>booxter:clips</dc:subject>
    <meta property="dcterms:modified">{now}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
{manifest}
  </manifest>
  <spine toc="ncx">
{spine}
  </spine>
</package>
'''
    nav_items = "\n".join(f'      <li><a href="{f}">{html.escape(i)}</a></li>' for f, i, _ in chapters)
    nav = xhtml("Inhalt", f'<nav epub:type="toc" id="toc"><h1>Inhalt</h1>\n    <ol>\n{nav_items}\n    </ol>\n</nav>')
    points = "\n".join(f'    <navPoint id="p{n}" playOrder="{n + 1}"><navLabel><text>{html.escape(i)}</text></navLabel>'
                       f'<content src="{f}"/></navPoint>' for n, (f, i, _) in enumerate(chapters))
    ncx = f'''<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="{book_id}"/></head>
  <docTitle><text>Erzaehler Hoehlenspiel</text></docTitle>
  <navMap>
{points}
  </navMap>
</ncx>
'''
    with zipfile.ZipFile(path, "w") as z:
        z.writestr(zipfile.ZipInfo("mimetype"), "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        z.writestr("META-INF/container.xml", '<?xml version="1.0" encoding="utf-8"?>\n'
                   '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">'
                   '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>'
                   '</rootfiles></container>\n', compress_type=zipfile.ZIP_DEFLATED)
        z.writestr("OEBPS/content.opf", opf, compress_type=zipfile.ZIP_DEFLATED)
        z.writestr("OEBPS/nav.xhtml", nav, compress_type=zipfile.ZIP_DEFLATED)
        z.writestr("OEBPS/toc.ncx", ncx, compress_type=zipfile.ZIP_DEFLATED)
        for f, line_id, text in chapters:
            # bewusst keine Überschrift im Text: vorgelesen wird nur der Spruch
            z.writestr("OEBPS/" + f, xhtml(line_id, f"<p>{html.escape(text)}</p>"), compress_type=zipfile.ZIP_DEFLATED)


rows = lines_to_voice()
(folder / "vertonung.txt").write_text("".join(f"{i}\t{t}\n" for i, t in rows), encoding="utf-8")
old = folder / "vertonung_kapitel.txt"
if old.exists():
    old.unlink()
write_epub(rows, folder / "vertonung.epub")
print(f"{len(rows)} Sprüche: assets/narrator/vertonung.epub (für Booxter) und vertonung.txt (zur Kontrolle)")
