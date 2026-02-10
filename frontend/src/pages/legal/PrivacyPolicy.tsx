import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import './PrivacyPolicy.css';

export const PrivacyPolicy: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="legal-page-container">
            <div className="legal-page-content fade-in">
                <div className="legal-header">
                    <button className="back-btn" onClick={() => navigate(-1)}>
                        <span className="material-icons-outlined">arrow_back</span>
                        Back
                    </button>
                    <h1>Privacy Policy</h1>
                    <p className="last-updated">Last updated: February 10, 2026</p>
                </div>

                <Card className="legal-card">
                    <section>
                        <h2>1. Introduction</h2>
                        <p>
                            Welcome to Haemi Life ("we," "our," or "us"). We are committed to protecting your personal information
                            and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard
                            your information when you use our digital healthcare platform.
                        </p>
                    </section>

                    <section>
                        <h2>2. Information We Collect</h2>
                        <h3>2.1 Personal Information</h3>
                        <p>We collect personal information that you provide to us, including:</p>
                        <ul>
                            <li>Name, email address, and phone number</li>
                            <li>Omang ID (for verification purposes)</li>
                            <li>Date of birth and gender</li>
                            <li>Address and location information</li>
                        </ul>

                        <h3>2.2 Health Information</h3>
                        <p>As a healthcare platform, we collect and process sensitive health data:</p>
                        <ul>
                            <li>Medical history and diagnoses</li>
                            <li>Prescription records</li>
                            <li>Appointment details</li>
                            <li>Doctor consultation notes</li>
                            <li>Medical test results and reports</li>
                        </ul>

                        <h3>2.3 Usage Data</h3>
                        <p>We automatically collect certain information when you use our platform:</p>
                        <ul>
                            <li>Device information (type, operating system)</li>
                            <li>IP address and browser type</li>
                            <li>Pages visited and features used</li>
                            <li>Session duration and timestamps</li>
                        </ul>
                    </section>

                    <section>
                        <h2>3. How We Use Your Information</h2>
                        <p>We use the collected information for the following purposes:</p>
                        <ul>
                            <li><strong>Provide Healthcare Services:</strong> To facilitate doctor appointments, prescriptions, and medical consultations</li>
                            <li><strong>Account Management:</strong> To create and manage your user account</li>
                            <li><strong>Communication:</strong> To send appointment reminders, health updates, and important notifications</li>
                            <li><strong>Improve Services:</strong> To analyze usage patterns and enhance platform functionality</li>
                            <li><strong>Compliance:</strong> To comply with legal obligations and healthcare regulations in Botswana</li>
                            <li><strong>Security:</strong> To detect, prevent, and address fraud and security issues</li>
                        </ul>
                    </section>

                    <section>
                        <h2>4. Data Sharing and Disclosure</h2>
                        <h3>4.1 Healthcare Providers</h3>
                        <p>
                            We share your health information with doctors, pharmacists, and other healthcare professionals
                            on our platform solely for the purpose of providing medical care.
                        </p>

                        <h3>4.2 Service Providers</h3>
                        <p>
                            We may share data with third-party service providers who assist us in operating our platform,
                            such as cloud hosting, payment processing, and analytics services.
                        </p>

                        <h3>4.3 Legal Requirements</h3>
                        <p>
                            We may disclose your information if required by law, court order, or government regulation.
                        </p>

                        <h3>4.4 Your Consent</h3>
                        <p>
                            We will not sell or rent your personal information to third parties. Any sharing beyond the
                            purposes stated above will require your explicit consent.
                        </p>
                    </section>

                    <section>
                        <h2>5. Data Security</h2>
                        <p>We implement industry-standard security measures to protect your information:</p>
                        <ul>
                            <li>End-to-end encryption for sensitive data transmission</li>
                            <li>Secure data storage with regular backups</li>
                            <li>Access controls and authentication mechanisms</li>
                            <li>Regular security audits and updates</li>
                            <li>Staff training on data protection practices</li>
                        </ul>
                        <p>
                            While we take all reasonable precautions, no method of electronic transmission or storage is
                            100% secure. We cannot guarantee absolute security.
                        </p>
                    </section>

                    <section>
                        <h2>6. Your Data Rights</h2>
                        <p>Under Botswana's Data Protection Act, you have the following rights:</p>
                        <ul>
                            <li><strong>Access:</strong> Request a copy of your personal data</li>
                            <li><strong>Correction:</strong> Request correction of inaccurate information</li>
                            <li><strong>Deletion:</strong> Request deletion of your data (subject to legal obligations)</li>
                            <li><strong>Objection:</strong> Object to certain data processing activities</li>
                            <li><strong>Portability:</strong> Request transfer of your data to another provider</li>
                            <li><strong>Withdrawal:</strong> Withdraw consent for data processing at any time</li>
                        </ul>
                        <p>To exercise these rights, please contact us at privacy@haemi.life</p>
                    </section>

                    <section>
                        <h2>7. Data Retention</h2>
                        <p>
                            We retain your personal and health information for as long as necessary to provide our services
                            and comply with legal obligations. Medical records are kept for a minimum of 7 years as required
                            by Botswana healthcare regulations.
                        </p>
                    </section>

                    <section>
                        <h2>8. Children's Privacy</h2>
                        <p>
                            Our platform is not intended for children under 18 years of age. We do not knowingly collect
                            personal information from children. If you believe we have collected information from a minor,
                            please contact us immediately.
                        </p>
                    </section>

                    <section>
                        <h2>9. International Data Transfers</h2>
                        <p>
                            Your data is primarily stored and processed within Botswana. If we transfer data internationally,
                            we ensure appropriate safeguards are in place to protect your information.
                        </p>
                    </section>

                    <section>
                        <h2>10. Changes to This Policy</h2>
                        <p>
                            We may update this Privacy Policy from time to time. We will notify you of any material changes
                            by posting the new policy on this page and updating the "Last updated" date. Your continued use
                            of the platform after changes constitutes acceptance of the updated policy.
                        </p>
                    </section>

                    <section>
                        <h2>11. Contact Us</h2>
                        <p>If you have questions or concerns about this Privacy Policy, please contact us:</p>
                        <div className="contact-info">
                            <p><strong>Haemi Life</strong></p>
                            <p>Email: privacy@haemi.life</p>
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
                        Print Policy
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
