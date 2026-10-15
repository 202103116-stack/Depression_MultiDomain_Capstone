"""M0~M3 × 알고리즘 학습·평가 실행.

실행: python src/train_models.py [--algos logistic catboost ...] [--blocks M0 M1 ...] [--no-cv] [--sensitivity]
산출:
  outputs/reports/model_comparison.csv   M0~M3 × 알고리즘 전체 지표 + M0 대비 개선량(가구 부트스트랩 95% CI)
  outputs/reports/model_sensitivity.csv  (--sensitivity) 친구 대신 친척/이웃 연락빈도를 쓴 M2/M3
  outputs/figures/model_*.png            성능 비교·PR 곡선·보정곡선
  data/processed/model_runs/             조합별 결과·시험셋 예측 캐시(개인 단위 → 공유 금지, git 제외)

절차: 학습셋(80%) 안에서 household_key 그룹 5-fold CV → 학습셋 전체로 재적합 → 잠근 시험셋(20%)에서 1회 평가.
하이퍼파라미터는 사전 고정(튜닝 없음)이므로 시험셋으로 설정을 고르는 일은 없다.
"""
from __future__ import annotations

import argparse
import json
import time

import numpy as np
import pandas as pd
from sklearn.calibration import calibration_curve
from sklearn.metrics import average_precision_score, roc_auc_score, precision_recall_curve

from modeling import (ALGO_LABELS, ALGORITHMS, block_features, build_model, evaluate, group_bootstrap_delta,
                      group_cv, make_X)
from utils import FIG_DIR, PALETTE, INK_MUTED, PROCESSED_DIR, REPORT_DIR, load_analysis_table, setup_matplotlib

BLOCKS = ["M0", "M1", "M2", "M3"]
RUN_DIR = PROCESSED_DIR / "model_runs"


def run_one(train, test, block, algo, contact, n_folds, tag):
    """한 조합 학습·평가. 결과는 RUN_DIR에 캐시해 재실행 시 건너뛴다."""
    meta_path = RUN_DIR / f"{tag}.json"
    pred_path = RUN_DIR / f"{tag}_test_pred.csv"
    if meta_path.exists() and pred_path.exists():
        return json.loads(meta_path.read_text(encoding="utf-8")), pd.read_csv(pred_path)["p"].to_numpy()

    num, cat = block_features(block, contact)
    Xtr, ytr = make_X(train, block, contact), train["Y"].astype(int).to_numpy()
    Xte, yte = make_X(test, block, contact), test["Y"].astype(int).to_numpy()
    groups = train["household_key"].to_numpy()

    res = {"block": block, "algo": algo, "contact": contact, "n_train": len(Xtr), "n_test": len(Xte),
           "n_input_vars": len(num) + len(cat)}
    if n_folds:
        aps, aucs = [], []
        for k, (i_tr, i_va) in enumerate(group_cv(n_folds).split(Xtr, ytr, groups)):
            m = build_model(algo, num, cat).fit(Xtr.iloc[i_tr], ytr[i_tr])
            p = m.predict_proba(Xtr.iloc[i_va])[:, 1]
            aps.append(average_precision_score(ytr[i_va], p))
            aucs.append(roc_auc_score(ytr[i_va], p))
        res.update({"cv_AP_mean": np.mean(aps), "cv_AP_sd": np.std(aps, ddof=1),
                    "cv_AUC_mean": np.mean(aucs), "cv_AUC_sd": np.std(aucs, ddof=1)})

    t0 = time.time()
    model = build_model(algo, num, cat).fit(Xtr, ytr)
    res["fit_seconds"] = round(time.time() - t0, 1)
    p_test = model.predict_proba(Xte)[:, 1]
    res.update({f"test_{k}": v for k, v in evaluate(yte, p_test).items()})

    RUN_DIR.mkdir(parents=True, exist_ok=True)
    meta_path.write_text(json.dumps(res, ensure_ascii=False, default=float, indent=1), encoding="utf-8")
    pd.DataFrame({"p": p_test}).to_csv(pred_path, index=False)
    return res, p_test


def add_deltas(rows: list[dict], preds: dict, test: pd.DataFrame, base_block="M0") -> pd.DataFrame:
    y = test["Y"].astype(int).to_numpy()
    groups = test["household_key"].to_numpy()
    out = []
    for r in rows:
        r = dict(r)
        key_base = (base_block, r["algo"], r["contact"])
        if r["block"] != base_block and key_base in preds and r["algo"] != "dummy":
            r.update(group_bootstrap_delta(y, preds[(r["block"], r["algo"], r["contact"])], preds[key_base], groups))
        out.append(r)
    return pd.DataFrame(out)


