# Sideline Lab

[Live dashboard](https://sucheta-nandy.github.io/sideline-lab/) · [Methodology](docs/methodology.md) · [Scouting memo](docs/scouting-memo.md) · [Application plan](docs/application-plan.md)

An NFL scouting dashboard built to answer a practical question: **where does an offense create positive expected points, and how much of its success can be explained by situation?**

Python ingests public nflverse play-by-play, validates play keys and field ranges, builds SQL marts, and evaluates a transparent success model on an untouched season. A dependency-free dashboard exposes team tendencies, league comparisons, weekly results, model calibration, and a sourced sports-careers research tracker.

## Explore the dashboard

```sh
python -m http.server 8000 --directory web
```

Open http://localhost:8000. The committed aggregates work without downloading raw data. Use Python 3.11 or newer. No API keys, paid services, JavaScript build step, or external charting CDN is needed. GitHub Pages publishes the `main` branch; the repository root redirects to the static dashboard in `web`.

## What the project demonstrates

| Discipline | Evidence |
| --- | --- |
| Analyst | Weighted team/league comparisons, situation filters, documented KPI definitions, sample-size warnings, downloadable summaries |
| Data scientist | Temporal validation, training-only preprocessing, baseline comparison, Brier/log-loss/AUC, calibration, game-cluster bootstrap |
| Data engineer | Download cache, source SHA-256 hashes, explicit filtering audit, unique play keys, SQL marts, snapshot checks and CI |
| Communication | Decision context, limits, uncertainty, and a concise scouting memo |

## Data and measured results

The snapshot contains **96,798 eligible regular-season plays** from 2023–2025: 32,801 / 32,273 / 31,724 plays respectively, covering 272 games and all 32 teams in each season. Kneels, spikes, scrambles, non-run/pass records, missing EPA and invalid downs are excluded. A pass includes sacks according to the upstream play classification. Results therefore describe this explicitly filtered play population, not every snap.

An L2 logistic regression estimates the chance a play has **EPA > 0** from situation and realized play type. Penalty strength is selected using 2023 training and 2024 validation data; the selected model is refitted on 2023–2024 and evaluated once on 2025.

| Held-out 2025 metric | Model | Constant training-rate baseline |
| --- | ---: | ---: |
| Brier score (lower is better) | 0.24054 | 0.24568 |
| Log loss (lower is better) | 0.67408 | 0.68449 |
| ROC AUC | 0.58804 | 0.50000 |

The **2.09% relative Brier improvement** is modest. It establishes a reproducible baseline; it does not establish readiness for a professional coaching system. The model does not use player talent, injuries, tracking coordinates, personnel or opponent strength. Differences between runs and passes are observational and affected by selection. **Do not interpret them as causal play-call recommendations.**

Exact metrics, coefficients, preprocessing parameters and calibration bins are in [model.json](web/data/model.json). Data provenance and filtering counts are in [manifest.json](web/data/manifest.json).

## Reproduce the pipeline

```sh
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python src/pipeline.py --cache .cache
python -m unittest discover -s tests -v
python src/verify_snapshot.py
```

The first run downloads about 54 MB of compressed source data and creates a local SQLite warehouse. Later runs reuse the cache. Download hashes must match the committed manifest. If upstream releases change, investigate the difference before explicitly accepting a new manifest; the script deliberately fails rather than silently changing the sample. Raw data and SQLite files are ignored by Git.

## Repository guide

```text
src/pipeline.py          ingestion, checks, modeling, aggregation
src/verify_snapshot.py   network-free aggregate validation
sql/marts.sql           additive situation and game marts
tests/                  filtering, uniqueness, metrics, leakage checks
web/                    static dashboard and committed aggregates
docs/                   methodology, scouting memo, hiring evidence
index.html              GitHub Pages entry point
```

## Hiring research

The careers tab is a **2026-10-30 audit of 185 active teams** across NFL, NBA, WNBA, MLB, NHL, MLS and NWSL. It retains a row for every team and distinguishes readable boards from blocked or incomplete routes. A readable job description or application form is evidence of a listing at review time; it does not guarantee ongoing acceptance. Historical, index-only and conflicting leads are visibly separate. Adjacent finance, marketing and performance roles are labeled for review.

The audit is a manual, sourced snapshot, not an always-current job scraper. It is not a complete verification of every vacancy: dynamic ATS pages prevented some reviews. Original research evidence preserves per-team notes and URLs in [research_evidence.json](docs/research_evidence.json).

## Data attribution and licensing

Data: [nflverse play-by-play](https://github.com/nflverse/nflverse-data/releases/tag/pbp), distributed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). EPA is provided by the upstream nflfastR pipeline. This project filters and aggregates the data and fits a separate model. [nflverse licensing information](https://github.com/nflverse#licensing).

Code is MIT licensed. The MIT license does not replace the source-data license or grant rights in team names, marks, employer job descriptions or linked sites. No team logos are included. Job requirements are brief paraphrases linked to their original employer sources. This independent portfolio project is unaffiliated with any team or league.
