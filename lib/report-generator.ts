import type { FullReport, CardDataJson, NatalDataFlat } from '../types';

export function normalizeNatalData(raw: CardDataJson | any): NatalDataFlat {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Natal data is empty or invalid');
  }
  if (raw.data && typeof raw.data === 'object' && (raw.data.sun || raw.data.moon)) {
    return raw.data as NatalDataFlat;
  }
  if (raw.sun || raw.moon) {
    return raw as NatalDataFlat;
  }
  throw new Error('Natal data does not contain recognizable planet positions');
}

const SUN_PERSONALITY: Record<string, string> = {
  Aries: 'Your core identity is shaped by courage, initiative, and a pioneering spirit. You are driven to lead, to be first, and to forge new paths. Your life force burns with directness and an instinct for action.',
  Taurus: 'Your core identity is rooted in stability, sensuality, and a deep connection to the material world. You seek security and comfort, building your life with patience and determination. Your strength lies in steadfastness and the ability to endure.',
  Gemini: 'Your core identity thrives on intellectual stimulation, communication, and variety. You are naturally curious, adaptable, and quick-witted. Your life force is expressed through learning, connecting ideas, and engaging with the world around you.',
  Cancer: 'Your core identity is deeply connected to emotions, family, and the need to nurture. You are protective, intuitive, and sensitive to the emotional currents around you. Your strength lies in creating safe spaces and caring for those you love.',
  Leo: 'Your core identity radiates warmth, creativity, and a natural sense of authority. You are drawn to self-expression, recognition, and leading from the heart. Your life force shines brightest when you can be generous, creative, and authentic.',
  Virgo: 'Your core identity is expressed through analysis, service, and attention to detail. You are practical, discerning, and driven by a desire to improve and refine. Your strength lies in seeing what needs fixing and your dedication to helping others.',
  Libra: 'Your core identity seeks harmony, beauty, and balanced relationships. You are diplomatic, fair-minded, and attuned to the needs of others. Your life force is expressed through creating balance and fostering meaningful connections.',
  Scorpio: 'Your core identity is shaped by depth, intensity, and a drive for transformation. You are perceptive, resourceful, and unafraid of life\'s darker aspects. Your strength lies in seeing beneath surfaces and emerging renewed from challenges.',
  Sagittarius: 'Your core identity is driven by a quest for meaning, freedom, and expansion. You are optimistic, philosophical, and eager to explore both the physical world and the realm of ideas. Your life force thrives on adventure and the pursuit of truth.',
  Capricorn: 'Your core identity is built on ambition, discipline, and a deep sense of responsibility. You are strategic, patient, and determined to achieve lasting results. Your strength lies in climbing steadily toward your goals.',
  Aquarius: 'Your core identity is expressed through originality, humanitarian ideals, and independent thinking. You are innovative, progressive, and drawn to causes larger than yourself. Your life force thrives in community and in challenging the status quo.',
  Pisces: 'Your core identity is immersed in compassion, imagination, and spiritual sensitivity. You are empathetic, intuitive, and connected to the collective unconscious. Your strength lies in transcending boundaries and feeling the interconnectedness of all things.',
};