# ---------------------------------------------------------------------------
# 시각화
# ---------------------------------------------------------------------------
def plot_comparison(table: pd.DataFrame, prevalence: float):
    plt = setup_matplotlib()
    algos = [a for a in ALGORITHMS if a in set(table["algo"])]
    fig, axes = plt.subplots(1, 2, figsize=(15, 5.5))
    for ax, metric, title in [(axes[0], "test_AP", "(a) 시험셋 Average Precision (PR-AUC, 주 지표)"),
                              (axes[1], "test_ROC_AUC", "(b) 시험셋 ROC-AUC")]:
        x = np.arange(len(algos))
        width = 0.2
        for i, b in enumerate(BLOCKS):
            sub = table[table["block"] == b].set_index("algo").reindex(algos)
            ax.bar(x + (i - 1.5) * width, sub[metric], width, color=PALETTE[i], label=b)
        if metric == "test_AP":
            ax.axhline(prevalence, color=INK_MUTED, ls="--", lw=1)
            ax.text(len(algos) - 0.5, prevalence, f"양성률 {prevalence:.3f}\n(무작위 기준선)", fontsize=8,
                    va="bottom", ha="right", color=INK_MUTED)
        else:
            ax.axhline(0.5, color=INK_MUTED, ls="--", lw=1)
            ax.set_ylim(0.45, None)
        ax.set_xticks(x, [ALGO_LABELS[a] for a in algos], rotation=15)
        ax.set_title(title, loc="left")
        ax.grid(axis="x", visible=False)
    handles, labels = axes[0].get_legend_handles_labels()
    fig.legend(handles, labels, title="정보 블록", ncol=4, loc="upper right", bbox_to_anchor=(0.99, 1.0))
    fig.suptitle("정보 블록(M0~M3) × 알고리즘 성능 비교", x=0.01, ha="left", fontsize=14, fontweight="bold")
    fig.tight_layout(rect=(0, 0, 1, 0.93))
    fig.savefig(FIG_DIR / "model_01_comparison.png")
    plt.close(fig)


def plot_delta(table: pd.DataFrame):
    plt = setup_matplotlib()
    sub = table[(table["block"] != "M0") & table["dAP_vs_M0"].notna()]
    algos = [a for a in ALGORITHMS if a in set(sub["algo"])]
    fig, ax = plt.subplots(figsize=(11, 5))
    width = 0.25
    for i, b in enumerate(["M1", "M2", "M3"]):
        s = sub[sub["block"] == b].set_index("algo").reindex(algos)
        x = np.arange(len(algos)) + (i - 1) * width
        err = np.vstack([s["dAP_vs_M0"] - s["dAP_CI_low"], s["dAP_CI_high"] - s["dAP_vs_M0"]])
        ax.bar(x, s["dAP_vs_M0"], width, color=PALETTE[i + 1], label=f"{b} - M0")
        ax.errorbar(x, s["dAP_vs_M0"], yerr=err, fmt="none", ecolor="#333", elinewidth=1, capsize=3)
    ax.axhline(0, color=INK_MUTED, lw=1)
    ax.set_xticks(np.arange(len(algos)), [ALGO_LABELS[a] for a in algos])
    ax.set_ylabel("ΔAP (시험셋)")
    ax.legend(ncol=3)
    ax.grid(axis="x", visible=False)
    ax.set_title("M0 대비 AP 개선량과 가구 단위 부트스트랩 95% CI (H3)", loc="left")
    fig.tight_layout()
    fig.savefig(FIG_DIR / "model_02_delta_ap.png")
    plt.close(fig)


