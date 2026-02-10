import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Logo } from '../../components/ui/Logo';
import './Login.css';

export const Login: React.FC = () => {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [formData, setFormData] = useState({
        emailOrPhone: '',
        password: '',
    });

    const [errors, setErrors] = useState<{ emailOrPhone?: string; password?: string; general?: string }>({});
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear error when user starts typing
        if (errors[name as keyof typeof errors]) {
            setErrors(prev => ({ ...prev, [name]: undefined }));
        }
    };

    const validateForm = () => {
        const newErrors: typeof errors = {};

        if (!formData.emailOrPhone.trim()) {
            newErrors.emailOrPhone = 'Email or phone number is required';
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        setIsLoading(true);
        setErrors({});

        try {
            // Determine if input is email or phone
            const isEmail = formData.emailOrPhone.includes('@');
            const credentials = {
                ...(isEmail
                    ? { email: formData.emailOrPhone }
                    : { phone_number: formData.emailOrPhone }
                ),
                password: formData.password,
            };

            await login(credentials);

            // AuthContext will handle redirect based on role
            navigate('/dashboard');
        } catch (error: any) {
            console.error('Login failed:', error);
            setErrors({
                general: error.response?.data?.message || 'Login failed. Please check your credentials.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-content">
                <div className="login-header">
                    <Logo size="lg" />
                    <h1>Welcome Back</h1>
                    <p>Sign in to your account to continue</p>
                </div>

                <Card>
                    <form onSubmit={handleSubmit} className="login-form">
                        {errors.general && (
                            <div className="alert alert-error">
                                {errors.general}
                            </div>
                        )}

                        <Input
                            label="Email or Phone Number"
                            name="emailOrPhone"
                            type="text"
                            placeholder="Enter your email or phone"
                            value={formData.emailOrPhone}
                            onChange={handleChange}
                            error={errors.emailOrPhone}
                            fullWidth
                        />

                        <Input
                            label="Password"
                            name="password"
                            type="password"
                            placeholder="Enter your password"
                            value={formData.password}
                            onChange={handleChange}
                            error={errors.password}
                            fullWidth
                        />

                        <Button
                            type="submit"
                            fullWidth
                            size="lg"
                            isLoading={isLoading}
                        >
                            Sign In
                        </Button>
                    </form>

                    <div className="login-footer">
                        <p>
                            Don't have an account?{' '}
                            <a href="/signup" className="link">
                                Sign up
                            </a>
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    );
};
