import React from 'react';
import { AppTopBar } from '../lumia-ui/AppTopBar';

/* ── Главный хедер: аватар + приветствие (+ дата справа) ── */
interface FreshHeaderProps {
  name: string;
  greeting?: string;
  avatarUrl?: string;
  avatarInitial?: string;
  /** Тап по аватару — например, открыть настройки */
  onAvatarClick?: () => void;
  /** Контент справа на одном уровне с аватаром (например, дата) */
  rightSlot?: React.ReactNode;
  /** Центрированная подача: аватар + приветствие + имя по центру (дата уезжает в контент). */
  centered?: boolean;
}

export const FreshHeader: React.FC<FreshHeaderProps> = ({
  name,
  greeting = 'Доброе утро,',
  avatarUrl,
  avatarInitial,
  onAvatarClick,
  rightSlot,
  centered,
}) => {
  const avatarInner = avatarUrl ? (
    <img src={avatarUrl} alt={name} />
  ) : (
    <span>{avatarInitial || name[0]?.toUpperCase()}</span>
  );

  return (
    <div className={`fresh-header${centered ? ' fresh-header--center' : ''}`}>
      {onAvatarClick ? (
        <button
          type="button"
          className="fresh-header-avatar fresh-header-avatar--btn"
          onClick={onAvatarClick}
          aria-label="Настройки"
        >
          {avatarInner}
        </button>
      ) : (
        <div className="fresh-header-avatar">{avatarInner}</div>
      )}
      <div className="fresh-header-text">
        <div className="fresh-header-hello">{greeting}</div>
        <div className="fresh-header-name">{name}</div>
      </div>
      {!centered && rightSlot ? <div className="fresh-header-right">{rightSlot}</div> : null}
    </div>
  );
};

/* ── Заголовок страницы: кикер (маленький) + дата (большая) ── */
interface FreshPageTitleProps {
  kicker?: string;
  title: string;
}

export const FreshPageTitle: React.FC<FreshPageTitleProps> = ({ kicker, title }) => {
  return (
    <div className="fresh-page-title-block">
      {kicker && <div className="fresh-page-kicker">{kicker}</div>}
      <div
        className="fresh-page-title"
        style={title.includes('\n') ? { whiteSpace: 'pre-line' } : undefined}
      >
        {title}
      </div>
    </div>
  );
};

/* ── Единый верх экранов: (назад) + центр-заголовок (+ подзаголовок) + правое действие ── */
interface FreshInnerHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export const FreshInnerHeader: React.FC<FreshInnerHeaderProps> = ({
  title,
  subtitle,
  onBack,
  rightAction,
}) => {
  return (
    <AppTopBar
      className="fresh-inner-header"
      title={title}
      subtitle={subtitle}
      onBack={onBack}
      rightAction={rightAction}
    />
  );
};

/* ── Строка знака + название (гороскоп) ── */
interface FreshSignRowProps {
  symbol: string;
  name: string;
}

export const FreshSignRow: React.FC<FreshSignRowProps> = ({ symbol, name }) => {
  return (
    <div className="fresh-sign-row">
      <div className="fresh-sign-symbol">{symbol}</div>
      <div className="fresh-sign-name">{name}</div>
    </div>
  );
};

/* ── Заголовок секции ── */
interface FreshSectionHeaderProps {
  title: string;
  linkText?: string;
  onLinkClick?: () => void;
}

export const FreshSectionHeader: React.FC<FreshSectionHeaderProps> = ({
  title,
  linkText,
  onLinkClick,
}) => {
  return (
    <div className="fresh-section-row">
      <div className="fresh-section-title">{title}</div>
      {linkText && (
        <button className="fresh-section-link" onClick={onLinkClick} type="button">
          {linkText}
        </button>
      )}
    </div>
  );
};
