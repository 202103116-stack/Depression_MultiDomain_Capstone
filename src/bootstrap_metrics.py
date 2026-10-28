"""Exact weighted AP/AUC with cached score ordering for household bootstrap."""
import numpy as np

class OrderedMetrics:
    def __init__(self,y,p,group_codes):
        order=np.argsort(-np.asarray(p),kind='stable')
        self.y=np.asarray(y)[order]
        self.groups=np.asarray(group_codes)[order]
        scores=np.asarray(p)[order]
        self.ends=np.r_[np.flatnonzero(np.diff(scores)),len(scores)-1]

    def evaluate(self,group_counts):
        w=group_counts[self.groups]
        tp=np.cumsum(w*self.y)[self.ends]
        fp=np.cumsum(w*(1-self.y))[self.ends]
        if tp[-1]==0 or fp[-1]==0:return np.nan,np.nan
        precision=np.divide(tp,tp+fp,out=np.zeros_like(tp,dtype=float),where=(tp+fp)>0)
        tpr=np.r_[0.,tp/tp[-1]];fpr=np.r_[0.,fp/fp[-1]]
        ap=float(np.sum(np.diff(tpr)*precision))
        auc=float(np.trapezoid(tpr,fpr))
        return ap,auc
