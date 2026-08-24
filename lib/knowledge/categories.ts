import type { KnowledgeCategory } from './types';

export const KNOWLEDGE_CATEGORIES: readonly KnowledgeCategory[] = [
  {
    id: 'start',
    label: { ru: 'С чего начать', en: 'Start here' },
    description: {
      ru: 'Как устроена натальная карта и какие данные нужны для расчёта.',
      en: 'How a natal chart is built and which birth details the calculation needs.',
    },
  },
  {
    id: 'signs',
    label: { ru: 'Знаки', en: 'Signs' },
    description: {
      ru: 'Двенадцать знаков, четыре стихии и три способа начинать и продолжать дела.',
      en: 'Twelve signs, four elements, and three ways signs begin and continue things.',
    },
  },
  {
    id: 'planets',
    label: { ru: 'Планеты', en: 'Planets' },
    description: {
      ru: 'Что показывает каждая планета и чем её роль отличается от знака и дома.',
      en: 'What each planet describes and how its role differs from a sign or house.',
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
    label: { ru: 'Ретроградность', en: 'Retrograde motion' },
    description: {
      ru: 'Почему планета кажется движущейся назад и что именно отмечено в карте.',
      en: 'Why a planet can appear to move backwards and what a chart records.',
    },
  },
  {
    id: 'nodes-points',
    label: { ru: 'Узлы и расчётные точки', en: 'Nodes and calculated points' },
    description: {
      ru: 'Точки, которые получают расчётом, а не наблюдают как физические планеты.',
      en: 'Points found by calculation rather than observed as physical planets.',
    },
  },
  {
    id: 'synthesis',
    label: { ru: 'Как читать всё вместе', en: 'Reading it together' },
    description: {
      ru: 'Как соединить планету, знак, дом и аспекты без поспешных выводов.',
      en: 'How to combine a planet, sign, house, and aspects without rushing to a label.',
    },
  },
  {
    id: 'compatibility',
    label: { ru: 'Отношения и совместимость', en: 'Relationships and compatibility' },
    description: {
      ru: 'Чем сравнение знаков отличается от сравнения двух полных карт.',
      en: 'How sign matching differs from comparing two complete charts.',
    },
  },
  {
    id: 'forecasts',
    label: { ru: 'Прогнозы', en: 'Forecasts' },
    description: {
      ru: 'Чем текущий период отличается от натальной карты и что такое транзит.',
      en: 'How a current period differs from a natal chart and what a transit is.',
    },
  },
  {
    id: 'moon-cycles',
    label: { ru: 'Луна и циклы', en: 'The Moon and its cycles' },
    description: {
      ru: 'Натальная Луна, текущая Луна, фазы и обычное значение лунного календаря.',
      en: 'The natal Moon, current Moon, phases, and what a lunar calendar usually means.',
    },
  },
] as const;
