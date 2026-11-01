# Philadelphia scouting memo

**Question:** What should an analyst investigate before preparing an opponent report on Philadelphia's offense?

The 2025 filtered sample contains 949 Philadelphia plays. Its EPA/play is +0.008 versus −0.009 for the other 31 teams, while its success rate is 42.6% versus 43.4%. A small difference in average EPA coexists with a lower frequency of positive-EPA plays. This suggests looking at the distribution of large gains and losses rather than relying on a single average.

## Three starting observations

1. **Pass frequency is lower.** Philadelphia passes on 55.8% of retained plays versus 58.9% for the rest of the league. First-down pass share is 45.1% across 417 plays, versus 48.5% for other teams. For a preparation meeting, split this by score, time and personnel before describing it as a tactical tendency. The dashboard's current splits do not control for those factors.
2. **Third-down average and frequency differ.** On 192 third-down plays Philadelphia averages +0.018 EPA/play versus −0.097 for the rest of the league, but its positive-EPA rate is 39.1% versus 41.6%. Review the influential plays and distance-to-go distribution. An average that appears favorable does not imply a reliably higher conversion or success frequency.
3. **The situation model explains much of the observed success rate.** Philadelphia's observed 2025 success is 42.57%; the model's average prediction is 42.80%, a −0.23 percentage-point residual. This is not evidence of a coaching effect. The model omits player quality, defense, personnel and tracking context and has only modest overall discrimination.

## What this supports

Use these observations to select film and formulate questions. Compare a matched down/distance/field-zone population, inspect sample sizes, and check whether a few extreme plays dominate the EPA gap. Pass/run differences in this observational data do not identify what would have happened had the same play used another call.

All statistics are computed from the committed additive SQL marts. Scrambles, kneels, spikes, postseason and non-run/pass records are excluded. This is a portfolio analysis of historical public data, not a team recommendation based on proprietary context.
