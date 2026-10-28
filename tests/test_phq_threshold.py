"""Meaningful outcome boundary, invalid-code and separate-cache checks, no raw data needed."""
import os
from pathlib import Path
import subprocess
import sys
import unittest

SRC=Path(__file__).resolve().parents[1]/'src'
sys.path.insert(0,str(SRC))
import pandas as pd
from preprocess import PHQ_ITEMS, build_outcome
from analysis_config import PHQ_CUTOFF

class OutcomeTest(unittest.TestCase):
    def test_boundaries_and_invalid(self):
        rows=[]
        for total in [0,4,5,9,10,27]:
            rem=total; row=[]
            for _ in range(9):
                point=min(rem,3); rem-=point; row.append(point+1)
            rows.append(row)
        for invalid in [0,5,7,9,float('nan')]:
            rows.append([invalid]+[4]*8)
        result=build_outcome(pd.DataFrame(rows,columns=PHQ_ITEMS))
        self.assertEqual(result.Y.iloc[:6].tolist(),[float(x>=PHQ_CUTOFF) for x in [0,4,5,9,10,27]])
        self.assertTrue(result.Y.iloc[6:].isna().all())
        self.assertTrue(result.phq9_total.iloc[6:].isna().all())

    def test_namespaces(self):
        code='import sys;sys.path.insert(0,"src");from utils import PROCESSED_DIR;print(PROCESSED_DIR.name)'
        vals=[]
        for cutoff in [5,10]:
            env={**os.environ,'PHQ_CUTOFF':str(cutoff)}
            vals.append(subprocess.check_output([sys.executable,'-c',code],env=env,text=True).strip())
        self.assertEqual(vals,['phq5','phq10'])

if __name__=='__main__':unittest.main()
