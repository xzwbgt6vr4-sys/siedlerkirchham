import { useState, useEffect, useRef, useCallback } from "react";

const STANDARD_CATS = ["Stadt", "Land", "Fluss", "Tier", "Pflanze", "Beruf"];
const EXTRA_CATS = [
  "Vorname", "Nachname", "Film", "Serie", "Sänger/Band", "Sportler",
  "Marke", "Automarke", "Essen", "Getränk", "Kleidungsstück", "Farbe",
  "Instrument", "Hobby", "Superkraft", "Schimpfwort", "Ausrede", "Entschuldigung",
  "Parteiname", "Politiker", "Videospiel", "Pokémon", "Disney-Figur",
  "Dinge im Bad", "Dinge in der Küche", "Dinge im Büro", "Urlaubsziel",
  "Angst", "Glücksmoment", "Körperteil", "Krankheit", "Medikament",
  "Zaubertrank-Zutat", "Fabelwesen", "Dinosaurier", "Weltraum-Ding",
];

const LETTERS = "ABCDEFGHIJKLMNOPRSTUVWZ".split("");

const LETTER_NAMES = {
  A:"A", B:"Be", C:"Ce", D:"De", E:"E", F:"Ef", G:"Ge", H:"Ha",
  I:"I", J:"Jot", K:"Ka", L:"El", M:"Em", N:"En", O:"O", P:"Pe",
  R:"Er", S:"Es", T:"Te", U:"U", V:"Vau", W:"We", Z:"Zet",
};

function speak(text) {
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "de-DE";
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}

