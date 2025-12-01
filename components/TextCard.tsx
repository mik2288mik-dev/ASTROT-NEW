import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface TextCardProps {
  title?: string;
  subtitle?: string;
  icon?: string | ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  variant?: 'default' | 'highlight' | 'subtle';
  className?: string;
  animate?: boolean;
}

/**
 * Универсальный компонент карточки для отображения текстовых блоков
 * 
 * Единообразный визуальный стиль:
 * - Красивая типографика
 * - Правильные отступы
 * - Скруглённые углы
 * - Мягкие тени
 * - Различные варианты оформления
 */
export const TextCard: React.FC<TextCardProps> = ({
  title,
  subtitle,
  icon,
  children,
  footer,
  variant = 'default',
  className = '',
  animate = true
}) => {
  const variantStyles = {
    default: 'bg-astro-card border-astro-border',
    highlight: 'bg-gradient-to-br from-astro-highlight/10 to-astro-card border-astro-highlight/30',
    subtle: 'bg-astro-bg border-astro-border/50'
  };

  const cardContent = (
    <div 
      className={`
        rounded-2xl border shadow-soft overflow-hidden
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {/* Header */}
      {(title || subtitle || icon) && (
        <div className="px-6 pt-6 pb-4 border-b border-astro-border/30">
          <div className="flex items-start gap-3">
            {/* Icon */}
            {icon && (
              <div className="flex-shrink-0">
                {typeof icon === 'string' ? (
                  <span className="text-2xl">{icon}</span>
                ) : (
                  icon
                )}
              </div>
            )}

            {/* Title and subtitle */}
            <div className="flex-1 min-w-0">
              {subtitle && (
                <p className="text-[9px] uppercase tracking-[0.15em] text-astro-subtext font-bold mb-1">
                  {subtitle}
                </p>
              )}
              {title && (
                <h3 className="text-lg font-serif text-astro-text leading-tight">
                  {title}
                </h3>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="px-6 py-5">
        <div className="prose prose-sm max-w-none">
          {children}
        </div>
      </div>

      {/* Footer */}
      {footer && (
        <div className="px-6 pb-6 pt-2">
          {footer}
        </div>
      )}
    </div>
  );

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {cardContent}
      </motion.div>
    );
  }

  return cardContent;
};

/**
 * Компонент для отображения текста в правильной типографике
 */
export const TextContent: React.FC<{ children: ReactNode; className?: string }> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={`text-astro-text text-sm leading-relaxed font-light space-y-4 ${className}`}>
      {children}
    </div>
  );
};

/**
 * Компонент для отображения списка советов
 */
export const AdviceList: React.FC<{ items: string[]; title?: string }> = ({ items, title }) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-3">
      {title && (
        <h4 className="text-[10px] uppercase tracking-[0.15em] text-astro-highlight font-bold">
          {title}
        </h4>
      )}
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-3 text-sm text-astro-text font-light leading-relaxed">
            <span className="flex-shrink-0 text-astro-highlight mt-0.5 font-bold">•</span>
            <span className="flex-1">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * Компонент для отображения нумерованного списка
 */
export const NumberedList: React.FC<{ items: string[]; title?: string }> = ({ items, title }) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-3">
      {title && (
        <h4 className="text-[10px] uppercase tracking-[0.15em] text-astro-highlight font-bold">
          {title}
        </h4>
      )}
      <ol className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-3 text-sm text-astro-text font-light leading-relaxed">
            <span className="flex-shrink-0 text-astro-highlight mt-0.5 font-bold">
              {index + 1}.
            </span>
            <span className="flex-1">{item}</span>
          </li>
        ))}
      </ol>
    </div>
  );
};

/**
 * Компонент для отображения параграфов текста
 */
export const Paragraph: React.FC<{ children: ReactNode; className?: string }> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <p className={`text-sm text-astro-text font-light leading-relaxed ${className}`}>
      {children}
    </p>
  );
};

/**
 * Компонент для отображения подзаголовков
 */
export const SectionTitle: React.FC<{ children: ReactNode; icon?: string; className?: string }> = ({ 
  children, 
  icon,
  className = '' 
}) => {
  return (
    <h4 className={`flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-astro-highlight font-bold mb-3 ${className}`}>
      {icon && <span className="text-base">{icon}</span>}
      {children}
    </h4>
  );
};
