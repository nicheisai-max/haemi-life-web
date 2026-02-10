import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import './NotFound.css';

export const NotFound: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="not-found-container">
            <div className="not-found-content">
                <div className="not-found-illustration">
                    <span className="material-icons-outlined large-icon">explore_off</span>
                    <div className="pulse-ring"></div>
                </div>
                <h1>Page Not Found</h1>
                <p>The link you followed might be broken, or the page may have been moved.</p>
                <div className="not-found-actions">
                    <Button variant="primary" size="lg" onClick={() => navigate('/dashboard')}>
                        Return to Dashboard
                    </Button>
                    <Button variant="outline" size="lg" onClick={() => navigate(-1)}>
                        Go Back
                    </Button>
                </div>
            </div>
        </div>
    );
};
