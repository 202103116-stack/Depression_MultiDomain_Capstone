"""v4 단계 B — 생각1: 스포츠와 짝지을 때 특히 효과가 큰 생활요인과 권고 조합.

실행: .venv\\Scripts\\python src/v4/combo_v4.py   (outcomes_v4.py 실행 후)
산출: outputs/v4/reports/c1_*.csv (집계)

설계(decision_log D-43)
- 쌍(A, B)마다 조사설계 로지스틱 Y ~ A + B + A×B + 인구·경제·신체건강으로 4칸 조정 유병률을 구한다.
  결합 감소 = P(1,1) − P(0,0), 시너지 = P(1,1) − P(1,0) − P(0,1) + P(0,0)(가법 상호작용, 음수 = 함께할 때 더 줄어듦).
- 질문 ① 생활요인 X마다 대비 = 지표(스포츠 s, X) − 평균_{L'∈일반 5개, L'≠X} 지표(L', X).
  음수이고 유의하면 X는 "s와 짝지을 때 특히 효과가 큰" 생활요인이다. 여러 모형에 걸친 대비의 분산은
  common_v4.Influence(PSU 단위 영향함수)로 구한다.
- 질문 ② 스포츠 s마다 결합 감소·시너지가 큰 X의 순위와 짝 간 동일성 검정.
- 탐색 세트(기존 학습셋)에서 운동 정의·층·결과변수를 넓게 시도해 모두 c1_specs.csv에 남기고,
  미리 정한 규칙으로 후보를 골라 확인 세트(기존 시험셋)에서 한 번 검정한다(Holm 보정).
"""
from __future__ import annotations

import sys
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
import pandas as pd

from common_v4 import V4_REPORT, Influence, fit_logit, load_v4_table, wmean

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "v3"))
from common_v3 import adj_design  # noqa: E402
from survey_regression_v2 import COMBO_ADJUST, CONTEXT_PARTNERS, PARTNERS, recode  # noqa: E402


def _yes(col, val=1):
    return lambda d: (d[col] == val).astype(float).where(d[col].notna())


# 스포츠 요인: 주 정의 4개(v3 운동 요인 + 신체활동 권고) + 탐색용 변형 3개
SPORT_MAIN = {
    "walk": ("걷기 실천(주 5일·30분)", _yes("walk_ok")),
    "aerobic": ("중강도 이상 유산소", _yes("aerobic_ok")),
    "strength": ("근력운동 주 2일+", _yes("strength_ok")),
    "pa_guide": ("신체활동 권고 충족", _yes("pa_guideline")),
}
SPORT_VAR = {
    "met600": ("주 600 MET-분 이상(WHO 권고량)",
               lambda d: (d["log_met_min"] >= np.log1p(600)).astype(float).where(d["log_met_min"].notna())),
    "walk3": ("걷기 주 3일 이상(시간 무관)", lambda d: (d["walk_days"] >= 3).astype(float).where(d["walk_days"].notna())),
    "strength1": ("근력운동 주 1일+", lambda d: (d["strength_code"] >= 2).astype(float).where(d["strength_code"].notna())),
}
SPORTS = {**SPORT_MAIN, **SPORT_VAR}
# 일반 생활요인: 주 5개(D-38) + 탐색용 3개(수면은 증상근접, 이웃 신뢰·동네 안전은 맥락 요인)
LIFE_KEYS = {"담배제품 미사용": "tobacco", "고위험음주 아님": "alcohol", "아침식사 주 5회 이상": "breakfast",
             "사회적 연결": "social", "저녁 후·잠자기 전 칫솔질": "brushing", "주중 수면 7~9시간": "sleep",
             "이웃을 신뢰함": "trust", "동네가 안전하다고 느낌": "safety"}
LIFE = {LIFE_KEYS[name]: (name, fn) for name, _, fn, _ in PARTNERS + CONTEXT_PARTNERS}
LIFE_MAIN = ["tobacco", "alcohol", "breakfast", "social", "brushing"]
LIFE_EXPL = ["sleep", "trust", "safety"]
FACTORS = {k: v for k, v in {**SPORTS, **LIFE}.items()}
LABEL = {k: v[0] for k, v in FACTORS.items()}

