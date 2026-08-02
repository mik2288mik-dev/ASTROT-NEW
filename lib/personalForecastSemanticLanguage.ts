import type {
  ForecastActionAtom,
  ForecastClaimAtom,
  ForecastLifeContext,
  ForecastManifestationAtom,
  ForecastRiskAtom,
  ForecastSemanticDomain,
  ForecastSemanticFact,
} from './personalForecastSemantics';

export type ForecastWriterLanguage = 'ru' | 'en';

type AtomLanguage = Record<ForecastWriterLanguage, string>;

const CLAIMS: Record<ForecastClaimAtom, AtomLanguage> = {
  priorities_are_temporarily_active: { ru: 'Сейчас личные приоритеты требуют чёткого выбора.', en: 'Personal priorities require a clear choice right now.' },
  emotional_responses_are_temporarily_active: { ru: 'Реакции сейчас возникают быстрее и заметнее обычного.', en: 'Reactions are quicker and more noticeable than usual right now.' },
  communication_and_decisions_are_temporarily_active: { ru: 'Разговоры, формулировки и решения сейчас требуют особой точности.', en: 'Conversations, wording, and decisions require extra precision right now.' },
  values_and_agreements_are_temporarily_active: { ru: 'Условия, симпатии и личные ценности сейчас выходят на первый план.', en: 'Terms, preferences, and personal values move to the foreground now.' },
  action_and_boundaries_are_temporarily_active: { ru: 'Темп действий и личные границы сейчас становятся главным вопросом.', en: 'Pace of action and personal boundaries are the main issue now.' },
  growth_and_judgment_are_temporarily_active: { ru: 'Масштаб планов и качество оценки сейчас важнее скорости.', en: 'The scale of a plan and the quality of judgment matter more than speed now.' },
  limits_and_commitments_are_temporarily_active: { ru: 'Ограничения и обязательства сейчас нельзя оставлять без проверки.', en: 'Limits and commitments cannot be left unchecked right now.' },
  immediate_responses_are_temporarily_active: { ru: 'Первая реакция сейчас особенно заметна и влияет на следующий шаг.', en: 'The first reaction is unusually visible now and shapes the next step.' },
  change_and_autonomy_are_temporarily_active: { ru: 'Потребность изменить правила или вернуть себе свободу сейчас усиливается.', en: 'The need to change the rules or reclaim autonomy is stronger now.' },
  clarity_and_imagination_are_temporarily_active: { ru: 'Сейчас особенно важно отделять точный сигнал от догадки.', en: 'It is especially important now to separate a clear signal from an assumption.' },
  power_and_control_are_temporarily_active: { ru: 'Вопрос контроля и влияния сейчас становится острее.', en: 'Questions of control and influence are sharper right now.' },
  temporary_focus_is_concentrated: { ru: 'Один вопрос сейчас забирает больше внимания, чем остальные.', en: 'One issue is taking more attention than the rest right now.' },
  temporary_support_is_available: { ru: 'Сейчас есть рабочая поддержка для конкретного следующего шага.', en: 'There is useful support now for one concrete next step.' },
  temporary_friction_requires_precision: { ru: 'Трение сейчас не исчезнет само: его снимают точность и ясные условия.', en: 'The friction will not clear by itself; precision and clear terms reduce it.' },
  two_sides_temporarily_require_balance: { ru: 'Две стороны вопроса сейчас требуют честного сопоставления.', en: 'Two sides of the issue require an honest comparison right now.' },
  reliable_house_defines_context: { ru: 'Точное время рождения позволяет надёжно определить жизненный контекст этого фактора.', en: 'An exact birth time makes the life context of this factor reliable.' },
  house_context_is_temporarily_active: { ru: 'Этот жизненный контекст сейчас временно получает дополнительную нагрузку.', en: 'This area of life is carrying additional temporary pressure now.' },
  context_is_entering_a_new_phase: { ru: 'В этом контексте начинается новая фаза, но её результат ещё не задан.', en: 'A new phase is beginning in this context, but its outcome is not fixed.' },
  process_is_turning_direct: { ru: 'Процесс разворачивается к прямому движению после паузы или пересмотра.', en: 'The process is turning direct after a pause or review.' },
  process_is_turning_retrograde: { ru: 'Процесс входит в фазу возврата и проверки уже сделанного.', en: 'The process is entering a phase of return and review.' },
  process_is_near_a_station: { ru: 'Направление процесса пока не закрепилось: сейчас важнее наблюдение, чем вывод.', en: 'The direction is not settled yet; observation matters more than a conclusion.' },
  attention_cycle_is_beginning: { ru: 'Начинается короткий цикл внимания к новой задаче или приоритету.', en: 'A short cycle of attention to a new task or priority is beginning.' },
  attention_cycle_is_culminating: { ru: 'Текущий цикл подходит к заметной точке результата или развязки.', en: 'The current cycle is approaching a visible result or turning point.' },
};