const ASC_PERSONALITY: Record<string, string> = {
  Aries: 'Others perceive you as bold, energetic, and direct. You approach new situations with confidence and a willingness to take the lead.',
  Taurus: 'You come across as calm, grounded, and reliable. People sense your steadiness and are drawn to your natural warmth and composure.',
  Gemini: 'You present yourself as quick, sociable, and intellectually engaging. Your natural curiosity and versatility make you an interesting conversationalist.',
  Cancer: 'You appear nurturing, approachable, and emotionally attuned. People feel cared for in your presence, and you create a sense of home wherever you go.',
  Leo: 'You radiate confidence, warmth, and charisma. People notice your presence immediately and are drawn to your natural authority and generosity.',
  Virgo: 'You come across as thoughtful, composed, and detail-oriented. Others appreciate your practical approach and quiet competence.',
  Libra: 'You present yourself as graceful, diplomatic, and aesthetically aware. People are drawn to your sense of fairness and your ability to make others feel valued.',
  Scorpio: 'You project intensity, depth, and magnetic presence. Others sense that there is far more to you beneath the surface, which creates both intrigue and respect.',
  Sagittarius: 'You appear optimistic, adventurous, and open-minded. People are drawn to your enthusiasm and your ability to find meaning and humor in any situation.',
  Capricorn: 'You come across as mature, composed, and capable. Others respect your seriousness and trust your ability to handle responsibility.',
  Aquarius: 'You present yourself as unique, independent, and progressive. People notice your originality and are drawn to your unconventional perspective.',
  Pisces: 'You appear gentle, empathetic, and somewhat ethereal. Others sense your sensitivity and artistic nature, and they feel emotionally understood in your presence.',
};

const MOON_EMOTIONS: Record<string, string> = {
  Aries: 'You process emotions quickly and intensely. When you feel something, you act on it immediately. You need independence in your emotional life and can become restless when things feel stagnant. Anger comes fast but passes equally quickly.',
  Taurus: 'Your emotional world is steady and deeply rooted. You need consistency, comfort, and sensory pleasure to feel safe. Change unsettles you, and you may hold on to feelings and attachments longer than necessary. When you feel secure, you are incredibly warm and loyal.',
  Gemini: 'You process emotions through thought and communication. Talking about your feelings helps you understand them. You may fluctuate between emotional states rapidly, and you need mental stimulation to feel emotionally engaged.',
  Cancer: 'Your emotional sensitivity is profound. You absorb the moods of those around you and need regular time to process and recharge. Home and family are central to your emotional well-being. You care deeply and protectively about those closest to you.',
  Leo: 'You experience emotions with dramatic intensity and generosity. You need to feel appreciated and seen for who you are. Your emotional life is tied to your creative self-expression, and you give love wholeheartedly when you feel valued.',
  Virgo: 'You process emotions through analysis and practical action. When stressed, you may focus on fixing details rather than sitting with your feelings. You show love through acts of service and care deeply about being useful to those around you.',
  Libra: 'You seek emotional balance and harmony in your relationships. Conflict disturbs you deeply, and you may compromise your own needs to maintain peace. You feel most emotionally fulfilled when your close relationships are harmonious and aesthetically beautiful.',
  Scorpio: 'Your emotional depth is extraordinary. You feel everything intensely and are drawn to emotional truth, even when it is painful. Trust is earned slowly, but once given, your loyalty is absolute. You have a powerful capacity for emotional transformation.',
  Sagittarius: 'You need freedom and optimism in your emotional life. You process feelings through movement, adventure, and philosophical reflection. You may avoid heavy emotional situations, preferring to find the silver lining and move forward.',
  Capricorn: 'You approach emotions with caution and self-discipline. You may suppress or delay processing feelings until you feel it is safe to do so. Beneath a controlled exterior lies deep sensitivity and a need for emotional security built on achievement and respect.',
  Aquarius: 'You process emotions through an intellectual lens. You value emotional independence and may feel uncomfortable with intense, unstructured feelings. You care deeply about humanity but may find one-on-one emotional intimacy challenging.',
  Pisces: 'Your emotional world is vast, fluid, and deeply intuitive. You absorb emotions from everyone around you and may struggle to distinguish your own feelings from those of others. You have extraordinary compassion and a natural connection to the unseen dimensions of life.',
};

