"""Reproducible NFL scouting warehouse and time-split success model.

Data: nflverse play-by-play, CC BY 4.0. No tracking data or proprietary feeds.
Run from repository root: python src/pipeline.py --cache .cache
"""
from __future__ import annotations
import argparse
import hashlib
import json
import sqlite3
import urllib.request
from pathlib import Path
from datetime import datetime, timezone
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SEASONS = [2023, 2024, 2025]
NUMERIC = ['down', 'ydstogo', 'yardline_100', 'half_seconds_remaining',
           'score_differential', 'posteam_timeouts_remaining', 'defteam_timeouts_remaining']
BINARY = ['shotgun', 'no_huddle', 'goal_to_go']
COLS = ['play_id','game_id','season','season_type','week','posteam','defteam',
        'play_type','epa','qtr','qb_scramble','qb_kneel','qb_spike'] + NUMERIC + BINARY
URL = 'https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_{season}.csv.gz'

def clean(frame):
    """One row per eligible offensive play. Do not silently repair duplicate keys."""
    mask = (frame.season_type.eq('REG') & frame.play_type.isin(['pass','run'])
            & frame.down.between(1,4) & frame.epa.notna() & frame.posteam.notna()
            & frame.defteam.notna() & frame.qb_scramble.fillna(0).eq(0)
            & frame.qb_kneel.fillna(0).eq(0) & frame.qb_spike.fillna(0).eq(0))
    out = frame.loc[mask].copy()
    if out.duplicated(['game_id','play_id']).any():
        raise ValueError('Duplicate game_id/play_id keys')
    if not out.ydstogo.ge(0).all() or not out.yardline_100.between(0,100).all():
        raise ValueError('Invalid distance or field coordinate')
    if not np.isfinite(out.epa).all():
        raise ValueError('Non-finite EPA')
    out['success'] = out.epa.gt(0).astype(int)
    out['distance'] = pd.cut(out.ydstogo, [-1,3,7,np.inf], labels=['Short (1–3)','Medium (4–7)','Long (8+)']).astype(str)
    out['field_zone'] = pd.cut(out.yardline_100, [-1,20,50,100], labels=['Red zone','Opponent half','Own half']).astype(str)
    return out

class Logistic:
    """L2 logistic regression via Newton updates; training-only imputation/scaling."""
    def design(self, frame, fit=False):
        a = frame[NUMERIC].to_numpy(dtype=float)
        if fit:
            self.median = np.nanmedian(a, axis=0)
        a = np.where(np.isnan(a), self.median, a)
        if fit:
            self.mean, self.scale = a.mean(axis=0), a.std(axis=0)
            self.scale[self.scale == 0] = 1
        b = frame[BINARY].fillna(0).to_numpy(dtype=float)
        return np.column_stack([np.ones(len(frame)), (a-self.mean)/self.scale,
                                b, frame.play_type.eq('pass').astype(float)])

    def fit(self, frame, penalty=10):
        x = self.design(frame, fit=True)
        y = frame.success.to_numpy(dtype=float)
        self.beta = np.zeros(x.shape[1])
        regularizer = np.eye(x.shape[1])*penalty
        regularizer[0,0] = 0
        for _ in range(60):
            p = self.proba_matrix(x)
            step = np.linalg.solve((x.T*(p*(1-p)))@x+regularizer,
                                   x.T@(p-y)+regularizer@self.beta)
            self.beta -= step
            if np.max(np.abs(step)) < 1e-7:
                break
        return self

    def proba_matrix(self,x):
        return 1/(1+np.exp(-np.clip(x@self.beta,-35,35)))

    def predict(self, frame):
        return self.proba_matrix(self.design(frame))

def metrics(y, p):
    y, p = np.asarray(y), np.clip(np.asarray(p),1e-10,1-1e-10)
    ranks = pd.Series(p).rank(method='average').to_numpy()
    pos, neg = y.sum(), len(y)-y.sum()
    auc = (ranks[y==1].sum()-pos*(pos+1)/2)/(pos*neg) if pos*neg else None
    return {'n':len(y), 'success_rate':float(y.mean()), 'brier':float(np.mean((y-p)**2)),
            'log_loss':float(-np.mean(y*np.log(p)+(1-y)*np.log(1-p))), 'auc':None if auc is None else float(auc)}

def wilson(successes, n):
    if not n: return [0.,1.]
    z=1.96; p=successes/n; d=1+z*z/n
    center=(p+z*z/(2*n))/d
    spread=z*np.sqrt(p*(1-p)/n+z*z/(4*n*n))/d
    return [float(center-spread),float(center+spread)]

def records(frame):
    return json.loads(frame.to_json(orient='records', double_precision=6))

