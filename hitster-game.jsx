import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const GENRES = [
  { id: "random", label: "🎲 Zufällig", query: "hit", isRandom: true },
  { id: "pop", label: "🎤 Pop", query: "pop hit" },
  { id: "rock", label: "🎸 Rock", query: "rock classic" },
  { id: "hiphop", label: "🎧 Hip-Hop", query: "hip hop rap" },
  { id: "electronic", label: "🎛️ Electronic", query: "electronic dance" },
  { id: "jazz", label: "🎷 Jazz", query: "jazz classic" },
  { id: "klassik", label: "🎻 Klassik", query: "classical orchestra" },
  { id: "schlager", label: "🌻 Schlager", query: "schlager deutsch" },
  { id: "rnb", label: "🎶 R&B/Soul", query: "rnb soul" },
  { id: "metal", label: "🤘 Metal", query: "heavy metal rock" },
  { id: "filmmusik", label: "🎬 Filmmusik", query: "movie soundtrack film score" },
  { id: "ballermann", label: "🍺 Ballermann", query: "ballermann malle schlager party" },
  { id: "kinder", label: "🧸 Kinder", query: "kinderlieder kinder songs" },
];

const DECADE_OPTIONS = [
  { label: "Letzte 10 Jahre", years: 10 },
  { label: "Letzte 20 Jahre", years: 20 },
  { label: "Letzte 50 Jahre", years: 50 },
  { label: "Letzte 100 Jahre", years: 100 },
];

const CHART_OPTIONS = [
  { label: "Egal", value: null },
  { label: "Top 10", value: 10 },
  { label: "Top 50", value: 50 },
  { label: "Top 100", value: 100 },
];

const GAME_MODES = [
  { id: "reihum", label: "🎤 Reihum", desc: "Jeder Spieler ist abwechselnd dran" },
  { id: "schnellster", label: "⚡ Wer ist der Schnellste?", desc: "Alle spielen gleichzeitig – wer zuerst drückt, bekommt den Punkt" },
];

const BUZZER_COLORS = [
  "#c0392b", "#2980b9", "#27ae60", "#8e44ad",
  "#d35400", "#16a085", "#b7950b", "#2c3e50",
];

const SCREENS = { SETUP: "setup", PLAYERS: "players", GAME: "game", SCORE: "score" };

