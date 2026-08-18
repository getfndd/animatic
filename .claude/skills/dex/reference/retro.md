# @dex · /retro — velocity & shipping-hygiene retro

Load this when asked to run a retro, review velocity, or "how did the last week ship."
A retro is a **document of signals, not a leaderboard** — it reads like an admin surface
(numbers-as-data, sentence case, no composite score). Per-author counts are *load
distribution*, never a ranking.

## Gather the numbers

Some projects ship a collector script:

```bash
node scripts/retro.mjs --days 14          # human-readable summary
node scripts/retro.mjs --days 7 --json    # machine-readable → feed back to @dex
```

> **No such script here?** Say so, then gather the figures with `gh` rather than
> skipping the retro. Counts, authorship, cycle time and diff size come from:
>
> ```bash
> gh pr list --state merged --search "merged:>=YYYY-MM-DD" --limit 100 \
>   --json number,title,author,createdAt,mergedAt,additions,deletions
> ```
>
> **Process escapes need a second field**, because none of the above carries
> check status — `statusCheckRollup` does:
>
> ```bash
> gh pr list --state merged --search "merged:>=YYYY-MM-DD" --limit 100 \
>   --json number,title,statusCheckRollup \
>   --jq '.[] | {n:.number, bad:[.statusCheckRollup[]?
>          | select((.conclusion // .state) as $c
>              | $c=="FAILURE" or $c=="CANCELLED" or $c=="TIMED_OUT")
>          | (.name // .context)]}
>        | select(.bad|length>0)'
> ```
>
> Match on `FAILURE`/`CANCELLED`/`TIMED_OUT` only. `SKIPPED` is routine on
> merged PRs — conditional jobs and path filters produce it constantly — so
> including it reports the whole repo as escaping. Note also that the rollup
> reflects the head commit *as read now*, not as it was at merge: a re-run after
> merge changes it. Treat a hit as a signal to go explain, not as proof.
>
> Do not invent numbers you did not pull. If you could not obtain a figure, say
> which one and why, rather than presenting the retro as complete.

Either way you want: merged count, per-author breakdown, cycle-time median/p90,
conventional-commit type mix, **PRs merged with a failing or cancelled check**
(process escapes), and the largest diffs. Everything here is read-only.

## What @dex does with it — the judgment layer

The numbers are raw material. The retro is the narrative you write from them:

1. **Throughput in context, not in isolation.** "11 PRs" means nothing alone. Compare to
   the prior window and to what was *planned* (cross-reference Linear). A dip during a
   migration-heavy week is healthy; a spike of `chore` churn may be thrash.
2. **Cycle time is the real signal.** Rising p90 time-open usually means PRs are stuck
   somewhere structural — waiting on an external review relay, or repeatedly losing the
   up-to-date-branch merge race — not that people are slow. Find which, and name the
   bottleneck rather than the throughput.
3. **Every process escape gets explained, never just listed.** A PR that merged with a
   failing check is either a stale-check admin-merge (fine — say so) or a gate that got
   bypassed (not fine — flag it). Review is infrastructure: findings block or are
   *explicitly accepted*, never silently dropped.
4. **Type mix tells the story arc.** Mostly `feat` = building; mostly `fix` = stabilizing;
   mostly `chore` = either healthy maintenance or yak-shaving — judge which.
5. **Largest diffs are a review-load question.** A 2000± PR that sailed through is a
   review-coverage risk worth naming, not a productivity win.

## Output shape

Write 5–8 sentences max: what shipped, the one bottleneck worth fixing, and any process
escape that needs follow-up (as a Linear issue, not a scolding). End with a single
forward action. No score, no "great job team," no per-person grades.

## Cadence

Suggested: end-of-week, 7-day window, run solo (`@dex` owns it; consult `@eames` only when
throughput questions become roadmap questions). Don't automate it into a cron that posts a
number — the value is the narrative,
which needs a human read.
