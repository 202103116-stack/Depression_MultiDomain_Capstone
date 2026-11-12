"""v4 단계 B-2 — 탐색 세트에서 드러난 패턴 두 가지를 확인 세트에서 한 번 검정한다(D-43 절차).

실행: .venv\\Scripts\\python src/v4/combo_patterns_v4.py   (combo_v4.py 실행 후)
산출: outputs/v4/reports/c1_patterns.csv

탐색 결과(c1_pairs_explore.csv)에서 본 패턴과 확인 가설
- P1 겹치지 않음: 운동 × 생활요인 쌍의 시너지(가법 상호작용)는 거의 0인데, 일반 생활요인끼리의 쌍은 대부분 양수
  (함께해도 각각의 합보다 덜 줄어듦 = 효과가 겹침). 가설: 평균 시너지(운동 s, X) − 평균 시너지(생활요인 쌍) < 0.
- P2 경제 연결: 운동 + 사회적 연결을 함께 충족할 때의 결합 감소가 소득 하위 20%에서 상위 20%보다 크다
  (탐색: 걷기 −11.7 vs −2.5%p, 네 운동 모두 같은 방향, y_mood도 같은 방향). 가설: 결합 감소(하위) − 결합 감소(상위) < 0.
- 가설군마다 운동 4개에 Holm 보정. 확인 세트 y5가 주 결과이고 y_mood·y10은 방향 재현만 본다.
"""
from __future__ import annotations

import itertools

import numpy as np
import pandas as pd

import combo_v4 as c
from common_v4 import V4_REPORT, Influence


class Prefixed:
    """같은 Influence에 서로 다른 층의 모형을 등록할 때 키 충돌을 막는다."""

    def __init__(self, inf: Influence, prefix: str):
        self.inf, self.prefix = inf, prefix

    def add(self, mdl, q):
        self.inf.add(mdl, {f"{self.prefix}{k}": v for k, v in q.items()})


def main():
    c._init()
    d, r, F, S = c._G["d"], c._G["r"], c._G["F"], c._G["S"]
    sports = list(c.SPORT_MAIN)
    ll_pairs = list(itertools.combinations(c.LIFE_MAIN, 2))
    rows = []
    for y in ("y5", "y_mood", "y10"):
        test = (d["split"] == "test").to_numpy() & d[y].notna().to_numpy()
        inf = Influence(d["kstrata"].to_numpy(), d["spot_key"].to_numpy())

        # P1: 전체 층 — 운동 × 생활요인 5개, 생활요인끼리 10쌍
        for s in sports:
            for x in c.LIFE_MAIN:
                c.fit_pair(d, r, F, s, x, y, test, Prefixed(inf, "all|"))
        for a, b in ll_pairs:
            c.fit_pair(d, r, F, a, b, y, test, Prefixed(inf, "all|"))
        ll_mean = {f"all|{c.pair_key(a, b)}|syn": -1.0 / len(ll_pairs) for a, b in ll_pairs}
        for s in sports:
            w = {f"all|{c.pair_key(s, x)}|syn": 1.0 / len(c.LIFE_MAIN) for x in c.LIFE_MAIN}
            w.update(ll_mean)
            e, lo, hi, p = inf.combo(w)
            sport_mean = np.mean([inf.est[f"all|{c.pair_key(s, x)}|syn"] for x in c.LIFE_MAIN])
            ll = np.mean([inf.est[f"all|{c.pair_key(a, b)}|syn"] for a, b in ll_pairs])
            rows.append({"hypothesis": "P1 겹치지 않음", "outcome": y, "sport": s, "partner": "생활요인 5개 평균",
                         "value_1": 100 * sport_mean, "value_2": 100 * ll, "value_1_label": "운동 쌍 평균 시너지",
                         "value_2_label": "생활요인 쌍 평균 시너지", "contrast": 100 * e, "lo": 100 * lo, "hi": 100 * hi, "p": p})

        # P2: 소득 하위 vs 상위 — 운동 + 사회적 연결의 결합 감소
        for sname, pre in (("소득 하위 20%", "low|"), ("소득 상위 20%", "high|")):
            m = test & S[sname]
            for s in sports:
                c.fit_pair(d, r, F, s, "social", y, m, Prefixed(inf, pre))
        for s in sports:
            k = f"{c.pair_key(s, 'social')}|joint"
            e, lo, hi, p = inf.combo({f"low|{k}": 1.0, f"high|{k}": -1.0})
            rows.append({"hypothesis": "P2 경제 연결", "outcome": y, "sport": s, "partner": "social",
                         "value_1": 100 * inf.est[f"low|{k}"], "value_2": 100 * inf.est[f"high|{k}"],
                         "value_1_label": "하위 20% 결합 감소", "value_2_label": "상위 20% 결합 감소",
                         "contrast": 100 * e, "lo": 100 * lo, "hi": 100 * hi, "p": p})
        print(f"{y} 완료", flush=True)

    out = pd.DataFrame(rows)
    for h in out.hypothesis.unique():
        m = (out.hypothesis == h) & (out.outcome == "y5")
        out.loc[m, "p_holm"] = c.holm(out.loc[m, "p"].to_numpy())
    out["sport_label"] = out.sport.map(c.LABEL)
    out.to_csv(V4_REPORT / "c1_patterns.csv", index=False, encoding="utf-8-sig")
    print(out[["hypothesis", "outcome", "sport", "value_1", "value_2", "contrast", "lo", "hi", "p", "p_holm"]].round(3).to_string(index=False))


if __name__ == "__main__":
    main()
