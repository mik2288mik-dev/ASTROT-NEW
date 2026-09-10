import React from 'react';

type EditorialQuoteProps = {
  id: string;
  sectionId: string;
  text: string;
  language: 'ru' | 'en';
};

export function EditorialQuote({
  id,
  sectionId,
  text,
  language,
}: EditorialQuoteProps) {
  return (
    <blockquote
      id={id}
      lang={language}
      className="forecast-editorial-quote"
      data-forecast-section={sectionId}
    >
      <span aria-hidden="true">“</span>
      <p>{text}</p>
    </blockquote>
  );
}
