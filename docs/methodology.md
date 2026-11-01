# Methodology

## Decision and audience

An analyst preparing an opponent report can compare an offense with the rest of the league in similar down, distance and field-position situations. A hiring reviewer can follow the same numbers from source data through SQL to the dashboard and inspect the model's limits.

The dashboard supports descriptive scouting and hypothesis generation. It does not optimize fourth-down decisions, select players, estimate causal treatment effects, forecast ticket revenue, or claim an effect on wins.

## Population and definitions

Only regular-season records classified upstream as run or pass, with a valid offensive/defensive team, down 1–4 and nonmissing finite EPA, are eligible. QB scrambles, spikes and kneels are excluded. This removes obvious clock-management and broken-play categories but does not identify every designed play perfectly. Retained plays include sacks classified as passes upstream. Filtering audit counts are preserved for each season.

**EPA per play** is the sum of upstream expected-points-added values divided by eligible plays. It is a descriptive efficiency statistic, not a proprietary player grade. **Success rate** is the fraction with EPA strictly greater than zero. Zero EPA counts as unsuccessful. **Pass share** is pass plays divided by retained run plus pass plays. All rates use additive numerators and denominators; averages of subgroup percentages are never used.

Distance bands are 0–3, 4–7 and 8+ yards. The short-distance UI label is 1–3 for football convention, though a zero-yard record, if present upstream, is included. Field zones are red zone (20 yards or closer to the opponent goal), opponent half (over 20 through 50), and own half (over 50). Team abbreviations follow nflverse for these seasons.

The comparison population excludes the selected team and applies the same season and situation filters. Comparisons are not adjusted for opponent, injuries, personnel or schedule. Filtered samples below 100 plays warrant extra caution. Weekly charts use their stated context; unavailable fine-grained filtered data must not be implied.

## Model and validation

The target is positive EPA. Inputs are down, yards to go, distance from opponent goal, half seconds remaining, offensive score differential, offensive/defensive timeouts remaining, shotgun, no-huddle, goal-to-go and run/pass classification. The run/pass flag is known after play classification and is included to condition the estimate on play family; it is not a recommendation variable. EPA, yards gained, result, success, final score and win outcomes are excluded from model inputs.

Numeric missing values are filled with training medians and standardized with training means/standard deviations. Binary missing flags use zero. This convention is explicit and imperfect; missing upstream flags may differ from an observed false value. No imputation statistic uses 2025. Continuous terms are linear on the log-odds scale, so nonlinear effects and interactions may be missed.

L2 strengths 1, 10 and 100 are compared using 2024 Brier score after training on 2023. The chosen strength is refitted on 2023–2024. Evaluation uses all eligible 2025 plays. The prevalence baseline uses only 2023–2024 outcomes. The same held-out population is used for both. AUC measures ranking; Brier and log loss evaluate predicted probabilities. No classification accuracy claim is made.

Calibration bins use fixed probability bands. Wilson intervals for observed bin success rates assume independent plays and are illustrative; plays in a game are dependent. A separate interval for model-minus-baseline Brier resamples whole games 2,000 times with seed 42. This accounts for within-game dependence but is conditional on the fitted model and does not capture model-selection uncertainty or future-season distribution shift.

Observed-minus-expected success by team is an unadjusted residual against the league situation model, not a causal measure of coaching, quarterback skill, or team value. It uses the fixed 2025 test season; avoid mixing it with selected-season descriptive metrics.

## Engineering and reproducibility

Sources are compressed nflverse releases. Every input is hashed, cached and documented. Primary key is game_id plus play_id; duplicates fail rather than silently collapsing. Distance/field and finite-EPA checks fail on invalid records. SQLite has a unique play-key index. SQL views retain count, success count, EPA sum and sum of squared EPA so the dashboard can recompute weighted metrics after filtering.

Snapshot verification checks source-output digest, league team counts, total eligible plays, valid success counts and train/test ordering. Unit tests cover filtering, duplicates, tied AUC, metric definitions and preprocessing isolation. CI runs without network access to raw data beyond dependency installation. Downloaded raw data are excluded from the repository; committed dashboard aggregates are derived public data with attribution.

## Next work

Useful extensions are rolling-origin evaluation across several held-out seasons; opponent-adjusted and personnel-aware models; game-cluster uncertainty for every team statistic; comparison with nonlinear baselines; and analyst interviews to assess whether the report answers a real scouting workflow. These are future work, not implemented features.
