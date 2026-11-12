"""v4 보충 — 1:1 두 요인 조합 30개(운동끼리 제외)의 우울 증상 감소 순위(운동 4개 × 일반 생활요인 5개, 서로 모든 쌍).

실행: .venv\\Scripts\\python src/v4/ranking_v4.py   (outcomes_v4.py 실행 후)
산출: outputs/v4/reports/r_pairs.csv(30쌍 순위), r_by_factor.csv(생활요인별 짝 순위와 1위 vs 비교 대상 차이 검정)

- 운동 4개: 연구에서 정의한 그대로(combo_v4.SPORT_MAIN) — 걷기 실천(주 5일·30분), 중강도 이상 유산소(지침서 ph_a0500),
  근력운동 주 2일 이상, 신체활동 권고 충족(유산소 + 근력).
- 일반 생활요인 5개: 담배제품 미사용, 고위험음주 아님, 아침식사 주 5회 이상, 사회적 연결, 저녁 후 칫솔질(D-38).
- 쌍마다 4칸 조정 유병률(인구·경제·신체건강 조정) → 결합 감소 = 둘 다 충족 − 둘 다 아님. 전체 표본, 결과 y5(재현 y_mood).
- 순위 차이는 같은 Influence(PSU 영향함수)로 대비 검정한다.
"""
from __future__ import annotations

import itertools

import numpy as np
import pandas as pd

import combo_v4 as c
from common_v4 import V4_REPORT, Influence, load_v4_table
from survey_regression_v2 import recode

SPORT4 = {"walk": "걷기", "aerobic": "중강도 이상 유산소", "strength": "근력운동", "pa_guide": "신체활동 권고 충족"}
LIFE5 = {"tobacco": "담배 미사용", "alcohol": "고위험음주 아님", "breakfast": "아침식사", "social": "사회적 연결", "brushing": "저녁 칫솔질"}
LABEL = {**SPORT4, **LIFE5}


def main():
    d = load_v4_table()
    r = recode(d)
    F = {k: c.FACTORS[k][1](d) for k in SPORT4}
    F.update({k: c.LIFE[k][1](d) for k in LIFE5})
    keys = list(SPORT4) + list(LIFE5)
    order = {k: i for i, k in enumerate(keys)}
    # 운동끼리의 쌍은 제외: 정의가 겹쳐(권고 충족 ⊂ 근력운동 등) 빈 칸이 생기고, 질문은 생활요인의 짝 비교다
    pairs = [p for p in itertools.combinations(keys, 2) if not (p[0] in SPORT4 and p[1] in SPORT4)]
    c.pair_key = lambda a, b: "|".join(sorted((a, b), key=order.get))  # 이 스크립트의 요인 순서로 키를 만든다

    rows, tests = [], []
    for y in ("y5", "y_mood"):
        mask = d[y].notna().to_numpy()
        inf = Influence(d["kstrata"].to_numpy(), d["spot_key"].to_numpy())
        res = []
        for a, b in pairs:
            row = c.fit_pair(d, r, F, a, b, y, mask, inf)
            kind = "운동+운동" if a in SPORT4 and b in SPORT4 else ("운동+일반" if a in SPORT4 or b in SPORT4 else "일반+일반")
            res.append({"outcome": y, "a": a, "b": b, "a_label": LABEL[a], "b_label": LABEL[b], "kind": kind, **row})
        t = pd.DataFrame(res).sort_values("joint").reset_index(drop=True)
        t["rank_all"] = np.arange(1, len(t) + 1)
        rows.append(t)
        print(f"[{y}] 30쌍 결합 감소 순위")
        print(t[["rank_all", "a_label", "b_label", "kind", "both_pct", "p00", "p11", "joint", "joint_lo", "joint_hi", "syn"]].round(2).to_string(index=False))

        # 생활요인(일반 5개)마다 8개 짝의 순위, 1위 짝 vs 운동 중 최고 짝 차이 검정
        key = lambda a, b: f"{c.pair_key(a, b)}|joint"
        for x in LIFE5:
            sub = t[(t.a == x) | (t.b == x)].copy()
            sub["partner"] = np.where(sub.a == x, sub.b, sub.a)
            sub = sub.sort_values("joint").reset_index(drop=True)
            sub["rank_in_x"] = np.arange(1, len(sub) + 1)
            best = sub.iloc[0]
            best_sport = sub[sub.partner.isin(SPORT4)].iloc[0]
            for _, s in sub.iterrows():
                tests.append({"outcome": y, "x": x, "x_label": LIFE5[x], "partner": s.partner, "partner_label": LABEL[s.partner],
                              "partner_is_sport": s.partner in SPORT4, "rank_in_x": int(s.rank_in_x), "joint": s.joint,
                              "joint_lo": s.joint_lo, "joint_hi": s.joint_hi, "rank_all": int(s.rank_all)})
            if best.partner != best_sport.partner:
                e, lo, hi, p = inf.combo({key(x, best_sport.partner): 1.0, key(x, best.partner): -1.0})
                tests.append({"outcome": y, "x": x, "x_label": LIFE5[x], "partner": f"{best_sport.partner} − {best.partner}",
                              "partner_label": f"운동 최고({LABEL[best_sport.partner]}) − 1위({LABEL[best.partner]})",
                              "partner_is_sport": None, "joint": 100 * e, "joint_lo": 100 * lo, "joint_hi": 100 * hi, "p": p})
        # 걷기의 짝 순위와 1위 vs 2·3위
        w = t[(t.a == "walk") | (t.b == "walk")].copy()
        w["partner"] = np.where(w.a == "walk", w.b, w.a)
        w = w[w.partner.isin(LIFE5)].sort_values("joint").reset_index(drop=True)
        for k in (1, 2):
            e, lo, hi, p = inf.combo({key("walk", w.partner[0]): 1.0, key("walk", w.partner[k]): -1.0})
            tests.append({"outcome": y, "x": "walk", "x_label": "걷기", "partner": f"{w.partner[0]} − {w.partner[k]}",
                          "partner_label": f"걷기 짝 1위({LABEL[w.partner[0]]}) − {k + 1}위({LABEL[w.partner[k]]})",
                          "joint": 100 * e, "joint_lo": 100 * lo, "joint_hi": 100 * hi, "p": p})

    pd.concat(rows).to_csv(V4_REPORT / "r_pairs.csv", index=False, encoding="utf-8-sig")
    tt = pd.DataFrame(tests)
    tt.to_csv(V4_REPORT / "r_by_factor.csv", index=False, encoding="utf-8-sig")
    print(tt[tt.outcome == "y5"].round(3).to_string(index=False))


if __name__ == "__main__":
    main()
