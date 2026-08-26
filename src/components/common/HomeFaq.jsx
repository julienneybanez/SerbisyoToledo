import { useLanguage } from '../../context/LanguageContext';
import Reveal from './Reveal';
import './HomeFaq.css';

const FAQ_COPY = {
  en: {
    title: 'Frequently Asked Questions',
    subtitle: 'Quick answers about finding, booking, and offering services through SerbisyoToledo.',
    items: [
      {
        question: 'How do I book a service provider?',
        answer: 'Browse or search for a provider, open their profile, choose Request Service, add your preferred schedule and service details, then submit the request. You need to be logged in as a client to send and manage booking requests.',
      },
      {
        question: 'Do I need an account to browse services?',
        answer: 'No. You can browse service providers and view public provider profiles without signing in. An account is required when you want to send or manage a booking request.',
      },
      {
        question: 'Are service providers verified?',
        answer: 'Service providers can submit verification requests and credentials for review. Approved providers may display a verified indicator on their profile. You should still compare their profile, services, availability, and reviews before booking.',
      },
      {
        question: 'How are payments handled?',
        answer: 'SerbisyoToledo does not process online payments. Payment is handled offline directly between the client and service provider, so both parties should agree on the price and payment method before the service begins.',
      },
      {
        question: 'Can I choose the date and time for the service?',
        answer: 'Yes. You can request a preferred available schedule when booking. The provider can accept or decline the request, and a different schedule can be proposed when needed.',
      },
      {
        question: 'What happens if a provider declines my request?',
        answer: 'Your booking status will be updated so you can see that the request was declined. You can return to Browse Services and choose another provider that fits your needs.',
      },
      {
        question: 'How do I become a service provider?',
        answer: 'Create a service provider account and complete your profile with your services, experience, location, rate, availability, and portfolio. Once your profile is ready, you can receive booking requests from clients and submit verification information for review.',
      },
    ],
  },
  ceb: {
    title: 'Mga Kasagarang Pangutana',
    subtitle: 'Dali nga tubag sa mga pangutana bahin sa pagpangita, pag-book, ug paghatag og serbisyo pinaagi sa SerbisyoToledo.',
    items: [
      {
        question: 'Unsaon nako pag-book og service provider?',
        answer: 'Pangita o browse og provider, ablihi ang iyang profile, pilia ang Request Service, isulod ang gusto nimong schedule ug detalye sa serbisyo, unya isumite ang request. Kinahanglan naka-login isip kliyente aron makapadala ug makadumala sa booking requests.',
      },
      {
        question: 'Kinahanglan ba og account para motan-aw sa mga serbisyo?',
        answer: 'Dili. Pwede kang motan-aw sa service providers ug public provider profiles bisan wala naka-login. Kinahanglan lang og account kung gusto ka mopadala o modumala og booking request.',
      },
      {
        question: 'Verified ba ang mga service provider?',
        answer: 'Ang service providers mahimong mosumite og verification request ug credentials para ma-review. Ang naaprubahang providers mahimong adunay verified indicator sa ilang profile. Maayo gihapon nga ikumpara ang profile, serbisyo, availability, ug reviews sa dili pa mag-book.',
      },
      {
        question: 'Giunsa pagbayad sa serbisyo?',
        answer: 'Ang SerbisyoToledo dili mo-process og online payment. Ang bayad himuon offline direkta tali sa kliyente ug service provider, busa kinahanglan magkasabot daan sa presyo ug paagi sa pagbayad sa dili pa magsugod ang serbisyo.',
      },
      {
        question: 'Makapili ba ko sa petsa ug oras sa serbisyo?',
        answer: 'Oo. Pwede nimo pilion ang gusto nimong available nga schedule sa pag-book. Ang provider mahimong modawat o mobalibad sa request, ug mahimong mag-propose og laing schedule kung kinahanglan.',
      },
      {
        question: 'Unsa mahitabo kung balibaran sa provider akong request?',
        answer: 'Ma-update ang status sa imong booking aron makita nimo nga gibalibaran ang request. Pwede ka mobalik sa Browse Services ug mopili og laing provider nga angay sa imong kinahanglan.',
      },
      {
        question: 'Unsaon nako pagkahimong service provider?',
        answer: 'Paghimo og service provider account ug kompletoha ang imong profile gamit ang imong serbisyo, kasinatian, lokasyon, presyo, availability, ug portfolio. Kung andam na ang profile, makadawat ka og booking requests gikan sa mga kliyente ug makasumite og verification information para ma-review.',
      },
    ],
  },
};

function HomeFaq() {
  const { language } = useLanguage();
  const copy = FAQ_COPY[language] || FAQ_COPY.en;

  return (
    <section className="home-faq-section" aria-labelledby="home-faq-title">
      <div className="container">
        <div className="home-faq-shell">
          <Reveal className="home-faq-heading">
            <h2 id="home-faq-title" className="section-title">{copy.title}</h2>
            <p className="section-subtitle">{copy.subtitle}</p>
          </Reveal>

          <div className="home-faq-list">
            {copy.items.map((item, index) => (
              <Reveal
                as="details"
                className="home-faq-item"
                key={item.question}
                delay={Math.min(index * 55, 220)}
                open={index === 0 ? true : undefined}
              >
                <summary className="home-faq-question">
                  <span>{item.question}</span>
                  <i className="bi bi-chevron-down home-faq-chevron" aria-hidden="true"></i>
                </summary>
                <div className="home-faq-answer">
                  <p>{item.answer}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default HomeFaq;
