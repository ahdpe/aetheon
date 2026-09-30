import { i18n } from '../i18n.js';

export class AboutModal {
  constructor() {
    this.dialog = document.getElementById('about-dialog');
    this.openBtn = document.getElementById('btn-about');
    this.closeBtn = document.getElementById('about-close-btn');

    this.tabOverviewBtn = document.getElementById('tab-about-overview-btn');
    this.tabMathBtn = document.getElementById('tab-about-math-btn');
    this.tabOverviewContent = document.getElementById('tab-about-overview-content');
    this.tabMathContent = document.getElementById('tab-about-math-content');

    this.setupListeners();
    this.renderContent();
  }

  setupListeners() {
    this.openBtn?.addEventListener('click', () => this.open());
    this.closeBtn?.addEventListener('click', () => this.close());

    this.dialog?.addEventListener('click', (e) => {
      const rect = this.dialog.getBoundingClientRect();
      const isInDialog = (
        rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX && e.clientX <= rect.left + rect.width
      );
      if (!isInDialog) {
        this.close();
      }
    });

    this.tabOverviewBtn?.addEventListener('click', () => this.switchTab('overview'));
    this.tabMathBtn?.addEventListener('click', () => this.switchTab('math'));

    // Re-render text on language change
    window.addEventListener('aetheon-lang-changed', () => {
      this.renderContent();
    });
  }

  open() {
    this.renderContent();
    this.dialog?.showModal();
  }

  close() {
    this.dialog?.close();
  }

  switchTab(tab) {
    if (tab === 'overview') {
      this.tabOverviewBtn?.classList.add('active');
      this.tabMathBtn?.classList.remove('active');
      this.tabOverviewContent?.classList.add('active');
      this.tabMathContent?.classList.remove('active');
    } else {
      this.tabMathBtn?.classList.add('active');
      this.tabOverviewBtn?.classList.remove('active');
      this.tabMathContent?.classList.add('active');
      this.tabOverviewContent?.classList.remove('active');
      if (this.tabMathContent) this.tabMathContent.scrollTop = 0;
    }
  }

  renderContent() {
    const isRu = i18n.getLang() === 'ru';
    
    // Overview HTML
    if (this.tabOverviewContent) {
      this.tabOverviewContent.innerHTML = isRu ? this.getOverviewHtmlRu() : this.getOverviewHtmlEn();
      const expBtn = this.tabOverviewContent.querySelector('#btn-expand-math');
      expBtn?.addEventListener('click', () => this.switchTab('math'));
    }

    // Detailed Math HTML
    if (this.tabMathContent) {
      this.tabMathContent.innerHTML = isRu ? this.getMathHtmlRu() : this.getMathHtmlEn();
    }
  }

  getOverviewHtmlRu() {
    return `
      <div class="about-overview-wrap">
        <div class="about-hero-card">
          <div class="hero-badge">СИНТЕЗ БИОФИЗИКИ И ВЫЧИСЛИТЕЛЬНОЙ ЭВОЛЮЦИИ</div>
          <h2 class="hero-title">Что такое Aetheon?</h2>
          <p class="hero-lead">
            <strong>Aetheon</strong> — это автономная живая экосистема микроорганизмов, непрерывно моделируемая на сервере в режиме реального времени (24/7). 
            В микрокапле виртуальной морской воды диаметром <strong>1240 мкм</strong> сотни искусственных существ (<em>Aetheobionts</em>) борются за выживание, 
            эволюционируют, координируют движение ресничек и передают свои мутирующие геномы сквозь поколения.
          </p>
        </div>

        <div class="about-grid-3">
          <div class="feature-card">
            <div class="feature-icon">🌋</div>
            <div class="feature-title">5 Геотермальных Жерл</div>
            <p class="feature-desc">
              Минеральные источники непрерывно насыщают воду питательными солями. Они служат биологическими оазисами, вокруг которых формируются колонии автотрофов.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">🧬</div>
            <div class="feature-title">12-мерная Генетика</div>
            <p class="feature-desc">
              Каждое существо уникально: размер, скорость, угол зрения, плотоядность, частота ресничек и порог деления закодированы в ДНК и подвержены мутациям Коши.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">⚖️</div>
            <div class="feature-title">Трофическая Пирамида</div>
            <p class="feature-desc">
              Мирные травоядные пасутся на химическом градиенте, а быстрые хищники выслеживают жертв. Приток энергии и метаболические потери регулируют популяцию без вмешательства извне.
            </p>
          </div>
        </div>

        <div class="ai-architecture-card">
          <div class="ai-card-badge">ДВУХУРОВНЕВЫЙ ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ</div>
          <h3 class="ai-card-title">Как взаимодействуют два уровня интеллекта в Aetheon</h3>
          <div class="ai-layers-container">
            <div class="ai-layer-box swarm">
              <span class="ai-layer-tag">Уровень 1 • Микромир</span>
              <div class="ai-layer-name">Роевой ИИ и Эволюционная био-кибернетика (ALife)</div>
              <p class="ai-layer-desc">
                Сотни существ живут в реальном физическом времени на сервере. Каждый организм обладает <strong>12-мерным геномом</strong> и автономно принимает решения: 
                рассчитывает градиенты диффузии (хемотаксис Келлера-Сегеля), избегает токсичных зон, синхронизирует реснички в стаях (модель Курамото) и охотится. 
                Здесь нет единого кукловода — сложное коллективное поведение рождается спонтанно из локальных законов физики и мутаций Коши.
              </p>
            </div>
            <div class="ai-layer-box cognitive">
              <span class="ai-layer-tag">Уровень 2 • Макромир</span>
              <div class="ai-layer-name">Когнитивный Мета-Наблюдатель (LLM Xenobiologist via Venice AI)</div>
              <p class="ai-layer-desc">
                Большая нейросетевая языковая модель (LLM) выступает в роли внешнего ученого-естествоиспытателя. Она считывает телеметрию биосферы 
                первого уровня (рождаемость, генетическую кластеризацию, фазы вымирания и видообразования). ИИ классифицирует новые виды, дает им латинские 
                биноминальные имена (например, <em>Vibrionox velox</em>) и пишет захватывающие научно-популярные очерки для журнала наблюдений.
              </p>
            </div>
          </div>
          <div class="ai-bridge-box">
            <strong>🔗 Био-кибернетический мост:</strong> Уровень 1 непрерывно создает физическую реальность капли, а Уровень 2 сжимает потоки 
            числовых матриц в осмысленные концепции, таксономическое древо и понятные человеку истории. Вмешательство зрителя (сброс спор фитоманны или возмущение течений) 
            изменяет баланс на Уровне 1, что немедленно осмысливается и протоколируется Уровнем 2.
          </div>
        </div>

        <div class="how-it-works-box">
          <h3 class="section-title">Как взаимодействовать с миром:</h3>
          <div class="controls-list">
            <div class="ctrl-item">
              <span class="ctrl-key">Клик / Касание</span>
              <span class="ctrl-text">Сбросить в воду споры фитоманны (еду). Травоядные в радиусе 480 мкм почуют запах и устремятся к кормушке.</span>
            </div>
            <div class="ctrl-item">
              <span class="ctrl-key">Зажать и тянуть</span>
              <span class="ctrl-text">Перемещение взгляда по микромиру или возмущение течения при быстром движении.</span>
            </div>
            <div class="ctrl-item">
              <span class="ctrl-key">Клик по организму</span>
              <span class="ctrl-text">Открыть <strong>Биосканер</strong>: телеметрия в реальном времени, скорость, возраст, уровень энергии и режим слежения камеры.</span>
            </div>
            <div class="ctrl-item">
              <span class="ctrl-key">Клавиша R (или Lab)</span>
              <span class="ctrl-text">Переключить в <strong>Научный режим</strong>: измерительная сетка, полярные координаты, векторы тяги и границы привлечения.</span>
            </div>
          </div>
        </div>

        <div class="math-cta-card">
          <div class="cta-left">
            <div class="cta-tag">ДЛЯ ИНЖЕНЕРОВ И ИССЛЕДОВАТЕЛЕЙ</div>
            <div class="cta-title">Хотите изучить все математические уравнения и законы физики?</div>
            <div class="cta-desc">Дифференциальные уравнения диффузии, модель Курамото, закон Клейбера, хемотаксис Келлера-Сегеля и тензоры поворота.</div>
          </div>
          <button class="btn-expand-math" id="btn-expand-math">
            <span>🔬 Развернуть полную математическую модель →</span>
          </button>
        </div>
      </div>
    `;
  }