async function fetchSuggestions(letter, categories) {
  const prompt = `Du bist Spielleiter bei Stadt-Land-Fluss. Der aktuelle Buchstabe ist "${letter}".
Gib für jede der folgenden Kategorien genau 3 kreative, korrekte und abwechslungsreiche Lösungsvorschläge an, die alle mit dem Buchstaben "${letter}" beginnen.
Kategorien: ${categories.join(", ")}

Antworte NUR mit einem validen JSON-Objekt, ohne Markdown, ohne Erklärung. Format:
{"Kategorie1": ["Antwort1","Antwort2","Antwort3"], "Kategorie2": ["Antwort1","Antwort2","Antwort3"]}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await response.json();
    const text = (data.content || []).map(b => b.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return {};
  }
}

function PrintSheet({ categories, rounds, playerCount }) {
  return (
    <div className="print-only">
      {Array.from({ length: playerCount }, (_, i) => (
        <div key={i} className="print-sheet">
          <div className="print-header">
            <h2>Stadt · Land · Fluss &nbsp;·&nbsp; Spieler {i + 1}</h2>
          </div>
          <table className="print-table">
            <thead>
              <tr>
                <th>#</th><th>Bst.</th>
                {categories.map(c => <th key={c}>{c}</th>)}
                <th>Punkte</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rounds ?? 15 }, (_, r) => (
                <tr key={r}>
                  <td>{r + 1}</td><td></td>
                  {categories.map(c => <td key={c}></td>)}
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState("setup");
  const [selectedCats, setSelectedCats] = useState(["Stadt","Land","Fluss","Tier"]);
  const [roundMode, setRoundMode] = useState("fixed");
  const [totalRounds, setTotalRounds] = useState(10);
  const [playerCount, setPlayerCount] = useState(4);
  const [blindMode, setBlindMode] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [customCats, setCustomCats] = useState([]);
  const [customInput, setCustomInput] = useState("");
  const customInputRef = useRef(null);

  const addCustomCat = () => {
    const val = customInput.trim();
    if (!val) return;
    const allExisting = [...STANDARD_CATS, ...EXTRA_CATS, ...customCats];
    if (allExisting.map(c=>c.toLowerCase()).includes(val.toLowerCase())) {
      // already exists — just select it
      if (!selectedCats.includes(val)) setSelectedCats(prev => [...prev, val]);
      setCustomInput("");
      return;
    }
    setCustomCats(prev => [...prev, val]);
    setSelectedCats(prev => [...prev, val]);
    setCustomInput("");
    customInputRef.current?.focus();
  };

  const removeCustomCat = (c) => {
    setCustomCats(prev => prev.filter(x => x !== c));
    setSelectedCats(prev => prev.filter(x => x !== c));
  };

  const [currentRound, setCurrentRound] = useState(1);
  const [usedLetters, setUsedLetters] = useState([]);
  const [currentLetter, setCurrentLetter] = useState("");
  const [countIdx, setCountIdx] = useState(0);
  const intervalRef = useRef(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const [suggestions, setSuggestions] = useState({});
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [revealedCats, setRevealedCats] = useState(new Set());

  const toggleCat = (c) =>
    setSelectedCats(prev => prev.includes(c) ? (prev.length > 1 ? prev.filter(x => x !== c) : prev) : [...prev, c]);

  const startCounting = useCallback(() => {
    const spd = 180 + Math.random() * 420;
    setCountIdx(0);
    setScreen("counting");
    speak("Ich fange an zu zählen – A");
    intervalRef.current = setInterval(() => {
      setCountIdx(prev => (prev + 1) % LETTERS.length);
    }, spd);
  }, []);

  const stopCounting = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setListening(false);
    recognitionRef.current?.stop();

    const letter = LETTERS[countIdx];
    let chosen = letter;

    if (usedLetters.includes(letter)) {
      let next = "";
      for (let i = 1; i < LETTERS.length; i++) {
        const c = LETTERS[(LETTERS.indexOf(letter) + i) % LETTERS.length];
        if (!usedLetters.includes(c)) { next = c; break; }
      }
      if (!next) { setScreen("finished"); speak("Spiel beendet! Super gespielt!"); return; }
      chosen = next;
      speak(`Ah, hatten wir schon. Wir nehmen einfach den nächsten – ${LETTER_NAMES[next]}`);
    } else {
      speak(LETTER_NAMES[letter]);
    }

    setCurrentLetter(chosen);
    setUsedLetters(prev => [...prev, chosen]);
    setSuggestions({});
    setRevealedCats(new Set());
    setScreen("stopped");

    setLoadingSuggestions(true);
    fetchSuggestions(chosen, selectedCats)
      .then(s => setSuggestions(s))
      .catch(() => setSuggestions({}))
      .finally(() => setLoadingSuggestions(false));
  }, [countIdx, usedLetters, selectedCats]);

  const nextRound = () => {
    const next = currentRound + 1;
    if (roundMode === "fixed" && next > totalRounds) {
      setScreen("finished");
      speak("Spiel beendet! Super gespielt!");
    } else {
      setCurrentRound(next);
      setScreen("ready");
    }
  };

  useEffect(() => {
    if (screen !== "counting") return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "de-DE";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join(" ").toLowerCase();
      if (t.includes("stopp") || t.includes("stop")) stopCounting();
    };
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
    return () => { rec.stop(); setListening(false); };
  }, [screen, stopCounting]);

  useEffect(() => {
    const handler = (e) => {
      if (e.code === "Space") {
        if (screen === "counting") stopCounting();
        else if (screen === "ready") startCounting();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [screen, stopCounting, startCounting]);

  const toggleReveal = (cat) =>
    setRevealedCats(prev => { const s = new Set(prev); s.has(cat) ? s.delete(cat) : s.add(cat); return s; });

  const revealAll = () => setRevealedCats(new Set(selectedCats));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,700;0,900;1,300&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --ink: #1a1208; --cream: #f5f0e8; --paper: #fdf8f0;
          --gold: #c8922a; --green: #3a6b4a; --red: #b83c2b; --blue: #2b4b8c;
        }
        body { background: var(--cream); font-family: 'DM Mono', monospace; color: var(--ink); min-height: 100vh; }
        .app {
          min-height: 100vh; display: flex; flex-direction: column; align-items: center;
          padding: 1.5rem 1rem;
          background: var(--cream);
          background-image: radial-gradient(circle at 20% 20%, rgba(200,146,42,0.06) 0%, transparent 60%),
            radial-gradient(circle at 80% 80%, rgba(58,107,74,0.06) 0%, transparent 60%);
        }
        .game-title {
          font-family: 'Fraunces', serif; font-weight: 900;
          font-size: clamp(2rem, 8vw, 3.5rem); letter-spacing: -0.02em;
          color: var(--ink); text-align: center; line-height: 1; margin-bottom: 0.2em;
        }
        .game-title span { color: var(--gold); }
        .subtitle { font-size: 0.7rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--gold); text-align: center; margin-bottom: 2rem; }
        .card {
          background: var(--paper); border: 2px solid var(--ink); border-radius: 2px;
          padding: 1.4rem; width: 100%; max-width: 600px;
          box-shadow: 4px 4px 0 var(--ink); margin-bottom: 1rem;
        }
        .card-title {
          font-family: 'Fraunces', serif; font-weight: 700; font-size: 1rem;
          margin-bottom: 0.9rem; display: flex; align-items: center; gap: 0.5rem;
          border-bottom: 1px solid var(--ink); padding-bottom: 0.5rem;
        }
        .chips { display: flex; flex-wrap: wrap; gap: 0.45rem; }
        .chip {
          padding: 0.3rem 0.75rem; border: 1.5px solid var(--ink); border-radius: 100px;
          font-family: 'DM Mono', monospace; font-size: 0.76rem; cursor: pointer;
          background: transparent; color: var(--ink); transition: all 0.13s; user-select: none;
        }
        .chip.active { background: var(--ink); color: var(--cream); }
        .chip.extra { border-color: var(--blue); color: var(--blue); }
        .chip.extra.active { background: var(--blue); color: white; }
        .chip.custom { border-color: var(--green); color: var(--green); }
        .chip.custom.active { background: var(--green); color: white; }
        .chip-remove {
          display: inline-flex; align-items: center; justify-content: center;
          margin-left: 4px; width: 14px; height: 14px; border-radius: 50%;
          background: rgba(255,255,255,0.25); font-size: 10px; line-height: 1;
          cursor: pointer; vertical-align: middle;
        }
        .custom-input-row {
          display: flex; gap: 0.5rem; align-items: center; margin-top: 0.8rem;
        }
        .custom-input {
          flex: 1; padding: 0.45rem 0.75rem; border: 1.5px solid var(--green);
          background: var(--cream); font-family: 'DM Mono', monospace; font-size: 0.85rem;
          border-radius: 2px; color: var(--ink); outline: none;
        }
        .custom-input:focus { box-shadow: 0 0 0 2px rgba(58,107,74,0.2); }
        .custom-input::placeholder { opacity: 0.4; }
        .row { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; }
        .label { font-size: 0.78rem; }
        .num-input {
          width: 70px; padding: 0.4rem 0.6rem; border: 1.5px solid var(--ink);
          background: var(--cream); font-family: 'DM Mono', monospace; font-size: 1rem;
          text-align: center; border-radius: 2px; color: var(--ink);
        }
        .toggle-group { display: flex; border: 1.5px solid var(--ink); border-radius: 2px; overflow: hidden; }
        .toggle-btn { padding: 0.4rem 1rem; border: none; background: transparent; font-family: 'DM Mono', monospace; font-size: 0.78rem; cursor: pointer; color: var(--ink); }
        .toggle-btn.active { background: var(--ink); color: var(--cream); }
        .blind-toggle { display: flex; align-items: center; gap: 0.7rem; cursor: pointer; user-select: none; }
        .switch { width: 44px; height: 24px; background: #ccc; border-radius: 100px; position: relative; border: 1.5px solid var(--ink); transition: background 0.2s; flex-shrink: 0; }
        .switch.on { background: var(--ink); }
        .switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: var(--cream); transition: transform 0.2s; }
        .switch.on::after { transform: translateX(20px); }
        .switch-label { font-size: 0.78rem; line-height: 1.3; }
        .btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
          padding: 0.9rem 2rem; font-family: 'Fraunces', serif; font-weight: 700; font-size: 1.1rem;
          border: 2px solid var(--ink); border-radius: 2px; cursor: pointer; transition: all 0.12s;
          box-shadow: 3px 3px 0 var(--ink); user-select: none; -webkit-tap-highlight-color: transparent;
        }
        .btn:active { transform: translate(2px,2px); box-shadow: 1px 1px 0 var(--ink); }
        .btn-primary { background: var(--ink); color: var(--cream); }
        .btn-green { background: var(--green); color: white; border-color: var(--green); box-shadow: 3px 3px 0 rgba(0,0,0,0.3); }
        .btn-red { background: var(--red); color: white; border-color: var(--red); box-shadow: 3px 3px 0 rgba(0,0,0,0.3); }
        .btn-ghost { background: transparent; color: var(--ink); }
        .btn-sm { padding: 0.35rem 0.8rem; font-size: 0.78rem; box-shadow: 2px 2px 0 var(--ink); }
        .btn-full { width: 100%; }
        .game-screen { width: 100%; max-width: 600px; display: flex; flex-direction: column; align-items: center; gap: 1rem; }
        .round-badge { font-size: 0.72rem; letter-spacing: 0.15em; text-transform: uppercase; color: var(--gold); border: 1px solid var(--gold); padding: 0.2rem 0.8rem; border-radius: 100px; }
        .counter-box {
          background: var(--ink); color: var(--cream); border-radius: 4px;
          width: 100%; padding: 3rem 1rem; text-align: center; position: relative; overflow: hidden;
        }
        .counter-box::before {
          content:''; position:absolute; inset:0;
          background: repeating-linear-gradient(45deg,transparent,transparent 20px,rgba(255,255,255,0.02) 20px,rgba(255,255,255,0.02) 40px);
        }
        .counter-letter {
          font-family: 'Fraunces', serif; font-weight: 900;
          font-size: clamp(5rem, 25vw, 10rem); line-height: 1; color: var(--gold);
          position: relative; z-index: 1; animation: popIn 0.12s ease;
        }
        .counter-blind {
          font-family: 'Fraunces', serif; font-weight: 900;
          font-size: clamp(3rem, 15vw, 7rem); line-height: 1;
          color: rgba(200,146,42,0.18); position: relative; z-index: 1; letter-spacing: 0.15em;
          animation: breathe 1.8s ease-in-out infinite;
        }
        @keyframes breathe { 0%,100%{opacity:0.18} 50%{opacity:0.35} }
        @keyframes popIn { 0%{transform:scale(0.7);opacity:0.3} 100%{transform:scale(1);opacity:1} }
        .counter-hint { font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(245,240,232,0.4); margin-top: 1rem; position: relative; z-index: 1; }
        .mic-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #e74c3c; margin-right: 6px; animation: blink 1s infinite; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        .result-box {
          background: var(--paper); border: 3px solid var(--ink); border-radius: 4px;
          width: 100%; padding: 2rem 1rem; text-align: center; box-shadow: 6px 6px 0 var(--ink);
        }
        .result-letter { font-family: 'Fraunces', serif; font-weight: 900; font-size: clamp(4.5rem, 20vw, 8rem); line-height: 1; color: var(--ink); }
        .result-name { font-size: 0.9rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--gold); margin-top: 0.3rem; }

        /* SUGGESTIONS */
        .suggestions-grid { display: flex; flex-direction: column; gap: 0.55rem; width: 100%; }
        .suggestion-row { border: 1.5px solid var(--ink); border-radius: 2px; overflow: hidden; background: var(--paper); cursor: pointer; transition: box-shadow 0.15s; }
        .suggestion-row:active { box-shadow: 2px 2px 0 var(--ink); }
        .suggestion-header { display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.85rem; background: var(--ink); color: var(--cream); }
        .suggestion-cat { font-family: 'Fraunces', serif; font-weight: 700; font-size: 0.92rem; }
        .suggestion-arrow { font-size: 0.75rem; opacity: 0.5; transition: transform 0.2s; display: inline-block; }
        .suggestion-arrow.open { transform: rotate(90deg); }
        .suggestion-answers { display: flex; gap: 0.5rem; flex-wrap: wrap; padding: 0.65rem 0.85rem; animation: slideDown 0.18s ease; }
        @keyframes slideDown { from{opacity:0;transform:translateY(-5px)} to{opacity:1;transform:translateY(0)} }
        .suggestion-tag { padding: 0.3rem 0.75rem; background: var(--cream); border: 1.5px solid var(--gold); border-radius: 100px; font-size: 0.85rem; font-family: 'Fraunces', serif; font-weight: 700; }
        .letter-hl { color: var(--gold); }
        .loading-row { display: flex; gap: 5px; justify-content: center; padding: 0.8rem 0; }
        .loading-row span { width: 7px; height: 7px; border-radius: 50%; background: var(--gold); animation: bounce 1.2s infinite; }
        .loading-row span:nth-child(2) { animation-delay: 0.2s; }
        .loading-row span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce { 0%,80%,100%{transform:scale(0.7);opacity:0.4} 40%{transform:scale(1);opacity:1} }

        .used-letters { display: flex; flex-wrap: wrap; gap: 0.4rem; justify-content: center; }
        .used-letter { width: 2rem; height: 2rem; display: flex; align-items: center; justify-content: center; border: 1.5px solid var(--ink); font-family: 'Fraunces', serif; font-weight: 700; font-size: 0.9rem; border-radius: 2px; background: var(--ink); color: var(--cream); }
        .cats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 0.5rem; width: 100%; }
        .cat-item { border: 1.5px solid var(--ink); border-radius: 2px; padding: 0.55rem 0.7rem; font-size: 0.78rem; text-align: center; background: var(--paper); }
        .finished-title { font-family: 'Fraunces', serif; font-weight: 900; font-size: clamp(2.5rem,10vw,5rem); color: var(--gold); }
        .finished-box { text-align: center; padding: 2rem; }
        .hint-text { font-size: 0.7rem; opacity: 0.45; text-align: center; letter-spacing: 0.07em; }

        @media print {
          body > * { display: none !important; }
          .print-only { display: block !important; }
        }
        .print-only { display: none; }
        .print-sheet { page-break-after: always; padding: 20mm; font-family: Arial, sans-serif; }
        .print-header h2 { font-size: 18pt; margin-bottom: 12pt; border-bottom: 2pt solid #000; padding-bottom: 6pt; }
        .print-table { width: 100%; border-collapse: collapse; font-size: 9pt; }
        .print-table th, .print-table td { border: 1pt solid #888; padding: 5pt 4pt; text-align: left; height: 22pt; }
        .print-table th { background: #f0f0f0; font-weight: bold; font-size: 8pt; text-transform: uppercase; }
        .print-table td:first-child, .print-table td:nth-child(2) { width: 18pt; text-align: center; }
        .print-table tr:nth-child(even) td { background: #fafafa; }
        @media print { .no-print { display: none !important; } }
      `}</style>

      {showPrint && (
        <PrintSheet categories={selectedCats} rounds={roundMode === "fixed" ? totalRounds : null} playerCount={playerCount} />
      )}

      <div className="app no-print">
        <h1 className="game-title">Stadt<span>·</span>Land<span>·</span>Fluss</h1>
        <p className="subtitle">Der digitale Spielleiter</p>

        {/* ── SETUP ─────────────────────────────────────────────────── */}
        {screen === "setup" && (
          <div style={{width:"100%",maxWidth:600,display:"flex",flexDirection:"column",gap:"1rem"}}>
            <div className="card">
              <div className="card-title">📋 Standard-Kategorien</div>
              <div className="chips">
                {STANDARD_CATS.map(c => (
                  <button key={c} className={`chip ${selectedCats.includes(c)?"active":""}`} onClick={()=>toggleCat(c)}>{c}</button>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-title">🎲 Extra-Kategorien</div>
              <div className="chips">
                {EXTRA_CATS.map(c => (
                  <button key={c} className={`chip extra ${selectedCats.includes(c)?"active":""}`} onClick={()=>toggleCat(c)}>{c}</button>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-title">✏️ Eigene Kategorien</div>
              {customCats.length > 0 && (
                <div className="chips" style={{marginBottom:"0.7rem"}}>
                  {customCats.map(c => (
                    <button key={c} className={`chip custom ${selectedCats.includes(c)?"active":""}`} onClick={()=>toggleCat(c)}>
                      {c}
                      <span className="chip-remove" onClick={e=>{e.stopPropagation();removeCustomCat(c);}}>✕</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="custom-input-row">
                <input
                  ref={customInputRef}
                  className="custom-input"
                  placeholder="z.B. Superheld, Pasta-Gericht…"
                  value={customInput}
                  onChange={e=>setCustomInput(e.target.value)}
                  onKeyDown={e=>{ if(e.key==="Enter") addCustomCat(); }}
                  maxLength={40}
                />
                <button className="btn btn-ghost btn-sm"
                  style={{borderColor:"var(--green)",color:"var(--green)",whiteSpace:"nowrap"}}
                  onClick={addCustomCat}>
                  + hinzufügen
                </button>
              </div>
              <p style={{fontSize:"0.7rem",opacity:0.45,marginTop:"0.5rem"}}>Enter oder Knopf · wird automatisch ausgewählt</p>
            </div>

            <div className="card">
              <div className="card-title">⚙️ Spieleinstellungen</div>
              <div style={{display:"flex",flexDirection:"column",gap:"1rem"}}>
                <div className="row">
                  <span className="label">Runden:</span>
                  <div className="toggle-group">
                    <button className={`toggle-btn ${roundMode==="fixed"?"active":""}`} onClick={()=>setRoundMode("fixed")}>Fest</button>
                    <button className={`toggle-btn ${roundMode==="free"?"active":""}`} onClick={()=>setRoundMode("free")}>Frei</button>
                  </div>
                  {roundMode==="fixed" && (
                    <input className="num-input" type="number" min={1} max={26} value={totalRounds}
                      onChange={e=>setTotalRounds(Math.max(1,Math.min(26,+e.target.value)))} />
                  )}
                </div>
                <div className="row">
                  <span className="label">Spieler (Ausdruck):</span>
                  <input className="num-input" type="number" min={1} max={12} value={playerCount}
                    onChange={e=>setPlayerCount(Math.max(1,Math.min(12,+e.target.value)))} />
                </div>
                <div className="row">
                  <label className="blind-toggle" onClick={()=>setBlindMode(v=>!v)}>
                    <div className={`switch ${blindMode?"on":""}`} />
                    <span className="switch-label">
                      {blindMode
                        ? "🙈 Blindes Zählen – Buchstabe bleibt verborgen"
                        : "👁️ Buchstabe beim Zählen sichtbar"}
                    </span>
                  </label>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-title">🖨️ Ausdrucke</div>
              <p style={{fontSize:"0.78rem",marginBottom:"0.8rem",opacity:0.7}}>
                {selectedCats.length} Kategorien · {playerCount} Spieler · {roundMode==="fixed"?totalRounds+" Runden":"unbegrenzt"}
              </p>
              <button className="btn btn-ghost btn-sm" onClick={()=>{setShowPrint(true);setTimeout(()=>window.print(),300);}}>
                🖨️ A4-Bögen drucken
              </button>
            </div>
            <button className="btn btn-primary btn-full" style={{fontSize:"1.25rem",padding:"1.2rem"}}
              onClick={()=>setScreen("ready")}>
              Spiel starten →
            </button>
          </div>
        )}

        {/* ── READY ─────────────────────────────────────────────────── */}
        {screen === "ready" && (
          <div className="game-screen">
            <div className="round-badge">Runde {currentRound}{roundMode==="fixed"?` von ${totalRounds}`:""}</div>
            <div className="card" style={{width:"100%"}}>
              <div className="card-title">🗂️ Kategorien</div>
              <div className="cats-grid">
                {selectedCats.map(c=><div key={c} className="cat-item">{c}</div>)}
              </div>
            </div>
            {usedLetters.length > 0 && (
              <div className="card" style={{width:"100%"}}>
                <div className="card-title">✅ Bereits genutzt</div>
                <div className="used-letters">
                  {usedLetters.map(l=><div key={l} className="used-letter">{l}</div>)}
                </div>
              </div>
            )}
            <button className="btn btn-green btn-full" style={{fontSize:"1.5rem",padding:"1.5rem"}} onClick={startCounting}>
              ▶ Zählen starten
            </button>
            <p className="hint-text">oder Leertaste drücken</p>
            <button className="btn btn-ghost btn-sm" onClick={()=>setScreen("setup")}>← Einstellungen</button>
          </div>
        )}

        {/* ── COUNTING ──────────────────────────────────────────────── */}
        {screen === "counting" && (
          <div className="game-screen">
            <div className="round-badge">Runde {currentRound}{blindMode ? " · 🙈 blind" : ""}</div>
            <div className="counter-box">
              {blindMode
                ? <div className="counter-blind">· · ·</div>
                : <div key={LETTERS[countIdx]} className="counter-letter">{LETTERS[countIdx]}</div>
              }
              <div className="counter-hint">
                {listening && <><span className="mic-dot"/>Hört auf „Stopp"</>}
                {!listening && "Tippe auf STOPP"}
              </div>
            </div>
            <button className="btn btn-red btn-full" style={{fontSize:"2rem",padding:"1.8rem"}} onClick={stopCounting}>
              ⏹ STOPP
            </button>
            <p className="hint-text">Ruf „Stopp!" · Leertaste · oder Knopf</p>
          </div>
        )}

        {/* ── STOPPED ───────────────────────────────────────────────── */}
        {screen === "stopped" && (
          <div className="game-screen">
            <div className="round-badge">Runde {currentRound} · Buchstabe</div>

            <div className="result-box">
              <div className="result-letter">{currentLetter}</div>
              <div className="result-name">{LETTER_NAMES[currentLetter]}</div>
            </div>

            {/* KI-Vorschläge */}
            <div className="card" style={{width:"100%"}}>
              <div className="card-title" style={{justifyContent:"space-between",flexWrap:"wrap",gap:"0.4rem"}}>
                <span>✨ Lösungsvorschläge der App</span>
                {!loadingSuggestions && Object.keys(suggestions).length > 0 && (
                  <button className="btn btn-ghost btn-sm" style={{fontSize:"0.72rem"}} onClick={revealAll}>
                    alle aufdecken
                  </button>
                )}
              </div>

              {loadingSuggestions && (
                <div>
                  <p style={{fontSize:"0.75rem",opacity:0.5,marginBottom:"0.5rem",textAlign:"center"}}>Überlege Vorschläge…</p>
                  <div className="loading-row"><span/><span/><span/></div>
                </div>
              )}

              {!loadingSuggestions && Object.keys(suggestions).length === 0 && (
                <p style={{fontSize:"0.78rem",opacity:0.5,textAlign:"center"}}>Keine Vorschläge verfügbar</p>
              )}

              {!loadingSuggestions && Object.keys(suggestions).length > 0 && (
                <div className="suggestions-grid">
                  <p className="hint-text" style={{marginBottom:"0.3rem"}}>Tippe auf eine Kategorie zum Aufdecken</p>
                  {selectedCats.map(cat => {
                    const answers = suggestions[cat] ?? [];
                    const revealed = revealedCats.has(cat);
                    return (
                      <div key={cat} className="suggestion-row" onClick={()=>toggleReveal(cat)}>
                        <div className="suggestion-header">
                          <span className="suggestion-cat">{cat}</span>
                          <span className={`suggestion-arrow ${revealed?"open":""}`}>▶</span>
                        </div>
                        {revealed && (
                          <div className="suggestion-answers">
                            {answers.length > 0 ? answers.map((a, i) => (
                              <span key={i} className="suggestion-tag">
                                <span className="letter-hl">{a[0]}</span>{a.slice(1)}
                              </span>
                            )) : (
                              <span style={{fontSize:"0.78rem",opacity:0.5}}>—</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button className="btn btn-green btn-full" style={{fontSize:"1.25rem",padding:"1.3rem"}} onClick={nextRound}>
              {roundMode==="fixed" && currentRound >= totalRounds ? "🏁 Spiel beenden" : "Nächste Runde →"}
            </button>
          </div>
        )}

        {/* ── FINISHED ──────────────────────────────────────────────── */}
        {screen === "finished" && (
          <div className="game-screen">
            <div className="card" style={{width:"100%"}}>
              <div className="finished-box">
                <div style={{fontSize:"3rem",marginBottom:"0.5rem"}}>🎉</div>
                <div className="finished-title">Spiel vorbei!</div>
                <p style={{marginTop:"1rem",fontSize:"0.85rem",opacity:0.7}}>{usedLetters.length} Runden gespielt</p>
                <div className="used-letters" style={{marginTop:"1.2rem",justifyContent:"center"}}>
                  {usedLetters.map(l=><div key={l} className="used-letter">{l}</div>)}
                </div>
              </div>
            </div>
            <button className="btn btn-primary btn-full" style={{fontSize:"1.2rem",padding:"1.2rem"}}
              onClick={()=>{setScreen("setup");setCurrentRound(1);setUsedLetters([]);setCurrentLetter("");setSuggestions({});}}>
              🔄 Neues Spiel
            </button>
          </div>
        )}
      </div>
    </>
  );
}
