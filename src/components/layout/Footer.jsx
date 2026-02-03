import { Link } from 'react-router-dom';
import logo from '../../assets/logo.png';

function Footer() {
  return (
    <footer className="footer py-5">
      <div className="container">
        <div className="row">
          <div className="col-md-3">
            <div className="d-flex align-items-center mb-3">
              <div className="logo-icon me-2">
                <img src={logo} alt="Serbisyo Toledo Logo" width="30" height="30" />
              </div>
              <div className="text-white">
                <div className="fw-bold">Serbisyo Toledo</div>
              </div>
            </div>
            <p className="text-white-50 small">Toledo City</p>
            <div className="social-icons mt-3">
              <a href="#" className="text-white me-3">f</a>
              <a href="#" className="text-white me-3">t</a>
              <a href="#" className="text-white">in</a>
            </div>
          </div>
          <div className="col-md-3">
            <h5 className="text-white mb-3">Types of Services</h5>
            <ul className="list-unstyled">
              <li><Link to="/services/carpentry" className="text-white-50 small">Carpentry</Link></li>
              <li><Link to="/services/plumbing" className="text-white-50 small">Plumbing</Link></li>
              <li><Link to="/services/ac-installation" className="text-white-50 small">AC Installation & Repair</Link></li>
              <li><Link to="/services/house-cleaning" className="text-white-50 small">House Cleaning</Link></li>
              <li><Link to="/services/house-maintenance" className="text-white-50 small">House Maintenance & Repair</Link></li>
              <li><Link to="/services/body-massage" className="text-white-50 small">Body Massage</Link></li>
              <li><Link to="/services/electrician" className="text-white-50 small">Electrician</Link></li>
              <li><Link to="/services/welding" className="text-white-50 small">Welding</Link></li>
              <li><Link to="/services/beauty-care" className="text-white-50 small">Beauty Care</Link></li>
              <li><Link to="/services/photography" className="text-white-50 small">Photography</Link></li>
              <li><Link to="/services/others" className="text-white-50 small">Others</Link></li>
            </ul>
          </div>
          <div className="col-md-3">
            <h5 className="text-white mb-3">About</h5>
            <ul className="list-unstyled">
              <li><Link to="/about" className="text-white-50 small">About Us</Link></li>
              <li><Link to="/contact" className="text-white-50 small">Contact</Link></li>
              <li><Link to="/faq" className="text-white-50 small">FAQ</Link></li>
            </ul>
          </div>
          <div className="col-md-3">
            <h5 className="text-white mb-3">Community</h5>
            <ul className="list-unstyled">
              <li><Link to="/blog" className="text-white-50 small">Blog</Link></li>
              <li><Link to="/forum" className="text-white-50 small">Forum</Link></li>
            </ul>
            <h5 className="text-white mb-3 mt-4">Support</h5>
            <ul className="list-unstyled">
              <li><Link to="/help" className="text-white-50 small">Help Center</Link></li>
              <li><Link to="/privacy" className="text-white-50 small">Privacy</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;