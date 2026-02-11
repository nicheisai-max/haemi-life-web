import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Search, ChevronDown, ChevronUp, Headphones, Mail, Phone, MessageCircle } from 'lucide-react';

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
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-2">Help & Support</h1>
                        <p className="text-muted-foreground">Find answers to common questions or contact our support team</p>
                    </div>
                </div>

                {/* Search Bar */}
                <Card className="p-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Search for help..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-10 w-full"
                        />
                    </div>
                </Card>

                {/* Category Filters */}
                <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map(category => (
                        <button
                            key={category}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${selectedCategory === category
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background text-muted-foreground border-input hover:bg-accent hover:text-accent-foreground'
                                }`}
                            onClick={() => setSelectedCategory(category)}
                        >
                            {category}
                        </button>
                    ))}
                </div>

                {/* FAQ List */}
                <div className="space-y-4">
                    {filteredFAQs.length === 0 ? (
                        <Card className="p-12 text-center flex flex-col items-center justify-center space-y-4 text-muted-foreground">
                            <Search className="h-12 w-12 opacity-20" />
                            <p>No results found for "{searchTerm}"</p>
                        </Card>
                    ) : (
                        filteredFAQs.map((faq) => (
                            <Card
                                key={faq.id}
                                className={`transition-all duration-200 cursor-pointer hover:shadow-md ${expandedId === faq.id ? 'ring-1 ring-primary/20' : ''}`}
                                onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
                            >
                                <div className="p-4 md:p-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="space-y-1">
                                            <span className="inline-block px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wide mb-1">
                                                {faq.category}
                                            </span>
                                            <h3 className="text-lg font-semibold text-foreground leading-tight">
                                                {faq.question}
                                            </h3>
                                        </div>
                                        {expandedId === faq.id ? (
                                            <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                                        ) : (
                                            <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                                        )}
                                    </div>

                                    <div
                                        className={`grid transition-all duration-200 ease-in-out ${expandedId === faq.id ? 'grid-rows-[1fr] opacity-100 mt-4 pt-4 border-t' : 'grid-rows-[0fr] opacity-0'
                                            }`}
                                    >
                                        <div className="overflow-hidden">
                                            <p className="text-muted-foreground leading-relaxed">
                                                {faq.answer}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))
                    )}
                </div>

                {/* Contact Support */}
                <Card className="p-6 md:p-8 bg-primary/5 border-primary/20">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <Headphones className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-foreground">Still need help?</h2>
                            <p className="text-muted-foreground">Our support team is here to assist you</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="flex items-start gap-3 p-4 bg-background rounded-lg border shadow-sm">
                            <Mail className="h-5 w-5 text-primary mt-0.5" />
                            <div>
                                <h4 className="font-medium text-foreground">Email Support</h4>
                                <a href="mailto:support@haemi.life" className="text-sm text-primary hover:underline block mt-1">support@haemi.life</a>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-4 bg-background rounded-lg border shadow-sm">
                            <Phone className="h-5 w-5 text-primary mt-0.5" />
                            <div>
                                <h4 className="font-medium text-foreground">Phone Support</h4>
                                <a href="tel:+267XXXXXXX" className="text-sm text-primary hover:underline block mt-1">+267 XXX XXXX</a>
                                <span className="text-xs text-muted-foreground block mt-0.5">Mon-Fri, 8:00 AM - 6:00 PM</span>
                            </div>
                        </div>
                    </div>

                    <Button className="w-full h-12 text-base shadow-sm">
                        <MessageCircle className="h-5 w-5 mr-2" />
                        Start Live Chat
                    </Button>
                </Card>
            </div>
        </div>
    );
};
