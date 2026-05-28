import { useState, useEffect, useRef, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

/* ── helpers ── */
const td = () => new Date().toISOString().split("T")[0];
const dow = (d) => new Date(d+"T12:00:00").getDay();
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const fmt = (d) => {
  const x = new Date(d+"T12:00:00");
  const dn = ["Dom","Lun","Mar","Mer","Gio","Ven","Sab"];
  const mn = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
  return dn[x.getDay()]+" "+x.getDate()+" "+mn[x.getMonth()];
};

/* ── storage ── */
const PK = "ss:profile";
const DK = "ss:data";
async function sGet(k) {
  try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; }
  catch(e) { return null; }
}
async function sSet(k, v) {
  try { await window.storage.set(k, JSON.stringify(v)); }
  catch(e) { console.error(e); }
}

/* ── calculations ── */
function targets(p, w) {
  const wt = w || p.sw || 87.4;
  const ht = p.h || p.height || 193;
  const age = p.age || 33;
  const pk = p.protKg || 1.8;
  const days = p.trDays || [2,4,6];
  const bmr = Math.round(10*wt + 6.25*ht - 5*age + 5);
  const tdee = Math.round(bmr * 1.55);
  const train = days.includes(dow(td()));
  const kcal = train ? tdee + 200 : tdee - 100;
  const prot = Math.round(wt * pk);
  const fat = Math.round((kcal * 0.28) / 9);
  const carbs = Math.round((kcal - prot*4 - fat*9) / 4);
  return { bmr, tdee, kcal, prot, fat, carbs, train, wt };
}

function msum(arr) {
  return (arr||[]).reduce((a,m) => ({
    kcal: a.kcal+(m.kcal||0), prot: a.prot+(m.prot||0),
    fat: a.fat+(m.fat||0), carbs: a.carbs+(m.carbs||0)
  }), {kcal:0, prot:0, fat:0, carbs:0});
}

function lastWeight(d) {
  const ks = Object.keys(d.weights||{}).sort();
  return ks.length ? d.weights[ks[ks.length-1]] : null;
}

/* ── colors ── */
const K = {
  bg:"#0c1017", card:"#151c28", brd:"rgba(255,255,255,0.06)",
  g:"#22c55e", b:"#60a5fa", a:"#f59e0b", r:"#ef4444",
  txt:"#e5e7eb", mut:"#6b7280", dim:"#4b5563"
};

/* ── small components ── */
function Ring({val, max, sz=72, clr=K.g, lbl}) {
  const pct = max > 0 ? Math.min(val/max, 1.2) : 0;
  const r = (sz-6)/2;
  const c = 2*Math.PI*r;
  return (
    <div style={{textAlign:"center"}}>
      <div style={{position:"relative",width:sz,height:sz,margin:"0 auto"}}>
        <svg width={sz} height={sz} style={{transform:"rotate(-90deg)"}}>
          <circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5}/>
          <circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke={pct>1?K.a:clr}
            strokeWidth={5} strokeDasharray={c} strokeDashoffset={c*(1-Math.min(pct,1))}
            strokeLinecap="round" style={{transition:"all 0.4s"}}/>
        </svg>
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
          <div style={{fontSize:14,fontWeight:700,color:"#fff"}}>{val}</div>
          <div style={{fontSize:8,color:K.mut}}>/{max}</div>
        </div>
      </div>
      {lbl && <div style={{fontSize:9,color:K.mut,marginTop:3}}>{lbl}</div>}
    </div>
  );
}

function Prog({val, max, clr, lbl}) {
  const pct = max > 0 ? Math.min((val/max)*100, 100) : 0;
  return (
    <div style={{flex:1}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:K.mut,marginBottom:2}}>
        <span>{lbl}</span><span>{val}/{max}g</span>
      </div>
      <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,0.06)"}}>
        <div style={{height:4,borderRadius:2,background:clr,width:pct+"%",transition:"width 0.3s"}}/>
      </div>
    </div>
  );
}

