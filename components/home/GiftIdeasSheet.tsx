import React, { useEffect, useMemo, useState } from 'react';
import { CosmicSheet } from '../lumia-ui/CosmicSheet';
import { AssetSlot } from '../lumia-ui/AssetSlot';
import {
  ELEMENT_TASTE,
  elementOfSign,
  pickGiftIdeas,
  type GiftBudget,
  type GiftGender,
  type GiftRole,
} from '../../lib/giftIdeas';
import type { NatalChartData } from '../../types';

export type GiftPerson = {
  name: string;
  chart: NatalChartData | null;
  relation: string | null;
};

const SIGN_ORDER = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];

const SIGN_NOM_RU: Record<string, string> = {
  aries: 'Овен', taurus: 'Телец', gemini: 'Близнецы', cancer: 'Рак', leo: 'Лев', virgo: 'Дева',
  libra: 'Весы', scorpio: 'Скорпион', sagittarius: 'Стрелец', capricorn: 'Козерог', aquarius: 'Водолей', pisces: 'Рыбы',
};
const SIGN_IN_RU: Record<string, string> = {
  aries: 'Овне', taurus: 'Тельце', gemini: 'Близнецах', cancer: 'Раке', leo: 'Льве', virgo: 'Деве',
  libra: 'Весах', scorpio: 'Скорпионе', sagittarius: 'Стрельце', capricorn: 'Козероге', aquarius: 'Водолее', pisces: 'Рыбах',
};

const ROLES: Array<[GiftRole, string]> = [['partner', 'Партнёр'], ['friend', 'Друг'], ['family', 'Семья'], ['colleague', 'Коллега']];
const BUDGETS: Array<[GiftBudget, string]> = [['low', 'до 2 000 ₽'], ['mid', '2 000–5 000 ₽'], ['high', 'от 5 000 ₽']];
const GENDERS: Array<[GiftGender, string]> = [['female', 'Ж'], ['male', 'М'], ['unspecified', 'Не важно']];

function roleFromRelation(relation: string | null): GiftRole {
  const text = (relation || '').toLowerCase();
  if (/колл|работ|начальн|клиент/u.test(text)) return 'colleague';
  if (/мам|пап|брат|сестр|сын|доч|бабуш|дедуш|семь|родит/u.test(text)) return 'family';
  if (/друг|подруг|приятел/u.test(text)) return 'friend';
  if (/партн|любим|муж|жен|девуш|парен|other/u.test(text)) return 'partner';
  return 'friend';
}

function signKey(sign: string | null | undefined): string | null {
  const key = sign?.trim().toLowerCase();
  return key && SIGN_NOM_RU[key] ? key : null;
}

type GiftIdeasSheetProps = {
  open?: boolean;
  /** Who the gift is for; without one the sheet first asks to pick a person or a sign. */
  person: GiftPerson | null;
  /** Saved people to choose from when no person is given. */
  people?: readonly GiftPerson[];
  onClose: () => void;
};

/** «Что подарить?»: real gifts by the person's chart (or just their sign), your relation and budget. Free. */
export function GiftIdeasSheet({ open, person, people = [], onClose }: GiftIdeasSheetProps) {
  const [role, setRole] = useState<GiftRole>('friend');
  const [budget, setBudget] = useState<GiftBudget>('mid');
  const [gender, setGender] = useState<GiftGender>('unspecified');
  const [picked, setPicked] = useState<GiftPerson | null>(null);
  const [pickedSign, setPickedSign] = useState<string | null>(null);
  const isOpen = open ?? Boolean(person);

  useEffect(() => {
    if (!isOpen) {
      setPicked(null);
      setPickedSign(null);
    }
  }, [isOpen]);

  const target = person ?? picked;
  useEffect(() => {
    if (target) setRole(roleFromRelation(target.relation));
  }, [target]);

  const sun = signKey(target?.chart?.sun?.sign) ?? pickedSign;
  const venus = signKey(target?.chart?.venus?.sign);
  const sunElement = elementOfSign(sun);
  const venusElement = elementOfSign(venus);
  const ideas = useMemo(
    () => pickGiftIdeas({ sunElement, venusElement, role, budget, gender, limit: 5 }),
    [budget, gender, role, sunElement, venusElement],
  );

  const portrait = [
    sun ? `${SIGN_NOM_RU[sun]}${sunElement ? `, ${ELEMENT_TASTE[sunElement]}` : ''}.` : null,
    venus && venusElement && venusElement !== sunElement ? `Венера в ${SIGN_IN_RU[venus]}: ещё ${ELEMENT_TASTE[venusElement]}.` : null,
  ].filter(Boolean).join(' ');

  return (
    <CosmicSheet
      open={isOpen}
      title="Что подарить?"
      subtitle={target ? `${target.name}: идеи по карте, вашим отношениям и бюджету` : 'Подберём подарок по карте человека или просто по знаку'}
      onClose={onClose}
      closeLabel="Закрыть"
    >
      <div className="gift-sheet">
        {!person ? (
          <div className="gift-sheet-options">
            <span className="gift-sheet-label">Кому</span>
            <div className="gift-sheet-chips">
              {people.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  className={picked === item ? 'is-on' : undefined}
                  aria-pressed={picked === item}
                  onClick={() => { setPicked(item); setPickedSign(null); }}
                >
                  {item.name}
                </button>
              ))}
            </div>
            <span className="gift-sheet-label">{people.length ? 'Или по знаку' : 'Знак человека'}</span>
            <div className="gift-sheet-chips">
              {SIGN_ORDER.map((sign) => (
                <button
                  key={sign}
                  type="button"
                  className={!picked && pickedSign === sign ? 'is-on' : undefined}
                  aria-pressed={!picked && pickedSign === sign}
                  onClick={() => { setPicked(null); setPickedSign(sign); }}
                >
                  {SIGN_NOM_RU[sign]}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {sun ? (
        <>
        <div className="gift-sheet-options">
          <span className="gift-sheet-label">Кто это для тебя</span>
          <div className="gift-sheet-chips">
            {ROLES.map(([value, label]) => (
              <button key={value} type="button" className={role === value ? 'is-on' : undefined} aria-pressed={role === value} onClick={() => setRole(value)}>{label}</button>
            ))}
          </div>
          <span className="gift-sheet-label">Бюджет</span>
          <div className="gift-sheet-chips">
            {BUDGETS.map(([value, label]) => (
              <button key={value} type="button" className={budget === value ? 'is-on' : undefined} aria-pressed={budget === value} onClick={() => setBudget(value)}>{label}</button>
            ))}
          </div>
          <span className="gift-sheet-label">Пол</span>
          <div className="gift-sheet-chips">
            {GENDERS.map(([value, label]) => (
              <button key={value} type="button" className={gender === value ? 'is-on' : undefined} aria-pressed={gender === value} onClick={() => setGender(value)}>{label}</button>
            ))}
          </div>
        </div>
        {portrait ? <p className="gift-sheet-portrait">{portrait}</p> : null}
        <ol className="gift-sheet-list">
          {ideas.map((idea) => (
            <li key={idea.id} className="gift-sheet-item">
              <AssetSlot src={`/assets/gift/${idea.image}.webp`} fit="contain" className="gift-sheet-art" />
              <div>
                <b>{idea.title}</b>
                <span>{idea.why}</span>
                <em>{idea.price}</em>
              </div>
            </li>
          ))}
        </ol>
        </>
        ) : null}
      </div>
    </CosmicSheet>
  );
}