// ─── DEEZER API ───────────────────────────────────────────────────────────────
async function fetchSong(genreQuery, minYear, maxYear) {
  const offsets = [0, 20, 40, 60, 80];
  const offset = offsets[Math.floor(Math.random() * offsets.length)];
  return new Promise((resolve, reject) => {
    const cb = `dz_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    window[cb] = (data) => {
      delete window[cb];
      if (document.head.contains(script)) document.head.removeChild(script);
      if (!data?.data?.length) return reject("No results");
      const valid = data.data.filter(
        (t) => t.preview && t.release_date &&
          parseInt(t.release_date.slice(0, 4)) >= minYear &&
          parseInt(t.release_date.slice(0, 4)) <= maxYear
      );
      if (!valid.length) return reject("No valid tracks");
      resolve(valid[Math.floor(Math.random() * valid.length)]);
    };
    const script = document.createElement("script");
    script.src = `https://api.deezer.com/search?q=${encodeURIComponent(genreQuery)}&limit=50&index=${offset}&callback=${cb}`;
    script.onerror = () => reject("Script error");
    document.head.appendChild(script);
  });
}

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function H5Jukebox() {
  const [screen, setScreen] = useState(SCREENS.SETUP);
  const [settings, setSettings] = useState({
    selectedGenres: [GENRES[0]],
    decades: DECADE_OPTIONS[1],
    chart: CHART_OPTIONS[0],
    gameMode: GAME_MODES[0],
  });
  const [playerInput, setPlayerInput] = useState("");
  const [players, setPlayers] = useState([]);
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
  const [scores, setScores] = useState({});
  const [round, setRound] = useState(1);
  const [track, setTrack] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [guessResult, setGuessResult] = useState(null);
  const [buzzerWinner, setBuzzerWinner] = useState(null);
  const [buzzerLocked, setBuzzerLocked] = useState(false);
  const audioRef = useRef(null);
  const totalRounds = 10;
  const currentYear = new Date().getFullYear();
  const isSchnellster = settings.gameMode.id === "schnellster";

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.onended = () => setPlaying(false);
  }, []);

  const stopAudio = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; setPlaying(false); }
  };

  const togglePlay = () => {
    if (!audioRef.current || !track) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  const loadTrack = useCallback(async () => {
    setLoading(true); setError(""); setTrack(null);
    setRevealed(false); setGuessResult(null);
    setBuzzerWinner(null); setBuzzerLocked(false);
    stopAudio();
    const maxYear = currentYear;
    const minYear = currentYear - settings.decades.years;
    try {
      const genres = settings.selectedGenres;
      const picked = genres[Math.floor(Math.random() * genres.length)];
      const t = await fetchSong(picked.query, minYear, maxYear);
      setTrack(t);
      if (audioRef.current) {
        audioRef.current.src = t.preview;
        audioRef.current.load();
        audioRef.current.play();
        setPlaying(true);
      }
    } catch { setError("Song konnte nicht geladen werden. Nochmal versuchen!"); }
    setLoading(false);
  }, [settings, currentYear]);

  const startGame = () => {
    if (players.length < 2) return;
    const shuffled = shuffle(players);
    setPlayers(shuffled);
    const init = {};
    shuffled.forEach((p) => (init[p] = 0));
    setScores(init);
    setCurrentPlayerIdx(0);
    setRound(1);
    setScreen(SCREENS.GAME);
    setTimeout(() => loadTrack(), 50);
  };

  const addPlayer = () => {
    const name = playerInput.trim();
    if (!name || players.includes(name)) return;
    setPlayers((p) => [...p, name]);
    setPlayerInput("");
  };

  const advanceRound = useCallback(() => {
    const nextRound = round + 1;
    if (nextRound > totalRounds) { stopAudio(); setScreen(SCREENS.SCORE); return; }
    setRound(nextRound);
    setCurrentPlayerIdx((i) => (i + 1) % players.length);
    loadTrack();
  }, [round, totalRounds, players.length, loadTrack]);

  // ── REIHUM handlers ──
  const handleReveal = () => { stopAudio(); setRevealed(true); };
  const handleResult = (correct) => {
    const cp = players[currentPlayerIdx];
    setGuessResult(correct ? "correct" : "wrong");
    if (correct) setScores((s) => ({ ...s, [cp]: s[cp] + 1 }));
    setTimeout(() => advanceRound(), 1200);
  };

  // ── SCHNELLSTER handlers ──
  const handleBuzzer = (playerName) => {
    if (buzzerLocked || revealed) return;
    setBuzzerWinner(playerName);
    setBuzzerLocked(true);
    stopAudio();
  };
  const handleBuzzerResult = (correct) => {
    setGuessResult(correct ? "correct" : "wrong");
    if (correct && buzzerWinner) setScores((s) => ({ ...s, [buzzerWinner]: s[buzzerWinner] + 1 }));
    setRevealed(true);
    setTimeout(() => advanceRound(), 2200);
  };

  if (screen === SCREENS.SETUP) return <SetupScreen settings={settings} setSettings={setSettings} onNext={() => setScreen(SCREENS.PLAYERS)} />;
  if (screen === SCREENS.PLAYERS) return <PlayersScreen players={players} setPlayers={setPlayers} playerInput={playerInput} setPlayerInput={setPlayerInput} addPlayer={addPlayer} onBack={() => setScreen(SCREENS.SETUP)} onStart={startGame} />;
  if (screen === SCREENS.GAME) {
    if (isSchnellster) return <SchnellsterScreen track={track} loading={loading} error={error} playing={playing} revealed={revealed} guessResult={guessResult} buzzerWinner={buzzerWinner} buzzerLocked={buzzerLocked} players={players} scores={scores} round={round} totalRounds={totalRounds} onTogglePlay={togglePlay} onBuzzer={handleBuzzer} onBuzzerResult={handleBuzzerResult} onReload={loadTrack} audioRef={audioRef} />;
    return <GameScreen track={track} loading={loading} error={error} playing={playing} revealed={revealed} guessResult={guessResult} players={players} currentPlayerIdx={currentPlayerIdx} scores={scores} round={round} totalRounds={totalRounds} onTogglePlay={togglePlay} onReveal={handleReveal} onResult={handleResult} onReload={loadTrack} audioRef={audioRef} />;
  }
  if (screen === SCREENS.SCORE) return <ScoreScreen scores={scores} players={players} onRestart={() => { setScreen(SCREENS.SETUP); setPlayers([]); setScores({}); setRound(1); setTrack(null); }} />;
  return null;
}