  getOverviewHtmlEn() {
    return `
      <div class="about-overview-wrap">
        <div class="about-hero-card">
          <div class="hero-badge">SYNTHESIS OF BIOPHYSICS & COMPUTATIONAL EVOLUTION</div>
          <h2 class="hero-title">What is Aetheon?</h2>
          <p class="hero-lead">
            <strong>Aetheon</strong> is an autonomous, persistent living microbial ecosystem simulated on the server in real-time (24/7). 
            Inside an isolated water micro-droplet measuring <strong>1240 μm</strong> across, hundreds of synthetic organisms (<em>Aetheobionts</em>) 
            graze, hunt, synchronize cilia, and pass mutated genomes across generations.
          </p>
        </div>

        <div class="about-grid-3">
          <div class="feature-card">
            <div class="feature-icon">🌋</div>
            <div class="feature-title">5 Hydrothermal Vents</div>
            <p class="feature-desc">
              Continuous thermal plumes inject dissolved minerals into the fluid. They act as biological epicenters for autotrophic colonies.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">🧬</div>
            <div class="feature-title">12D Continuous Genome</div>
            <p class="feature-desc">
              Every specimen is genetically unique: body size, cilia stroke frequency, carnivory, chemotactic bias, and split threshold mutate across generations.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">⚖️</div>
            <div class="feature-title">Trophic Equilibrium</div>
            <p class="feature-desc">
              Peaceful grazers absorb ambient nutrients, while apex hunters stalk prey. Kleiber scaling and metabolic dissipation prevent runaway overpopulation.
            </p>
          </div>
        </div>

        <div class="ai-architecture-card">
          <div class="ai-card-badge">DUAL-LAYER ARTIFICIAL INTELLIGENCE</div>
          <h3 class="ai-card-title">How Two Interconnected AI Layers Operate in Aetheon</h3>
          <div class="ai-layers-container">
            <div class="ai-layer-box swarm">
              <span class="ai-layer-tag">Layer 1 • Micro-Scale</span>
              <div class="ai-layer-name">Swarm Intelligence & ALife Evolutionary Dynamics</div>
              <p class="ai-layer-desc">
                Hundreds of entities simulated in real-time server physics. Each individual carries a <strong>12D continuous genome</strong> and acts autonomously: 
                sampling substrate gradients (Keller-Segel chemotaxis), evading toxic wastes, synchronizing cilia through hydrodynamic phase coupling (Kuramoto model), 
                and hunting prey. There is no central controller — intelligent swarm behaviors emerge organically from local rules and Cauchy mutations.
              </p>
            </div>
            <div class="ai-layer-box cognitive">
              <span class="ai-layer-tag">Layer 2 • Macro-Scale</span>
              <div class="ai-layer-name">Cognitive LLM Xenobiologist Observer (via Venice AI)</div>
              <p class="ai-layer-desc">
                A high-order neuro-symbolic Large Language Model acts as an external naturalist. It continuously inspects macro-telemetry from Layer 1 
                (speciation clades, trophic shifts, extinction bottlenecks). The LLM performs taxonomy, assigns formal Latin binomials 
                (e.g., <em>Vibrionox velox</em>), Russian & English common names, and crafts engaging documentary chronicles with explanatory insights.
              </p>
            </div>
          </div>
          <div class="ai-bridge-box">
            <strong>🔗 The Bio-Cybernetic Bridge:</strong> Layer 1 continuously manifests the ground-truth physical reality, while Layer 2 compresses high-dimensional 
            numeric phase spaces into semantic concepts, taxonomy, and human-readable chronicles. User interaction (dropping phytomanna spores) 
            disrupts Layer 1, provoking evolutionary adaptations that are synthesized and chronicled by Layer 2.
          </div>
        </div>

        <div class="how-it-works-box">
          <h3 class="section-title">How to Interact with the Biosphere:</h3>
          <div class="controls-list">
            <div class="ctrl-item">
              <span class="ctrl-key">Click / Tap</span>
              <span class="ctrl-text">Drop glowing phytomanna spores. Grazers within a 480 μm sensory radius will smell the scent and swim over to feed.</span>
            </div>
            <div class="ctrl-item">
              <span class="ctrl-key">Click & Drag</span>
              <span class="ctrl-text">Pan the viewport across the chamber or stir hydrodynamic micro-currents.</span>
            </div>
            <div class="ctrl-item">
              <span class="ctrl-key">Click on Organism</span>
              <span class="ctrl-text">Open the <strong>Bio-Inspector</strong>: real-time telemetry, velocity, generation, lineage name, and follow camera.</span>
            </div>
            <div class="ctrl-item">
              <span class="ctrl-key">Key 'R' (or Lab button)</span>
              <span class="ctrl-text">Toggle <strong>Research Instrument Mode</strong>: velocity vector fields, sensory horizons, range calipers, and polar coordinates.</span>
            </div>
          </div>
        </div>

        <div class="math-cta-card">
          <div class="cta-left">
            <div class="cta-tag">FOR RESEARCHERS & ENGINEERS</div>
            <div class="cta-title">Want to inspect every underlying mathematical equation?</div>
            <div class="cta-desc">Reaction-diffusion PDEs, Kuramoto synchronization, Kleiber scaling, Keller-Segel chemotaxis, and Cauchy mutation tensors.</div>
          </div>
          <button class="btn-expand-math" id="btn-expand-math">
            <span>🔬 Open Full Mathematical Model →</span>
          </button>
        </div>
      </div>
    `;
  }

