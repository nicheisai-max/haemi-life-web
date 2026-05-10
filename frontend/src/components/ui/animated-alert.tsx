import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * 🎬 HAEMI LIFE — ANIMATED ALERT WRAPPER
 *
 * Wraps a banner / alert in a smooth fade + height-collapse transition
 * so transient inline messages (success / error / info) never pop in
 * or abruptly vanish. The institutional pattern across the app is
 * `setSuccess(message)` → 3-5s timer → `setSuccess(null)`. Without an
 * exit animation the unmount is jerky; this component provides the
 * standard easing every consuming page should use.
 *
 * Behaviour:
 *   - Mount:   fade in from opacity 0 → 1 + height 0 → auto (220ms,
 *              Material standard easing).
 *   - Unmount: fade out + height collapse back to 0 (220ms),
 *              surrounding content reflows smoothly through the
 *              shrinking height.
 *
 * AnimatePresence preserves the LAST rendered children during the exit
 * window — so when the consuming page sets `success` back to `null`,
 * the alert keeps showing its captured message text while it fades out.
 * No flicker, no empty alert.
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`, zero `as unknown as`, zero `@ts-ignore`
 *   - All props `readonly`
 *
 * Visual posture (project mandate):
 *   - Zero inline CSS — `overflow-hidden` via Tailwind so content does
 *     not visually leak during the height collapse.
 *   - No `px` literals; framer-motion handles the height interpolation.
 *
 * Usage:
 *
 *     <AnimatedAlert visible={success !== null}>
 *         <Alert>...</Alert>
 *     </AnimatedAlert>
 */

interface AnimatedAlertProps {
    /** Show/hide trigger. Toggling false runs the exit animation. */
    readonly visible: boolean;
    /** The Alert (or any banner-style child) to animate. */
    readonly children: React.ReactNode;
}

export const AnimatedAlert: React.FC<AnimatedAlertProps> = ({ visible, children }) => (
    <AnimatePresence initial={false}>
        {visible ? (
            <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
            >
                {children}
            </motion.div>
        ) : null}
    </AnimatePresence>
);