const MANIFESTATIONS: Record<ForecastManifestationAtom, AtomLanguage> = {
  priority_competition_becomes_visible: { ru: 'Становится видно, какие цели конкурируют за одно и то же время и внимание.', en: 'It becomes clear which goals are competing for the same time and attention.' },
  response_tempo_changes: { ru: 'Пауза между событием и ответом может стать короче или, наоборот, затянуться.', en: 'The pause between an event and the response may shorten or stretch out.' },
  conversation_tempo_changes: { ru: 'Диалоги могут резко ускоряться, прерываться или возвращаться к старым деталям.', en: 'Conversations may speed up, break off, or return to old details.' },
  details_require_review: { ru: 'Формулировки, цифры и порядок действий требуют повторной проверки.', en: 'Wording, numbers, and sequence require another check.' },
  agreement_terms_become_more_noticeable: { ru: 'Скрытые или неоговорённые условия становятся заметнее.', en: 'Hidden or unstated terms become easier to notice.' },
  value_mismatch_becomes_more_noticeable: { ru: 'Разница между желаемым и реально приемлемым проявляется быстрее.', en: 'The gap between what is wanted and what is actually acceptable appears sooner.' },
  urge_to_act_becomes_more_noticeable: { ru: 'Желание перейти к действию усиливается ещё до полной ясности.', en: 'The urge to act increases before everything is fully clear.' },
  boundary_response_becomes_more_noticeable: { ru: 'Попытка давления быстрее вызывает прямой ответ или отказ.', en: 'Pressure is more likely to trigger a direct response or refusal.' },
  scope_of_a_choice_becomes_more_noticeable: { ru: 'Становится понятнее, насколько широки последствия выбранного шага.', en: 'The real scope of a choice becomes easier to see.' },
  expectations_expand: { ru: 'Ожидания растут быстрее, чем подтверждённые возможности.', en: 'Expectations expand faster than confirmed possibilities.' },
  constraint_or_deadline_becomes_more_noticeable: { ru: 'Срок, правило или реальное ограничение выходит на первый план.', en: 'A deadline, rule, or real constraint moves to the foreground.' },
  responsibility_order_becomes_more_noticeable: { ru: 'Приходится яснее расставлять обязательства по порядку.', en: 'Commitments need a clearer order of priority.' },
  first_reaction_becomes_more_visible: { ru: 'Первая реакция заметнее окружающим и сильнее влияет на тон разговора.', en: 'The first reaction is more visible to others and shapes the tone more strongly.' },
  need_for_independence_becomes_more_noticeable: { ru: 'Желание действовать по-своему усиливается при жёстких правилах.', en: 'The wish to act independently grows under rigid rules.' },
  unclear_signal_requires_separation_from_fact: { ru: 'Неполный сигнал легко принять за подтверждённый факт.', en: 'An incomplete signal can easily be mistaken for a confirmed fact.' },
  control_pressure_becomes_more_noticeable: { ru: 'Попытки контролировать ход событий встречают больше сопротивления.', en: 'Attempts to control the course of events meet more resistance.' },
  self_presentation_context_becomes_more_noticeable: { ru: 'Сильнее заметно, как ты входишь в ситуацию и какое первое впечатление создаёшь.', en: 'How you enter a situation and the first impression you create become more visible.' },
  resource_choices_become_more_noticeable: { ru: 'Выбор между тратой, сохранением и обменом ресурсов становится конкретнее.', en: 'Choices between spending, preserving, and exchanging resources become more concrete.' },
  communication_or_learning_context_becomes_more_noticeable: { ru: 'Главные проявления идут через разговоры, сообщения, обучение или короткие поездки.', en: 'The main manifestations come through conversations, messages, learning, or short trips.' },
  home_context_becomes_more_noticeable: { ru: 'Главные проявления сосредоточены в быту, доме и вопросах общей опоры.', en: 'The main manifestations center on home, daily life, and shared foundations.' },
  creative_context_becomes_more_noticeable: { ru: 'Главные проявления заметны в творчестве, игре, удовольствии и личной инициативе.', en: 'The main manifestations appear in creativity, play, enjoyment, and personal initiative.' },
  routine_or_workload_context_becomes_more_noticeable: { ru: 'Главные проявления идут через расписание, нагрузку и порядок ежедневных дел.', en: 'The main manifestations come through schedules, workload, and daily routines.' },
  partnership_context_becomes_more_noticeable: { ru: 'Главные проявления заметны в договорённостях и взаимодействии один на один.', en: 'The main manifestations appear in agreements and one-to-one interactions.' },
  shared_resource_context_becomes_more_noticeable: { ru: 'Главные проявления касаются общих обязательств, доверия и распределения ресурсов.', en: 'The main manifestations concern shared commitments, trust, and resource allocation.' },
  study_or_travel_context_becomes_more_noticeable: { ru: 'Главные проявления идут через обучение, дальние планы и расширение кругозора.', en: 'The main manifestations come through study, longer-range plans, and a wider perspective.' },
  career_or_public_context_becomes_more_noticeable: { ru: 'Главные проявления заметны в работе, ответственности и публичной роли.', en: 'The main manifestations appear in work, responsibility, and public role.' },
  group_or_network_context_becomes_more_noticeable: { ru: 'Главные проявления идут через команду, друзей, сообщества и общие планы.', en: 'The main manifestations come through teams, friends, communities, and shared plans.' },
  rest_or_private_context_becomes_more_noticeable: { ru: 'Главные проявления заметны в уединении, отдыхе и незавершённых внутренних делах.', en: 'The main manifestations appear in private time, rest, and unfinished inner business.' },
  previous_step_returns_for_review: { ru: 'Старый шаг или решение возвращается на проверку.', en: 'An earlier step or decision returns for review.' },
  stalled_step_can_begin_to_move: { ru: 'То, что стояло на месте, получает возможность снова двигаться.', en: 'Something that had stalled gets a chance to move again.' },
  direction_is_not_yet_confirmed: { ru: 'Первые признаки перемены уже есть, но направление ещё не подтверждено.', en: 'Early signs of change are present, but the direction is not confirmed yet.' },
  new_priority_becomes_visible: { ru: 'Новый приоритет становится заметным и требует места в расписании.', en: 'A new priority becomes visible and needs room in the schedule.' },
  existing_development_reaches_a_visible_peak: { ru: 'Уже начатый процесс доходит до заметной точки проверки или результата.', en: 'An existing process reaches a visible point of review or result.' },
};