OUTCOMES_EXPLORE = ["y5", "y_mood"]
MAX_CANDIDATES = 5  # 확인 세트 검정력 보존을 위한 후보 상한(D-43)


def strata(d: pd.DataFrame, r: pd.DataFrame) -> dict[str, np.ndarray]:
    age = d["age"]
    inc = r["inc_q"]
    return {
        "전체": np.ones(len(d), bool),
        "남성": (d["sex"] == 1).to_numpy(), "여성": (d["sex"] == 2).to_numpy(),
        "19~39세": age.between(19, 39).to_numpy(), "40~64세": age.between(40, 64).to_numpy(), "65세+": (age >= 65).to_numpy(),
        "소득 하위 20%": (inc == "1분위(하)").to_numpy(), "소득 중위 60%": inc.isin(["2분위", "3분위", "4분위"]).to_numpy(),
        "소득 상위 20%": (inc == "5분위(상)").to_numpy(),
    }


def needed_pairs(sports: list[str], xs: list[str]) -> list[tuple[str, str]]:
    """스포츠 × X, 그리고 대비의 기준이 되는 (일반 L', X) 쌍."""
    pairs = [(s, x) for s in sports for x in xs]
    for x in xs:
        for lp in LIFE_MAIN:
            if lp != x:
                pairs.append(tuple(sorted((lp, x), key=list(LIFE).index)))
    return list(dict.fromkeys(pairs))


def pair_key(a: str, b: str) -> str:
    if a in LIFE and b in LIFE:
        a, b = sorted((a, b), key=list(LIFE).index)
    return f"{a}|{b}"


def fit_pair(d, r, F, a, b, y, mask, inf: Influence) -> dict:
    Xadj = adj_design(r, COMBO_ADJUST, mask)
    X = Xadj.copy()
    X["A"], X["B"] = F[a], F[b]
    X["AB"] = F[a] * F[b]
    try:
        mdl = fit_logit(X, d, y, mask)
    except np.linalg.LinAlgError:
        # 작은 층(확인 세트의 소득 집단 등)에서 희소 범주로 설계행렬이 특이해지면 해당 층 30명 미만 조정 더미를 뺀다
        rare = [c for c in Xadj.columns if c != "const" and X.loc[mask, c].fillna(0).sum() < 30]
        mdl = fit_logit(X.drop(columns=rare), d, y, mask)
    j = [mdl.names.index(n) for n in ("A", "B", "AB")]
    cf = {}
    for va in (0, 1):
        for vb in (0, 1):
            Xc = mdl.X.copy()
            Xc[:, j[0]], Xc[:, j[1]], Xc[:, j[2]] = va, vb, va * vb
            cf[(va, vb)] = Xc
    g = mdl.margins(cf)
    lin = lambda w: (sum(c * g[k][0] for k, c in w.items()), sum(c * g[k][1] for k, c in w.items()))
    key = pair_key(a, b)
    q = {f"{key}|joint": lin({(1, 1): 1, (0, 0): -1}),
         f"{key}|syn": lin({(1, 1): 1, (1, 0): -1, (0, 1): -1, (0, 0): 1})}
    inf.add(mdl, q)
    dom = mdl.domain
    w = d["wt_p"].to_numpy()
    both = dom & (F[a] == 1).to_numpy() & (F[b] == 1).to_numpy()
    row = {"pair": key, "a": a, "b": b, "n": int(dom.sum()), "both_pct": 100 * w[both].sum() / w[dom].sum()}
    for (va, vb), (e, gr) in g.items():
        row[f"p{va}{vb}"] = 100 * e
    for name in ("joint", "syn"):
        e, lo, hi, p = mdl.contrast(*q[f"{key}|{name}"])
        row.update({f"{name}": 100 * e, f"{name}_lo": 100 * lo, f"{name}_hi": 100 * hi, f"{name}_p": p})
    return row


def contrast(inf: Influence, s: str, x: str, metric: str) -> dict:
    refs = [lp for lp in LIFE_MAIN if lp != x]
    w = {f"{pair_key(s, x)}|{metric}": 1.0}
    for lp in refs:
        w[f"{pair_key(lp, x)}|{metric}"] = w.get(f"{pair_key(lp, x)}|{metric}", 0.0) - 1.0 / len(refs)
    e, lo, hi, p = inf.combo(w)
    ref = np.mean([inf.est[f"{pair_key(lp, x)}|{metric}"] for lp in refs])
    return {"sport_val": 100 * inf.est[f"{pair_key(s, x)}|{metric}"], "ref_mean": 100 * ref,
            "contrast": 100 * e, "lo": 100 * lo, "hi": 100 * hi, "p": p}


