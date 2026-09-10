import type { KnowledgeCategory } from './types';

export const KNOWLEDGE_CATEGORIES: readonly KnowledgeCategory[] = [
  {
    id: 'start',
    label: { ru: 'С чего начать', en: 'Start here' },
    description: {
      ru: 'Что такое астрология, зодиак, гороскоп и натальная карта.',
      en: 'What astrology, the zodiac, a horoscope, and a natal chart are.',
    },
  },
  {
    id: 'signs',
    label: { ru: 'Знаки зодиака', en: 'Zodiac signs' },
    description: {
      ru: 'Двенадцать знаков, четыре стихии и три способа начинать и продолжать дела.',
      en: 'Twelve signs, four elements, and three ways signs begin and continue things.',
    },
  },
  {
    id: 'planets',
    label: { ru: 'Планеты и светила', en: 'Planets and luminaries' },
    description: {
      ru: 'Что астрономически представляет каждый объект и как его используют в астрологии.',
      en: 'What each object is astronomically and how astrology uses it.',
    },
  },
  {
    id: 'houses',
    label: { ru: 'Дома', en: 'Houses' },
    description: {
      ru: 'Двенадцать частей круга, связанных с разными вопросами жизни.',
      en: 'Twelve parts of the wheel connected with different parts of life.',
    },
  },
  {
    id: 'angles',
    label: { ru: 'Углы карты', en: 'Chart angles' },
    description: {
      ru: 'Асцендент, Десцендент, MC и IC — четыре опорные точки карты.',
      en: 'The Ascendant, Descendant, MC, and IC—the chart’s four main angles.',
    },
  },
  {
    id: 'aspects',
    label: { ru: 'Аспекты', en: 'Aspects' },
    description: {
      ru: 'Как расстояние между точками карты связывает их значения.',
      en: 'How the distance between chart points connects their meanings.',
    },
  },
  {
    id: 'retrogrades',
    label: { ru: 'Движение планет', en: 'Planetary motion' },
    description: {
      ru: 'Почему планета кажется движущейся назад и что именно отмечено в карте.',
      en: 'Why a planet can appear to move backwards and what a chart records.',
    },
  },
  {
    id: 'nodes-points',
    label: { ru: 'Дополнительные точки и объекты', en: 'Additional points and objects' },
    description: {
      ru: 'Точки, которые получают расчётом, а не наблюдают как физические планеты.',
      en: 'Points found by calculation rather than observed as physical planets.',
    },
  },
  {
    id: 'synthesis',
    label: { ru: 'Структуры карты', en: 'Chart structures' },
    description: {
      ru: 'Стеллиумы, конфигурации, управители и достоинства планет.',
      en: 'Stelliums, aspect patterns, rulers, and planetary dignities.',
    },
  },
  {
    id: 'compatibility',
    label: { ru: 'Отношения', en: 'Relationships' },
    description: {
      ru: 'Чем сравнение знаков отличается от сравнения двух полных карт.',
      en: 'How sign matching differs from comparing two complete charts.',
    },
  },
  {
    id: 'forecasts',
    label: { ru: 'Прогностические методы', en: 'Predictive methods' },
    description: {
      ru: 'Транзиты, прогрессии, дирекции, возвращения, соляр и лунар.',
      en: 'Transits, progressions, directions, returns, solar returns, and lunar returns.',
    },
  },
  {
    id: 'moon-cycles',
    label: { ru: 'Луна и лунный цикл', en: 'The Moon and its cycle' },
    description: {
      ru: 'Почему меняются фазы Луны, чем полнолуние отличается от затмения.',
      en: 'Why lunar phases change and how a full moon differs from an eclipse.',
    },
  },
  {
    id: 'branches-tools',
    label: { ru: 'Другие понятия и методы', en: 'Other terms and methods' },
    description: {
      ru: 'Эфемериды, градусы, астрокартография и основные направления астрологии.',
      en: 'Ephemerides, degrees, astrocartography, and the main branches of astrology.',
    },
  },
] as const;
