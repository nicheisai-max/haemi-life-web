import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import './TelemedicineConsent.css';

export const TelemedicineConsent: React.FC = () => {
    const navigate = useNavigate();
    const [accepted, setAccepted] = React.useState(false);

    const handleAccept = () => {
        // Store consent in localStorage
        localStorage.setItem('telemedicine_consent', 'accepted');
        // Navigate to video call or wherever needed
        navigate(-1);
    };

    return (
        <div className="consent-page-container">
            <div className="consent-page-content fade-in">
                <div className="consent-header">
                    <span className="material-icons-outlined consent-icon">videocam</span>
                    <h1>Telemedicine Consultation Consent</h1>
                    <p>Please review and accept these terms before your video consultation</p>
                </div>

                <Card className="consent-card">
                    <section>
                        <h2>What is Telemedicine?</h2>
                        <p>
                            Telemedicine is the delivery of healthcare services using electronic communications technology,
                            such as video calls. It allows you to consult with healthcare providers remotely.
                        </p>
                    </section>

                    <section>
                        <h2>Benefits of Telemedicine</h2>
                        <ul>
                            <li>Convenient access to healthcare from your location</li>
                            <li>Reduced travel time and costs</li>
                            <li>Access to specialists who may not be locally available</li>
                            <li>Continuity of care during illness or mobility limitations</li>
                        </ul>
                    </section>

                    <section>
                        <h2>Limitations and Risks</h2>
                        <p>By accepting this consent, you acknowledge the following limitations:</p>
                        <ul>
                            <li>
                                <strong>Physical Examination:</strong> The doctor cannot perform a physical examination
                                and may not be able to detect certain conditions that require in-person assessment.
                            </li>
                            <li>
                                <strong>Technology Issues:</strong> Technical difficulties (poor internet, audio/video
                                problems) may disrupt the consultation.
                            </li>
                            <li>
                                <strong>Emergency Care:</strong> Telemedicine is NOT appropriate for medical emergencies.
                                In case of emergency, call 911 or go to the nearest emergency room.
                            </li>
                            <li>
                                <strong>Diagnostic Limitations:</strong> Some conditions cannot be diagnosed remotely
                                and may require an in-person visit.
                            </li>
                            <li>
                                <strong>Network Security:</strong> While we use encrypted connections, there is always
                                a small risk of privacy breach with electronic communications.
                            </li>
                        </ul>
                    </section>

                    <section>
                        <h2>Your Responsibilities</h2>
                        <p>As a patient using telemedicine services, you agree to:</p>
                        <ul>
                            <li>Provide accurate and complete medical information</li>
                            <li>Be in a private, quiet location for your consultation</li>
                            <li>Have adequate internet connectivity and a working camera/microphone</li>
                            <li>Follow your doctor's recommendations and instructions</li>
                            <li>Understand that the doctor may recommend an in-person visit if necessary</li>
                        </ul>
                    </section>

                    <section>
                        <h2>Privacy and Confidentiality</h2>
                        <p>
                            Your telemedicine consultation is confidential and protected by the same privacy laws that
                            apply to in-person visits. Your medical information will not be shared without your consent,
                            except as required by law.
                        </p>
                        <p>
                            Video consultations are conducted through secure, encrypted connections. We do not record
                            sessions unless you explicitly consent for educational or quality purposes.
                        </p>
                    </section>

                    <section>
                        <h2>Technical Requirements</h2>
                        <p>For the best telemedicine experience, ensure you have:</p>
                        <ul>
                            <li>A device with a working camera and microphone</li>
                            <li>Stable internet connection (minimum 1 Mbps recommended)</li>
                            <li>Updated web browser (Chrome, Firefox, Safari, or Edge)</li>
                            <li>A quiet, well-lit environment for your consultation</li>
                        </ul>
                    </section>

                    <section>
                        <h2>Your Rights</h2>
                        <p>You have the right to:</p>
                        <ul>
                            <li>Refuse telemedicine services and request an in-person visit</li>
                            <li>End the telemedicine consultation at any time</li>
                            <li>Request a copy of your consultation notes</li>
                            <li>Ask questions about your care and treatment</li>
                            <li>Withdraw consent at any time</li>
                        </ul>
                    </section>

                    <section className="consent-declaration">
                        <h2>Consent Declaration</h2>
                        <p>
                            By checking the box below, I acknowledge that:
                        </p>
                        <ul>
                            <li>I have read and understood this consent form</li>
                            <li>I have had the opportunity to ask questions</li>
                            <li>I understand the benefits and limitations of telemedicine</li>
                            <li>I consent to receive healthcare services via telemedicine</li>
                            <li>I understand this is not for emergency situations</li>
                        </ul>

                        <label className="consent-checkbox">
                            <input
                                type="checkbox"
                                checked={accepted}
                                onChange={(e) => setAccepted(e.target.checked)}
                            />
                            <span className="checkbox-label">
                                I have read, understood, and agree to the telemedicine consent terms
                            </span>
                        </label>
                    </section>
                </Card>

                <div className="consent-actions">
                    <Button
                        variant="outline"
                        onClick={() => navigate(-1)}
                        leftIcon={<span className="material-icons-outlined">close</span>}
                    >
                        Decline
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleAccept}
                        disabled={!accepted}
                        leftIcon={<span className="material-icons-outlined">check_circle</span>}
                    >
                        Accept & Continue
                    </Button>
                </div>
            </div>
        </div>
    );
};