# ---------------------------------------------------------------------------
# 병렬 작업자(탐색 세트: 결과변수 × 층)
# ---------------------------------------------------------------------------
_G: dict = {}


def _init():
    d = load_v4_table()
    r = recode(d)
    F = {k: fn(d) for k, (_, fn) in FACTORS.items()}
    _G.update(d=d, r=r, F=F, S=strata(d, r))


def run_cell(args):
    y, sname, split, sports, xs = args
    d, r, F = _G["d"], _G["r"], _G["F"]
    mask = _G["S"][sname] & (d["split"] == split).to_numpy() & d[y].notna().to_numpy()
    inf = Influence(d["kstrata"].to_numpy(), d["spot_key"].to_numpy())
    tag = {"outcome": y, "stratum": sname, "set": split}
    pairs = [{**tag, **fit_pair(d, r, F, a, b, y, mask, inf)} for a, b in needed_pairs(sports, xs)]
    specs = [{**tag, "sport": s, "x": x, "metric": m, **contrast(inf, s, x, m)}
             for s in sports for x in xs for m in ("syn", "joint")]
    ranks = []
    for s in (sports if set(LIFE_MAIN) <= set(xs) else []):
        ranks.append({**tag, "sport": s, "equal_joint_p": inf.wald_equal([f"{pair_key(s, x)}|joint" for x in LIFE_MAIN]),
                      "equal_syn_p": inf.wald_equal([f"{pair_key(s, x)}|syn" for x in LIFE_MAIN])})
    return pairs, specs, ranks


def holm(p: np.ndarray) -> np.ndarray:
    order = np.argsort(p)
    adj = np.empty(len(p))
    run = 0.0
    for i, k in enumerate(order):
        run = max(run, (len(p) - i) * p[k])
        adj[k] = min(1.0, run)
    return adj