const VENUS_RELATIONSHIPS: Record<string, string> = {
  Aries: 'In love you are passionate, direct, and enjoy the thrill of pursuit. You value independence in relationships and are attracted to people who are bold and straightforward.',
  Taurus: 'You love deeply, sensually, and with great loyalty. You value stability, physical affection, and shared pleasures. Once committed, you are devoted and expect the same in return.',
  Gemini: 'You are drawn to intellectual connection and stimulating conversation in relationships. You need variety, wit, and mental engagement from a partner. Flirtation and playfulness keep love alive for you.',
  Cancer: 'You love with profound tenderness and devotion. You seek emotional security and deep bonding in relationships. Nurturing and being nurtured is at the heart of how you express love.',
  Leo: 'You love generously, dramatically, and with great warmth. You need admiration and recognition from your partner. You are loyal and protective, and you bring creativity and joy to your relationships.',
  Virgo: 'You express love through practical devotion and attentive care. You notice the small things and show affection through acts of service. You seek a partner who values integrity, honesty, and thoughtful gestures.',
  Libra: 'You thrive in partnership and are naturally gifted at creating harmony in relationships. You value beauty, fairness, and mutual respect. You seek an equal partner with whom you can share an aesthetically and emotionally balanced life.',
  Scorpio: 'You love with intensity, depth, and total commitment. You seek soul-level connection and emotional honesty. Superficial relationships do not satisfy you — you need transformative, all-encompassing bonds.',
  Sagittarius: 'You value freedom, honesty, and shared adventure in love. You are drawn to partners who expand your horizons and share your philosophical interests. You need space to grow alongside your partner.',
  Capricorn: 'You approach love with seriousness and long-term commitment. You value reliability, ambition, and mutual respect. You show love through dedication and building something lasting together.',
  Aquarius: 'You value intellectual connection, friendship, and shared ideals in relationships. You need a partner who respects your independence and shares your vision for a better world. Unconventional relationships may suit you well.',
  Pisces: 'You love with deep compassion, romanticism, and spiritual connection. You seek a partner who understands your sensitivity and shares your imaginative world. You give selflessly in love, sometimes to your own detriment.',
};

const MARS_DRIVE: Record<string, string> = {
  Aries: 'You assert yourself directly and energetically. Competition fuels you, and you take decisive action when you want something.',
  Taurus: 'You pursue your desires with patience and persistence. You are not easily deterred and can be remarkably determined when motivated.',
  Gemini: 'You channel your energy through communication and intellectual pursuits. You can juggle multiple goals at once and use wit as your primary tool.',
  Cancer: 'You act on your instincts to protect and provide for those you love. Your drive is fueled by emotional connection and the desire to create security.',
  Leo: 'You pursue your goals with confidence, creativity, and a flair for the dramatic. You are motivated by recognition and the desire to leave a lasting impact.',
  Virgo: 'You channel your energy into meticulous, practical action. You are most effective when you have a clear plan and can refine your approach methodically.',
  Libra: 'You assert yourself through diplomacy and strategic partnership. You prefer to achieve your goals through collaboration rather than confrontation.',
  Scorpio: 'You pursue your desires with relentless focus and strategic intensity. You are resourceful, determined, and capable of extraordinary willpower.',
  Sagittarius: 'You channel your energy into expansion, exploration, and the pursuit of truth. You are motivated by freedom and the desire to push beyond limitations.',
  Capricorn: 'You pursue your goals with disciplined ambition and strategic planning. You are willing to work hard over long periods to achieve lasting success.',
  Aquarius: 'You direct your energy toward innovation and social change. You are motivated by ideals and the desire to create something truly original.',
  Pisces: 'You act on intuition and compassion. Your drive is fueled by imagination and a desire to contribute to something greater than yourself.',
};

