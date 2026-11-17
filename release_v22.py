from pathlib import Path
import zipfile,re
root=Path(__file__).parent
z=root/"LEITSTELLE_DEUTSCHLAND_v0_21.zip"
with zipfile.ZipFile(z) as f:
    files={x.filename:f.read(x.filename) for x in f.infolist() if not x.is_dir()}
module=(root/"firstperson_v22.js").read_bytes()
assert "index.html" in files and "sw.js" in files and len(module)>5000
html=files["index.html"].decode("utf-8")
html=html.replace("</body></html>",'<script src="./firstperson_v22.js"></script></body></html>') if "firstperson_v22.js" not in html else html
html=html.replace("LEITSTELLE DEUTSCHLAND · 0.21","LEITSTELLE DEUTSCHLAND · 0.22").replace("FIRST-PERSON DISPATCH SIMULATION","EGO-LEITSTELLENSIMULATION").replace("Entwicklungsfassung 0.20","Entwicklungsfassung 0.22")
files["index.html"]=html.encode("utf-8")
files["firstperson_v22.js"]=module
sw=files["sw.js"].decode("utf-8")
sw=re.sub(r"const CACHE='[^']+'","const CACHE='leitstelle-v022-ego-shell'",sw)
if "firstperson_v22.js" not in sw:
    sw=sw.replace("'./index.html'","'./index.html','./firstperson_v22.js'")
sw=sw.replace("caches.match('./index.html','./firstperson_v22.js')","caches.match('./index.html')")
files["sw.js"]=sw.encode("utf-8")
if "manifest.webmanifest" in files:
    m=files["manifest.webmanifest"].decode("utf-8").replace("First-Person-Leitstellensimulator","Leitstellensimulator in Ego-Perspektive")
    files["manifest.webmanifest"]=m.encode("utf-8")
if "workstation.js" in files:
    w=files["workstation.js"].decode("utf-8").replace("Ctrl+1/2/3","Strg+1/2/3").replace("Headset / Stimme","Sprechgarnitur / Stimme").replace("Live-Lageentwicklung","Dynamische Lageentwicklung")
    files["workstation.js"]=w.encode("utf-8")
with zipfile.ZipFile(z,"w",compression=zipfile.ZIP_DEFLATED,compresslevel=7) as out:
    for name,content in sorted(files.items()):out.writestr(name,content)
with zipfile.ZipFile(z) as f:
    assert f.testzip() is None
    assert f.read("index.html").count(b"firstperson_v22.js")==1
print("Spielpaket v0.22 aktualisiert.")