// ─── SETUP SCREEN ─────────────────────────────────────────────────────────────
function SetupScreen({ settings, setSettings, onNext }) {
  const { selectedGenres } = settings;
  const isRandom = selectedGenres.length === 1 && selectedGenres[0].isRandom;

  const toggleGenre = (g) => {
    if (g.isRandom) { setSettings((s) => ({ ...s, selectedGenres: [g] })); return; }
    setSettings((s) => {
      const without = s.selectedGenres.filter((x) => !x.isRandom);
      const already = without.some((x) => x.id === g.id);
      let next = already ? without.filter((x) => x.id !== g.id) : [...without, g];
      if (next.length === 0) next = [GENRES[0]];
      return { ...s, selectedGenres: next };
    });
  };
  const isActive = (g) => selectedGenres.some((x) => x.id === g.id);

  return (
    <div style={S.root}>
      <div style={S.noise} />
      <div style={S.container}>
        <div style={S.logoWrap}>
          <div style={S.vinylOuter}><div style={S.vinylInner} /></div>
          <h1 style={S.logo}>H5 JUKEBOX</h1>
          <p style={S.logoSub}>Das Musik-Ratespiel</p>
        </div>

        <section style={S.card}>
          <h2 style={S.cardTitle}>🎮 Spielmodus</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {GAME_MODES.map((m) => (
              <button key={m.id}
                style={{ ...S.modeBtn, ...(settings.gameMode.id === m.id ? S.modeBtnActive : {}) }}
                onClick={() => setSettings((s) => ({ ...s, gameMode: m }))}>
                <span style={S.modeLabel}>{m.label}</span>
                <span style={S.modeDesc}>{m.desc}</span>
              </button>
            ))}
          </div>
        </section>

        <section style={S.card}>
          <h2 style={S.cardTitle}>🎵 Genre</h2>
          {!isRandom && selectedGenres.length > 0 && (
            <p style={{ ...S.hint, marginBottom: 10, color: "#f5c518" }}>
              {selectedGenres.length} Kategorie{selectedGenres.length > 1 ? "n" : ""} gewählt
            </p>
          )}
          <div style={S.genreGrid}>
            {GENRES.map((g) => (
              <button key={g.id}
                style={{ ...S.genreBtn, ...(isActive(g) ? S.genreBtnActive : {}), ...(g.isRandom ? S.genreBtnRandom : {}) }}
                onClick={() => toggleGenre(g)}>
                {isActive(g) && !g.isRandom && <span>✓ </span>}{g.label}
              </button>
            ))}
          </div>
        </section>

        <section style={S.card}>
          <h2 style={S.cardTitle}>📅 Zeitraum</h2>
          <div style={S.rowWrap}>
            {DECADE_OPTIONS.map((d) => (
              <button key={d.years} style={{ ...S.optBtn, ...(settings.decades.years === d.years ? S.optBtnActive : {}) }}
                onClick={() => setSettings((s) => ({ ...s, decades: d }))}>{d.label}</button>
            ))}
          </div>
        </section>

        <section style={S.card}>
          <h2 style={S.cardTitle}>🏆 Chart-Platzierung</h2>
          <div style={S.rowWrap}>
            {CHART_OPTIONS.map((c) => (
              <button key={c.label} style={{ ...S.optBtn, ...(settings.chart.label === c.label ? S.optBtnActive : {}) }}
                onClick={() => setSettings((s) => ({ ...s, chart: c }))}>{c.label}</button>
            ))}
          </div>
        </section>

        <button style={S.bigBtn} onClick={onNext}>SPIELER EINGEBEN →</button>
      </div>
    </div>
  );
}

