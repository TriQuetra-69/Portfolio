"""Tiny static server for the portfolio (threaded, no-cache, correct MIME types)."""
import http.server, socketserver, os, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "application/javascript", ".css": "text/css", ".woff2": "font/woff2",
        ".svg": "image/svg+xml", ".pdf": "application/pdf", ".html": "text/html; charset=utf-8",
    }
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

print(f"Serving portfolio on http://0.0.0.0:{PORT}", flush=True)
Server(("0.0.0.0", PORT), Handler).serve_forever()
