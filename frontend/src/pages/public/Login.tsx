import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Logo } from '../../components/ui/Logo';
import loginBg from '../../assets/images/login_bg_premium.png';
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
            const isEmail = formData.emailOrPhone.includes('@');
            const credentials = {
                ...(isEmail
                    ? { email: formData.emailOrPhone }
                    : { phone_number: formData.emailOrPhone }
                ),
                password: formData.password,
            };

            await login(credentials);
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
        <div className="login-page">
            {/* Visual Section (Left) */}
            <div className="login-visual">
                <img src={loginBg} alt="Healthcare Background" className="login-bg-image" />
                <div className="visual-content">
                    <h2>Your Health, <br />Reimagined.</h2>
                    <p>Experience the future of healthcare management with Haemi Life. Secure, efficient, and centered around you.</p>
                </div>
            </div>

            {/* Form Section (Right) */}
            <div className="login-form-container">
                <div className="login-card">
                    <div className="login-header">
                        <Logo size="xl" className="mx-auto mb-6" />
                        <h1>Welcome Back</h1>
                        <p>Sign in to access your dashboard</p>
                    </div>

                    <form onSubmit={handleSubmit} className="login-form">
                        {errors.general && (
                            <div className="alert alert-error fade-in">
                                {errors.general}
                            </div>
                        )}

                        <Input
                            label="Email or Phone"
                            name="emailOrPhone"
                            type="text"
                            placeholder="user@example.com"
                            value={formData.emailOrPhone}
                            onChange={handleChange}
                            error={errors.emailOrPhone}
                            fullWidth
                            startIcon={<span className="material-icons-outlined">email</span>}
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
                            startIcon={<span className="material-icons-outlined">lock</span>}
                        />

                        <Button
                            type="submit"
                            fullWidth
                            size="lg"
                            isLoading={isLoading}
                            variant="primary"
                            rightIcon={<span className="material-icons-outlined">arrow_forward</span>}
                        >
                            Sign In
                        </Button>

                        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                            <Link to="/forgot-password" style={{ color: 'var(--brand-primary)', textDecoration: 'none', fontSize: '0.9rem' }}>
                                Forgot password?
                            </Link>
                        </div>
                    </form>

                    <div className="login-footer">
                        <p>
                            Don't have an account?{' '}
                            <button onClick={() => navigate('/signup')} className="link bg-transparent border-0 p-0 cursor-pointer text-sm">
                                Create Account
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