// ─── PLAYERS SCREEN ───────────────────────────────────────────────────────────
function PlayersScreen({ players, setPlayers, playerInput, setPlayerInput, addPlayer, onBack, onStart }) {
  return (
    <div style={S.root}>
      <div style={S.noise} />
      <div style={S.container}>
        <h1 style={S.logo}>H5 JUKEBOX</h1>
        <p style={S.logoSub}>Wer spielt mit?</p>
        <section style={S.card}>
          <div style={S.inputRow}>
            <input style={S.input} placeholder="Name eingeben..." value={playerInput}
              onChange={(e) => setPlayerInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPlayer()} />
            <button style={S.addBtn} onClick={addPlayer}>+</button>
          </div>
          <div style={S.playerList}>
            {players.map((p, i) => (
              <div key={p} style={S.playerChip}>
                <span style={{ ...S.playerNum, background: BUZZER_COLORS[i % BUZZER_COLORS.length] }}>{i + 1}</span>
                <span>{p}</span>
                <button style={S.removeBtn} onClick={() => setPlayers((pl) => pl.filter((x) => x !== p))}>✕</button>
              </div>
            ))}
            {players.length === 0 && <p style={S.hint}>Mindestens 2 Spieler hinzufügen</p>}
          </div>
        </section>
        <div style={S.btnRow}>
          <button style={S.ghostBtn} onClick={onBack}>← Zurück</button>
          <button style={{ ...S.bigBtn, opacity: players.length < 2 ? 0.4 : 1, flex: 1 }}
            onClick={onStart} disabled={players.length < 2}>🎲 SPIEL STARTEN</button>
        </div>
        {players.length >= 2 && <p style={{ ...S.hint, marginTop: 8 }}>Startspieler wird zufällig gewählt!</p>}
      </div>
    </div>
  );
}

// ─── REIHUM GAME SCREEN ───────────────────────────────────────────────────────
function GameScreen({ track, loading, error, playing, revealed, guessResult, players, currentPlayerIdx, scores, round, totalRounds, onTogglePlay, onReveal, onResult, onReload, audioRef }) {
  const progress = ((round - 1) / totalRounds) * 100;
  return (
    <div style={S.root}>
      <div style={S.noise} />
      <audio ref={audioRef} />
      {guessResult && <ResultFlash guessResult={guessResult} label={guessResult === "correct" ? "Richtig!" : "Falsch!"} />}
      <div style={S.container}>
        <ProgressBar progress={progress} round={round} totalRounds={totalRounds} label="🎤 Reihum" />
        <ScoreStrip players={players} scores={scores} highlightIdx={currentPlayerIdx} />
        <div style={S.currentPlayer}>🎤 <strong>{players[currentPlayerIdx]}</strong> ist dran</div>
        <Vinyl playing={playing} loading={loading} error={error} onClick={onTogglePlay} />
        {error && <button style={{ ...S.ghostBtn, alignSelf: "center" }} onClick={onReload}>🔄 Neu laden</button>}
        {!loading && !error && !revealed && <p style={S.hint}>{playing ? "Song läuft... Wer kennt ihn?" : "▶ Tippen zum Abspielen"}</p>}
        {!revealed
          ? <button style={{ ...S.bigBtn, background: "#e63b2e" }} onClick={onReveal} disabled={loading || !!error}>🔍 AUFLÖSEN</button>
          : <RevealCard track={track}>
            <div style={S.resultBtns}>
              <button style={{ ...S.bigBtn, background: "#27ae60", flex: 1 }} onClick={() => onResult(true)}>✅ Richtig</button>
              <button style={{ ...S.bigBtn, background: "#e74c3c", flex: 1 }} onClick={() => onResult(false)}>❌ Falsch</button>
            </div>
          </RevealCard>}
      </div>
      <style>{ANIM_CSS}</style>
    </div>
  );
}