const SATURN_CAREER: Record<string, string> = {
  Aries: 'Your professional growth comes through learning patience and disciplined initiative. You are challenged to balance impulsiveness with strategic long-term planning.',
  Taurus: 'Your career builds slowly but solidly. You excel when you can create lasting value and are challenged to avoid becoming too rigid in your approach to material security.',
  Gemini: 'Your professional development requires mastering focused communication and structured thinking. You grow by learning to commit to ideas deeply rather than skimming surfaces.',
  Cancer: 'Your career evolves through learning emotional boundaries while using your nurturing abilities professionally. Your challenge is balancing personal sensitivity with professional demands.',
  Leo: 'Your professional path requires you to balance confidence with humility. You grow by learning that true authority comes from responsibility, not just recognition.',
  Virgo: 'Your career is built on precision, competence, and continuous improvement. You may set impossibly high standards for yourself and must learn to accept imperfection.',
  Libra: 'Your professional growth comes through mastering fairness and strategic relationships. You are challenged to make difficult decisions without over-compromising.',
  Scorpio: 'Your career demands deep transformation and the ability to handle power responsibly. You grow by confronting fear and learning to trust the process of change.',
  Sagittarius: 'Your professional development requires focusing your expansive vision into concrete achievements. You are challenged to commit to a single direction and see it through.',
  Capricorn: 'You have a natural talent for structure and long-term achievement. Your career path is defined by ambition, but you must guard against workaholism and emotional isolation.',
  Aquarius: 'Your career grows through innovative thinking and working toward collective goals. You are challenged to balance radical ideas with practical implementation.',
  Pisces: 'Your professional path involves integrating imagination with discipline. You grow by learning to structure your creative and compassionate gifts into tangible contributions.',
};

const JUPITER_GROWTH: Record<string, string> = {
  Aries: 'Growth and opportunity come to you through bold initiative and independent ventures.',
  Taurus: 'Abundance flows through patience, practical investments, and building lasting value.',
  Gemini: 'Opportunities expand through learning, teaching, and making diverse intellectual connections.',
  Cancer: 'Growth comes through nurturing others, building emotional bonds, and creating family or community.',
  Leo: 'Abundance flows through creative self-expression, generosity, and leadership from the heart.',
  Virgo: 'Opportunities expand through service, skill development, and attention to health and wellbeing.',
  Libra: 'Growth comes through partnerships, artistic endeavors, and the pursuit of justice and harmony.',
  Scorpio: 'Abundance flows through deep research, transformative experiences, and uncovering hidden resources.',
  Sagittarius: 'Opportunities expand through travel, education, philosophy, and cross-cultural experiences.',
  Capricorn: 'Growth comes through disciplined effort, strategic planning, and building enduring structures.',
  Aquarius: 'Abundance flows through innovation, networking, humanitarian work, and unconventional approaches.',
  Pisces: 'Opportunities expand through compassion, spiritual practice, artistic vision, and selfless service.',
};

const ELEMENT_BALANCE: Record<string, string> = {
  Fire: 'Your chart is dominated by fire energy, giving you enthusiasm, confidence, and a natural drive to act. You are inspired, optimistic, and thrive when you can express yourself freely.',
  Earth: 'Your chart is grounded in earth energy, giving you practicality, persistence, and a strong connection to the material world. You value tangible results and build your life with care and patience.',
  Air: 'Your chart is dominated by air energy, giving you intellectual agility, social awareness, and a gift for communication. You thrive on ideas, connections, and understanding patterns in the world around you.',
  Water: 'Your chart is shaped by water energy, giving you emotional depth, intuitive sensitivity, and a strong inner life. You navigate the world through feelings and instinct, with a natural capacity for empathy.',
};

