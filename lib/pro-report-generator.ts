import type { ProReport, ProReportPlanetBlock, ProReportAspectBlock, ProReportHouseBlock, CardDataJson, ExtendedPlanetPosition, AspectData, HouseData } from '../types';

const PLANET_IN_SIGN: Record<string, Record<string, string>> = {
  Sun: {
    Aries: 'Sun in Aries: cardinal fire. The native\'s identity is organized around self-assertion, initiative, and the need to pioneer. The solar principle operates through direct action, courage, and an instinctive drive to lead. Potential shadow: impulsiveness, impatience with others\' pace.',
    Taurus: 'Sun in Taurus: fixed earth. The identity consolidates around stability, material security, and sensory experience. The solar principle expresses through persistence, resourcefulness, and a deep connection to the physical world. Potential shadow: rigidity, possessiveness.',
    Gemini: 'Sun in Gemini: mutable air. The identity is organized around intellectual exploration, communication, and versatility. The solar principle operates through curiosity, adaptability, and the synthesis of diverse information. Potential shadow: superficiality, restlessness.',
    Cancer: 'Sun in Cancer: cardinal water. The identity is built around emotional security, nurturing, and protective instincts. The solar principle expresses through sensitivity, empathy, and the creation of safe emotional environments. Potential shadow: moodiness, over-protectiveness.',
    Leo: 'Sun in Leo: fixed fire. The solar principle is in domicile, expressing the core identity through creativity, generosity, and a natural sense of personal authority. The native radiates warmth and seeks authentic self-expression. Potential shadow: pride, need for constant validation.',
    Virgo: 'Sun in Virgo: mutable earth. The identity is organized around analysis, service, and continuous improvement. The solar principle operates through discernment, precision, and practical contribution. Potential shadow: over-criticism, perfectionism.',
    Libra: 'Sun in Libra: cardinal air. The identity is structured around relationship, balance, and aesthetic harmony. The solar principle expresses through diplomacy, fairness, and the creation of beautiful, balanced environments. Potential shadow: indecisiveness, dependency on others\' approval.',
    Scorpio: 'Sun in Scorpio: fixed water. The identity is forged through intensity, transformation, and psychological depth. The solar principle operates through penetrating awareness, emotional courage, and the capacity for renewal. Potential shadow: controlling tendencies, suspicion.',
    Sagittarius: 'Sun in Sagittarius: mutable fire. The identity is organized around expansion, meaning-making, and philosophical exploration. The solar principle expresses through optimism, vision, and the pursuit of truth. Potential shadow: overextension, dogmatism.',
    Capricorn: 'Sun in Capricorn: cardinal earth. The identity is structured around ambition, responsibility, and mastery through discipline. The solar principle operates through strategic planning, endurance, and the drive for tangible achievement. Potential shadow: emotional suppression, workaholism.',
    Aquarius: 'Sun in Aquarius: fixed air. The identity is organized around innovation, collective consciousness, and independent thinking. The solar principle expresses through originality, humanitarian concern, and the courage to be different. Potential shadow: emotional detachment, contrarianism.',
    Pisces: 'Sun in Pisces: mutable water. The identity dissolves boundaries to connect with universal consciousness. The solar principle operates through compassion, imagination, and spiritual sensitivity. Potential shadow: escapism, difficulty with practical boundaries.',
  },
  Moon: {
    Aries: 'Moon in Aries: emotional nature is impulsive, reactive, and instinctively independent. Emotional needs center on autonomy and immediate expression. Quick to anger but equally quick to release.',
    Taurus: 'Moon in Taurus (exalted): emotional nature is steady, sensual, and deeply rooted. Emotional security is derived from material stability and physical comfort. Strong attachment to routines and the familiar.',
    Gemini: 'Moon in Gemini: emotional processing occurs through verbalization and intellectual analysis. Emotional needs include mental stimulation and social variety. Feelings may shift rapidly between states.',
    Cancer: 'Moon in Cancer (domicile): emotional nature is deeply sensitive, nurturing, and highly responsive to environmental stimuli. Powerful emotional memory and instinctive protective drives. Strong connection to home and ancestry.',
    Leo: 'Moon in Leo: emotional needs center on recognition, creative expression, and being valued. The emotional nature is warm, generous, and dramatic. Deep need for loyalty and appreciation from close ones.',
    Virgo: 'Moon in Virgo: emotional processing is analytical and service-oriented. Emotional security derives from order, routine, and being useful. May intellectualize feelings rather than experiencing them directly.',
    Libra: 'Moon in Libra: emotional needs center on harmony, partnership, and aesthetic beauty. Emotional wellbeing is closely tied to the quality of relationships. Difficulty tolerating conflict or emotional ugliness.',
    Scorpio: 'Moon in Scorpio (fall): emotional nature is intensely deep, transformative, and psychologically perceptive. Emotional needs include genuine intimacy and emotional truth. Powerful instincts and difficulty with surface-level relating.',
    Sagittarius: 'Moon in Sagittarius: emotional nature is optimistic, restless, and philosophically inclined. Emotional needs include freedom, adventure, and meaning. May use humor or philosophy to avoid painful emotions.',
    Capricorn: 'Moon in Capricorn (detriment): emotional nature is cautious, disciplined, and controlled. Emotional security derives from achievement and structural stability. Feelings are often suppressed in favor of duty.',
    Aquarius: 'Moon in Aquarius: emotional processing is detached and intellectualized. Emotional needs include independence and connection to community or ideals. May experience difficulty with intimate emotional vulnerability.',
    Pisces: 'Moon in Pisces: emotional nature is porous, empathic, and deeply intuitive. Emotional boundaries are fluid, absorbing the feelings of the environment. Powerful imagination and connection to the collective emotional field.',
  },
  Mercury: {
    Aries: 'Mercury in Aries: thought processes are quick, direct, and competitive. Communication style is assertive and decisive. Mental energy is best applied to initiating ideas.',
    Taurus: 'Mercury in Taurus: thinking is deliberate, practical, and focused on tangible outcomes. Communication is grounded and methodical. Slow to form opinions but firm once decided.',
    Gemini: 'Mercury in Gemini (domicile): intellectual capacity is versatile, quick, and naturally curious. Superior verbal and written communication. The mind thrives on variety and multiple stimuli.',
    Cancer: 'Mercury in Cancer: thinking is influenced by emotions and intuition. Memory is strong, especially for emotional experiences. Communication is empathetic and protective.',
    Leo: 'Mercury in Leo: thinking is creative, confident, and dramatic. Communication aims to inspire and lead. Ideas are presented with flair and personal conviction.',
    Virgo: 'Mercury in Virgo (domicile and exalted): analytical capacity is exceptional. Thinking is precise, systematic, and detail-oriented. Communication is clear, practical, and often focused on improvement.',
    Libra: 'Mercury in Libra: thinking is balanced, diplomatic, and relationship-oriented. Communication seeks fairness and harmony. Excels at seeing multiple perspectives simultaneously.',
    Scorpio: 'Mercury in Scorpio: thinking is penetrating, investigative, and psychologically astute. Communication is strategic and intense. The mind naturally probes beneath surfaces.',
    Sagittarius: 'Mercury in Sagittarius (detriment): thinking is expansive, philosophical, and oriented toward big-picture understanding. Communication is enthusiastic but may lack precision.',
    Capricorn: 'Mercury in Capricorn: thinking is structured, strategic, and goal-oriented. Communication is authoritative and practical. Mental processes are disciplined and focused on long-term outcomes.',
    Aquarius: 'Mercury in Aquarius: thinking is innovative, unconventional, and systems-oriented. Communication is progressive and intellectually stimulating. The mind excels at pattern recognition and abstract reasoning.',
    Pisces: 'Mercury in Pisces (detriment and fall): thinking is intuitive, imaginative, and non-linear. Communication is poetic and empathetic. The mind operates through feeling and symbolic understanding.',
  },
  Venus: {
    Aries: 'Venus in Aries (detriment): relational style is passionate, direct, and competitive. Values independence in love. Attracted to boldness and initiative in partners.',
    Taurus: 'Venus in Taurus (domicile): relational style is sensual, loyal, and comfort-oriented. Values material beauty and physical affection. Deeply committed once attached.',
    Gemini: 'Venus in Gemini: relational style is intellectually stimulating, playful, and socially versatile. Values mental connection and variety. Communication is central to attraction.',
    Cancer: 'Venus in Cancer: relational style is nurturing, emotionally deep, and protective. Values emotional security and domestic harmony. Love is expressed through care and creating safe spaces.',
    Leo: 'Venus in Leo: relational style is generous, warm, and dramatically expressive. Values loyalty, admiration, and creative connection. Love is a grand performance of the heart.',
    Virgo: 'Venus in Virgo (fall): relational style is devotional, practical, and detail-attentive. Values acts of service and thoughtful gestures. May be overly critical in close relationships.',
    Libra: 'Venus in Libra (domicile): relational style is harmonious, aesthetically refined, and partnership-oriented. Values balance, beauty, and mutual respect. Natural talent for creating harmonious connections.',
    Scorpio: 'Venus in Scorpio (detriment): relational style is intense, transformative, and deeply committed. Values emotional truth and soul-level bonding. All-or-nothing approach to love.',
    Sagittarius: 'Venus in Sagittarius: relational style is adventurous, philosophical, and freedom-loving. Values shared exploration and intellectual growth. Needs space within partnership.',
    Capricorn: 'Venus in Capricorn: relational style is serious, loyal, and goal-oriented. Values commitment, tradition, and mutual ambition. Love is built through shared responsibility and time.',
    Aquarius: 'Venus in Aquarius: relational style is unconventional, intellectual, and community-oriented. Values friendship and shared ideals. May prefer non-traditional relationship structures.',
    Pisces: 'Venus in Pisces (exalted): relational style is compassionate, romantic, and spiritually attuned. Values transcendent love and emotional merging. Extraordinary capacity for unconditional love.',
  },
  Mars: {
    Aries: 'Mars in Aries (domicile): drive and assertion are direct, powerful, and instinctive. Energy is channeled through physical action and competitive pursuit. Strong initiating capacity.',
    Taurus: 'Mars in Taurus (detriment): drive is persistent, slow-building, and enduring. Energy is channeled through sustained effort and material productivity. Rarely provoked but immovable when angered.',
    Gemini: 'Mars in Gemini: drive is mentally oriented, versatile, and communicative. Energy is dispersed across multiple interests. Aggression is expressed verbally and intellectually.',
    Cancer: 'Mars in Cancer (fall): drive is emotionally motivated and protective. Energy fluctuates with mood. Actions are guided by emotional instinct and the need to defend family/home.',
    Leo: 'Mars in Leo: drive is creative, confident, and performance-oriented. Energy is channeled through self-expression and leadership. Strong need for recognition of one\'s efforts.',
    Virgo: 'Mars in Virgo: drive is precise, methodical, and service-oriented. Energy is channeled through detailed work and systematic improvement. Effective in analysis and problem-solving.',
    Libra: 'Mars in Libra (detriment): drive is expressed through partnership and diplomacy. Energy is channeled into creating fairness and resolving conflict. May struggle with direct assertion.',
    Scorpio: 'Mars in Scorpio (traditional domicile): drive is intense, strategic, and transformative. Energy is focused with laser-like precision. Extraordinary willpower and capacity for psychological endurance.',
    Sagittarius: 'Mars in Sagittarius: drive is expansive, adventurous, and idealistic. Energy is channeled through exploration, philosophy, and the pursuit of meaning. Bold and optimistic in action.',
    Capricorn: 'Mars in Capricorn (exalted): drive is disciplined, strategic, and achievement-oriented. Energy is channeled through structured ambition and patient execution. Superior at long-term planning.',
    Aquarius: 'Mars in Aquarius: drive is directed toward innovation, reform, and collective action. Energy is channeled through progressive ideals and intellectual rebellion. Independent in pursuit of goals.',
    Pisces: 'Mars in Pisces: drive is subtle, intuitive, and compassion-motivated. Energy flows in non-linear, inspired ways. Actions are guided by imagination and spiritual impulse.',
  },
  Jupiter: {
    Aries: 'Jupiter in Aries: expansion through bold initiative and independent action. Growth comes from courageous ventures and pioneering experiences.',
    Taurus: 'Jupiter in Taurus: expansion through material abundance and sensory experience. Growth comes from patience, practical wisdom, and building lasting value.',
    Gemini: 'Jupiter in Gemini (detriment): expansion through intellectual diversity and communication. Growth comes from learning, teaching, and connecting disparate ideas.',
    Cancer: 'Jupiter in Cancer (exalted): expansion through emotional generosity and nurturing. Growth comes from family, home, and deep emotional connections.',
    Leo: 'Jupiter in Leo: expansion through creative expression and generous leadership. Growth comes from confidence, self-expression, and inspiring others.',
    Virgo: 'Jupiter in Virgo (detriment): expansion through service, skill development, and practical improvement. Growth comes from mastery of craft and health awareness.',
    Libra: 'Jupiter in Libra: expansion through partnerships, artistic endeavors, and the pursuit of justice. Growth comes from collaboration and creating harmony.',
    Scorpio: 'Jupiter in Scorpio: expansion through transformation, research, and penetrating insight. Growth comes from deep psychological exploration and shared resources.',
    Sagittarius: 'Jupiter in Sagittarius (domicile): expansion through philosophy, travel, and higher education. Growth comes from exploring diverse cultures and belief systems.',
    Capricorn: 'Jupiter in Capricorn (fall): expansion through disciplined effort and institutional structures. Growth comes slowly but builds enduring foundations.',
    Aquarius: 'Jupiter in Aquarius: expansion through innovation, community, and humanitarian causes. Growth comes from progressive thinking and collective endeavors.',
    Pisces: 'Jupiter in Pisces (traditional domicile): expansion through spirituality, compassion, and artistic imagination. Growth comes from surrendering to a greater flow.',
  },
  Saturn: {
    Aries: 'Saturn in Aries (fall): lessons in patience, controlled assertion, and disciplined initiative. Challenge: balancing impulsiveness with strategic action.',
    Taurus: 'Saturn in Taurus: lessons in responsible resource management and detachment from material security. Challenge: building true value without hoarding.',
    Gemini: 'Saturn in Gemini: lessons in focused communication and disciplined thinking. Challenge: depth versus breadth in intellectual pursuits.',
    Cancer: 'Saturn in Cancer (detriment): lessons in emotional boundaries and responsible nurturing. Challenge: expressing emotions without fear of vulnerability.',
    Leo: 'Saturn in Leo (detriment): lessons in humble leadership and authentic self-expression. Challenge: finding confidence without depending on external validation.',
    Virgo: 'Saturn in Virgo: lessons in practical service without self-criticism. Challenge: accepting imperfection while maintaining high standards.',
    Libra: 'Saturn in Libra (exalted): lessons in mature partnership and objective fairness. Challenge: making difficult decisions while maintaining relational harmony.',
    Scorpio: 'Saturn in Scorpio: lessons in emotional control and responsible use of power. Challenge: facing deep fears and transforming them into strength.',
    Sagittarius: 'Saturn in Sagittarius: lessons in disciplined belief and grounded philosophy. Challenge: committing to a worldview while remaining open to new truth.',
    Capricorn: 'Saturn in Capricorn (domicile): lessons in responsible authority and enduring achievement. Challenge: balancing ambition with emotional needs and relationships.',
    Aquarius: 'Saturn in Aquarius (traditional domicile): lessons in structured innovation and responsible reform. Challenge: implementing progressive ideas within existing systems.',
    Pisces: 'Saturn in Pisces: lessons in grounding imagination and structuring spiritual experience. Challenge: maintaining practical boundaries while honoring inner vision.',
  },
  Uranus: {
    Aries: 'Uranus in Aries: generational drive toward radical individual liberation and revolutionary initiative.',
    Taurus: 'Uranus in Taurus: generational disruption of material values, financial systems, and relationship to the natural world.',
    Gemini: 'Uranus in Gemini: generational revolution in communication, information technology, and intellectual paradigms.',
    Cancer: 'Uranus in Cancer: generational transformation of family structures, home life, and emotional expression.',
    Leo: 'Uranus in Leo: generational revolution in creative expression, leadership models, and individual identity.',
    Virgo: 'Uranus in Virgo: generational innovation in health, work, and analytical methodology.',
    Libra: 'Uranus in Libra: generational transformation of relationship structures, marriage, and social justice.',
    Scorpio: 'Uranus in Scorpio: generational revolution in psychology, sexuality, and the handling of shared power.',
    Sagittarius: 'Uranus in Sagittarius: generational disruption of belief systems, education, and cross-cultural exchange.',
    Capricorn: 'Uranus in Capricorn: generational transformation of governmental and corporate structures and authority models.',
    Aquarius: 'Uranus in Aquarius (domicile): generational acceleration of technological innovation, social reform, and collective consciousness.',
    Pisces: 'Uranus in Pisces: generational revolution in spirituality, art, and the dissolution of outdated collective illusions.',
  },
  Neptune: {
    Aries: 'Neptune in Aries: collective idealization of individual heroism and pioneering vision.',
    Taurus: 'Neptune in Taurus: collective dreams around material beauty, natural harmony, and sensory transcendence.',
    Gemini: 'Neptune in Gemini: collective dissolution of communication boundaries and idealization of information.',
    Cancer: 'Neptune in Cancer: collective nostalgia, idealization of home and family, and emotional sensitivity at a societal level.',
    Leo: 'Neptune in Leo: collective glamorization of creativity, romance, and personal charisma.',
    Virgo: 'Neptune in Virgo: collective idealization of service, health, and analytical perfection.',
    Libra: 'Neptune in Libra: collective dreams of perfect partnership, peace, and aesthetic harmony.',
    Scorpio: 'Neptune in Scorpio: collective fascination with the occult, sexuality, and psychic transformation.',
    Sagittarius: 'Neptune in Sagittarius: collective spiritual seeking, religious evolution, and cross-cultural idealism.',
    Capricorn: 'Neptune in Capricorn: collective disillusionment with authority and the dissolving of rigid institutional structures.',
    Aquarius: 'Neptune in Aquarius: collective vision of digital connectivity, universal brotherhood, and technological transcendence.',
    Pisces: 'Neptune in Pisces (domicile): collective spiritual awakening, artistic renaissance, and dissolution of material boundaries.',
  },
  Pluto: {
    Aries: 'Pluto in Aries: generational transformation of individual identity and pioneering instincts at the deepest level.',
    Taurus: 'Pluto in Taurus: generational transformation of material values, economic systems, and relationship to Earth.',
    Gemini: 'Pluto in Gemini: generational transformation of communication, media, and intellectual paradigms.',
    Cancer: 'Pluto in Cancer: generational transformation of family dynamics, national identity, and emotional foundations.',
    Leo: 'Pluto in Leo: generational transformation of self-expression, authority, and creative power.',
    Virgo: 'Pluto in Virgo: generational transformation of work, health systems, and analytical frameworks.',
    Libra: 'Pluto in Libra: generational transformation of relationships, justice systems, and social contracts.',
    Scorpio: 'Pluto in Scorpio (domicile): generational transformation of psychology, death/rebirth cycles, and shared resources.',
    Sagittarius: 'Pluto in Sagittarius: generational transformation of belief systems, education, and cross-cultural relationships.',
    Capricorn: 'Pluto in Capricorn: generational transformation of government, corporate power, and social hierarchies.',
    Aquarius: 'Pluto in Aquarius: generational transformation of technology, collective structures, and humanitarian ideals.',
    Pisces: 'Pluto in Pisces: generational transformation of spirituality, collective unconscious, and creative/artistic paradigms.',
  },
};

