/** Plain names of AI requests (the schema name of each generation) for the admin. */
const AI_SCENARIO_LABELS: Record<string, string> = {
  personal_micro_forecast: 'Короткий личный прогноз',
  personal_future_forecast: 'Личный прогноз на будущее',
  personal_forecast_question_answer: 'Ответ на вопрос к прогнозу',
  natal_unified_reading: 'Разбор натальной карты',
  natal_unified_semantic_review: 'Проверка разбора карты',
  natal_unified_block_repair: 'Исправление блока разбора',
  natal_question_answer: 'Ответ на вопрос о себе',
  natal_question_semantic_review: 'Проверка ответа о себе',
  calculated_compatibility_story: 'Разбор совместимости',
  sign_compatibility: 'Совместимость знаков',
  nebo_pair_future: 'Прогноз для пары',
  nebo_direct_horoscope: 'Гороскоп',
  sleep_story: 'Рассказ для сна',
  story_episode: 'Выпуск рассказа',
  story_variants: 'Варианты продолжения рассказа',
  text: 'Текст от ИИ',
  json: 'Ответ ИИ в виде данных',
};

export function aiScenarioLabel(scenario: string): string {
  return AI_SCENARIO_LABELS[scenario] || scenario.replace(/_/g, ' ');
}
