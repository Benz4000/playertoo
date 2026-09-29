import { rankIndex } from './games.js';

const wantsDate = (p) => p.looking_for === 'date' || p.looking_for === 'both';
const wantsDuo = (p) => p.looking_for === 'duo' || p.looking_for === 'both';

// Whether two players can be shown to each other, and as what.
export function compatibility(me, them) {
  const attracted =
    (me.interested_in || []).includes(them.gender) &&
    (them.interested_in || []).includes(me.gender);
  const date = wantsDate(me) && wantsDate(them) && attracted;
  const duo = wantsDuo(me) && wantsDuo(them);
  return { date, duo, ok: date || duo };
}

// How good a match is, plus what they have in common (shown on the card).
export function score(me, them) {
  const myGames = new Map((me.games || []).map((g) => [g.game, g.rank]));
  const sharedGames = [];
  let points = 0;

  for (const { game, rank } of them.games || []) {
    if (!myGames.has(game)) continue;
    sharedGames.push(game);
    points += 10;
    const a = rankIndex(game, myGames.get(game));
    const b = rankIndex(game, rank);
    if (a >= 0 && b >= 0 && Math.abs(a - b) <= 1) points += 4;
  }

  const sharedPlatforms = (them.platforms || []).filter((p) => (me.platforms || []).includes(p));
  points += sharedPlatforms.length * 5;

  if (me.region && me.region === them.region) points += 8;

  const sharedTimes = (them.play_times || []).filter((t) => (me.play_times || []).includes(t));
  points += sharedTimes.length * 3;

  return { points, sharedGames, sharedPlatforms, sharedTimes };
}

export function rankCandidates(me, candidates) {
  return candidates
    .map((them) => ({ them, fit: compatibility(me, them), match: score(me, them) }))
    .filter((c) => c.fit.ok)
    .sort((a, b) => b.match.points - a.match.points);
}
