"""v4 보충 — 1:1 조합 30쌍을 소득 하위 20%·상위 20%에서 각각 추정해, 취약계층에서의 감소 폭과 소득 간 차이의 순위를 낸다.

실행: .venv\\Scripts\\python src/v4/ranking_income_v4.py   (outcomes_v4.py 실행 후)
산출: outputs/v4/reports/r_income_pairs.csv, r_income_tests.csv

- 쌍 구성은 ranking_v4.py와 같다(운동 4개 × 일반 5개 + 일반끼리 10쌍).
- 전체 표본(탐색 + 확인)으로 추정하므로 기술적 비교다. 걷기 + 사회적 연결의 소득 차이는 확인 세트에서 별도로 검증되었다(c1_patterns.csv).
- 같은 Influence에 두 층의 모형을 함께 등록해, 소득 차이(하위 − 상위)와 1위 쌍 vs 다른 쌍의 차이를 검정한다.
"""
from __future__ import annotations

import itertools

import numpy as np
import pandas as pd

import combo_v4 as c
from combo_patterns_v4 import Prefixed
from common_v4 import V4_REPORT, Influence, load_v4_table
from ranking_v4 import LABEL, LIFE5, SPORT4
from survey_regression_v2 import recode


def main():
    d = load_v4_table()
    r = recode(d)
    F = {k: c.FACTORS[k][1](d) for k in SPORT4}
    F.update({k: c.LIFE[k][1](d) for k in LIFE5})
    keys = list(SPORT4) + list(LIFE5)
    order = {k: i for i, k in enumerate(keys)}
    c.pair_key = lambda a, b: "|".join(sorted((a, b), key=order.get))
    pairs = [p for p in itertools.combinations(keys, 2) if not (p[0] in SPORT4 and p[1] in SPORT4)]
    S = c.strata(d, r)
    rows, tests = [], []
    for y in ("y5", "y_mood"):
        inf = Influence(d["kstrata"].to_numpy(), d["spot_key"].to_numpy())
        est = {}
        for st, pre in (("소득 하위 20%", "low|"), ("소득 상위 20%", "high|")):
            m = S[st] & d[y].notna().to_numpy()
            for a, b in pairs:
                row = c.fit_pair(d, r, F, a, b, y, m, Prefixed(inf, pre))
                est[(pre, a, b)] = row
        out = []
        for a, b in pairs:
            k = f"{c.pair_key(a, b)}|joint"
            lo_, hi_ = est[("low|", a, b)], est[("high|", a, b)]
            e, l, h, p = inf.combo({f"low|{k}": 1.0, f"high|{k}": -1.0})
            kind = "운동+일반" if a in SPORT4 or b in SPORT4 else "일반+일반"
            out.append({"outcome": y, "a": a, "b": b, "pair": f"{LABEL[a]} + {LABEL[b]}", "kind": kind,
                        "low_joint": lo_["joint"], "low_lo": lo_["joint_lo"], "low_hi": lo_["joint_hi"], "low_both_pct": lo_["both_pct"],
                        "high_joint": hi_["joint"], "high_lo": hi_["joint_lo"], "high_hi": hi_["joint_hi"],
                        "gap": 100 * e, "gap_lo": 100 * l, "gap_hi": 100 * h, "gap_p": p, "key": k})
        t = pd.DataFrame(out)
        t["rank_low"] = t["low_joint"].rank(method="min").astype(int)
        t["rank_gap"] = t["gap"].rank(method="min").astype(int)
        rows.append(t)
        # 1위 쌍 vs 2·3위, 그리고 걷기 + 사회적 연결 vs 1위
        for col, pre_list in (("low_joint", ["low|"]), ("gap", ["low|", "high|"])):
            srt = t.sort_values(col).reset_index(drop=True)
            def w(row, sign):
                if col == "low_joint":
                    return {f"low|{row.key}": sign}
                return {f"low|{row.key}": sign, f"high|{row.key}": -sign}
            ws = t[(t.a == "walk") & (t.b == "social")].iloc[0]
            comps = [(srt.iloc[0], srt.iloc[1]), (srt.iloc[0], srt.iloc[2])]
            if srt.iloc[0].key != ws.key:
                comps.append((srt.iloc[0], ws))
            for top, other in comps:
                wt = w(top, 1.0)
                for kk, v in w(other, -1.0).items():
                    wt[kk] = wt.get(kk, 0.0) + v
                e, l, h, p = inf.combo(wt)
                tests.append({"outcome": y, "measure": "하위 20% 결합 감소" if col == "low_joint" else "소득 차이(하위 − 상위)",
                              "top": top.pair, "other": other.pair, "diff": 100 * e, "lo": 100 * l, "hi": 100 * h, "p": p})
        show = t.sort_values("low_joint")[["rank_low", "pair", "kind", "low_both_pct", "low_joint", "low_lo", "low_hi", "high_joint", "gap", "gap_lo", "gap_hi", "gap_p", "rank_gap"]]
        print(f"\n[{y}] 소득 하위 20% 결합 감소 순")
        print(show.round(2).to_string(index=False))
    pd.concat(rows).drop(columns="key").to_csv(V4_REPORT / "r_income_pairs.csv", index=False, encoding="utf-8-sig")
    tt = pd.DataFrame(tests)
    tt.to_csv(V4_REPORT / "r_income_tests.csv", index=False, encoding="utf-8-sig")
    print(tt.round(3).to_string(index=False))


if __name__ == "__main__":
    main()
