"""Apply v0.23 offline-call/team improvements to the Render static ZIP."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import re
root=Path(__file__).parent
archive=root/"LEITSTELLE_DEUTSCHLAND_v0_21.zip"
module=(root/"ai_dispatch_v23.js").read_bytes()
embed=(root/"funkspruch_embed.js").read_bytes()
assert len(embed)>1500
assert len(module)>18000
with ZipFile(archive) as z:
    files={name:z.read(name) for name in z.namelist() if not name.endswith("/")}
assert "index.html" in files and "sw.js" in files
html=files["index.html"].decode("utf-8")
if "ai_dispatch_v23.js" not in html:
    assert "</body></html>" in html
    html=html.replace("</body></html>",'<script src="./ai_dispatch_v23.js"></script></body></html>')
html=html.replace("LEITSTELLE DEUTSCHLAND · 0.22","LEITSTELLE DEUTSCHLAND · 0.23")
files["index.html"]=html.encode("utf-8")
files["ai_dispatch_v23.js"]=module
if "funkspruch_embed.js" not in html:
    assert "</body></html>" in html
    html=html.replace("</body></html>",'<script src="./funkspruch_embed.js"></script></body></html>')
    files["index.html"]=html.encode("utf-8")
files["funkspruch_embed.js"]=embed
sw=files["sw.js"].decode("utf-8")
sw=re.sub(r"const CACHE='[^']+'","const CACHE='leitstelle-v024-embedded-dispatch-shell'",sw)
if "'./ai_dispatch_v23.js'" not in sw:
    sw=sw.replace("'./firstperson_v22.js'","'./firstperson_v22.js','./ai_dispatch_v23.js'")
if "'./funkspruch_embed.js'" not in sw:
    assert "'./ai_dispatch_v23.js'" in sw
    sw=sw.replace("'./ai_dispatch_v23.js'","'./ai_dispatch_v23.js','./funkspruch_embed.js'")
files["sw.js"]=sw.encode("utf-8")
files["RELEASE_V023.txt"]="LEITSTELLE DEUTSCHLAND v0.23: Notruf- und Team-KI, fiktive Offline-Simulation.\n".encode("utf-8")
with ZipFile(archive,"w",ZIP_DEFLATED,compresslevel=7) as z:
    for name,data in sorted(files.items()):
        z.writestr(name,data)
with ZipFile(archive) as z:
    assert z.testzip() is None
    assert z.read("index.html").count(b"ai_dispatch_v23.js")==1
    assert b"ai_dispatch_v23.js" in z.read("sw.js")
    assert z.read("index.html").count(b"funkspruch_embed.js")==1
    assert b"funkspruch_embed.js" in z.read("sw.js")
print("Version 0.23 verpackt und geprüft.")