  getMathHtmlRu() {
    return `
      <div class="about-math-wrap">
        <div class="math-intro-banner">
          <div class="math-badge">ТЕХНИЧЕСКИЙ ДОКУМЕНТ • ВЕРСИЯ 2.4</div>
          <h2 class="math-main-title">Математическая и алгоритмическая модель AETHEON</h2>
          <p class="math-lead-desc">
            Ниже приведены фундаментальные дифференциальные уравнения, физические потенциалы, 
            аллометрические зависимости и алгоритмы оптимизации, на которых построена симуляция.
          </p>
        </div>

        <!-- 01. Хемодинамика и диффузия -->
        <article class="math-section">
          <div class="section-header">
            <span class="sec-num">01</span>
            <h3 class="sec-title">Хемодинамика и диффузия субстрата (Reaction-Diffusion PDE)</h3>
          </div>
          <p>
            Пространство среды непрерывно (<strong>x</strong> ∈ [0, 1400 мкм]²), а химические концентрации рассчитываются 
            на регулярной матрице 128 × 128 узлов. В растворе эволюционируют три взаимосвязанных скалярных поля: 
            питательные вещества <em>N(x, y, t)</em>, продукты жизнедеятельности <em>W(x, y, t)</em> и сигнальные феромоны <em>S(x, y, t)</em>.
          </p>
          <div class="formula-box">
            <div class="formula-label">УРАВНЕНИЕ ДИФФУЗИИ С ИСТОЧНИКАМИ И СТОКАМИ (РЕАКЦИЯ-ДИФФУЗИЯ):</div>
            <div class="math-eq">
              <span class="m-frac"><span class="m-top">∂N</span><span class="m-bot">∂t</span></span>
              <span class="m-op">=</span> <span class="m-const">D<sub>N</sub></span> ∇²N 
              <span class="m-op">−</span> <span class="m-const">γ<sub>N</sub></span> N 
              <span class="m-op">+</span> ∑ S<sub>vent, v</sub>(<strong>x</strong>) 
              <span class="m-op">+</span> S<sub>bloom</sub>(<strong>x</strong>, t) 
              <span class="m-op">−</span> ∑ C<sub>org, k</sub>(<strong>x</strong>, t)
            </div>
            <div class="formula-vars">
              <div><strong>D<sub>N</sub> = 0.08:</strong> Коэффициент молекулярной диффузии питательных солей.</div>
              <div><strong>γ<sub>N</sub> = 0.0005:</strong> Скорость фонового распада (гидролиза) питательных веществ.</div>
              <div><strong>S<sub>vent, v</sub>(x):</strong> Непрерывный приток от 5 гидротермальных жерл с радиальным профилем Гаусса:
                <div class="sub-formula">
                  S<sub>v</sub>(<strong>x</strong>) = P<sub>v</sub> · exp(− ||<strong>x</strong> − <strong>x</strong><sub>v</sub>||² / (1.5 · r<sub>v</sub>²)), 
                  где P<sub>v</sub> = 0.14, r<sub>v</sub> = 7 ячеек
                </div>
              </div>
            </div>
          </div>
          <p>
            Дифференциальный оператор Лапласа ∇² аппроксимируется пятиточечным разностным шаблоном с 
            <strong>отражающими краевыми условиями Неймана (Zero-Flux Neumann)</strong>:
          </p>
          <div class="formula-box">
            <div class="math-eq">
              ∇²N<sub>i,j</sub> ≈ (N<sub>i+1,j</sub> + N<sub>i−1,j</sub> + N<sub>i,j+1</sub> + N<sub>i,j−1</sub> − 4 N<sub>i,j</sub>) / Δx²
            </div>
            <div class="formula-notes">
              На границе сетки нормальная производная ∂N/∂<strong>n</strong> = 0, что гарантирует сохранение минеральной массы в замкнутой капле.
            </div>
          </div>
          <p>
            Потребление пищи и выделение отходов осуществляются через <strong>билинейный сплэттинг (Bilinear Mass Splatting)</strong> 
            по 4 соседним узлам пропорционально весам (1−f<sub>x</sub>)(1−f<sub>y</sub>), f<sub>x</sub>(1−f<sub>y</sub>), (1−f<sub>x</sub>)f<sub>y</sub>, f<sub>x</sub>f<sub>y</sub>, 
            что исключает анизотропные скачки и ступеньки сетки.
          </p>
        </article>

        <!-- 02. Хемотаксис и изотропное руление -->
        <article class="math-section">
          <div class="section-header">
            <span class="sec-num">02</span>
            <h3 class="sec-title">Изотропный хемотаксис и гидродинамика движения (Keller-Segel Steering)</h3>
          </div>
          <p>
            Движение микроорганизмов происходит при малых числах Рейнольдса (Re ≪ 1), где преобладают силы вязкого трения Стокса. 
            Организмы определяют направление движения на основе непрерывных пространственных градиентов.
          </p>
          <div class="formula-box">
            <div class="formula-label">СИММЕТРИЧНЫЙ ЦЕНТРАЛЬНО-РАЗНОСТНЫЙ СЕНСОРНЫЙ ГРАДИЕНТ (δ = 16 мкм):</div>
            <div class="math-eq">
              ∇N(<strong>x</strong>) = [ (N(x + δ, y) − N(x − δ, y)) / (2δ), &nbsp; (N(x, y + δ) − N(x, y − δ)) / (2δ) ]ᵀ
            </div>
            <div class="formula-notes">
              Симметричное измерение на противоположных сторонах сенсорного горизонта устраняет односторонний дрейф и предотвращает ложное самопритягивание организма к собственным следам.
            </div>
          </div>
          <div class="formula-box">
            <div class="formula-label">СУММАРНЫЙ ВЕКТОР ЖЕЛАЕМОЙ ТЯГИ (STEERING FORCE):</div>
            <div class="math-eq">
              <strong>F</strong><sub>steer</sub> = χ<sub>N</sub> · ∇N(<strong>x</strong>) + χ<sub>W</sub> · ∇W(<strong>x</strong>) + <strong>F</strong><sub>lure</sub>(<strong>x</strong>) + <strong>F</strong><sub>avoid</sub> + <strong>F</strong><sub>prey</sub> + <strong>F</strong><sub>meniscus</sub>
            </div>
            <div class="formula-vars">
              <div><strong>χ<sub>N</sub> &gt; 0:</strong> Хемотаксис притяжения к пище (наследуемый параметр генома).</div>
              <div><strong>χ<sub>W</sub> &lt; 0:</strong> Хемотаксис отталкивания от токсичных продуктов обмена.</div>
              <div><strong>F<sub>lure</sub>:</strong> Дальнодействующий аттрактор брошенной пищи с горизонтом R<sub>lure</sub> = 480 мкм:
                <div class="sub-formula">
                  <strong>F</strong><sub>lure</sub> = 4.2 · (1 − d / R<sub>lure</sub>)<sup>1.2</sup> · ((<strong>x</strong><sub>food</sub> − <strong>x</strong>) / d)
                </div>
              </div>
            </div>
          </div>
          <p>
            Угловой поворот курсового угла θ и линейная скорость <strong>v</strong> обновляются с вязким затуханием:
          </p>
          <div class="formula-box">
            <div class="math-eq">
              θ<sub>t+1</sub> = θ<sub>t</sub> + clamp(Δθ · 0.25, −ω<sub>max</sub>, ω<sub>max</sub>), &nbsp;&nbsp;
              <strong>v</strong><sub>t+1</sub> = 0.98 · <strong>v</strong><sub>t</sub> + 0.20 · (<strong>v</strong><sub>target</sub> − <strong>v</strong><sub>t</sub>)
            </div>
          </div>
        </article>

        <!-- 03. Модель Курамото -->
        <article class="math-section">
          <div class="section-header">
            <span class="sec-num">03</span>
            <h3 class="sec-title">Коллективная синхронизация фаз ресничек (Kuramoto Oscillator Network)</h3>
          </div>
          <p>
            Каждое существо обладает мерцающим ресничным пояском. Фаза биения ресничек φ<sub>i</sub> ∈ [0, 2π) описывается классической 
            <strong>моделью нелинейно связанных фазовых осцилляторов Курамото</strong>. Когда соседние клетки сближаются, гидромеханические возмущения синхронизируют их гребки:
          </p>
          <div class="formula-box">
            <div class="formula-label">УРАВНЕНИЕ ДИНАМИКИ ФАЗЫ РЕСНИЧЕК КУРАМОТО:</div>
            <div class="math-eq">
              <span class="m-frac"><span class="m-top">dφ<sub>i</sub></span><span class="m-bot">dt</span></span>
              <span class="m-op">=</span> ω<sub>i</sub> 
              <span class="m-op">+</span> (K<sub>i</sub> / |N<sub>i</sub>|) · ∑<sub>j ∈ N<sub>i</sub></sub> sin(φ<sub>j</sub> − φ<sub>i</sub>)
            </div>
            <div class="formula-vars">
              <div><strong>ω<sub>i</sub>:</strong> Собственная базовая частота биения ресничек (ген <code>ciliaryFrequency</code> ∈ [0.05, 0.8] рад/шаг).</div>
              <div><strong>K<sub>i</sub>:</strong> Коэффициент гидродинамической связи (ген <code>phaseCoupling</code> ∈ [0, 1.5]).</div>
              <div><strong>N<sub>i</sub>:</strong> Множество соседей в локальной окрестности радиусом r &lt; 3.5 · s<sub>i</sub>.</div>
            </div>
          </div>
          <p>
            Фаза φ<sub>i</sub> модулирует мгновенную силу тяги, создавая биомиметические ритмичные толчки при плавании:
            <strong>v</strong><sub>pulse</sub>(t) = v<sub>max</sub> · (0.7 + 0.5 · [(1 + sin φ<sub>i</sub>(t)) / 2]).
          </p>
        </article>

        <!-- 04. Поверхностное натяжение мениска -->
        <article class="math-section">
          <div class="section-header">
            <span class="sec-num">04</span>
            <h3 class="sec-title">Капиллярный мениск и гидростатика капли (Surface Tension Boundary)</h3>
          </div>
          <p>
            Биокамера представляет собой круговой микрообъем радиусом R<sub>chamber</sub> = 620 мкм с центром в (700, 700) мкм. 
            Край капли формирует мягкое капиллярное поверхностное натяжение мениска с шириной переходного слоя δ<sub>m</sub> = 120 мкм.
          </p>
          <div class="formula-box">
            <div class="formula-label">КВАДРАТИЧНЫЙ ПОТЕНЦИАЛ ПОВЕРХНОСТНОГО НАТЯЖЕНИЯ:</div>
            <div class="math-eq">
              <strong>F</strong><sub>meniscus</sub>(r) = 
              4.5 · ((r − (R − δ<sub>m</sub>)) / δ<sub>m</sub>)² · <strong>n̂</strong><sub>inward</sub> + 2.2 · v<sub>outward</sub> · <strong>n̂</strong><sub>inward} &nbsp; (при r &gt; R − δ<sub>m</sub>)
            </div>
            <div class="formula-notes">
              Где <strong>n̂</strong><sub>inward</sub> — единичная нормаль внутрь капли, а v<sub>outward</sub> — радиальная скорость, демпфируемая для плавного скольжения вдоль границы.
            </div>
          </div>
          <p>
            При непосредственном физическом касании границы r &ge; R − s<sub>i</sub> происходит упругое отражение радиального импульса: 
            <strong>v</strong><sub>refl</sub> = <strong>v</strong> − 1.6 · (<strong>v</strong> · <strong>û</strong>) <strong>û</strong>.
          </p>
        </article>

        <!-- 05. Метаболизм Клейбера и Трофика -->
        <article class="math-section">
          <div class="section-header">
            <span class="sec-num">05</span>
            <h3 class="sec-title">Аллометрический метаболизм Клейбера и трофическая динамика</h3>
          </div>
          <p>
            Энергетический баланс организма подчиняется <strong>аллометрическому закону Клейбера</strong>, связывающему базовый метаболизм с размером тела в степени 3/4:
          </p>
          <div class="formula-box">
            <div class="formula-label">ЗАТРАТЫ ЭНЕРГИИ В ЕДИНИЦУ ВРЕМЕНИ (METABOLIC EXPENDITURE):</div>
            <div class="math-eq">
              P<sub>cost</sub> = [ (0.08 · s<sub>i</sub><sup>0.75</sup> + 0.03 · ||<strong>v</strong><sub>i</sub>||²) · Φ<sub>predator</sub> ] / η<sub>efficiency</sub>
            </div>
            <div class="formula-vars">
              <div><strong>s<sub>i</sub>:</strong> Радиус тела клетки (3.5 … 18 мкм).</div>
              <div><strong>||v<sub>i</sub>||²:</strong> Кинетическая диссипация энергии при преодолении вязкого трения.</div>
              <div><strong>Φ<sub>predator</sub> = (2.2 + 1.8 · κ<sub>i</sub>):</strong> Метаболический налог за плотоядность. Хищникам требуется больше энергии, что естественно стабилизирует экологическую пирамиду.</div>
              <div><strong>η<sub>efficiency</sub>:</strong> Метаболический КПД (0.6 … 1.6).</div>
            </div>
          </div>
          <div class="formula-box">
            <div class="formula-label">ВЕРОЯТНОСТЬ УСПЕШНОГО ХИЩНИЧЕСКОГО УДАРА (STRIKE MECHANICS):</div>
            <div class="math-eq">
              P<sub>strike</sub> = clamp(0.35 + 0.40 · (s<sub>pred</sub> − s<sub>prey</sub>) / s<sub>pred</sub>, &nbsp; 0.15, &nbsp; 0.85)
            </div>
            <div class="formula-notes">
              При успешной атаке хищник усваивает 70% энергии жертвы, а 30% рассеивается в воду в виде облака минерального детрита.
            </div>
          </div>
        </article>

        <!-- 06. Эволюция и мутации Коши -->
        <article class="math-section">
          <div class="section-header">
            <span class="sec-num">06</span>
            <h3 class="sec-title">Эволюция, скачки Коши и видообразование (Heavy-Tailed Speciation)</h3>
          </div>
          <p>
            Геном особи представляет собой 12-мерный вещественный вектор параметров <strong>g</strong> ∈ ℝ¹² 
            (размер, спектр флуоресценции λ<sub>hue</sub>, скорость, плотоядность κ, хемотаксис к пище χ<sub>N</sub>, чувствительность к токсинам χ<sub>W</sub>, частота ресничек ω, связь Курамото K, порог митоза E<sub>split</sub>, метаболический КПД η, мутабильность μ, адгезия). 
            При делении клетки (E &ge; E<sub>split</sub>) мутации генов вычисляются с распределением с тяжелыми хвостами:
          </p>
          <div class="formula-box">
            <div class="formula-label">РАСПРЕДЕЛЕНИЕ МУТАЦИЙ (ГАУСС + СКАЧКИ КОШИ):</div>
            <div class="math-eq">
              Δg<sub>k</sub> = μ<sub>i</sub> · σ<sub>k</sub> · [ (1 − p<sub>jump</sub>) · r + p<sub>jump</sub> · (4 · r) ], &nbsp; где p<sub>jump</sub> = 0.05, &nbsp; r ∈ [−1, 1]
            </div>
            <div class="formula-notes">
              5%-я вероятность макромутаций по распределению Коши предотвращает застревание популяции в локальных оптимумах приспособленности.
            </div>
          </div>
          <p>
            Видообразование классифицируется по взвешенному расстоянию в пространстве фенотипов:
          </p>
          <div class="formula-box">
            <div class="math-eq">
              D(<strong>g</strong><sub>child</sub>, <strong>g</strong><sub>species</sub>) = √ ( ∑ w<sub>k</sub> (g<sub>child, k</sub> − g<sub>species, k</sub>)² ) &gt; Θ<sub>spec</sub> &nbsp;⟹&nbsp; Регистрация нового вида
            </div>
          </div>
          <p>
            Биологическое разнообразие всей экосистемы оценивается в реальном времени <strong>индексом Шеннона</strong>:
            H' = − ∑ p<sub>s</sub> ln(p<sub>s</sub>), где p<sub>s</sub> = N<sub>s</sub> / N<sub>total</sub>.
          </p>
        </article>

        <!-- 07. Сетевой движок -->
        <article class="math-section">
          <div class="section-header">
            <span class="sec-num">07</span>
            <h3 class="sec-title">Архитектура движка реального времени (Deterministic 10 Hz & Interpolation)</h3>
          </div>
          <p>
            Симуляция разделена на строгий канонический серверный мир и отзывчивый клиентский интерфейс:
          </p>
          <ul class="arch-list">
            <li><strong>Серверный цикл (10 Hz / 100 мс):</strong> Вычисляется на Node.js с использованием таймера высокого разрешения <code>process.hrtime.bigint()</code> с нулевым накоплением фазового дрейфа.</li>
            <li><strong>Пространственное хеширование (O(N)):</strong> Коллизии организмов и поиск соседей оптимизированы через сетку хеш-корзин с шагом 35 мкм, снижая сложность с O(N²) до O(N).</li>
            <li><strong>Бинарный стриминг:</strong> Каждые 100 мс сервер пакует Float32Array массив организмов (10 чисел на особь) и отправляет по WebSocket клиентам (~35 КБ/с).</li>
            <li><strong>Клиентский рендеринг (60–120 FPS):</strong> Браузер выполняет эрмитову интерполяцию координат между серверными пакетами, обеспечивая безупречную плавность движения.</li>
          </ul>
        </article>

        <!-- 08. Двухуровневая архитектура ИИ -->
        <article class="math-section">
          <div class="section-header">
            <span class="sec-num">08</span>
            <h3 class="sec-title">Двухуровневая гибридная архитектура ИИ (Hierarchical Neuro-Symbolic ALife)</h3>
          </div>
          <p>
            Архитектура AETHEON объединяет два взаимодополняющих вычислительных уровня искусственного интеллекта: 
            <strong>низкоуровневый децентрализованный роевой интеллект (Sub-symbolic Swarm ALife)</strong> и 
            <strong>высокоуровневый когнитивный мета-анализатор (Cognitive LLM Xenobiologist via Venice AI)</strong>.
          </p>
          <div class="formula-box">
            <div class="formula-label">ПРОСТРАНСТВО МИКРО-СОСТОЯНИЙ СИСТЕМЫ (УРОВЕНЬ 1):</div>
            <div class="math-eq">
              S(t) = { (<strong>x</strong><sub>i</sub>, <strong>v</strong><sub>i</sub>, <strong>g</strong><sub>i</sub>, E<sub>i</sub>, φ<sub>i</sub>) }<sub>i=1..N(t)</sub> &nbsp; ∈ ℝ<sup>N(t) × 17</sup>
            </div>
            <div class="formula-vars">
              <div>Каждый из N(t) организмов обладает непрерывным 12D-геномом <strong>g</strong><sub>i</sub>, фазой ресничек φ<sub>i</sub>, вектором скорости <strong>v</strong><sub>i</sub> и уровнем энергии E<sub>i</sub>. Эволюция состояний подчинена нелинейным уравнениям механики и хемотаксиса без централизованного планирования.</div>
            </div>
          </div>
          <div class="formula-box">
            <div class="formula-label">ОПЕРАТОР МАКРО-СЖАТИЯ И ПАРАМЕТРИЗАЦИИ БИОСФЕРЫ:</div>
            <div class="math-eq">
              Φ(t) = T(S(t)) = [ N(t), K<sub>species</sub>, H'(t), ⟨E⟩, Σ<sub>gene</sub>, P<sub>trophic</sub> ] &nbsp; ∈ ℝ<sup>D</sup>
            </div>
            <div class="formula-vars">
              <div><strong>H'(t) = − ∑ p<sub>s</sub> ln(p<sub>s</sub>):</strong> Информационная энтропия Шеннона по активным видам.</div>
              <div><strong>Σ<sub>gene</sub>:</strong> Ковариационная матрица 12-мерных аллелей, определяющая степень генетической дивергенции.</div>
              <div><strong>P<sub>trophic</sub>:</strong> Баланс биомассы между консументами (автотрофами) и редуцентами/хищниками.</div>
            </div>
          </div>
          <div class="formula-box">
            <div class="formula-label">ИНФЕРЕНС КОГНИТИВНОГО НАБЛЮДАТЕЛЯ (УРОВЕНЬ 2 - VENICE AI / JEV / LLAMA):</div>
            <div class="math-eq">
              F<sub>LLM</sub>( Φ(t) | θ<sub>Venice</sub> ) ⟶ ( T<sub>taxa</sub>, &nbsp; J<sub>narrative</sub>, &nbsp; I<sub>insight</sub> )
            </div>
            <div class="formula-vars">
              <div>Языковая модель принимает вектор сжатых метрик Φ(t), выявляет устойчивые кластеры в фенотипическом пространстве и выполняет семантическую классификацию: генерирует биномиальное наименование (латынь), русское и английское название, художественное описание экологической ниши и практический вывод (Insight) для исследователя.</div>
            </div>
          </div>
          <p>
            Этот двухтактный цикл реализует <strong>нейро-символический симбиоз</strong>: микродинамика непрерывной физики порождает эмерджентную сложность, 
            а когнитивный ИИ переводит эту математическую энтропию в язык человеческих смыслов и научных хроник.
          </p>
        </article>
      </div>
    `;
  }

