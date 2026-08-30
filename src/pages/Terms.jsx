import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import './PolicyPage.css';

const TERMS_VERSION = '1.0';
const TERMS_EFFECTIVE_DATE = 'August 30, 2026';

const SECTIONS = [
  { id: 'about', title: 'About SerbisyoToledo' },
  { id: 'account-responsibilities', title: 'Account Responsibilities' },
  { id: 'accurate-information', title: 'Accurate Information' },
  { id: 'provider-responsibilities', title: 'Service-Provider Responsibilities' },
  { id: 'verification-disclaimer', title: 'Provider Verification Disclaimer' },
  { id: 'service-listings', title: 'Service Listings' },
  { id: 'pricing', title: 'Per-Day Pricing / Booking Estimates' },
  { id: 'bookings', title: 'Bookings and Scheduling' },
  { id: 'rescheduling', title: 'Rescheduling / Cancellation' },
  { id: 'messaging', title: 'Messaging' },
  { id: 'contact-sharing', title: 'Phone / Contact Sharing' },
  { id: 'reviews', title: 'Reviews' },
  { id: 'portfolio', title: 'Portfolio / Completed-Job Information' },
  { id: 'reports', title: 'Reports / Moderation' },
  { id: 'prohibited-conduct', title: 'Prohibited Conduct' },
  { id: 'suspension', title: 'Account Suspension' },
  { id: 'availability', title: 'Platform Availability' },
  { id: 'relationship', title: 'Relationship Between Client/Provider and SerbisyoToledo' },
  { id: 'privacy-reference', title: 'Privacy Reference' },
  { id: 'changes', title: 'Changes to Terms' },
  { id: 'contact', title: 'Contact / Support' },
];

