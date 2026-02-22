import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import ACTIONS from '../Actions';
import Client from '../components/Client';
import Editor from '../components/Editor';
import { initSocket } from '../socket';
import EmojiRunner from '../components/EmojiRunner';
import { motion, AnimatePresence } from 'framer-motion';
import {
    useLocation,
    useNavigate,
    Navigate,
    useParams,
} from 'react-router-dom';

const EditorPage = () => {
    const socketRef = useRef(null);
    const codeRef = useRef(null);
    const location = useLocation();
    const { roomId } = useParams();
    const reactNavigator = useNavigate();
    const [clients, setClients] = useState([]);
    const [language, setLanguage] = useState('javascript');
    const [output, setOutput] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [socketInitialized, setSocketInitialized] = useState(false);
    const [sparkState, setSparkState] = useState('idle'); // 'idle' | 'success' | 'error'

    useEffect(() => {
        const init = async () => {
            socketRef.current = await initSocket();
            socketRef.current.on('connect_error', (err) => handleErrors(err));
            socketRef.current.on('connect_failed', (err) => handleErrors(err));

            function handleErrors(e) {
                console.log('socket error', e);
                toast.error('Socket connection failed, try again later.');
                reactNavigator('/');
            }

            // Signal that socket is ready
            setSocketInitialized(true);

            socketRef.current.emit(ACTIONS.JOIN, {
                roomId,
                username: location.state?.username,
            });

            // Listening for joined event
            socketRef.current.on(
                ACTIONS.JOINED,
                ({ clients, username, socketId }) => {
                    if (username !== location.state?.username) {
                        toast.success(`${username} joined the room.`);
                        console.log(`${username} joined`);
                    }
                    setClients(clients);
                    socketRef.current.emit(ACTIONS.SYNC_CODE, {
                        code: codeRef.current,
                        socketId,
                    });
                }
            );

            // Listening for disconnected
            socketRef.current.on(
                ACTIONS.DISCONNECTED,
                ({ socketId, username }) => {
                    toast.success(`${username} left the room.`);
                    setClients((prev) => {
                        return prev.filter(
                            (client) => client.socketId !== socketId
                        );
                    });
                }
            );

            // Listen for Code Output
            socketRef.current.on(ACTIONS.CODE_OUTPUT, ({ output, isError }) => {
                setOutput(output);
                setIsRunning(false);
                if (isError) {
                    toast.error('Execution failed');
                    triggerSpark('error');
                } else {
                    toast.success('Execution successful');
                    triggerSpark('success');
                }
            });
        };
        init();
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current.off(ACTIONS.JOINED);
                socketRef.current.off(ACTIONS.DISCONNECTED);
                socketRef.current.off(ACTIONS.CODE_OUTPUT);
            }
        };
    }, []);

    // Spark effect: green glow on success, red on error, fades after 2.5s
    function triggerSpark(type) {
        setSparkState(type);
        setTimeout(() => {
            setSparkState('idle');
        }, 2500);
    }

    async function copyRoomId() {
        try {
            await navigator.clipboard.writeText(roomId);
            toast.success('Room ID has been copied to your clipboard');
        } catch (err) {
            toast.error('Could not copy the Room ID');
            console.error(err);
        }
    }

    function leaveRoom() {
        reactNavigator('/');
    }

    function runCode() {
        if (!codeRef.current) return;
        
        // Guard against HTML execution
        if (codeRef.current.trim().startsWith('<!DOCTYPE') || codeRef.current.trim().startsWith('<html')) {
            toast.error('Error: It looks like HTML code is trying to run. Please clear the editor and try again.');
            return;
        }

        setIsRunning(true);
        setOutput('Running...');
        socketRef.current.emit(ACTIONS.RUN_CODE, {
            roomId,
            language,
            code: codeRef.current
        });
    }

    if (!location.state) {
        return <Navigate to="/" />;
    }

    const sparkClass = sparkState !== 'idle' ? `spark-${sparkState}` : '';

    return (
        <motion.div 
            className="mainWrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
        >
            {/* ====== SIDEBAR ====== */}
            <motion.div 
                className="aside"
                initial={{ x: -30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
            >
                <div className="asideInner">
                    <EmojiRunner sparkState={sparkState} />
                    <div className="connectedLabel">
                        Connected
                        <motion.span 
                            className="connectedCount"
                            key={clients.length}
                            initial={{ scale: 1.4 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 300 }}
                        >
                            {clients.length}
                        </motion.span>
                    </div>
                    <div className="clientsList">
                        <AnimatePresence>
                            {clients.map((client, index) => (
                                <motion.div
                                    key={client.socketId}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ delay: index * 0.05 }}
                                >
                                    <Client username={client.username} />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
                <button className="btn copyBtn" onClick={copyRoomId}>
                    📋 Copy Room ID
                </button>
                <button className="btn leaveBtn" onClick={leaveRoom}>
                    Leave Room
                </button>
            </motion.div>

            {/* ====== EDITOR AREA ====== */}
            <div className={`editorWrap ${sparkClass}`} style={{ position: 'relative' }}>
                
                {/* Spark Overlay Flash */}
                <div className={`sparkOverlay ${sparkClass}`} />

                {/* Toolbar */}
                <motion.div 
                    className="editorHeader"
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                >
                    <div className="editorHeaderLeft">
                        <select 
                            className="languageSelect" 
                            value={language} 
                            onChange={(e) => setLanguage(e.target.value)}
                        >
                            <option value="javascript">JavaScript</option>
                            <option value="python">Python</option>
                            <option value="cpp">C++</option>
                            <option value="java">Java</option>
                        </select>
                        <motion.button 
                            className="runBtn" 
                            onClick={runCode}
                            disabled={isRunning}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                        >
                            {isRunning ? (
                                <><span className="spinner"></span> Running</>
                            ) : (
                                <><span className="playIcon">▶</span> Run Code</>
                            )}
                        </motion.button>
                    </div>
                    <div className="editorHeaderRight">
                        <div className="roomInfo">
                            Room: <span>{roomId.slice(0, 8)}...</span>
                        </div>
                    </div>
                </motion.div>

                {/* Code Editor */}
                <div className="editorContent">
                    {socketInitialized && <Editor
                        socketRef={socketRef}
                        roomId={roomId}
                        onCodeChange={(code) => {
                            codeRef.current = code;
                        }}
                        language={language}
                    />}
                </div>

                {/* Terminal */}
                <div className="outputWindow">
                    <div className="outputHeader">
                        <div className="outputTitleGroup">
                            <span className="terminalIcon">⬤</span>
                            <span className="outputTitle">Terminal</span>
                        </div>
                        <button className="clearBtn" onClick={() => setOutput('')}>
                            Clear
                        </button>
                    </div>
                    <div className="outputBody">
                        {output ? (
                            <motion.pre 
                                className={`outputContent ${output.includes('Error') || output.includes('error') ? 'error' : 'success'}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                                key={output}
                            >
                                {output}
                            </motion.pre>
                        ) : (
                            <span className="outputPlaceholder">
                                Run your code to see output here...
                                <span className="terminalCursor"></span>
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default EditorPage;
