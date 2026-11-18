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
# Das Hauptspiel bleibt technisch kompatibel, zeigt aber den neuen Projektnamen.
html=html.replace("LEITSTELLE DEUTSCHLAND · 0.22","FUNKSPRUCH · 0.24")
html=html.replace("LEITSTELLE DEUTSCHLAND","FUNKSPRUCH")
for name in ("firstperson_v22.js","manifest.webmanifest","workstation.js"):
    if name in files:
        source=files[name].decode("utf-8")
        source=source.replace("LEITSTELLE DEUTSCHLAND","FUNKSPRUCH").replace("Leitstelle Deutschland","FUNKSPRUCH")
        files[name]=source.encode("utf-8")
files["index.html"]=html.encode("utf-8")
files["ai_dispatch_v23.js"]=module
if "funkspruch_embed.js" not in html:
    assert "</body></html>" in html
    html=html.replace("</body></html>",'<script src="./funkspruch_embed.js"></script></body></html>')
    files["index.html"]=html.encode("utf-8")
files["funkspruch_embed.js"]=embed
# Die alte Kartendarstellung rechnete gelegentlich mit undefinierten Einsatzoffsets
# und übergab NaN-Koordinaten an Leaflet. Nur valide Geopunkte zeichnen.
old_marker=("let c=i.coords||window.LDCityCoords?.[i.city]||cities[i.city]||g.areas[area].center;"
            "let lat=c[0]+(i.x-50)*.00025,lon=c[1]+(i.y-50)*.00035;"
            "L.circleMarker([lat,lon],")
new_marker=("let c=i.coords||window.LDCityCoords?.[i.city]||cities[i.city]||g.areas[area].center;"
            "let x=Number.isFinite(i.x)?i.x:50,y=Number.isFinite(i.y)?i.y:50;"
            "let lat=Number(c?.[0])+(x-50)*.00025,lon=Number(c?.[1])+(y-50)*.00035;"
            "if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)continue;"
            "L.circleMarker([lat,lon],")
world=files["world.js"].decode("utf-8")
if old_marker in world:
    world=world.replace(old_marker,new_marker)
    files["world.js"]=world.encode("utf-8")
else:
    assert new_marker in world, "Geprüfte Karteninitialisierung fehlt im Hauptspiel"
# Legacy map.js/world.js used unvalidated incident coordinates and could pass NaN to Leaflet.
# Preserve all valid incidents; skip only features with no usable latitude/longitude.
if "world.js" in files:
    js=files["world.js"].decode("utf-8")
    old="let lat=c[0]+(i.x-50)*.00025,lon=c[1]+(i.y-50)*.00035;L.circleMarker([lat,lon]"
    new=("let p=Array.isArray(c)?c:[c?.lat??c?.latitude,c?.lon??c?.lng??c?.longitude];"
         "let lat=Number(p[0])+(Number.isFinite(i.x)?(i.x-50)*.00025:0),"
         "lon=Number(p[1])+(Number.isFinite(i.y)?(i.y-50)*.00035:0);"
         "if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)continue;"
         "L.circleMarker([lat,lon]")
    if old in js: js=js.replace(old,new)
    else: assert "Number.isFinite(lat)" in js, "Legacy map anchor not found"
    files["world.js"]=js.encode("utf-8")
sw=files["sw.js"].decode("utf-8")
sw=re.sub(r"const CACHE='[^']+'","const CACHE='funkspruch-v024-embedded-dispatch-shell'",sw)
if "'./ai_dispatch_v23.js'" not in sw:
    sw=sw.replace("'./firstperson_v22.js'","'./firstperson_v22.js','./ai_dispatch_v23.js'")
if "'./funkspruch_embed.js'" not in sw:
    assert "'./ai_dispatch_v23.js'" in sw
    sw=sw.replace("'./ai_dispatch_v23.js'","'./ai_dispatch_v23.js','./funkspruch_embed.js'")
files["sw.js"]=sw.encode("utf-8")
files["RELEASE_V024.txt"]="FUNKSPRUCH v0.24: First Person, Leitplatz, Funk, KI, fiktive Simulation.\n".encode("utf-8")
with ZipFile(archive,"w",ZIP_DEFLATED,compresslevel=7) as z:
    for name,data in sorted(files.items()):
        z.writestr(name,data)
with ZipFile(archive) as z:
    assert z.testzip() is None
    assert z.read("index.html").count(b"ai_dispatch_v23.js")==1
    assert b"ai_dispatch_v23.js" in z.read("sw.js")
    assert b"Number.isFinite(lat)" in z.read("world.js")
    assert b"FUNKSPRUCH" in z.read("index.html")
    assert z.read("index.html").count(b"funkspruch_embed.js")==1
    assert b"funkspruch_embed.js" in z.read("sw.js")
    assert new_marker.encode("utf-8") in z.read("world.js")
print("FUNKSPRUCH 0.24 verpackt und geprüft.")
