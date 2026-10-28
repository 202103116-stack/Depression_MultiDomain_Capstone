"""Finalize aggregate sample counts, completed benchmark CIs and result manifest."""
from __future__ import annotations
import json
import numpy as np
import pandas as pd
import common
from common import V2_REPORT,V2_RUNS,load_v2_table
from analysis_config import PHQ_CUTOFF
from survey_regression_v2 import COMBO_ADJUST,PARTNERS,design,recode
from bootstrap_metrics import OrderedMetrics
from modeling import evaluate

def main():
    d=load_v2_table();d=d[d.Y.notna()].reset_index(drop=True)
    X,_=design(recode(d),COMBO_ADJUST);adjust_ok=X.notna().all(axis=1)
    factors=[('신체활동 권고',d.pa_guideline)]+[(n,fn(d)) for n,_,fn,prox in PARTNERS if not prox]
    stacks={'주 분석':factors,'수면 포함':factors+[(n,fn(d)) for n,_,fn,prox in PARTNERS if prox]}
    for i,(name,_) in enumerate(factors):stacks[name+' 제외']=[v for j,v in enumerate(factors) if i!=j]
    scores={name:pd.concat([v for _,v in parts],axis=1).sum(axis=1,min_count=len(parts)) for name,parts in stacks.items()}
    for filename in ['reg_v2_lifestyle_count.csv','reg_v2_lifestyle_count_sens.csv']:
        path=V2_REPORT/filename;t=pd.read_csv(path);ns=[]
        for row in t.itertuples():
            label=row.healthy_factors.replace('개','');bounds=[int(v) for v in label.split('~')]
            lo,hi=bounds[0],bounds[-1]
            ns.append(int((scores[row.score].between(lo,hi)&adjust_ok).sum()))
        t['n_model']=ns
        assert (t.n_model<=t.n).all()
        t.to_csv(path,index=False,encoding='utf-8-sig')
    path=V2_REPORT/'reg_v2_lifestyle_count_summary.csv';summary=pd.read_csv(path)
    summary['n_model']=[int((scores[name].notna()&adjust_ok).sum()) for name in summary.score]
    summary.to_csv(path,index=False,encoding='utf-8-sig')
    # Include the completed full CatBoost benchmark only when present.
    # Domain comparisons and TreeSHAP remain explicitly LightGBM.
    meta_path=V2_RUNS/'full__catboost__cv.json'
    if meta_path.exists():
        meta=json.loads(meta_path.read_text(encoding='utf-8'))
        test=d[d.split.eq('test')].reset_index(drop=True)
        p=pd.read_csv(V2_RUNS/'full__catboost__cv_pred.csv').p.to_numpy()
        assert len(p)==len(test) and meta['n_features']==53
        y=test.Y.to_numpy();point=evaluate(y,p)
        assert abs(point['AP']-meta['test_AP'])<1e-12
        codes,uniq=pd.factorize(test.household_key);metric=OrderedMetrics(y,p,codes)
        rng=np.random.default_rng(42);vals=[]
        for _ in range(1000):
            w=np.bincount(rng.integers(0,len(uniq),len(uniq)),minlength=len(uniq));vals.append(metric.evaluate(w))
        ci=np.percentile(np.asarray(vals),[2.5,97.5],axis=0)
        row={'model':'full__catboost',**point,'AP_low':ci[0,0],'AP_high':ci[1,0],'AUC_low':ci[0,1],'AUC_high':ci[1,1]}
        path=V2_REPORT/'ml_core_performance_ci.csv';t=pd.read_csv(path)
        t=pd.concat([t[t.model.ne('full__catboost')],pd.DataFrame([row])],ignore_index=True)
        t.to_csv(path,index=False,encoding='utf-8-sig')
        path=V2_REPORT/'ml_core_results.csv';t=pd.read_csv(path)
        t=t[~(t.algo.eq('catboost')&t['set'].eq('full')&t.cv)]
        pd.concat([t,pd.DataFrame([{**meta,'cv':True}])],ignore_index=True).to_csv(path,index=False,encoding='utf-8-sig')
    audit=json.loads((V2_REPORT/'reanalysis_audit.json').read_text(encoding='utf-8'))
    main=summary[summary.score.eq('주 분석')].iloc[0].to_dict()
    perf=pd.read_csv(V2_REPORT/'ml_core_performance_ci.csv')
    econ=pd.read_csv(V2_REPORT/'econ6_tests.csv')
    contrasts=pd.read_csv(V2_REPORT/'econ6_contrasts.csv')
    delta=pd.read_csv(V2_REPORT/'ml_core_domain_deltas.csv')
    formal=pd.read_csv(V2_REPORT/'h1_score6_tests.csv')
    h1=formal[formal.adjustment.eq('신체건강추가')].iloc[0].to_dict()
    result={'PHQ_CUTOFF':PHQ_CUTOFF,'audit':audit,'score6_main':h1,'score6_legacy_reproduction':main,
            'ML_performance':perf.to_dict('records'),'ML_domain_algorithm':'LightGBM',
            'ML_domain_deltas':delta.to_dict('records'),'economic_score6':econ.to_dict('records'),
            'reversal_comparisons':contrasts[contrasts.reference.isin(['5분위K0~2','5분위평균'])].to_dict('records'),
            'scope':'Full-sample LightGBM domain reanalysis; LR comparator, completed full CatBoost benchmark if available; not full six-algorithm replication'}
    (V2_REPORT/'key_results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'cutoff':PHQ_CUTOFF,'score_OR':h1['trend_OR'],'score_n_model':h1['n_model'],
                      'legacy_replication_OR':main['trend_OR'],
                      'ML':perf[['model','AP','ROC_AUC']].to_dict('records')},ensure_ascii=False),flush=True)

if __name__=='__main__':main()