const RISKS: Record<ForecastRiskAtom, AtomLanguage> = {
  defending_a_priority_before_checking_the_facts: { ru: 'Главный риск — защищать выбранную цель до проверки фактов.', en: 'The main risk is defending a chosen priority before checking the facts.' },
  treating_a_temporary_reaction_as_a_final_position: { ru: 'Главный риск — принять временную реакцию за окончательное решение.', en: 'The main risk is treating a temporary reaction as a final decision.' },
  impulsive_reply_or_missed_detail: { ru: 'Главный риск — ответить импульсивно или пропустить важную деталь.', en: 'The main risk is an impulsive reply or a missed detail.' },
  agreeing_before_terms_are_clear: { ru: 'Главный риск — согласиться раньше, чем условия станут ясны.', en: 'The main risk is agreeing before the terms are clear.' },
  acting_before_sequence_and_limit_are_clear: { ru: 'Главный риск — действовать без понятной последовательности и границы.', en: 'The main risk is acting before the sequence and limit are clear.' },
  overestimating_scope_or_probability: { ru: 'Главный риск — переоценить масштаб или вероятность результата.', en: 'The main risk is overestimating the scale or probability of the result.' },
  ignoring_a_real_limit_or_commitment: { ru: 'Главный риск — проигнорировать реальное ограничение или обязательство.', en: 'The main risk is ignoring a real limit or commitment.' },
  reacting_before_reading_the_situation: { ru: 'Главный риск — отреагировать до того, как ситуация станет понятна.', en: 'The main risk is reacting before the situation is understood.' },
  breaking_a_working_structure_only_to_escape_pressure: { ru: 'Главный риск — сломать рабочую систему только ради выхода из давления.', en: 'The main risk is breaking a working structure only to escape pressure.' },
  treating_an_assumption_as_a_fact: { ru: 'Главный риск — выдать предположение за факт.', en: 'The main risk is treating an assumption as a fact.' },
  forcing_an_outcome_to_regain_control: { ru: 'Главный риск — форсировать результат, чтобы вернуть ощущение контроля.', en: 'The main risk is forcing an outcome to regain a sense of control.' },
  overestimating_ease: { ru: 'Главный риск — принять поддержку за гарантию лёгкого результата.', en: 'The main risk is mistaking support for a guarantee of an easy result.' },
  forcing_progress_during_a_review_phase: { ru: 'Главный риск — форсировать движение в фазе пересмотра.', en: 'The main risk is forcing progress during a review phase.' },
  resuming_before_the_final_check: { ru: 'Главный риск — продолжить движение до финальной проверки.', en: 'The main risk is resuming before the final check.' },
  assuming_direction_before_it_is_confirmed: { ru: 'Главный риск — решить, что направление уже определилось.', en: 'The main risk is assuming the direction is already settled.' },
  treating_context_as_a_guaranteed_event: { ru: 'Главный риск — превратить жизненный контекст в обещание конкретного события.', en: 'The main risk is turning a life context into a promise of a specific event.' },
  treating_a_short_cycle_as_a_permanent_conclusion: { ru: 'Главный риск — сделать постоянный вывод из короткого периода.', en: 'The main risk is making a permanent conclusion from a short cycle.' },
};

