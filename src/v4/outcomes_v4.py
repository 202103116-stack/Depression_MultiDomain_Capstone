"""v4 단계 A — 결과변수 재정의: y5(PHQ-9 ≥ 5), y10(PHQ-9 ≥ 10), y_mood(우울감 경험 mtb_01z1).

실행: .venv\\Scripts\\python src/v4/outcomes_v4.py   (src/v2/preprocess_v2.py 실행 후)
산출: data/processed/v4/analysis_table_v4.csv (개인 단위, 공유 금지)
      outputs/v4/reports/a_outcomes.csv, a_outcomes_cross.csv, a_outcomes_by_group.csv (집계)
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from common_v4 import OUTCOMES, V4_PROCESSED, V4_REPORT, V4_TABLE, wmean
from common import load_v2_table
from utils import RAW_PATH


def read_mood() -> pd.DataFrame:
    parts = []
    for ch in pd.read_sas(RAW_PATH, format="sas7bdat", encoding="cp949", chunksize=50000):
        parts.append(ch[["exmprs_no", "mtb_01z1"]])
    raw = pd.concat(parts, ignore_index=True)
    vc = raw["mtb_01z1"].value_counts().to_dict()
    # 지침서: 1=예, 2=아니오, 7=응답거부, 9=모름 (2026-11-12 원자료 빈도 확인)
    assert vc == {2.0: 217073, 1.0: 14523, 9.0: 17, 7.0: 2}, vc
    raw["y_mood"] = raw["mtb_01z1"].map({1: 1.0, 2: 0.0})
    raw["exmprs_no"] = raw["exmprs_no"].astype(str)
    return raw[["exmprs_no", "y_mood"]]


def kappa(a: np.ndarray, b: np.ndarray, w: np.ndarray) -> float:
    po = np.average(a == b, weights=w)
    pa, pb = np.average(a, weights=w), np.average(b, weights=w)
    pe = pa * pb + (1 - pa) * (1 - pb)
    return float((po - pe) / (1 - pe))


def main():
    d = load_v2_table()
    mood = read_mood()
    n0 = len(d)
    d = d.merge(mood, on="exmprs_no", how="left", validate="1:1")
    assert len(d) == n0
    d["y5"] = (d["phq9_total"] >= 5).astype(float).where(d["phq9_total"].notna())
    d["y10"] = d["Y"]
    assert ((d["phq9_total"] >= 10) == (d["Y"] == 1))[d["Y"].notna()].all(), "y10은 기존 Y와 같아야 함"
    V4_PROCESSED.mkdir(parents=True, exist_ok=True)
    V4_REPORT.mkdir(parents=True, exist_ok=True)
    d.to_csv(V4_TABLE, index=False, encoding="utf-8-sig")

    s = d[d["Y"].notna()]
    w = s["wt_p"]
    rows = []
    for y, lab in OUTCOMES.items():
        ok = s[y].notna()
        rows.append({"outcome": y, "label": lab, "n": int(ok.sum()), "events": int(s.loc[ok, y].sum()),
                     "missing": int((~ok).sum()), "crude_pct": 100 * s.loc[ok, y].mean(), "weighted_pct": 100 * wmean(s[y], w),
                     "train_weighted_pct": 100 * wmean(s.loc[s.split == "train", y], s.loc[s.split == "train", "wt_p"]),
                     "test_weighted_pct": 100 * wmean(s.loc[s.split == "test", y], s.loc[s.split == "test", "wt_p"])})
    out = pd.DataFrame(rows)
    out.to_csv(V4_REPORT / "a_outcomes.csv", index=False, encoding="utf-8-sig")
    print(out.round(2).to_string(index=False))

    # 결과변수 간 겹침: 가중 교차 비율과 κ
    cross = []
    for a, b in [("y5", "y_mood"), ("y10", "y_mood"), ("y5", "y10")]:
        ok = s[a].notna() & s[b].notna()
        t = s[ok]
        for va in (0, 1):
            for vb in (0, 1):
                m = (t[a] == va) & (t[b] == vb)
                cross.append({"pair": f"{a}×{b}", a: va, b: vb, "n": int(m.sum()), "weighted_pct": 100 * t.loc[m, "wt_p"].sum() / t["wt_p"].sum()})
        k = kappa(t[a].to_numpy(), t[b].to_numpy(), t["wt_p"].to_numpy())
        pos_b_given_a = wmean(t.loc[t[a] == 1, b], t.loc[t[a] == 1, "wt_p"])
        pos_a_given_b = wmean(t.loc[t[b] == 1, a], t.loc[t[b] == 1, "wt_p"])
        cross.append({"pair": f"{a}×{b}", "kappa": k, f"P({b}|{a})": pos_b_given_a, f"P({a}|{b})": pos_a_given_b})
        print(f"{a}×{b}: κ={k:.3f}, P({b}=1|{a}=1)={pos_b_given_a:.3f}, P({a}=1|{b}=1)={pos_a_given_b:.3f}")
    pd.DataFrame(cross).to_csv(V4_REPORT / "a_outcomes_cross.csv", index=False, encoding="utf-8-sig")

    # 성별·연령대별 가중 유병률
    grp = []
    age3 = pd.cut(s["age"], [18, 39, 64, 200], labels=["19~39세", "40~64세", "65세+"]).astype(str)
    for gname, g in [("성별", s["sex"].map({1: "남", 2: "여"})), ("연령대", age3)]:
        for lv in sorted(g.dropna().unique()):
            m = g == lv
            grp.append({"group": gname, "level": lv, "n": int(m.sum()),
                        **{f"{y}_pct": 100 * wmean(s.loc[m, y], s.loc[m, "wt_p"]) for y in OUTCOMES}})
    grp = pd.DataFrame(grp)
    grp.to_csv(V4_REPORT / "a_outcomes_by_group.csv", index=False, encoding="utf-8-sig")
    print(grp.round(2).to_string(index=False))


if __name__ == "__main__":
    main()
