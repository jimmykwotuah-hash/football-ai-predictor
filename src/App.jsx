import React, { useState, useMemo } from "react";
import { ChevronLeft, Search, User, Bell, Star, Globe, Trophy, Calendar } from "lucide-react";

// ---------------------------------------------------------------------------
// POISSON PREDICTION MODEL
// (same math as the backend server.js — duplicated here so the UI can show
// live-computed probabilities without waiting on a network round trip.
// In production, swap this for a fetch("/api/predictions") call.)
// ---------------------------------------------------------------------------
function factorial(n) { return n <= 1 ? 1 : n * factorial(n - 1); }
function poissonProb(lambda, k) { return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k); }

function computeOutcomeProbabilities(homeXG, awayXG) {
  const maxGoals = 8;
  let homeWin = 0, draw = 0, awayWin = 0;
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = poissonProb(homeXG, h) * poissonProb(awayXG, a);
      if (h > a) homeWin += p; else if (h === a) draw += p; else awayWin += p;
    }
  }
  const total = homeWin + draw + awayWin;
  return {
    homeWin: Math.round((homeWin / total) * 100),
    draw: Math.round((draw / total) * 100),
    awayWin: Math.round((awayWin / total) * 100)
  };
}

function getExpectedGoals(home, away, leagueAvg = 1.35) {
  const HOME_ADV = 1.15;
  const homeAttack = home.goalsForAvg / leagueAvg;
  const homeDefense = home.goalsAgainstAvg / leagueAvg;
  const awayAttack = away.goalsForAvg / leagueAvg;
  const awayDefense = away.goalsAgainstAvg / leagueAvg;
  return {
    homeXG: homeAttack * awayDefense * leagueAvg * HOME_ADV,
    awayXG: awayAttack * homeDefense * leagueAvg
  };
}

// ---------------------------------------------------------------------------
// MOCK DATA (swap for real API-Football responses later)
// ---------------------------------------------------------------------------
const TEAM_STATS = {
  USA: { flag: "🇺🇸", rank: 15, goalsForAvg: 2.1, goalsAgainstAvg: 0.8, form: ["W", "W", "D", "W", "L"] },
  BIH: { flag: "🇧🇦", rank: 61, goalsForAvg: 1.3, goalsAgainstAvg: 1.6, form: ["L", "W", "D", "L", "W"] },
  ESP: { flag: "🇪🇸", rank: 3, goalsForAvg: 2.4, goalsAgainstAvg: 0.6, form: ["W", "W", "W", "D", "W"] },
  AUT: { flag: "🇦🇹", rank: 24, goalsForAvg: 1.6, goalsAgainstAvg: 1.1, form: ["W", "D", "L", "W", "D"] },
  POR: { flag: "🇵🇹", rank: 6, goalsForAvg: 2.0, goalsAgainstAvg: 0.9, form: ["W", "W", "D", "W", "W"] },
  CRO: { flag: "🇭🇷", rank: 9, goalsForAvg: 1.8, goalsAgainstAvg: 1.0, form: ["D", "W", "W", "L", "W"] }
};

const DEMO_FIXTURES = [
  {
    league: "World Cup — Round of 32", leagueIcon: "🏆",
    matches: [
      { id: 1, home: "USA", away: "BIH", status: "FT", score: [2, 0], time: "Fulltime" }
    ]
  },
  {
    league: "World Cup — Round of 32", leagueIcon: "🏆",
    matches: [
      { id: 2, home: "ESP", away: "AUT", status: "19:00", score: null, time: "19:00" },
      { id: 3, home: "POR", away: "CRO", status: "23:00", score: null, time: "23:00" }
    ]
  }
];

const DAYS = ["SUN 28/06", "MON 29/06", "TUE 30/06", "WED 01/07", "TODAY 02/07", "FRI 03/07", "SAT 04/07"];

const TIMELINE = [
  { min: "90+5", event: "Sub", detail: "Reyna ⇄ McKennie" },
  { min: "88'", event: "Sub", detail: "Pepi ⇄ Pulisic" },
  { min: "87'", event: "Sub", detail: "Berhalter ⇄ Dest" },
  { min: "82'", event: "Goal", detail: "⚽ Tillman — 2-0" },
  { min: "80'", event: "Yellow", detail: "Radeljić — Foul" },
  { min: "64'", event: "Red", detail: "Balogun — Foul" },
  { min: "51'", event: "Sub", detail: "Mahmić ⇄ E.Džeko" },
  { min: "45'", event: "Goal", detail: "⚽ Balogun — 1-0" }
];

// ---------------------------------------------------------------------------
// UI PRIMITIVES
// ---------------------------------------------------------------------------
function FormPill({ result }) {
  const colors = { W: "bg-emerald-500", D: "bg-zinc-500", L: "bg-rose-500" };
  return <span className={`w-5 h-5 rounded-full ${colors[result]} text-[10px] flex items-center justify-center text-white font-bold`}>{result}</span>;
}