const NODE_INTERPRETATION: Record<string, { north: string; south: string }> = {
  Aries: {
    north: 'North Node in Aries: evolutionary direction toward self-reliance, courageous initiative, and identity as a separate individual. The soul is developing the capacity for independent action.',
    south: 'South Node in Libra: karmic familiarity with compromise, diplomacy, and partnership. The comfort zone involves deferring to others; growth requires stepping into autonomous action.',
  },
  Taurus: {
    north: 'North Node in Taurus: evolutionary direction toward groundedness, self-sufficiency, and the development of personal values. The soul is learning to trust its own resources.',
    south: 'South Node in Scorpio: karmic familiarity with intensity, crisis, and shared power dynamics. Growth requires moving toward simplicity and stable self-worth.',
  },
  Gemini: {
    north: 'North Node in Gemini: evolutionary direction toward curiosity, communication, and gathering diverse perspectives. The soul is developing flexibility and the ability to listen.',
    south: 'South Node in Sagittarius: karmic familiarity with broad philosophical systems and the conviction of having the answers. Growth requires embracing questions over certainties.',
  },
  Cancer: {
    north: 'North Node in Cancer: evolutionary direction toward emotional vulnerability, nurturing, and building personal foundations. The soul is developing the capacity for intimate emotional presence.',
    south: 'South Node in Capricorn: karmic familiarity with achievement, authority, and emotional control. Growth requires allowing feelings to guide rather than ambition alone.',
  },
  Leo: {
    north: 'North Node in Leo: evolutionary direction toward creative self-expression, personal authority, and wholehearted engagement with life. The soul is developing courage to be seen.',
    south: 'South Node in Aquarius: karmic familiarity with detachment, group identity, and intellectual distance. Growth requires moving from the collective into personal creative risk.',
  },
  Virgo: {
    north: 'North Node in Virgo: evolutionary direction toward practical service, discernment, and mastery of daily life. The soul is developing precision and the ability to be truly useful.',
    south: 'South Node in Pisces: karmic familiarity with escapism, idealism, and boundary dissolution. Growth requires grounding spiritual awareness in practical action.',
  },
  Libra: {
    north: 'North Node in Libra: evolutionary direction toward partnership, diplomacy, and relational awareness. The soul is developing the capacity for genuine collaboration and compromise.',
    south: 'South Node in Aries: karmic familiarity with independence and self-assertion. Growth requires learning to consider others and build mutual relationships.',
  },
  Scorpio: {
    north: 'North Node in Scorpio: evolutionary direction toward emotional depth, intimacy, and transformative power. The soul is developing the courage to merge deeply and face shadow material.',
    south: 'South Node in Taurus: karmic familiarity with material comfort and routine stability. Growth requires moving beyond the comfort zone into transformative emotional territory.',
  },
  Sagittarius: {
    north: 'North Node in Sagittarius: evolutionary direction toward faith, higher meaning, and expansion of worldview. The soul is developing a personal philosophy and the courage to teach.',
    south: 'South Node in Gemini: karmic familiarity with data-gathering and intellectual restlessness. Growth requires integrating information into wisdom and committing to a vision.',
  },
  Capricorn: {
    north: 'North Node in Capricorn: evolutionary direction toward authority, responsibility, and mastery through discipline. The soul is developing the capacity for mature leadership.',
    south: 'South Node in Cancer: karmic familiarity with emotional dependency and safety-seeking. Growth requires stepping into public responsibility and emotional self-reliance.',
  },
  Aquarius: {
    north: 'North Node in Aquarius: evolutionary direction toward collective service, innovation, and detachment from personal ego. The soul is developing the capacity to serve the greater good.',
    south: 'South Node in Leo: karmic familiarity with personal recognition and creative self-centeredness. Growth requires channeling personal gifts toward collective benefit.',
  },
  Pisces: {
    north: 'North Node in Pisces: evolutionary direction toward spiritual surrender, compassion, and transcendence of material attachment. The soul is developing trust in the unseen.',
    south: 'South Node in Virgo: karmic familiarity with analysis, control, and material perfectionism. Growth requires releasing the need to fix everything and trusting the flow of life.',
  },
};