const ACTIONS: Record<ForecastActionAtom, AtomLanguage> = {
  name_one_priority_and_one_tradeoff: { ru: 'Назови один приоритет и одну цену этого выбора.', en: 'Name one priority and one trade-off.' },
  pause_before_answering_from_a_temporary_reaction: { ru: 'Перед ответом отдели первую реакцию от окончательной позиции.', en: 'Before replying, separate the first reaction from the final position.' },
  verify_wording_numbers_and_sequence: { ru: 'Проверь формулировку, цифры и порядок шагов.', en: 'Check the wording, numbers, and sequence.' },
  state_terms_and_boundaries_explicitly: { ru: 'Сформулируй условия и границы прямо.', en: 'State the terms and boundaries explicitly.' },
  choose_the_next_action_not_the_whole_battle: { ru: 'Выбери следующий конкретный шаг, а не всю битву сразу.', en: 'Choose the next concrete action, not the whole battle.' },
  test_scope_against_available_time_and_facts: { ru: 'Сверь масштаб плана с доступным временем и фактами.', en: 'Test the scale of the plan against available time and facts.' },
  separate_fixed_limits_from_negotiable_conditions: { ru: 'Отдели жёсткие ограничения от условий, которые можно обсудить.', en: 'Separate fixed limits from negotiable conditions.' },
  observe_the_first_reaction_before_acting_on_it: { ru: 'Заметь первую реакцию и только потом решай, стоит ли по ней действовать.', en: 'Notice the first reaction, then decide whether to act on it.' },
  change_one_constraint_at_a_time: { ru: 'Меняй по одному ограничению за раз.', en: 'Change one constraint at a time.' },
  separate_observation_from_interpretation: { ru: 'Отдели наблюдаемый факт от своей интерпретации.', en: 'Separate the observable fact from your interpretation.' },
  identify_what_can_and_cannot_be_controlled: { ru: 'Чётко раздели то, что можно контролировать, и то, что нельзя.', en: 'Separate clearly what can and cannot be controlled.' },
  use_support_for_one_specific_step: { ru: 'Используй поддержку для одного конкретного шага.', en: 'Use the support for one specific step.' },
  revisit_the_unresolved_step: { ru: 'Вернись к незавершённому шагу и проверь его заново.', en: 'Return to the unresolved step and review it.' },
  restart_only_after_a_final_check: { ru: 'Возобновляй движение только после финальной проверки.', en: 'Restart only after a final check.' },
  wait_for_direction_to_confirm: { ru: 'Не фиксируй вывод, пока направление не подтвердится.', en: 'Do not lock in a conclusion until the direction is confirmed.' },
  apply_the_factor_only_inside_the_reliable_context: { ru: 'Применяй этот вывод только к надёжно рассчитанному контексту.', en: 'Apply this conclusion only inside the reliably calculated context.' },
  observe_the_transition_before_committing: { ru: 'Сначала проследи переход, затем принимай обязательство.', en: 'Observe the transition before making a commitment.' },
  name_one_observable_priority_for_the_cycle: { ru: 'Назови один наблюдаемый приоритет этого цикла.', en: 'Name one observable priority for this cycle.' },
};