/* ════════════════════════════ */
/*         MAIN APP            */
/* ════════════════════════════ */
export default function SeitanSensei() {
  const [ready, setReady] = useState(false);
  const [prof, setProf] = useState(null);
  const [data, setData] = useState({weights:{}, meals:{}});
  const [tab, setTab] = useState("oggi");
  const [toast, setToast] = useState(null);

  // form states
  const [adding, setAdding] = useState(false);
  const [mf, setMf] = useState({name:"",kcal:"",prot:"",fat:"",carbs:""});
  const [wIn, setWIn] = useState("");
  const [selDay, setSelDay] = useState(td());

  // photo states
  const [photoOn, setPhotoOn] = useState(false);
  const [photoItems, setPhotoItems] = useState(null);
  const [photoWait, setPhotoWait] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoQty, setPhotoQty] = useState("");
  const fileRef = useRef(null);

  // search states
  const [searchOn, setSearchOn] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchItems, setSearchItems] = useState(null);
  const [searchWait, setSearchWait] = useState(false);
  const [searchEdit, setSearchEdit] = useState(false);

  // setup
  const [sf, setSf] = useState({name:"Matteo",age:"33",h:"193",sw:"87.4",protKg:"1.8"});

  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  // load data
  useEffect(() => {
    (async () => {
      let p = await sGet(PK);
      const d = await sGet(DK);
      // fix old profiles missing trDays
      if (p && !p.trDays) {
        p = {...p, trDays: [2,4,6], h: p.h || p.height || 193, sw: p.sw || p.startWeight || 87.4, protKg: p.protKg || 1.8, age: p.age || 33, startDate: p.startDate || td()};
        sSet(PK, p);
      }
      if (p) setProf(p);
      if (d) setData(d);
      setReady(true);
    })();
  }, []);

  // save helper
  const upData = useCallback((fn) => {
    setData(prev => {
      const next = fn(prev);
      sSet(DK, next);
      return next;
    });
  }, []);

  // derived
  const cw = lastWeight(data) || (prof ? prof.sw : 87.4);
  const tgt = prof ? targets(prof, cw) : null;
  const todayM = data.meals?.[td()] || [];
  const todayS = msum(todayM);
  const isMon = dow(td()) === 1;
  const isSun = dow(td()) === 0;

  /* ── actions ── */
  const addMeal = () => {
    if (!mf.name || !mf.kcal) return flash("Serve nome e kcal");
    const m = {id:uid(), name:mf.name, kcal:+mf.kcal||0, prot:+mf.prot||0, fat:+mf.fat||0, carbs:+mf.carbs||0, time:new Date().toTimeString().slice(0,5)};
    upData(d => ({...d, meals:{...d.meals, [td()]:[...(d.meals?.[td()]||[]), m]}}));
    setMf({name:"",kcal:"",prot:"",fat:"",carbs:""});
    setAdding(false);
    flash("Aggiunto "+m.name);
  };

  const delMeal = (date, id) => {
    upData(d => ({...d, meals:{...d.meals, [date]:(d.meals?.[date]||[]).filter(m => m.id !== id)}}));
  };

  const addW = () => {
    const w = parseFloat(wIn);
    if (!w || w < 40 || w > 200) return flash("Peso non valido");
    upData(d => ({...d, weights:{...d.weights, [td()]:w}}));
    setWIn("");
    flash("Peso "+w+" kg salvato");
  };

  const pickPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoOn(true);
    setPhotoItems(null);
    setPhotoQty("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const analyzePhoto = async () => {
    if (!photoFile) return flash("Carica una foto");
    if (!photoQty.trim()) return flash("Scrivi cosa e quanto");
    setPhotoWait(true); setPhotoItems(null);
    try {
      const b64 = await new Promise((ok, no) => {
        const r = new FileReader();
        r.onload = () => ok(r.result.split(",")[1]);
        r.onerror = no;
        r.readAsDataURL(photoFile);
      });
      const res = await fetch("/api/anthropic", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          messages: [{role: "user", content: [
            {type: "image", source: {type: "base64", media_type: photoFile.type || "image/jpeg", data: b64}},
            {type: "text", text: "Questa e' la foto di un prodotto alimentare o di un piatto. L'utente ha consumato: "+photoQty.trim()+"\n\nSe vedi una tabella nutrizionale/etichetta (INCI), leggila e calcola i valori nutrizionali esatti per la quantita indicata dall'utente.\nSe e' una foto di un piatto senza etichetta, stima visivamente.\nDieta vegetariana (no carne, no pesce).\n\nRispondi SOLO con JSON valido senza altro testo:\n{\"items\":[{\"name\":\"nome prodotto\",\"grams\":grammi_totali_consumati,\"kcal\":calorie_totali,\"protein\":proteine_g,\"fat\":grassi_g,\"carbs\":carboidrati_g}]}"}
          ]}]
        })
      });
      const j = await res.json();
      const txt = (j.content || []).map(c => c.text || "").join("");
      const clean = txt.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setPhotoItems(parsed.items || []);
    } catch(err) {
      console.error(err);
      setPhotoItems([]);
      flash("Errore analisi foto");
    }
    setPhotoWait(false);
  };

  const confirmPhoto = () => {
    if (!photoItems || photoItems.length === 0) return;
    const newMeals = photoItems.map(i => ({
      id: uid(), name: i.name, kcal: Math.round(i.kcal), prot: Math.round(i.protein),
      fat: Math.round(i.fat||0), carbs: Math.round(i.carbs||0),
      time: new Date().toTimeString().slice(0,5), ph: true
    }));
    upData(d => ({...d, meals:{...d.meals, [td()]:[...(d.meals?.[td()]||[]), ...newMeals]}}));
    setPhotoOn(false); setPhotoItems(null); setPhotoFile(null); setPhotoQty("");
    flash(newMeals.length+" alimenti aggiunti");
  };

  const doSearch = async () => {
    if (!searchQ.trim()) return flash("Scrivi il nome del prodotto");
    setSearchWait(true); setSearchItems(null);
    try {
      const res = await fetch("https://world.openfoodfacts.org/cgi/search.pl?search_terms="+encodeURIComponent(searchQ.trim())+"&json=1&page_size=6&fields=product_name,brands,nutriments,serving_size,image_url");
      const j = await res.json();
      const products = (j.products || []).filter(p => p.nutriments && p.nutriments["energy-kcal_100g"]).map(p => ({
        name: (p.product_name || "Sconosciuto") + (p.brands ? " ("+p.brands+")" : ""),
        source: "OpenFoodFacts",
        serving: p.serving_size || null,
        per100: {
          kcal: Math.round(p.nutriments["energy-kcal_100g"] || 0),
          protein: Math.round((p.nutriments.proteins_100g || 0) * 10) / 10,
          fat: Math.round((p.nutriments.fat_100g || 0) * 10) / 10,
          carbs: Math.round((p.nutriments.carbohydrates_100g || 0) * 10) / 10
        },
        grams: 100,
        kcal: Math.round(p.nutriments["energy-kcal_100g"] || 0),
        protein: Math.round((p.nutriments.proteins_100g || 0) * 10) / 10,
        fat: Math.round((p.nutriments.fat_100g || 0) * 10) / 10,
        carbs: Math.round((p.nutriments.carbohydrates_100g || 0) * 10) / 10
      }));
      setSearchItems(products.length > 0 ? products : []);
      if (products.length === 0) flash("Nessun prodotto trovato");
    } catch(err) {
      console.error(err);
      setSearchItems([]);
      flash("Errore nella ricerca");
    }
    setSearchWait(false);
  };

  const updateSearchGrams = (idx, newGrams) => {
    const c = [...searchItems];
    const g = parseFloat(newGrams) || 0;
    const p = c[idx].per100;
    c[idx] = {...c[idx], grams: g, kcal: Math.round(p.kcal * g / 100), protein: Math.round(p.protein * g / 100 * 10) / 10, fat: Math.round(p.fat * g / 100 * 10) / 10, carbs: Math.round(p.carbs * g / 100 * 10) / 10};
    setSearchItems(c);
  };

  const confirmSearch = () => {
    if (!searchItems || searchItems.length === 0) return;
    const newMeals = searchItems.map(i => ({
      id: uid(), name: i.name, kcal: Math.round(i.kcal), prot: Math.round(i.protein || 0),
      fat: Math.round(i.fat || 0), carbs: Math.round(i.carbs || 0),
      time: new Date().toTimeString().slice(0,5), src: "search"
    }));
    upData(d => ({...d, meals:{...d.meals, [td()]:[...(d.meals?.[td()]||[]), ...newMeals]}}));
    setSearchOn(false); setSearchItems(null); setSearchQ(""); setSearchEdit(false);
    flash(newMeals.length+" alimenti aggiunti");
  };

  const doExport = () => {
    const blob = new Blob([JSON.stringify({profile:prof, data, date:new Date().toISOString()}, null, 2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "seitan-sensei-"+td()+".json";
    a.click();
    flash("Backup scaricato");
  };

  // chart data
  const wChart = Object.entries(data.weights||{}).sort(([a],[b]) => a.localeCompare(b)).map(([d,w]) => ({date:d.slice(5), kg:w}));
  const allDays = [...new Set([...Object.keys(data.meals||{}), ...Object.keys(data.weights||{})])].sort().reverse();

  /* ── styles ── */
  const bx = {background:K.card, borderRadius:14, padding:14, marginBottom:10};
  const lb = {fontSize:10, color:K.mut, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6};
  const ip = {background:"rgba(255,255,255,0.05)", border:"1px solid "+K.brd, borderRadius:8, padding:"9px 12px", color:"#fff", fontSize:14, width:"100%", outline:"none", boxSizing:"border-box"};
  const bg = {background:K.g, color:"#000", border:"none", borderRadius:10, padding:"11px 0", fontSize:13, fontWeight:700, cursor:"pointer", width:"100%"};
  const bo = {background:"rgba(255,255,255,0.05)", color:K.txt, border:"1px solid "+K.brd, borderRadius:10, padding:"9px 14px", fontSize:12, fontWeight:600, cursor:"pointer"};

  /* ── LOADING ── */
  if (!ready) return (
    <div style={{background:K.bg, color:K.txt, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"system-ui"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:44}}>🥋</div>
        <div style={{color:K.g, fontWeight:800, fontSize:20, marginTop:8}}>SEITAN SENSEI</div>
        <div style={{color:K.mut, fontSize:11, marginTop:6}}>Caricamento...</div>
      </div>
    </div>
  );

  /* ── SETUP ── */
  if (!prof) return (
    <div style={{background:K.bg, color:K.txt, minHeight:"100vh", padding:20, fontFamily:"system-ui", maxWidth:440, margin:"0 auto"}}>
      <div style={{textAlign:"center", padding:"40px 0 24px"}}>
        <div style={{fontSize:52}}>🥋</div>
        <div style={{color:K.g, fontWeight:800, fontSize:24, marginTop:8}}>SEITAN SENSEI</div>
        <div style={{color:K.mut, fontSize:11, marginTop:6, letterSpacing:"0.1em"}}>CONFIGURA IL TUO DOJO</div>
      </div>
      <div style={bx}>
        {[
          {k:"name",l:"Nome"}, {k:"age",l:"Eta"}, {k:"h",l:"Altezza (cm)"},
          {k:"sw",l:"Peso (kg)"}, {k:"protKg",l:"Proteine (g/kg)"}
        ].map(f => (
          <div key={f.k} style={{marginBottom:12}}>
            <div style={lb}>{f.l}</div>
            <input style={ip} value={sf[f.k]} onChange={e => setSf(p => ({...p, [f.k]:e.target.value}))} />
          </div>
        ))}
      </div>
      <button style={bg} onClick={() => {
        const p = {name:sf.name, age:+sf.age||33, h:+sf.h||193, sw:+sf.sw||87.4, protKg:+sf.protKg||1.8, trDays:[2,4,6], startDate:td()};
        setProf(p);
        sSet(PK, p);
      }}>ENTRA NEL DOJO</button>
      <style>{`input::placeholder{color:#4b5563} *{box-sizing:border-box}`}</style>
    </div>
  );

  /* ══════════════════════════════ */
  /*          MAIN RENDER          */
  /* ══════════════════════════════ */
  return (
    <div style={{background:K.bg, color:K.txt, minHeight:"100vh", fontFamily:"system-ui", maxWidth:440, margin:"0 auto", paddingBottom:68}}>

      {/* Toast */}
      {toast && <div style={{position:"fixed", top:12, left:"50%", transform:"translateX(-50%)", background:"#14532d", color:"#fff", padding:"8px 20px", borderRadius:10, fontSize:13, fontWeight:600, zIndex:99, boxShadow:"0 4px 20px rgba(0,0,0,0.5)"}}>{toast}</div>}

      {/* Header */}
      <div style={{padding:"16px 16px 10px"}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <span style={{color:K.g, fontWeight:800, fontSize:17}}>🥋 SEITAN SENSEI</span>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:12, color:K.mut}}>{fmt(td())}</div>
            {tgt && <span style={{fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:10, background:tgt.train?"rgba(34,197,94,0.15)":"rgba(96,165,250,0.15)", color:tgt.train?K.g:K.b}}>{tgt.train ? "TRAINING" : "RIPOSO"}</span>}
          </div>
        </div>
        {isSun && <div style={{marginTop:8, padding:"6px 10px", borderRadius:8, background:"rgba(245,158,11,0.1)", fontSize:11, color:K.a}}>Domani pesati appena sveglio!</div>}
        {isMon && !data.weights?.[td()] && <div style={{marginTop:8, padding:"6px 10px", borderRadius:8, background:"rgba(34,197,94,0.1)", fontSize:11, color:K.g}}>Lunedi! Registra il peso.</div>}
      </div>

      <div style={{padding:"0 16px"}}>

        {/* ═══════ OGGI ═══════ */}
        {tab === "oggi" && tgt && (
          <div>
            {/* Rings */}
            <div style={{...bx, display:"flex", justifyContent:"space-around", alignItems:"center", padding:18}}>
              <Ring val={todayS.kcal} max={tgt.kcal} clr={K.g} lbl="KCAL" />
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:9, color:K.mut}}>RIMASTE</div>
                <div style={{fontSize:22, fontWeight:700, color:tgt.kcal-todayS.kcal >= 0 ? K.g : K.a}}>
                  {tgt.kcal-todayS.kcal >= 0 ? tgt.kcal-todayS.kcal : "+"+Math.abs(tgt.kcal-todayS.kcal)}
                </div>
                <div style={{fontSize:9, color:K.mut}}>kcal</div>
              </div>
              <Ring val={todayS.prot} max={tgt.prot} clr={K.b} lbl="PROT" />
            </div>

            {/* Macro bars */}
            <div style={{...bx, display:"flex", gap:10}}>
              <Prog val={todayS.prot} max={tgt.prot} clr={K.b} lbl="Prot" />
              <Prog val={todayS.fat} max={tgt.fat} clr={K.a} lbl="Grassi" />
              <Prog val={todayS.carbs} max={tgt.carbs} clr="#a78bfa" lbl="Carbo" />
            </div>

            {/* Status */}
            {todayM.length > 0 && (
              <div style={{...bx, fontSize:12, padding:10}}>
                {todayS.prot >= tgt.prot
                  ? <span style={{color:K.g}}>Proteine ok! </span>
                  : <span>Mancano <b style={{color:K.g}}>{tgt.prot - todayS.prot}g</b> prot. </span>}
                {tgt.kcal - todayS.kcal > 0
                  ? <span>Hai {tgt.kcal - todayS.kcal} kcal libere.</span>
                  : tgt.kcal - todayS.kcal < -200
                    ? <span style={{color:K.a}}>{Math.abs(tgt.kcal - todayS.kcal)} kcal oltre.</span>
                    : <span style={{color:K.g}}>In target.</span>}
              </div>
            )}

            {/* Meal list */}
            <div style={bx}>
              <div style={{...lb, display:"flex", justifyContent:"space-between"}}>
                <span>PASTI</span><span>{todayM.length}</span>
              </div>
              {todayM.length === 0 && <div style={{color:K.dim, fontSize:12, padding:"8px 0"}}>Nessun pasto registrato</div>}
              {todayM.map(m => (
                <div key={m.id} style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid "+K.brd}}>
                  <div>
                    <div style={{fontSize:13}}>{m.ph ? "📸 " : m.src === "search" ? "🔍 " : ""}{m.name} <span style={{color:K.mut, fontSize:11}}>{m.time}</span></div>
                    <div style={{fontSize:10, color:K.mut}}>P{m.prot}g G{m.fat}g C{m.carbs}g</div>
                  </div>
                  <div style={{display:"flex", alignItems:"center", gap:8}}>
                    <span style={{fontSize:13, fontWeight:600}}>{m.kcal}</span>
                    <button onClick={() => delMeal(td(), m.id)} style={{background:"none", border:"none", color:K.dim, cursor:"pointer", fontSize:14}}>x</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Buttons */}
            <div style={{display:"flex", gap:8, marginBottom:10}}>
              <button style={bg} onClick={() => setAdding(true)}>+ Pasto</button>
              <button style={{...bo, padding:"11px 16px"}} onClick={() => {setSearchOn(true); setSearchItems(null); setSearchQ("");}}>🔍</button>
            </div>

            {/* Add meal form */}
            {adding && (
              <div style={{...bx, border:"1px solid rgba(34,197,94,0.2)"}}>
                <div style={lb}>NUOVO PASTO</div>
                <input style={{...ip, marginBottom:6}} placeholder="Nome (es. Pasta e ceci)" value={mf.name} onChange={e => setMf(p => ({...p, name:e.target.value}))} />
                <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:8}}>
                  <input style={ip} type="number" placeholder="Kcal" value={mf.kcal} onChange={e => setMf(p => ({...p, kcal:e.target.value}))} />
                  <input style={ip} type="number" placeholder="Proteine g" value={mf.prot} onChange={e => setMf(p => ({...p, prot:e.target.value}))} />
                  <input style={ip} type="number" placeholder="Grassi g" value={mf.fat} onChange={e => setMf(p => ({...p, fat:e.target.value}))} />
                  <input style={ip} type="number" placeholder="Carbo g" value={mf.carbs} onChange={e => setMf(p => ({...p, carbs:e.target.value}))} />
                </div>
                <div style={{display:"flex", gap:6}}>
                  <button style={bg} onClick={addMeal}>Salva</button>
                  <button style={bo} onClick={() => setAdding(false)}>Annulla</button>
                </div>
              </div>
            )}

            {/* Photo results */}
            {photoOn && (
              <div style={{...bx, border:"1px solid rgba(96,165,250,0.2)"}}>
                <div style={lb}>📸 ETICHETTA / FOTO PIATTO</div>

                {/* File selected indicator */}
                {photoFile && !photoWait && !photoItems && (
                  <div>
                    <div style={{fontSize:12, color:K.g, marginBottom:8}}>Foto caricata: {photoFile.name.slice(0,25)}</div>
                    <div style={{fontSize:11, color:K.mut, marginBottom:6}}>Scrivi cosa e quanto hai mangiato:</div>
                    <input style={{...ip, marginBottom:8}} placeholder="es. 10 fette di pancarr&egrave;, 150g di tofu, 2 uova..."
                      value={photoQty} onChange={e => setPhotoQty(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && analyzePhoto()} />
                    <div style={{display:"flex", gap:6}}>
                      <button style={bg} onClick={analyzePhoto}>Analizza</button>
                      <button style={bo} onClick={() => {setPhotoOn(false); setPhotoFile(null); setPhotoQty("");}}>Annulla</button>
                    </div>
                  </div>
                )}

                {/* Loading */}
                {photoWait && <div style={{textAlign:"center", padding:16, color:K.mut, fontSize:13}}>Leggo etichetta e calcolo...</div>}

                {/* Results */}
                {!photoWait && photoItems !== null && (
                  photoItems.length > 0 ? (
                    <div>
                      <div style={{fontSize:11, color:K.mut, marginBottom:6}}>Calcolato per: <b style={{color:K.txt}}>{photoQty}</b></div>
                      {photoItems.map((it, i) => (
                        <div key={i} style={{display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid "+K.brd, fontSize:12}}>
                          <div>
                            <b>{it.name}</b> {it.grams}g
                            <div style={{color:K.mut}}>P{Math.round(it.protein)}g G{Math.round(it.fat||0)}g C{Math.round(it.carbs||0)}g</div>
                          </div>
                          <div style={{fontWeight:600}}>{Math.round(it.kcal)} kcal</div>
                        </div>
                      ))}
                      <div style={{display:"flex", gap:6, marginTop:10}}>
                        <button style={bg} onClick={confirmPhoto}>Conferma</button>
                        <button style={bo} onClick={() => {setPhotoOn(false); setPhotoItems(null); setPhotoFile(null); setPhotoQty("");}}>Annulla</button>
                      </div>
                    </div>
                  ) : <div style={{color:K.mut, fontSize:12, padding:10}}>Non sono riuscito a leggere i valori. Riprova con una foto piu nitida.</div>
                )}
              </div>
            )}

            {/* Search panel */}
            {searchOn && (
              <div style={{...bx, border:"1px solid rgba(245,158,11,0.2)"}}>
                <div style={lb}>🔍 CERCA PRODOTTO</div>

                {/* Search input - always visible when no results */}
                {!searchWait && (!searchItems || searchItems.length === 0) && (
                  <div>
                    <div style={{fontSize:11, color:K.mut, marginBottom:6}}>Nome del prodotto:</div>
                    <input style={{...ip, marginBottom:8}} placeholder="es. pancarr&#232;, tofu, lenticchie..."
                      value={searchQ} onChange={e => setSearchQ(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && doSearch()} />
                    <div style={{display:"flex", gap:6}}>
                      <button style={{...bg, background:K.a}} onClick={doSearch}>Cerca</button>
                      <button style={bo} onClick={() => setSearchOn(false)}>Annulla</button>
                    </div>
                    {searchItems !== null && searchItems.length === 0 && (
                      <div style={{color:K.mut, fontSize:12, marginTop:8}}>Nessun prodotto trovato. Prova un altro nome.</div>
                    )}
                  </div>
                )}

                {searchWait && <div style={{textAlign:"center", padding:16, color:K.mut, fontSize:13}}>Cerco su OpenFoodFacts...</div>}

                {/* Results */}
                {!searchWait && searchItems !== null && searchItems.length > 0 && (
                  <div>
                    <div style={{fontSize:11, color:K.mut, marginBottom:4}}>Risultati per: <b style={{color:K.txt}}>{searchQ}</b></div>
                    <div style={{fontSize:9, color:K.b, marginBottom:8}}>Fonte: OpenFoodFacts (database aperto)</div>

                    {searchItems.map((it, i) => (
                      <div key={i} style={{padding:"8px 0", borderBottom:"1px solid "+K.brd}}>

                        {!searchEdit ? (
                          <div>
                            <div style={{fontSize:13, fontWeight:600, marginBottom:4}}>{it.name}</div>
                            <div style={{fontSize:10, color:K.mut, marginBottom:4}}>
                              Per 100g: {it.per100.kcal} kcal | P{it.per100.protein}g | G{it.per100.fat}g | C{it.per100.carbs}g
                              {it.serving && <span> | Porzione: {it.serving}</span>}
                            </div>
                            <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:4}}>
                              <span style={{fontSize:11, color:K.mut}}>Quanto?</span>
                              <input style={{...ip, width:80, padding:"5px 8px", fontSize:13, textAlign:"center"}} type="number"
                                value={it.grams} onChange={e => updateSearchGrams(i, e.target.value)} />
                              <span style={{fontSize:11, color:K.mut}}>g</span>
                              <span style={{marginLeft:"auto", fontSize:14, fontWeight:700}}>{Math.round(it.kcal)} kcal</span>
                            </div>
                            <div style={{fontSize:11, color:K.txt}}>
                              P{Math.round(it.protein||0)}g | G{Math.round(it.fat||0)}g | C{Math.round(it.carbs||0)}g
                            </div>
                          </div>
                        ) : (
                          <div>
                            <input style={{...ip, marginBottom:4, fontWeight:700}} value={it.name}
                              onChange={e => { const c = [...searchItems]; c[i] = {...c[i], name:e.target.value}; setSearchItems(c); }} />
                            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:4, marginBottom:4}}>
                              <div><div style={{fontSize:9, color:K.mut}}>Grammi</div>
                                <input style={{...ip, padding:"6px 8px", fontSize:12}} type="number" value={it.grams || ""}
                                  onChange={e => updateSearchGrams(i, e.target.value)} /></div>
                              <div><div style={{fontSize:9, color:K.mut}}>Kcal</div>
                                <input style={{...ip, padding:"6px 8px", fontSize:12}} type="number" value={Math.round(it.kcal) || ""}
                                  onChange={e => { const c = [...searchItems]; c[i] = {...c[i], kcal:+e.target.value}; setSearchItems(c); }} /></div>
                              <div><div style={{fontSize:9, color:K.mut}}>Prot g</div>
                                <input style={{...ip, padding:"6px 8px", fontSize:12}} type="number" value={Math.round(it.protein||0) || ""}
                                  onChange={e => { const c = [...searchItems]; c[i] = {...c[i], protein:+e.target.value}; setSearchItems(c); }} /></div>
                            </div>
                            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:4}}>
                              <div><div style={{fontSize:9, color:K.mut}}>Grassi g</div>
                                <input style={{...ip, padding:"6px 8px", fontSize:12}} type="number" value={Math.round(it.fat||0) || ""}
                                  onChange={e => { const c = [...searchItems]; c[i] = {...c[i], fat:+e.target.value}; setSearchItems(c); }} /></div>
                              <div><div style={{fontSize:9, color:K.mut}}>Carbo g</div>
                                <input style={{...ip, padding:"6px 8px", fontSize:12}} type="number" value={Math.round(it.carbs||0) || ""}
                                  onChange={e => { const c = [...searchItems]; c[i] = {...c[i], carbs:+e.target.value}; setSearchItems(c); }} /></div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    <div style={{display:"flex", gap:6, marginTop:10}}>
                      <button style={bg} onClick={() => { setSearchEdit(false); confirmSearch(); }}>Conferma</button>
                      <button style={{...bo, color:K.a, borderColor:"rgba(245,158,11,0.3)"}} onClick={() => setSearchEdit(!searchEdit)}>{searchEdit ? "Fine" : "Modifica"}</button>
                      <button style={bo} onClick={() => {setSearchOn(false); setSearchItems(null); setSearchQ(""); setSearchEdit(false);}}>Annulla</button>
                    </div>
                  </div>
                )}
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══════ PESO ═══════ */}
        {tab === "peso" && (
          <div>
            <div style={{...bx, textAlign:"center", padding:20}}>
              <div style={lb}>PESO ATTUALE</div>
              <div style={{fontSize:42, fontWeight:800, color:"#fff"}}>{cw.toFixed(1)} <span style={{fontSize:16, color:K.mut}}>kg</span></div>
              {prof && (() => {
                const delta = cw - (prof.sw || prof.startWeight || 87.4);
                return <div style={{marginTop:6, fontSize:13, color:delta < 0 ? K.g : delta > 0 ? K.a : K.mut}}>{delta > 0 ? "+":""}{delta.toFixed(1)} kg dal {fmt(prof.startDate || td())}</div>;
              })()}
            </div>

            {!data.weights?.[td()] && (
              <div style={bx}>
                <div style={lb}>REGISTRA OGGI</div>
                <div style={{display:"flex", gap:6}}>
                  <input style={ip} type="number" step="0.1" placeholder="es. 87.0" value={wIn} onChange={e => setWIn(e.target.value)} onKeyDown={e => e.key === "Enter" && addW()} />
                  <button style={{...bg, width:"auto", padding:"0 20px"}} onClick={addW}>Salva</button>
                </div>
              </div>
            )}

            {wChart.length > 1 && (
              <div style={bx}>
                <div style={lb}>ANDAMENTO</div>
                <div style={{height:180}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={wChart.slice(-16)}>
                      <defs>
                        <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={K.g} stopOpacity={0.2}/>
                          <stop offset="95%" stopColor={K.g} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{fill:K.mut, fontSize:9}} axisLine={false} tickLine={false} />
                      <YAxis domain={["dataMin-0.5","dataMax+0.5"]} tick={{fill:K.mut, fontSize:9}} axisLine={false} tickLine={false} width={32} />
                      <Tooltip contentStyle={{background:K.card, border:"1px solid "+K.brd, borderRadius:8, fontSize:11, color:"#fff"}} formatter={v => [v+" kg","Peso"]} />
                      <Area type="monotone" dataKey="kg" stroke={K.g} strokeWidth={2} fill="url(#wg)" dot={{r:3, fill:K.g}} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div style={bx}>
              <div style={lb}>STORICO PESATE</div>
              {wChart.length === 0 && <div style={{color:K.dim, fontSize:12}}>Nessuna pesata</div>}
              {wChart.slice().reverse().slice(0,10).map(w => (
                <div key={w.date} style={{display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid "+K.brd, fontSize:13}}>
                  <span style={{color:K.mut}}>{w.date}</span>
                  <span style={{fontWeight:600}}>{w.kg} kg</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════ STORICO ═══════ */}
        {tab === "storico" && (
          <div>
            <div style={{display:"flex", gap:6, marginBottom:10}}>
              <button style={{...bg, flex:1}} onClick={() => {
                const d = new Date(td()+"T12:00:00");
                const dw = d.getDay();
                d.setDate(d.getDate() - (dw === 0 ? 6 : dw - 1));
                let lines = ["SEITAN SENSEI - Settimana\n"];
                let tk = 0, tp = 0, n = 0;
                for (let i = 0; i < 7; i++) {
                  const ds = d.toISOString().split("T")[0];
                  const meals = data.meals?.[ds] || [];
                  const s = msum(meals);
                  const wt = data.weights?.[ds];
                  if (meals.length > 0 || wt) {
                    lines.push(fmt(ds)+": "+s.kcal+" kcal, "+s.prot+"g P"+(wt ? " | "+wt+"kg" : ""));
                    tk += s.kcal; tp += s.prot; n++;
                  }
                  d.setDate(d.getDate() + 1);
                }
                if (n > 0) lines.push("\nMedia: "+Math.round(tk/n)+" kcal, "+Math.round(tp/n)+"g P");
                alert(lines.join("\n"));
              }}>Settimana</button>
              <button style={{...bo, flex:1}} onClick={doExport}>Backup</button>
            </div>

            <div style={bx}>
              <div style={lb}>GIORNI</div>
              <div style={{display:"flex", flexWrap:"wrap", gap:4, maxHeight:140, overflow:"auto"}}>
                {allDays.slice(0,30).map(d => (
                  <button key={d} onClick={() => setSelDay(d)} style={{
                    padding:"5px 8px", borderRadius:6, fontSize:10, fontWeight:600, cursor:"pointer", border:"none",
                    background: d === selDay ? K.g : "rgba(255,255,255,0.05)", color: d === selDay ? "#000" : K.mut
                  }}>{fmt(d)}</button>
                ))}
                {allDays.length === 0 && <div style={{color:K.dim, fontSize:12}}>Nessun dato</div>}
              </div>
            </div>

            {selDay && (data.meals?.[selDay]?.length > 0 || data.weights?.[selDay]) && (
              <div style={bx}>
                <div style={lb}>{fmt(selDay)}</div>
                {data.weights?.[selDay] && <div style={{fontSize:14, marginBottom:8}}>Peso: <b>{data.weights[selDay]} kg</b></div>}
                {(() => {
                  const meals = data.meals?.[selDay] || [];
                  const s = msum(meals);
                  if (meals.length === 0) return null;
                  return (
                    <div>
                      <div style={{fontSize:12, color:K.mut, marginBottom:6}}>{s.kcal} kcal | {s.prot}g P | {s.fat}g G | {s.carbs}g C</div>
                      {meals.map(m => (
                        <div key={m.id} style={{display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid "+K.brd, fontSize:12}}>
                          <span>{m.ph ? "📸 " : m.src === "search" ? "🔍 " : ""}{m.name} <span style={{color:K.mut}}>{m.time}</span></span>
                          <span style={{fontWeight:600}}>{m.kcal} kcal</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ═══════ PROFILO ═══════ */}
        {tab === "profilo" && (
          <div>
            <div style={{...bx, textAlign:"center", padding:20}}>
              <div style={{fontSize:36, marginBottom:6}}>🥋</div>
              <div style={{fontSize:18, fontWeight:700}}>{prof.name}</div>
              <div style={{color:K.mut, fontSize:12}}>{prof.h || prof.height || 193}cm | {cw.toFixed(1)}kg | {prof.age || 33}a</div>
            </div>

            {tgt && (
              <div style={bx}>
                <div style={lb}>TARGET</div>
                <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:4, fontSize:12}}>
                  <div>BMR: <b>{tgt.bmr}</b></div>
                  <div>TDEE: <b>{tgt.tdee}</b></div>
                  <div>Training: <b>{tgt.tdee + 200}</b></div>
                  <div>Riposo: <b>{tgt.tdee - 100}</b></div>
                  <div>Proteine: <b>{tgt.prot}g</b></div>
                  <div>Grassi: <b>{tgt.fat}g</b></div>
                  <div>Carbo: <b>{tgt.carbs}g</b></div>
                  <div>P/kg: <b>{prof.protKg || 1.8}g</b></div>
                </div>
              </div>
            )}

            <div style={bx}>
              <div style={lb}>SALUTE</div>
              <div style={{fontSize:12, lineHeight:2}}>
                IBS - pasti regolari<br/>
                Esofagite Eosinofila - cena 2h prima di dormire<br/>
                Blocco AV tipo 1<br/>
                Latticini ridotti | Tuorli limitati
              </div>
            </div>

            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:10}}>
              <div style={{...bx, textAlign:"center", marginBottom:0}}>
                <div style={{fontSize:18, fontWeight:700, color:K.g}}>{Object.values(data.meals||{}).reduce((a,d) => a+d.length, 0)}</div>
                <div style={{fontSize:10, color:K.mut}}>Pasti</div>
              </div>
              <div style={{...bx, textAlign:"center", marginBottom:0}}>
                <div style={{fontSize:18, fontWeight:700, color:K.b}}>{Object.keys(data.weights||{}).length}</div>
                <div style={{fontSize:10, color:K.mut}}>Pesate</div>
              </div>
            </div>

            <button style={{...bg, marginBottom:6}} onClick={doExport}>Scarica Backup</button>

            <button style={{...bo, width:"100%", color:K.r, borderColor:"rgba(239,68,68,0.2)"}} onClick={async () => {
              if (!confirm("Cancellare tutto?")) return;
              try { await window.storage.delete(PK); await window.storage.delete(DK); } catch(e) {}
              setProf(null);
              setData({weights:{}, meals:{}});
            }}>Reset Dati</button>
          </div>
        )}

      </div>

      {/* Tab bar */}
      <div style={{position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:440, display:"flex", justifyContent:"space-around", background:"#111820", borderTop:"1px solid "+K.brd, padding:"6px 0 10px", zIndex:50}}>
        {[
          {id:"oggi", ic:"🍽", l:"OGGI"},
          {id:"peso", ic:"⚖️", l:"PESO"},
          {id:"storico", ic:"📋", l:"STORICO"},
          {id:"profilo", ic:"👤", l:"PROFILO"}
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background:"none", border:"none", cursor:"pointer", padding:"4px 14px",
            display:"flex", flexDirection:"column", alignItems:"center", gap:2,
            color: tab === t.id ? K.g : K.mut,
            fontWeight: tab === t.id ? 700 : 400,
            fontSize:9, letterSpacing:"0.05em"
          }}>
            <span style={{fontSize:16}}>{t.ic}</span>
            <span>{t.l}</span>
          </button>
        ))}
      </div>

      <style>{`input::placeholder{color:#4b5563} input:focus{border-color:rgba(34,197,94,0.3)!important} *{box-sizing:border-box}`}</style>
    </div>
  );
}