function ProbCircle({ label, pct, tint }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center text-sm font-bold border-2"
        style={{ borderColor: tint, background: `${tint}22`, color: tint }}
      >
        {pct}%
      </div>
      <span className="text-xs text-zinc-400">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MATCH DETAIL SCREEN
// ---------------------------------------------------------------------------
function MatchDetail({ match, onBack }) {
  const [tab, setTab] = useState("Details");
  const home = TEAM_STATS[match.home];
  const away = TEAM_STATS[match.away];

  const { homeXG, awayXG } = useMemo(() => getExpectedGoals(home, away), [home, away]);
  const probs = useMemo(() => computeOutcomeProbabilities(homeXG, awayXG), [homeXG, awayXG]);

  const tabs = ["Details", "Lineups", "AI Prediction", "Stats", "H2H"];

  return (
    <div className="min-h-screen bg-[#0b0b0f] text-zinc-100 pb-10">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a2560] via-[#3a2a5c] to-[#7a3d1f] px-4 pt-4 pb-5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="p-1"><ChevronLeft size={22} /></button>
          <div className="flex gap-3 text-zinc-200"><Bell size={18} /><Star size={18} /></div>
        </div>
        <div className="flex items-center justify-between px-2">
          <div className="flex flex-col items-center gap-1 w-20">
            <span className="text-3xl">{home.flag}</span>
            <span className="text-xs text-zinc-300">{match.home}</span>
            <span className="text-[10px] text-zinc-400">FIFA #{home.rank}</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="bg-[#F0B90B] text-black font-bold px-4 py-1 rounded-lg text-lg">
              {match.score ? `${match.score[0]} - ${match.score[1]}` : "vs"}
            </div>
            <span className="text-[11px] text-zinc-300 mt-1">{match.time}</span>
          </div>
          <div className="flex flex-col items-center gap-1 w-20">
            <span className="text-3xl">{away.flag}</span>
            <span className="text-xs text-zinc-300">{match.away}</span>
            <span className="text-[10px] text-zinc-400">FIFA #{away.rank}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-5 px-4 py-3 overflow-x-auto border-b border-zinc-800 text-sm">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap pb-2 ${tab === t ? "text-[#F0B90B] border-b-2 border-[#F0B90B] font-semibold" : "text-zinc-400"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* AI Prediction — fully unlocked, no paywall */}
      {tab === "AI Prediction" && (
        <div className="p-4 space-y-5">
          <div className="bg-[#141419] border border-[#F0B90B]/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[#F0B90B] font-semibold text-sm">AI Prediction</span>
              <span className="text-[10px] bg-emerald-600/20 text-emerald-400 px-2 py-0.5 rounded-full">Unlocked</span>
            </div>
            <p className="text-xs text-zinc-500 mb-4">Poisson goal-expectancy model, based on recent scoring &amp; defensive form.</p>

            <div className="flex justify-around mb-4">
              <ProbCircle label={match.home} pct={probs.homeWin} tint="#3b82f6" />
              <ProbCircle label="Draw" pct={probs.draw} tint="#a1a1aa" />
              <ProbCircle label={match.away} pct={probs.awayWin} tint="#F0B90B" />
            </div>

            <div className="bg-[#1a1a1f] rounded-lg p-3 text-center mb-4">
              <span className="text-xs text-zinc-400">Model expected score</span>
              <div className="text-lg font-bold text-zinc-100">{homeXG.toFixed(1)} – {awayXG.toFixed(1)}</div>
            </div>

            <div className="space-y-2 text-xs text-zinc-400">
              <div className="flex justify-between"><span>{match.home} attack rating</span><span className="text-zinc-200">{(home.goalsForAvg).toFixed(2)} xG/game</span></div>
              <div className="flex justify-between"><span>{match.away} attack rating</span><span className="text-zinc-200">{(away.goalsForAvg).toFixed(2)} xG/game</span></div>
              <div className="flex justify-between"><span>{match.home} defense rating</span><span className="text-zinc-200">{(home.goalsAgainstAvg).toFixed(2)} conceded/game</span></div>
              <div className="flex justify-between"><span>{match.away} defense rating</span><span className="text-zinc-200">{(away.goalsAgainstAvg).toFixed(2)} conceded/game</span></div>
            </div>
          </div>

          <p className="text-[11px] text-zinc-600 leading-relaxed">
            These are statistical probabilities, not guarantees — football outcomes carry real variance even for heavy favorites.
          </p>
        </div>
      )}

      {/* Details tab */}
      {tab === "Details" && (
        <div className="p-4 space-y-4">
          <div className="flex justify-around bg-[#141419] rounded-xl p-3">
            <ProbCircle label={match.home} pct={probs.homeWin} tint="#3b82f6" />
            <ProbCircle label="Draw" pct={probs.draw} tint="#a1a1aa" />
            <ProbCircle label={match.away} pct={probs.awayWin} tint="#F0B90B" />
          </div>

          <div className="bg-[#141419] rounded-xl p-3">
            <span className="text-xs text-zinc-500">Ball possession</span>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span>48%</span>
              <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden flex">
                <div className="bg-blue-500 h-full" style={{ width: "48%" }} />
                <div className="bg-[#F0B90B] h-full" style={{ width: "52%" }} />
              </div>
              <span>52%</span>
            </div>
          </div>

          <div className="bg-[#141419] rounded-xl p-4">
            <span className="text-xs text-zinc-500 block mb-3">Match timeline</span>
            <div className="space-y-3">
              {TIMELINE.map((e, i) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <span className="text-zinc-500 w-10">{e.min}</span>
                  <span className={`w-2 h-2 rounded-full ${e.event === "Goal" ? "bg-emerald-500" : e.event === "Red" ? "bg-rose-600" : e.event === "Yellow" ? "bg-amber-400" : "bg-zinc-600"}`} />
                  <span className="text-zinc-300">{e.detail}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#141419] rounded-xl p-4 space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-zinc-500">Stadium</span><span>San Francisco Bay Area Stadium</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Attendance</span><span>70,909</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Referee</span><span>Raphael Claus 🇧🇷</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Date</span><span>02 July 2026</span></div>
          </div>
        </div>
      )}

      {(tab === "Lineups" || tab === "Stats" || tab === "H2H") && (
        <div className="p-6 text-center text-zinc-500 text-sm">
          {tab} view — plug in real API-Football data here the same way AI Prediction is wired up.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FIXTURE LIST SCREEN
// ---------------------------------------------------------------------------
function FixtureList({ onSelect }) {
  const [activeDay, setActiveDay] = useState(4);
  const [fixtures, setFixtures] = useState(DEMO_FIXTURES);
  const [isLive, setIsLive] = useState(false);

  React.useEffect(() => {
    // Tries your backend first (real live data). If the server isn't
    // running yet, or the request fails, it just keeps showing the demo
    // fixtures above instead of crashing the app.
    fetch("/api/predictions")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setIsLive(true);
          // Reshape backend response into the { league, matches } grouping
          // this UI expects. Adjust here once your server groups by league.
        }
      })
      .catch(() => {
        // Silent fallback to demo data — this is expected until server.js is running
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0b0f] text-zinc-100 pb-16">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-1 text-sm bg-[#141419] px-3 py-1.5 rounded-full">
          <Globe size={14} /> Football
        </div>
        <div className="flex items-center gap-1 text-sm bg-[#141419] px-3 py-1.5 rounded-full">
          <Trophy size={14} /> Competitions
        </div>
        <div className="flex gap-3">
          <Search size={18} />
          <User size={18} />
        </div>
      </div>

      <div className="px-4 pb-2">
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${isLive ? "bg-emerald-600/20 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>
          {isLive ? "● Live data" : "○ Demo data — start server.js for live matches"}
        </span>
      </div>

      <div className="flex gap-2 px-4 overflow-x-auto pb-3">
        {DAYS.map((d, i) => (
          <button
            key={d}
            onClick={() => setActiveDay(i)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs ${activeDay === i ? "bg-[#F0B90B] text-black font-bold" : "bg-[#141419] text-zinc-400"}`}
          >
            {d}
          </button>
        ))}
      </div>

      {fixtures.map((group, gi) => (
        <div key={gi} className="mt-3">
          <div className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-400">
            <span>{group.leagueIcon}</span>
            <span>{group.league}</span>
          </div>
          {group.matches.map((m) => {
            const home = TEAM_STATS[m.home];
            const away = TEAM_STATS[m.away];
            return (
              <button
                key={m.id}
                onClick={() => onSelect(m)}
                className="w-full flex items-center justify-between px-4 py-3 border-t border-zinc-900 hover:bg-[#141419]"
              >
                <div className="flex flex-col items-start gap-1">
                  <span className="text-xs text-zinc-500 w-12 text-left">{m.status}</span>
                </div>
                <div className="flex-1 flex flex-col gap-1 items-start ml-2">
                  <div className="flex items-center gap-2 text-sm"><span>{home.flag}</span><span>{m.home}</span></div>
                  <div className="flex items-center gap-2 text-sm"><span>{away.flag}</span><span>{m.away}</span></div>
                </div>
                {m.score ? (
                  <div className="flex flex-col items-end text-sm font-bold text-zinc-200">
                    <span>{m.score[0]}</span><span>{m.score[1]}</span>
                  </div>
                ) : (
                  <Bell size={16} className="text-zinc-600" />
                )}
              </button>
            );
          })}
        </div>
      ))}

      <div className="fixed bottom-0 left-0 right-0 bg-[#101014] border-t border-zinc-900 flex justify-around py-2 text-[11px] text-zinc-500">
        {["All", "Live", "Upcoming", "Finished", "Following"].map((label, i) => (
          <div key={label} className={`flex flex-col items-center gap-1 ${i === 0 ? "text-[#F0B90B]" : ""}`}>
            <Calendar size={16} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ROOT APP
// ---------------------------------------------------------------------------
export default function App() {
  const [selectedMatch, setSelectedMatch] = useState(null);

  return selectedMatch ? (
    <MatchDetail match={selectedMatch} onBack={() => setSelectedMatch(null)} />
  ) : (
    <FixtureList onSelect={setSelectedMatch} />
  );
      }
    