def main():
    V4_REPORT.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    d0 = load_v4_table()
    snames = list(strata(d0, recode(d0)))
    sports_all, xs_all = list(SPORTS), LIFE_MAIN + LIFE_EXPL

    # ---------------- 1) 탐색 세트: 넓게 시도하고 전부 기록 ----------------
    if "--reuse-explore" in sys.argv:  # 탐색 결과(약 27분)를 다시 계산하지 않고 확인 단계만 다시 실행
        pairs = pd.read_csv(V4_REPORT / "c1_pairs_explore.csv")
        specs = pd.read_csv(V4_REPORT / "c1_specs.csv")
    else:
        tasks = [(y, s, "train", sports_all, xs_all) for y in OUTCOMES_EXPLORE for s in snames]
        with ProcessPoolExecutor(max_workers=6, initializer=_init) as ex:
            res = list(ex.map(run_cell, tasks))
        pairs = pd.DataFrame([p for r_ in res for p in r_[0]])
        specs = pd.DataFrame([p for r_ in res for p in r_[1]])
        ranks = pd.DataFrame([p for r_ in res for p in r_[2]])
        for t in (pairs, specs):
            for c in ("a", "b", "sport", "x"):
                if c in t:
                    t[c + "_label"] = t[c].map(LABEL)
        pairs.to_csv(V4_REPORT / "c1_pairs_explore.csv", index=False, encoding="utf-8-sig")
        specs.to_csv(V4_REPORT / "c1_specs.csv", index=False, encoding="utf-8-sig")
        ranks.to_csv(V4_REPORT / "c1_rank_equality_explore.csv", index=False, encoding="utf-8-sig")
    print(f"탐색: 모형 {len(pairs)}개, 대비 {len(specs)}개 ({time.time() - t0:.0f}초)")

    # ---------------- 2) 후보 선정 규칙(D-43) ----------------
    # y5에서 대비 < 0, p < .05 이고, 같은 층·스포츠·X·지표의 y_mood 대비도 < 0 인 것. y5 p 오름차순 상위 5개.
    key = ["stratum", "sport", "x", "metric"]
    a = specs[specs.outcome == "y5"].set_index(key)
    b = specs[specs.outcome == "y_mood"].set_index(key)
    m = a.join(b[["contrast", "p"]], rsuffix="_mood")
    cand = m[(m.contrast < 0) & (m.p < 0.05) & (m.contrast_mood < 0)].sort_values("p").head(MAX_CANDIDATES).reset_index()
    n_tried = len(a)
    cand.to_csv(V4_REPORT / "c1_candidates.csv", index=False, encoding="utf-8-sig")
    print(f"후보 {len(cand)}개 (y5 대비 시도 {n_tried}개 중 규칙 통과 {int(((m.contrast < 0) & (m.p < 0.05) & (m.contrast_mood < 0)).sum())}개)")
    print(cand[key + ["contrast", "lo", "hi", "p", "contrast_mood"]].round(3).to_string(index=False))

    # ---------------- 3) 확인 세트: 후보만 검정(Holm) + y_mood·y10 재현 ----------------
    _init()
    conf = []
    for y in ("y5", "y_mood", "y10"):
        for (sname, metric), grp in cand.groupby(["stratum", "metric"]):
            sports, xs = sorted(set(grp.sport)), sorted(set(grp.x))
            pr, sp, _ = run_cell((y, sname, "test", sports, xs))
            sp = pd.DataFrame(sp)
            sp = sp[sp.metric == metric].merge(grp[["sport", "x"]], on=["sport", "x"])
            conf.append(sp)
    conf = pd.concat(conf, ignore_index=True) if conf else pd.DataFrame()
    if len(conf):
        main_ = conf.outcome == "y5"
        conf.loc[main_, "p_holm"] = holm(conf.loc[main_, "p"].to_numpy())
        conf["sport_label"], conf["x_label"] = conf.sport.map(LABEL), conf.x.map(LABEL)
    conf.to_csv(V4_REPORT / "c1_confirm.csv", index=False, encoding="utf-8-sig")
    if len(conf):
        print(conf[["outcome", "stratum", "sport", "x", "metric", "contrast", "lo", "hi", "p", "p_holm"]].round(4).to_string(index=False))

    # ---------------- 4) 질문 ②·③: 주 스포츠별 최적 짝(탐색에서 선택 → 확인 세트 추정) ----------------
    ex_all = pairs[(pairs.outcome == "y5") & (pairs.stratum == "전체") & pairs.a.isin(SPORT_MAIN) & pairs.b.isin(LIFE_MAIN)]
    best = ex_all.loc[ex_all.groupby("a")["joint"].idxmin(), ["a", "b", "joint", "syn"]].rename(
        columns={"joint": "explore_joint", "syn": "explore_syn"})
    rec = []
    for y in ("y5", "y_mood", "y10"):
        for sname in ("전체", "소득 하위 20%", "소득 상위 20%"):
            pr, _, rk = run_cell((y, sname, "test", list(SPORT_MAIN), LIFE_MAIN))
            pr = pd.DataFrame(pr)
            pr = pr[pr.a.isin(SPORT_MAIN)]
            rk = pd.DataFrame(rk)
            pr = pr.merge(rk[["sport", "equal_joint_p", "equal_syn_p"]], left_on="a", right_on="sport").drop(columns="sport")
            rec.append(pr)
    rec = pd.concat(rec, ignore_index=True)
    rec["a_label"], rec["b_label"] = rec.a.map(LABEL), rec.b.map(LABEL)
    rec["chosen_in_explore"] = rec.set_index(["a", "b"]).index.isin(best.set_index(["a", "b"]).index)
    rec.to_csv(V4_REPORT / "c1_rank_confirm.csv", index=False, encoding="utf-8-sig")
    best.to_csv(V4_REPORT / "c1_best_partner_explore.csv", index=False, encoding="utf-8-sig")
    show = rec[(rec.outcome == "y5") & (rec.stratum == "전체")].sort_values(["a", "joint"])
    print(show[["a", "b", "both_pct", "p00", "p11", "joint", "joint_lo", "joint_hi", "syn", "syn_lo", "syn_hi", "equal_joint_p"]].round(3).to_string(index=False))
    print(f"완료 {time.time() - t0:.0f}초")


if __name__ == "__main__":
    main()
