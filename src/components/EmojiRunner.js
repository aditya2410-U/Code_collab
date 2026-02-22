import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// sparkState: 'idle' | 'success' | 'error'
const EmojiRunner = ({ sparkState }) => {

    const getEmoji = () => {
        if (sparkState === 'error') return '😵';
        if (sparkState === 'success') return '😄';
        return '🏃';
    };

    const isRunning = sparkState === 'idle';
    const isStuck = sparkState === 'error';
    const isHappy = sparkState === 'success';

    return (
        <div className="runner-container">
            {/* Ground line */}
            <div className="runner-ground"></div>

            {/* Obstacles scrolling */}
            <div className={`runner-obstacles ${isStuck ? 'paused' : ''} ${isHappy ? 'fast' : ''}`}>
                <span className="obstacle">▮</span>
                <span className="obstacle tall">▮</span>
                <span className="obstacle">▮</span>
                <span className="obstacle short">▮</span>
                <span className="obstacle">▮</span>
                <span className="obstacle tall">▮</span>
            </div>

            {/* The Emoji Character */}
            <motion.div 
                className="runner-emoji"
                animate={
                    isStuck 
                        ? { y: 0, rotate: 45, scale: 1.1 } 
                        : isHappy 
                            ? { y: -8, rotate: 0, scale: 1.3 } 
                            : { y: [0, -12, 0], rotate: 0, scale: 1 }
                }
                transition={
                    isStuck
                        ? { duration: 0.3, type: 'spring' }
                        : isHappy
                            ? { duration: 0.4, type: 'spring', stiffness: 200 }
                            : { duration: 0.5, repeat: Infinity, ease: 'easeInOut' }
                }
            >
                {getEmoji()}
            </motion.div>

            {/* Stars when success */}
            <AnimatePresence>
                {isHappy && (
                    <motion.div 
                        className="runner-stars"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        ✨
                    </motion.div>
                )}
            </AnimatePresence>

            {/* X marks when error */}
            <AnimatePresence>
                {isStuck && (
                    <motion.div 
                        className="runner-dizzy"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: -5 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        💫
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default EmojiRunner;