const LILITH_INTERPRETATION: Record<string, string> = {
  Aries: 'Black Moon Lilith in Aries: suppressed rage and the shadow of self-assertion. The native must integrate primal anger and the right to exist independently without guilt or apology.',
  Taurus: 'Black Moon Lilith in Taurus: shadow around possessions, body, and sensual pleasure. The native must confront shame around material desire and bodily needs.',
  Gemini: 'Black Moon Lilith in Gemini: shadow in communication and intellectual expression. The native must integrate the fear of speaking difficult truths and reclaim their authentic voice.',
  Cancer: 'Black Moon Lilith in Cancer: shadow around nurturing, mothering, and emotional vulnerability. The native must confront distorted patterns in caregiving and receiving.',
  Leo: 'Black Moon Lilith in Leo: shadow around creative expression and the need for recognition. The native must reclaim their right to be seen without shame or performance anxiety.',
  Virgo: 'Black Moon Lilith in Virgo: shadow around perfectionism, body shame, and service. The native must integrate the parts of themselves they have tried to purify away.',
  Libra: 'Black Moon Lilith in Libra: shadow in relationships and the need for approval. The native must confront co-dependency patterns and reclaim their power within partnerships.',
  Scorpio: 'Black Moon Lilith in Scorpio: shadow around power, sexuality, and transformation. The native must face their deepest fears of betrayal and loss to reclaim authentic intimacy.',
  Sagittarius: 'Black Moon Lilith in Sagittarius: shadow around belief systems and the search for truth. The native must confront spiritual bypassing and intellectual arrogance.',
  Capricorn: 'Black Moon Lilith in Capricorn: shadow around authority, control, and ambition. The native must face the fear of failure and the misuse of power.',
  Aquarius: 'Black Moon Lilith in Aquarius: shadow around belonging and individuality. The native must integrate the fear of rejection for being different and reclaim their authentic uniqueness.',
  Pisces: 'Black Moon Lilith in Pisces: shadow around victimhood, addiction, and spiritual illusion. The native must distinguish between true compassion and self-destructive martyrdom.',
};

