import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import './PolicyPage.css';

const PRIVACY_VERSION = '1.0';
const PRIVACY_EFFECTIVE_DATE = 'August 30, 2026';

const SECTIONS = [
  { id: 'data-collected', title: 'What Data May Be Collected' },
  { id: 'why-processed', title: 'Why Information Is Processed' },
  { id: 'provider-verification', title: 'Provider-Verification Data' },
  { id: 'public-information', title: 'What Information May Appear Publicly' },
  { id: 'private-information', title: 'What Remains Private' },
  { id: 'phone-sharing', title: 'Phone-Number Sharing Behavior' },
  { id: 'message-handling', title: 'Message Handling' },
  { id: 'service-location', title: 'Service-Location Handling' },
  { id: 'third-party', title: 'Third-Party Infrastructure/Services' },
  { id: 'security', title: 'Security' },
  { id: 'retention', title: 'Retention' },
  { id: 'privacy-rights', title: 'User Privacy Rights' },
  { id: 'consent-withdrawal', title: 'Consent Withdrawal' },
  { id: 'changes', title: 'Changes to the Privacy Notice' },
  { id: 'contact', title: 'Contact / Support / Privacy Concerns' },
];

const Privacy = () => {
  const { t } = useLanguage();

  return (
    <div className="policy-page">
      <div className="policy-container">
        <header className="policy-header">
          <p className="policy-eyebrow">Serbisyo<span className="brand-toledo">Toledo</span></p>
          <h1>{t('privacyNotice')}</h1>
          <p className="policy-meta">Version {PRIVACY_VERSION} &middot; Effective {PRIVACY_EFFECTIVE_DATE}</p>
          <Link to="/" className="policy-back-link">
            <i className="bi bi-arrow-left" aria-hidden="true"></i> Back to SerbisyoToledo
          </Link>
        </header>

        <nav className="policy-toc" aria-label="Table of contents">
          <h2>Contents</h2>
          <ol>
            {SECTIONS.map((section) => (
              <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>
            ))}
          </ol>
        </nav>

        <div className="policy-content">
          <section id="data-collected">
            <h2>1. What Data May Be Collected</h2>
            <ul>
              <li>Name, email, phone, address</li>
              <li>Service-location details you provide for a booking</li>
              <li>Profile information, languages, profession, skills</li>
              <li>Profile and portfolio images</li>
              <li>Availability you configure as a provider</li>
              <li>Bookings, messages, reviews, reports, and notifications</li>
              <li>Professional credentials you submit for review</li>
              <li>Provider identity-verification data, including a government-issued ID</li>
            </ul>
          </section>

          <section id="why-processed">
            <h2>2. Why Information Is Processed</h2>
            <p>We process this information to: manage your account; authenticate and secure your session; help clients discover providers; support booking and scheduling and prevent conflicts; enable Messages between a booking&rsquo;s participants; support consent-based phone sharing; run provider verification and credential review; support reviews and portfolios; support moderation of reports; deliver notifications; and maintain the security of the system.</p>
          </section>

          <section id="provider-verification">
            <h2>3. Provider-Verification Data</h2>
            <p>
              Government-issued ID and any optional certification/license you submit for provider
              verification is stored privately and reviewed only by SerbisyoToledo administrators for the
              purpose of verifying your identity and eligibility as a provider. It is never published or
              shown to clients.
            </p>
          </section>

          <section id="public-information">
            <h2>4. What Information May Appear Publicly</h2>
            <p>
              Your public provider profile may show your name, profession, skills, languages, service
              categories/types, starting price, portfolio images linked to completed bookings, and your
              review rating/count. Reviews you leave as a client show your name and rating/comment.
            </p>
          </section>

          <section id="private-information">
            <h2>5. What Remains Private</h2>
            <p>
              <strong>Government ID is never public. Private messages are never public. Service locations
              are never shown in public portfolio or review displays. Phone numbers are never automatically
              revealed just because a booking exists.</strong>
            </p>
          </section>

          <section id="phone-sharing">
            <h2>6. Phone-Number Sharing Behavior</h2>
            <p>
              Phone sharing is consent-based: either party to an accepted booking may request the other&rsquo;s
              number, and the number owner explicitly chooses to share or decline. Notifications about a
              phone-share request or response never contain the raw phone number itself.
            </p>
          </section>

          <section id="message-handling">
            <h2>7. Message Handling</h2>
            <p>
              Messages are stored so they persist independently of your connection, and are only accessible
              to the two participants of the booking they belong to. Messages remain part of your account
              history even if your account is later suspended.
            </p>
          </section>

          <section id="service-location">
            <h2>8. Service-Location Handling</h2>
            <p>
              The service location you provide for a booking is saved with that booking and is only shared
              with the other participant of that booking. Changing your account address later does not
              change the location already recorded on an existing booking.
            </p>
          </section>

          <section id="third-party">
            <h2>9. Third-Party Infrastructure/Services</h2>
            <p>
              We use general-purpose infrastructure providers (such as hosting, database, and image-storage
              services) to operate SerbisyoToledo. These providers process data only as needed to provide
              their services to us.
            </p>
          </section>

          <section id="security">
            <h2>10. Security</h2>
            <p>
              We use measures such as password hashing, HttpOnly session cookies, and CSRF protection to
              help secure your account. No system can guarantee absolute security, and we encourage you to
              use a strong, unique password.
            </p>
          </section>

          <section id="retention">
            <h2>11. Retention</h2>
            <p>
              We retain account and booking-related history to preserve a reliable record of bookings,
              reviews, reports, and moderation evidence. Normal moderation suspends or deactivates an
              account rather than deleting this history.
            </p>
          </section>

          <section id="privacy-rights">
            <h2>12. User Privacy Rights</h2>
            <p>
              You may contact SerbisyoToledo support to ask about the information we hold about you.
            </p>
          </section>

          <section id="consent-withdrawal">
            <h2>13. Consent Withdrawal</h2>
            <p>
              You may contact SerbisyoToledo regarding a privacy request, including questions about consent
              you previously gave. Some requests may require a dedicated review process.
            </p>
          </section>

          <section id="changes">
            <h2>14. Changes to the Privacy Notice</h2>
            <p>
              We may update this Privacy Notice from time to time. Material changes will update the version
              number shown at the top of this page.
            </p>
          </section>

          <section id="contact">
            <h2>15. Contact / Support / Privacy Concerns</h2>
            <p>
              Privacy questions or concerns can be sent through the in-app support/contact options available
              to registered users.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
