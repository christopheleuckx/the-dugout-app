---
name: sync-games
description: Check the Voetbal Vlaanderen calendars of every age group against the games in The Dugout, fill in missing scores, follow moved kick-offs and report new games. Use when Christophe types /sync-games or asks to update the agenda, calendar or scores from the federation.
argument-hint: "[age group, e.g. U15 — default all]"
---

Brings the live database (Supabase project `wjmydsutslejxjxbozkt`) in line with the federation, for the age groups in `teams.json` (next to this file), or only the ones named in the arguments. Answer in the language he writes in (usually Dutch).

## Ground rules

- **A score that is in the app is never changed.** Not ours, not the league's. Only empty scores are filled in. A score he typed himself always wins, also when the federation says otherwise; mention such a difference in the report, don't fix it.
- **`ownScores: "manual"` (U12, Blue and Red):** never fill in the score of our own games; he does that. League matches of other clubs in that league are filled in as usual.
- **Apply at once:** empty scores of games and league matches, and a moved date or kick-off (or a kick-off that was still empty) of a game or league match that is not played yet.
- **Report first, add only after his go-ahead:** new games (they need his choices: Friendly / Cup / Competition, remarks), new opponents, cancelled or postponed games, and anything that does not match cleanly.
- Never delete anything. No changes to the database structure.

## Steps

1. **Fetch.** Open `https://www.voetbalvlaanderen.be/club/1663` in the browser pane and run `fetch.js` with the javascript tool, two or three age groups per call (set `ONLY`). The API only answers from that site; curl gets Access Denied.
2. **Read the app.** Per age group, with SQL on the live project:
   - games: `id, date, time, opponent, competitor_id, home_away, competition, quarters, quarter_scores, lineups, num_teams, league_match_id, cancel_status`
   - league matches of its league: `league_matches` with `league_matchdays` (date) and both `league_teams` → `competitors.name`, `is_own_team`.
   A game has a score when any part of `quarter_scores` (or `lineups.<team>.quarterScores`) has a `for` or `against`.
3. **Match.**
   - A team-calendar match is our game when the date matches and the opponent is the same club: compare the federation name with `competitors.name` after `aliases` in `teams.json` (federation name → app name). When a name only matches loosely (K., KFC, R., VV, "-" vs " "), use it but add the pair to `aliases`.
   - A series match is a league match on the same date with the same home and away club.
   - Our own league games: update the **game**; the trigger `game_score_to_league` copies the score to the league match. Don't write the league match yourself then.
4. **Write**, only what the ground rules allow:
   - Score of a game: `quarter_scores` becomes `[{"for":us,"against":them}, {"for":null,"against":null}, …]` with as many parts as `quarters`; "us" is the home goals when `home_away = 'Home'`. Skip games with `num_teams > 1` or `ownScores: "manual"`.
   - Score of another club's league match: `home_goals`, `away_goals` where both are null.
   - Moved kick-off or date: update `date`/`time` (game) or `match_date`/`kickoff` (league match), only for matches not played yet.
   - Run it as one transaction. Save what was written as a data note and an undo script in football-hub (`supabase/data/<date>_sync_games.sql` and `supabase/rollback/undo_<date>_sync_games.sql`, the undo setting the old values back), then commit and push football-hub. Commit an updated `teams.json` (aliases) in the-dugout-app.
5. **Report**, short, per age group:
   - **Filled in:** scores of our games and of league matches (count, plus our games by name).
   - **Moved:** date or kick-off changes.
   - **To decide:** new games not in the app (date, time, opponent, home/away, series name), games in the app the federation doesn't list, home/away that differs, cancelled or postponed games, score differences with what he typed, names that could not be matched.
   - Nothing changed: say so in one line.
   Then ask which of the "to decide" games to add, and how (Friendly / Cup / Competition, remarks). Adding them follows the usual import pattern: competition type, quarters and quarter length from the age group's defaults (`age_groups.default_quarters`, `default_quarter_length`), format from `default_format`, a new competitor with its federation logo when the club is new.
