"""v4 단계 E-2 — 연구 1 RQ1(영역 기여도)을 주 결과 y5로 다시 낸다: CatBoost 영역 단독 추가·고유 제거 ΔAP.

실행: .venv\\Scripts\\python src/v4/domain_ml_y5_v4.py   (train_cross_v4.py 실행 후, 약 40분)
산출: outputs/v4/reports/e1_ml_domains.csv

v2 train_v2.py와 같은 설계(같은 분할·하이퍼파라미터, 시험셋 가구 부트스트랩 ΔAP)에서 결과변수만 y5로 바꾼다.
- 단독 기여: (인구 + 영역) − 인구
- 고유 기여: 전체 − (전체 − 영역)
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

from common_v4 import V4_REPORT, load_v4_table
from train_cross_v4 import fit_predict, perf_row

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "v2"))
from common import ADDABLE_DOMAINS, DOMAINS, MAIN_DOMAINS  # noqa: E402
from modeling import group_bootstrap_delta  # noqa: E402
from preprocess_v2 import domain_features  # noqa: E402


def main():
    d = load_v4_table()
    train, test = d[d["split"] == "train"].reset_index(drop=True), d[d["split"] == "test"].reset_index(drop=True)
    y, hh = test["y5"].to_numpy(float), test["household_key"].to_numpy()
    sets = {"base": ["demo"], "full": list(MAIN_DOMAINS)}
    for dom in ADDABLE_DOMAINS:
        sets[f"base+{dom}"] = ["demo", dom]
    for dom in MAIN_DOMAINS:
        sets[f"full-{dom}"] = [x for x in MAIN_DOMAINS if x != dom]
    preds = {}
    for name, doms in sets.items():
        num, cat = domain_features(doms)
        tag = "y5__none" if name == "full" else f"e1_{name}"
        preds[name], _, _ = fit_predict(train, test, num, cat, "y5", "none", tag)
    rows = [perf_row(y, preds["base"], hh, set="base", kind="기준"), perf_row(y, preds["full"], hh, set="full", kind="전체")]
    for dom in MAIN_DOMAINS:
        for kind, new, ref in (("단독", f"base+{dom}", "base"), ("고유", "full", f"full-{dom}")):
            if new not in preds or ref not in preds:
                continue
            r = group_bootstrap_delta(y.astype(int), preds[new], preds[ref], hh, n_boot=500)
            rows.append({"set": new, "kind": kind, "domain": dom, "domain_label": DOMAINS[dom],
                         "dAP": r["dAP_vs_M0"], "dAP_lo": r["dAP_CI_low"], "dAP_hi": r["dAP_CI_high"]})
    out = pd.DataFrame(rows)
    out.to_csv(V4_REPORT / "e1_ml_domains.csv", index=False, encoding="utf-8-sig")
    print(out[["set", "kind", "domain_label", "AP", "dAP", "dAP_lo", "dAP_hi"]].round(4).to_string(index=False))


if __name__ == "__main__":
    main()
