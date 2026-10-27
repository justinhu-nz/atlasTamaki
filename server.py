#!/usr/bin/env python3
"""Local server for Atlas Tāmaki: serves the site and lets editor.html save.

    python3 server.py [port]        (default 8765)

Only listens on 127.0.0.1. Besides serving files it accepts:
  PUT /ideas.js           replaces ideas.js (the previous version is kept as ideas.js.bak)
  PUT /images/<name>      adds an image to images/; replies with the path it was saved as
The published site is just the static files, so none of this is needed to host it.
"""
import http.server, json, os, re, shutil, sys, urllib.parse

ROOT = os.path.dirname(os.path.abspath(__file__))
MAX_IMAGE = 15 * 1024 * 1024


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")   # so a reload always shows the latest save
        super().end_headers()

    def reply(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/__editor":
            return self.reply(200, {"ok": True})
        super().do_GET()

    def do_PUT(self):
        length = int(self.headers.get("Content-Length", 0))
        if self.path == "/ideas.js":
            body = self.rfile.read(length)
            if not body.lstrip().startswith(b"//") and b"window.ATLAS" not in body:
                return self.reply(400, {"error": "not an ideas.js file"})
            target = os.path.join(ROOT, "ideas.js")
            if os.path.exists(target):
                shutil.copyfile(target, target + ".bak")
            with open(target, "wb") as f:
                f.write(body)
            return self.reply(200, {"path": "ideas.js"})

        m = re.fullmatch(r"/images/([^/]+)", self.path)
        if m:
            if length > MAX_IMAGE:
                return self.reply(413, {"error": "image over 15 MB"})
            name = re.sub(r"[^\w.-]+", "-", os.path.basename(urllib.parse.unquote(m.group(1)))).strip("-.") or "image"
            stem, ext = os.path.splitext(name)
            if ext.lower() not in (".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"):
                return self.reply(400, {"error": "not an image file"})
            os.makedirs(os.path.join(ROOT, "images"), exist_ok=True)
            # Never overwrite an existing image: add -2, -3 ... instead.
            n, final = 1, name
            while os.path.exists(os.path.join(ROOT, "images", final)):
                n += 1
                final = f"{stem}-{n}{ext}"
            with open(os.path.join(ROOT, "images", final), "wb") as f:
                f.write(self.rfile.read(length))
            return self.reply(200, {"path": "images/" + final})

        self.reply(404, {"error": "can only save ideas.js or images/"})


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    print(f"Atlas Tāmaki on http://localhost:{port}  (editor: /editor.html)")
    http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
