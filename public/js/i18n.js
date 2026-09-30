export const DICTIONARY = {
  en: {
    organisms: 'organisms',
    species: 'species',
    gen: 'gen',
    mode_zen: 'Zen',
    mode_lab: 'Lab',
    codex_title: 'Codex',
    sound_on: 'Sound',
    sound_off: 'Sound',
    hint_intro: 'Tap to drop nutrients • Drag to stir currents • Click any creature to inspect',
    naturalist_tag: 'XENOBIOLOGIST',
    status: 'Status',
    energy: 'Energy',
    generation: 'Generation',
    age: 'Age',
    diet: 'Diet & Trophism',
    offspring: 'Offspring',
    btn_feed: '💧 Feed (+Nutrient)',
    btn_track: '🎯 Track Cam',
    tab_species: 'Species Codex',
    tab_journal: 'Naturalist Journal',
    codex_intro: 'Continuous catalog of all lineages that have emerged, adapted, or gone extinct since Genesis.',
    status_grazing: 'Grazing peacefully',
    status_hunting: 'Stalking prey',
    status_dividing: 'Undergoing mitosis',
    status_starving: 'Starving, seeking vents',
    diet_herbivore: 'Primary Autotroph / Grazer',
    diet_carnivore: 'Apex Predator / Hunter',
    diet_omnivore: 'Opportunistic Omnivore',
    unit_children: 'children',
    unit_seconds: 's',
    unit_minutes: 'm',
    unit_days: 'd',
    lab_mode_active: 'RESEARCH INSTRUMENT',
    grid_scale: 'Scale',
    trophic_balance: 'Trophic',
    diversity_index: 'Shannon H\'',
    legend_grazer: 'Grazer Thrust',
    legend_hunter: 'Predator Thrust',
    legend_sensor: 'Sensory Field',
    grazers: 'Grazers',
    hunters: 'Hunters',
    about_btn: 'About',
    about_title: 'Architecture & Mathematics',
    about_tab_overview: 'Concept & Controls',
    about_tab_math: 'Mathematical Model (Full)',
    btn_explore_math: 'Open Full Mathematical Model →'
  },
  ru: {
    organisms: 'организмов',
    species: 'видов',
    gen: 'пок.',
    mode_zen: 'Дзен',
    mode_lab: 'Лаб',
    codex_title: 'Кодекс',
    sound_on: 'Звук',
    sound_off: 'Звук',
    hint_intro: 'Касание: добавить питание • Движение: создать течение • Клик по существу: анализ',
    naturalist_tag: 'КСЕНОБИОЛОГ',
    status: 'Состояние',
    energy: 'Энергия',
    generation: 'Поколение',
    age: 'Возраст',
    diet: 'Тип питания',
    offspring: 'Потомство',
    btn_feed: '💧 Покормить (+Еда)',
    btn_track: '🎯 Следить камерой',
    tab_species: 'Кодекс видов',
    tab_journal: 'Журнал натуралиста',
    codex_intro: 'Непрерывный реестр всех эволюционных линий, возникших, развившихся или угасших со времен Генезиса.',
    status_grazing: 'Мирно пасётся',
    status_hunting: 'Выслеживает добычу',
    status_dividing: 'Митоз (деление клетки)',
    status_starving: 'Голодает, ищет жерла',
    diet_herbivore: 'Первичный автотроф',
    diet_carnivore: 'Вершинный хищник',
    diet_omnivore: 'Адаптивный всеядный',
    unit_children: 'потомков',
    unit_seconds: 'с',
    unit_minutes: 'м',
    unit_days: 'д',
    lab_mode_active: 'НАУЧНЫЙ ИНСТРУМЕНТ',
    grid_scale: 'Масштаб',
    trophic_balance: 'Трофика',
    diversity_index: 'Индекс Шеннона',
    legend_grazer: 'Тяга пастбищника',
    legend_hunter: 'Тяга хищника',
    legend_sensor: 'Радиус чувств',
    grazers: 'Пастбищники',
    hunters: 'Хищники',
    about_btn: 'О проекте',
    about_title: 'Архитектура и математика',
    about_tab_overview: 'Концепция и управление',
    about_tab_math: 'Математическая модель (полная)',
    btn_explore_math: 'Развернуть полную математическую модель →'
  }
};

class I18nManager {
  constructor() {
    this.lang = localStorage.getItem('aetheon_lang') || 'en';
  }

  getLang() {
    return this.lang;
  }

  setLang(lang) {
    if (DICTIONARY[lang]) {
      this.lang = lang;
      localStorage.setItem('aetheon_lang', lang);
      this.applyTranslations();
      window.dispatchEvent(new CustomEvent('aetheon-lang-changed', { detail: { lang } }));
    }
  }

  toggleLang() {
    this.setLang(this.lang === 'en' ? 'ru' : 'en');
    return this.lang;
  }

  t(key) {
    return DICTIONARY[this.lang]?.[key] || DICTIONARY['en']?.[key] || key;
  }

  applyTranslations() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translation = this.t(key);
      if (translation) {
        el.textContent = translation;
      }
    });

    const langIndicator = document.getElementById('lang-indicator');
    if (langIndicator) {
      langIndicator.textContent = this.lang === 'en' ? 'RU' : 'EN';
    }
  }
}

export const i18n = new I18nManager();