// ─── SCHNELLSTER GAME SCREEN ──────────────────────────────────────────────────
function SchnellsterScreen({ track, loading, error, playing, revealed, guessResult, buzzerWinner, buzzerLocked, players, scores, round, totalRounds, onTogglePlay, onBuzzer, onBuzzerResult, onReload, audioRef }) {
  const progress = ((round - 1) / totalRounds) * 100;
  return (
    <div style={S.root}>
      <div style={S.noise} />
      <audio ref={audioRef} />
      {guessResult && (
        <ResultFlash guessResult={guessResult}
          label={guessResult === "correct" ? `⚡ ${buzzerWinner} liegt richtig! +1` : `❌ ${buzzerWinner} lag falsch!`} />
      )}
      <div style={S.container}>
        <ProgressBar progress={progress} round={round} totalRounds={totalRounds} label="⚡ Wer ist der Schnellste?" />
        <ScoreStrip players={players} scores={scores} highlightName={buzzerWinner} />
        <Vinyl playing={playing} loading={loading} error={error} onClick={onTogglePlay} />
        {error && <button style={{ ...S.ghostBtn, alignSelf: "center" }} onClick={onReload}>🔄 Neu laden</button>}

        {/* Phase 1: Song läuft, alle können buzzen */}
        {!buzzerLocked && !revealed && (
          <>
            <p style={{ ...S.hint, marginBottom: 4 }}>
              {playing ? "🎵 Song läuft – wer kennt ihn? Jetzt drücken!" : "▶ Tippen zum Starten"}
            </p>
            <div style={S.buzzerGrid}>
              {players.map((p, i) => (
                <button key={p}
                  style={{ ...S.buzzerBtn, background: BUZZER_COLORS[i % BUZZER_COLORS.length] }}
                  onClick={() => onBuzzer(p)} disabled={loading || !!error}>
                  <span style={S.buzzerIcon}>🔔</span>
                  <span style={S.buzzerName}>{p}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Phase 2: Jemand hat gedrückt – Richtig/Falsch abfragen */}
        {buzzerLocked && !revealed && (
          <div style={S.buzzerJudge}>
            <div style={S.buzzerWinnerBadge}>
              <span style={{ fontSize: 36 }}>⚡</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: "#f5c518" }}>{buzzerWinner}</span>
              <span style={{ fontSize: 13, color: "#aaa" }}>hat als Erstes gedrückt!</span>
            </div>
            <div style={S.resultBtns}>
              <button style={{ ...S.bigBtn, background: "#27ae60", flex: 1 }} onClick={() => onBuzzerResult(true)}>✅ Richtig</button>
              <button style={{ ...S.bigBtn, background: "#e74c3c", flex: 1 }} onClick={() => onBuzzerResult(false)}>❌ Falsch</button>
            </div>
          </div>
        )}

        {/* Phase 3: Auflösung */}
        {revealed && <RevealCard track={track} />}
      </div>
      <style>{ANIM_CSS}</style>
    </div>
  );
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
function ProgressBar({ progress, round, totalRounds, label }) {
  return (
    <>
      <div style={S.progressBar}><div style={{ ...S.progressFill, width: `${progress}%` }} /></div>
      <p style={S.roundLabel}>Runde {round}/{totalRounds} · {label}</p>
    </>
  );
}

function ScoreStrip({ players, scores, highlightIdx, highlightName }) {
  return (
    <div style={S.scoreStrip}>
      {players.map((p, i) => {
        const isHL = highlightIdx !== undefined ? i === highlightIdx : p === highlightName;
        return (
          <div key={p} style={{ ...S.scoreChip, ...(isHL ? (highlightName !== undefined ? S.scoreChipBuzz : S.scoreChipActive) : {}) }}>
            <span>{p}</span>
            <span style={S.scoreVal}>{scores[p] ?? 0}</span>
          </div>
        );
      })}
    </div>
  );
}

function Vinyl({ playing, loading, error, onClick }) {
  return (
    <div style={S.vinylSection}>
      <div style={{ ...S.bigVinyl, animation: playing ? "spin 4s linear infinite" : "none" }} onClick={onClick}>
        <div style={S.bigVinylInner}>
          {loading ? <span style={{ fontSize: 28 }}>⏳</span>
            : error ? <span style={{ fontSize: 28 }}>⚠️</span>
              : <span style={{ fontSize: 36 }}>{playing ? "⏸" : "▶"}</span>}
        </div>
      </div>
    </div>
  );
}

function RevealCard({ track, children }) {
  return (
    <div style={S.revealCard}>
      {track?.album?.cover_medium && (
        <div style={S.albumThumb}><img src={track.album.cover_medium} alt="cover" style={S.coverImg} /></div>
      )}
      {track && (
        <div style={S.trackInfo}>
          <p style={S.trackArtist}>{track.artist?.name}</p>
          <p style={S.trackTitle}>„{track.title}"</p>
          <p style={S.trackYear}>📅 {track.release_date?.slice(0, 4)}</p>
        </div>
      )}
      {children}
    </div>
  );
}

function ResultFlash({ guessResult, label }) {
  return (
    <div style={{ ...S.resultOverlay, background: guessResult === "correct" ? "rgba(0,170,80,0.96)" : "rgba(200,30,30,0.96)" }}>
      <span style={{ fontSize: 80 }}>{guessResult === "correct" ? "✅" : "❌"}</span>
      <span style={S.resultText}>{label}</span>
    </div>
  );
}

// ─── SCORE SCREEN ─────────────────────────────────────────────────────────────
function ScoreScreen({ scores, players, onRestart }) {
  const sorted = [...players].sort((a, b) => scores[b] - scores[a]);
  return (
    <div style={S.root}>
      <div style={S.noise} />
      <div style={S.container}>
        <div style={{ textAlign: "center", paddingTop: 16 }}><span style={{ fontSize: 72 }}>🏆</span></div>
        <h1 style={S.logo}>ERGEBNIS</h1>
        <p style={S.logoSub}><strong>{sorted[0]}</strong> gewinnt!</p>
        <section style={S.card}>
          {sorted.map((p, i) => (
            <div key={p} style={S.resultRow}>
              <span style={{ fontSize: 24, width: 36 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}</span>
              <span style={{ flex: 1, fontSize: 16 }}>{p}</span>
              <span style={{ color: "#f5c518", fontWeight: 700, fontSize: 16 }}>{scores[p]} Punkte</span>
            </div>
          ))}
        </section>
        <button style={S.bigBtn} onClick={onRestart}>🔄 NOCHMAL SPIELEN</button>
      </div>
    </div>
  );
}

// ─── ANIMATIONS ───────────────────────────────────────────────────────────────
const ANIM_CSS = `
  @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes buzzPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
  @keyframes buzzerPress { 0%{transform:scale(1)} 10%{transform:scale(0.93)} 100%{transform:scale(1)} }
`;

// ─── STYLES ───────────────────────────────────────────────────────────────────
const C = { bg: "#0d0d0d", surface: "#1a1a1a", card: "#222", accent: "#f5c518", text: "#f0f0f0", muted: "#888", border: "#333" };

const S = {
  root: { minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Georgia','Times New Roman',serif", position: "relative", overflowX: "hidden" },
  noise: { position: "fixed", inset: 0, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`, pointerEvents: "none", zIndex: 0 },
  container: { position: "relative", zIndex: 1, maxWidth: 480, margin: "0 auto", padding: "24px 16px 64px", display: "flex", flexDirection: "column", gap: 14 },
  logoWrap: { textAlign: "center", padding: "16px 0 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 },
  vinylOuter: { width: 64, height: 64, borderRadius: "50%", background: "radial-gradient(circle at 30% 30%, #444, #111)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 3px #f5c518, 0 0 24px #f5c51833" },
  vinylInner: { width: 20, height: 20, borderRadius: "50%", background: C.bg, border: "2px solid #555" },
  logo: { fontSize: 38, fontWeight: 900, letterSpacing: "0.12em", color: C.accent, margin: 0, textShadow: "0 0 30px #f5c51866", fontFamily: "'Impact','Arial Black',sans-serif" },
  logoSub: { color: C.muted, fontSize: 15, margin: 0, letterSpacing: "0.08em" },
  card: { background: C.card, borderRadius: 16, padding: "18px 16px", border: `1px solid ${C.border}` },
  cardTitle: { fontSize: 14, fontWeight: 700, color: C.accent, margin: "0 0 12px", letterSpacing: "0.05em", fontFamily: "'Impact',sans-serif" },
  modeBtn: { width: "100%", padding: "14px 16px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, color: C.text, cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 3, fontFamily: "inherit" },
  modeBtnActive: { background: "#1a1400", border: `2px solid ${C.accent}` },
  modeLabel: { fontSize: 16, fontWeight: 700 },
  modeDesc: { fontSize: 12, color: C.muted },
  genreGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  genreBtn: { padding: "10px 8px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.text, cursor: "pointer", fontSize: 13, fontFamily: "inherit" },
  genreBtnActive: { background: C.accent, color: "#000", border: `1px solid ${C.accent}`, fontWeight: 700 },
  genreBtnRandom: { gridColumn: "1 / -1", background: "#1a1a2e", border: `1px solid ${C.accent}`, color: C.accent, fontWeight: 700 },
  rowWrap: { display: "flex", flexWrap: "wrap", gap: 8 },
  optBtn: { padding: "8px 14px", borderRadius: 20, border: `1px solid ${C.border}`, background: C.surface, color: C.text, cursor: "pointer", fontSize: 13, fontFamily: "inherit" },
  optBtnActive: { background: C.accent, color: "#000", border: `1px solid ${C.accent}`, fontWeight: 700 },
  bigBtn: { width: "100%", padding: "16px 20px", borderRadius: 14, border: "none", background: C.accent, color: "#000", fontWeight: 900, fontSize: 16, letterSpacing: "0.08em", cursor: "pointer", fontFamily: "'Impact',sans-serif", boxShadow: "0 4px 20px #f5c51833" },
  ghostBtn: { padding: "12px 20px", borderRadius: 12, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 14, cursor: "pointer", fontFamily: "inherit" },
  btnRow: { display: "flex", gap: 10, alignItems: "center" },
  inputRow: { display: "flex", gap: 8, marginBottom: 12 },
  input: { flex: 1, padding: "12px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 15, fontFamily: "inherit", outline: "none" },
  addBtn: { width: 46, height: 46, borderRadius: 10, border: "none", background: C.accent, color: "#000", fontSize: 22, fontWeight: 900, cursor: "pointer" },
  playerList: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 },
  playerChip: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: C.surface, border: `1px solid ${C.border}` },
  playerNum: { width: 26, height: 26, borderRadius: "50%", color: "#fff", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  removeBtn: { marginLeft: "auto", background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 14 },
  hint: { color: C.muted, fontSize: 13, textAlign: "center", margin: 0 },
  progressBar: { height: 4, background: C.border, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", background: C.accent, borderRadius: 2, transition: "width 0.4s ease" },
  roundLabel: { color: C.muted, fontSize: 12, textAlign: "center", margin: 0, letterSpacing: "0.04em" },
  scoreStrip: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  scoreChip: { display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, background: C.surface, border: `1px solid ${C.border}`, fontSize: 13 },
  scoreChipActive: { background: C.accent, color: "#000", border: `1px solid ${C.accent}`, fontWeight: 700 },
  scoreChipBuzz: { background: "#e63b2e", color: "#fff", border: "1px solid #e63b2e", fontWeight: 700, animation: "buzzPulse 0.5s ease infinite" },
  scoreVal: { fontWeight: 700, fontSize: 15 },
  currentPlayer: { textAlign: "center", fontSize: 17, padding: "4px 0" },
  vinylSection: { display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "8px 0" },
  bigVinyl: { width: 148, height: 148, borderRadius: "50%", background: "radial-gradient(circle at 30% 30%, #555, #111 60%, #222 100%)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 0 0 4px #f5c518, 0 0 0 8px #111, 0 0 40px #f5c51844" },
  bigVinylInner: { width: 48, height: 48, borderRadius: "50%", background: "#0d0d0d", border: "2px solid #555", display: "flex", alignItems: "center", justifyContent: "center", color: C.accent },
  buzzerGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  buzzerBtn: { padding: "18px 12px", borderRadius: 16, border: "3px solid rgba(255,255,255,0.15)", color: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontFamily: "inherit", boxShadow: "0 6px 24px #0007", minHeight: 100, transition: "transform 0.08s", userSelect: "none" },
  buzzerIcon: { fontSize: 32 },
  buzzerName: { fontSize: 15, fontWeight: 700, textAlign: "center", wordBreak: "break-word" },
  buzzerJudge: { background: "#150f00", border: `2px solid ${C.accent}`, borderRadius: 16, padding: 18, display: "flex", flexDirection: "column", gap: 12, alignItems: "center" },
  buzzerWinnerBadge: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "rgba(245,197,24,0.1)", borderRadius: 12, padding: "16px 24px", width: "100%" },
  revealCard: { background: C.card, borderRadius: 20, padding: 18, border: `2px solid ${C.accent}`, display: "flex", flexDirection: "column", gap: 12, alignItems: "center" },
  albumThumb: { width: 110, height: 110, borderRadius: 12, overflow: "hidden", background: C.surface, boxShadow: "0 8px 32px #0008" },
  coverImg: { width: "100%", height: "100%", objectFit: "cover" },
  trackInfo: { textAlign: "center" },
  trackArtist: { color: C.muted, fontSize: 14, margin: "0 0 4px", letterSpacing: "0.06em" },
  trackTitle: { fontSize: 19, fontWeight: 700, margin: "0 0 6px", color: C.accent },
  trackYear: { color: C.text, fontSize: 16, margin: 0 },
  resultBtns: { display: "flex", gap: 10, width: "100%" },
  resultOverlay: { position: "fixed", inset: 0, zIndex: 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, pointerEvents: "none" },
  resultText: { fontSize: 24, fontWeight: 900, color: "#fff", fontFamily: "'Impact',sans-serif", letterSpacing: "0.06em", textAlign: "center", padding: "0 24px" },
  resultRow: { display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${C.border}` },
};