const CHIRON_INTERPRETATION: Record<string, string> = {
  Aries: 'Chiron in Aries: the core wound relates to identity and the right to exist. Healing comes through developing courage to assert one\'s individuality despite fear of rejection.',
  Taurus: 'Chiron in Taurus: the core wound relates to self-worth and material security. Healing comes through developing an internal sense of value independent of possessions or external validation.',
  Gemini: 'Chiron in Gemini: the core wound relates to communication and being heard. Healing comes through finding one\'s authentic voice and trusting that one\'s ideas have value.',
  Cancer: 'Chiron in Cancer: the core wound relates to belonging, home, and maternal nurturing. Healing comes through creating internal emotional safety and learning to mother oneself.',
  Leo: 'Chiron in Leo: the core wound relates to creative expression and being seen. Healing comes through allowing vulnerability in self-expression and reclaiming joy without performance.',
  Virgo: 'Chiron in Virgo: the core wound relates to inadequacy and the fear of imperfection. Healing comes through accepting human limitations and finding wholeness beyond perfection.',
  Libra: 'Chiron in Libra: the core wound relates to relationships and the fear of being alone. Healing comes through developing inner balance and not losing oneself in partnership.',
  Scorpio: 'Chiron in Scorpio: the core wound relates to trust, intimacy, and the fear of betrayal. Healing comes through developing the courage for emotional transparency and deep vulnerability.',
  Sagittarius: 'Chiron in Sagittarius: the core wound relates to meaning, faith, and the fear of meaninglessness. Healing comes through developing a personal philosophy tested by real experience.',
  Capricorn: 'Chiron in Capricorn: the core wound relates to authority, competence, and the fear of failure. Healing comes through separating self-worth from achievement and embracing process over outcome.',
  Aquarius: 'Chiron in Aquarius: the core wound relates to belonging and the fear of alienation. Healing comes through embracing one\'s unique contribution to the collective without needing to conform.',
  Pisces: 'Chiron in Pisces: the core wound relates to spiritual connection and the fear of dissolution. Healing comes through grounding spiritual sensitivity in compassionate, embodied practice.',
};