def plot_curves(preds: dict, test: pd.DataFrame):
    plt = setup_matplotlib()
    y = test["Y"].astype(int).to_numpy()
    algos = [a for a in ALGORITHMS if a != "dummy" and ("M3", a, "contact_friend") in preds]
    fig, axes = plt.subplots(1, 3, figsize=(18, 5.5))

    ax = axes[0]  # PR 곡선: 로지스틱·CatBoost의 M0 vs M3
    for i, (algo, block) in enumerate([(a, b) for a in ("logistic", "catboost") for b in ("M0", "M3")]):
        if (block, algo, "contact_friend") not in preds:
            continue
        prec, rec, _ = precision_recall_curve(y, preds[(block, algo, "contact_friend")])
        ax.plot(rec, prec, lw=2, color=PALETTE[i], label=f"{ALGO_LABELS[algo]} {block}")
    ax.axhline(y.mean(), color=INK_MUTED, ls="--", lw=1)
    ax.set_xlabel("재현율"); ax.set_ylabel("정밀도")
    ax.set_title("(a) PR 곡선 (시험셋)", loc="left")
    ax.legend()

    ax = axes[1]  # 보정곡선: M3 알고리즘별
    lim = 0
    for i, algo in enumerate(algos):
        frac_pos, mean_pred = calibration_curve(y, preds[("M3", algo, "contact_friend")], n_bins=10, strategy="quantile")
        ax.plot(mean_pred, frac_pos, marker="o", ms=5, lw=2, color=PALETTE[i], label=ALGO_LABELS[algo])
        lim = max(lim, mean_pred.max(), frac_pos.max())
    ax.plot([0, lim * 1.05], [0, lim * 1.05], color=INK_MUTED, ls="--", lw=1, label="완전 보정")
    ax.set_xlabel("예측 확률 평균(10분위)"); ax.set_ylabel("실제 Y=1 비율")
    ax.set_title("(b) 보정곡선 — M3", loc="left")
    ax.legend(fontsize=8)

    ax = axes[2]  # 보정곡선: 로지스틱 M0~M3
    for i, b in enumerate(BLOCKS):
        if (b, "logistic", "contact_friend") not in preds:
            continue
        frac_pos, mean_pred = calibration_curve(y, preds[(b, "logistic", "contact_friend")], n_bins=10, strategy="quantile")
        ax.plot(mean_pred, frac_pos, marker="o", ms=5, lw=2, color=PALETTE[i], label=f"로지스틱 {b}")
    ax.plot([0, lim * 1.05], [0, lim * 1.05], color=INK_MUTED, ls="--", lw=1, label="완전 보정")
    ax.set_xlabel("예측 확률 평균(10분위)"); ax.set_ylabel("실제 Y=1 비율")
    ax.set_title("(c) 보정곡선 — 로지스틱 M0~M3", loc="left")
    ax.legend(fontsize=8)

    fig.tight_layout()
    fig.savefig(FIG_DIR / "model_03_pr_calibration.png")
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--algos", nargs="+", default=ALGORITHMS)
    ap.add_argument("--blocks", nargs="+", default=BLOCKS)
    ap.add_argument("--folds", type=int, default=5)
    ap.add_argument("--no-cv", action="store_true")
    ap.add_argument("--sensitivity", action="store_true", help="친척/이웃 연락빈도로 M2·M3 재추정(로지스틱·CatBoost)")
    ap.add_argument("--n-boot", type=int, default=1000)
    args = ap.parse_args()

    df = load_analysis_table()
    sample = df[df["in_analysis"] == 1]
    train = sample[sample["split"] == "train"].reset_index(drop=True)
    test = sample[sample["split"] == "test"].reset_index(drop=True)
    print(f"train {len(train):,} (양성 {train['Y'].mean():.4f}) / test {len(test):,} (양성 {test['Y'].mean():.4f})")
    n_folds = 0 if args.no_cv else args.folds

    jobs = [(b, a, "contact_friend") for b in args.blocks for a in args.algos]
    if args.sensitivity:
        jobs += [(b, a, c) for c in ("contact_family", "contact_neighbor") for b in ("M2", "M3")
                 for a in ("logistic", "catboost")]

    rows, preds = [], {}
    for block, algo, contact in jobs:
        tag = f"{block}_{algo}" + ("" if contact == "contact_friend" else f"_{contact}")
        t0 = time.time()
        res, p = run_one(train, test, block, algo, contact, n_folds, tag)
        rows.append(res)
        preds[(block, algo, contact)] = p
        print(f"[{tag:32s}] test AP {res['test_AP']:.4f}  AUC {res['test_ROC_AUC']:.4f}  "
              f"cvAP {res.get('cv_AP_mean', float('nan')):.4f}  ({time.time() - t0:.0f}s)", flush=True)

    # M0(contact_friend)은 친구/친척/이웃 비교의 공통 기준이므로 민감도 분석에도 같은 예측을 사용
    for (b, a, c), p in list(preds.items()):
        if b == "M0" and c == "contact_friend":
            for alt in ("contact_family", "contact_neighbor"):
                preds.setdefault(("M0", a, alt), p)

    table = add_deltas(rows, preds, test, "M0")
    table.insert(2, "algo_label", table["algo"].map(ALGO_LABELS))
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    main_tab = table[table["contact"] == "contact_friend"].drop(columns="contact")
    main_tab.to_csv(REPORT_DIR / "model_comparison.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    if args.sensitivity:
        sens = table[table["contact"] != "contact_friend"]
        sens = pd.concat([table[(table["contact"] == "contact_friend") & table["algo"].isin(["logistic", "catboost"])
                                & table["block"].isin(["M2", "M3"])], sens])
        sens.to_csv(REPORT_DIR / "model_sensitivity.csv", index=False, encoding="utf-8-sig", float_format="%.5f")

    FIG_DIR.mkdir(parents=True, exist_ok=True)
    plot_comparison(main_tab, test["Y"].mean())
    plot_delta(main_tab)
    plot_curves(preds, test)

    cols = ["block", "algo", "cv_AP_mean", "test_AP", "test_ROC_AUC", "test_Brier", "dAP_vs_M0", "dAP_CI_low", "dAP_CI_high"]
    print(main_tab[[c for c in cols if c in main_tab]].round(4).to_string(index=False))


if __name__ == "__main__":
    main()