const Terms = () => {
  const { t } = useLanguage();

  return (
    <div className="policy-page">
      <div className="policy-container">
        <header className="policy-header">
          <p className="policy-eyebrow">Serbisyo<span className="brand-toledo">Toledo</span></p>
          <h1>{t('termsAndConditions')}</h1>
          <p className="policy-meta">Version {TERMS_VERSION} &middot; Effective {TERMS_EFFECTIVE_DATE}</p>
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
          <section id="about">
            <h2>1. About SerbisyoToledo</h2>
            <p>
              SerbisyoToledo is a platform that connects clients in Toledo City with independent local
              service providers (&ldquo;providers&rdquo;). SerbisyoToledo helps clients discover, book, and
              communicate with providers. <strong>SerbisyoToledo does not itself perform the services</strong>
              {' '}listed on the platform &mdash; each service is performed directly by the provider a client books.
            </p>
          </section>

          <section id="account-responsibilities">
            <h2>2. Account Responsibilities</h2>
            <p>
              You are responsible for keeping your account credentials confidential and for all activity
              under your account. Notify us promptly if you suspect unauthorized access to your account.
            </p>
          </section>

          <section id="accurate-information">
            <h2>3. Accurate Information</h2>
            <p>
              You agree to provide accurate, current information when registering, updating your profile,
              or submitting a booking, verification request, or report. Inaccurate information may affect
              your ability to use certain features and may result in account suspension.
            </p>
          </section>

          <section id="provider-responsibilities">
            <h2>4. Service-Provider Responsibilities</h2>
            <p>
              Providers are independent individuals or businesses, not employees or agents of
              SerbisyoToledo. Providers are responsible for the quality, safety, legality, and completion
              of the services they perform, and for honoring the schedules and estimates they commit to.
            </p>
          </section>

          <section id="verification-disclaimer">
            <h2>5. Provider Verification Disclaimer</h2>
            <p>
              SerbisyoToledo offers a provider verification process that reviews identity documents and,
              optionally, professional credentials. <strong>Verification indicates that a provider has
              completed the applicable platform verification process &mdash; it is not a guarantee of
              service quality, outcome, or conduct.</strong> Clients should still use their own judgment
              when booking any provider.
            </p>
          </section>

          <section id="service-listings">
            <h2>6. Service Listings</h2>
            <p>
              Providers are responsible for the accuracy of their own service listings, including
              categories, service types, pricing, and availability. SerbisyoToledo may remove or unpublish
              listings that violate these Terms or applicable law.
            </p>
          </section>

          <section id="pricing">
            <h2>7. Per-Day Pricing / Booking Estimates</h2>
            <p>
              SerbisyoToledo currently supports per-day pricing for service listings. The price and
              estimated total shown at booking time are recorded as part of that booking and remain
              stable for that booking even if a provider later changes their listed price.
            </p>
          </section>

          <section id="bookings">
            <h2>8. Bookings and Scheduling</h2>
            <p>
              A booking request becomes confirmed only once a provider accepts it. Providers set their own
              available dates and time windows; SerbisyoToledo helps prevent obvious scheduling conflicts
              but does not guarantee availability beyond what a provider has configured.
            </p>
          </section>

          <section id="rescheduling">
            <h2>9. Rescheduling / Cancellation</h2>
            <p>
              Either party may propose a reschedule before a provider is on the way, subject to the
              platform&rsquo;s reschedule rules (including only one pending proposal at a time). Bookings may
              be cancelled with a stated reason before they are completed, according to the cancellation
              options presented in the app.
            </p>
          </section>

          <section id="messaging">
            <h2>10. Messaging</h2>
            <p>
              Messages are tied to a specific booking and are available only to that booking&rsquo;s client and
              provider. Use Messages for booking-related communication only. Once a booking is completed,
              declined, or cancelled, its conversation becomes read-only.
            </p>
          </section>

          <section id="contact-sharing">
            <h2>11. Phone / Contact Sharing</h2>
            <p>
              Phone numbers are private by default. Either party to an accepted booking may request the
              other&rsquo;s phone number; the number owner decides whether to share or decline. See our
              <Link to="/privacy#provider-verification"> Privacy Notice</Link> for details.
            </p>
          </section>

          <section id="reviews">
            <h2>12. Reviews</h2>
            <p>
              Clients may leave one review per completed booking. Reviews should reflect genuine
              experiences. SerbisyoToledo may remove reviews that violate these Terms.
            </p>
          </section>

          <section id="portfolio">
            <h2>13. Portfolio / Completed-Job Information</h2>
            <p>
              A provider&rsquo;s public portfolio may only include work linked to a completed SerbisyoToledo
              booking. Private job details, client identity, service location, and pricing are never shown
              in a public portfolio entry.
            </p>
          </section>

          <section id="reports">
            <h2>14. Reports / Moderation</h2>
            <p>
              Clients and providers may report conduct that violates these Terms. Reports are reviewed by
              SerbisyoToledo administrators and may result in warnings, suspension, or other action.
            </p>
          </section>

          <section id="prohibited-conduct">
            <h2>15. Prohibited Conduct</h2>
            <p>
              You may not use SerbisyoToledo for unlawful purposes, to harass other users, to submit false
              information (including false verification documents), or to circumvent the platform&rsquo;s
              safety and privacy features.
            </p>
          </section>

          <section id="suspension">
            <h2>16. Account Suspension</h2>
            <p>
              SerbisyoToledo may suspend or deactivate an account that violates these Terms. Normal
              moderation suspends or deactivates an account rather than deleting its booking, review,
              report, or message history.
            </p>
          </section>

          <section id="availability">
            <h2>17. Platform Availability</h2>
            <p>
              SerbisyoToledo is provided on an &ldquo;as available&rdquo; basis. We do not guarantee
              uninterrupted access and may perform maintenance that temporarily affects availability.
            </p>
          </section>

          <section id="relationship">
            <h2>18. Relationship Between Client/Provider and SerbisyoToledo</h2>
            <p>
              SerbisyoToledo is a platform operator, not a party to the service agreement between a client
              and a provider. Any dispute about the service performed is between the client and the
              provider, without prejudice to SerbisyoToledo&rsquo;s moderation and reporting tools.
            </p>
          </section>

          <section id="privacy-reference">
            <h2>19. Privacy Reference</h2>
            <p>
              Our <Link to="/privacy">Privacy Notice</Link> explains what information we collect, why, and
              how it is used and protected. It forms part of these Terms.
            </p>
          </section>

          <section id="changes">
            <h2>20. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. Material changes will update the version number
              shown at the top of this page.
            </p>
          </section>

          <section id="contact">
            <h2>21. Contact / Support</h2>
            <p>
              Questions about these Terms can be sent through the in-app support/contact options available
              to registered users.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Terms;
