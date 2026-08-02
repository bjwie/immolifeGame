# Eigene Möbel-Modelle

Hier hinein kommen selbst gebaute `.glb`-Dateien. Eine Datei überschreibt das
prozedurale Möbelstück gleichen Namens aus `src/v2/three/kit.ts` — ohne
Code-Änderung, genau wie die Gebäude-PNGs in `assets/v2/buildings/`.

## Erkannte Namen

sofa · couchTable · shelf · bed · wardrobe · kitchenRun · fridge · bathtub
basin · toilet · mirror · desk · chair · radiator · ceilingLamp · doorLeaf
boiler · meterBoard · cartonBox

Also z. B. `sofa.glb`.

## Regeln fürs Modellieren (Blender)

- **Einheit Meter**, Y nach oben, Z nach vorn (das Möbel schaut nach +Z)
- **Ursprung auf dem Boden**, mittig auf der Standfläche
- **Materialien ins glb backen** — die Palette aus `kit.ts` wird auf Modelle
  nicht angewendet
- Realistische Maße: eine Couch ist ~2,2 m breit, ein Bett 2,05 m lang
- Low-Poly halten (ein paar hundert Tris), der Rest der Stadt ist es auch

Export in Blender: *File → Export → glTF 2.0 (.glb)*, Format **glTF Binary**,
"+Y Up" aktiviert, unter *Include* nur "Selected Objects".

Fehlt eine Datei, passiert nichts — dann zeichnet der Baukasten das Möbel.