const HOUSE_INTERPRETATION: Record<number, string> = {
  1: 'The 1st house cusp (Ascendant) defines the persona, physical body, and approach to new beginnings.',
  2: 'The 2nd house governs personal resources, self-worth, material possessions, and the development of values.',
  3: 'The 3rd house rules communication, short journeys, siblings, and the immediate intellectual environment.',
  4: 'The 4th house (IC) represents roots, home, family of origin, psychological foundations, and private emotional life.',
  5: 'The 5th house governs creativity, romance, children, play, and self-expression from the heart.',
  6: 'The 6th house rules daily work, health routines, service to others, and the refinement of skills.',
  7: 'The 7th house (Descendant) represents partnerships, marriage, open enemies, and the qualities projected onto others.',
  8: 'The 8th house governs shared resources, intimacy, transformation, death/rebirth processes, and psychological depth.',
  9: 'The 9th house rules higher education, philosophy, long-distance travel, and the search for meaning.',
  10: 'The 10th house (MC/Midheaven) represents career, public reputation, authority, and the legacy one builds.',
  11: 'The 11th house governs friendships, groups, collective goals, and hopes for the future.',
  12: 'The 12th house rules the unconscious, spiritual life, hidden enemies, self-undoing, and transcendence.',
};

const ASPECT_INTERPRETATION: Record<string, string> = {
  conjunction: 'Conjunction (0°): the energies of these planets are fused and intensified. They operate as a single combined force, for better or worse, amplifying each other.',
  sextile: 'Sextile (60°): a harmonious aspect of opportunity. These planets support each other through compatible elements, creating talent that activates through conscious effort.',
  square: 'Square (90°): a dynamic tension aspect that generates friction and motivation. These planets challenge each other, creating internal conflict that drives growth through action.',
  trine: 'Trine (120°): a flowing harmonious aspect indicating natural talent and ease. These planets support each other effortlessly through shared elemental affinity.',
  opposition: 'Opposition (180°): a polarity aspect creating awareness through contrast. These planets pull in opposite directions, requiring integration and balance between competing needs.',
};

