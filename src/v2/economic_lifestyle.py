"""Six-factor score x income quintile, design-based exploratory associations.

Run separately with PHQ_CUTOFF=5 and 10. No individual records are exported.
The primary categorical comparison uses score 0-2 / 3 / 4 / 5 / 6.
"""
from __future__ import annotations
import json
import numpy as np
import pandas as pd
import common
from common import V2_REPORT, V2_FIG, load_v2_table
from analysis_config import PHQ_CUTOFF
from survey_regression_v2 import SPEC, design, fit, recode
from utils import setup_matplotlib

K_LEVELS=['0~2','3','4','5','6']

def holm_reversals(contrasts):
    contrasts=contrasts.copy()
    contrasts['p_holm_reversal']=np.nan
    contrasts['reversal_after_holm']=False
    for label in contrasts.adjustment.unique():
        ix=contrasts.index[(contrasts.adjustment==label)&contrasts.reference.isin(['5분위K0~2','5분위평균'])]
        p=contrasts.loc[ix,'p_unadjusted'].to_numpy()
        assert len(p)==10, 'Expected two fixed references x five K categories'
        order=np.argsort(p);adj=np.empty(len(p))
        adj[order]=np.minimum(1,np.maximum.accumulate((len(p)-np.arange(len(p)))*p[order]))
        contrasts.loc[ix,'p_holm_reversal']=adj
        contrasts.loc[ix,'reversal_after_holm']=(contrasts.loc[ix,'difference'].to_numpy()<0)&(adj<.05)
    return contrasts

def score6(d):
    parts=pd.DataFrame({
        'PA':d.pa_guideline,'tobacco':d.tobacco_free,
        'alcohol':d.high_risk_drinking.eq(0).astype(float).where(d.high_risk_drinking.notna()),
        'breakfast':d.breakfast.eq(1).astype(float).where(d.breakfast.notna()),
        'social':d.social_connected,'brushing':d.brush_evening_ok,
    })
    return parts.sum(axis=1,min_count=6)

