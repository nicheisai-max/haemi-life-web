import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Home } from 'lucide-react';
import { PATHS } from '../../routes/paths';

export const PrivacyPolicy: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="space-y-4">
                <button
                    className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors text-sm font-medium"
                    onClick={() => navigate(-1)}
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                </button>
                <div>
                    <h1 className="page-heading !mb-0 transition-all duration-300">Privacy Policy</h1>
                    <p className="page-subheading italic">Last updated: February 10, 2026</p>
                </div>
            </div>

            <Card className="p-6 md:p-12 space-y-10">
                <section className="space-y-4">
                    <h2 className="text-h2 text-foreground border-b-2 border-primary pb-2">1. Introduction</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        Welcome to Haemi Life ("we," "our," or "us"). We are committed to protecting your personal information
                        and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard
                        your information when you use our digital healthcare platform.
                    </p>
                </section>

                <section className="space-y-6">
                    <h2 className="text-h2 text-foreground border-b-2 border-primary pb-2">2. Information We Collect</h2>

                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-foreground">2.1 Personal Information</h3>
                        <p className="text-muted-foreground">We collect personal information that you provide to us, including:</p>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                            <li>Name, email address, and phone number</li>
                            <li>Omang ID (for verification purposes)</li>
                            <li>Date of birth and gender</li>
                            <li>Address and location information</li>
                        </ul>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-foreground">2.2 Health Information</h3>
                        <p className="text-muted-foreground">As a healthcare platform, we collect and process sensitive health data:</p>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                            <li>Medical history and diagnoses</li>
                            <li>Prescription records</li>
                            <li>Appointment details</li>
                            <li>Doctor consultation notes</li>
                            <li>Medical test results and reports</li>
                        </ul>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-foreground">2.3 Usage Data</h3>
                        <p className="text-muted-foreground">We automatically collect certain information when you use our platform:</p>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                            <li>Device information (type, operating system)</li>
                            <li>IP address and browser type</li>
                            <li>Pages visited and features used</li>
                            <li>Session duration and timestamps</li>
                        </ul>
                    </div>
                </section>

                <section className="space-y-4">
                    <h2 className="text-h2 text-foreground border-b-2 border-primary pb-2">3. How We Use Your Information</h2>
                    <p className="text-muted-foreground">We use the collected information for the following purposes:</p>
                    <ul className="list-disc pl-6 space-y-3 text-muted-foreground">
                        <li><strong className="text-foreground">Provide Healthcare Services:</strong> To facilitate doctor appointments, prescriptions, and medical consultations</li>
                        <li><strong className="text-foreground">Account Management:</strong> To create and manage your user account</li>
                        <li><strong className="text-foreground">Communication:</strong> To send appointment reminders, health updates, and important notifications</li>
                        <li><strong className="text-foreground">Improve Services:</strong> To analyze usage patterns and enhance platform functionality</li>
                        <li><strong className="text-foreground">Compliance:</strong> To comply with legal obligations and healthcare regulations in Botswana</li>
                        <li><strong className="text-foreground">Security:</strong> To detect, prevent, and address fraud and security issues</li>
                    </ul>
                </section>

                <section className="space-y-6">
                    <h2 className="text-h2 text-foreground border-b-2 border-primary pb-2">4. Data Sharing and Disclosure</h2>

                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-foreground">4.1 Healthcare Providers</h3>
                        <p className="text-muted-foreground leading-relaxed">
                            We share your health information with doctors, pharmacists, and other healthcare professionals
                            on our platform solely for the purpose of providing medical care.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-foreground">4.2 Service Providers</h3>
                        <p className="text-muted-foreground leading-relaxed">
                            We may share data with third-party service providers who assist us in operating our platform,
                            such as cloud hosting, payment processing, and analytics services.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-foreground">4.3 Legal Requirements</h3>
                        <p className="text-muted-foreground leading-relaxed">
                            We may disclose your information if required by law, court order, or government regulation.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-foreground">4.4 Your Consent</h3>
                        <p className="text-muted-foreground leading-relaxed">
                            We will not sell or rent your personal information to third parties. Any sharing beyond the
                            purposes stated above will require your explicit consent.
                        </p>
                    </div>
                </section>

                <section className="space-y-4">
                    <h2 className="text-h2 text-foreground border-b-2 border-primary pb-2">5. Data Security</h2>
                    <p className="text-muted-foreground">We implement industry-standard security measures to protect your information:</p>
                    <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                        <li>End-to-end encryption for sensitive data transmission</li>
                        <li>Secure data storage with regular backups</li>
                        <li>Access controls and authentication mechanisms</li>
                        <li>Regular security audits and updates</li>
                        <li>Staff training on data protection practices</li>
                    </ul>
                    <p className="text-muted-foreground leading-relaxed">
                        While we take all reasonable precautions, no method of electronic transmission or storage is
                        100% secure. We cannot guarantee absolute security.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-h2 text-foreground border-b-2 border-primary pb-2">6. Your Data Rights</h2>
                    <p className="text-muted-foreground">Under Botswana's Data Protection Act, you have the following rights:</p>
                    <ul className="list-disc pl-6 space-y-3 text-muted-foreground">
                        <li><strong className="text-foreground">Access:</strong> Request a copy of your personal data</li>
                        <li><strong className="text-foreground">Correction:</strong> Request correction of inaccurate information</li>
                        <li><strong className="text-foreground">Deletion:</strong> Request deletion of your data (subject to legal obligations)</li>
                        <li><strong className="text-foreground">Objection:</strong> Object to certain data processing activities</li>
                        <li><strong className="text-foreground">Portability:</strong> Request transfer of your data to another provider</li>
                        <li><strong className="text-foreground">Withdrawal:</strong> Withdraw consent for data processing at any time</li>
                    </ul>
                    <p className="text-muted-foreground mt-4">To exercise these rights, please contact us at <a href="mailto:privacy@haemi.life" className="text-primary hover:underline">privacy@haemi.life</a></p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-h2 text-foreground border-b-2 border-primary pb-2">7. Data Retention</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        We retain your personal and health information for as long as necessary to provide our services
                        and comply with legal obligations. Medical records are kept for a minimum of 7 years as required
                        by Botswana healthcare regulations.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-h2 text-foreground border-b-2 border-primary pb-2">8. Children's Privacy</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        Our platform is not intended for children under 18 years of age. We do not knowingly collect
                        personal information from children. If you believe we have collected information from a minor,
                        please contact us immediately.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-h2 text-foreground border-b-2 border-primary pb-2">9. International Data Transfers</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        Your data is primarily stored and processed within Botswana. If we transfer data internationally,
                        we ensure appropriate safeguards are in place to protect your information.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-h2 text-foreground border-b-2 border-primary pb-2">10. Changes to This Policy</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        We may update this Privacy Policy from time to time. We will notify you of any material changes
                        by posting the new policy on this page and updating the "Last updated" date. Your continued use
                        of the platform after changes constitutes acceptance of the updated policy.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-h2 text-foreground border-b-2 border-primary pb-2">11. Contact Us</h2>
                    <p className="text-muted-foreground">If you have questions or concerns about this Privacy Policy, please contact us:</p>
                    <div className="bg-muted p-6 rounded-lg border-l-4 border-primary space-y-2">
                        <p className="font-semibold text-foreground">Haemi Life</p>
                        <p className="text-muted-foreground">Email: privacy@haemi.life</p>
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
                    Print Policy
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
    );
};
