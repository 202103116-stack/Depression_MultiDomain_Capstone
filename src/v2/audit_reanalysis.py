"""Independent full-data checks for threshold isolation and published aggregates."""
from pathlib import Path
import json
import numpy as np
import pandas as pd
import common
from utils import ROOT
from preprocess_v2 import domain_features
from common import MAIN_DOMAINS

def main():
    paths=[ROOT/'data'/'processed'/f'phq{k}'/'v2'/'analysis_table_v2.csv' for k in [5,10]]
    a,b=[pd.read_csv(p,dtype={'exmprs_no':str,'household_key':str,'spot_key':str}) for p in paths]
    assert a.shape==b.shape==(231615,86)
    assert a.drop(columns='Y').equals(b.drop(columns='Y')), 'A predictor/split changed across cutoffs'
    assert a.Y.isna().equals(b.Y.isna())
    valid=a.phq9_total.notna()
    assert a.loc[valid,'Y'].eq(a.loc[valid,'phq9_total'].ge(5)).all()
    assert b.loc[valid,'Y'].eq(b.loc[valid,'phq9_total'].ge(10)).all()
    assert (a.loc[valid,'Y']>=b.loc[valid,'Y']).all()
    num,cat=domain_features(MAIN_DOMAINS)
    features=num+cat
    assert len(features)==53 and len(set(features))==53
    assert not {'Y','phq9_total','exmprs_no','household_key','spot_key','wt_p','kstrata'} & set(features)
    tr=set(a.loc[a.split.eq('train'),'household_key']);te=set(a.loc[a.split.eq('test'),'household_key'])
    assert not tr & te
    out={'rows':len(a),'columns':a.shape[1],'only_Y_changed_between_thresholds':True,
         'target_missing':int(a.Y.isna().sum()),'PHQ5_events':int(a.Y.sum()),'PHQ10_events':int(b.Y.sum()),
         'PHQ5_weighted_percent':float(np.average(a.loc[valid,'Y'],weights=a.loc[valid,'wt_p'])*100),
         'PHQ10_weighted_percent':float(np.average(b.loc[valid,'Y'],weights=b.loc[valid,'wt_p'])*100),
         'n_features_primary':len(features),'household_leakage':False,
         'n_train':int(a.split.eq('train').sum()),'n_test':int(a.split.eq('test').sum())}
    for k in [5,10]:
        p=ROOT/'outputs'/f'phq{k}'/'v2'/'reports';p.mkdir(parents=True,exist_ok=True)
        (p/'reanalysis_audit.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(out,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
