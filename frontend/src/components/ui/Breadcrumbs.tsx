import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { motion } from 'framer-motion';

export const Breadcrumbs: React.FC = () => {
    const location = useLocation();
    const pathnames = location.pathname.split('/').filter((x) => x);

    if (pathnames.length === 0) return null;

    return (
        <nav className="flex items-center space-y-0 text-sm font-medium text-muted-foreground mb-6" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2">
                <li>
                    <Link
                        to="/dashboard"
                        className="flex items-center hover:text-primary transition-colors gap-1.5"
                    >
                        <Home className="h-4 w-4" />
                        <span className="sr-only">Home</span>
                    </Link>
                </li>
                {pathnames.map((value, index) => {
                    const last = index === pathnames.length - 1;
                    const to = `/${pathnames.slice(0, index + 1).join('/')}`;
                    const label = value.charAt(0).toUpperCase() + value.slice(1).replace(/-/g, ' ');

                    // Skip the generic "dashboard" if it's the first element as we have the Home icon
                    if (value.toLowerCase() === 'dashboard' && index === 0) return null;

                    return (
                        <motion.li
                            key={to}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-center space-x-2"
                        >
                            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                            {last ? (
                                <span className="text-foreground font-bold truncate max-w-[150px]">
                                    {label}
                                </span>
                            ) : (
                                <Link
                                    to={to}
                                    className="hover:text-primary transition-colors truncate max-w-[150px]"
                                >
                                    {label}
                                </Link>
                            )}
                        </motion.li>
                    );
                })}
            </ol>
        </nav>
    );
};