const NODE_KARMIC: Record<string, string> = {
  Aries: 'Your life direction points toward developing independence, courage, and self-reliance. You are moving away from excessive dependence on others and learning to trust your own instincts.',
  Taurus: 'Your soul is learning to build stability, value simplicity, and trust the material world. You are moving away from intensity and crisis toward peace and sustainable growth.',
  Gemini: 'Your path involves developing curiosity, communication skills, and intellectual flexibility. You are learning to gather diverse perspectives instead of clinging to a single belief system.',
  Cancer: 'Your soul direction points toward emotional vulnerability, nurturing, and creating deep personal bonds. You are learning to balance ambition with genuine emotional presence.',
  Leo: 'Your life path calls you toward creative self-expression, leadership, and wholehearted living. You are learning to step into the spotlight and own your unique gifts.',
  Virgo: 'Your direction involves developing practical skills, discernment, and a commitment to service. You are learning to be present in the details of daily life instead of escaping into dreams.',
  Libra: 'Your soul is learning partnership, diplomacy, and the art of relating. You are moving beyond self-reliance toward genuine collaboration and mutual support.',
  Scorpio: 'Your path involves developing emotional depth, intimacy, and the courage to transform. You are learning to move beyond comfort and security toward powerful, soul-level change.',
  Sagittarius: 'Your life direction points toward expansion, faith, and the search for higher truth. You are learning to see the big picture and trust in a broader sense of meaning.',
  Capricorn: 'Your soul path involves developing discipline, responsibility, and mastery. You are learning to build enduring structures and take on authority with integrity.',
  Aquarius: 'Your direction calls you toward community, innovation, and serving the collective good. You are learning to move beyond personal recognition toward contributing to something larger.',
  Pisces: 'Your life path leads toward compassion, spiritual growth, and surrender to a greater flow. You are learning to trust intuition and release the need for absolute control.',
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

export function generateFullReport(dataJson: CardDataJson): FullReport {
  const natal = normalizeNatalData(dataJson);

  const sunSign = natal.sun?.sign;
  const moonSign = natal.moon?.sign;
  const ascSign = natal.ascendant?.sign;
  const venusSign = natal.venus?.sign;
  const marsSign = natal.mars?.sign;
  const saturnSign = natal.saturn?.sign;
  const jupiterSign = natal.jupiter?.sign;
  const nodeSign = natal.north_node?.sign;
  const elementDominant = natal.element;

  if (!sunSign || !moonSign) {
    throw new Error('Insufficient natal data: Sun and Moon positions are required for Full Report');
  }

  // PERSONALITY
  const personalityParts: string[] = [];
  personalityParts.push(SUN_PERSONALITY[sunSign] || `Your Sun is in ${sunSign}, shaping your core identity.`);
  if (ascSign && ASC_PERSONALITY[ascSign]) {
    personalityParts.push(ASC_PERSONALITY[ascSign]);
  }
  if (elementDominant && ELEMENT_BALANCE[elementDominant]) {
    personalityParts.push(ELEMENT_BALANCE[elementDominant]);
  }
  const personality = personalityParts.join(' ');

  // EMOTIONS
  const emotionsParts: string[] = [];
  emotionsParts.push(MOON_EMOTIONS[moonSign] || `Your Moon is in ${moonSign}, shaping your emotional landscape.`);
  if (venusSign && VENUS_RELATIONSHIPS[venusSign]) {
    emotionsParts.push(`Your sense of beauty and what you value is also colored by your Venus placement: you find comfort in ${venusSign.toLowerCase()} qualities — ${getVenusEmotionalNote(venusSign)}.`);
  }
  const emotions = emotionsParts.join(' ');

  // RELATIONSHIPS
  const relationshipsParts: string[] = [];
  if (venusSign) {
    relationshipsParts.push(VENUS_RELATIONSHIPS[venusSign] || `Venus in ${venusSign} shapes your love style.`);
  }
  if (marsSign) {
    relationshipsParts.push(MARS_DRIVE[marsSign] || `Mars in ${marsSign} drives your assertiveness in partnerships.`);
  }
  if (!venusSign && !marsSign) {
    relationshipsParts.push(`Your relationship style is shaped by your ${sunSign} Sun and ${moonSign} Moon — combining ${sunSign.toLowerCase()} core identity with ${moonSign.toLowerCase()} emotional needs.`);
  }
  const relationships = relationshipsParts.join(' ');

  // CAREER
  const careerParts: string[] = [];
  if (saturnSign) {
    careerParts.push(SATURN_CAREER[saturnSign] || `Saturn in ${saturnSign} defines your professional development.`);
  }
  if (jupiterSign) {
    careerParts.push(JUPITER_GROWTH[jupiterSign] || `Jupiter in ${jupiterSign} expands your opportunities.`);
  }
  if (!saturnSign && !jupiterSign) {
    careerParts.push(`With a ${sunSign} Sun, your professional identity is rooted in ${sunSign.toLowerCase()} qualities. Your drive comes from the ${elementDominant || 'balanced'} energy that dominates your chart.`);
  }
  const career = careerParts.join(' ');

  // KARMIC VECTOR
  const karmicParts: string[] = [];
  if (nodeSign && NODE_KARMIC[nodeSign]) {
    karmicParts.push(NODE_KARMIC[nodeSign]);
    const southNodeSign = getOppositeSign(nodeSign);
    karmicParts.push(`Your past patterns (South Node in ${southNodeSign}) represent familiar territory — qualities you have already mastered. Your growth lies in embracing the new direction.`);
  } else if (saturnSign) {
    karmicParts.push(`Saturn in ${saturnSign} points to your key life lessons. ${SATURN_CAREER[saturnSign] || ''} This placement represents where you will achieve mastery through persistent effort and facing your limitations honestly.`);
  } else {
    karmicParts.push(`Your karmic direction is guided by your ${sunSign} Sun's journey toward authentic self-expression and the integration of your ${moonSign} Moon's emotional needs.`);
  }
  const karmic_vector = karmicParts.join(' ');

  // SUMMARY
  const summaryParts: string[] = [];
  summaryParts.push(`Your chart reveals a ${sunSign} Sun, ${moonSign} Moon${ascSign ? `, and ${ascSign} Rising` : ''} combination.`);
  if (elementDominant) {
    summaryParts.push(`With a ${elementDominant.toLowerCase()}-dominant chart, your fundamental approach to life is shaped by ${elementDominant.toLowerCase()} qualities.`);
  }
  summaryParts.push(`The key theme of your life is the integration of your ${sunSign.toLowerCase()} identity with your ${moonSign.toLowerCase()} emotional needs.`);
  if (ascSign && ascSign !== sunSign) {
    summaryParts.push(`Your ${ascSign} Rising adds a layer of ${ascSign.toLowerCase()} expression to how you meet the world, sometimes creating an interesting contrast with your inner ${sunSign.toLowerCase()} nature.`);
  }
  if (nodeSign) {
    summaryParts.push(`Your North Node in ${nodeSign} points to your ultimate direction of growth — the qualities you are here to develop in this lifetime.`);
  }
  const summary = summaryParts.join(' ');

  return {
    personality,
    emotions,
    relationships,
    career,
    karmic_vector,
    summary,
    generated_at: new Date().toISOString(),
  };
}

function getVenusEmotionalNote(sign: string): string {
  const notes: Record<string, string> = {
    Aries: 'passion, excitement, and spontaneity',
    Taurus: 'physical comfort, sensuality, and natural beauty',
    Gemini: 'mental stimulation, playful conversation, and variety',
    Cancer: 'emotional closeness, nostalgia, and domestic harmony',
    Leo: 'warmth, admiration, creative expression, and grand gestures',
    Virgo: 'thoughtful details, quiet devotion, and practical care',
    Libra: 'aesthetic beauty, harmony, and refined elegance',
    Scorpio: 'emotional intensity, depth, and transformative experiences',
    Sagittarius: 'freedom, adventure, and expansive experiences',
    Capricorn: 'stability, tradition, and enduring commitment',
    Aquarius: 'uniqueness, intellectual freedom, and progressive ideals',
    Pisces: 'romance, imagination, and spiritual connection',
  };
  return notes[sign] || 'unique expression';
}
