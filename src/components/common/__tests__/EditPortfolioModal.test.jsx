import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import EditPortfolioModal from '../EditPortfolioModal';
import { serviceProfileAPI } from '../../../services/api';
import { LanguageProvider } from '../../../context/LanguageContext';

vi.mock('../../../services/api', () => ({
  serviceProfileAPI: {
    getMyPortfolio: vi.fn(),
    getEligibleCompletedRequests: vi.fn(),
    getMyLanguages: vi.fn(),
    updatePortfolioDetails: vi.fn(),
    updateMyLanguages: vi.fn(),
    createPortfolioFromRequest: vi.fn(),
    updateCompletedPortfolioItemImage: vi.fn(),
    deletePortfolioImage: vi.fn(),
  },
}));

describe('EditPortfolioModal provider languages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceProfileAPI.getMyPortfolio.mockResolvedValue({
      success: true,
      data: {
        aboutMe: 'Experienced provider',
        responseTime: 'Within 24 hours',
        skills: ['Repair'],
        portfolio: [],
      },
    });
    serviceProfileAPI.getEligibleCompletedRequests.mockResolvedValue({
      success: true,
      data: { requests: [] },
    });
    serviceProfileAPI.getMyLanguages.mockResolvedValue({
      success: true,
      data: { languages: ['ceb', 'en'] },
    });
    serviceProfileAPI.updatePortfolioDetails.mockResolvedValue({ success: true });
    serviceProfileAPI.updateMyLanguages.mockResolvedValue({ success: true });
  });

  it('loads signup languages into Provider Profile and saves them from there', async () => {
    render(
      <LanguageProvider>
        <EditPortfolioModal onClose={vi.fn()} />
      </LanguageProvider>,
    );

    expect(await screen.findByText('Edit Provider Profile')).toBeInTheDocument();

    const cebuano = screen.getByRole('checkbox', { name: 'Cebuano' });
    const english = screen.getByRole('checkbox', { name: 'English' });
    const filipino = screen.getByRole('checkbox', { name: 'Filipino' });

    expect(cebuano).toBeChecked();
    expect(english).toBeChecked();
    expect(filipino).not.toBeChecked();

    fireEvent.click(filipino);
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(serviceProfileAPI.updateMyLanguages).toHaveBeenCalledWith(['ceb', 'en', 'fil']);
    });
  });
});
