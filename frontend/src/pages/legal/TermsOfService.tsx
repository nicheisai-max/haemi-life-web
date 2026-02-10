import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import './TermsOfService.css';

export const TermsOfService: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="legal-page-container">
            <div className="legal-page-content fade-in">
                <div className="legal-header">
                    <button className="back-btn" onClick={() => navigate(-1)}>
                        <span className="material-icons-outlined">arrow_back</span>
                        Back
                    </button>
                    <h1>Terms of Service</h1>
                    <p className="last-updated">Last updated: February 10, 2026</p>
                </div>

                <Card className="legal-card">
                    <section>
                        <h2>1. Agreement to Terms</h2>
                        <p>
                            By accessing or using the Haemi Life platform, you agree to be bound by these Terms of Service and
                            all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited
                            from using or accessing this platform.
                        </p>
                    </section>

                    <section>
                        <h2>2. Platform Description</h2>
                        <p>
                            Haemi Life is a digital healthcare platform that connects patients with licensed healthcare
                            professionals in Botswana. We provide:
                        </p>
                        <ul>
                            <li>Doctor directory and appointment booking</li>
                            <li>Telemedicine consultations (video/audio)</li>
                            <li>Electronic prescriptions</li>
                            <li>Medical records management</li>
                            <li>Pharmacy services</li>
                        </ul>
                    </section>

                    <section>
                        <h2>3. User Accounts</h2>
                        <h3>3.1 Registration</h3>
                        <p>
                            To use our services, you must create an account and provide accurate, current, and complete information.
                            You are responsible for maintaining the confidentiality of your account credentials.
                        </p>

                        <h3>3.2 Account Types</h3>
                        <ul>
                            <li><strong>Patient Accounts:</strong> For individuals seeking medical care</li>
                            <li><strong>Doctor Accounts:</strong> For licensed medical practitioners (subject to verification)</li>
                            <li><strong>Pharmacist Accounts:</strong> For licensed pharmacists and pharmacy staff</li>
                            <li><strong>Administrator Accounts:</strong> For platform management and support</li>
                        </ul>

                        <h3>3.3 Account Verification</h3>
                        <p>
                            Healthcare professional accounts require verification of licenses and credentials. We reserve the right
                            to suspend or terminate unverified or fraudulent accounts.
                        </p>
                    </section>

                    <section>
                        <h2>4. Medical Services and Disclaimers</h2>
                        <h3>4.1 Not Emergency Services</h3>
                        <p className="important-notice">
                            <strong>IMPORTANT:</strong> Haemi Life is NOT for medical emergencies. In case of a medical emergency,
                            call 911 or go to the nearest emergency room immediately.
                        </p>

                        <h3>4.2 Professional Relationship</h3>
                        <p>
                            The doctor-patient relationship is between you and the healthcare professional you consult. Haemi Life
                            is a platform facilitating these connections but is not a party to the medical relationship.
                        </p>

                        <h3>4.3 Telemedicine Limitations</h3>
                        <p>
                            Telemedicine consultations have limitations. Not all conditions can be diagnosed or treated remotely.
                            Your doctor may recommend an in-person visit if necessary.
                        </p>

                        <h3>4.4 No Medical Advice</h3>
                        <p>
                            Information provided on the platform is for informational purposes only and does not constitute medical
                            advice. Always consult with a qualified healthcare professional for medical decisions.
                        </p>
                    </section>

                    <section>
                        <h2>5. User Responsibilities</h2>
                        <p>As a user of Haemi Life, you agree to:</p>
                        <ul>
                            <li>Provide accurate and truthful health information</li>
                            <li>Use the platform only for lawful purposes</li>
                            <li>Respect the privacy and rights of other users</li>
                            <li>Maintain the confidentiality of your account</li>
                            <li>Comply with all applicable laws and regulations</li>
                            <li>Not share, sell, or transfer your account to others</li>
                            <li>Not attempt to access unauthorized areas of the platform</li>
                            <li>Not upload malicious code or engage in harmful activities</li>
                        </ul>
                    </section>

                    <section>
                        <h2>6. Fees and Payments</h2>
                        <h3>6.1 Consultation Fees</h3>
                        <p>
                            Doctors set their own consultation fees. All fees are displayed before booking and must be paid to
                            access the consultation.
                        </p>

                        <h3>6.2 Platform Fees</h3>
                        <p>
                            Haemi Life may charge service fees for using the platform. These fees will be clearly disclosed before
                            any transaction.
                        </p>

                        <h3>6.3 Refunds</h3>
                        <p>
                            Refund policies vary by service type. Cancellations made within the allowed timeframe may be eligible
                            for refunds. Emergency cancellations by doctors will result in automatic refunds.
                        </p>
                    </section>

                    <section>
                        <h2>7. Intellectual Property</h2>
                        <p>
                            All content on the Haemi Life platform, including text, graphics, logos, and software, is the property
                            of Haemi Life or its licensors and is protected by Botswana and international copyright laws.
                        </p>
                        <p>
                            You may not reproduce, distribute, or create derivative works without our express written permission.
                        </p>
                    </section>

                    <section>
                        <h2>8. Privacy and Data Protection</h2>
                        <p>
                            Your privacy is important to us. Our collection, use, and protection of your personal and health
                            information is governed by our Privacy Policy. By using the platform, you consent to our data
                            practices as described in the Privacy Policy.
                        </p>
                    </section>

                    <section>
                        <h2>9. Limitation of Liability</h2>
                        <p>
                            To the fullest extent permitted by law, Haemi Life shall not be liable for any indirect, incidental,
                            special, consequential, or punitive damages resulting from:
                        </p>
                        <ul>
                            <li>Use or inability to use the platform</li>
                            <li>Unauthorized access to your data</li>
                            <li>Medical advice or treatment received through the platform</li>
                            <li>Technical failures or interruptions</li>
                            <li>Actions or omissions of healthcare professionals</li>
                        </ul>
                    </section>

                    <section>
                        <h2>10. Termination</h2>
                        <p>
                            We reserve the right to terminate or suspend your account at any time, without prior notice, for:
                        </p>
                        <ul>
                            <li>Violation of these Terms of Service</li>
                            <li>Fraudulent or illegal activities</li>
                            <li>Providing false information</li>
                            <li>Abusive behavior towards other users or staff</li>
                        </ul>
                        <p>
                            You may terminate your account at any time by contacting support. Medical records will be retained
                            as required by law.
                        </p>
                    </section>

                    <section>
                        <h2>11. Changes to Terms</h2>
                        <p>
                            We may modify these Terms of Service at any time. We will notify you of material changes via email
                            or platform notification. Your continued use of the platform after changes constitutes acceptance of
                            the new terms.
                        </p>
                    </section>

                    <section>
                        <h2>12. Governing Law</h2>
                        <p>
                            These Terms of Service are governed by the laws of Botswana. Any disputes shall be resolved in the
                            courts of Botswana.
                        </p>
                    </section>

                    <section>
                        <h2>13. Contact Information</h2>
                        <p>For questions about these Terms of Service, please contact:</p>
                        <div className="contact-info">
                            <p><strong>Haemi Life</strong></p>
                            <p>Email: legal@haemi.life</p>
                            <p>Phone: +267 XXX XXXX</p>
                            <p>Address: Gaborone, Botswana</p>
                        </div>
                    </section>
                </Card>

                <div className="legal-actions">
                    <Button
                        variant="outline"
                        onClick={() => window.print()}
                        leftIcon={<span className="material-icons-outlined">print</span>}
                    >
                        Print Terms
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => navigate('/')}
                        leftIcon={<span className="material-icons-outlined">home</span>}
                    >
                        Back to Home
                    </Button>
                </div>
            </div>
        </div>
    );
};
