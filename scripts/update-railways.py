#!/usr/bin/env python3
"""Refresh the local Auckland physical-track snapshot (no API key required).

Run from any directory: python3 scripts/update-railways.py
Use --source /path/to/download.geojson to process a previously downloaded response.
"""
import argparse
import datetime
import json
import math
from pathlib import Path
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
SERVICE = 'https://services6.arcgis.com/eqX2HMCD3H8MUs6Q/arcgis/rest/services/KiwiRailTrack/FeatureServer/0'
# AT GTFS station anchors, checked 26 October 2026. Cut through each station precinct.
SWANSON = [174.57630, -36.86618]
PUKEKOHE = [174.91015, -37.20331]
BOUNDS = [SWANSON[0], PUKEKOHE[1], 175.1, -36.80]


def segment(a, b):
    """Liang–Barsky rectangle clipping; interpolate the actual track at each cutoff."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    start, end = 0., 1.
    for p, q in [(-dx, a[0]-BOUNDS[0]), (dx, BOUNDS[2]-a[0]),
                 (-dy, a[1]-BOUNDS[1]), (dy, BOUNDS[3]-a[1])]:
        if p == 0:
            if q < 0:
                return None
        else:
            t = q / p
            if p < 0:
                start = max(start, t)
            else:
                end = min(end, t)
            if start > end:
                return None
    return [[a[0]+start*dx, a[1]+start*dy], [a[0]+end*dx, a[1]+end*dy]]


def clip(line):
    parts, part = [], []
    for a, b in zip(line, line[1:]):
        pair = segment(a, b)
        if pair and pair[0] != pair[1]:
            if part and math.dist(part[-1], pair[0]) > 1e-9:
                parts.append(part)
                part = []
            if not part:
                part.append(pair[0])
            part.append(pair[1])
        elif part:
            parts.append(part)
            part = []
    if part:
        parts.append(part)
    return parts


def simplify(line, tolerance=.6):
    """Douglas–Peucker in local metres, retaining the exact clipped endpoints."""
    points = [(x*88900, y*111320) for x, y in line]
    keep, stack = {0, len(line)-1}, [(0, len(line)-1)]
    while stack:
        first, last = stack.pop()
        ax, ay = points[first]
        bx, by = points[last]
        dx, dy = bx-ax, by-ay
        length = dx*dx + dy*dy
        furthest, distance = None, tolerance*tolerance
        for i in range(first+1, last):
            px, py = points[i]
            t = max(0, min(1, ((px-ax)*dx+(py-ay)*dy)/length)) if length else 0
            d = (px-ax-t*dx)**2 + (py-ay-t*dy)**2
            if d > distance:
                furthest, distance = i, d
        if furthest is not None:
            keep.add(furthest)
            stack.extend([(first, furthest), (furthest, last)])
    result = []
    for i in sorted(keep):
        p = [round(v, 6) for v in line[i][:2]]
        if not result or p != result[-1]:
            result.append(p)
    return result


def build(raw):
    features = []
    for feature in raw['features']:
        props, geo = feature['properties'], feature['geometry']
        if not geo or props.get('Type') in ('DISPOSE', 'MOTHBALL'):
            continue
        lines = [geo['coordinates']] if geo['type'] == 'LineString' else geo['coordinates']
        points = [p for line in lines for p in line]
        # Mission Bush branches away from the Auckland metro corridor at Paerata.
        # Do not leave an arbitrary cropped branch extending towards Glenbrook.
        if props.get('Location') == 'Mission Bush' or (max(p[1] for p in points) < -37.1 and min(p[0] for p in points) < 174.85):
            continue
        parts = [simplify(part) for line in lines for part in clip(line)]
        parts = [part for part in parts if len(part) >= 2]
        if not parts:
            continue
        features.append({'type': 'Feature', 'id': props['FID'], 'properties': {
            'location': props.get('Location') or '', 'track_type': props.get('Type') or '',
            'track_name': props.get('Track') or ''}, 'geometry': {
                'type': 'MultiLineString', 'coordinates': parts}})
    return {'type': 'FeatureCollection', 'name': 'Auckland physical railway tracks',
            'metadata': {'source': 'KiwiRail Track Centreline', 'source_url': SERVICE,
                         'licence': 'CC BY 4.0', 'retrieved': datetime.date.today().isoformat(),
                         'cutoffs': {'swanson': SWANSON, 'pukekohe': PUKEKOHE},
                         'notes': 'KiwiRail main tracks, loops, links and yards. Private sidings excluded by source. Disposed/mothballed records and the Mission Bush branch excluded. Clipped at Swanson longitude and Pukekohe latitude. Simplified to 0.6 m.'},
            'features': features}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path)
    args = parser.parse_args()
    if args.source:
        raw = json.loads(args.source.read_text())
    else:
        params = {'f': 'geojson', 'where': '1=1', 'geometry': '174.55,-37.24,175.1,-36.7',
                  'geometryType': 'esriGeometryEnvelope', 'inSR': 4326, 'outSR': 4326,
                  'spatialRel': 'esriSpatialRelIntersects', 'outFields': 'FID,Location,Type,Track',
                  'resultRecordCount': 2000}
        with urllib.request.urlopen(SERVICE+'/query?'+urllib.parse.urlencode(params), timeout=60) as response:
            raw = json.load(response)
    if raw.get('error') or raw.get('exceededTransferLimit'):
        raise ValueError('Incomplete railway service response; refusing to replace snapshot')
    data = build(raw)
    if not data['features']:
        raise ValueError('No tracks returned; refusing to replace snapshot')
    folder = ROOT / 'data'
    folder.mkdir(exist_ok=True)
    encoded = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    (folder / 'railways.geojson').write_text(encoded+'\n')
    (folder / 'railways.js').write_text('// KiwiRail Track Centreline · CC BY 4.0. Generated by scripts/update-railways.py\nwindow.ATLAS_RAILWAYS = '+encoded+';\n')
    print(f"Wrote {len(data['features'])} track segments, {len(encoded):,} bytes")


if __name__ == '__main__':
    main()
