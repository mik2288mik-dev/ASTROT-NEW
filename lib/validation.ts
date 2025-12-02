/**
 * Валидация входных данных для API-роутов
 * Использует встроенную валидацию без внешних зависимостей
 */

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Валидация даты в формате YYYY-MM-DD
 */
export function validateDate(dateString: string): { isValid: boolean; error?: string } {
  if (!dateString || typeof dateString !== 'string') {
    return { isValid: false, error: 'Date is required' };
  }

  // Проверяем формат YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return { isValid: false, error: 'Date must be in format YYYY-MM-DD' };
  }

  // Проверяем, что дата валидна
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return { isValid: false, error: 'Invalid date' };
  }

  // Проверяем, что дата не в будущем (для даты рождения)
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (date > today) {
    return { isValid: false, error: 'Date cannot be in the future' };
  }

  // Проверяем разумный диапазон (не раньше 1900 года)
  const minDate = new Date('1900-01-01');
  if (date < minDate) {
    return { isValid: false, error: 'Date cannot be before 1900' };
  }

  return { isValid: true };
}

/**
 * Валидация времени в формате HH:MM
 */
export function validateTime(timeString: string): { isValid: boolean; error?: string } {
  if (!timeString || typeof timeString !== 'string') {
    return { isValid: false, error: 'Time is required' };
  }

  // Проверяем формат HH:MM
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(timeString)) {
    return { isValid: false, error: 'Time must be in format HH:MM (24-hour format)' };
  }

  return { isValid: true };
}

/**
 * Валидация имени
 */
export function validateName(name: string): { isValid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'Name is required' };
  }

  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    return { isValid: false, error: 'Name cannot be empty' };
  }

  if (trimmedName.length < 2) {
    return { isValid: false, error: 'Name must be at least 2 characters' };
  }

  if (trimmedName.length > 100) {
    return { isValid: false, error: 'Name must be less than 100 characters' };
  }

  // Проверяем на наличие только допустимых символов (буквы, пробелы, дефисы, апострофы)
  const nameRegex = /^[a-zA-Zа-яА-ЯёЁ\s\-']+$/u;
  if (!nameRegex.test(trimmedName)) {
    return { isValid: false, error: 'Name contains invalid characters' };
  }

  return { isValid: true };
}

/**
 * Валидация места рождения
 */
export function validateBirthPlace(place: string): { isValid: boolean; error?: string } {
  if (!place || typeof place !== 'string') {
    return { isValid: false, error: 'Birth place is required' };
  }

  const trimmedPlace = place.trim();
  if (trimmedPlace.length === 0) {
    return { isValid: false, error: 'Birth place cannot be empty' };
  }

  if (trimmedPlace.length < 2) {
    return { isValid: false, error: 'Birth place must be at least 2 characters' };
  }

  if (trimmedPlace.length > 200) {
    return { isValid: false, error: 'Birth place must be less than 200 characters' };
  }

  return { isValid: true };
}

/**
 * Валидация языка
 */
export function validateLanguage(language: string): { isValid: boolean; error?: string } {
  if (!language || typeof language !== 'string') {
    return { isValid: false, error: 'Language is required' };
  }

  const validLanguages = ['ru', 'en'];
  if (!validLanguages.includes(language)) {
    return { isValid: false, error: `Language must be one of: ${validLanguages.join(', ')}` };
  }

  return { isValid: true };
}

/**
 * Валидация данных для расчета натальной карты
 */
