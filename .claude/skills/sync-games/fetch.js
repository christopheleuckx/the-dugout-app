// Run in the browser pane on a www.voetbalvlaanderen.be page (the federation's
// GraphQL API refuses requests from outside its own site). Fill TEAMS and SERIES
// from teams.json and set ONLY to the age groups for this call (a few at a time
// keeps the answer short). Returns compact lines; the full data stays in
// window.__sync for follow-up questions. Series lines are only the played matches.
//
// Team calendar line:  date time | home | away | home goals | away goals | outcome status | state | series id
// Series calendar line: date time | home | away | home goals | away goals | state
const TEAMS = { U12: '379784', U13: '379782', U14: '379780', U15: '379779', U16: '379778', U17: '379777', U19: '379776' };
const SERIES = { U12: 'CHP_134483', U13: 'CHP_132800', U14: 'CHP_130345', U15: 'CHP_134755', U16: 'CHP_134745', U17: 'CHP_133283', U19: 'CHP_133274' };
const ONLY = ['U14'];
const API = 'https://datalake-prod2018.rbfa.be/graphql';
const teamQuery =
  'query GetTeamCalendar ($teamId: ID!, $language: Language!, $sortByDate: SortDirection) { teamCalendar(teamId: $teamId, language: $language, sortByDate: $sortByDate) { id startTime homeTeam { name clubId logo } awayTeam { name clubId logo } outcome { status homeTeamGoals awayTeamGoals subscript } series { id name } state } }';
const seriesQuery =
  'query GetSeriesCalendar($seriesId: ID!, $endDate: String!, $startDate: String!, $language: Language!) { seriesCalendar(seriesId: $seriesId, startDate: $startDate, endDate: $endDate, language: $language) { id state startTime homeTeam { id name clubId } awayTeam { id name clubId } outcome { homeTeamGoals awayTeamGoals } } }';
const post = async (operationName, variables, query) =>
  (await (await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ operationName, variables, query }) })).json()).data;
const g = (x) => (x === null || x === undefined ? '' : x);
window.__sync = window.__sync || {};
const out = {};
for (const [group, teamId] of Object.entries(TEAMS).filter(([k]) => ONLY.includes(k))) {
  const team = (await post('GetTeamCalendar', { teamId, language: 'nl', sortByDate: 'asc' }, teamQuery))?.teamCalendar ?? [];
  const series = SERIES[group]
    ? ((await post('GetSeriesCalendar', { seriesId: SERIES[group], startDate: '2026-07-01', endDate: '2027-06-30', language: 'nl' }, seriesQuery))?.seriesCalendar ?? [])
    : [];
  out[group] = { team, series: series.filter((m) => m.outcome?.homeTeamGoals != null) };
  window.__sync[group] = { team, series };
}
Object.entries(out)
  .map(
    ([group, { team, series }]) =>
      `## ${group} team (${team.length})\n` +
      team.map((m) => [m.startTime.slice(0, 16), m.homeTeam?.name, m.awayTeam?.name, g(m.outcome?.homeTeamGoals), g(m.outcome?.awayTeamGoals), g(m.outcome?.status), m.state, g(m.series?.id)].join(' | ')).join('\n') +
      `\n## ${group} series (${series.length})\n` +
      series.map((m) => [m.startTime.slice(0, 16), m.homeTeam?.name, m.awayTeam?.name, g(m.outcome?.homeTeamGoals), g(m.outcome?.awayTeamGoals), m.state].join(' | ')).join('\n'),
  )
  .join('\n');