  getMathHtmlEn() {
    return `
      <div class="about-math-wrap">
        <div class="math-intro-banner">
          <div class="math-badge">TECHNICAL WHITEPAPER • REVISION 2.4</div>
          <h2 class="math-main-title">AETHEON Mathematical & Algorithmic Specification</h2>
          <p class="math-lead-desc">
            The fundamental partial differential equations, physical potentials, allometric scaling laws, 
            and optimization structures governing the simulation runtime.
          </p>
        </div>

        <!-- 01. Reaction-Diffusion -->
        <article class="math-section">
          <div class="section-header">
            <span class="sec-num">01</span>
            <h3 class="sec-title">Substrate Chemodynamics (2D Reaction-Diffusion PDE)</h3>
          </div>
          <p>
            The continuous world domain (<strong>x</strong> ∈ [0, 1400 μm]²) is discretized into a 128 × 128 cell chemical matrix. 
            Three coupled scalar fields co-evolve: nutrients <em>N(x, y, t)</em>, waste byproducts <em>W(x, y, t)</em>, and bioluminescent signals <em>S(x, y, t)</em>.
          </p>
          <div class="formula-box">
            <div class="formula-label">REACTION-DIFFUSION EQUATION WITH SOURCES AND SINKS:</div>
            <div class="math-eq">
              <span class="m-frac"><span class="m-top">∂N</span><span class="m-bot">∂t</span></span>
              <span class="m-op">=</span> <span class="m-const">D<sub>N</sub></span> ∇²N 
              <span class="m-op">−</span> <span class="m-const">γ<sub>N</sub></span> N 
              <span class="m-op">+</span> ∑ S<sub>vent, v</sub>(<strong>x</strong>) 
              <span class="m-op">+</span> S<sub>bloom</sub>(<strong>x</strong>, t) 
              <span class="m-op">−</span> ∑ C<sub>org, k</sub>(<strong>x</strong>, t)
            </div>
            <div class="formula-vars">
              <div><strong>D<sub>N</sub> = 0.08:</strong> Molecular diffusion coefficient of nutrient salts.</div>
              <div><strong>γ<sub>N</sub> = 0.0005:</strong> Ambient hydrolysis decay rate.</div>
              <div><strong>S<sub>vent, v</sub>(x):</strong> Gaussian injection from 5 hydrothermal vents:
                <div class="sub-formula">
                  S<sub>v</sub>(<strong>x</strong>) = P<sub>v</sub> · exp(− ||<strong>x</strong> − <strong>x</strong><sub>v</sub>||² / (1.5 · r<sub>v</sub>²)), 
                  where P<sub>v</sub> = 0.14, r<sub>v</sub> = 7 cells
                </div>
              </div>
            </div>
          </div>
          <p>
            The 2D Laplace operator ∇² is evaluated using a 5-point stencil with <strong>Zero-Flux Neumann reflective boundary conditions</strong>:
          </p>
          <div class="formula-box">
            <div class="math-eq">
              ∇²N<sub>i,j</sub> ≈ (N<sub>i+1,j</sub> + N<sub>i−1,j</sub> + N<sub>i,j+1</sub> + N<sub>i,j−1</sub> − 4 N<sub>i,j</sub>) / Δx²
            </div>
            <div class="formula-notes">
              Zero-flux condition (∂N/∂<strong>n</strong> = 0) at the domain boundaries guarantees mass conservation.
            </div>
          </div>
          <p>
            To prevent grid-snapping anisotropy, organism nutrient uptake and waste deposition are bilinearly distributed across the 4 surrounding nodes 
            proportional to (1−f<sub>x</sub>)(1−f<sub>y</sub>), f<sub>x</sub>(1−f<sub>y</sub>), (1−f<sub>x</sub>)f<sub>y</sub>, f<sub>x</sub>f<sub>y</sub>.
          </p>
        </article>

        <!-- 02. Chemotaxis & Hydrodynamics -->
        <article class="math-section">
          <div class="section-header">
            <span class="sec-num">02</span>
            <h3 class="sec-title">Isotropic Chemotaxis & Low Reynolds Hydrodynamics</h3>
          </div>
          <p>
            At microscopic scales (Re ≪ 1), Stokes viscous drag dominates over inertia. 
            Organism motility relies on sensing chemical gradients via an isotropic central-difference operator:
          </p>
          <div class="formula-box">
            <div class="formula-label">CENTRAL DIFFERENCE SENSORY GRADIENT (SPAN δ = 16 μm):</div>
            <div class="math-eq">
              ∇N(<strong>x</strong>) = [ (N(x + δ, y) − N(x − δ, y)) / (2δ), &nbsp; (N(x, y + δ) − N(x, y − δ)) / (2δ) ]ᵀ
            </div>
            <div class="formula-notes">
              Symmetric bilateral sampling eliminates forward-difference directional bias and prevents self-induced drift into corners.
            </div>
          </div>
          <div class="formula-box">
            <div class="formula-label">NET TARGET STEERING VECTOR:</div>
            <div class="math-eq">
              <strong>F</strong><sub>steer</sub> = χ<sub>N</sub> · ∇N(<strong>x</strong>) + χ<sub>W</sub> · ∇W(<strong>x</strong>) + <strong>F</strong><sub>lure</sub>(<strong>x</strong>) + <strong>F</strong><sub>avoid</sub> + <strong>F</strong><sub>prey</sub> + <strong>F</strong><sub>meniscus</sub>
            </div>
            <div class="formula-vars">
              <div><strong>χ<sub>N</sub> &gt; 0:</strong> Chemotactic nutrient affinity (genome trait).</div>
              <div><strong>χ<sub>W</sub> &lt; 0:</strong> Chemotactic waste repulsion.</div>
              <div><strong>F<sub>lure</sub>:</strong> Long-horizon visitor food scent pull (R<sub>lure</sub> = 480 μm):
                <div class="sub-formula">
                  <strong>F</strong><sub>lure</sub> = 4.2 · (1 − d / R<sub>lure</sub>)<sup>1.2</sup> · ((<strong>x</strong><sub>food</sub> − <strong>x</strong>) / d)
                </div>
              </div>
            </div>
          </div>
          <p>
            Heading angle θ and linear velocity <strong>v</strong> update with Stokes damping:
          </p>
          <div class="formula-box">
            <div class="math-eq">
              θ<sub>t+1</sub> = θ<sub>t</sub> + clamp(Δθ · 0.25, −ω<sub>max</sub>, ω<sub>max</sub>), &nbsp;&nbsp;
              <strong>v</strong><sub>t+1</sub> = 0.98 · <strong>v</strong><sub>t</sub> + 0.20 · (<strong>v</strong><sub>target</sub> − <strong>v</strong><sub>t</sub>)
            </div>
          </div>
        </article>

        <!-- 03. Kuramoto -->
        <article class="math-section">
          <div class="section-header">
            <span class="sec-num">03</span>
            <h3 class="sec-title">Collective Cilia Phase Coupling (Kuramoto Model)</h3>
          </div>
          <p>
            The beating cilia phase φ<sub>i</sub> ∈ [0, 2π) of each specimen is governed by the 
            <strong>Kuramoto model of nonlinearly coupled phase oscillators</strong>:
          </p>
          <div class="formula-box">
            <div class="formula-label">KURAMOTO PHASE DYNAMICS EQUATION:</div>
            <div class="math-eq">
              <span class="m-frac"><span class="m-top">dφ<sub>i</sub></span><span class="m-bot">dt</span></span>
              <span class="m-op">=</span> ω<sub>i</sub> 
              <span class="m-op">+</span> (K<sub>i</sub> / |N<sub>i</sub>|) · ∑<sub>j ∈ N<sub>i</sub></sub> sin(φ<sub>j</sub> − φ<sub>i</sub>)
            </div>
            <div class="formula-vars">
              <div><strong>ω<sub>i</sub>:</strong> Intrinsic ciliary frequency (gene <code>ciliaryFrequency</code> ∈ [0.05, 0.8] rad/step).</div>
              <div><strong>K<sub>i</sub>:</strong> Hydrodynamic coupling strength (gene <code>phaseCoupling</code> ∈ [0, 1.5]).</div>
              <div><strong>N<sub>i</sub>:</strong> Neighboring organisms within radius r &lt; 3.5 · s<sub>i</sub>.</div>
            </div>
          </div>
        </article>

        <!-- 04. Meniscus -->
        <article class="math-section">
          <div class="section-header">
            <span class="sec-num">04</span>
            <h3 class="sec-title">Capillary Surface Tension Meniscus</h3>
          </div>
          <p>
            The chamber is an organic circular droplet of radius R = 620 μm centered at (700, 700) μm. 
            The edge simulates viscoelastic surface tension with boundary margin δ<sub>m</sub> = 120 μm:
          </p>
          <div class="formula-box">
            <div class="formula-label">QUADRATIC MENISCUS RESTORING POTENTIAL:</div>
            <div class="math-eq">
              <strong>F</strong><sub>meniscus</sub>(r) = 
              4.5 · ((r − (R − δ<sub>m</sub>)) / δ<sub>m</sub>)² · <strong>n̂</strong><sub>inward</sub> + 2.2 · v<sub>outward</sub> · <strong>n̂</strong><sub>inward} &nbsp; (for r &gt; R − δ<sub>m</sub>)
            </div>
          </div>
        </article>

        <!-- 05. Kleiber Metabolism -->
        <article class="math-section">
          <div class="section-header">
            <span class="sec-num">05</span>
            <h3 class="sec-title">Allometric Kleiber Metabolism & Trophic Dynamics</h3>
          </div>
          <p>
            Metabolic energy expenditure follows <strong>Kleiber's 3/4 allometric power law</strong> scaled with hydrodynamic speed:
          </p>
          <div class="formula-box">
            <div class="formula-label">METABOLIC COST PER STEP:</div>
            <div class="math-eq">
              P<sub>cost</sub> = [ (0.08 · s<sub>i</sub><sup>0.75</sup> + 0.03 · ||<strong>v</strong><sub>i</sub>||²) · Φ<sub>predator</sub> ] / η<sub>efficiency</sub>
            </div>
            <div class="formula-vars">
              <div><strong>s<sub>i</sub>:</strong> Body radius (3.5 … 18 μm).</div>
              <div><strong>Φ<sub>predator</sub> = (2.2 + 1.8 · κ<sub>i</sub>):</strong> Trophic conversion penalty on carnivores.</div>
              <div><strong>η<sub>efficiency</sub>:</strong> Metabolic efficiency gene (0.6 … 1.6).</div>
            </div>
          </div>
          <div class="formula-box">
            <div class="formula-label">PREDATORY STRIKE PROBABILITY:</div>
            <div class="math-eq">
              P<sub>strike</sub> = clamp(0.35 + 0.40 · (s<sub>pred</sub> − s<sub>prey</sub>) / s<sub>pred</sub>, &nbsp; 0.15, &nbsp; 0.85)
            </div>
          </div>
        </article>

        <!-- 06. Cauchy Mutations -->
        <article class="math-section">
          <div class="section-header">
            <span class="sec-num">06</span>
            <h3 class="sec-title">Heavy-Tailed Cauchy Mutations & Speciation</h3>
          </div>
          <p>
            Organisms transmit a 12-dimensional continuous genome <strong>g</strong> ∈ ℝ¹². 
            Mutations utilize a mixture of uniform Gaussian perturbation and heavy-tailed Cauchy jumps:
          </p>
          <div class="formula-box">
            <div class="formula-label">CAUCHY-AUGMENTED MUTATION OPERATOR:</div>
            <div class="math-eq">
              Δg<sub>k</sub> = μ<sub>i</sub> · σ<sub>k</sub> · [ (1 − p<sub>jump</sub>) · r + p<sub>jump</sub> · (4 · r) ], &nbsp; where p<sub>jump</sub> = 0.05, &nbsp; r ∈ [−1, 1]
            </div>
          </div>
          <p>
            Shannon ecological diversity of the entire chamber is tracked in real-time:
            H' = − ∑ p<sub>s</sub> ln(p<sub>s</sub>), where p<sub>s</sub> = N<sub>s</sub> / N<sub>total</sub>.
          </p>
        </article>

        <!-- 07. Runtime Architecture -->
        <article class="math-section">
          <div class="section-header">
            <span class="sec-num">07</span>
            <h3 class="sec-title">Real-Time Architecture (10 Hz Tick & Hermite Splines)</h3>
          </div>
          <p>
            The simulation is partitioned between a deterministic authoritative Node.js server and an adaptive client:
          </p>
          <ul class="arch-list">
            <li><strong>Canonical Server Loop (10 Hz / 100 ms):</strong> Driven by <code>process.hrtime.bigint()</code> with zero accumulated drift.</li>
            <li><strong>Spatial Hashing (O(N)):</strong> Collision queries execute via a 35 μm grid bucket partition, reducing checks from O(N²) to O(N).</li>
            <li><strong>Ultra-Lean Binary Packets:</strong> 10 numbers per organism streamed via WebSocket (~35 KB/s).</li>
            <li><strong>Client Frame Interpolation (60–120 FPS):</strong> The Canvas renderer computes smooth Hermite spline motion between server ticks.</li>
          </ul>
        </article>

        <!-- 08. Dual-Layer AI Architecture -->
        <article class="math-section">
          <div class="section-header">
            <span class="sec-num">08</span>
            <h3 class="sec-title">Dual-Layer Hierarchical AI Architecture (Neuro-Symbolic ALife)</h3>
          </div>
          <p>
            AETHEON integrates two complementary computational intelligence layers: 
            a <strong>low-level decentralized swarm intelligence (Sub-symbolic Swarm ALife)</strong> and 
            a <strong>high-level cognitive meta-observer (Cognitive LLM Xenobiologist via Venice AI)</strong>.
          </p>
          <div class="formula-box">
            <div class="formula-label">MICRO-SCALE STATE PHASE SPACE (LAYER 1):</div>
            <div class="math-eq">
              S(t) = { (<strong>x</strong><sub>i</sub>, <strong>v</strong><sub>i</sub>, <strong>g</strong><sub>i</sub>, E<sub>i</sub>, φ<sub>i</sub>) }<sub>i=1..N(t)</sub> &nbsp; ∈ ℝ<sup>N(t) × 17</sup>
            </div>
            <div class="formula-vars">
              <div>Each of the N(t) organisms evolves under a 12-dimensional continuous genome <strong>g</strong><sub>i</sub>, cilia oscillator phase φ<sub>i</sub>, velocity <strong>v</strong><sub>i</sub>, and internal energy E<sub>i</sub>. Behaviors emerge autonomously via local PDEs without global orchestration.</div>
            </div>
          </div>
          <div class="formula-box">
            <div class="formula-label">MACRO-SCALE TELEMETRY PROJECTION OPERATOR:</div>
            <div class="math-eq">
              Φ(t) = T(S(t)) = [ N(t), K<sub>species</sub>, H'(t), ⟨E⟩, Σ<sub>gene</sub>, P<sub>trophic</sub> ] &nbsp; ∈ ℝ<sup>D</sup>
            </div>
            <div class="formula-vars">
              <div><strong>H'(t) = − ∑ p<sub>s</sub> ln(p<sub>s</sub>):</strong> Shannon diversity index over active genetic clades.</div>
              <div><strong>Σ<sub>gene</sub>:</strong> Genetic allele covariance matrix quantifying speciation distance.</div>
              <div><strong>P<sub>trophic</sub>:</strong> Trophic ratio between autotrophic primary producers and apex predators.</div>
            </div>
          </div>
          <div class="formula-box">
            <div class="formula-label">COGNITIVE INFERENCE MAPPING (LAYER 2 - VENICE AI / JEV / LLAMA):</div>
            <div class="math-eq">
              F<sub>LLM</sub>( Φ(t) | θ<sub>Venice</sub> ) ⟶ ( T<sub>taxa</sub>, &nbsp; J<sub>narrative</sub>, &nbsp; I<sub>insight</sub> )
            </div>
            <div class="formula-vars">
              <div>The large language model receives compressed telemetry vector Φ(t), isolates stable phenotypic clusters, and synthesizes semantic taxonomy: formal Latin binomial, vernacular Russian and English names, narrative behavioral chronicle, and ecological insights.</div>
            </div>
          </div>
          <p>
            This closed-loop system realizes a <strong>neuro-symbolic ALife paradigm</strong>: micro-scale continuous physics yields raw emergent complexity, 
            while the macro-scale cognitive model translates entropy into structured science and narrative history.
          </p>
        </article>
      </div>
    `;
  }
}

