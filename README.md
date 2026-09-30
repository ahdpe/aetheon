# 🌊 AETHEON: The Autocatalytic Ocean
### A 24/7 Autonomous Deep-Time Morphogenetic Biome for VPS Deployment

> *Order emerges only in open systems driven far from equilibrium.*  
> — Ilya Prigogine

AETHEON is an autonomous, persistent living digital world designed to run continuously 24/7 on a minimal budget VPS (1 vCPU / 1 GB RAM). Visitors connect to the **same canonical, ongoing evolutionary experiment**, sharing the oceanic space in real time.

---

## 🔬 Core Concepts & Emergent Mechanics

1. **Open-System Dissipative Thermodynamics**:
   Energy continuously enters the system through geothermal mineral vents and surface radiance. Organisms burn energy ($\gamma E$) to maintain their structural membrane and power propulsion. If an organism runs out of energy, its membrane ruptures and its mass dissolves back into the ambient nutrient soup.

2. **Phase-Locked Kuramoto Resonances (Emergent Locomotion)**:
   Locomotion is not pre-animated. Each creature's body is governed by coupled Kuramoto phase oscillators. When phase difference $\Delta\theta \approx 0$, cohesive bonds form resilient membranes; when $\Delta\theta \approx \pi/2$ or $\pi$, cyclical shearing forces whip peripheral cilia, producing propulsion, steering, and amoeboid crawling.

3. **Active Hydrodynamics & Chemical Manifold**:
   The fluid carries dynamic fields of dissolved Nutrients ($N$), Waste ($W$), and Bioluminescent Signaling Pheromones ($S$) on a 2D toroidal manifold. Organisms leave physical wakes and chemical trails that other creatures can ride, avoid, or follow.

4. **Continuous Genotype-to-Phenotype Evolution & Speciation**:
   Organisms reproduce via mitosis with Cauchy-distributed genomic drift. As lineages diverge past a Euclidean genetic distance threshold, they trigger automated speciation, populating the permanent phylogenetic tree and the **Species Codex**.

5. **Chronos-Physis Decoupling (The Tiny VPS Secret)**:
   - **Server (Headless, 10 Hz)**: Computes pure spatial-hashed biology and chemistry in `< 2% of 1 vCPU` and `< 60 MB RAM`.
   - **Client Browser (60–120 FPS)**: The visitor's GPU performs bicubic fluid interpolation, soft-body ciliary deformation, optical microscope darkfield effects, and 1,000+ luminous micro-plankton tracers.

6. **The AI Xenobiologist (Venice AI / Jev Integration, < $0.10/day)**:
   An autonomous outside intelligence periodically monitors the ocean, catalogs newly stabilized species with binomial Latin names, and writes poetic yet scientifically rigorous field notes in both English and Russian. Works out of the box with the built-in procedural engine, and seamlessly connects to Venice AI when `VENICE_API_KEY` is provided.

---

## 🎮 Visitor Experience (Two Layers)

- **Immediate Layer (The Living Aquarium / Zen Mode)**:
  - Deep darkfield optical microscopy aesthetics (`#030712`, glowing cyan, emerald, amber, and violet bioluminescence).
  - Procedural Web Audio API soundscapes (abyssal subharmonic drone, mitosis glass pings, predation strikes, and water droplet chimes).
  - **Pipette Gesture**: Tap or click anywhere in the water to drop nutrient droplets and watch nearby organisms swim over to feed!
  - **Shared Co-Presence**: See other connected visitors' touch ripples in real time.

- **Deep Layer (The Research Lab)**:
  - **Organism Scanner / Bio-Card**: Click any creature to inspect its species, generation, age, diet, energy reserves, and living offspring count.
  - **Camera Tracking**: Lock the camera to follow a specific creature as it hunts, grazes, or undergoes mitosis.
  - **Field Codex Modal**: Explore the historical encyclopedia of all living and extinct species and read the AI naturalist's field timeline.
  - **Lab Mode Toggle**: Inspect velocity vectors, world boundaries, and fluid flow lines.
  - **Bilingual (EN / RU)**: Instant toggle between English and Russian with zero page reload.

