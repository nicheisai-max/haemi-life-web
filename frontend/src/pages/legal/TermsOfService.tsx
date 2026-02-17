import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Home, AlertTriangle } from 'lucide-react';
import { PATHS } from '../../routes/paths';

export const TermsOfService: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background py-8 px-4">
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
                <div className="space-y-4">
                    <button
                        className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors text-sm font-medium"
                        onClick={() => navigate(-1)}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </button>
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-2">Terms of Service</h1>
                        <p className="text-muted-foreground">Last updated: February 10, 2026</p>
                    </div>
                </div>

                <Card className="p-6 md:p-12 space-y-10">
                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-foreground border-b-2 border-primary pb-2">1. Agreement to Terms</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            By accessing or using the Haemi Life platform, you agree to be bound by these Terms of Service and
                            all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited
                            from using or accessing this platform.
                        </p>
                    </section>

                    <section className="space-y-6">
                        <h2 className="text-2xl font-bold text-foreground border-b-2 border-primary pb-2">2. Platform Description</h2>
                        <div className="space-y-3">
                            <p className="text-muted-foreground">
                                Haemi Life is a digital healthcare platform that connects patients with licensed healthcare
                                professionals in Botswana. We provide:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                <li>Doctor directory and appointment booking</li>
                                <li>Telemedicine consultations (video/audio)</li>
                                <li>Electronic prescriptions</li>
                                <li>Medical records management</li>
                                <li>Pharmacy services</li>
                            </ul>
                        </div>
                    </section>

                    <section className="space-y-6">
                        <h2 className="text-2xl font-bold text-foreground border-b-2 border-primary pb-2">3. User Accounts</h2>

                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-foreground">3.1 Registration</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                To use our services, you must create an account and provide accurate, current, and complete information.
                                You are responsible for maintaining the confidentiality of your account credentials.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-foreground">3.2 Account Types</h3>
                            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                <li><strong className="text-foreground">Patient Accounts:</strong> For individuals seeking medical care</li>
                                <li><strong className="text-foreground">Doctor Accounts:</strong> For licensed medical practitioners (subject to verification)</li>
                                <li><strong className="text-foreground">Pharmacist Accounts:</strong> For licensed pharmacists and pharmacy staff</li>
                                <li><strong className="text-foreground">Administrator Accounts:</strong> For platform management and support</li>
                            </ul>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-foreground">3.3 Account Verification</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                Healthcare professional accounts require verification of licenses and credentials. We reserve the right
                                to suspend or terminate unverified or fraudulent accounts.
                            </p>
                        </div>
                    </section>

                    <section className="space-y-6">
                        <h2 className="text-2xl font-bold text-foreground border-b-2 border-primary pb-2">4. Medical Services and Disclaimers</h2>

                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-foreground">4.1 Not Emergency Services</h3>
                            <div className="bg-destructive/10 border-l-4 border-destructive p-4 rounded-r-md">
                                <div className="flex items-center gap-2 text-destructive font-bold mb-1">
                                    <AlertTriangle className="h-5 w-5" />
                                    IMPORTANT
                                </div>
                                <p className="text-destructive font-medium">
                                    Haemi Life is NOT for medical emergencies. In case of a medical emergency,
                                    call 911 or go to the nearest emergency room immediately.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-foreground">4.2 Professional Relationship</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                The doctor-patient relationship is between you and the healthcare professional you consult. Haemi Life
                                is a platform facilitating these connections but is not a party to the medical relationship.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-foreground">4.3 Telemedicine Limitations</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                Telemedicine consultations have limitations. Not all conditions can be diagnosed or treated remotely.
                                Your doctor may recommend an in-person visit if necessary.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-foreground">4.4 No Medical Advice</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                Information provided on the platform is for informational purposes only and does not constitute medical
                                advice. Always consult with a qualified healthcare professional for medical decisions.
                            </p>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-foreground border-b-2 border-primary pb-2">5. User Responsibilities</h2>
                        <p className="text-muted-foreground">As a user of Haemi Life, you agree to:</p>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
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

                    <section className="space-y-6">
                        <h2 className="text-2xl font-bold text-foreground border-b-2 border-primary pb-2">6. Fees and Payments</h2>

                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-foreground">6.1 Consultation Fees</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                Doctors set their own consultation fees. All fees are displayed before booking and must be paid to
                                access the consultation.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-foreground">6.2 Platform Fees</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                Haemi Life may charge service fees for using the platform. These fees will be clearly disclosed before
                                any transaction.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-foreground">6.3 Refunds</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                Refund policies vary by service type. Cancellations made within the allowed timeframe may be eligible
                                for refunds. Emergency cancellations by doctors will result in automatic refunds.
                            </p>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-foreground border-b-2 border-primary pb-2">7. Intellectual Property</h2>
                        <div className="space-y-3">
                            <p className="text-muted-foreground leading-relaxed">
                                All content on the Haemi Life platform, including text, graphics, logos, and software, is the property
                                of Haemi Life or its licensors and is protected by Botswana and international copyright laws.
                            </p>
                            <p className="text-muted-foreground leading-relaxed">
                                You may not reproduce, distribute, or create derivative works without our express written permission.
                            </p>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-foreground border-b-2 border-primary pb-2">8. Privacy and Data Protection</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            Your privacy is important to us. Our collection, use, and protection of your personal and health
                            information is governed by our Privacy Policy. By using the platform, you consent to our data
                            practices as described in the Privacy Policy.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-foreground border-b-2 border-primary pb-2">9. Limitation of Liability</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            To the fullest extent permitted by law, Haemi Life shall not be liable for any indirect, incidental,
                            special, consequential, or punitive damages resulting from:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                            <li>Use or inability to use the platform</li>
                            <li>Unauthorized access to your data</li>
                            <li>Medical advice or treatment received through the platform</li>
                            <li>Technical failures or interruptions</li>
                            <li>Actions or omissions of healthcare professionals</li>
                        </ul>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-foreground border-b-2 border-primary pb-2">10. Termination</h2>
                        <p className="text-muted-foreground">We reserve the right to terminate or suspend your account at any time, without prior notice, for:</p>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                            <li>Violation of these Terms of Service</li>
                            <li>Fraudulent or illegal activities</li>
                            <li>Providing false information</li>
                            <li>Abusive behavior towards other users or staff</li>
                        </ul>
                        <p className="text-muted-foreground mt-4 leading-relaxed">
                            You may terminate your account at any time by contacting support. Medical records will be retained
                            as required by law.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-foreground border-b-2 border-primary pb-2">11. Changes to Terms</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            We may modify these Terms of Service at any time. We will notify you of material changes via email
                            or platform notification. Your continued use of the platform after changes constitutes acceptance of
                            the new terms.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-foreground border-b-2 border-primary pb-2">12. Governing Law</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            These Terms of Service are governed by the laws of Botswana. Any disputes shall be resolved in the
                            courts of Botswana.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-foreground border-b-2 border-primary pb-2">13. Contact Information</h2>
                        <p className="text-muted-foreground">For questions about these Terms of Service, please contact:</p>
                        <div className="bg-muted p-6 rounded-lg border-l-4 border-primary space-y-2">
                            <p className="font-semibold text-foreground">Haemi Life</p>
                            <p className="text-muted-foreground">Email: legal@haemi.life</p>
                            <p className="text-muted-foreground">Phone: +267 XXX XXXX</p>
                            <p className="text-muted-foreground">Address: Gaborone, Botswana</p>
                        </div>
                    </section>
                </Card>

                <div className="flex flex-col sm:flex-row justify-center gap-4 print:hidden">
                    <Button
                        variant="outline"
                        onClick={() => window.print()}
                        className="flex items-center gap-2"
                    >
                        <Printer className="h-4 w-4" />
                        Print Terms
                    </Button>
                    <Button
                        variant="default"
                        onClick={() => navigate(PATHS.LOGIN)}
                        className="flex items-center gap-2"
                    >
                        <Home className="h-4 w-4" />
                        Back to Home
                    </Button>
                </div>
            </div>
        </div>
    );
};
