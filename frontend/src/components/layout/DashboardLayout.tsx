import React, { type ReactNode } from 'react';
import { Navbar } from './Navbar';
import './DashboardLayout.css';

interface DashboardLayoutProps {
    children: ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
    return (
        <div className="dashboard-layout">
            <Navbar />
            <main className="dashboard-content">
                {children}
            </main>
        </div>
    );
};
