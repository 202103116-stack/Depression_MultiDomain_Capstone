"""Full-sample LightGBM domain comparison, LR comparison, grouped 5-fold CV.

No quick mode/subsampling. Keep this run distinct from original CatBoost results.
"""
from __future__ import annotations
import json
import time
import numpy as np
import pandas as pd
import common
from common import V2_REPORT,V2_FIG,MAIN_DOMAINS,ADDABLE_DOMAINS,DOMAINS,load_v2_table
from train_v2 import Runner,feature_sets,make_X,domain_permutation
from bootstrap_metrics import OrderedMetrics
from modeling import evaluate
from preprocess_v2 import domain_features
from utils import SEED,setup_matplotlib
from analysis_config import PHQ_CUTOFF

def main(catboost_full=False):
    print(f'PHQ>={PHQ_CUTOFF} full-sample LightGBM core: start',flush=True)
    t0=time.time();df=load_v2_table();s=df[df.Y.notna()]
    train=s[s.split.eq('train')].reset_index(drop=True)
    test=s[s.split.eq('test')].reset_index(drop=True)
    runner=Runner(train,test,quick=False)
    sets=feature_sets();results=[];preds={}
    for algo in ['dummy','logistic','lightgbm']+(['catboost'] if catboost_full else []):
        r,p=runner.run('full',sets['full'],algo,cv=True)
        results.append({**r,'cv':True});preds['full__'+algo]=p
    for name,domains in sets.items():
        r,p=runner.run(name,domains,'lightgbm',keep=(name=='full'))
        results.append({**r,'cv':False});preds[name]=p
    num,cat=domain_features(MAIN_DOMAINS)
    Xte=make_X(test,num,cat)
    mdl=runner.models['full'][0]
    pre=mdl.named_steps['pre'];tree=mdl.named_steps['clf']
    transformed=pre.transform(Xte)
    contributions=tree.predict(transformed,pred_contrib=True)[:,:-1]
    expanded=pre.get_feature_names_out()
    # Aggregate one-hot and missing-indicator contributions to original fields
    # before absolute-value averaging. This avoids counting dummy levels twice.
    owner=[]
    for name in expanded:
        short=name.split('__',1)[-1]
        if short.startswith('missingindicator_'):short=short[len('missingindicator_'):]
        match=[x for x in Xte.columns if short==x or short.startswith(x+'_')]
        if not match:raise ValueError('Unmapped encoded feature '+name)
        owner.append(max(match,key=len))
    shap=np.zeros((len(test),len(Xte.columns)))
    for j,f in enumerate(Xte.columns):shap[:,j]=contributions[:,np.array(owner)==f].sum(axis=1)
    assert np.allclose(shap.sum(axis=1),contributions.sum(axis=1)), 'TreeSHAP aggregation mismatch'
    from preprocess_v2 import FEATURES
    meta=FEATURES.set_index('name')
    imp=pd.DataFrame({'feature':list(Xte.columns),'mean_abs_shap':np.abs(shap).mean(axis=0)})
    imp['label']=imp.feature.map(meta.label);imp['domain']=imp.feature.map(meta.domain)
    imp=imp.sort_values('mean_abs_shap',ascending=False)
    dom=imp.groupby('domain').mean_abs_shap.sum().rename('sum_abs_shap').reset_index()
    dom['share']=dom.sum_abs_shap/dom.sum_abs_shap.sum()
    # Matched household bootstrap, exact tied-score weighted AP/AUC.
    groups,unique=pd.factorize(test.household_key)
    metrics={name:OrderedMetrics(runner.yte,p,groups) for name,p in preds.items()}
    boot={name:np.empty((1000,2)) for name in metrics}
    rng=np.random.default_rng(SEED)
    for b in range(1000):
        counts=np.bincount(rng.integers(0,len(unique),len(unique)),minlength=len(unique))
        for name,metric in metrics.items():boot[name][b]=metric.evaluate(counts)
    deltas=[]
    for kind,domains in [('add',ADDABLE_DOMAINS),('drop',MAIN_DOMAINS)]:
        for d in domains:
            new,base=(f'base+{d}','base') if kind=='add' else ('full',f'full-{d}')
            point=evaluate(runner.yte,preds[new])['AP']-evaluate(runner.yte,preds[base])['AP']
            lo,hi=np.percentile(boot[new][:,0]-boot[base][:,0],[2.5,97.5])
            deltas.append({'kind':kind,'domain':d,'algo':'lightgbm','dAP':point,'low':lo,'high':hi})
    perf=[]
    for name in ['full__dummy','full__logistic','full__lightgbm','full+proximal']+(['full__catboost'] if catboost_full else []):
        apci=np.percentile(boot[name][:,0],[2.5,97.5]);aucci=np.percentile(boot[name][:,1],[2.5,97.5])
        perf.append({'model':name,**evaluate(runner.yte,preds[name]),'AP_low':apci[0],'AP_high':apci[1],
                     'AUC_low':aucci[0],'AUC_high':aucci[1]})
    V2_REPORT.mkdir(parents=True,exist_ok=True)
    for name,tab in [('ml_core_results',pd.DataFrame(results)),('ml_core_domain_deltas',pd.DataFrame(deltas)),
                     ('ml_core_shap_features',imp),('ml_core_shap_domains',dom),('ml_core_performance_ci',pd.DataFrame(perf))]:
        tab.to_csv(V2_REPORT/(name+'.csv'),index=False,encoding='utf-8-sig')
    run={'cutoff':PHQ_CUTOFF,'domain_algorithm':'LightGBM','n_train':len(train),'n_test':len(test),
         'n_features':53,'test_prevalence':float(runner.yte.mean()),'cv':'5-fold StratifiedGroupKFold by household',
         'bootstrap':'1000 paired household resamples, pointwise percentile 95% CI','elapsed_seconds':time.time()-t0,
         'SHAP':'LightGBM native TreeSHAP, one-hot/missing indicators aggregated to original fields before mean(abs)',
         'scope':'Full-sample exploratory domain comparison. Not the original six-algorithm CatBoost pipeline.'}
    (V2_REPORT/'ml_core_run.json').write_text(json.dumps(run,ensure_ascii=False,indent=2),encoding='utf-8')
    plt=setup_matplotlib();V2_FIG.mkdir(parents=True,exist_ok=True)
    fig,axes=plt.subplots(1,2,figsize=(13,5.4))
    delta=pd.DataFrame(deltas)
    for ax,kind,title in zip(axes,['add','drop'],['인구 영역에 추가','전체 영역에서 제거']):
        t=delta[delta.kind.eq(kind)].iloc[::-1]
        ax.barh(range(len(t)),t.dAP,color='#339B9D')
        ax.errorbar(t.dAP,range(len(t)),xerr=[t.dAP-t.low,t.high-t.dAP],fmt='none',capsize=3,color='#17324D')
        ax.set_yticks(range(len(t)),t.domain.map(DOMAINS));ax.set_title(title,loc='left');ax.set_xlabel('ΔAP (가구 부트스트랩95% CI)')
    fig.suptitle(f'PHQ-9 ≥{PHQ_CUTOFF}: LightGBM 영역별 추가 정보',x=.01,ha='left');fig.tight_layout()
    fig.savefig(V2_FIG/'ml_core_domain_contribution.png');plt.close(fig)
    top=imp.head(20).iloc[::-1]
    fig,ax=plt.subplots(figsize=(10,8))
    ax.barh(range(len(top)),top.mean_abs_shap,color='#339B9D');ax.set_yticks(range(len(top)),top.label)
    ax.set_xlabel('변수별 평균 |TreeSHAP| (로짓 척도)');ax.set_title(f'PHQ-9 ≥{PHQ_CUTOFF}: LightGBM 상위20개 변수',loc='left')
    fig.tight_layout();fig.savefig(V2_FIG/'ml_core_shap_top20.png');plt.close(fig)
    print(pd.DataFrame(perf).to_string(index=False),flush=True)
    print(delta.to_string(index=False),flush=True)
    print(json.dumps(run,ensure_ascii=False),flush=True)

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser()
    parser.add_argument('--catboost-full',action='store_true',help='Also run/cache full CatBoost 600-iteration 5-fold benchmark (substantially slower)')
    main(parser.parse_args().catboost_full)