const DOMAIN_TITLES: Record<ForecastSemanticDomain, AtomLanguage> = {
  identity_priorities: { ru: 'Приоритеты', en: 'Priorities' },
  emotional_response: { ru: 'Реакции', en: 'Reactions' },
  communication_decisions: { ru: 'Разговоры и решения', en: 'Conversations and decisions' },
  values_agreements: { ru: 'Условия и ценности', en: 'Terms and values' },
  action_boundaries: { ru: 'Действия и границы', en: 'Action and boundaries' },
  growth_judgment: { ru: 'Масштаб и оценка', en: 'Scale and judgment' },
  responsibility_limits: { ru: 'Обязательства и пределы', en: 'Commitments and limits' },
  self_presentation: { ru: 'Первый шаг', en: 'The first move' },
  change_autonomy: { ru: 'Перемены и свобода', en: 'Change and autonomy' },
  imagination_clarity: { ru: 'Ясность', en: 'Clarity' },
  power_control: { ru: 'Контроль и влияние', en: 'Control and influence' },
  cycle_attention: { ru: 'Главный акцент периода', en: 'The period focus' },
};

const CONTEXT_TITLES: Record<ForecastLifeContext, AtomLanguage> = {
  self_presentation: { ru: 'Первое впечатление', en: 'First impression' },
  personal_resources: { ru: 'Деньги и личные ресурсы', en: 'Money and personal resources' },
  communication_learning: { ru: 'Общение и обучение', en: 'Communication and learning' },
  home_foundation: { ru: 'Дом и опора', en: 'Home and foundations' },
  creative_expression: { ru: 'Творчество и инициатива', en: 'Creativity and initiative' },
  work_routines: { ru: 'Работа и нагрузка', en: 'Work and workload' },
  partnerships: { ru: 'Договорённости', en: 'Agreements' },
  shared_resources: { ru: 'Общие обязательства', en: 'Shared commitments' },
  study_travel: { ru: 'Учёба и дальние планы', en: 'Study and long-range plans' },
  career_public_role: { ru: 'Работа и публичная роль', en: 'Work and public role' },
  groups_networks: { ru: 'Команда и общие планы', en: 'Teams and shared plans' },
  rest_private_life: { ru: 'Отдых и личное пространство', en: 'Rest and private time' },
};

export function forecastAtomText(
  role: 'lead' | 'detail' | 'risk' | 'action',
  atomId: string,
  language: ForecastWriterLanguage,
): string {
  if (role === 'lead') return CLAIMS[atomId as ForecastClaimAtom]?.[language] || '';
  if (role === 'detail') return MANIFESTATIONS[atomId as ForecastManifestationAtom]?.[language] || '';
  if (role === 'risk') return RISKS[atomId as ForecastRiskAtom]?.[language] || '';
  return ACTIONS[atomId as ForecastActionAtom]?.[language] || '';
}

export function forecastSemanticTitle(
  fact: ForecastSemanticFact,
  language: ForecastWriterLanguage,
): string {
  return (fact.lifeContext ? CONTEXT_TITLES[fact.lifeContext] : null)?.[language]
    || DOMAIN_TITLES[fact.domain][language];
}

export function forecastSemanticVisualTag(fact: ForecastSemanticFact): string {
  return fact.lifeContext || fact.domain;
}
