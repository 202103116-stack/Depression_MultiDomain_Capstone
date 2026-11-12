"""v3 주 분석 — 경제 불리 집단 × 건강 생활요인 단계: 칸별 조정 유병률, 역전점, 상호작용, 격차 분해.

실행: python src/v3/reversal_v3.py
산출: outputs/v3/reports/rev_cells.csv, rev_reversal.csv, rev_interaction.csv, rev_decomposition.csv
      outputs/v3/figures/fig_v3_04_reversal_lines.png, fig_v3_05_reversal_heatmap.png, fig_v3_06_decomposition.png

모형: 조사설계 반영 로지스틱(1차 SurveyLogit) — Y ~ 경제집단×생활요인단계(교차 범주) + 인구 + 신체건강.
역전점: 불리 집단의 조정 유병률이 비교 기준보다 낮고 차이의 95% CI 상한이 0 미만인 가장 낮은 단계.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from common_v3 import (ADJ, BIN_CUTS, BINS, V3_FIG, V3_REPORT, CellModel, adj_design, binned, indicators,
                       interaction_model, lifestyle, load, survey_fit)
from utils import INK, INK_MUTED, PALETTE, setup_matplotlib

COMPARE = ["유리 집단 0~2개", "유리 집단 전체 평균", "유리 집단 같은 단계"]


def analyze(d, r, key, ind, lbin, cnt, adj_spec, levels=BINS, mask=None, tag="주 분석"):
    """한 경제 지표 × 생활요인 단계 분석. levels[0]이 유리 집단의 비교 기준 단계."""
    g, groups, dis, adv = ind["series"], ind["groups"], ind["dis"], ind["adv"]
    mask = np.ones(len(d), bool) if mask is None else np.asarray(mask, bool)
    Xadj = adj_design(r, adj_spec, mask)
    cm = CellModel(d, Xadj, [(g, groups), (lbin, levels)], (adv, levels[0]), mask)
    cells = cm.table(indicator=key, spec=tag).rename(columns={"f0": "group", "f1": "bin"})

    adv_share = cm.share({0: adv}, axis=1, among=(g == adv).to_numpy())
    dis_share = cm.share({0: dis}, axis=1, among=(g == dis).to_numpy())
    adv_avg = {(adv, b): w for b, w in adv_share.items()}
    dis_own = {(dis, b): w for b, w in dis_share.items()}

    rev = []
    for b in levels:
        for comp, base in zip(COMPARE, [{(adv, levels[0]): 1.0}, adv_avg, {(adv, b): 1.0}]):
            coefs = {(dis, b): 1.0}
            for c, w in base.items():
                coefs[c] = coefs.get(c, 0.0) - w
            e, lo, hi, p = cm.ci(coefs)
            rev.append({"indicator": key, "spec": tag, "dis_bin": b, "compare_to": comp, "diff_pp": e * 100,
                        "low_pp": lo * 100, "high_pp": hi * 100, "p": p, "significantly_lower": hi < 0})
    rev = pd.DataFrame(rev)

    mult = interaction_model(d, Xadj, g, groups, adv, lbin, levels, cm.domain)
    top, bot = levels[-1], levels[0]
    drop_dis = cm.ci({(dis, top): 1, (dis, bot): -1})
    drop_adv = cm.ci({(adv, top): 1, (adv, bot): -1})
    add = cm.ci({(dis, top): 1, (dis, bot): -1, (adv, top): -1, (adv, bot): 1})

    # 보조: 생활요인 개수(연속) 1개당 OR — 집단별 기울기
    ok3 = cm.domain & cnt.notna().to_numpy()
    X3 = Xadj.copy()
    X3["count"] = cnt.where(ok3)
    for a in groups:
        if a != adv:
            X3[f"G={a}"] = (g == a).astype(float).where(ok3)
            X3[f"G={a}×count"] = X3[f"G={a}"] * X3["count"]
    m3 = survey_fit(X3, d, ok3)
    i_c, i_x = m3.names.index("count"), m3.names.index(f"G={dis}×count")
    b_adv, b_dis = m3.beta[i_c], m3.beta[i_c] + m3.beta[i_x]
    se_adv = m3.se[i_c]
    se_dis = float(np.sqrt(m3.vcov[i_c, i_c] + m3.vcov[i_x, i_x] + 2 * m3.vcov[i_c, i_x]))

    # RQ5 격차 분해: 불리 집단이 유리 집단의 생활요인 분포를 가졌다면(반사실) 격차가 얼마나 줄어드는가.
    # 소득 하위 집단은 고령층이 많아(고령층은 비흡연·아침식사 충족률이 높음) 조율 분포는 연령 구성 차이를 섞는다
    # → 주 결과는 연령 표준화 분포(전체 도메인의 연령대 분포를 표준으로 한 직접 표준화), 조율 분포는 보조.
    age = r["age_grp"].to_numpy()
    w_all = d["wt_p"].to_numpy()
    ages = [a for a in pd.unique(age[cm.domain]) if pd.notna(a)]
    std_w = {a: w_all[cm.domain & (age == a)].sum() for a in ages}
    tot_w = sum(std_w.values())

    def agestd_share(grp):
        out = {b: 0.0 for b in levels}
        for a in ages:
            sh = cm.share({0: grp}, axis=1, among=(g == grp).to_numpy() & (age == a))
            for b in levels:
                out[b] += std_w[a] / tot_w * sh[b]
        return out

    dec_rows = []
    for method, sd, sa in [("연령 표준화 분포", agestd_share(dis), agestd_share(adv)), ("조율 분포", dis_share, adv_share)]:
        own = {(dis, b): w for b, w in sd.items()}
        advm = {(adv, b): w for b, w in sa.items()}
        cf = {(dis, b): w for b, w in sa.items()}
        gap_total = cm.lin({**own, **{c: -w for c, w in advm.items()}})
        gap_cf = cm.lin({**cf, **{c: -w for c, w in advm.items()}})
        explained = (gap_total[0] - gap_cf[0], gap_total[1] - gap_cf[1])
        ratio = explained[0] / gap_total[0]
        ratio_grad = (explained[1] * gap_total[0] - explained[0] * gap_total[1]) / gap_total[0] ** 2
        dec = {"dis_actual": cm.ci(own), "dis_counterfactual": cm.ci(cf), "adv_actual": cm.ci(advm),
               "gap_total": cm.mdl.contrast(*gap_total), "gap_remaining": cm.mdl.contrast(*gap_cf),
               "gap_explained": cm.mdl.contrast(*explained), "share_explained": cm.mdl.contrast(ratio, ratio_grad)}
        row = {"indicator": key, "spec": tag, "method": method}
        for k, v in dec.items():
            row[k], row[k + "_low"], row[k + "_high"] = v[0], v[1], v[2]
        row.update({f"share_dis_{b}": sd[b] for b in levels})
        row.update({f"share_adv_{b}": sa[b] for b in levels})
        row["mean_count_dis"] = sum(sd[b] * i for i, b in enumerate(levels))  # 단계 번호 평균(0~4, 비교용)
        row["mean_count_adv"] = sum(sa[b] * i for i, b in enumerate(levels))
        dec_rows.append(row)
    adv_avg_prev, dis_avg_prev = cm.ci(adv_avg)[0], cm.ci(dis_own)[0]

    inter = {"indicator": key, "spec": tag, "n_model": int(cm.domain.sum()),
             "mult_F": mult["F"], "mult_df": mult["q"], "mult_p": mult["p"],
             "drop_dis_pp": drop_dis[0] * 100, "drop_dis_low": drop_dis[1] * 100, "drop_dis_high": drop_dis[2] * 100,
             "drop_adv_pp": drop_adv[0] * 100, "drop_adv_low": drop_adv[1] * 100, "drop_adv_high": drop_adv[2] * 100,
             "additive_pp": add[0] * 100, "additive_low": add[1] * 100, "additive_high": add[2] * 100, "additive_p": add[3],
             "or_per_factor_adv": float(np.exp(b_adv)), "or_adv_low": float(np.exp(b_adv - 1.96 * se_adv)),
             "or_adv_high": float(np.exp(b_adv + 1.96 * se_adv)),
             "or_per_factor_dis": float(np.exp(b_dis)), "or_dis_low": float(np.exp(b_dis - 1.96 * se_dis)),
             "or_dis_high": float(np.exp(b_dis + 1.96 * se_dis)),
             "slope_interaction_p": m3.wald([n for n in m3.names if n.endswith("×count")])["p"],
             "adv_avg_prev": adv_avg_prev, "dis_avg_prev": dis_avg_prev,
             "reversal_1": first_reversal(rev, COMPARE[0]), "reversal_2": first_reversal(rev, COMPARE[1])}
    return cells, rev, inter, dec_rows


def first_reversal(rev: pd.DataFrame, comp: str) -> str:
    s = rev[(rev["compare_to"] == comp) & rev["significantly_lower"]]
    return s["dis_bin"].iloc[0] if len(s) else "없음"


# ---------------------------------------------------------------------------
# 그림
# ---------------------------------------------------------------------------
def plot_lines(cells, inds, inter, path):
    plt = setup_matplotlib()
    fig, axes = plt.subplots(1, 3, figsize=(17, 5.4))
    for k, (ax, (key, ind)) in enumerate(zip(axes, inds.items())):
        sub = cells[cells["indicator"] == key]
        colors = {ind["dis"]: PALETTE[1], ind["adv"]: PALETTE[0]}
        x = np.arange(len(BINS))
        for gname in ind["groups"]:
            s = sub[sub["group"] == gname].set_index("bin").reindex(BINS)
            c = colors.get(gname, INK_MUTED)
            ax.plot(x, s["adj_prev"] * 100, marker="o", ms=6, lw=2, color=c, label=gname)
            ax.fill_between(x, s["low"] * 100, s["high"] * 100, color=c, alpha=0.15, lw=0)
        a0 = sub[(sub["group"] == ind["adv"]) & (sub["bin"] == BINS[0])]["adj_prev"].iloc[0] * 100
        avg = inter[inter["indicator"] == key]["adv_avg_prev"].iloc[0] * 100
        ax.axhline(a0, color=PALETTE[0], ls="--", lw=1)
        ax.text(len(BINS) - 1, a0, f" {ind['adv']} 0~2개 {a0:.1f}%", va="bottom", ha="right", fontsize=8, color=INK)
        ax.axhline(avg, color=PALETTE[0], ls=":", lw=1)
        ax.text(len(BINS) - 1, avg, f" {ind['adv']} 전체 평균 {avg:.1f}%", va="bottom", ha="right", fontsize=8, color=INK)
        ax.set_xticks(range(len(BINS)), BINS)
        ax.set_xlabel("충족한 건강 생활요인 개수 (신체활동 권고 + 6개)")
        ax.set_ylabel("조정 유병률(%) · 95% CI")
        ax.set_ylim(0, None)
        ax.legend(fontsize=8, loc="upper right")
        ax.set_title(f"({'abc'[k]}) {ind['label']}", loc="left")
    fig.suptitle("경제 집단별 건강 생활요인 개수에 따른 우울 증상 조정 유병률", x=0.01, ha="left", fontsize=13, fontweight="bold")
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def plot_heatmap(cells, inds, path):
    plt = setup_matplotlib()
    fig, axes = plt.subplots(1, 3, figsize=(17, 3.6))
    vmax = cells["adj_prev"].max() * 100
    for k, (ax, (key, ind)) in enumerate(zip(axes, inds.items())):
        sub = cells[cells["indicator"] == key]
        get = lambda gname, b, col: sub[(sub["group"] == gname) & (sub["bin"] == b)][col].iloc[0]  # noqa: E731
        mat = np.array([[get(gn, b, "adj_prev") * 100 for b in BINS] for gn in ind["groups"]])
        nn = np.array([[get(gn, b, "n") for b in BINS] for gn in ind["groups"]])
        im = ax.imshow(mat, cmap="Blues", vmin=0, vmax=vmax, aspect="auto")
        for i in range(mat.shape[0]):
            for j in range(mat.shape[1]):
                ax.text(j, i, f"{mat[i, j]:.1f}%\nn={nn[i, j]:,}", ha="center", va="center", fontsize=7.5,
                        color="white" if mat[i, j] > vmax * 0.6 else INK)
        ax.set_xticks(range(len(BINS)), BINS)
        ax.set_yticks(range(len(ind["groups"])), ind["groups"])
        ax.grid(False)
        ax.set_title(f"({'abc'[k]}) {ind['label']}", loc="left")
    fig.suptitle("경제 집단 × 건강 생활요인 개수별 조정 유병률", x=0.01, y=0.99, ha="left", fontsize=13, fontweight="bold")
    fig.subplots_adjust(top=0.80, wspace=0.35, right=0.90)
    fig.colorbar(im, cax=fig.add_axes([0.92, 0.15, 0.008, 0.62]), label="조정 유병률(%)")
    fig.savefig(path)
    plt.close(fig)


def plot_decomposition(dec, inds, path):
    plt = setup_matplotlib()
    fig, ax = plt.subplots(figsize=(10, 4.2))
    labels, y = [], 0
    for key, ind in inds.items():
        row = dec[(dec["indicator"] == key) & (dec["method"] == "연령 표준화 분포")].iloc[0]
        vals = [row["adv_actual"], row["dis_counterfactual"], row["dis_actual"]]
        lows = [row["adv_actual_low"], row["dis_counterfactual_low"], row["dis_actual_low"]]
        highs = [row["adv_actual_high"], row["dis_counterfactual_high"], row["dis_actual_high"]]
        cols = [PALETTE[0], PALETTE[3], PALETTE[1]]
        names = [f"{ind['adv']}", f"{ind['dis']} (유리 집단 생활요인 분포라면)", f"{ind['dis']}"]
        for v, lo, hi, c, nm in zip(vals, lows, highs, cols, names):
            ax.errorbar(v * 100, y, xerr=[[v * 100 - lo * 100], [hi * 100 - v * 100]], fmt="o", color=c, ms=7, capsize=3)
            ax.text(hi * 100 + 0.15, y, f"{v * 100:.1f}%", va="center", fontsize=8, color=INK)
            labels.append(f"{ind['label']} · {nm}")
            y += 1
        ax.text(0.2, y - 0.35, f"격차 중 생활요인 분포 차이 몫: {row['share_explained'] * 100:.0f}% "
                f"[{row['share_explained_low'] * 100:.0f}, {row['share_explained_high'] * 100:.0f}]",
                fontsize=8.5, color=INK_MUTED, va="center")
        y += 1
        labels.append("")
    ax.set_yticks(range(len(labels)), labels, fontsize=8.5)
    ax.invert_yaxis()
    ax.set_xlim(0, None)
    ax.set_xlabel("조정 유병률(%) · 95% CI")
    ax.set_title("격차 분해: 불리 집단이 유리 집단만큼 생활요인을 충족한다면 (연령 표준화 분포)", loc="left", fontsize=12, fontweight="bold")
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def main():
    V3_REPORT.mkdir(parents=True, exist_ok=True)
    V3_FIG.mkdir(parents=True, exist_ok=True)
    d, r = load()
    ls = lifestyle(d)
    lbin = binned(ls["count7"], BIN_CUTS)
    inds = indicators(d)
    out = {k: [] for k in ["cells", "rev", "inter", "dec"]}
    for key, ind in inds.items():
        c, rv, it, dc = analyze(d, r, key, ind, lbin, ls["count7"], ADJ)
        assert (c["n"] >= 500).all(), f"{key}: 500명 미만 칸 {c.loc[c['n'] < 500, ['group', 'bin', 'n']].to_dict('records')}"
        assert c["n"].sum() == it["n_model"]
        # 분해 몫은 음수일 수 있다(불리 집단이 오히려 생활요인을 더 많이 충족하면 반사실 유병률이 실제보다 높아짐).
        for row in dc:
            assert row["gap_total"] > 0 and abs(row["share_explained"]) < 1, key
        for k, v in zip(out, [c, rv, it]):
            out[k].append(v)
        out["dec"] += dc
        print(f"[{ind['label']}] n={it['n_model']:,} 역전①={it['reversal_1']} ②={it['reversal_2']} "
              f"가법 {it['additive_pp']:+.2f}%p 승법 p={it['mult_p']:.3f} 분해(연령 표준화) {dc[0]['share_explained'] * 100:.0f}% / 조율 {dc[1]['share_explained'] * 100:.0f}%")
    cells, rev = pd.concat(out["cells"]), pd.concat(out["rev"])
    inter, dec = pd.DataFrame(out["inter"]), pd.DataFrame(out["dec"])

    # 탐색 단계(src/v2/explore_econ_lifestyle.py, 2026-10-21) 수치 재현 확인
    inc = cells[cells["indicator"] == "income"].set_index(["group", "bin"])["adj_prev"]
    assert round(inc[("하위(1분위)", "0~2개")] * 100, 1) == 13.4 and round(inc[("상위(5분위)", "6~7개")] * 100, 1) == 1.9
    it0 = inter.set_index("indicator").loc["income"]
    assert it0["reversal_1"] == "5개" and it0["reversal_2"] == "6~7개" and round(it0["additive_pp"], 1) == -7.2
    assert inter.set_index("indicator").loc["food", "reversal_1"] == "6~7개"
    pooled = d.assign(_b=lbin).dropna(subset=["_b"]).groupby("_b").apply(
        lambda x: np.average(x["Y"], weights=x["wt_p"]), include_groups=False).reindex(BINS)
    assert pooled.is_monotonic_decreasing

    cells.to_csv(V3_REPORT / "rev_cells.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    rev.to_csv(V3_REPORT / "rev_reversal.csv", index=False, encoding="utf-8-sig", float_format="%.4f")
    inter.to_csv(V3_REPORT / "rev_interaction.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    dec.to_csv(V3_REPORT / "rev_decomposition.csv", index=False, encoding="utf-8-sig", float_format="%.5f")
    plot_lines(cells, inds, inter, V3_FIG / "fig_v3_04_reversal_lines.png")
    plot_heatmap(cells, inds, V3_FIG / "fig_v3_05_reversal_heatmap.png")
    plot_decomposition(dec, inds, V3_FIG / "fig_v3_06_decomposition.png")
    print("저장:", V3_REPORT)


if __name__ == "__main__":
    main()
