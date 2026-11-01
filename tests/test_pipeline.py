import sys
import unittest
from pathlib import Path
import numpy as np
import pandas as pd
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'src'))
from pipeline import Logistic, metrics, clean, wilson, NUMERIC, BINARY

class IntegrityTests(unittest.TestCase):
    def fixture(self,n=100):
        rng=np.random.default_rng(7)
        f=pd.DataFrame({key:rng.normal(size=n) for key in NUMERIC})
        for key in BINARY: f[key]=rng.integers(0,2,n)
        f['play_type']=np.where(np.arange(n)%2,'run','pass')
        f['success']=(f.down+rng.normal(size=n)>0).astype(int)
        return f

    def test_test_data_does_not_refit_preprocessing(self):
        train=self.fixture(); model=Logistic().fit(train)
        median=model.median.copy(); mean=model.mean.copy()
        test=self.fixture(4); test['down']=[np.nan,1000,-1000,0]
        p=model.predict(test)
        np.testing.assert_array_equal(mean,model.mean)
        np.testing.assert_array_equal(median,model.median)
        self.assertTrue(np.all(np.isfinite(p)))
        self.assertTrue(np.all((p>0)&(p<1)))

    def test_metric_definitions_and_tied_auc(self):
        m=metrics([0,1],[.5,.5])
        self.assertAlmostEqual(m['brier'],.25)
        self.assertAlmostEqual(m['auc'],.5)
        self.assertAlmostEqual(metrics([0,1],[.1,.9])['auc'],1)

    def test_filters_and_duplicate_keys(self):
        f=self.fixture(7)
        for k,v in {'season_type':'REG','game_id':'g','posteam':'PHI','defteam':'DAL','epa':.2,'qb_scramble':0,'qb_kneel':0,'qb_spike':0,'down':1,'ydstogo':10,'yardline_100':50}.items(): f[k]=v
        f['play_id']=range(7)
        f.loc[1,'season_type']='POST'; f.loc[2,'play_type']='no_play'; f.loc[3,'qb_scramble']=1
        f.loc[4,'qb_kneel']=1; f.loc[5,'qb_spike']=1; f.loc[6,'epa']=np.nan
        self.assertEqual(clean(f).play_id.tolist(),[0])
        with self.assertRaisesRegex(ValueError,'Duplicate'):
            clean(pd.concat([f.iloc[[0]],f.iloc[[0]]]))

    def test_success_interval_contains_observed(self):
        for successes,n in [(0,20),(20,20),(7,20)]:
            lo,hi=wilson(successes,n)
            self.assertLessEqual(lo,successes/n+1e-12)
            self.assertGreaterEqual(hi,successes/n-1e-12)

if __name__=='__main__': unittest.main()
