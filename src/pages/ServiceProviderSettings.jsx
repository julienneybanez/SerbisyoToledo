import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getUser, serviceProfileAPI, userProfileAPI, verificationAPI } from '../services/api';
import useServiceTaxonomy from '../hooks/useServiceTaxonomy';
import SettingsFlash from '../components/settings/SettingsFlash';
import { AppButton, AppInput, AppSelect, PageHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import '../styles/UserSettings.css';
import './ProviderProfileManager.css';

const LANGUAGE_OPTIONS = [
  { value: 'ceb', en: 'Cebuano', ceb: 'Cebuano' },
  { value: 'en', en: 'English', ceb: 'English' },
  { value: 'fil', en: 'Filipino', ceb: 'Filipino' },
];

const RESPONSE_TIME_OPTIONS = [
  'Within 1 hour',
  'Within 2 hours',
  'Within 6 hours',
  'Within 12 hours',
  'Within 24 hours',
  'Same day confirmation',
  '1-2 business days',
];

const EMPTY_CREDENTIAL = {
  credentialName: '',
  credentialType: '',
  issuingOrganization: '',
  credentialId: '',
  issueDate: '',
  expirationDate: '',
  doesNotExpire: false,
  credentialUrl: '',
};

const COPY = {
  en: {
    profileTitle: 'Provider Profile',
    profileSubtitle: 'Manage what clients see about you and the services you offer in one place.',
    preview: 'Preview as Client',
    profileProgress: 'Profile readiness',
    services: 'Services & Pricing',
    servicesHelp: 'Tell clients what work you do, where you work, and your starting daily rate.',
    servicesQuestion: 'What services do you offer?',
    servicesQuestionHelp: 'Choose one or more service categories.',
    jobsQuestion: 'What jobs can clients hire you for?',
    jobsQuestionHelp: 'Choose the specific services that apply to you.',
    serviceArea: 'Service area',
    serviceAreaHelp: 'Enter the barangay or area in Toledo City where you provide this service.',
    startingRate: 'Starting daily rate',
    startingRateHelp: 'Clients will see this as your starting price per day. Final pricing can still be discussed for each booking.',
    coverPhoto: 'Service cover photo',
    coverPhotoHelp: 'Optional. Add a clear photo that represents your work.',
    saveServices: 'Save Services & Pricing',
    savingServices: 'Saving services...',
    verifyFirst: 'Verify your provider account before publishing your services.',
    about: 'About You',
    aboutHelp: 'Add the personal details that help clients understand your experience and communication style.',
    accountName: 'Account name',
    accountNameHelp: 'Your name is managed in Account Settings.',
    profilePhoto: 'Profile picture',
    aboutMe: 'About me',
    aboutPlaceholder: 'Tell clients about your experience and the kind of service they can expect...',
    responseTime: 'Typical response time',
    skills: 'Skills',
    addSkill: 'Add skill',
    languages: 'Languages',
    saveProfile: 'Save Profile Details',
    savingProfile: 'Saving profile...',
    credentials: 'Credentials & Certifications',
    credentialsHelp: 'Optional. Add licenses, TESDA certificates, training certificates, or other qualifications that may help clients evaluate your experience.',
    addCredential: 'Add Credential',
    hideCredentialForm: 'Hide Form',
    portfolio: 'Portfolio & Completed Work',
    portfolioHelp: 'Show completed SerbisyoToledo jobs on your profile. A work photo is optional.',
    linkCompletedJob: 'Add Completed Job',
    noCompletedJobs: 'No completed jobs are available to add yet.',
    selectCompletedJob: 'Select a completed request',
    optionalPhoto: 'Optional work photo',
    addToPortfolio: 'Add to Portfolio',
    profileSaved: 'Profile details saved.',
    servicesSaved: 'Services and pricing saved.',
    credentialSaved: 'Credential saved.',
    credentialSubmitted: 'Credential submitted for review.',
    portfolioAdded: 'Completed job added to your portfolio.',
    loading: 'Loading your provider profile...',
    profileLoadFailed: 'Some provider profile information could not be loaded. You can still edit the available sections below.',
    servicesRequired: 'Choose at least one service category and enter a valid service area and starting rate.',
    noCredentials: 'No credentials added yet.',
    noPortfolio: 'No completed work added yet.',
    draft: 'Draft',
    pending: 'Under review',
    approved: 'Approved',
    rejected: 'Needs changes',
    submitReview: 'Submit for Review',
    remove: 'Remove',
    changePhoto: 'Change Photo',
    uploadPhoto: 'Upload Photo',
    removePhoto: 'Remove Photo',
    addPhoto: 'Add photo',
    changeOptionalPhoto: 'Change optional photo',
    addOptionalPhoto: 'Add optional photo',
    sectionNav: 'Provider profile sections',
  },
  ceb: {
    profileTitle: 'Profile sa Service Provider',
    profileSubtitle: 'I-manage sa usa ka lugar ang impormasyon nga makita sa kliyente ug ang mga serbisyo nga imong gitanyag.',
    preview: 'Tan-awa Ingon Kliyente',
    profileProgress: 'Kahandam sa profile',
    services: 'Mga Serbisyo ug Presyo',
    servicesHelp: 'Ibutang unsang trabaho imong ginabuhat, asa ka moserbisyo, ug ang imong sugod nga inadlaw nga presyo.',
    servicesQuestion: 'Unsang mga serbisyo imong gitanyag?',
    servicesQuestionHelp: 'Pagpili og usa o daghang kategoriya sa serbisyo.',
    jobsQuestion: 'Unsang trabaho ang mahimong ipa-book sa kliyente?',
    jobsQuestionHelp: 'Pilia ang espesipikong mga serbisyo nga angay kanimo.',
    serviceArea: 'Lugar nga imong serbisyohan',
    serviceAreaHelp: 'Ibutang ang barangay o lugar sa Toledo City diin ka moserbisyo.',
    startingRate: 'Sugod nga inadlaw nga presyo',
    startingRateHelp: 'Mao kini ang sugod nga presyo kada adlaw nga makita sa kliyente. Mahisgutan gihapon ang final nga presyo sa matag booking.',
    coverPhoto: 'Cover photo sa serbisyo',
    coverPhotoHelp: 'Opsyonal. Pagbutang og klarong hulagway nga nagrepresentar sa imong trabaho.',
    saveServices: 'I-save ang Mga Serbisyo ug Presyo',
    savingServices: 'Gi-save ang mga serbisyo...',
    verifyFirst: 'Ipa-verify una ang provider account sa dili pa ipakita ang imong mga serbisyo.',
    about: 'Mahitungod Kanimo',
    aboutHelp: 'Ibutang ang impormasyon nga makatabang sa kliyente pagsabot sa imong kasinatian ug paagi sa pakigkomunikar.',
    accountName: 'Ngalan sa account',
    accountNameHelp: 'Ang imong ngalan ma-manage sa Account Settings.',
    profilePhoto: 'Profile picture',
    aboutMe: 'Mahitungod nako',
    aboutPlaceholder: 'Isulti sa kliyente ang imong kasinatian ug unsay ilang mapaabot sa imong serbisyo...',
    responseTime: 'Kasagarang oras sa pagtubag',
    skills: 'Mga kahanas',
    addSkill: 'Idugang ang kahanas',
    languages: 'Mga pinulongan',
    saveProfile: 'I-save ang Profile Details',
    savingProfile: 'Gi-save ang profile...',
    credentials: 'Mga Credential ug Sertipikasyon',
    credentialsHelp: 'Opsyonal. Idugang ang lisensya, TESDA certificate, training certificate, o ubang kwalipikasyon nga makatabang sa kliyente sa pag-evaluate sa imong kasinatian.',
    addCredential: 'Idugang ang Credential',
    hideCredentialForm: 'Tagoa ang Form',
    portfolio: 'Portfolio ug Nahuman nga Trabaho',
    portfolioHelp: 'Ipakita sa imong profile ang nahuman nga SerbisyoToledo jobs. Opsyonal ang hulagway sa trabaho.',
    linkCompletedJob: 'Idugang ang Nahuman nga Trabaho',
    noCompletedJobs: 'Wala pay nahuman nga trabaho nga mahimong idugang.',
    selectCompletedJob: 'Pagpili og nahuman nga request',
    optionalPhoto: 'Opsyonal nga hulagway sa trabaho',
    addToPortfolio: 'Idugang sa Portfolio',
    profileSaved: 'Na-save ang profile details.',
    servicesSaved: 'Na-save ang mga serbisyo ug presyo.',
    credentialSaved: 'Na-save ang credential.',
    credentialSubmitted: 'Na-submit ang credential para sa review.',
    portfolioAdded: 'Naidugang ang nahuman nga trabaho sa portfolio.',
    loading: 'Gi-load ang imong provider profile...',
    profileLoadFailed: 'Adunay impormasyon sa provider profile nga wala ma-load. Mahimo gihapon nimong usbon ang available nga mga seksyon.',
    servicesRequired: 'Pagpili og labing menos usa ka service category ug ibutang ang sakto nga service area ug sugod nga presyo.',
    noCredentials: 'Wala pay credential nga nadugang.',
    noPortfolio: 'Wala pay nahuman nga trabaho nga nadugang.',
    draft: 'Draft',
    pending: 'Gi-review',
    approved: 'Aprubado',
    rejected: 'Kinahanglan usbon',
    submitReview: 'I-submit para sa Review',
    remove: 'Tangtanga',
    changePhoto: 'Ilisi ang Photo',
    uploadPhoto: 'Mag-upload og Photo',
    removePhoto: 'Tangtanga ang Photo',
    addPhoto: 'Idugang ang photo',
    changeOptionalPhoto: 'Ilisi ang opsyonal nga photo',
    addOptionalPhoto: 'Idugang ang opsyonal nga photo',
    sectionNav: 'Mga seksyon sa provider profile',
  },
};

function initials(name) {
  return String(name || 'SP')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'SP';
}

function ProviderAccountSettings() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [flash, setFlash] = useState({ type: 'info', message: '' });
  const [initialSettings, setInitialSettings] = useState(null);
  const [settings, setSettings] = useState({ fullName: '', email: '', phone: '', emailVerified: false });

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser || currentUser.userType !== 'tradesperson') {
      navigate('/');
      return;
    }

    let mounted = true;
    userProfileAPI.getProfile()
      .then((response) => {
        if (!mounted || !response?.success) return;
        const next = {
          fullName: response.data?.fullName || currentUser.fullName || '',
          email: response.data?.email || currentUser.email || '',
          phone: response.data?.phone || '',
          emailVerified: Boolean(response.data?.emailVerified ?? currentUser.emailVerified),
        };
        setSettings(next);
        setInitialSettings(next);
      })
      .catch(() => {
        const next = {
          fullName: currentUser.fullName || '',
          email: currentUser.email || '',
          phone: currentUser.phone || '',
          emailVerified: Boolean(currentUser.emailVerified),
        };
        setSettings(next);
        setInitialSettings(next);
      })
      .finally(() => mounted && setIsLoading(false));

    return () => { mounted = false; };
  }, [navigate]);

  const hasChanges = Boolean(initialSettings && (
    settings.fullName !== initialSettings.fullName || settings.phone !== initialSettings.phone
  ));

  const save = async () => {
    if (!hasChanges) return;
    try {
      setIsSaving(true);
      setFlash({ type: 'info', message: '' });
      const payload = new FormData();
      payload.append('fullName', settings.fullName || '');
      payload.append('phone', settings.phone || '');
      const response = await userProfileAPI.updateProfile(payload);
      if (response?.success) {
        const next = { ...settings, fullName: response.data?.fullName || settings.fullName, phone: response.data?.phone || settings.phone };
        setSettings(next);
        setInitialSettings(next);
        setFlash({ type: 'success', message: t('providerSettingsSavedSuccess') });
      }
    } catch {
      setFlash({ type: 'error', message: t('providerSettingsSaveFailed') });
    } finally {
      setIsSaving(false);
    }
  };

  const resendVerification = async () => {
    try {
      setIsSendingVerification(true);
      await verificationAPI.resendVerification({ email: settings.email });
      setFlash({ type: 'success', message: t('verificationEmailSent') });
    } catch (error) {
      setFlash({ type: 'error', message: error?.message || t('failedSendVerificationEmail') });
    } finally {
      setIsSendingVerification(false);
    }
  };

  return (
    <div className="user-settings-container provider-tool-page provider-tool-account">
      <PageHeader title={t('providerSettingsPageTitle')} className="settings-page-heading" titleClassName="settings-page-title" />
      <div className="settings-layout settings-layout-single">
        <div className="settings-content">
          <SettingsFlash type={flash.type} message={flash.message} />
          <section className="settings-section">
            <h2 className="settings-section-title">{t('providerAccountSettingsTitle')}</h2>
            <div className="settings-group">
              <label className="settings-label">{t('fullName')}</label>
              <AppInput value={settings.fullName} onChange={(event) => setSettings((current) => ({ ...current, fullName: event.target.value }))} disabled={isLoading || isSaving} />
            </div>
            <div className="settings-group">
              <label className="settings-label">{t('emailAddress')}</label>
              <AppInput type="email" value={settings.email} disabled readOnly />
              <small className="settings-help">{t('providerEmailHelpText')}</small>
            </div>
            <div className="settings-card">
              <div className="settings-card-row">
                <div className="settings-card-main">
                  <p className="settings-card-title">{t('emailVerificationStatus')}</p>
                  <p className="settings-card-description"><strong>{settings.emailVerified ? t('verified') : t('notVerified')}</strong></p>
                </div>
                {!settings.emailVerified && (
                  <AppButton variant="secondary" onClick={resendVerification} disabled={isSendingVerification}>
                    {isSendingVerification ? t('sending') : t('resendVerificationEmail')}
                  </AppButton>
                )}
              </div>
            </div>
            <div className="settings-group">
              <label className="settings-label">{t('providerPersonalPhoneLabel')}</label>
              <AppInput type="tel" value={settings.phone} onChange={(event) => setSettings((current) => ({ ...current, phone: event.target.value }))} disabled={isLoading || isSaving} />
              <small className="settings-help">{t('phonePrivacyHelp')}</small>
            </div>
            <div className="settings-section-divider" />
            <h3 className="settings-subsection-title">{t('providerPasswordSecurityTitle')}</h3>
            <AppButton variant="secondary" onClick={() => navigate('/forgot-password', { state: { fromSettings: true, returnTo: '/provider-settings' } })}>
              {t('changePassword')}
            </AppButton>
            <small className="settings-help">{t('providerPasswordSecurityHelp')}</small>
            <div className="settings-actions">
              <AppButton onClick={save} disabled={isSaving || isLoading || !hasChanges}>{isSaving ? t('saving') : t('saveChanges')}</AppButton>
              <AppButton variant="secondary" onClick={() => initialSettings && setSettings(initialSettings)} disabled={isSaving || isLoading || !hasChanges}>{t('reset')}</AppButton>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ProviderProfileSettings() {
  const { language, t } = useLanguage();
  const text = COPY[language === 'ceb' ? 'ceb' : 'en'];
  const user = getUser();
  const { categories, getCategory, getServiceTypesForCategory } = useServiceTaxonomy();
  const profilePhotoInputRef = useRef(null);
  const completedJobPhotoInputRef = useRef(null);
  const linkedJobPhotoInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState({ type: 'info', message: '' });
  const [profile, setProfile] = useState(null);
  const [account, setAccount] = useState(null);
  const [portfolio, setPortfolio] = useState([]);
  const [eligibleJobs, setEligibleJobs] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [availabilityReady, setAvailabilityReady] = useState(false);

  const [services, setServices] = useState({ area: '', rate: '', categories: [], serviceTypes: [] });
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [savingServices, setSavingServices] = useState(false);

  const [about, setAbout] = useState({ aboutMe: '', responseTime: 'Within 24 hours', skills: [] });
  const [newSkill, setNewSkill] = useState('');
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState('');
  const [savingAbout, setSavingAbout] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);

  const [showCredentialForm, setShowCredentialForm] = useState(false);
  const [credential, setCredential] = useState(EMPTY_CREDENTIAL);
  const [credentialFile, setCredentialFile] = useState(null);
  const [savingCredential, setSavingCredential] = useState(false);

  const [selectedCompletedJob, setSelectedCompletedJob] = useState('');
  const [completedJobPhoto, setCompletedJobPhoto] = useState(null);
  const [savingPortfolio, setSavingPortfolio] = useState(false);
  const [linkedPhotoTarget, setLinkedPhotoTarget] = useState(null);

  const applyLoadedData = (profileData, portfolioData, languageData, credentialData, accountData, availabilityData) => {
    const nextProfile = profileData || null;
    const nextPortfolio = portfolioData || {};
    setProfile(nextProfile);
    setPortfolio(nextPortfolio.portfolio || []);
    setCredentials(credentialData || []);
    setSelectedLanguages(languageData || []);
    setAccount(accountData || null);
    setServices({
      area: nextProfile?.location || nextProfile?.barangayAddress || '',
      rate: nextProfile?.startingPrice ? String(nextProfile.startingPrice) : '',
      categories: Array.isArray(nextProfile?.categories) ? nextProfile.categories : [],
      serviceTypes: Array.isArray(nextProfile?.serviceTypes) ? nextProfile.serviceTypes.map((item) => item?.key || item).filter(Boolean) : [],
    });
    setBannerPreview(nextProfile?.image || '');
    setBannerFile(null);
    setAbout({
      aboutMe: nextPortfolio.aboutMe || nextProfile?.aboutMe || '',
      responseTime: nextPortfolio.responseTime || nextProfile?.responseTime || 'Within 24 hours',
      skills: nextPortfolio.skills || nextProfile?.skills || [],
    });
    setProfilePhotoPreview(accountData?.profilePhoto || user?.profileImage || '');
    setProfilePhotoFile(null);
    const entries = availabilityData?.availableSlots || availabilityData?.availability || availabilityData?.specificAvailability || availabilityData?.weeklyBlocks || [];
    setAvailabilityReady(Array.isArray(entries) && entries.length > 0);
  };

  const load = async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      serviceProfileAPI.getMyProfile(),
      serviceProfileAPI.getMyPortfolio(),
      serviceProfileAPI.getMyLanguages(),
      serviceProfileAPI.getMyCredentials(),
      serviceProfileAPI.getEligibleCompletedRequests(),
      userProfileAPI.getProfile(),
      serviceProfileAPI.getMyAvailability(),
    ]);

    const value = (index) => results[index].status === 'fulfilled' && results[index].value?.success ? results[index].value.data : null;
    const profileData = value(0);
    const portfolioData = value(1);
    const languageData = value(2)?.languages || [];
    const credentialData = value(3)?.credentials || [];
    const completedData = value(4)?.requests || [];
    const accountData = value(5);
    const availabilityData = value(6);

    applyLoadedData(profileData, portfolioData, languageData, credentialData, accountData, availabilityData);
    setEligibleJobs(completedData);
    if (results.some((result, index) => result.status === 'rejected' && index !== 0)) {
      setFlash({ type: 'info', message: text.profileLoadFailed });
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading && window.location.hash) {
      const id = window.location.hash.replace('#', '');
      window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [loading]);

  const serviceTypeOptions = useMemo(() => {
    const rows = services.categories.flatMap((categoryValue) => {
      const category = getCategory(categoryValue);
      return getServiceTypesForCategory(categoryValue).map((item) => ({ ...item, categoryLabel: category?.label || categoryValue }));
    });
    return Array.from(new Map(rows.map((item) => [item.key, item])).values());
  }, [getCategory, getServiceTypesForCategory, services.categories]);

  const profileChecks = [
    Boolean(profile?.id && services.categories.length && services.area.trim() && Number(services.rate) > 0),
    Boolean(about.aboutMe.trim()),
    Boolean(selectedLanguages.length),
    Boolean(availabilityReady),
  ];
  const readiness = Math.round((profileChecks.filter(Boolean).length / profileChecks.length) * 100);
  const publicProfileRoute = profile?.id && profile?.isPublished ? `/provider/${profile.id}` : '';

  const toggleCategory = (category) => {
    setServices((current) => {
      const nextCategories = current.categories.includes(category)
        ? current.categories.filter((item) => item !== category)
        : [...current.categories, category];
      const allowed = new Set(nextCategories.flatMap((selected) => getServiceTypesForCategory(selected).map((item) => item.key)));
      return { ...current, categories: nextCategories, serviceTypes: current.serviceTypes.filter((key) => allowed.has(key)) };
    });
  };

  const toggleServiceType = (key) => {
    setServices((current) => ({
      ...current,
      serviceTypes: current.serviceTypes.includes(key) ? current.serviceTypes.filter((item) => item !== key) : [...current.serviceTypes, key],
    }));
  };

  const saveServices = async () => {
    if (!services.categories.length || !services.area.trim() || !(Number(services.rate) > 0)) {
      setFlash({ type: 'error', message: text.servicesRequired });
      return;
    }
    try {
      setSavingServices(true);
      setFlash({ type: 'info', message: '' });
      const payload = new FormData();
      payload.append('barangayAddress', services.area.trim());
      payload.append('startingPrice', String(Number(services.rate)));
      payload.append('pricingUnit', 'per_day');
      payload.append('serviceCategories', JSON.stringify(services.categories));
      payload.append('serviceTypes', JSON.stringify(services.serviceTypes));
      if (bannerFile) payload.append('bannerImage', bannerFile);
      const response = await serviceProfileAPI.createProfile(payload);
      if (response?.success) {
        setFlash({ type: 'success', message: text.servicesSaved });
        window.dispatchEvent(new Event('profileCreated'));
        const refreshed = await serviceProfileAPI.getMyProfile();
        if (refreshed?.success) {
          setProfile(refreshed.data);
          setBannerPreview(refreshed.data?.image || bannerPreview);
          setBannerFile(null);
        }
      }
    } catch (error) {
      setFlash({ type: 'error', message: error?.message || t('serviceListingSaveFailed') });
    } finally {
      setSavingServices(false);
    }
  };

  const addSkill = () => {
    const value = newSkill.trim();
    if (!value || about.skills.includes(value)) return;
    setAbout((current) => ({ ...current, skills: [...current.skills, value] }));
    setNewSkill('');
  };

  const saveAbout = async () => {
    try {
      setSavingAbout(true);
      setFlash({ type: 'info', message: '' });
      const operations = [
        serviceProfileAPI.updatePortfolioDetails({ aboutMe: about.aboutMe, responseTime: about.responseTime, skills: about.skills }),
        serviceProfileAPI.updateMyLanguages(selectedLanguages),
      ];
      if (profilePhotoFile) {
        const payload = new FormData();
        payload.append('profilePhoto', profilePhotoFile);
        operations.push(userProfileAPI.updateProfile(payload));
      }
      const results = await Promise.all(operations);
      const failed = results.find((result) => !result?.success);
      if (failed) throw new Error(failed.message || 'Unable to save profile details.');
      if (profilePhotoFile) {
        const photoResponse = results[2];
        const nextPhoto = photoResponse?.data?.profilePhoto || profilePhotoPreview;
        setProfilePhotoPreview(nextPhoto);
        setProfilePhotoFile(null);
      }
      setFlash({ type: 'success', message: text.profileSaved });
    } catch (error) {
      setFlash({ type: 'error', message: error?.message || 'Unable to save profile details.' });
    } finally {
      setSavingAbout(false);
    }
  };

  const removeProfilePhoto = async () => {
    if (!profilePhotoPreview || !window.confirm(language === 'ceb' ? 'Tangtangon ang imong profile picture?' : 'Remove your profile picture?')) return;
    try {
      setRemovingPhoto(true);
      const response = await userProfileAPI.removePhoto();
      if (response?.success) {
        setProfilePhotoPreview('');
        setProfilePhotoFile(null);
      }
    } catch (error) {
      setFlash({ type: 'error', message: error?.message || 'Unable to remove profile photo.' });
    } finally {
      setRemovingPhoto(false);
    }
  };

  const createCredential = async () => {
    if (!credential.credentialName.trim() || !credential.credentialType.trim()) {
      setFlash({ type: 'error', message: t('providerCredentialNameTypeRequired') });
      return;
    }
    try {
      setSavingCredential(true);
      const payload = new FormData();
      Object.entries(credential).forEach(([key, value]) => payload.append(key, typeof value === 'boolean' ? String(value) : value || ''));
      if (credentialFile) payload.append('document', credentialFile);
      await serviceProfileAPI.createCredential(payload);
      const updated = await serviceProfileAPI.getMyCredentials();
      if (updated?.success) setCredentials(updated.data?.credentials || []);
      setCredential(EMPTY_CREDENTIAL);
      setCredentialFile(null);
      setShowCredentialForm(false);
      setFlash({ type: 'success', message: text.credentialSaved });
    } catch (error) {
      setFlash({ type: 'error', message: error?.message || t('providerCredentialCreateFailed') });
    } finally {
      setSavingCredential(false);
    }
  };

  const submitCredential = async (id) => {
    try {
      setSavingCredential(true);
      await serviceProfileAPI.submitCredentialForReview(id);
      const updated = await serviceProfileAPI.getMyCredentials();
      if (updated?.success) setCredentials(updated.data?.credentials || []);
      setFlash({ type: 'success', message: text.credentialSubmitted });
    } catch (error) {
      setFlash({ type: 'error', message: error?.message || t('providerCredentialSubmitFailed') });
    } finally {
      setSavingCredential(false);
    }
  };

  const addCompletedJob = async () => {
    if (!selectedCompletedJob) return;
    const selected = eligibleJobs.find((item) => Number(item.id) === Number(selectedCompletedJob));
    if (!selected) return;
    try {
      setSavingPortfolio(true);
      const payload = new FormData();
      payload.append('serviceRequestId', String(Number(selectedCompletedJob)));
      payload.append('caption', selected.service_type_label || 'Completed service');
      payload.append('description', '');
      payload.append('serviceCategory', '');
      payload.append('isPublished', 'true');
      payload.append('isFeatured', 'false');
      if (completedJobPhoto) payload.append('portfolioImage', completedJobPhoto);
      const response = await serviceProfileAPI.createPortfolioFromRequest(payload);
      if (response?.success) {
        setSelectedCompletedJob('');
        setCompletedJobPhoto(null);
        if (completedJobPhotoInputRef.current) completedJobPhotoInputRef.current.value = '';
        const [portfolioResult, completedResult] = await Promise.all([
          serviceProfileAPI.getMyPortfolio(),
          serviceProfileAPI.getEligibleCompletedRequests(),
        ]);
        if (portfolioResult?.success) setPortfolio(portfolioResult.data?.portfolio || []);
        if (completedResult?.success) setEligibleJobs(completedResult.data?.requests || []);
        setFlash({ type: 'success', message: text.portfolioAdded });
      }
    } catch (error) {
      setFlash({ type: 'error', message: error?.message || 'Unable to add completed work.' });
    } finally {
      setSavingPortfolio(false);
    }
  };

  const deletePortfolioItem = async (id) => {
    if (!window.confirm(language === 'ceb' ? 'Tangtangon kini sa portfolio?' : 'Remove this item from your portfolio?')) return;
    try {
      const response = await serviceProfileAPI.deletePortfolioImage(id);
      if (response?.success) setPortfolio((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      setFlash({ type: 'error', message: error?.message || 'Unable to remove portfolio item.' });
    }
  };

  const addLinkedPhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !linkedPhotoTarget) return;
    try {
      setSavingPortfolio(true);
      const payload = new FormData();
      payload.append('portfolioImage', file);
      const response = await serviceProfileAPI.updateCompletedPortfolioItemImage(linkedPhotoTarget, payload);
      if (response?.success) {
        const updated = await serviceProfileAPI.getMyPortfolio();
        if (updated?.success) setPortfolio(updated.data?.portfolio || []);
      }
    } catch (error) {
      setFlash({ type: 'error', message: error?.message || 'Unable to add the work photo.' });
    } finally {
      setLinkedPhotoTarget(null);
      setSavingPortfolio(false);
      event.target.value = '';
    }
  };

  if (loading) {
    return <div className="provider-profile-manager provider-profile-loading"><span className="spinner-small" /><p>{text.loading}</p></div>;
  }

  return (
    <div className="provider-profile-manager">
      <PageHeader
        title={text.profileTitle}
        subtitle={text.profileSubtitle}
        action={publicProfileRoute ? (
          <AppButton as={Link} to={`${publicProfileRoute}?previewMode=desktop`} variant="secondary" icon={<i className="bi bi-eye" aria-hidden="true" />}>
            {text.preview}
          </AppButton>
        ) : null}
      />

      <SettingsFlash type={flash.type} message={flash.message} />

      <section className="provider-profile-overview">
        <div>
          <span>{text.profileProgress}</span>
          <strong>{readiness}%</strong>
        </div>
        <div className="provider-profile-progress" role="progressbar" aria-valuenow={readiness} aria-valuemin="0" aria-valuemax="100">
          <span style={{ width: `${readiness}%` }} />
        </div>
      </section>

      <nav className="provider-profile-section-nav" aria-label={text.sectionNav}>
        <a href="#services"><i className="bi bi-tools" />{text.services}</a>
        <a href="#about"><i className="bi bi-person-lines-fill" />{text.about}</a>
        <a href="#credentials"><i className="bi bi-patch-check" />{text.credentials}</a>
        <a href="#portfolio"><i className="bi bi-images" />{text.portfolio}</a>
      </nav>

      <section id="services" className="provider-profile-card provider-profile-anchor">
        <div className="provider-profile-card-heading">
          <div><span className="provider-profile-card-icon"><i className="bi bi-tools" /></span><div><h2>{text.services}</h2><p>{text.servicesHelp}</p></div></div>
        </div>

        {!user?.isVerified && <div className="provider-profile-inline-note"><i className="bi bi-shield-exclamation" />{text.verifyFirst}</div>}

        <div className="provider-profile-field-block">
          <label>{text.servicesQuestion}</label>
          <p>{text.servicesQuestionHelp}</p>
          <div className="provider-profile-choice-grid">
            {categories.map((category) => (
              <label key={category.key} className={`provider-profile-choice ${services.categories.includes(category.label) ? 'selected' : ''}`}>
                <input type="checkbox" checked={services.categories.includes(category.label)} onChange={() => toggleCategory(category.label)} />
                <span>{category.label}</span>
              </label>
            ))}
          </div>
        </div>

        {serviceTypeOptions.length > 0 && (
          <div className="provider-profile-field-block">
            <label>{text.jobsQuestion}</label>
            <p>{text.jobsQuestionHelp}</p>
            <div className="provider-profile-choice-grid service-type-grid">
              {serviceTypeOptions.map((item) => (
                <label key={item.key} className={`provider-profile-choice ${services.serviceTypes.includes(item.key) ? 'selected' : ''}`}>
                  <input type="checkbox" checked={services.serviceTypes.includes(item.key)} onChange={() => toggleServiceType(item.key)} />
                  <span>{item.label}<small>{item.categoryLabel}</small></span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="provider-profile-form-grid">
          <div className="provider-profile-field-block">
            <label htmlFor="provider-service-area">{text.serviceArea}</label>
            <AppInput id="provider-service-area" value={services.area} onChange={(event) => setServices((current) => ({ ...current, area: event.target.value }))} placeholder={language === 'ceb' ? 'Pananglitan: Poblacion' : 'e.g. Poblacion'} />
            <p>{text.serviceAreaHelp}</p>
          </div>
          <div className="provider-profile-field-block">
            <label htmlFor="provider-starting-rate">{text.startingRate}</label>
            <div className="provider-profile-price-input"><span>₱</span><AppInput id="provider-starting-rate" type="number" min="1" value={services.rate} onChange={(event) => setServices((current) => ({ ...current, rate: event.target.value }))} /></div>
            <p>{text.startingRateHelp}</p>
          </div>
        </div>

        <div className="provider-profile-field-block">
          <label>{text.coverPhoto} <span className="optional-label">{t('optional')}</span></label>
          <p>{text.coverPhotoHelp}</p>
          <label className="provider-profile-cover-picker">
            <input type="file" accept="image/*" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setBannerFile(file);
              const reader = new FileReader();
              reader.onload = () => typeof reader.result === 'string' && setBannerPreview(reader.result);
              reader.readAsDataURL(file);
            }} />
            {bannerPreview ? <img src={bannerPreview} alt="" /> : <div><i className="bi bi-image" /><span>{text.coverPhoto}</span></div>}
          </label>
        </div>

        <div className="provider-profile-section-actions">
          <AppButton onClick={saveServices} disabled={savingServices}>{savingServices ? text.savingServices : text.saveServices}</AppButton>
        </div>
      </section>

      <section id="about" className="provider-profile-card provider-profile-anchor">
        <div className="provider-profile-card-heading">
          <div><span className="provider-profile-card-icon"><i className="bi bi-person-lines-fill" /></span><div><h2>{text.about}</h2><p>{text.aboutHelp}</p></div></div>
        </div>

        <div className="provider-profile-identity-row">
          <div className="provider-profile-avatar">
            {profilePhotoPreview ? <img src={profilePhotoPreview} alt="" /> : <span>{initials(account?.fullName || user?.fullName)}</span>}
          </div>
          <div className="provider-profile-identity-copy">
            <strong>{account?.fullName || user?.fullName || t('serviceProvider')}</strong>
            <small>{text.accountNameHelp}</small>
            <div className="provider-profile-inline-actions">
              <input ref={profilePhotoInputRef} type="file" accept="image/*" hidden onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setProfilePhotoFile(file);
                const reader = new FileReader();
                reader.onload = () => typeof reader.result === 'string' && setProfilePhotoPreview(reader.result);
                reader.readAsDataURL(file);
              }} />
              <AppButton variant="secondary" size="sm" onClick={() => profilePhotoInputRef.current?.click()}>{profilePhotoPreview ? text.changePhoto : text.uploadPhoto}</AppButton>
              {profilePhotoPreview && <AppButton variant="ghost" size="sm" onClick={removeProfilePhoto} disabled={removingPhoto}>{text.removePhoto}</AppButton>}
            </div>
          </div>
        </div>

        <div className="provider-profile-field-block">
          <label htmlFor="provider-about-me">{text.aboutMe}</label>
          <textarea id="provider-about-me" rows="5" value={about.aboutMe} onChange={(event) => setAbout((current) => ({ ...current, aboutMe: event.target.value }))} placeholder={text.aboutPlaceholder} />
        </div>

        <div className="provider-profile-form-grid">
          <div className="provider-profile-field-block">
            <label htmlFor="provider-response-time">{text.responseTime}</label>
            <AppSelect id="provider-response-time" value={about.responseTime} onChange={(event) => setAbout((current) => ({ ...current, responseTime: event.target.value }))}>
              {RESPONSE_TIME_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </AppSelect>
          </div>
          <div className="provider-profile-field-block">
            <label>{text.languages}</label>
            <div className="provider-profile-language-row">
              {LANGUAGE_OPTIONS.map((option) => (
                <label key={option.value} className={`provider-language-chip ${selectedLanguages.includes(option.value) ? 'selected' : ''}`}>
                  <input type="checkbox" checked={selectedLanguages.includes(option.value)} onChange={() => setSelectedLanguages((current) => current.includes(option.value) ? current.filter((item) => item !== option.value) : [...current, option.value])} />
                  <span>{option[language === 'ceb' ? 'ceb' : 'en']}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="provider-profile-field-block">
          <label>{text.skills}</label>
          <div className="provider-profile-skills">
            {about.skills.map((skill) => <span key={skill}>{skill}<button type="button" onClick={() => setAbout((current) => ({ ...current, skills: current.skills.filter((item) => item !== skill) }))} aria-label={`${text.remove} ${skill}`}>×</button></span>)}
          </div>
          <div className="provider-profile-add-skill">
            <AppInput value={newSkill} onChange={(event) => setNewSkill(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addSkill(); } }} placeholder={text.addSkill} />
            <AppButton variant="secondary" onClick={addSkill}>{text.addSkill}</AppButton>
          </div>
        </div>

        <div className="provider-profile-section-actions"><AppButton onClick={saveAbout} disabled={savingAbout}>{savingAbout ? text.savingProfile : text.saveProfile}</AppButton></div>
      </section>

      <section id="credentials" className="provider-profile-card provider-profile-anchor">
        <div className="provider-profile-card-heading split">
          <div><span className="provider-profile-card-icon"><i className="bi bi-patch-check" /></span><div><h2>{text.credentials}</h2><p>{text.credentialsHelp}</p></div></div>
          <AppButton variant="secondary" onClick={() => setShowCredentialForm((value) => !value)}>{showCredentialForm ? text.hideCredentialForm : text.addCredential}</AppButton>
        </div>

        {showCredentialForm && (
          <div className="provider-credential-inline-form">
            <div className="provider-profile-form-grid">
              <div className="provider-profile-field-block"><label>{t('providerCredentialNameLabel')}</label><AppInput value={credential.credentialName} onChange={(event) => setCredential((current) => ({ ...current, credentialName: event.target.value }))} /></div>
              <div className="provider-profile-field-block"><label>{t('providerCredentialTypeLabel')}</label><AppSelect value={credential.credentialType} onChange={(event) => setCredential((current) => ({ ...current, credentialType: event.target.value }))}><option value="">{t('providerCredentialTypePlaceholder')}</option><option value="professional_license">{t('providerCredentialTypeProfessionalLicense')}</option><option value="tesda_certification">{t('providerCredentialTypeTesda')}</option><option value="safety_training">{t('providerCredentialTypeSafetyTraining')}</option><option value="technical_certification">{t('providerCredentialTypeTechnicalCertification')}</option><option value="government_accreditation">{t('providerCredentialTypeGovernmentAccreditation')}</option><option value="manufacturer_certification">{t('providerCredentialTypeManufacturerCertification')}</option><option value="training_certificate">{t('providerCredentialTypeTrainingCertificate')}</option><option value="other">{t('providerCredentialTypeOther')}</option></AppSelect></div>
              <div className="provider-profile-field-block"><label>{t('providerIssuingOrganizationLabel')}</label><AppInput value={credential.issuingOrganization} onChange={(event) => setCredential((current) => ({ ...current, issuingOrganization: event.target.value }))} /></div>
              <div className="provider-profile-field-block"><label>{t('providerCredentialIdLabel')}</label><AppInput value={credential.credentialId} onChange={(event) => setCredential((current) => ({ ...current, credentialId: event.target.value }))} /></div>
              <div className="provider-profile-field-block"><label>{t('providerIssueDateLabel')}</label><AppInput type="date" value={credential.issueDate} onChange={(event) => setCredential((current) => ({ ...current, issueDate: event.target.value }))} /></div>
              <div className="provider-profile-field-block"><label>{t('providerExpirationDateLabel')}</label><AppInput type="date" value={credential.expirationDate} onChange={(event) => setCredential((current) => ({ ...current, expirationDate: event.target.value }))} disabled={credential.doesNotExpire} /></div>
            </div>
            <label className="provider-profile-check"><input type="checkbox" checked={credential.doesNotExpire} onChange={(event) => setCredential((current) => ({ ...current, doesNotExpire: event.target.checked }))} />{t('providerCredentialDoesNotExpire')}</label>
            <div className="provider-profile-form-grid">
              <div className="provider-profile-field-block"><label>{t('providerCredentialUrlLabel')}</label><AppInput type="url" value={credential.credentialUrl} onChange={(event) => setCredential((current) => ({ ...current, credentialUrl: event.target.value }))} /></div>
              <div className="provider-profile-field-block"><label>{t('providerCredentialDocumentLabel')}</label><input className="provider-profile-file-input" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(event) => setCredentialFile(event.target.files?.[0] || null)} /></div>
            </div>
            <AppButton onClick={createCredential} disabled={savingCredential}>{savingCredential ? t('saving') : text.addCredential}</AppButton>
          </div>
        )}

        {credentials.length === 0 ? <div className="provider-profile-empty"><i className="bi bi-patch-check" /><p>{text.noCredentials}</p></div> : (
          <div className="provider-credential-list">
            {credentials.map((item) => {
              const status = String(item.verification_status || 'draft').toLowerCase();
              return (
                <article key={item.id} className="provider-credential-row">
                  <div><strong>{item.credential_name}</strong><span>{item.credential_type}</span>{item.verification_notes && <small>{item.verification_notes}</small>}</div>
                  <div className="provider-credential-row-actions"><span className={`provider-profile-status status-${status}`}>{text[status] || status}</span>{status !== 'approved' && status !== 'pending' && <AppButton size="sm" variant="secondary" onClick={() => submitCredential(item.id)} disabled={savingCredential}>{text.submitReview}</AppButton>}</div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section id="portfolio" className="provider-profile-card provider-profile-anchor">
        <div className="provider-profile-card-heading"><div><span className="provider-profile-card-icon"><i className="bi bi-images" /></span><div><h2>{text.portfolio}</h2><p>{text.portfolioHelp}</p></div></div></div>

        <div className="provider-completed-job-form">
          <label>{text.linkCompletedJob}</label>
          <AppSelect value={selectedCompletedJob} onChange={(event) => setSelectedCompletedJob(event.target.value)} disabled={!eligibleJobs.length || savingPortfolio}>
            <option value="">{eligibleJobs.length ? text.selectCompletedJob : text.noCompletedJobs}</option>
            {eligibleJobs.map((item) => <option key={item.id} value={item.id}>{item.service_type_label || 'Completed service'} · {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</option>)}
          </AppSelect>
          <input ref={completedJobPhotoInputRef} type="file" accept="image/*" hidden onChange={(event) => setCompletedJobPhoto(event.target.files?.[0] || null)} />
          <div className="provider-profile-inline-actions">
            <AppButton variant="secondary" onClick={() => completedJobPhotoInputRef.current?.click()} disabled={savingPortfolio}>{completedJobPhoto ? text.changeOptionalPhoto : text.addOptionalPhoto}</AppButton>
            {completedJobPhoto && <small>{completedJobPhoto.name}</small>}
          </div>
          <AppButton onClick={addCompletedJob} disabled={!selectedCompletedJob || savingPortfolio}>{savingPortfolio ? t('saving') : text.addToPortfolio}</AppButton>
        </div>

        <input ref={linkedJobPhotoInputRef} type="file" accept="image/*" hidden onChange={addLinkedPhoto} />
        {portfolio.length === 0 ? <div className="provider-profile-empty"><i className="bi bi-images" /><p>{text.noPortfolio}</p></div> : (
          <div className="provider-profile-portfolio-grid">
            {portfolio.map((item) => (
              <article key={item.id} className="provider-profile-work-card">
                {item.src ? <img src={item.src} alt={item.serviceLabel || item.caption || ''} /> : <div className="provider-profile-work-placeholder"><i className="bi bi-briefcase-fill" /><strong>{item.serviceLabel || item.caption || 'Completed job'}</strong><small>SerbisyoToledo</small></div>}
                <div className="provider-profile-work-copy"><strong>{item.serviceLabel || item.caption || 'Completed job'}</strong><div>{!item.src && item.completedThroughPlatform && <AppButton size="sm" variant="secondary" onClick={() => { setLinkedPhotoTarget(item.id); linkedJobPhotoInputRef.current?.click(); }}>{text.addPhoto}</AppButton>}<AppButton size="sm" variant="ghost" onClick={() => deletePortfolioItem(item.id)}>{text.remove}</AppButton></div></div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function ServiceProviderSettings() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname !== '/provider-settings') return;
    const section = new URLSearchParams(location.search).get('section');
    if (section === 'schedule' || section === 'availability') navigate('/provider-schedule?tab=availability', { replace: true });
    if (section === 'profile' || section === 'credentials') navigate('/provider-credentials', { replace: true });
  }, [location.pathname, location.search, navigate]);

  return location.pathname === '/provider-credentials'
    ? <ProviderProfileSettings />
    : <ProviderAccountSettings />;
}
