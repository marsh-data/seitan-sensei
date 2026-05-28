# 🥋 SEITAN SENSEI

App di tracking nutrizionale per ricomposizione corporea vegetariana.

## Deploy su Vercel (5 minuti)

### 1. Crea un repo GitHub
- Vai su github.com → New Repository → nome: `seitan-sensei`
- Carica tutti questi file nel repo

### 2. Collega a Vercel
- Vai su vercel.com → Sign up con GitHub
- Clicca "Add New Project" → importa il repo `seitan-sensei`
- Framework: Vite
- Clicca "Deploy"

### 3. Aggiungi la API key
- Nel progetto Vercel → Settings → Environment Variables
- Aggiungi: `ANTHROPIC_API_KEY` = la tua chiave API Anthropic
- Rideploya il progetto (Deployments → Redeploy)

### 4. Condividi
- Il link sara tipo: `seitan-sensei.vercel.app`
- Mandalo ai tuoi amici
- Ogni persona ha i suoi dati salvati nel proprio telefono (localStorage)

## Funzionalita
- Tracking pasti manuale
- Foto etichetta + quantita → calcolo automatico AI
- Ricerca valori nutrizionali online → con fonte e calcolo
- Tracking peso con grafico
- Backup JSON scaricabile
- Target personalizzati (BMR/TDEE/macro)

## Costi
- Vercel: gratis (hobby plan)
- Anthropic API: ~0.01-0.03€ per ogni ricerca/foto analizzata
- Per 3 persone con uso normale: pochi euro al mese
