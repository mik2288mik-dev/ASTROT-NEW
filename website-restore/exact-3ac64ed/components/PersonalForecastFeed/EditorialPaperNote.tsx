import React, { type CSSProperties } from 'react';
import type { DiaryPaperTemplateAsset } from '../../lib/personalForecastVisuals';
import { resolveEditorialPaperTreatment } from './editorialLayout';

type EditorialPaperNoteProps = {
  id: string;
  sectionId: string;
  text: string;
  seed: string;
  language: 'ru' | 'en';
  template?: DiaryPaperTemplateAsset | null;
};

export function EditorialPaperNote({
  id,
  sectionId,
  text,
  seed,
  language,
  template,
}: EditorialPaperNoteProps) {
  const treatment = resolveEditorialPaperTreatment(seed);
  const safeTextArea = template?.safeTextArea;
  const style = {
    '--paper-note-rotation': `${template?.canRotate === false ? 0 : treatment.rotationDeg}deg`,
    ...(template && safeTextArea ? {
      '--paper-note-ratio': `${template.width} / ${template.height}`,
      '--paper-note-safe-left': `${safeTextArea[0] * 100}%`,
      '--paper-note-safe-top': `${safeTextArea[1] * 100}%`,
      '--paper-note-safe-right': `${(1 - safeTextArea[2]) * 100}%`,
      '--paper-note-safe-bottom': `${(1 - safeTextArea[3]) * 100}%`,
    } : {}),
  } as CSSProperties;

  return (
    <aside
      id={id}
      lang={language}
      className={[
        'forecast-editorial-paper-note',
        template ? 'has-template' : '',
      ].filter(Boolean).join(' ')}
      data-forecast-section={sectionId}
      data-paper-shape={template ? undefined : treatment.shape}
      data-paper-template={template?.sourceId}
      data-paper-tone={template?.paperTone}
      style={style}
    >
      {template ? (
        <img
          className="forecast-editorial-paper-template"
          src={template.path}
          width={template.width}
          height={template.height}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      ) : (
        <span className="forecast-editorial-paper-tape" aria-hidden="true" />
      )}
      <p>{text}</p>
    </aside>
  );
}
