import { motion, type Variants } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.1
        }
    },
    exit: {
        opacity: 0,
        transition: {
            staggerChildren: 0.05,
            staggerDirection: -1
        }
    }
};

const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: {
            type: 'spring',
            stiffness: 100,
            damping: 15
        }
    },
    exit: {
        y: -10,
        opacity: 0,
        transition: {
            duration: 0.2
        }
    }
};

interface PageTransitionProps {
    children: React.ReactNode;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
    return (
        <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={containerVariants}
            className="w-full"
        >
            {children}
        </motion.div>
    );
};

export const TransitionItem: React.FC<HTMLMotionProps<'div'>> = ({ children, className, ...props }) => {
    return (
        <motion.div
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`w-full${className ? ` ${className}` : ''}`}
            {...props}
        >
            {children}
        </motion.div>
    );
};
