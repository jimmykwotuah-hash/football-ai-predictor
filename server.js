// server.js
// Backend proxy for API-Football + Poisson-distribution match predictor
//
// WHY A BACKEND: your API-Football key must never be exposed in frontend
// (browser) code. This server holds the key and does all the number-crunching,
// and your React app just calls "/api/predictions".

import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_FOOTBALL_KEY; // set this in StackBlitz env vars, never hardcode
const BASE = "https://v3.football.api-sports.io";

if (!API_KEY) {
  console.warn("WARNING: API_FOOTBALL_KEY is not set. Requests will fail.");
}

async function apiGet(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "x-apisports-key": API_KEY }
  });
  if (!res.ok) {
    throw new Error(`API-Football request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ---------- POISSON MODEL ----------
// This is the standard statistical approach for football prediction.
// Core idea: goals scored in football roughly follow a Poisson distribution.
// We estimate each team's "attack strength" and "defense weakness" relative
// to the league average, then predict expected goals for this specific
// matchup, then compute the probability of every scoreline (0-0, 1-0, 2-1...)
// and sum them up into Home Win / Draw / Away Win percentages.

function factorial(n) {
  return n <= 1 ? 1 : n * factorial(n - 1);
}

function poissonProb(lambda, k) {
  // Probability of exactly k goals given expected goals = lambda
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function computeOutcomeProbabilities(homeExpectedGoals, awayExpectedGoals) {
  const maxGoals = 8; // consider scorelines up to 8-8 (covers ~99.9% of probability mass)
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = poissonProb(homeExpectedGoals, h) * poissonProb(awayExpectedGoals, a);
      if (h > a) homeWin += p;
      else if (h === a) draw += p;
      else awayWin += p;
    }
  }

  // Normalize to 100% and round
  const total = homeWin + draw + awayWin;
  return {
    homeWin: Math.round((homeWin / total) * 100),
    draw: Math.round((draw / total) * 100),
    awayWin: Math.round((awayWin / total) * 100)
  };
}

function getExpectedGoals(homeStats, awayStats, leagueAvg) {
  // Attack strength: how many goals a team scores relative to league average
  // Defense weakness: how many goals a team concedes relative to league average
  const homeAttack = homeStats.goalsForAvg / leagueAvg.goalsFor;
  const homeDefense = homeStats.goalsAgainstAvg / leagueAvg.goalsAgainst;
  const awayAttack = awayStats.goalsForAvg / leagueAvg.goalsFor;
  const awayDefense = awayStats.goalsAgainstAvg / leagueAvg.goalsAgainst;

  // Expected home goals = home's attack strength x away's defensive weakness x league avg x home advantage
  const HOME_ADVANTAGE = 1.15; // teams score ~15% more at home, well-documented effect
  const homeExpectedGoals = homeAttack * awayDefense * leagueAvg.goalsFor * HOME_ADVANTAGE;
  const awayExpectedGoals = awayAttack * homeDefense * leagueAvg.goalsFor;

  return { homeExpectedGoals, awayExpectedGoals };
}

function extractStats(teamStatsResponse) {
  const played = teamStatsResponse.fixtures?.played?.total || 1;
  const goalsFor = teamStatsResponse.goals?.for?.total?.total || 0;
  const goalsAgainst = teamStatsResponse.goals?.against?.total?.total || 0;

  return {
    goalsForAvg: goalsFor / played,
    goalsAgainstAvg: goalsAgainst / played
  };
}

// ---------- ROUTE ----------
app.get("/api/predictions", async (req, res) => {
  try {
    const fixturesData = await apiGet("/fixtures?live=all");
    const fixtures = fixturesData.response.slice(0, 5);

    if (fixtures.length === 0) {
      return res.json([]);
    }

    const results = await Promise.all(
      fixtures.map(async (fixture) => {
        try {
          const homeId = fixture.teams.home.id;
          const awayId = fixture.teams.away.id;
          const leagueId = fixture.league.id;
          const season = fixture.league.season;

          const [homeStatsRes, awayStatsRes] = await Promise.all([
            apiGet(`/teams/statistics?team=${homeId}&league=${leagueId}&season=${season}`),
            apiGet(`/teams/statistics?team=${awayId}&league=${leagueId}&season=${season}`)
          ]);

          const homeStats = extractStats(homeStatsRes.response);
          const awayStats = extractStats(awayStatsRes.response);

          // League average goals per game — ideally pulled from league standings/stats,
          // using a reasonable fixed estimate (~1.35 goals/team/game) as fallback.
          const leagueAvg = { goalsFor: 1.35, goalsAgainst: 1.35 };

          const { homeExpectedGoals, awayExpectedGoals } = getExpectedGoals(
            homeStats,
            awayStats,
            leagueAvg
          );

          const probs = computeOutcomeProbabilities(homeExpectedGoals, awayExpectedGoals);

          return {
            home: fixture.teams.home.name,
            away: fixture.teams.away.name,
            ...probs,
            expectedScore: `${homeExpectedGoals.toFixed(1)} - ${awayExpectedGoals.toFixed(1)}`
          };
        } catch (innerErr) {
          console.error("Error processing fixture:", innerErr.message);
          return null;
        }
      })
    );

    res.json(results.filter(Boolean));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch predictions" });
  }
});

app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
    
