"""H1 with the same score categories/adjustment sets as economic H2.

Retain reg_v2_* as direct legacy replication; this file reports the harmonized
proposal model without re-adjusting for household type, a score component.
"""
import numpy as np
import pandas as pd
import common
from common import V2_REPORT,load_v2_table
from survey_regression_v2 import SPEC,design,fit,recode
from economic_lifestyle import score6,K_LEVELS

def main(social_unknown_missing=False):
    d=load_v2_table();d=d[d.Y.notna()].reset_index(drop=True)
    if social_unknown_missing:
        d['social_connected']=d.social_connected.where(d.neighbor_events.ne(9))
    r=recode(d)
    k=score6(d);kg=pd.cut(k,[-1,2,3,4,5,6],labels=K_LEVELS).astype(object)
    spec0=[s for s in SPEC if s[2]=='demo' and s[0]!='hh_type']+[s for s in SPEC if s[0]=='inc_q']
    specs={'인구·소득보정':spec0,'신체건강추가':spec0+[s for s in SPEC if s[2]=='phys']}
    rows=[];tests=[]
    for name,spec in specs.items():
        base,_=design(r,spec);X=base.copy()
        terms=['K='+v for v in K_LEVELS[1:]]
        for v,t in zip(K_LEVELS[1:],terms):X[t]=kg.eq(v).astype(float).where(kg.notna())
        model=fit(X,d,np.ones(len(d),bool))
        for v in K_LEVELS:
            xc=model.X.copy()
            for t in terms:xc[:,model.names.index(t)]=0
            if v!='0~2':xc[:,model.names.index('K='+v)]=1
            est,grad=model.margins({'v':xc})['v'];p,lo,hi,_=model.contrast(est,grad)
            m=model.domain&kg.eq(v).to_numpy()
            rows.append({'adjustment':name,'K':v,'n_model':int(m.sum()),'events':int(d.loc[m,'Y'].sum()),
                         'adj_prev':p,'low':lo,'high':hi})
        Xt=base.copy();Xt['K']=k
        trend=fit(Xt,d,np.ones(len(d),bool)).table().set_index('term').loc['K']
        tests.append({'adjustment':name,'n_model':int(model.domain.sum()),'joint_p':model.wald(terms)['p'],
                      'trend_OR':trend.OR,'trend_low':trend.OR_low,'trend_high':trend.OR_high,'trend_p':trend.p})
    prefix='h1_score6_social_unknown_missing' if social_unknown_missing else 'h1_score6'
    pd.DataFrame(rows).to_csv(V2_REPORT/(prefix+'_cells.csv'),index=False,encoding='utf-8-sig')
    pd.DataFrame(tests).to_csv(V2_REPORT/(prefix+'_tests.csv'),index=False,encoding='utf-8-sig')
    print(pd.DataFrame(tests).to_string(index=False))

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser()
    parser.add_argument('--social-unknown-missing',action='store_true',help='Treat neighbor-event unknown code9 as missing in the social score; retain primary results separately')
    main(parser.parse_args().social_unknown_missing)
