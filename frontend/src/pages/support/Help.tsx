import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import './Help.css';

interface FAQItem {
    id: number;
    question: string;
    answer: string;
    category: string;
}

const FAQ_ITEMS: FAQItem[] = [
    {
        id: 1,
        category: 'Getting Started',
        question: 'How do I create an account?',
        answer: 'Click the "Sign Up" button on the homepage, choose your role (Patient, Doctor, or Pharmacist), and fill in your details. You\'ll receive a verification code via SMS or email to activate your account.'
    },
    {
        id: 2,
        category: 'Getting Started',
        question: 'Is using Haemi Life free?',
        answer: 'Creating an account is free. Consultation fees are set by individual doctors and displayed before booking. Some features may have platform service fees which are clearly indicated.'
    },
    {
        id: 3,
        category: 'Appointments',
        question: 'How do I book an appointment?',
        answer: 'Go to "Find Doctors", search for a doctor by name or specialization, select your preferred doctor, choose a date and time slot, and confirm your booking. You\'ll receive a confirmation via SMS/email.'
    },
    {
        id: 4,
        category: 'Appointments',
        question: 'Can I cancel or reschedule an appointment?',
        answer: 'Yes. Go to "My Appointments", find the appointment, and click "Cancel". Cancellations made at least 24 hours before the appointment are eligible for a full refund. Contact support for emergency cancellations.'
    },
    {
        id: 5,
        category: 'Appointments',
        question: 'What if my internet connection drops during a video call?',
        answer: 'Our platform automatically adjusts quality based on your connection. If video fails, it switches to audio-only. If disconnected, simply rejoin using the same appointment link within 15 minutes.'
    },
    {
        id: 6,
        category: 'Prescriptions',
        question: 'How do I get my prescription?',
        answer: 'After your consultation, your doctor will send an electronic prescription to your account. View it in "My Prescriptions" and take it to any registered pharmacy on our platform.'
    },
    {
        id: 7,
        category: 'Prescriptions',
        question: 'Can I use my prescription at any pharmacy?',
        answer: 'Yes, you can use your electronic prescription at any pharmacy registered on Haemi Life. Show the prescription code or QR code at the pharmacy counter.'
    },
    {
        id: 8,
        category: 'Account & Security',
        question: 'I forgot my password. How do I reset it?',
        answer: 'Click "Forgot Password" on the login page, enter your email or phone number, verify the OTP code sent to you, and create a new password.'
    },
    {
        id: 9,
        category: 'Account & Security',
        question: 'Is my health information secure?',
        answer: 'Yes. We use end-to-end encryption for all sensitive data, comply with Botswana\'s Data Protection Act, and only share your information with healthcare professionals you consult. See our Privacy Policy for details.'
    },
    {
        id: 10,
        category: 'Doctors',
        question: 'How do I become a verified doctor on Haemi Life?',
        answer: 'Sign up with a Doctor account, complete your profile including specialization and license number, and submit verification documents. Our admin team will review within 2-3 business days.'
    },
    {
        id: 11,
        category: 'Doctors',
        question: 'How do I manage my schedule?',
        answer: 'Go to "Schedule Management" in your doctor dashboard. Toggle days on/off and set your available hours for each day. Changes are effective immediately.'
    },
    {
        id: 12,
        category: 'Technical Issues',
        question: 'The platform is slow or not loading properly',
        answer: 'We\'ve optimized for low-bandwidth connections. Try enabling "Low Data Mode" in Settings. Clear your browser cache or try a different browser. If issues persist, contact support.'
    },
    {
        id: 13,
        category: 'Technical Issues',
        question: 'I can\'t hear audio or see video during consultations',
        answer: 'Check your device permissions for camera/microphone access. Ensure you\'re using a supported browser (Chrome, Firefox, Safari, Edge). Test your connection speed and try audio-only mode if video won\'t work.'
    },
    {
        id: 14,
        category: 'Payments',
        question: 'What payment methods do you accept?',
        answer: 'We accept mobile money (Orange Money, Mascom MyZaka), debit/credit cards, and bank transfers. Payment is processed securely before your appointment.'
    },
    {
        id: 15,
        category: 'Payments',
        question: 'How do refunds work?',
        answer: 'Refunds for cancelled appointments (24+ hours notice) are processed within 5-7 business days to your original payment method. Doctor-initiated cancellations are refunded immediately.'
    }
];

const CATEGORIES = ['All', ...Array.from(new Set(FAQ_ITEMS.map(item => item.category)))];

export const Help: React.FC = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const filteredFAQs = FAQ_ITEMS.filter(item => {
        const matchesSearch = item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.answer.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="help-container">
            <div className="help-content fade-in">
                <div className="help-header">
                    <button className="back-btn" onClick={() => navigate(-1)}>
                        <span className="material-icons-outlined">arrow_back</span>
                        Back
                    </button>
                    <h1>Help & Support</h1>
                    <p>Find answers to common questions or contact our support team</p>
                </div>

                {/* Search Bar */}
                <Card className="search-card">
                    <div className="search-box">
                        <span className="material-icons-outlined">search</span>
                        <input
                            type="text"
                            placeholder="Search for help..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>
                </Card>

                {/* Category Filters */}
                <div className="category-filters">
                    {CATEGORIES.map(category => (
                        <button
                            key={category}
                            className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(category)}
                        >
                            {category}
                        </button>
                    ))}
                </div>

                {/* FAQ List */}
                <div className="faq-list">
                    {filteredFAQs.length === 0 ? (
                        <Card style={{ padding: '3rem', textAlign: 'center' }}>
                            <span className="material-icons-outlined" style={{ fontSize: '64px', opacity: 0.3 }}>
                                search_off
                            </span>
                            <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
                                No results found for "{searchTerm}"
                            </p>
                        </Card>
                    ) : (
                        filteredFAQs.map((faq) => (
                            <Card
                                key={faq.id}
                                className={`faq-item ${expandedId === faq.id ? 'expanded' : ''}`}
                                onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
                            >
                                <div className="faq-question">
                                    <span className="category-tag">{faq.category}</span>
                                    <h3>{faq.question}</h3>
                                    <span className="material-icons-outlined expand-icon">
                                        {expandedId === faq.id ? 'expand_less' : 'expand_more'}
                                    </span>
                                </div>
                                {expandedId === faq.id && (
                                    <div className="faq-answer">
                                        <p>{faq.answer}</p>
                                    </div>
                                )}
                            </Card>
                        ))
                    )}
                </div>

                {/* Contact Support */}
                <Card className="contact-card">
                    <div className="contact-header">
                        <span className="material-icons-outlined">support_agent</span>
                        <div>
                            <h2>Still need help?</h2>
                            <p>Our support team is here to assist you</p>
                        </div>
                    </div>
                    <div className="contact-methods">
                        <div className="contact-method">
                            <span className="material-icons-outlined">email</span>
                            <div>
                                <h4>Email Support</h4>
                                <a href="mailto:support@haemi.life">support@haemi.life</a>
                            </div>
                        </div>
                        <div className="contact-method">
                            <span className="material-icons-outlined">phone</span>
                            <div>
                                <h4>Phone Support</h4>
                                <a href="tel:+267XXXXXXX">+267 XXX XXXX</a>
                                <span className="hours">Mon-Fri, 8:00 AM - 6:00 PM</span>
                            </div>
                        </div>
                    </div>
                    <Button
                        variant="primary"
                        fullWidth
                        leftIcon={<span className="material-icons-outlined">chat</span>}
                    >
                        Start Live Chat
                    </Button>
                </Card>
            </div>
        </div>
    );
};
