import { describe, expect, it } from 'vitest';
import { LANGUAGE_DICTIONARY } from '../LanguageContext';

describe('SerbisyoToledo localization audit', () => {
  it('keeps English and Cebuano translation keys in exact parity', () => {
    const englishKeys = Object.keys(LANGUAGE_DICTIONARY.en).sort();
    const cebuanoKeys = Object.keys(LANGUAGE_DICTIONARY.ceb).sort();

    expect(cebuanoKeys).toEqual(englishKeys);
  });

  it('covers critical recent provider, verification, availability, and chatbot flows', () => {
    const criticalKeys = [
      'chatbotWelcome',
      'chatbotInputPlaceholder',
      'postServiceListing',
      'serviceListingSaved',
      'verificationRequestTitle',
      'emailVerificationRequiredLogin',
      'availabilityQuickSetup',
      'availabilityApplyPreset',
      'availabilitySave',
      'providerChecklistVerificationDescription',
      'providerWorkQueue',
    ];

    for (const key of criticalKeys) {
      expect(LANGUAGE_DICTIONARY.en[key]).toBeTruthy();
      expect(LANGUAGE_DICTIONARY.ceb[key]).toBeTruthy();
    }
  });
});
