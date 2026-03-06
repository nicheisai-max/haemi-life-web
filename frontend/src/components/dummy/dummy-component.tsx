/* eslint-disable */
// @ts-expect-error: Mock violation for AI Reviewer (Phase 5)
import React, { useEffect } from 'react';
// Simulated Unused Import for Phase 5
// @ts-expect-error: Mock violation for AI Reviewer (Phase 5)
import { useState } from 'react';

export const DummyComponent = () => {
    // Simulated infinite re-render pattern for Phase 7
    useEffect(() => {
        console.log("Missing dependency array!")
    });

    const list = [1, 2, 3];
    return (
        <div>
            {/* Simulated missing key map for Phase 7 */}
            {list.map(item => <p>{item}</p>)}
        </div>
    );
};
