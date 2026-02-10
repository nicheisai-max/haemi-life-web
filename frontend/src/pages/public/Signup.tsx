import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Logo } from '../../components/ui/Logo';
import type { UserRole } from '../../types/auth.types';
import './Signup.css';

export const Signup: React.FC = () => {
    const navigate = useNavigate();
    const { signup } = useAuth();

    const [step, setStep] = useState<'role' | 'form'>('role');
    const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        phone_number: '',
        email: '',
        password: '',
        confirmPassword: '',
        id_number: '', // Omang ID for patients
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);

    const handleRoleSelect = (role: UserRole) => {
        setSelectedRole(role);
        setStep('form');
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.name.trim()) newErrors.name = 'Name is required';
        if (!formData.phone_number.trim()) newErrors.phone_number = 'Phone number is required';

        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        // Role-specific validation
        if (selectedRole === 'patient' && !formData.id_number.trim()) {
            newErrors.id_number = 'Omang ID is required for patients';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm() || !selectedRole) return;

        setIsLoading(true);
        setErrors({});

        try {
            await signup({
                name: formData.name,
                phone_number: formData.phone_number,
                email: formData.email || undefined,
                password: formData.password,
                role: selectedRole,
                id_number: formData.id_number || undefined,
            });

            // Auto-redirects after signup via AuthContext
            navigate('/dashboard');
        } catch (error: any) {
            console.error('Signup failed:', error);
            setErrors({
                general: error.response?.data?.message || 'Signup failed. Please try again.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (step === 'role') {
        return (
            <div className="signup-container">
                <div className="signup-content">
                    <div className="signup-header">
                        <Logo size="lg" />
                        <h1>Create Account</h1>
                        <p>Choose your account type to get started</p>
                    </div>

                    <div className="role-grid">
                        <Card padding="lg" className="role-card" onClick={() => handleRoleSelect('patient')}>
                            <div className="role-icon">👤</div>
                            <h3>Patient</h3>
                            <p>Book appointments and manage your health records</p>
                        </Card>

                        <Card padding="lg" className="role-card" onClick={() => handleRoleSelect('doctor')}>
                            <div className="role-icon">👨‍⚕️</div>
                            <h3>Doctor</h3>
                            <p>Manage appointments and patient consultations</p>
                        </Card>

                        <Card padding="lg" className="role-card" onClick={() => handleRoleSelect('pharmacist')}>
                            <div className="role-icon">💊</div>
                            <h3>Pharmacist</h3>
                            <p>Manage prescriptions and pharmacy inventory</p>
                        </Card>
                    </div>

                    <div className="signup-footer">
                        <p>
                            Already have an account?{' '}
                            <a href="/login" className="link">
                                Sign in
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="signup-container">
            <div className="signup-content">
                <div className="signup-header">
                    <Logo size="lg" />
                    <h1>
                        Sign up as {selectedRole === 'patient' ? 'Patient' : selectedRole === 'doctor' ? 'Doctor' : 'Pharmacist'}
                    </h1>
                    <button onClick={() => setStep('role')} className="back-button">
                        ← Change role
                    </button>
                </div>

                <Card>
                    <form onSubmit={handleSubmit} className="signup-form">
                        {errors.general && (
                            <div className="alert alert-error">
                                {errors.general}
                            </div>
                        )}

                        <Input
                            label="Full Name"
                            name="name"
                            type="text"
                            placeholder="Enter your full name"
                            value={formData.name}
                            onChange={handleChange}
                            error={errors.name}
                            fullWidth
                        />

                        <Input
                            label="Phone Number"
                            name="phone_number"
                            type="tel"
                            placeholder="+267 1234 5678"
                            value={formData.phone_number}
                            onChange={handleChange}
                            error={errors.phone_number}
                            fullWidth
                        />

                        <Input
                            label="Email (Optional)"
                            name="email"
                            type="email"
                            placeholder="your.email@example.com"
                            value={formData.email}
                            onChange={handleChange}
                            error={errors.email}
                            fullWidth
                        />

                        {selectedRole === 'patient' && (
                            <Input
                                label="Omang ID"
                                name="id_number"
                                type="text"
                                placeholder="Enter your Omang ID"
                                value={formData.id_number}
                                onChange={handleChange}
                                error={errors.id_number}
                                fullWidth
                            />
                        )}

                        <Input
                            label="Password"
                            name="password"
                            type="password"
                            placeholder="Create a strong password"
                            value={formData.password}
                            onChange={handleChange}
                            error={errors.password}
                            fullWidth
                        />

                        <Input
                            label="Confirm Password"
                            name="confirmPassword"
                            type="password"
                            placeholder="Re-enter your password"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            error={errors.confirmPassword}
                            fullWidth
                        />

                        <Button
                            type="submit"
                            fullWidth
                            size="lg"
                            isLoading={isLoading}
                        >
                            Create Account
                        </Button>
                    </form>
                </Card>
            </div>
        </div>
    );
};
