import sys
from pathlib import Path
import unittest
import pandas as pd
SRC=Path(__file__).resolve().parents[1]/'src'
sys.path.insert(0,str(SRC))
sys.path.insert(0,str(SRC/'v2'))
from economic_lifestyle import score6

class ScoreTest(unittest.TestCase):
    def test_components_and_complete_cases(self):
        d=pd.DataFrame({'pa_guideline':[1.,0.,1.], 'tobacco_free':[1.,1.,1.],
                        'high_risk_drinking':[0.,0.,0.], 'breakfast':[1.,1.,1.],
                        'social_connected':[1.,1.,1.], 'brush_evening_ok':[1.,1.,float('nan')]})
        got=score6(d)
        self.assertEqual(got.iloc[:2].tolist(),[6.,5.])
        self.assertTrue(pd.isna(got.iloc[2]))

if __name__=='__main__':unittest.main()
