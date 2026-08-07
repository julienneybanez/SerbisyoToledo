/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState } from 'react';

const STORAGE_KEY = 'serbisyo-toledo-language';
const DEFAULT_LANGUAGE = 'en';

const DICTIONARY = {
  en: {
    language: 'Language',
    home: 'Home',
    about: 'About',
    myDashboard: 'My Dashboard',
    browseServices: 'Browse Services',
    requests: 'Requests',
    editProfile: 'Edit Profile',
    editServiceProfile: 'Edit Service Profile',
    postServiceProfile: 'Post Service Profile',
    requestVerification: 'Request Verification',
    viewProfileAsClient: 'View Profile as Client',
    viewProfilePostFirst: 'View Profile as Client (Post first)',
    settings: 'Settings',
    logOut: 'Log Out',
    logIn: 'Log In',
    signUp: 'Sign Up',
    serviceProvider: 'Service Provider',
    admin: 'Admin',
    client: 'Client',
    footerCopyright: 'All rights reserved.',
    footerTagline: 'Trusted local services for homes and communities in Toledo City.',
    footerQuickLinks: 'Quick Links',
    footerBecomeProvider: 'Become a Provider',
    footerContact: 'Contact',
    footerOfflinePayments: 'Payments are handled offline between client and provider.',
  },
  ceb: {
    language: 'Pinulongan',
    home: 'Balay',
    about: 'Mahitungod',
    myDashboard: 'Akong Dashboard',
    browseServices: 'Tan-awa ang mga Serbisyo',
    requests: 'Mga Hangyo',
    editProfile: 'Usba ang Profile',
    editServiceProfile: 'Usba ang Service Profile',
    postServiceProfile: 'I-post ang Service Profile',
    requestVerification: 'Mangayo og Verification',
    viewProfileAsClient: 'Tan-awa ang Profile isip Kliyente',
    viewProfilePostFirst: 'Tan-awa ang Profile isip Kliyente (Pag-post una)',
    settings: 'Mga Setting',
    logOut: 'Pag-logout',
    logIn: 'Pag-login',
    signUp: 'Pag-sign up',
    serviceProvider: 'Service Provider',
    admin: 'Admin',
    client: 'Kliyente',
    footerCopyright: 'Tanang katungod gitagana.',
    footerTagline: 'Kasaligang lokal nga serbisyo para sa panimalay ug komunidad sa Toledo City.',
    footerQuickLinks: 'Mga Dali nga Link',
    footerBecomeProvider: 'Mahimong Service Provider',
    footerContact: 'Kontak',
    footerOfflinePayments: 'Ang bayad himuon offline tali sa kliyente ug provider.',
  },
};

const LanguageContext = createContext(null);

const getInitialLanguage = () => {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && DICTIONARY[stored]) {
    return stored;
  }

  return DEFAULT_LANGUAGE;
};

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(getInitialLanguage);

  const value = useMemo(() => ({
    language,
    setLanguage: (next) => {
      const resolved = DICTIONARY[next] ? next : DEFAULT_LANGUAGE;
      setLanguage(resolved);
      window.localStorage.setItem(STORAGE_KEY, resolved);
    },
    t: (key) => DICTIONARY[language]?.[key] || DICTIONARY[DEFAULT_LANGUAGE][key] || key,
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }

  return context;
}
