import React, { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { CosmicSheet } from '../lumia-ui/CosmicSheet';
import {
  AVATAR_BACKGROUNDS,
  AVATAR_SET_SIZE,
  AVATAR_SET_TITLE,
  avatarImageUrl,
  avatarSource,
  matchAccess,
  matchPick,
  monthKey,
  photoToAvatar,
  useAvatar,
  type AvatarSet,
} from '../../lib/avatar';
import { sunSignFromDate } from '../../lib/synastry/compatScore';

/** A round avatar: the chosen picture or photo, or the first letter of the name. */
export function AvatarCircle({ userId, name, className, children }: { userId: string; name: string; className: string; children?: React.ReactNode }) {
  const [avatar] = useAvatar(userId);
  const source = avatarSource(avatar);
  const style = source && !source.photo ? { background: AVATAR_BACKGROUNDS[avatar.bg % AVATAR_BACKGROUNDS.length] } : undefined;
  return (
    <span className={className} style={style} aria-hidden>
      {source ? <img src={source.url} alt="" className="nebo-avatar-img" draggable={false} /> : (name.trim().charAt(0).toUpperCase() || 'N')}
      {children}
    </span>
  );
}

type AvatarPickerProps = {
  open: boolean;
  onClose: () => void;
  userId: string;
  name: string;
  birthDate: string;
  plus: boolean;
  onRequestPlus: () => void;
};

export function AvatarPicker({ open, onClose, userId, name, birthDate, plus, onRequestPlus }: AvatarPickerProps) {
  const [avatar, update] = useAvatar(userId);
  const [tab, setTab] = useState<AvatarSet>('cats');
  const [why, setWhy] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const access = matchAccess(avatar, plus);
  const source = avatarSource(avatar);
  const bgColor = AVATAR_BACKGROUNDS[avatar.bg % AVATAR_BACKGROUNDS.length];

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    try {
      update({ kind: 'photo', photo: await photoToAvatar(file) });
      setWhy('');
    } catch {
      setError('Не получилось открыть это фото. Попробуй другое.');
    }
  };

  const chooseFromSet = (set: AvatarSet, index: number) => {
    update({ kind: 'set', set, index });
    setWhy('');
  };

  const match = () => {
    if (access === 'upgrade') { onRequestPlus(); return; }
    if (access === 'wait') return;
    const pick = matchPick(sunSignFromDate(birthDate), avatar.tries);
    update({
      kind: 'set', set: pick.set, index: pick.index, bg: pick.bg,
      tries: avatar.tries + 1,
      plusMonth: access === 'plus' ? monthKey(new Date()) : avatar.plusMonth,
    });
    setWhy(pick.why);
  };

  const matchLabel = access === 'free'
    ? (avatar.tries === 0 ? 'Подобрать по моей карте' : 'Показать второй вариант')
    : access === 'plus' ? 'Подобрать ещё раз (Plus, раз в месяц)'
      : access === 'wait' ? 'Новый подбор будет в следующем месяце'
        : 'Подобрать ещё раз с NEBO Plus';
  const matchHint = access === 'free'
    ? `Бесплатных подборов осталось: ${2 - avatar.tries}.`
    : access === 'upgrade' ? 'Два бесплатных подбора использованы. С NEBO Plus можно подбирать один раз в месяц.'
      : access === 'wait' ? 'В этом месяце подбор уже был. Картинку всегда можно выбрать вручную.' : '';

  return (
    <CosmicSheet open={open} title="Аватарка" onClose={onClose} closeLabel="Готово" className="nebo-avatar-sheet">
      <div className="nebo-avatar-picker">
        <button type="button" className="nebo-avatar-upload" onClick={() => fileRef.current?.click()} aria-label="Загрузить своё фото">
          <span className="nebo-avatar-upload-circle" style={source && !source.photo ? { background: bgColor } : undefined}>
            {source ? <img src={source.url} alt="" className="nebo-avatar-img" draggable={false} /> : <span className="nebo-avatar-letter">{name.trim().charAt(0).toUpperCase() || 'N'}</span>}
            <span className="nebo-avatar-upload-badge"><Camera size={16} strokeWidth={2} aria-hidden /></span>
          </span>
          <span className="nebo-avatar-upload-text">Загрузить своё фото</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
        {error ? <p className="nebo-avatar-error">{error}</p> : null}

        <button type="button" className="nebo-avatar-match" onClick={match} disabled={access === 'wait'}>{matchLabel}</button>
        {why ? <p className="nebo-avatar-why">{why}</p> : null}
        {matchHint ? <p className="nebo-avatar-hint">{matchHint}</p> : null}

        <div className="nebo-avatar-tabs" role="tablist">
          {(Object.keys(AVATAR_SET_TITLE) as AvatarSet[]).map((set) => (
            <button key={set} type="button" role="tab" aria-selected={tab === set} className={tab === set ? 'is-active' : ''} onClick={() => setTab(set)}>
              {AVATAR_SET_TITLE[set]}
            </button>
          ))}
        </div>
        <div className="nebo-avatar-grid">
          {Array.from({ length: AVATAR_SET_SIZE[tab] }, (_, i) => i + 1).map((index) => (
            <button
              key={`${tab}-${index}`}
              type="button"
              className={avatar.kind === 'set' && avatar.set === tab && avatar.index === index ? 'is-picked' : ''}
              style={{ background: bgColor }}
              onClick={() => chooseFromSet(tab, index)}
              aria-label={`${AVATAR_SET_TITLE[tab]} ${index}`}
            >
              <img src={avatarImageUrl(tab, index)} alt="" loading="lazy" draggable={false} />
            </button>
          ))}
        </div>

        {avatar.kind === 'set' ? (
          <div className="nebo-avatar-colors" aria-label="Цвет фона">
            {AVATAR_BACKGROUNDS.map((color, i) => (
              <button key={color} type="button" className={avatar.bg === i ? 'is-picked' : ''} style={{ background: color }} onClick={() => update({ bg: i })} aria-label={`Фон ${i + 1}`} />
            ))}
          </div>
        ) : null}
        {avatar.kind !== 'none' ? (
          <button type="button" className="nebo-avatar-reset" onClick={() => { update({ kind: 'none', photo: '' }); setWhy(''); }}>Убрать аватарку</button>
        ) : null}
      </div>
    </CosmicSheet>
  );
}
