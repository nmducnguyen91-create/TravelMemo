"""Build compact offline geography from Natural Earth (public domain).

Usage: python3 -I tools/geo/build_geo.py <ne_10m_admin_0_countries_vnm.geojson> <ne_10m_admin_1_states_provinces.geojson>
Writes assets/geography/world.json and assets/geography/vietnam.json.
Geometry is simplified (Douglas-Peucker) and quantized; original source files are not shipped.
"""
import json
import math
import os
import sys

NE_VERSION = "5.2.0"
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "geography")


def perp(p, a, b):
    (x, y), (x1, y1), (x2, y2) = p, a, b
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(x - x1, y - y1)
    t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
    return math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))


def dp(points, tol):
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        s, e = stack.pop()
        best, idx = 0.0, -1
        for i in range(s + 1, e):
            d = perp(points[i], points[s], points[e])
            if d > best:
                best, idx = d, i
        if best > tol and idx > 0:
            keep[idx] = True
            stack += [(s, idx), (idx, e)]
    return [p for p, k in zip(points, keep) if k]


def area(ring):
    return abs(sum(ring[i][0] * ring[i - 1][1] - ring[i - 1][0] * ring[i][1] for i in range(len(ring)))) / 2


def polygons(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"]]
    if geom["type"] == "MultiPolygon":
        return geom["coordinates"]
    return []


def simplify(geom, tol, min_area, digits):
    polys = []
    for poly in polygons(geom):
        outer = poly[0]
        if area(outer) < min_area:
            continue
        rings = []
        for i, ring in enumerate(poly):
            r = dp(ring, tol)
            if len(r) < 4 and i == 0:
                r = ring  # tiny island: keep it unsimplified rather than lose it
            if len(r) >= 4:
                rings.append([[round(x, digits), round(y, digits)] for x, y in r[:-1]])
        if rings:
            polys.append(rings)
    if not polys:  # never drop a whole feature (small island states)
        biggest = max(polygons(geom), key=lambda p: area(p[0]))
        polys = [[[[round(x, digits), round(y, digits)] for x, y in biggest[0][:-1]]]]
    return polys


def bbox(polys):
    xs = [p[0] for poly in polys for ring in poly for p in ring]
    ys = [p[1] for poly in polys for ring in poly for p in ring]
    return [min(xs), min(ys), max(xs), max(ys)]


def main(countries_path, admin1_path):
    countries = json.load(open(countries_path, encoding="utf-8"))
    world = []
    for f in countries["features"]:
        p = f["properties"]
        code = p["ISO_A3"] if p["ISO_A3"] not in ("-99", None) else p["ADM0_A3"]
        if code == "ATA":
            continue
        # Keep every Vietnamese island polygon (Hoàng Sa, Trường Sa) regardless of size.
        polys = simplify(f["geometry"], 0.08, 0 if code == "VNM" else 0.02, 2)
        world.append({
            "code": code,
            "name": p["NAME_EN"] or p["NAME"],
            "nameVi": p.get("NAME_VI") or p["NAME"],
            "continent": p["CONTINENT"],
            "bbox": bbox(polys),
            "polygons": polys,
        })
    world.sort(key=lambda r: r["code"])
    seen = set()
    world = [r for r in world if not (r["code"] in seen or seen.add(r["code"]))]

    admin1 = json.load(open(admin1_path, encoding="utf-8"))
    vn = []
    for f in admin1["features"]:
        p = f["properties"]
        if p["adm0_a3"] != "VNM":
            continue
        polys = simplify(f["geometry"], 0.008, 0.0005, 3)
        vn.append({
            "code": p["iso_3166_2"],
            "name": p["name_en"] or p["name"],
            "nameVi": p.get("name_vi") or p["name"],
            "bbox": bbox(polys),
            "polygons": polys,
        })
    vn.sort(key=lambda r: r["code"])

    meta = {
        "source": "Natural Earth",
        "license": "Public domain (naturalearthdata.com/about/terms-of-use)",
        "sourceVersion": NE_VERSION,
    }
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "world.json"), "w", encoding="utf-8") as fh:
        json.dump({**meta, "datasetVersion": f"ne-{NE_VERSION}-admin0-vnm-pov", "kind": "country", "regions": world}, fh, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(OUT, "vietnam.json"), "w", encoding="utf-8") as fh:
        json.dump({**meta, "datasetVersion": f"ne-{NE_VERSION}-vn-admin1-63", "kind": "vn-province", "validTo": "2025-06-30", "regions": vn}, fh, ensure_ascii=False, separators=(",", ":"))
    print(len(world), "countries;", len(vn), "provinces")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