function getOppositeSign(sign: string): string {
  const opposites: Record<string, string> = {
    Aries: 'Libra', Taurus: 'Scorpio', Gemini: 'Sagittarius',
    Cancer: 'Capricorn', Leo: 'Aquarius', Virgo: 'Pisces',
    Libra: 'Aries', Scorpio: 'Taurus', Sagittarius: 'Gemini',
    Capricorn: 'Cancer', Aquarius: 'Leo', Pisces: 'Virgo',
  };
  return opposites[sign] || sign;
}

function buildPlanetBlocks(dataJson: CardDataJson): ProReportPlanetBlock[] {
  const blocks: ProReportPlanetBlock[] = [];
  const planetKeys: Array<{ key: keyof CardDataJson; name: string }> = [
    { key: 'sun', name: 'Sun' },
    { key: 'moon', name: 'Moon' },
    { key: 'mercury', name: 'Mercury' },
    { key: 'venus', name: 'Venus' },
    { key: 'mars', name: 'Mars' },
    { key: 'jupiter', name: 'Jupiter' },
    { key: 'saturn', name: 'Saturn' },
    { key: 'uranus', name: 'Uranus' },
    { key: 'neptune', name: 'Neptune' },
    { key: 'pluto', name: 'Pluto' },
  ];

  for (const { key, name } of planetKeys) {
    const planet = dataJson[key] as ExtendedPlanetPosition | undefined;
    if (!planet || !planet.sign) continue;

    const interp = PLANET_IN_SIGN[name]?.[planet.sign] || `${name} in ${planet.sign}: position recorded at ${planet.degree?.toFixed(2) || 0}°.`;

    blocks.push({
      planet: name,
      sign: planet.sign,
      degree: planet.degree ?? 0,
      house: planet.house,
      retrograde: planet.retrograde ?? false,
      interpretation: planet.retrograde
        ? `${interp} [Retrograde: the ${name.toLowerCase()} principle is internalized, requiring more introspection and review before external expression.]`
        : interp,
    });
  }

  return blocks;
}