def build(cache):
    cache.mkdir(parents=True, exist_ok=True)
    data_dir = ROOT/'web/data'; data_dir.mkdir(parents=True,exist_ok=True)
    prior_path = data_dir/'manifest.json'
    previous = json.loads(prior_path.read_text()) if prior_path.exists() else {}
    expected = {r['season']:r['sha256'] for r in previous.get('sources',[])}
    frames, sources, audit = [], [], []
    for season in SEASONS:
        url = URL.format(season=season); path=cache/f'pbp_{season}.csv.gz'
        if not path.exists():
            print(f'Downloading {season}', flush=True)
            temporary=path.with_suffix('.part')
            urllib.request.urlretrieve(url,temporary); temporary.replace(path)
        digest=hashlib.sha256(path.read_bytes()).hexdigest()
        if season in expected and digest != expected[season]:
            raise ValueError(f'Source checksum changed for {season}; review new data and remove manifest explicitly to accept')
        raw=pd.read_csv(path, usecols=COLS, low_memory=False)
        frame=clean(raw); frames.append(frame)
        sources.append({'season':season,'url':url,'sha256':digest,'bytes':path.stat().st_size})
        audit.append({'season':season,'raw_rows':len(raw),'eligible_rows':len(frame),'excluded_rows':len(raw)-len(frame),'games':frame.game_id.nunique(),'teams':frame.posteam.nunique()})
        print(audit[-1], flush=True)
    data=pd.concat(frames,ignore_index=True)
    train=data[data.season.eq(2023)]; validation=data[data.season.eq(2024)]; test=data[data.season.eq(2025)].copy()
    candidates=[]
    for penalty in [1.,10.,100.]:
        model=Logistic().fit(train,penalty)
        candidates.append((metrics(validation.success,model.predict(validation))['brier'], penalty))
    penalty=min(candidates)[1]
    final=Logistic().fit(data[data.season.lt(2025)],penalty)
    pred=final.predict(test); test['predicted_success']=pred
    base=np.repeat(data[data.season.lt(2025)].success.mean(),len(test))
    # Resample entire games, retaining dependence among plays in the same game.
    test['brier_delta']=(test.success-pred)**2-(test.success-base)**2
    blocks=test.groupby('game_id').agg(delta=('brier_delta','sum'),n=('brier_delta','size'))
    rng=np.random.default_rng(42)
    draws=rng.integers(0,len(blocks),size=(2000,len(blocks)))
    bootstrap_delta=blocks.delta.to_numpy()[draws].sum(axis=1)/blocks.n.to_numpy()[draws].sum(axis=1)
    calibration=[]
    for k in range(10):
        m=(pred>=k/10)&(pred<(k+1)/10)
        if m.any():
            yy=test.success.to_numpy()[m]
            calibration.append({'bin':k,'n':int(m.sum()),'predicted':float(pred[m].mean()),'observed':float(yy.mean()),'interval':wilson(yy.sum(),len(yy))})
    model_report={'train_seasons':[2023,2024],'selection_train':2023,'selection_validation':2024,'test_season':2025,
        'selected_l2':penalty,'validation_candidates':[{'l2':p,'brier':s} for s,p in candidates],
        'model':metrics(test.success,pred),'baseline':metrics(test.success,base),'calibration':calibration,
        'brier_difference_game_bootstrap_95':np.quantile(bootstrap_delta,[.025,.975]).tolist(),
        'bootstrap_method':'2000 resamples of entire 2025 games, seed 42; model minus baseline Brier (negative favors model). Conditional on the fitted model.',
        'features':NUMERIC+BINARY+['play_type'], 'coefficients':dict(zip(['intercept']+NUMERIC+BINARY+['is_pass'],map(float,final.beta))),
        'imputation_medians':final.median.tolist(),'scaling_mean':final.mean.tolist(),'scaling_sd':final.scale.tolist(),
        'method':'L2 logistic regression. Standardization and imputation fitted on training seasons only. L2 chosen on 2024; refit on 2023–24; 2025 untouched until evaluation.'}
    con=sqlite3.connect(cache/'scouting.sqlite')
    data.to_sql('plays',con,if_exists='replace',index=False)
    con.execute('CREATE UNIQUE INDEX IF NOT EXISTS play_key ON plays(game_id,play_id)')
    con.executescript((ROOT/'sql/marts.sql').read_text())
    cells=records(pd.read_sql_query('SELECT * FROM situation_mart',con))
    games=records(pd.read_sql_query('SELECT * FROM game_mart',con))
    model_teams=[]
    for team,group in test.groupby('posteam'):
        lo,hi=wilson(group.success.sum(),len(group))
        model_teams.append({'team':team,'n':len(group),'observed':float(group.success.mean()),
            'expected':float(group.predicted_success.mean()),'over_expected':float((group.success-group.predicted_success).mean()),'interval':[lo,hi]})
    summary={'seasons':SEASONS,'audit':audit,'total_plays':len(data),'cells':cells,'games':games,'model':model_report,'model_teams':model_teams,
        'attribution':'Data: nflverse play-by-play (CC BY 4.0); EPA computed upstream by nflfastR. Filtered and aggregated for this portfolio project.',
        'source_url':'https://github.com/nflverse/nflverse-data/releases/tag/pbp'}
    (data_dir/'scouting.json').write_text(json.dumps(summary,separators=(',',':'),allow_nan=False))
    (data_dir/'model.json').write_text(json.dumps(model_report,indent=2,allow_nan=False))
    manifest={'generated_at_utc':datetime.now(timezone.utc).isoformat(),'sources':sources,'audit':audit,'license':'CC BY 4.0',
        'transform_version':1,'output_sha256':hashlib.sha256((data_dir/'scouting.json').read_bytes()).hexdigest()}
    prior_path.write_text(json.dumps(manifest,indent=2))
    con.close()
    print(json.dumps({'model':model_report['model'],'baseline':model_report['baseline'],'plays':len(data)},indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--cache',type=Path,default=ROOT/'.cache')
    build(parser.parse_args().cache)