def main():
    d=load_v2_table()
    d=d.loc[d.Y.notna()].reset_index(drop=True)
    r=recode(d)
    count=score6(d)
    kg=pd.cut(count,[-1,2,3,4,5,6],labels=K_LEVELS).astype(object)
    # Income cut points are based on all PHQ-valid observations, not outcomes.
    eq=r.inc_q.map({'1분위(하)':1,'2분위':2,'3분위':3,'4분위':4,'5분위(상)':5})
    # Minimum adjustment then physical-health extension. Exclude household type,
    # because living alone is part of the social connection component of K.
    specs={
      '인구보정':[s for s in SPEC if s[2]=='demo' and s[0]!='hh_type'],
      '신체건강추가':[s for s in SPEC if (s[2]=='demo' and s[0]!='hh_type') or s[2]=='phys'],
    }
    V2_REPORT.mkdir(parents=True,exist_ok=True)
    all_cells=[];all_tests=[];all_contrasts=[]
    for label,spec in specs.items():
        Xa,_=design(r,spec)
        X=Xa.copy()
        for k in K_LEVELS[1:]:X['K='+k]=kg.eq(k).astype(float).where(kg.notna())
        for e in [2,3,4,5]:X['E='+str(e)]=eq.eq(e).astype(float).where(eq.notna())
        interactions=[]
        for k in K_LEVELS[1:]:
            for e in [2,3,4,5]:
                name=f'K={k}:E={e}';X[name]=X['K='+k]*X['E='+str(e)];interactions.append(name)
        mdl=fit(X,d,np.ones(len(d),dtype=bool))
        valid=mdl.domain
        cells=[];mg={}
        for e in [1,2,3,4,5]:
            for k in K_LEVELS:
                Xc=mdl.X.copy()
                for j,n in enumerate(mdl.names):
                    if n.startswith(('K=','E=')):Xc[:,j]=0
                if k!='0~2':Xc[:,mdl.names.index('K='+k)]=1
                if e!=1:Xc[:,mdl.names.index('E='+str(e))]=1
                if k!='0~2' and e!=1:Xc[:,mdl.names.index(f'K={k}:E={e}')]=1
                est,grad=mdl.margins({'cell':Xc})['cell'];mg[e,k]=(est,grad)
                p,lo,hi,_=mdl.contrast(est,grad)
                mask=valid & eq.eq(e).to_numpy() & kg.eq(k).to_numpy()
                cells.append({'adjustment':label,'income_quintile':e,'K':k,'n':int(mask.sum()),
                              'events':int(d.loc[mask,'Y'].sum()),'adj_prev':p,'low':lo,'high':hi})
        # Reference 2: high-income group's weighted score distribution,
        # applied to the same common C population as every cell estimate.
        hi=valid & eq.eq(5).to_numpy()
        shares=d.loc[hi,'wt_p'].groupby(kg.loc[hi]).sum().reindex(K_LEVELS,fill_value=0)
        shares=shares/shares.sum()
        refmean=(sum(shares[k]*mg[5,k][0] for k in K_LEVELS),
                 sum(shares[k]*mg[5,k][1] for k in K_LEVELS))
        for k in K_LEVELS:
            for refname,ref in [('동일K비교',mg[5,k]),('5분위K0~2',mg[5,'0~2']),('5분위평균',refmean)]:
                est=mg[1,k][0]-ref[0];grad=mg[1,k][1]-ref[1]
                de,lo,hi,p=mdl.contrast(est,grad)
                all_contrasts.append({'adjustment':label,'K':k,'reference':refname,
                                      'difference':de,'low':lo,'high':hi,'p_unadjusted':p,
                                      'exploratory_reversal':bool(hi<0)})
            if k!='0~2':
                basegap=mg[1,'0~2'][0]-mg[5,'0~2'][0]
                basegrad=mg[1,'0~2'][1]-mg[5,'0~2'][1]
                est=mg[1,k][0]-mg[5,k][0]-basegap
                grad=mg[1,k][1]-mg[5,k][1]-basegrad
                de,lo,hi,p=mdl.contrast(est,grad)
                all_contrasts.append({'adjustment':label,'K':k,'reference':'격차변화_vs_K0~2',
                                      'difference':de,'low':lo,'high':hi,'p_unadjusted':p,
                                      'exploratory_reversal':False})
        Xt=Xa.copy()
        for e in [2,3,4,5]:Xt['E='+str(e)]=eq.eq(e).astype(float).where(eq.notna())
        Xt['K']=count
        trend=fit(Xt,d,np.ones(len(d),dtype=bool)).table().set_index('term').loc['K']
        test=mdl.wald(interactions)
        all_tests.append({'adjustment':label,'n':int(valid.sum()),'interaction_p':test['p'],
                          'interaction_df':test['q'],'trend_OR':trend['OR'],
                          'trend_low':trend['OR_low'],'trend_high':trend['OR_high']})
        all_cells.extend(cells)
        print(label,all_tests[-1],flush=True)
    cells=pd.DataFrame(all_cells);tests=pd.DataFrame(all_tests);contrasts=pd.DataFrame(all_contrasts)
    # Ten exploratory reversal comparisons per adjustment: two fixed
    # references x five K categories. Keep pointwise CI and label it as such.
    contrasts=holm_reversals(contrasts)
    cells.to_csv(V2_REPORT/'econ6_cells.csv',index=False,encoding='utf-8-sig')
    tests.to_csv(V2_REPORT/'econ6_tests.csv',index=False,encoding='utf-8-sig')
    contrasts.to_csv(V2_REPORT/'econ6_contrasts.csv',index=False,encoding='utf-8-sig')
    metadata={'PHQ_CUTOFF':PHQ_CUTOFF,'factors':6,'K_categories':K_LEVELS,
              'income_quintiles':5,'primary_comparison':[1,5],
              'adjustments':{k:[s[0] for s in v] for k,v in specs.items()},
              'inference':'pointwise 95% CI; Holm p adjustment over 2 references x 5 K reversal tests within each adjustment; no causal claim',
              'standardization':'common complete-case C distribution, design weighted',
              'reference_mean':'income5 weighted K distribution over common C population'}
    (V2_REPORT/'econ6_definition.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf-8')
    plt=setup_matplotlib();V2_FIG.mkdir(parents=True,exist_ok=True)
    fig,axes=plt.subplots(1,2,figsize=(13,5.3))
    for ax,(label,g) in zip(axes,cells.groupby('adjustment',sort=False)):
        for e,col in [(1,'#C65B43'),(5,'#277D9A')]:
            z=g[g.income_quintile==e].set_index('K').loc[K_LEVELS]
            ax.errorbar(range(5),z.adj_prev*100,yerr=[(z.adj_prev-z.low)*100,(z.high-z.adj_prev)*100],
                        marker='o',capsize=3,label=f'소득{e}분위',color=col)
        ax.set_xticks(range(5),K_LEVELS);ax.set_title(label,loc='left')
        ax.set_xlabel('6요인 중 충족 개수');ax.set_ylabel('조정 우울 증상 비율(%)');ax.legend()
    fig.suptitle(f'PHQ-9 ≥{PHQ_CUTOFF}: 건강 생활요인 개수와 경제적 수준',x=.02,ha='left')
    fig.tight_layout();fig.savefig(V2_FIG/'econ6_income_score.png');plt.close(fig)
    print(tests.to_string(index=False),flush=True)

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser()
    parser.add_argument('--summarize-only',action='store_true',help='Apply Holm correction to existing aggregate contrasts without refitting')
    args=parser.parse_args()
    if args.summarize_only:
        path=V2_REPORT/'econ6_contrasts.csv'
        d=holm_reversals(pd.read_csv(path))
        d.to_csv(path,index=False,encoding='utf-8-sig')
        path=V2_REPORT/'econ6_definition.json'
        meta=json.loads(path.read_text(encoding='utf-8'))
        meta['inference']='pointwise 95% CI; Holm p adjustment over 2 references x 5 K reversal tests within each adjustment; no causal claim'
        path.write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
        print(d[d.reference.isin(['5분위K0~2','5분위평균'])].to_string(index=False))
    else:
        main()
