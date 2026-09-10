import React, { memo } from 'react';
import { useNeboDesign } from '../../components/nebo-v2/useNeboDesign';
import { NeboHoroscopeReader } from '../../components/nebo-v2/NeboHoroscopeReader';
import { HoroscopeReader as ClassicHoroscopeReader } from './HoroscopeReaderClassic';
import type { HoroscopeReaderProps } from './HoroscopeReaderClassic';

export type { HoroscopeReaderProps } from './HoroscopeReaderClassic';

export const HoroscopeReader = memo<HoroscopeReaderProps>((props) => {
  const design = useNeboDesign(props.profile);
  if (design.active) return <NeboHoroscopeReader {...props} />;
  return <ClassicHoroscopeReader {...props} />;
});

HoroscopeReader.displayName = 'HoroscopeReader';
