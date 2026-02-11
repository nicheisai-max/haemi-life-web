import React, { useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

export const NotificationSimulator: React.FC = () => {
    const { info, success, warning } = useToast();
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        // Realistic Botswana-themed notifications for the demo
        const notifications: Record<string, string[]> = {
            patient: [
                "Dr. Mpho Modise is currently reviewing your medical history.",
                "Your lab results from Princess Marina Hospital are now available.",
                "Reminder: Follow-up appointment in Gaborone is in 2 days.",
                "New health tip: Stay hydrated during the current heatwave.",
            ],
            doctor: [
                "Critical lab result received for patient Kagiso Moalusi.",
                "New appointment request from Neo Dube in Francistown.",
                "Clinic throughput increased by 15% this hour.",
                "System Update: Global ICD-11 database synced successfully.",
            ],
            pharmacist: [
                "New e-prescription received from Dr. Thabo Molefe.",
                "Inventory Alert: Panado Extra stock low at Gaborone North branch.",
                "Successful batch sync with the national drug registry.",
                "Patient Kagiso Moalusi is on his way for pickup.",
            ],
            admin: [
                "New provider registration: Dr. Keletso Moremi (Gaborone).",
                "System Health: Gaborone Server Shard at 99.99% uptime.",
                "Financial Pulse: Subscription revenue up 12% in the North-East region.",
                "DDoS Mitigation: Blocked suspicious traffic from unknown source.",
            ]
        };

        const roleNotifications = notifications[user.role] || [];
        if (roleNotifications.length === 0) return;

        // Trigger a random notification every 15-30 seconds for the demo
        const triggerRandom = () => {
            const index = Math.floor(Math.random() * roleNotifications.length);
            const msg = roleNotifications[index];

            // Randomize type for visual variety
            const types = ['info', 'success', 'warning'] as const;
            const type = types[Math.floor(Math.random() * types.length)];

            if (type === 'success') success(msg);
            else if (type === 'warning') warning(msg);
            else info(msg);
        };

        // Initial delay so it doesn't pop up immediately on login
        const initialTimer = setTimeout(triggerRandom, 5000);
        const interval = setInterval(triggerRandom, 25000);

        return () => {
            clearTimeout(initialTimer);
            clearInterval(interval);
        };
    }, [user, success, info, warning]);

    return null; // Logic-only component
};