---

## 🚀 Quick Start (Local Run)

```bash
# Clone and install dependencies (only ws and dotenv)
npm install

# Start the simulation server
npm start

# Open your browser
http://localhost:3000
```

---

## 🌐 24/7 VPS Deployment (1 vCPU / 1 GB RAM)

### 1. Requirements
- Node.js >= 18
- Any Linux VPS (Ubuntu, Debian, Alpine, CentOS) with 1 vCPU and 1 GB RAM.

### 2. Environment Setup
Copy the template configuration:
```bash
cp .env.example .env
```

Edit `.env` to suit your preferences:
```env
PORT=3000
HOST=0.0.0.0

# Optional: Venice AI API key for the live autonomous chronicler (< $0.10/day)
# If left empty, AETHEON automatically uses its built-in procedural xenobiologist engine!
VENICE_API_KEY=your_venice_api_key_here
VENICE_MODEL=llama-3.3-70b
AI_OBSERVER_INTERVAL_MIN=25
```

### 3. Running with PM2 (Recommended for 24/7 Uptime)
```bash
# Install PM2 globally
npm install -g pm2

# Start AETHEON with auto-restart
pm2 start server/server.js --name "aetheon"

# Enable start on boot
pm2 startup
pm2 save
```

### 4. Running as a systemd Service (Alternative)
Create `/etc/systemd/system/aetheon.service`:
```ini
[Unit]
Description=AETHEON Autonomous Living Ocean
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/aetheon
ExecStart=/usr/bin/node server/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable aetheon
sudo systemctl start aetheon
```

### 5. Nginx Reverse Proxy (with WebSockets)
```nginx
server {
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
```

---

## ⌨️ Controls & Shortcuts

| Action | Control |
| :--- | :--- |
| **Drop Nutrients (Feed)** | Tap or Click empty water |
| **Inspect Organism** | Click / Tap on any creature |
| **Stir / Pan Camera** | Click & Drag / Touch & Drag |
| **Zoom In / Out** | Mouse Wheel / Pinch gesture |
| **Toggle Lab / Zen Mode** | `R` key or Header button |
| **Open Field Codex** | `C` key or Header button |
| **Toggle Sound** | `M` key or Header button |
| **Switch Language (EN/RU)** | `L` key or Header button |
| **Close Scanner / Dialog** | `Escape` key |

---

## 📁 Project Architecture

```
aetheon/
├── server/
│   ├── server.js              # Lightweight HTTP & WebSocket server
│   ├── config.js              # Environment settings & physical constants
│   ├── core/
│   │   ├── engine.js          # Master 10 Hz simulation loop
│   │   ├── chemicalGrid.js    # 128x128 2D nutrient & waste diffusion manifold
│   │   ├── organism.js        # Aetheobiont entity (Kuramoto phase, metabolism, mitosis)
│   │   ├── spatialHash.js     # O(1) continuous spatial neighborhood grid
│   │   ├── lineage.js         # Evolutionary tree & speciation detector
│   │   └── persistence.js     # Snapshot autosave & crash recovery
│   └── ai/
│       └── naturalist.js      # Xenobiologist AI observer (Venice AI + fallback)
├── public/
│   ├── index.html             # High-DPI canvas & glassmorphic HUD
│   ├── css/
│   │   └── style.css          # Optical darkfield styling, responsive layouts
│   └── js/
│       ├── app.js             # Client coordinator & WebSocket pipeline
│       ├── i18n.js            # Bilingual localization dictionary (EN/RU)
│       ├── gl/
│       │   ├── renderer.js    # 60–120 FPS canvas renderer & Hermite interpolator
│       │   └── particles.js   # Micro-plankton fluid tracers
│       ├── audio/
│       │   └── sound.js       # 100% procedural Web Audio API synthesizer
│       └── ui/
│           ├── inspector.js   # Organism Scanner (Bio-Card)
│           ├── codexModal.js  # Species encyclopedia & journal dialog
│           └── controls.js    # Touch, mouse & keyboard controller
└── package.json
```

---

## 📄 License
MIT License. Created for autonomous deep-time emergence.
