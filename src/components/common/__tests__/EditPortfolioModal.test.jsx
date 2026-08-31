import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import EditPortfolioModal from '../EditPortfolioModal';
import { serviceProfileAPI, userProfileAPI } from '../../../services/api';
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
  userProfileAPI: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    removePhoto: vi.fn(),
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
    userProfileAPI.getProfile.mockResolvedValue({
      success: true,
      data: {
        fullName: 'Provider One',
        profilePhoto: 'https://example.test/provider.jpg',
      },
    });
    userProfileAPI.updateProfile.mockResolvedValue({
      success: true,
      data: { profilePhoto: 'https://example.test/new-provider.jpg' },
    });
    userProfileAPI.removePhoto.mockResolvedValue({ success: true });
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
  });  it('saves a new provider profile picture from Provider Profile', async () => {
    const { container } = render(
      <LanguageProvider>
        <EditPortfolioModal onClose={vi.fn()} />
      </LanguageProvider>,
    );

    expect(await screen.findByText('Profile Picture')).toBeInTheDocument();

    const fileInput = container.querySelector('.provider-profile-photo-section input[type="file"]');
    const photo = new File(['photo'], 'provider.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [photo] } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(userProfileAPI.updateProfile).toHaveBeenCalledTimes(1);
    });

    const submitted = userProfileAPI.updateProfile.mock.calls[0][0];
    expect(submitted).toBeInstanceOf(FormData);
    expect(submitted.get('profilePhoto')).toBe(photo);
  });


});