export function validateNatalChartInput(data: {
  name?: string;
  birthDate?: string;
  birthTime?: string;
  birthPlace?: string;
  language?: string;
}): ValidationResult {
  const errors: ValidationError[] = [];

  // Валидация имени
  if (data.name !== undefined) {
    const nameValidation = validateName(data.name);
    if (!nameValidation.isValid) {
      errors.push({ field: 'name', message: nameValidation.error || 'Invalid name' });
    }
  } else {
    errors.push({ field: 'name', message: 'Name is required' });
  }

  // Валидация даты рождения
  if (data.birthDate !== undefined) {
    const dateValidation = validateDate(data.birthDate);
    if (!dateValidation.isValid) {
      errors.push({ field: 'birthDate', message: dateValidation.error || 'Invalid date' });
    }
  } else {
    errors.push({ field: 'birthDate', message: 'Birth date is required' });
  }

  // Валидация времени рождения (опционально)
  if (data.birthTime !== undefined && data.birthTime !== null && data.birthTime !== '') {
    const timeValidation = validateTime(data.birthTime);
    if (!timeValidation.isValid) {
      errors.push({ field: 'birthTime', message: timeValidation.error || 'Invalid time' });
    }
  }

  // Валидация места рождения
  if (data.birthPlace !== undefined) {
    const placeValidation = validateBirthPlace(data.birthPlace);
    if (!placeValidation.isValid) {
      errors.push({ field: 'birthPlace', message: placeValidation.error || 'Invalid birth place' });
    }
  } else {
    errors.push({ field: 'birthPlace', message: 'Birth place is required' });
  }

  // Валидация языка (опционально)
  if (data.language !== undefined && data.language !== null && data.language !== '') {
    const languageValidation = validateLanguage(data.language);
    if (!languageValidation.isValid) {
      errors.push({ field: 'language', message: languageValidation.error || 'Invalid language' });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Валидация данных для синастрии
 */
export function validateSynastryInput(data: {
  profile?: any;
  partnerName?: string;
  partnerDate?: string;
  partnerTime?: string;
  partnerPlace?: string;
  language?: string;
}): ValidationResult {
  const errors: ValidationError[] = [];

  // Валидация профиля
  if (!data.profile) {
    errors.push({ field: 'profile', message: 'Profile is required' });
  } else {
    // Валидируем основные поля профиля
    if (!data.profile.name) {
      errors.push({ field: 'profile.name', message: 'Profile name is required' });
    }
    if (!data.profile.birthDate) {
      errors.push({ field: 'profile.birthDate', message: 'Profile birth date is required' });
    }
    if (!data.profile.birthPlace) {
      errors.push({ field: 'profile.birthPlace', message: 'Profile birth place is required' });
    }
  }

  // Валидация имени партнера
  if (data.partnerName !== undefined) {
    const nameValidation = validateName(data.partnerName);
    if (!nameValidation.isValid) {
      errors.push({ field: 'partnerName', message: nameValidation.error || 'Invalid partner name' });
    }
  } else {
    errors.push({ field: 'partnerName', message: 'Partner name is required' });
  }

  // Валидация даты партнера
  if (data.partnerDate !== undefined) {
    const dateValidation = validateDate(data.partnerDate);
    if (!dateValidation.isValid) {
      errors.push({ field: 'partnerDate', message: dateValidation.error || 'Invalid partner date' });
    }
  } else {
    errors.push({ field: 'partnerDate', message: 'Partner date is required' });
  }

  // Валидация времени партнера (опционально)
  if (data.partnerTime !== undefined && data.partnerTime !== null && data.partnerTime !== '') {
    const timeValidation = validateTime(data.partnerTime);
    if (!timeValidation.isValid) {
      errors.push({ field: 'partnerTime', message: timeValidation.error || 'Invalid partner time' });
    }
  }

  // Валидация языка (опционально)
  if (data.language !== undefined && data.language !== null && data.language !== '') {
    const languageValidation = validateLanguage(data.language);
    if (!languageValidation.isValid) {
      errors.push({ field: 'language', message: languageValidation.error || 'Invalid language' });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Форматирует ошибки валидации в понятное сообщение для пользователя
 */
export function formatValidationErrors(errors: ValidationError[], language: 'ru' | 'en' = 'ru'): string {
  if (errors.length === 0) {
    return language === 'ru' ? 'Ошибка валидации' : 'Validation error';
  }

  if (errors.length === 1) {
    return errors[0].message;
  }

  const errorMessages = errors.map(e => e.message).join(', ');
  return language === 'ru' 
    ? `Ошибки валидации: ${errorMessages}`
    : `Validation errors: ${errorMessages}`;
}
