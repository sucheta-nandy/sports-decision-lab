"""Normalize the manually sourced career audit into dashboard data."""
import json
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
evidence=json.loads((ROOT/'docs/research_evidence.json').read_text())
teams=[]; jobs=[]
for group in evidence['research']:
    for original in group['teams']:
        t=dict(original)
        t['notes']=t.get('notes',t.get('evidence_notes',''))
        teams.append(t)
    for original in group['jobs']:
        j=dict(original)
        family=j.get('family',j.get('category',j.get('role_family','Analyst')))
        low=(family+' '+j['title']).lower()
        if 'adjacent' in low or any(s in j['title'] for s in ['First Team Performance Analyst','Rehab Coach','Coordinator, Pitching Analysis','Senior Analyst, Performance Marketing','Domestic Scouting Analyst Fellow']):
            j['relevance']='adjacent'; j['family']='Adjacent analytics'
        else:
            j['relevance']='core'
            j['family']='Data engineer' if any(s in low for s in ['engineer','architect','platform']) else ('Data scientist' if any(s in low for s in ['scientist','data_science']) else 'Analyst')
        j['source_status']=j['status']
        j['status']={
            'verified_listing':'Accessible listing',
            'verified_accessible_listing':'Accessible listing',
            'listed_detail_accessible':'Accessible listing',
            'application_form_verified':'Application form visible',
            'official_index_only_description_blocked':'Index only / detail blocked',
            'employer_announcement_unverified':'Employer announcement / unverified',
            'search_index_only':'Search index only',
            'historical_unconfirmed':'Historical / unconfirmed',
            'listing_status_conflict':'Conflicting listing status'
        }.get(j['source_status'],j['source_status'])
        j['notes']=j.get('notes',j.get('evidence_notes',''))
        j['id']=f"role-{len(jobs)+1}"
        jobs.append(j)
catchup=evidence.get('catchup',{})
for update in catchup.get('teams',[]):
    for i,t in enumerate(teams):
        if (t['league'],t['team'])==(update['league'],update['team']):
            teams[i]={**t,**update}
out={'checked_on':'2026-10-30','teams':teams,'jobs':jobs,
     'coverage':dict(Counter(t['status'] for t in teams)),
     'status_counts':dict(Counter(j['status'] for j in jobs)),
     'scope':'185 active teams: NFL, NBA, WNBA, MLB, NHL, MLS, NWSL. Manual point-in-time audit; blocked feeds are incomplete.',
     'limitations':'Accessible descriptions and application forms do not guarantee ongoing acceptance. Adjacent, historical, conflicting and index-only leads are labeled. No applications submitted.'}
assert len(teams)==185 and len(set((t['league'],t['team']) for t in teams))==185
(ROOT/'web/data/careers.json').write_text(json.dumps(out,indent=2,ensure_ascii=False))
print(json.dumps({'teams':len(teams),'jobs':len(jobs),'coverage':out['coverage'],'statuses':out['status_counts']},indent=2))
