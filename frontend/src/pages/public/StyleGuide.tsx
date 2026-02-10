import React from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Logo } from '../../components/ui/Logo';

export const StyleGuide: React.FC = () => {
    return (
        <div className="container" style={{ padding: '2rem' }}>
            <h1>UI Style Guide</h1>
            <p style={{ color: 'var(--color-slate-500)', marginBottom: '2rem' }}>
                Overview of the design system components and tokens.
            </p>

            <section style={{ marginBottom: '3rem' }}>
                <h2>Branding</h2>
                <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', margin: '1rem 0' }}>
                    <Logo size="sm" />
                    <Logo size="md" />
                    <Logo size="lg" />
                </div>
            </section>

            <section style={{ marginBottom: '3rem' }}>
                <h2>Buttons</h2>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    <Button variant="primary">Primary</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="danger">Danger</Button>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <Button size="sm">Small</Button>
                    <Button size="md">Medium</Button>
                    <Button size="lg">Large</Button>
                    <Button isLoading>Loading</Button>
                </div>
            </section>

            <section style={{ marginBottom: '3rem' }}>
                <h2>Inputs</h2>
                <div style={{ maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <Input label="Email Address" placeholder="Enter your email" />
                    <Input label="Password" type="password" placeholder="Enter password" />
                    <Input label="Error State" error="This field is required" />
                </div>
            </section>

            <section style={{ marginBottom: '3rem' }}>
                <h2>Cards</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                    <Card>
                        <h3>Basic Card</h3>
                        <p>This is a basic card with default padding.</p>
                    </Card>
                    <Card padding="lg">
                        <h3>Large Padding</h3>
                        <p>This card has more padding.</p>
                        <div style={{ marginTop: '1rem' }}>
                            <Button fullWidth>Action</Button>
                        </div>
                    </Card>
                </div>
            </section>
        </div>
    );
};
