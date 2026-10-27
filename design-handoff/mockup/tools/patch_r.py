"""Patch R: the natal wheel is tappable (planets, houses, signs, ASC and MC, aspects in the
centre), «Карта в цифрах» rows open the same cards, and the reference guide opens every
row, with a new «Точки» tab. Every replacement must match exactly once."""
import sys

path = sys.argv[1]
s = open(path, encoding='utf-8').read()


def r(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        raise SystemExit('expected %d match(es), found %d for: %r' % (count, n, old[:90]))
    s = s.replace(old, new)


# ------------------------------------------------------------------ wheel markup
r('<sc-for list="{{ wheel.cusps }}" as="cu" hint-placeholder-count="12"><line x1="{{ cu.x1 }}" y1="{{ cu.y1 }}" x2="{{ cu.x2 }}" y2="{{ cu.y2 }}" stroke="{{ cu.color }}" stroke-width="{{ cu.w }}" stroke-dasharray="{{ cu.dash }}"></line></sc-for>\n'
  '<circle cx="175" cy="175" r="74" fill="{{ c.page }}" stroke="{{ c.sep2 }}" stroke-width="1"></circle>\n',
  '<circle cx="175" cy="175" r="74" fill="{{ c.page }}" stroke="{{ c.sep2 }}" stroke-width="1"></circle>\n'
  '<circle cx="175" cy="175" r="58" fill="none" stroke="{{ c.sep }}" stroke-width="1"></circle>\n'
  '<sc-for list="{{ wheel.cusps }}" as="cu" hint-placeholder-count="12"><line x1="{{ cu.x1 }}" y1="{{ cu.y1 }}" x2="{{ cu.x2 }}" y2="{{ cu.y2 }}" stroke="{{ cu.color }}" stroke-width="{{ cu.w }}" stroke-dasharray="{{ cu.dash }}"></line></sc-for>\n')
r('<text x="10" y="168" font-size="10" font-weight="700" fill="{{ c.accent }}" font-family="Onest">ASC</text>\n'
  '<text x="246" y="40" font-size="10" font-weight="700" fill="{{ c.accent }}" font-family="Onest">MC</text>\n'
  '</svg>\n'
  '</div>\n',
  '</svg>\n'
  '<sc-for list="{{ wheel.houseNums }}" as="hn" hint-placeholder-count="12"><span style="position: absolute; left: {{ hn.x }}; top: {{ hn.y }}; width: 18px; height: 14px; margin: -7px 0 0 -9px; font-size: 9.5px; line-height: 14px; font-weight: 600; text-align: center; color: {{ c.label3 }}; font-variant-numeric: tabular-nums; pointer-events: none">{{ hn.n }}</span></sc-for>\n'
  '<sc-for list="{{ wheel.axes }}" as="wx" hint-placeholder-count="2"><span style="position: absolute; left: {{ wx.x }}; top: {{ wx.y }}; transform: translate(-50%,-50%); padding: 1px 5px; border-radius: 6px; background: {{ c.accentSoft }}; color: {{ c.accent }}; font-size: 9.5px; line-height: 13px; font-weight: 700; letter-spacing: 0.02em; pointer-events: none">{{ wx.t }}</span></sc-for>\n'
  '<button type="button" onClick="{{ wheelTap }}" aria-label="Натальная карта: нажми на планету, дом или знак" style="position: absolute; inset: 0; padding: 0; border: 0; border-radius: 50%; background: transparent; cursor: pointer; -webkit-tap-highlight-color: transparent"></button>\n'
  '</div>\n'
  '<span style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 8px; font-size: 13px; color: {{ c.label3 }}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11.5V5a1.5 1.5 0 0 1 3 0v5.5M12 9.5a1.5 1.5 0 0 1 3 0v2M15 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.6a5 5 0 0 1-4.2-2.3L5 15.4a1.5 1.5 0 0 1 2.4-1.8L9 15.5"></path></svg>Нажми на планету, дом или знак</span>\n')

# «Карта в цифрах»: every row opens its card; Ascendant and MC join the list
r('<sc-for list="{{ positions }}" as="ps" hint-placeholder-count="10"><div style="display: grid; grid-template-columns: 24px 1fr 1fr 62px 46px; align-items: center; gap: 10px; padding: 10px 16px; border-top: {{ ps.border }}; font-size: 14.5px; font-variant-numeric: tabular-nums"><img src="{{ ps.img }}" alt="" style="width: 22px; height: 22px; object-fit: contain"><span style="font-weight: 600">{{ ps.planet }}</span><span style="color: {{ c.label2 }}">{{ ps.sign }}</span><span style="color: {{ c.label2 }}">{{ ps.deg }}</span><span style="text-align: right; color: {{ c.label3 }}">{{ ps.house }}</span></div></sc-for>',
  '<sc-for list="{{ positions }}" as="ps" hint-placeholder-count="12"><button type="button" onClick="{{ ps.open }}" style="display: grid; width: 100%; grid-template-columns: 24px 1.15fr 1fr 56px 24px 12px; align-items: center; gap: 10px; padding: 10px 16px; border: 0; border-top: {{ ps.border }}; background: none; font: inherit; font-size: 14.5px; font-variant-numeric: tabular-nums; text-align: left; color: {{ c.label }}; cursor: pointer"><sc-if value="{{ ps.hasImg }}" hint-placeholder-val="{{ true }}"><img src="{{ ps.img }}" alt="" style="width: 22px; height: 22px; object-fit: contain"></sc-if><sc-if value="{{ ps.hasBadge }}" hint-placeholder-val="{{ false }}"><span style="display: inline-flex; width: 24px; height: 18px; align-items: center; justify-content: center; border-radius: 6px; background: {{ c.accentSoft }}; color: {{ c.accent }}; font-size: 9px; font-weight: 700">{{ ps.badge }}</span></sc-if><span style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{ ps.planet }}</span><span style="color: {{ c.label2 }}">{{ ps.sign }}</span><span style="color: {{ c.label2 }}">{{ ps.deg }}</span><span style="text-align: right; color: {{ c.label3 }}">{{ ps.house }}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="{{ c.label3 }}" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="{{ ic.chevR }}"></path></svg></button></sc-for>')
r('Справочник: что значат планеты, дома и аспекты</span>', 'Справочник: планеты, знаки, дома, аспекты и точки</span>')

# guide search hint names the new tab
r('<path d="{{ ic.search }}"></path></svg>Планета, знак, дом или аспект</div>', '<path d="{{ ic.search }}"></path></svg>Планета, знак, дом, аспект или точка</div>')

# ------------------------------------------------------------------ wheel data
r("const cusps = CUSPS.map((lon, i) => { const a = xy(lon, 74), b = xy(lon, 140);",
  "const cusps = CUSPS.map((lon, i) => { const a = xy(lon, 58), b = xy(lon, 140);")
r("const p = xy(NAT[i][1], 72), q = xy(NAT[j][1], 72);", "const p = xy(NAT[i][1], 56), q = xy(NAT[j][1], 56);")
r("    const wheelData = { sectors, ticks, cusps, planets, aspects };\n",
  "    const houseNums = CUSPS.map((lon, i) => { const span = ((CUSPS[(i + 1) % 12] - lon) % 360 + 360) % 360; const q = xy(lon + span / 2, 66); return { n: String(i + 1), x: f1(q[0]) + 'px', y: f1(q[1]) + 'px' }; });\n"
  "    const axisAt = (lon) => { const l0 = ((lon % 360) + 360) % 360; const mid = Math.floor(l0 / 30) * 30 + 15; const lx = Math.abs(l0 - mid) < 10 ? mid + (l0 >= mid ? 10 : -10) : l0; return xy(lx, 156); };\n"
  "    const ascP = axisAt(ASC), mcP = axisAt(CUSPS[9]);\n"
  "    const axes = [['ASC', ascP], ['MC', mcP]].map((x) => ({ t: x[0], x: f1(x[1][0]) + 'px', y: f1(x[1][1]) + 'px' }));\n"
  "    this.wheelHit = { asc: ASC, cusps: CUSPS, planets: NAT.map((p0, i) => { const q = xy(p0[1], rad[i]); return [q[0], q[1], p0[0]]; }), labels: [[ascP[0], ascP[1], 'asc'], [mcP[0], mcP[1], 'mc']] };\n"
  "    const wheelData = { sectors, ticks, cusps, planets, aspects, houseNums, axes };\n")
r("open: () => (isMe ? this.setState({ popup: 'planet_' + b[4] }) : null) }));",
  "open: () => this.setState({ popup: 'planet_' + b[4] }) }));")
r("    const positions = NAT.map((p, i) => ({ img: PL[p[0]], planet: p[2], sign: p[3], deg: p[4], house: p[5].replace(' дом', ''), border: i ? '1px solid ' + c.sep : '0' }));\n",
  "    const degTxt = (lon) => { const v = ((lon % 30) + 30) % 30; let d0 = Math.floor(v), m0 = Math.round((v - d0) * 60); if (m0 === 60) { d0 += 1; m0 = 0; } return d0 + '°' + (m0 < 10 ? '0' : '') + m0 + '′'; };\n"
  "    const positions = NAT.map((p, i) => ({ hasImg: true, img: PL[p[0]], hasBadge: false, badge: '', planet: p[2], sign: p[3], deg: p[4], house: p[5].replace(' дом', ''), border: i ? '1px solid ' + c.sep : '0', open: () => this.setState({ popup: 'planet_' + p[0] }) }))\n"
  "      .concat([['asc', 'AC', 'Асцендент', ASC, '1'], ['mc', 'MC', 'Середина неба', CUSPS[9], '10']].map((x) => ({ hasImg: false, img: '', hasBadge: true, badge: x[1], planet: x[2], sign: SIGNS.ru[Math.floor((((x[3] % 360) + 360) % 360) / 30)], deg: degTxt(x[3]), house: x[4], border: '1px solid ' + c.sep, open: () => this.setState({ popup: 'planet_' + x[0] }) })));\n")

# ------------------------------------------------------------------ tap on the wheel
r("  scrollToAsk(smooth) {",
  "  wheelTap(e) {\n"
  "    const W = this.wheelHit, el = this.el_wheel; if (!W || !el || !e || e.clientX === undefined) return;\n"
  "    const b = el.getBoundingClientRect(); if (!b.width) return;\n"
  "    const k = 350 / b.width, x = (e.clientX - b.left) * k, y = (e.clientY - b.top) * k;\n"
  "    const near = (arr, d0) => { let best = null, bd = d0; arr.forEach((q) => { const d = Math.hypot(q[0] - x, q[1] - y); if (d < bd) { bd = d; best = q[2]; } }); return best; };\n"
  "    const lab = near(W.labels, 14); if (lab) { this.setState({ popup: 'planet_' + lab }); return; }\n"
  "    const pl = near(W.planets, 17); if (pl) { this.setState({ popup: 'planet_' + pl }); return; }\n"
  "    const dx = x - 175, dy = 175 - y, rr = Math.hypot(dx, dy); if (rr > 173) return;\n"
  "    const lon = ((Math.atan2(dy, dx) * 180 / Math.PI - 180 + W.asc) % 360 + 720) % 360;\n"
  "    if (rr >= 140) { this.setState({ popup: 'sign_' + Math.floor(lon / 30) }); return; }\n"
  "    if (rr >= 58) { const C = W.cusps; for (let i = 0; i < 12; i++) { const span = ((C[(i + 1) % 12] - C[i]) % 360 + 360) % 360; if ((((lon - C[i]) % 360) + 360) % 360 < span) { this.setState({ popup: 'house_' + (i + 1) }); return; } } return; }\n"
  "    this.setState({ popup: 'aspects' });\n"
  "  }\n"
  "  scrollToAsk(smooth) {")
r("mx, replayMatrix: () => this.runMatrix(), pyth, askChips,", "mx, replayMatrix: () => this.runMatrix(), pyth, askChips, wheelTap: (e) => this.wheelTap(e),")

# ------------------------------------------------------------------ texts for the cards
CHART_JS = r"""
    // chart cards: planets, points, houses, signs and aspects (wheel, «Карта в цифрах», guide)
    const SIGN_ADV = ['смело и быстро', 'спокойно и основательно', 'легко и с любопытством', 'бережно и по-домашнему', 'ярко и от души', 'точно и по делу', 'мягко и красиво', 'глубоко и всерьёз', 'широко и с верой в лучшее', 'терпеливо и с планом', 'по-своему и свободно', 'чутко и с воображением'];
    const SIGN_ABOUT = ['Знак огня, им управляет Марс. Это смелость, прямота и желание начинать первым.', 'Знак земли, им управляет Венера. Это надёжность, вкус и любовь к простым радостям.', 'Знак воздуха, им управляет Меркурий. Это общение, любопытство и лёгкость.', 'Знак воды, им управляет Луна. Это забота, дом и память о своих.', 'Знак огня, им управляет Солнце. Это щедрость, яркость и творчество.', 'Знак земли, им управляет Меркурий. Это точность, польза и порядок.', 'Знак воздуха, им управляет Венера. Это гармония, партнёрство и чувство справедливости.', 'Знак воды, им управляют Марс и Плутон. Это глубина, страсть и сила перемен.', 'Знак огня, им управляет Юпитер. Это свобода, поиск смысла и путешествия.', 'Знак земли, им управляет Сатурн. Это цели, дисциплина и ответственность.', 'Знак воздуха, им управляют Сатурн и Уран. Это свобода, идеи и дружба.', 'Знак воды, им управляют Юпитер и Нептун. Это чуткость, мечты и сострадание.'];
    const SIGN_TIP = ['Где в карте Овен, побеждает тот, кто начинает первым. Действуй, не жди идеального момента.', 'Где в карте Телец, всё растёт медленно, но надёжно. Не торопи результат.', 'Где в карте Близнецы, помогают разговоры и новые люди. Спрашивай и знакомься.', 'Где в карте Рак, важны забота и свои люди. Береги эту тему от чужих глаз.', 'Где в карте Лев, нужно быть на виду. Не прячь то, чем гордишься.', 'Где в карте Дева, решают мелочи и порядок. Доводи дела до конца.', 'Где в карте Весы, всё решают договорённости. Ищи решение, которое устроит обоих.', 'Где в карте Скорпион, нужны глубина и доверие. Не бойся перемен, они делают сильнее.', 'Где в карте Стрелец, помогают простор и смысл. Учись, путешествуй, смотри шире.', 'Где в карте Козерог, награда приходит с годами. Ставь цели и иди к ним шаг за шагом.', 'Где в карте Водолей, нужна свобода. Делай по-своему и ищи единомышленников.', 'Где в карте Рыбы, ведёт интуиция. Доверяй ей, но проверяй факты.'];
    const ASC_LOOK = ['прямым и энергичным', 'спокойным и надёжным', 'лёгким и разговорчивым', 'мягким и заботливым', 'ярким и уверенным', 'собранным и внимательным', 'приятным и дипломатичным', 'серьёзным и закрытым', 'открытым и весёлым', 'строгим и сдержанным', 'необычным и независимым', 'мечтательным и тонким'];
    const MC_WORK = ['дело, где нужно быстро решать и начинать первым', 'стабильное дело с понятным результатом: деньги, еда, красота, недвижимость', 'работа со словом и людьми: общение, медиа, продажи, обучение', 'забота о людях: дом, семья, помощь, гостеприимство', 'работа на виду: творчество, руководство, выступления', 'дело, где важны точность и польза: анализ, медицина, сервис', 'работа с людьми и красотой: дизайн, переговоры, право', 'глубокая работа: исследования, психология, финансы', 'простор и смысл: обучение, путешествия, проекты с другими странами', 'долгая карьера и ответственность: управление, своё дело', 'необычные задачи: технологии, наука, сообщества', 'творчество и помощь: искусство, кино, психология'];
    const DSC_PEOPLE = ['к смелым и решительным людям', 'к спокойным и надёжным людям', 'к лёгким и интересным собеседникам', 'к заботливым и домашним людям', 'к ярким и щедрым людям', 'к собранным и внимательным людям', 'к мягким и красивым людям', 'к глубоким и сильным людям', 'к свободным и весёлым людям', 'к серьёзным и надёжным людям', 'к необычным и независимым людям', 'к чутким и мечтательным людям'];
    const IC_HOME = ['много движения и можно решать самому', 'надёжно, вкусно и красиво', 'много разговоров, книг и гостей', 'тепло, по-семейному и помнят традиции', 'есть чем гордиться и можно принимать гостей', 'порядок и всё на своём месте', 'красиво и никто не ссорится', 'можно закрыться от мира и быть собой', 'простор, свет и вещи из поездок', 'всё крепко и сделано своими руками', 'каждый свободен и нет лишних правил', 'тихо, есть музыка и можно мечтать'];
    const PL_WHAT = { sun: 'Солнце показывает суть: характер, волю и то, ради чего хочется жить.', moon: 'Луна показывает чувства: что нужно для покоя и как восстанавливаются силы.', mercury: 'Меркурий отвечает за мысли и речь: как думать, учиться, договариваться и писать.', venus: 'Венера отвечает за любовь и вкус: что нравится, кого выбирают и на что приятно тратить.', mars: 'Марс это энергия и смелость: как действовать, спорить и добиваться своего.', jupiter: 'Юпитер отвечает за рост и удачу: где легче всего расширяться и получать подарки судьбы.', saturn: 'Сатурн отвечает за опыт и границы: где нужна дисциплина и где с годами приходит мастерство.', uranus: 'Уран отвечает за перемены и свободу: где жизнь любит сюрпризы и где важно быть собой.', neptune: 'Нептун отвечает за мечты и интуицию: где вдохновение, а где легко обмануться.', pluto: 'Плутон отвечает за глубину и перерождение: где случаются сильные перемены и откуда приходит внутренняя сила.' };
    const PL_TITLE = { sun: 'суть характера', moon: 'чувства и покой', mercury: 'мысли и речь', venus: 'любовь и вкус', mars: 'энергия и смелость', jupiter: 'рост и удача', saturn: 'опыт и границы', uranus: 'перемены и свобода', neptune: 'мечты и интуиция', pluto: 'глубина и сила' };
    const PT_NAME = { asc: 'Асцендент', mc: 'Середина неба', dsc: 'Десцендент', ic: 'Глубина неба', node: 'Северный узел', snode: 'Южный узел' };
    const PT_TITLE = { asc: 'первое впечатление', mc: 'призвание', dsc: 'кого тянет выбрать', ic: 'корни и дом', node: 'куда расти', snode: 'что уже даётся' };
    const PT_SUB = { asc: 'каким тебя видят', mc: 'призвание и карьера', dsc: 'кого ты выбираешь', ic: 'корни и дом', node: 'куда расти', snode: 'что уже умеешь' };
    const PT_WHAT = { asc: 'Асцендент это знак, который поднимался на востоке в минуту рождения. Знаки по очереди поднимаются над горизонтом, каждый примерно за два часа, поэтому для карты важно точное время.', mc: 'Середина неба это самая высокая точка карты и начало 10 дома. Она показывает карьеру, цели и то, каким человека видят в обществе.', dsc: 'Десцендент это точка напротив Асцендента и начало 7 дома. Она показывает, какие люди притягивают и какой партнёр дополняет.', ic: 'Глубина неба это самая нижняя точка карты и начало 4 дома. Она про дом, семью, корни и место, где восстанавливаются силы.', node: 'Лунные узлы это точки, где путь Луны пересекает путь Солнца. Северный узел показывает, что стоит развивать: это непривычно, но именно туда ведёт жизнь.', snode: 'Южный узел стоит напротив Северного. Он показывает то, что даётся легко с рождения: это опора, но если в ней застрять, развитие останавливается.' };
    const PT_GLYPH = { asc: 'M3 16h18M12 16V6M8 10l4-4 4 4', mc: 'M12 20V4M7 9l5-5 5 5M5 20h14', dsc: 'M3 8h18M12 8v10M8 14l4 4 4-4', ic: 'M12 4v16M7 15l5 5 5-5M5 4h14', node: 'M4 17a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M14 17a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M7 14v-2a5 5 0 0 1 10 0v2', snode: 'M4 7a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M14 7a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M7 10v2a5 5 0 0 0 10 0v-2' };
    const NODE_LON = { me: 334.35, dariya: 229.26, nika: 202.1, mark: 266.73, olya: 225.93 };
    const ME_CARD = {
      sun: ['Солнце: твоя суть', 'Солнце в Рыбах, на 16°, в 4 доме. Ты живёшь чувствами и легко ставишь себя на место другого. Тебе важно, чтобы дома было тепло.', 'Выбирай дела, где нужна чуткость: люди, творчество, помощь. Там ты не выгораешь.'],
      moon: ['Луна: что нужно для покоя', 'Луна в Рыбах, рядом с твоим Солнцем. Покой для тебя это тишина, дом и один близкий человек рядом. Шум выматывает тебя быстрее, чем других.', 'Устрой дома место, где можно побыть одному. Это не каприз, а зарядка.'],
      mercury: ['Меркурий: как ты думаешь', 'Меркурий в Водолее, в 3 доме общения. Ты думаешь нестандартно и быстро схватываешь новое. Лучше всего тебе даются идеи, которые другим ещё не пришли в голову.', 'Записывай идеи сразу: лучшие приходят внезапно. Важное обсуждай текстом, так тебя поймут точнее.'],
      venus: ['Венера: как ты любишь', 'Венера в Рыбах, в 4 доме. Ты любишь тихо и преданно, душевная близость тебе важнее красивых жестов. Радость приносят уютный дом и музыка.', 'Говори о чувствах простыми словами, не жди повода. Красивые вещи дома правда поднимают тебе настроение.'],
      mars: ['Марс: твоя энергия', 'Марс в Тельце, в 7 доме партнёрства. Ты действуешь не спеша, но упорно, и сил прибавляется, когда рядом надёжный человек. Если на тебя давить, ты упираешься.', 'Ставь цели вдвоём: с партнёром или командой ты двигаешься быстрее. Спорт лучше спокойный и регулярный: плавание, ходьба, зал.'],
      jupiter: ['Юпитер: где твоя удача', 'Юпитер в Тельце, в 7 доме, рядом с Марсом. Удача приходит к тебе через людей: партнёров, договоры, брак. Вдвоём у тебя получается больше и выгоднее.', 'Не бойся предлагать сотрудничество и просить о помощи. Самые выгодные шансы приходят через договоры и знакомства.'],
      saturn: ['Сатурн: где нужна выдержка', 'Сатурн в Козероге, во 2 доме денег. Деньги приходят через терпение и труд, без лёгких подарков. Зато заработанное ты умеешь сохранить.', 'Откладывай понемногу, но постоянно. Сатурн награждает за долгий путь, а не за рывок.'],
      uranus: ['Уран: где ждать перемен', 'Уран в Козероге у всего поколения конца 80-х, а лично у тебя он во 2 доме, доме денег. Доход может меняться резко, и выигрывают новые, необычные способы заработка.', 'Держи запасной источник дохода и пробуй новое в работе: перемены легче, когда ты выбираешь их сам.'],
      neptune: ['Нептун: где твои мечты', 'Нептун в Козероге, тоже планета поколения. У тебя он во 2 доме вместе с Сатурном: деньги и мечты связаны. Хорошо зарабатывать на творчестве и помощи людям.', 'Денежные договоры подписывай только после проверки. Мечту о своём деле воплощай маленькими шагами.'],
      pluto: ['Плутон: твоя скрытая сила', 'Плутон в Скорпионе, в 1 доме, рядом с Асцендентом. В тебе больше силы, чем видно снаружи. Ты умеешь начинать заново после трудных периодов, и люди это чувствуют.', 'Не держись за то, что отжило: после отпускания у тебя всегда приходит сила.'],
      asc: ['Асцендент: каким тебя видят', 'Когда ты родился, в 23:15, над горизонтом поднимался Скорпион. Часом раньше там был бы уже другой знак. Со Скорпионом ты кажешься серьёзным и закрытым, а люди не сразу понимают, какой ты тёплый.', 'Хочешь, чтобы к тебе тянулись быстрее: улыбайся первым и говори о себе чуть больше.'],
      mc: ['Середина неба: твоё призвание', 'У тебя она во Льве, на 24°. Тебе подходит работа, где тебя видно: вести людей, выступать, создавать своё. Признание для тебя не тщеславие, а топливо.', 'Не прячься за чужими спинами. Проекты, где ты на виду, приносят тебе больше всего.'],
      dsc: ['Десцендент: кого ты выбираешь', 'У тебя он в Тельце. Тебя тянет к спокойным и надёжным людям, рядом с которыми можно расслабиться. Такой человек уравновешивает твою скорпионью глубину.', 'Ищи не яркость, а надёжность. С человеком, который держит слово, тебе спокойно и легко.'],
      ic: ['Глубина неба: твои корни', 'У тебя она в Водолее. Дом для тебя место свободы: важно, чтобы там тебя принимали любым и не контролировали.', 'Делай дом своим, а не правильным. Необычный уютный дом подходит тебе больше классического.'],
      node: ['Северный узел: куда расти', 'У тебя он в Рыбах, в 4 доме. Твой рост в доверии чувствам, дому и близким. Чем больше ты позволяешь себе мягкости, тем легче всё складывается.', 'Когда сомневаешься, выбирай то, что ближе сердцу и семье, а не то, что правильнее по плану.'],
      snode: ['Южный узел: что ты уже умеешь', 'У тебя он в Деве, в 10 доме. Ты уже умеешь работать точно и отвечать за результат. Это сила, но не цель: не уходи с головой в контроль и работу.', 'Используй точность как инструмент, а не как смысл. Оставляй время на чувства и отдых.'],
    };
    const HOUSE_T = ['Ты и как тебя видят', 'Деньги и ценности', 'Общение и учёба', 'Дом и семья', 'Любовь и радость', 'Работа и здоровье', 'Партнёрство и брак', 'Общие деньги и перемены', 'Смысл и дальние дороги', 'Карьера и репутация', 'Друзья и планы', 'Отдых и тайное'];
    const HOUSE_WHAT = ['Первый дом начинается с Асцендента. Он про внешность, первое впечатление и то, как человек начинает новое.', 'Про деньги, вещи и самооценку: на что человек опирается и как зарабатывает.', 'Про разговоры, учёбу, переписку, поездки по городу, братьев и сестёр.', 'Начинается с Глубины неба. Про дом, семью, корни и место, где спокойно.', 'Про любовь, свидания, детей, творчество и хобби: всё, что делается для удовольствия.', 'Про будни: работу, режим, здоровье, привычки и домашних животных.', 'Начинается с Десцендента. Про брак, близкого партнёра, договоры и открытых соперников.', 'Про общие деньги, кредиты, наследство, близость и сильные перемены.', 'Про путешествия, учёбу, веру, всё иностранное и взгляд на мир.', 'Начинается с Середины неба. Про карьеру, статус, репутацию и цели в жизни.', 'Про друзей, сообщества, единомышленников и мечты о будущем.', 'Про отдых, одиночество, интуицию, сны и то, что скрыто даже от себя.'];
    const HOUSE_TIP = ['Обращай внимание, какое впечатление производишь: его можно менять осознанно.', 'Деньги приходят легче, когда работа совпадает с тем, что ты правда ценишь.', 'Пиши и говори: этот дом раскрывается в общении, на курсах и в коротких поездках.', 'Вкладывайся в дом: уют и свои люди дают силы на всё остальное.', 'Оставляй в неделе время просто для радости: без него гаснет вдохновение.', 'Маленькие привычки здесь решают больше, чем рывки: сон, еда, порядок.', 'Выбирай партнёров, с которыми вы дополняете друг друга, а не похожи во всём.', 'Договаривайся о деньгах с близкими заранее и письменно, так спокойнее.', 'Когда тесно в рутине, поезжай или учись новому: этот дом так и работает.', 'Ставь долгие цели: этот дом раскрывается с годами.', 'Ищи своих людей: в команде планы сбываются быстрее.', 'Давай себе время побыть одному: так этот дом восстанавливает силы.'];
    const ASP_WHAT = ['Планеты стоят рядом, в одном месте неба. Их силы сливаются: работают вместе и усиливают друг друга.', 'Угол 60°. Лёгкая связь: возможность, которая сработает, если ею воспользоваться.', 'Угол 90°. Напряжение между двумя частями характера. Оно мешает, пока его не направишь в дело.', 'Угол 120°. Самая гармоничная связь: природный талант, который даётся легко.', 'Угол 180°. Планеты смотрят друг на друга с разных сторон неба. Нужно искать баланс, а не выбирать одно.'];
    const ASP_TIP = ['Смотри, какие планеты слились: эти темы у тебя всегда идут вместе.', 'Секстили сами не включаются. Сделай первый шаг, и возможность сработает.', 'Квадраты дают энергию. Когда злишься или споришь, направь это в дело, а не в ссору.', 'Трины легко не замечать, потому что всё получается само. Развивай эти таланты осознанно.', 'В оппозициях помогает договариваться с собой: немного одного, немного другого.'];
    const PL_INS = { sun: 'Солнцем', moon: 'Луной', mercury: 'Меркурием', venus: 'Венерой', mars: 'Марсом', jupiter: 'Юпитером', saturn: 'Сатурном', uranus: 'Ураном', neptune: 'Нептуном', pluto: 'Плутоном' };
    const ASP_DEG = [0, 60, 90, 120, 180], ASP_ORB = [8, 6, 7, 7, 8], ASP_NAME = ['соединение', 'секстиль', 'квадрат', 'трин', 'оппозиция'];
    const signOf = (lon) => Math.floor((((lon % 360) + 360) % 360) / 30);
    const houseOf = (pw, lon) => { const C = pw.cusps; for (let i = 0; i < 12; i++) { const span = ((C[(i + 1) % 12] - C[i]) % 360 + 360) % 360; if ((((lon - C[i]) % 360) + 360) % 360 < span) return i + 1; } return 1; };
    const listRu = (arr) => (arr.length < 2 ? (arr[0] || '') : arr.slice(0, -1).join(', ') + ' и ' + arr[arr.length - 1]);
    const aspList = (pw) => { const N0 = pw.nat, out = []; for (let i = 0; i < N0.length; i++) for (let j = i + 1; j < N0.length; j++) { let d = Math.abs(N0[i][1] - N0[j][1]); if (d > 180) d = 360 - d; ASP_DEG.forEach((a, ai) => { const o = Math.abs(d - a); if (o <= ASP_ORB[ai]) out.push({ o, ai, pair: N0[i][2] + ' с ' + (PL_INS[N0[j][0]] || N0[j][2]) }); }); } return out.sort((a, b) => a.o - b.o); };
    const chartCard = (kind, key, pwKey) => {
      const pw = WHO[pwKey] || WHO.me, me0 = !pw.other, guide = s.screen === 'guide';
      const P0 = pw.sex === 'f' ? { she: 'она', She: 'Она', acc: 'её', gen: 'её', ngen: 'неё', dat: 'ей', Dat: 'Ей', kdat: 'к ней', ins: 'ней', pre: 'ней', a: 'а', sya: 'ась' } : { she: 'он', She: 'Он', acc: 'его', gen: 'его', ngen: 'него', dat: 'ему', Dat: 'Ему', kdat: 'к нему', ins: 'ним', pre: 'нём', a: '', sya: 'ся' };
      const whoL = me0 ? 'У тебя' : 'У ' + pw.gen, tipL = me0 ? 'Что делать' : 'Как это учитывать', whose = me0 ? 'у тебя' : 'у ' + pw.gen;
      if (kind === 'planet' && PL_WHAT[key]) {
        const row = pw.nat.filter((x) => x[0] === key)[0]; if (!row) return null;
        const si0 = Math.max(0, SIGNS.ru.indexOf(row[3])), h0 = parseInt(row[5], 10) || 1, adv = SIGN_ADV[si0], hs = '«' + HOUSES[h0 - 1] + '»';
        const gener = key === 'uranus' || key === 'neptune' || key === 'pluto';
        const lines3 = { sun: P0.She + ' проявляет себя ' + adv + '. Это главная черта, по ней ' + P0.acc + ' и узнают.', moon: 'Чувствует ' + P0.she + ' ' + adv + '. Так же ' + P0.she + ' и успокаивается.', mercury: 'Думает и говорит ' + P0.she + ' ' + adv + '.', venus: 'Любит ' + P0.she + ' ' + adv + '.', mars: 'Действует ' + P0.she + ' ' + adv + ', так же и спорит.', jupiter: 'Удача приходит ' + P0.kdat + ', когда ' + P0.she + ' живёт ' + adv + '.', saturn: 'Сатурн учит ' + P0.acc + ' делать важное ' + adv + ', даже если сначала не получается.' };
        const tips3 = { sun: 'Замечай и хвали в ' + P0.pre + ' именно это: так ' + P0.she + ' чувствует, что ' + P0.acc + ' видят.', moon: 'Когда ' + P0.she + ' расстроен' + P0.a + ', сначала покажи, что ты рядом, и только потом решай вопрос.', mercury: 'Говори с ' + P0.ins + ' в ' + P0.gen + ' темпе: так вы быстрее поймёте друг друга.', venus: 'Подарки и знаки внимания выбирай под ' + P0.gen + ' вкус: ' + P0.dat + ' важно попадание, а не цена.', mars: 'Не дави, если ' + P0.she + ' уже решил' + P0.a + ': договориться проще, когда ' + P0.she + ' сам' + P0.a + ' выбирает темп.', jupiter: 'Поддерживай ' + P0.acc + ' в том, что расширяет горизонты: учёба, поездки, новые люди.', saturn: 'Не торопи ' + P0.acc + ' там, где ' + P0.she + ' осторожничает: в этой теме ' + P0.dat + ' нужно время.', uranus: 'В теме ' + hs + ' ' + P0.dat + ' нужна свобода. Не загоняй ' + P0.acc + ' там в рамки.', neptune: 'В теме ' + hs + ' ' + P0.she + ' легко идеализирует. Помогай ' + P0.dat + ' смотреть на факты, но мягко.', pluto: 'В теме ' + hs + ' ' + P0.acc + ' ждут сильные перемены. Поддерживай, а не удерживай.' };
        const mine = me0 ? ME_CARD[key][1] : row[2] + ' ' + SIGNS_IN[si0] + ', в ' + h0 + ' доме: ' + HOUSES[h0 - 1] + '. ' + (gener ? 'Это планета поколения: у всех, кто родился в те годы, этот знак тот же. Лично для ' + P0.ngen + ' важнее дом, он показывает, где это проявляется.' : lines3[key]);
        return { sticker: PL[key], over: guide ? 'Справочник · планета' : row[2] + ' ' + SIGNS_IN[si0] + ' · ' + row[5], title: me0 ? ME_CARD[key][0] : row[2] + ': ' + PL_TITLE[key], steps: [['Что это', PL_WHAT[key]], [whoL, mine], [tipL, me0 ? ME_CARD[key][2] : tips3[key]]] };
      }
      if (kind === 'planet' && PT_NAME[key]) {
        const base0 = { asc: pw.asc, mc: pw.cusps[9], dsc: pw.asc + 180, ic: pw.cusps[9] + 180, node: NODE_LON[pwKey] || NODE_LON.me, snode: (NODE_LON[pwKey] || NODE_LON.me) + 180 }[key];
        const sg = signOf(base0), dg = Math.floor((((base0 % 30) + 30) % 30)), h0 = key === 'asc' ? 1 : key === 'mc' ? 10 : key === 'dsc' ? 7 : key === 'ic' ? 4 : houseOf(pw, base0);
        const nodeKey = key === 'node' || key === 'snode';
        const other = { asc: ['Когда ' + P0.she + ' родил' + P0.sya + ', над горизонтом поднимался ' + SIGNS.ru[sg] + '. С первого взгляда ' + P0.she + ' кажется человеком ' + ASC_LOOK[sg] + '.', 'Первое впечатление о ' + P0.pre + ' бывает обманчивым: узнай ' + P0.acc + ' ближе, прежде чем делать выводы.'], mc: ['Середина неба у ' + pw.gen + ' ' + SIGNS_IN[sg] + '. Лучше всего ' + P0.she + ' раскрывается, когда работа это ' + MC_WORK[sg] + '.', 'Поддерживай ' + P0.gen + ' планы в работе, даже если они кажутся смелыми.'], dsc: ['Десцендент у ' + pw.gen + ' ' + SIGNS_IN[sg] + '. ' + P0.She + ' тянется ' + DSC_PEOPLE[sg] + '.', 'Хочешь быть ' + P0.dat + ' ближе: покажи в себе эти черты.'], ic: ['Глубина неба у ' + pw.gen + ' ' + SIGNS_IN[sg] + '. ' + P0.Dat + ' спокойно, когда дома ' + IC_HOME[sg] + '.', 'Хочешь порадовать ' + P0.acc + ': помоги, чтобы дома было именно так.'], node: ['Северный узел у ' + pw.gen + ' ' + SIGNS_IN[sg] + ', в ' + h0 + ' доме. Расти ' + P0.dat + ' стоит через тему «' + HOUSES[h0 - 1] + '».', 'Поддерживай ' + P0.acc + ' в этой теме, даже если ' + P0.dat + ' там пока непривычно.'], snode: ['Южный узел у ' + pw.gen + ' ' + SIGNS_IN[sg] + ', в ' + h0 + ' доме. Тема «' + HOUSES[h0 - 1] + '» даётся ' + P0.dat + ' легко с рождения.', 'Не держи ' + P0.acc + ' только там, где ' + P0.dat + ' привычно: новое ' + P0.dat + ' полезнее.'] }[key];
        const icon0 = key === 'asc' || key === 'mc' || key === 'dsc' || key === 'ic' ? null : PT_GLYPH[key];
        return { sticker: icon0 ? '' : SYM[sg], icon: !!icon0, iconPath: icon0 || '', over: guide ? 'Справочник · точка' : PT_NAME[key] + ' ' + SIGNS_IN[sg] + ' · ' + dg + '°' + (nodeKey ? ' · ' + h0 + ' дом' : ''), title: me0 ? ME_CARD[key][0] : PT_NAME[key] + ': ' + PT_TITLE[key], steps: [['Что это', PT_WHAT[key]], [whoL, me0 ? ME_CARD[key][1] : other[0]], [tipL, me0 ? ME_CARD[key][2] : other[1]]] };
      }
      if (kind === 'house') {
        const n = key, cs = signOf(pw.cusps[n - 1]);
        const inH = pw.nat.filter((x) => parseInt(x[5], 10) === n).map((x) => x[2]);
        const plTxt = inH.length ? 'Здесь ' + listRu(inH) + '. ' + (inH.length >= 3 ? (me0 ? 'Это одна из главных тем твоей жизни.' : 'Это одна из главных тем ' + P0.gen + ' жизни.') : 'Планеты делают эту тему заметной.') : 'Планет здесь нет: тема идёт ровнее, а её стиль задаёт знак.';
        const mine = n + ' дом ' + whose + ' начинается ' + SIGNS_IN[cs] + '. ' + plTxt + ' ' + (me0 ? 'В этой сфере ты действуешь ' : 'В этой сфере ' + P0.she + ' действует ') + SIGN_ADV[cs] + '.';
        return { bigD: String(n), bigM: 'дом', over: guide ? 'Справочник · дом' : 'Дом · начинается ' + SIGNS_IN[cs], title: HOUSE_T[n - 1], steps: me0 ? [['Что это', HOUSE_WHAT[n - 1]], [whoL, mine], ['Что делать', HOUSE_TIP[n - 1]]] : [['Что это', HOUSE_WHAT[n - 1]], [whoL, mine]] };
      }
      if (kind === 'sign') {
        const i0 = key, inS = pw.nat.filter((x) => x[3] === SIGNS.ru[i0]).map((x) => x[2]), h0 = houseOf(pw, i0 * 30 + 15);
        const extra = (signOf(pw.asc) === i0 ? (me0 ? ' Это твой Асцендент.' : ' Это ' + P0.gen + ' Асцендент.') : '') + (signOf(pw.cusps[9]) === i0 ? ' Здесь же Середина неба.' : '');
        const mine = (inS.length ? SIGNS.ru[i0] + ' ' + whose + ([2, 6, 11].indexOf(i0) >= 0 ? ' приходятся на ' : ' приходится на ') + h0 + ' дом. В этом знаке ' + listRu(inS) + '.' : 'Планет ' + SIGNS_IN[i0] + ' ' + whose + ' нет. Знак окрашивает ' + h0 + ' дом: ' + HOUSES[h0 - 1] + '.') + extra;
        return { sticker: SYM[i0], over: guide ? 'Справочник · знак' : 'Знак · ' + RANGES[i0], title: SIGNS.ru[i0], steps: me0 ? [['Что это', SIGN_ABOUT[i0]], [whoL, mine], ['Что делать', SIGN_TIP[i0]]] : [['Что это', SIGN_ABOUT[i0]], [whoL, mine]] };
      }
      if (kind === 'asp') {
        const mineA = aspList(pw).filter((x) => x.ai === key).map((x) => x.pair + ' (' + Math.round(x.o) + '°)');
        return { icon: true, iconPath: ASP[key][2], over: 'Справочник · аспект', title: ASP[key][0], steps: [['Что это', ASP_WHAT[key]], [whoL, mineA.length ? mineA.join(', ') + '.' : 'Таких аспектов в карте нет, и это нормально.'], ['Что делать', ASP_TIP[key]]] };
      }
      if (kind === 'aspects') {
        return { icon: true, iconPath: ic.wheel, over: me0 ? 'Твоя карта · центр круга' : 'Карта ' + pw.gen + ' · центр круга', title: 'Аспекты: как планеты ладят', text: 'Линии в центре это углы между планетами. Синие и зелёные помогают, оранжевые и красные дают напряжение, которое толкает вперёд. Самые точные в карте:', rows: aspList(pw).slice(0, 6).map((x, i) => ({ k: x.pair, v: ASP_NAME[x.ai] + ' · ' + Math.round(x.o) + '°', vc: c.label, border: i ? '1px solid ' + c.sep : '0' })), more: ['Что значат аспекты', () => this.setState({ popup: null, screen: 'guide', guideTab: 'aspects' })] };
      }
      return null;
    };
"""
r("    // reference guide\n", CHART_JS + "    // reference guide\n")

# guide: every row opens a card; new «Точки» tab
r("const guideRows = s.guideTab === 'signs' ? SIGNS.ru.map((n0, i) => gRow({ hasImg: true, img: SYM[i], title: n0, sub: RANGES[i] + ' · ' + ELN[i % 4] })) : s.guideTab === 'houses' ? HOUSES.map((h, i) => gRow({ hasNum: true, num: String(i + 1), title: (i + 1) + ' дом', sub: h })) : s.guideTab === 'aspects' ? ASP.map((a) => gRow({ hasGlyph: true, glyph: a[2], title: a[0], sub: a[1] }))",
  "const guideRows = s.guideTab === 'signs' ? SIGNS.ru.map((n0, i) => gRow({ hasImg: true, img: SYM[i], title: n0, sub: RANGES[i] + ' · ' + ELN[i % 4], chev: true, open: () => this.setState({ popup: 'sign_' + i }) })) : s.guideTab === 'houses' ? HOUSES.map((h, i) => gRow({ hasNum: true, num: String(i + 1), title: (i + 1) + ' дом', sub: h, chev: true, open: () => this.setState({ popup: 'house_' + (i + 1) }) })) : s.guideTab === 'aspects' ? ASP.map((a, i) => gRow({ hasGlyph: true, glyph: a[2], title: a[0], sub: a[1], chev: true, open: () => this.setState({ popup: 'asp_' + i }) })) : s.guideTab === 'points' ? ['asc', 'mc', 'dsc', 'ic', 'node', 'snode'].map((k0) => { const lon0 = { asc: WHO.me.asc, mc: WHO.me.cusps[9], dsc: WHO.me.asc + 180, ic: WHO.me.cusps[9] + 180, node: NODE_LON.me, snode: NODE_LON.me + 180 }[k0]; return gRow({ hasGlyph: true, glyph: PT_GLYPH[k0], title: PT_NAME[k0], sub: PT_SUB[k0] + ' · у тебя ' + SIGNS.ru[signOf(lon0)], chev: true, open: () => this.setState({ popup: 'planet_' + k0 }) }); })")
r("const guideV = { tabs: [['planets', 'Планеты'], ['signs', 'Знаки'], ['houses', 'Дома'], ['aspects', 'Аспекты']]",
  "const guideV = { tabs: [['planets', 'Планеты'], ['signs', 'Знаки'], ['houses', 'Дома'], ['aspects', 'Аспекты'], ['points', 'Точки']]")
r('"options":["planets","signs","houses","aspects"],"default":"planets"}', '"options":["planets","signs","houses","aspects","points"],"default":"planets"}')
r('"options":["none","rustore","paidPlus","paid","giftDone","deleteAccount","poster","posterWall","tips",',
  '"options":["none","rustore","paidPlus","paid","giftDone","deleteAccount","poster","posterWall","planet_asc","planet_venus","house_4","sign_11","aspects","tips",')

# ------------------------------------------------------------------ popups: one builder for all chart cards
r("    if (PLAN[p]) pop = Object.assign({}, base, { hasOver: true, over: PLAN[p].over, title: PLAN[p].title, hasSteps: true, steps: steps3(PLAN[p].steps), buttons: [btn('Понятно', close, 'primary')] });\n",
  "    const CHK = /^(planet|house|sign|asp)_(.+)$/.exec(p || '');\n"
  "    if (CHK || p === 'guideItem' || p === 'aspects') {\n"
  "      const pwKey = (s.screen === 'guide' || p === 'guideItem') ? 'me' : (WHO[s.chartOf] ? s.chartOf : 'me');\n"
  "      const kind = p === 'guideItem' ? 'planet' : p === 'aspects' ? 'aspects' : CHK[1];\n"
  "      const key = p === 'guideItem' ? s.guideItem : p === 'aspects' ? '' : (kind === 'planet' ? CHK[2] : Number(CHK[2]));\n"
  "      const it = chartCard(kind, key, pwKey);\n"
  "      if (it) pop = Object.assign({}, base, { hasSticker: !!it.sticker, sticker: it.sticker || '', icon: !!it.icon, iconPath: it.iconPath || ic.sparkle, hasBigDate: !!it.bigD, bigD: it.bigD || '', bigM: it.bigM || '', hasOver: true, over: it.over, title: it.title, hasText: !!it.text, text: it.text || '', hasSteps: !!it.steps, steps: it.steps ? steps3(it.steps) : [], hasRows: !!it.rows, rows: it.rows || [], buttons: [btn('Понятно', close, 'primary')].concat(it.more ? [btn(it.more[0], it.more[1], 'link')] : []) });\n"
  "    }\n")
# the old planet-only guide card and the PLAN table are replaced by the builder above
j0 = s.index('    const PLAN = {\n')
j1 = s.index('\n    };\n', j0) + len('\n    };\n')
s = s[:j0] + s[j1:]
i0 = s.index("    if (p === 'guideItem') { const gp = PLG.filter(")
i1 = s.index('\n', i0) + 1
s = s[:i0] + s[i1:]

open(path, 'w', encoding='utf-8').write(s)
print('patch R applied')