function buildHouseBlocks(dataJson: CardDataJson): ProReportHouseBlock[] {
  if (!dataJson.houses || !Array.isArray(dataJson.houses) || dataJson.houses.length === 0) {
    return [];
  }

  return dataJson.houses.map((h: HouseData) => ({
    house: h.house,
    sign: h.sign,
    degree: h.degree,
    interpretation: `${HOUSE_INTERPRETATION[h.house] || `House ${h.house}.`} With ${h.sign} on the cusp, this life area is approached through the lens of ${h.sign.toLowerCase()} qualities.`,
  }));
}

function buildAspectBlocks(dataJson: CardDataJson): ProReportAspectBlock[] {
  if (!dataJson.aspects || !Array.isArray(dataJson.aspects) || dataJson.aspects.length === 0) {
    return [];
  }

  return dataJson.aspects.map((a: AspectData) => ({
    planet1: a.planet1,
    planet2: a.planet2,
    aspect: a.aspect,
    angle: a.angle,
    orb: a.orb,
    interpretation: `${a.planet1}–${a.planet2} ${a.aspect} (${a.angle.toFixed(1)}°, orb ${a.orb.toFixed(1)}°). ${ASPECT_INTERPRETATION[a.aspect] || ''}`,
  }));
}

function buildConfiguration(dataJson: CardDataJson): string {
  const parts: string[] = [];

  const sunSign = dataJson.sun?.sign;
  const moonSign = dataJson.moon?.sign;
  const ascSign = dataJson.ascendant?.sign;

  if (sunSign && moonSign && ascSign) {
    parts.push(`Core configuration: ${sunSign} Sun / ${moonSign} Moon / ${ascSign} Rising.`);
  }

  if (dataJson.element) {
    parts.push(`Dominant element: ${dataJson.element}.`);
  }

  const retroPlanets = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']
    .filter(k => {
      const p = dataJson[k] as ExtendedPlanetPosition | undefined;
      return p?.retrograde === true;
    })
    .map(k => {
      const p = dataJson[k] as ExtendedPlanetPosition;
      return p.planet || k.charAt(0).toUpperCase() + k.slice(1);
    });

  if (retroPlanets.length > 0) {
    parts.push(`Retrograde planets: ${retroPlanets.join(', ')}. Retrograde placements indicate areas where the energy is directed inward, requiring introspection before external expression.`);
  }

  if (dataJson.aspects && dataJson.aspects.length > 0) {
    const squares = dataJson.aspects.filter(a => a.aspect === 'square').length;
    const trines = dataJson.aspects.filter(a => a.aspect === 'trine').length;
    const oppositions = dataJson.aspects.filter(a => a.aspect === 'opposition').length;
    const conjunctions = dataJson.aspects.filter(a => a.aspect === 'conjunction').length;
    parts.push(`Aspect count: ${conjunctions} conjunction(s), ${trines} trine(s), ${squares} square(s), ${oppositions} opposition(s). Total: ${dataJson.aspects.length} aspects.`);
  }

  return parts.join(' ');
}

