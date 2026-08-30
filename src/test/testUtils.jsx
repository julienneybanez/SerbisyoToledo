import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../context/LanguageContext';

export const renderWithAppProviders = (ui, { route = '/' } = {}) => render(
  <MemoryRouter initialEntries={[route]}>
    <LanguageProvider>{ui}</LanguageProvider>
  </MemoryRouter>,
);