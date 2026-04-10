import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Logo } from '../../components/ui/logo';

export const StyleGuide: React.FC = () => {
    return (
        <div className="container mx-auto p-8 max-w-4xl space-y-12">
            <div>
                <h1 className="text-3xl font-bold mb-2">UI Style Guide</h1>
                <p className="text-slate-500 mb-8">
                    Overview of the design system components and tokens.
                </p>
            </div>

            <section className="space-y-6">
                <h2 className="text-2xl font-semibold border-b pb-2">Branding</h2>
                <div className="flex gap-8 items-center py-4 bg-muted/20 rounded-[var(--card-radius)] p-6">
                    <Logo size="sm" />
                    <Logo size="md" />
                    <Logo size="lg" />
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-2xl font-semibold border-b pb-2">Buttons</h2>
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-4">
                        <Button variant="default">Primary</Button>
                        <Button variant="secondary">Secondary</Button>
                        <Button variant="outline">Outline</Button>
                        <Button variant="ghost">Ghost</Button>
                        <Button variant="destructive">Danger</Button>
                    </div>
                    <div className="flex flex-wrap gap-4 items-center">
                        <Button size="sm">Small</Button>
                        <Button size="default">Medium</Button>
                        <Button size="lg">Large</Button>
                        <Button disabled>Loading</Button>
                    </div>
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-2xl font-semibold border-b pb-2">Inputs</h2>
                <div className="max-w-md space-y-6">
                    <div className="grid w-full items-center gap-2">
                        <label htmlFor="email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Email Address</label>
                        <Input type="email" id="email" placeholder="Enter your email" />
                    </div>
                    <div className="grid w-full items-center gap-2">
                        <label htmlFor="password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Password</label>
                        <Input type="password" id="password" placeholder="Enter password" />
                    </div>
                    <div className="grid w-full items-center gap-2">
                        <label htmlFor="error-input" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-destructive">Error State</label>
                        <Input id="error-input" placeholder="Error input" className="border-destructive focus-visible:ring-destructive" />
                        <span className="text-destructive text-sm">This field is required</span>
                    </div>
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-2xl font-semibold border-b pb-2">Cards</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="p-4">
                        <h3 className="font-semibold text-lg mb-2">Basic Card</h3>
                        <p className="text-muted-foreground">This is a basic card with default padding.</p>
                    </Card>
                    <Card className="p-8">
                        <h3 className="font-semibold text-lg mb-2">Large Padding</h3>
                        <p className="text-muted-foreground mb-4">This card has more padding.</p>
                        <div>
                            <Button className="w-full">Action</Button>
                        </div>
                    </Card>
                </div>
            </section>
        </div>
    );
};
