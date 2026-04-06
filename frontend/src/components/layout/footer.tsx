import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
    return (
        <footer className="haemi-footer-root footer-attached">
            <div className="haemi-footer-container">
                <div className="haemi-footer-copyright">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span>
                        &copy; {new Date().getFullYear()} <span className="haemi-footer-brand">Haemi Life System</span>. All rights reserved.
                    </span>
                </div>

                <div className="haemi-footer-nav">
                    <Link to="/privacy-policy" className="haemi-footer-link">Privacy Policy</Link>
                    <Link to="/terms-of-service" className="haemi-footer-link">Terms of Service</Link>
                    <Link to="/help" className="haemi-footer-link">Support</Link>
                    <span className="haemi-footer-badge">
                        v2.1.0-stable
                    </span>
                </div>
            </div>
        </footer>
    );
};