function buildDominantPatterns(dataJson: CardDataJson): string {
  const parts: string[] = [];
  const elementCounts: Record<string, number> = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
  const modalityCounts: Record<string, number> = { Cardinal: 0, Fixed: 0, Mutable: 0 };

  const signElement: Record<string, string> = {
    Aries: 'Fire', Taurus: 'Earth', Gemini: 'Air', Cancer: 'Water',
    Leo: 'Fire', Virgo: 'Earth', Libra: 'Air', Scorpio: 'Water',
    Sagittarius: 'Fire', Capricorn: 'Earth', Aquarius: 'Air', Pisces: 'Water',
  };
  const signModality: Record<string, string> = {
    Aries: 'Cardinal', Taurus: 'Fixed', Gemini: 'Mutable', Cancer: 'Cardinal',
    Leo: 'Fixed', Virgo: 'Mutable', Libra: 'Cardinal', Scorpio: 'Fixed',
    Sagittarius: 'Mutable', Capricorn: 'Cardinal', Aquarius: 'Fixed', Pisces: 'Mutable',
  };

  const personalPlanets = ['sun', 'moon', 'mercury', 'venus', 'mars'];
  for (const key of personalPlanets) {
    const p = dataJson[key] as ExtendedPlanetPosition | undefined;
    if (p?.sign) {
      const el = signElement[p.sign];
      const mod = signModality[p.sign];
      if (el) elementCounts[el]++;
      if (mod) modalityCounts[mod]++;
    }
  }
  if (dataJson.ascendant?.sign) {
    const el = signElement[dataJson.ascendant.sign];
    const mod = signModality[dataJson.ascendant.sign];
    if (el) elementCounts[el]++;
    if (mod) modalityCounts[mod]++;
  }

  const dominantElement = Object.entries(elementCounts).sort((a, b) => b[1] - a[1]);
  const dominantModality = Object.entries(modalityCounts).sort((a, b) => b[1] - a[1]);

  if (dominantElement.length > 0 && dominantElement[0][1] > 0) {
    const top = dominantElement[0];
    const weak = dominantElement[dominantElement.length - 1];
    parts.push(`Element distribution in personal planets: dominant ${top[0]} (${top[1]} placements). ${weak[1] === 0 ? `Absent element: ${weak[0]} — this absence may manifest as a compensatory drive or blind spot in ${weak[0].toLowerCase()}-related areas.` : ''}`);
  }

  if (dominantModality.length > 0 && dominantModality[0][1] > 0) {
    const top = dominantModality[0];
    parts.push(`Modality emphasis: ${top[0]} (${top[1]} placements), indicating ${top[0] === 'Cardinal' ? 'a proactive, initiating approach' : top[0] === 'Fixed' ? 'a persistent, consolidating approach' : 'an adaptive, flexible approach'} to life challenges.`);
  }

  return parts.join(' ');
}

function buildKarmicThemes(dataJson: CardDataJson): string {
  const parts: string[] = [];

  if (dataJson.north_node?.sign) {
    const sign = dataJson.north_node.sign;
    const nodeData = NODE_INTERPRETATION[sign];
    if (nodeData) {
      parts.push(nodeData.north);
      parts.push(nodeData.south);
    }
  }

  if (dataJson.chiron?.sign) {
    const chiron = CHIRON_INTERPRETATION[dataJson.chiron.sign];
    if (chiron) {
      parts.push(chiron);
    }
  }

  if (dataJson.saturn?.sign) {
    const saturnInterp = PLANET_IN_SIGN.Saturn?.[dataJson.saturn.sign];
    if (saturnInterp) {
      parts.push(`Saturn karmic lesson: ${saturnInterp}`);
    }
  }

  if (parts.length === 0) {
    parts.push('Karmic data (nodes, chiron) not available for this chart. Saturn placement may serve as the primary karmic indicator.');
  }

  return parts.join(' ');
}

export function generateProReport(dataJson: CardDataJson): ProReport {
  if (!dataJson.sun?.sign || !dataJson.moon?.sign) {
    throw new Error('Insufficient natal data: Sun and Moon positions are required for Pro Report');
  }

  const planets = buildPlanetBlocks(dataJson);
  const houses = buildHouseBlocks(dataJson);
  const aspects = buildAspectBlocks(dataJson);

  let northNodeBlock: { sign: string; degree: number; interpretation: string } | null = null;
  let southNodeBlock: { sign: string; degree: number; interpretation: string } | null = null;

  if (dataJson.north_node?.sign) {
    const sign = dataJson.north_node.sign;
    const oppositeSign = getOppositeSign(sign);
    const nodeData = NODE_INTERPRETATION[sign];
    northNodeBlock = {
      sign,
      degree: dataJson.north_node.degree ?? 0,
      interpretation: nodeData?.north || `North Node in ${sign}.`,
    };
    southNodeBlock = {
      sign: oppositeSign,
      degree: dataJson.north_node.degree ?? 0,
      interpretation: nodeData?.south || `South Node in ${oppositeSign}.`,
    };
  }

  let lilithBlock: { sign: string; degree: number; interpretation: string } | null = null;
  if (dataJson.lilith?.sign) {
    lilithBlock = {
      sign: dataJson.lilith.sign,
      degree: dataJson.lilith.degree ?? 0,
      interpretation: LILITH_INTERPRETATION[dataJson.lilith.sign] || `Black Moon Lilith in ${dataJson.lilith.sign}.`,
    };
  }

  let chironBlock: { sign: string; degree: number; interpretation: string } | null = null;
  if (dataJson.chiron?.sign) {
    chironBlock = {
      sign: dataJson.chiron.sign,
      degree: dataJson.chiron.degree ?? 0,
      interpretation: CHIRON_INTERPRETATION[dataJson.chiron.sign] || `Chiron in ${dataJson.chiron.sign}.`,
    };
  }

  return {
    planets,
    houses,
    aspects,
    nodes: {
      north_node: northNodeBlock,
      south_node: southNodeBlock,
    },
    lilith: lilithBlock,
    chiron: chironBlock,
    interpretation_blocks: {
      configuration: buildConfiguration(dataJson),
      dominant_patterns: buildDominantPatterns(dataJson),
      karmic_themes: buildKarmicThemes(dataJson),
    },
    generated_at: new Date().toISOString(),
  };
}
