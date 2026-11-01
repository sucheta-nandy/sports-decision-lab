"""Verify committed aggregate artifacts without network or raw data."""
import hashlib
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'web/data'
manifest=json.loads((root/'manifest.json').read_text())
raw=(root/'scouting.json').read_bytes(); d=json.loads(raw)
assert hashlib.sha256(raw).hexdigest()==manifest['output_sha256'], 'Snapshot digest mismatch'
assert sum(c['n'] for c in d['cells'])==d['total_plays']
for season in d['seasons']:
    cells=[c for c in d['cells'] if c['season']==season]
    assert len({c['team'] for c in cells})==32
    assert sum(c['n'] for c in cells)==next(a['eligible_rows'] for a in d['audit'] if a['season']==season)
for c in d['cells']:
    assert c['n']>0 and 0<=c['successes']<=c['n']
assert d['model']['test_season']>max(d['model']['train_seasons'])
assert d['model']['model']['n']==next(a['eligible_rows'] for a in d['audit'] if a['season']==2025)
careers=root/'careers.json'
if careers.exists():
    c=json.loads(careers.read_text())
    assert len({(t['league'],t['team']) for t in c['teams']})==len(c['teams'])
    assert all(j['url'].startswith('https://') for j in c['jobs'])
print(f"Verified {d['total_plays']:,} eligible plays and aggregate checksum")
