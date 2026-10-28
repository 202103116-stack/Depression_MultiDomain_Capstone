import sys
from pathlib import Path
import unittest
import numpy as np
from sklearn.metrics import average_precision_score,roc_auc_score
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'src'))
from bootstrap_metrics import OrderedMetrics

class MetricTest(unittest.TestCase):
    def test_weighted_ties_and_zero_weight_groups(self):
        rng=np.random.default_rng(42)
        y=rng.integers(0,2,500);g=rng.integers(0,150,500)
        for p in [np.ones(500)*.2,np.round(rng.random(500),1),rng.random(500)]:
            metric=OrderedMetrics(y,p,g)
            for _ in range(15):
                counts=rng.integers(0,4,150);w=counts[g];m=w>0
                ap,auc=metric.evaluate(counts)
                self.assertAlmostEqual(ap,average_precision_score(y[m],p[m],sample_weight=w[m]),places=12)
                self.assertAlmostEqual(auc,roc_auc_score(y[m],p[m],sample_weight=w[m]),places=12)

if __name__=='__main__':unittest.main()
