'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine, GameConfig } from '@/game/engine';
import { supabase } from '@/lib/supabase';

type GameState = 'login' | 'signup' | 'start' | 'playing' | 'dead' | 'leaderboard' | 'shop';

interface ScoreEntry {
    id: number;
    player_name: string;
    score: number;
    skin: string;
}

export default function Game() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<GameEngine | null>(null);
    const [gameState, setGameState] = useState<GameState>('login');
    const [score, setScore] = useState(0);
    const [coins, setCoins] = useState(0);
    const [personalBest, setPersonalBest] = useState(0);
    const [playerName, setPlayerName] = useState('');
    const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
    const [submittingScore, setSubmittingScore] = useState(false);

    // Canvas dimensions (dynamic)
    const [canvasSize, setCanvasSize] = useState({ width: 400, height: 600 });

    // Guest state
    const [isGuest, setIsGuest] = useState(false);

    // Audio refs
    const audioFlyRef = useRef<HTMLAudioElement | null>(null);
    const audioDeadRef = useRef<HTMLAudioElement | null>(null);
    const bgImgRef = useRef<HTMLImageElement | null>(null);

    // Audio/Visual State
    const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
    const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

    // Admin State
    const [isAdmin, setIsAdmin] = useState<boolean>(false);

    // Auth State
    const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authUsername, setAuthUsername] = useState('');
    const [authError, setAuthError] = useState('');
    const [authLoading, setAuthLoading] = useState(false);

    // Skins state
    const [equippedSkin, setEquippedSkin] = useState<string>('modi');
    const [ownedSkins, setOwnedSkins] = useState<string[]>(['modi', 'modi_new']);

    // Images Ref
    const imagesLoaded = useRef(false);
    const birdImgRef = useRef<Record<string, HTMLImageElement>>({});
    const pillarImg = useRef<HTMLImageElement | null>(null);
    const coinImg = useRef<HTMLImageElement | null>(null);

    // Dynamic canvas sizing
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const ro = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                    setCanvasSize({ width: Math.round(width), height: Math.round(height) });
                }
            }
        });
        ro.observe(container);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        // Check for existing session (or guest)
        const checkSession = async () => {
            // Check guest first
            const savedGuest = localStorage.getItem('modi_guest');
            if (savedGuest === 'true') {
                const guestName = localStorage.getItem('modi_name') || 'GUEST_' + Math.floor(1000 + Math.random() * 9000);
                setPlayerName(guestName);
                setIsGuest(true);
                setGameState('start');
                return;
            }
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const username = session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'PLAYER';
                setPlayerName(username.toUpperCase());
                localStorage.setItem('modi_name', username.toUpperCase());
                setGameState('start');
            }
        };
        checkSession();

        // Load local storage data
        const savedCoins = parseInt(localStorage.getItem('modi_coins') || '0', 10);
        const savedBest = parseInt(localStorage.getItem('modi_best') || '0', 10);
        const savedSkin = localStorage.getItem('modi_skin') as any || 'modi';
        const savedOwned = JSON.parse(localStorage.getItem('modi_owned_skins') || '["modi", "modi_new"]');

        setCoins(savedCoins);
        setPersonalBest(savedBest);
        setEquippedSkin(savedSkin);
        setOwnedSkins(savedOwned);


        // Initialise audio
        audioFlyRef.current = new Audio('/assets/modih.mp3');
        audioFlyRef.current.loop = true;
        audioDeadRef.current = new Audio('/assets/modihgameover.mp3');

        // Initialise images
        if (!imagesLoaded.current) {
            const modiOriginal = new Image();
            modiOriginal.src = '/assets/modi.png';
            birdImgRef.current['modi'] = modiOriginal;

            const modiNew = new Image();
            modiNew.src = '/assets/modi_new.png';
            birdImgRef.current['modi_new'] = modiNew;

            const bananaSkin = new Image();
            bananaSkin.src = '/assets/banana.png';
            birdImgRef.current['banana'] = bananaSkin;

            const nanoBananaSkin = new Image();
            nanoBananaSkin.src = '/assets/modi_nano_banana.png';
            birdImgRef.current['modi_nano_banana'] = nanoBananaSkin;

            // These were missing - fix equipping bug
            const astronautSkin = new Image();
            astronautSkin.src = '/assets/modi_astronaut.png';
            birdImgRef.current['modi_astronaut'] = astronautSkin;

            const superheroSkin = new Image();
            superheroSkin.src = '/assets/modi_superhero.png';
            birdImgRef.current['modi_superhero'] = superheroSkin;

            // King skin (has real unique AI art)
            const kingSkin = new Image();
            kingSkin.src = '/assets/modi_king.png';
            birdImgRef.current['modi_king'] = kingSkin;

            const pillar = new Image();
            pillar.src = '/assets/rahul_gameover.png';
            pillarImg.current = pillar;

            const rahulRefImg = new Image();
            rahulRefImg.src = '/assets/rahul_flying.png';
            birdImgRef.current['rahul_chasing'] = rahulRefImg;

            const coin = new Image();
            coin.src = '/assets/coin.png';
            coinImg.current = coin;

            const bg = new Image();
            bg.src = '/assets/parliament_bg.png';
            bgImgRef.current = bg;

            imagesLoaded.current = true;
        }

        return () => {
            if (engineRef.current) engineRef.current.stop();
            if (audioFlyRef.current) {
                audioFlyRef.current.pause();
            }
        };
    }, []);

    // Leaderboard effect
    useEffect(() => {
        if (gameState === 'leaderboard') {
            fetchLeaderboard();
            const channel = supabase.channel('public:scores')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => {
                    fetchLeaderboard();
                })
                .subscribe();
            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [gameState]);

    const fetchLeaderboard = async () => {
        const { data, error } = await supabase
            .from('scores')
            .select('*')
            .order('score', { ascending: false })
            .limit(50);
        if (data && !error) {
            setLeaderboard(data);
        }
    };

    const deleteScore = async (id: number) => {
        if (!isAdmin) return;
        if (confirm("Delete this score permanently?")) {
            await supabase.from('scores').delete().eq('id', id);
            fetchLeaderboard();
        }
    };

    const handleDead = async (finalScore: number) => {
        setGameState('dead');
        if (audioFlyRef.current) {
            audioFlyRef.current.pause();
            audioFlyRef.current.currentTime = 0;
        }
        if (audioDeadRef.current && soundEnabled) {
            audioDeadRef.current.currentTime = 0;
            audioDeadRef.current.play().catch(() => { });
        }

        if (finalScore > personalBest) {
            setPersonalBest(finalScore);
            localStorage.setItem('modi_best', finalScore.toString());
        }
        localStorage.setItem('modi_coins', coins.toString());

        // Auto-publish score
        if (finalScore > 0 && playerName.trim() !== '') {
            setSubmittingScore(true);
            try {
                // Check existing score
                const { data: existingEntry } = await supabase
                    .from('scores')
                    .select('id, score')
                    .eq('player_name', playerName)
                    .maybeSingle();

                if (existingEntry) {
                    // Update only if strictly greater
                    if (finalScore > existingEntry.score) {
                        await supabase
                            .from('scores')
                            .update({ score: finalScore, skin: equippedSkin })
                            .eq('id', existingEntry.id);
                    }
                } else {
                    // Insert new
                    await supabase
                        .from('scores')
                        .insert([
                            { player_name: playerName, score: finalScore, skin: equippedSkin }
                        ]);
                }
                // Refresh leaderboard
                const { data } = await supabase
                    .from('scores')
                    .select('*')
                    .order('score', { ascending: false })
                    .limit(10);
                if (data) setLeaderboard(data);
            } catch (err) {
                console.error("Failed to auto-publish score", err);
            } finally {
                setSubmittingScore(false);
            }
        }
    };

    const submitScore = async () => {
        if (!playerName.trim() || score === 0 || submittingScore) return;
        setSubmittingScore(true);
        localStorage.setItem('modi_name', playerName);
        const { data: existingEntry } = await supabase
            .from('scores')
            .select('id, score')
            .eq('player_name', playerName)
            .maybeSingle();

        if (existingEntry) {
            if (score > existingEntry.score) {
                await supabase
                    .from('scores')
                    .update({ score: score, skin: equippedSkin })
                    .eq('id', existingEntry.id);
            }
        } else {
            await supabase.from('scores').insert({
                player_name: playerName.slice(0, 16),
                score: score,
                skin: equippedSkin
            });
        }
        setSubmittingScore(false);
        setGameState('leaderboard');
    };

    const initEngine = useCallback(() => {
        if (!canvasRef.current || !imagesLoaded.current) return;

        const currentBirdImg = birdImgRef.current[equippedSkin] || birdImgRef.current['modi'];

        const config: GameConfig = {
            width: canvasSize.width,
            height: canvasSize.height,
            birdSkinImg: currentBirdImg,
            pillarSkinImg: pillarImg.current!,
            bgImg: bgImgRef.current!,
            rahulImg: birdImgRef.current['rahul_chasing'],
            coinImg: coinImg.current!,
            onScore: (s) => setScore(s),
            onCoinCollected: (c) => {
                setCoins(c);
                localStorage.setItem('modi_coins', c.toString());
            },
            onDead: (finalScore) => {
                setGameState('dead');
                if (audioFlyRef.current) {
                    audioFlyRef.current.pause();
                    audioFlyRef.current.currentTime = 0;
                }
                handleDead(finalScore);
            }
        };

        engineRef.current = new GameEngine(canvasRef.current, config);
        engineRef.current.setInitialCoins(parseInt(localStorage.getItem('modi_coins') || '0', 10));
        engineRef.current.reset(); // Draw idle
    }, [equippedSkin, canvasSize]); // Re-init when canvas size changes

    useEffect(() => {
        initEngine();
    }, [initEngine]);

    const startGame = () => {
        if (!engineRef.current) return;
        setGameState('playing');
        setScore(0);
        engineRef.current.start();
        if (audioFlyRef.current && soundEnabled) {
            audioFlyRef.current.play().catch(() => { });
        }
    };

    const handleTap = (e: React.MouseEvent | React.TouchEvent | KeyboardEvent) => {
        // Prevent default on touch so we don't double fire
        if (e.type === 'touchstart') e.preventDefault();
        if (e.type === 'keydown') {
            if ((e as KeyboardEvent).code !== 'Space') return;
            if (gameState === 'login') return; // Don't trigger start while typing name
            e.preventDefault();
        }

        if (gameState === 'start') {
            startGame();
        } else if (gameState === 'playing') {
            if (engineRef.current) engineRef.current.jump();
        }
    };

    // Keyboard support for jump
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => handleTap(e as unknown as KeyboardEvent);
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [gameState]);

    const quitGame = (e: React.MouseEvent) => {
        e.stopPropagation();
        setGameState('start');
        if (engineRef.current) engineRef.current.reset();
        if (audioFlyRef.current) {
            audioFlyRef.current.pause();
            audioFlyRef.current.currentTime = 0;
        }
    };

    return (
        <div className="relative w-full h-[100dvh] bg-black flex items-center justify-center overflow-hidden font-press-start">
            {/* Game Container */}
            <div
                ref={containerRef}
                className="relative w-full h-full max-w-[500px] bg-sky-200 overflow-hidden cursor-pointer"
                onMouseDown={gameState === 'start' || gameState === 'playing' ? handleTap : undefined}
                onTouchStart={gameState === 'start' || gameState === 'playing' ? handleTap : undefined}
            >
                {/* Settings Toggle Button */}
                {(gameState === 'start' || gameState === 'leaderboard' || gameState === 'dead') && (
                    <button
                        className="absolute top-4 left-4 z-50 text-white font-press-start text-xs drop-shadow-[2px_2px_0_rgba(0,0,0,1)] hover:scale-110 transition-transform bg-black/50 p-2 rounded"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsSettingsOpen(true);
                        }}
                    >
                        ⚙️
                    </button>
                )}

                <canvas
                    ref={canvasRef}
                    width={canvasSize.width}
                    height={canvasSize.height}
                    className="block w-full h-full pointer-events-none"
                />

                {/* --- UI Overlays --- */}

                {/* AUTH SCREEN (Login / Signup) */}
                {(gameState === 'login' || gameState === 'signup') && (
                    <div className="absolute inset-0 bg-[#5eb6e4] flex flex-col items-center justify-center pointer-events-auto z-50" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                        <div className="flex flex-col items-center w-full px-8">
                            <h1 className="text-3xl text-white text-center mb-2 font-press-start" style={{ textShadow: '-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000, 5px 5px 0px rgba(0,0,0,0.5)' }}>
                                MODI AIRLINES
                            </h1>
                            <p className="text-white font-press-start text-[10px] mb-8" style={{ textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}>
                                {authMode === 'login' ? 'WELCOME BACK, PILOT' : 'NEW PILOT REGISTRATION'}
                            </p>

                            {authError && (
                                <div className="w-[85%] max-w-[300px] bg-red-500 border-4 border-black text-white font-press-start text-[8px] p-3 mb-4 shadow-[2px_2px_0_0_#000]">
                                    {authError}
                                </div>
                            )}

                            {authMode === 'signup' && (
                                <input
                                    type="text"
                                    maxLength={16}
                                    placeholder="USERNAME"
                                    value={authUsername}
                                    onChange={(e) => setAuthUsername(e.target.value.toUpperCase())}
                                    className="w-[85%] max-w-[300px] text-center px-4 py-3 bg-white border-4 border-black text-black font-press-start uppercase mb-4 outline-none shadow-[4px_4px_0_0_#000] text-xs"
                                />
                            )}

                            <input
                                type="email"
                                placeholder="EMAIL"
                                value={authEmail}
                                onChange={(e) => setAuthEmail(e.target.value)}
                                className="w-[85%] max-w-[300px] text-center px-4 py-3 bg-white border-4 border-black text-black font-press-start mb-4 outline-none shadow-[4px_4px_0_0_#000] text-xs"
                            />

                            <input
                                type="password"
                                placeholder="PASSWORD"
                                value={authPassword}
                                onChange={(e) => setAuthPassword(e.target.value)}
                                className="w-[85%] max-w-[300px] text-center px-4 py-3 bg-white border-4 border-black text-black font-press-start mb-6 outline-none shadow-[4px_4px_0_0_#000] text-xs"
                            />

                            <button
                                disabled={authLoading || !authEmail || !authPassword || (authMode === 'signup' && !authUsername)}
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    setAuthError('');
                                    setAuthLoading(true);

                                    if (authMode === 'signup') {
                                        // Check if username already taken
                                        const { data: existing } = await supabase
                                            .from('scores')
                                            .select('player_name')
                                            .ilike('player_name', authUsername)
                                            .limit(1);
                                        if (existing && existing.length > 0) {
                                            setAuthError('USERNAME ALREADY TAKEN!');
                                            setAuthLoading(false);
                                            return;
                                        }
                                        const { data, error } = await supabase.auth.signUp({
                                            email: authEmail,
                                            password: authPassword,
                                            options: { data: { username: authUsername } }
                                        });
                                        if (error) {
                                            setAuthError(error.message.toUpperCase());
                                        } else if (data.user) {
                                            setPlayerName(authUsername);
                                            localStorage.setItem('modi_name', authUsername);
                                            setGameState('start');
                                        }
                                    } else {
                                        const { data, error } = await supabase.auth.signInWithPassword({
                                            email: authEmail,
                                            password: authPassword,
                                        });
                                        if (error) {
                                            setAuthError(error.message.toUpperCase());
                                        } else if (data.user) {
                                            const username = data.user.user_metadata?.username || data.user.email?.split('@')[0] || 'PLAYER';
                                            setPlayerName(username.toUpperCase());
                                            localStorage.setItem('modi_name', username.toUpperCase());
                                            setGameState('start');
                                        }
                                    }
                                    setAuthLoading(false);
                                }}
                                className="w-[85%] max-w-[300px] bg-[#f89820] disabled:bg-gray-400 border-4 border-black text-white font-press-start py-4 shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none transition-all mb-4 text-sm"
                            >
                                {authLoading ? '...' : authMode === 'login' ? 'LOGIN' : 'SIGN UP'}
                            </button>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setAuthError('');
                                    setAuthMode(authMode === 'login' ? 'signup' : 'login');
                                    setGameState(authMode === 'login' ? 'signup' : 'login');
                                }}
                                className="text-white/60 font-press-start text-[8px] hover:text-white transition-colors mb-4"
                            >
                                {authMode === 'login' ? 'NO ACCOUNT? SIGN UP' : 'HAVE ACCOUNT? LOGIN'}
                            </button>

                            {/* Guest Sign-in */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const guestName = 'GUEST_' + Math.floor(1000 + Math.random() * 9000);
                                    setPlayerName(guestName);
                                    setIsGuest(true);
                                    localStorage.setItem('modi_name', guestName);
                                    localStorage.setItem('modi_guest', 'true');
                                    setGameState('start');
                                }}
                                className="w-[85%] max-w-[300px] bg-white/20 border-4 border-white/40 text-white font-press-start py-3 shadow-[4px_4px_0_0_rgba(0,0,0,0.3)] active:translate-y-1 active:shadow-none transition-all mb-6 text-[10px]"
                            >
                                ▶ PLAY AS GUEST
                            </button>

                            {/* Admin Login */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const pwd = prompt("Enter Admin Password:");
                                    if (pwd === "modi2026") {
                                        setIsAdmin(true);
                                        const allSkins = ['modi', 'modi_new', 'banana', 'modi_nano_banana', 'modi_astronaut', 'modi_superhero', 'modi_king'];
                                        setOwnedSkins(allSkins);
                                        localStorage.setItem('modi_owned_skins', JSON.stringify(allSkins));
                                        setCoins(9999);
                                        localStorage.setItem('modi_coins', '9999');
                                        alert("Admin mode activated!");
                                    }
                                }}
                                className={`font-press-start text-[8px] transition-colors ${isAdmin ? 'text-green-300' : 'text-white/30 hover:text-white/60'}`}
                            >
                                {isAdmin ? '✅ ADMIN' : '🔐 ADMIN'}
                            </button>
                        </div>
                    </div>
                )}

                {/* START SCREEN */}
                {gameState === 'start' && (
                    <div className="absolute inset-0 bg-transparent flex flex-col items-center justify-center pointer-events-auto pt-10">

                        <h1 className="text-[2.2rem] text-white text-center font-press-start leading-tight" style={{ textShadow: '-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000, 5px 5px 0px rgba(0,0,0,0.5)' }}>
                            MODI'S
                            <br />
                            <span className="text-[#f89820]">FLIGHT</span>
                        </h1>

                        <div className="mt-8 text-white font-press-start text-sm" style={{ textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000' }}>
                            SCORE TO BEAT: {personalBest}
                        </div>

                        <div className="absolute bottom-32 text-white font-press-start text-xl animate-bounce" style={{ textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000' }}>
                            TAP TO FLY
                        </div>

                        <div className="absolute bottom-8 flex flex-col items-center gap-3 w-full px-4">
                            <div className="flex gap-4 w-full justify-center">
                                <button
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onTouchStart={(e) => e.stopPropagation()}
                                    onClick={(e) => { e.stopPropagation(); setGameState('shop'); }}
                                    className="bg-[#f89820] border-4 border-black text-white px-6 py-3 shadow-[4px_4px_0_0_#000] font-press-start text-xs active:translate-y-1 active:shadow-none transition-all"
                                >
                                    SHOP
                                </button>
                                <button
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onTouchStart={(e) => e.stopPropagation()}
                                    onClick={(e) => { e.stopPropagation(); setGameState('leaderboard'); }}
                                    className="bg-[#2ecc71] border-4 border-black text-white px-6 py-3 shadow-[4px_4px_0_0_#000] font-press-start text-xs active:translate-y-1 active:shadow-none transition-all"
                                >
                                    SCORES
                                </button>
                            </div>
                            {!isAdmin ? (
                                <button
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onTouchStart={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const pwd = prompt("Enter Admin Password:");
                                        if (pwd === "modi2026") {
                                            setIsAdmin(true);
                                            const allSkins = ['modi', 'modi_new', 'banana', 'modi_nano_banana', 'modi_astronaut', 'modi_superhero', 'modi_king'];
                                            setOwnedSkins(allSkins);
                                            localStorage.setItem('modi_owned_skins', JSON.stringify(allSkins));
                                            setCoins(9999);
                                            localStorage.setItem('modi_coins', '9999');
                                            alert("Admin mode activated! All skins unlocked + 9999 coins.");
                                        }
                                    }}
                                    className="text-white/30 font-press-start text-[8px] hover:text-white/70 transition-colors"
                                >
                                    🔐 ADMIN
                                </button>
                            ) : (
                                <span className="text-green-300 font-press-start text-[8px]">✅ ADMIN</span>
                            )}
                            {isGuest && (
                                <span className="text-yellow-300 font-press-start text-[8px] mb-1" style={{ textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}>
                                    👤 {playerName}
                                </span>
                            )}
                            <button
                                onMouseDown={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    if (!isGuest) {
                                        await supabase.auth.signOut();
                                    }
                                    setPlayerName('');
                                    setIsAdmin(false);
                                    setIsGuest(false);
                                    setAuthEmail('');
                                    setAuthPassword('');
                                    setAuthUsername('');
                                    setAuthError('');
                                    setAuthMode('login');
                                    localStorage.removeItem('modi_guest');
                                    setGameState('login');
                                }}
                                className="text-red-300/50 font-press-start text-[8px] hover:text-red-300 transition-colors mt-1"
                            >
                                {isGuest ? 'EXIT GUEST' : 'LOGOUT'}
                            </button>
                        </div>
                    </div>
                )
                }

                {/* PLAYING HUD */}
                {
                    gameState === 'playing' && (
                        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 z-10">
                            <div className="flex justify-between items-start w-full">
                                <div className="text-white font-press-start text-4xl" style={{ textShadow: '-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000' }}>
                                    {score}
                                </div>
                                <div className="flex flex-col items-end gap-4 pointer-events-auto">
                                    <button
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onTouchStart={(e) => e.stopPropagation()}
                                        onClick={quitGame}
                                        className="bg-red-500 border-4 border-black text-white w-10 h-10 flex text-center justify-center items-center shadow-[4px_4px_0_0_#000] font-press-start text-xs active:translate-y-1 active:shadow-none transition-all"
                                    >
                                        X
                                    </button>
                                    <div className="text-[#FFD700] font-press-start text-xl" style={{ textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000' }}>
                                        🪙 {coins}
                                    </div>
                                </div>
                            </div>

                            {/* Tap to fly hint briefly? Optional. */}
                        </div>
                    )
                }
                {/* DEAD SCREEN - SCOREBOARD STYLE */}
                {
                    gameState === 'dead' && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center pointer-events-auto z-40 px-4">
                            <div className="bg-[#5eb6e4] border-4 border-black p-4 w-full max-w-[320px] shadow-[8px_8px_0_0_#000] flex flex-col items-center relative">
                                {/* Funny Rahul Game Over Image */}
                                <img src="/assets/rahul_gameover.png" alt="Game Over" className="w-48 h-auto object-contain mb-4 rounded bg-white p-1 border-4 border-black" />

                                <div className="w-full bg-white border-4 border-black p-3 flex flex-col items-center mb-4">
                                    <span className="text-black font-press-start text-xs mb-1">SCORE</span>
                                    <span className="text-[#f89820] font-press-start text-3xl mb-4">{score}</span>

                                    <span className="text-black font-press-start text-xs mb-2">BEST</span>
                                    <span className="text-[#2ecc71] font-press-start text-xl">{Math.max(score, personalBest)}</span>
                                </div>

                                <button
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onTouchStart={(e) => e.stopPropagation()}
                                    onClick={(e) => { e.stopPropagation(); startGame(); }}
                                    className="w-full bg-[#f89820] border-4 border-black text-white py-3 shadow-[4px_4px_0_0_#000] font-press-start text-sm active:translate-y-1 active:shadow-none transition-all mb-4"
                                >
                                    PLAY AGAIN
                                </button>

                                <div className="flex gap-4 w-full">
                                    <button
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onTouchStart={(e) => e.stopPropagation()}
                                        onClick={(e) => { e.stopPropagation(); setGameState('leaderboard'); }}
                                        className="flex-1 bg-[#2ecc71] border-4 border-black text-white py-2 shadow-[2px_2px_0_0_#000] font-press-start text-[10px] active:translate-y-1 active:shadow-none transition-all"
                                    >
                                        SCORES
                                    </button>
                                    <button
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onTouchStart={(e) => e.stopPropagation()}
                                        onClick={(e) => { e.stopPropagation(); setGameState('shop'); }}
                                        className="flex-1 bg-white border-4 border-black text-black py-2 shadow-[2px_2px_0_0_#000] font-press-start text-[10px] active:translate-y-1 active:shadow-none transition-all"
                                    >
                                        SHOP
                                    </button>
                                </div>

                                <button
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onTouchStart={(e) => e.stopPropagation()}
                                    onClick={(e) => { e.stopPropagation(); submitScore(); }}
                                    className="mt-4 w-full bg-blue-500 border-4 border-black text-white py-3 shadow-[4px_4px_0_0_#000] font-press-start text-xs active:translate-y-1 active:shadow-none transition-all"
                                >
                                    {submittingScore ? 'PUBLISHING...' : 'PUBLISH SCORE'}
                                </button>

                                <span className="absolute -bottom-8 text-yellow-300 font-press-start text-[8px]" style={{ textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}>
                                    MANUAL PUBLISH AVAILABLE
                                </span>
                            </div>
                        </div>
                    )
                }

                {/* LEADERBOARD SCREEN */}
                {
                    gameState === 'leaderboard' && (
                        <div className="absolute inset-0 bg-[#5eb6e4] flex flex-col items-center pointer-events-auto p-6 z-50">
                            <button
                                onClick={(e) => { e.stopPropagation(); setGameState('start'); }}
                                className="absolute top-4 right-4 bg-white border-4 border-black text-black w-10 h-10 flex items-center justify-center font-press-start shadow-[2px_2px_0_0_#000] active:translate-y-1 active:shadow-none transition-all"
                            >
                                X
                            </button>
                            <h2
                                className="text-white text-2xl font-press-start mt-4 mb-8 select-none"
                                style={{ textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000' }}
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    const pwd = prompt("Admin Login:");
                                    if (pwd === "modi2026") setIsAdmin(true);
                                }}
                            >
                                GLOBAL SCORES
                            </h2>

                            <div className="w-full bg-white border-4 border-black rounded overflow-y-auto flex-1 mb-8 p-4 font-press-start shadow-[4px_4px_0_0_#000] max-w-[400px]">
                                {leaderboard.length === 0 ? (
                                    <p className="text-black text-center text-xs mt-10">Loading scores...</p>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        {leaderboard.map((entry, index) => (
                                            <div key={entry.id} className="flex justify-between items-center bg-gray-100 p-3 border-2 border-black">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[#f89820] font-bold w-6">{index + 1}.</span>
                                                    <span className="text-black uppercase truncate max-w-[120px] text-[10px]">{entry.player_name}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[#2ecc71] font-bold text-xs">{entry.score}</span>
                                                    {isAdmin && (
                                                        <button
                                                            className="text-red-500 font-bold ml-2 text-xs"
                                                            onClick={(e) => { e.stopPropagation(); deleteScore(entry.id); }}
                                                        >
                                                            [X]
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {!isAdmin ? (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const pwd = prompt("Enter Admin Password:");
                                        if (pwd === "modi2026") {
                                            setIsAdmin(true);
                                            // Unlock all skins
                                            const allSkins = ['modi', 'modi_new', 'banana', 'modi_nano_banana', 'modi_astronaut', 'modi_superhero', 'modi_king'];
                                            setOwnedSkins(allSkins);
                                            localStorage.setItem('modi_owned_skins', JSON.stringify(allSkins));
                                            setCoins(9999);
                                            localStorage.setItem('modi_coins', '9999');
                                            alert("Admin mode activated! All skins unlocked + 9999 coins.");
                                        }
                                    }}
                                    className="mt-2 text-white/40 font-press-start text-[8px] hover:text-white/80 transition-colors"
                                >
                                    ADMIN LOGIN
                                </button>
                            ) : (
                                <span className="mt-2 text-green-300 font-press-start text-[8px]">
                                    ✅ ADMIN MODE ACTIVE
                                </span>
                            )}
                        </div>
                    )
                }

                {/* SHOP SCREEN */}
                {
                    gameState === 'shop' && (
                        <div className="absolute inset-0 bg-[#5eb6e4] flex flex-col items-center pointer-events-auto p-6 z-50" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                            <div className="w-full flex justify-between items-center mb-6 mt-4">
                                <h2 className="text-white text-2xl font-press-start" style={{ textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000' }}>SHOP</h2>
                                <div className="bg-[#f89820] border-4 border-black px-3 py-2 text-white font-press-start text-xs shadow-[2px_2px_0_0_#000]">🪙 {coins}</div>
                            </div>

                            <button
                                onClick={(e) => { e.stopPropagation(); setGameState('start'); }}
                                className="absolute top-4 right-4 bg-white border-4 border-black text-black w-10 h-10 flex items-center justify-center font-press-start shadow-[2px_2px_0_0_#000] active:translate-y-1 active:shadow-none transition-all"
                            >
                                X
                            </button>

                            <div className="w-full bg-white border-4 border-black flex-1 overflow-y-auto p-4 mb-8 shadow-[4px_4px_0_0_#000] flex flex-col gap-3">
                                {[
                                    { id: 'modi', name: 'Original Modi', price: 0, emoji: '🇮🇳', bg: 'bg-gray-100' },
                                    { id: 'modi_new', name: 'Modi (Photo)', price: 0, emoji: '📷', bg: 'bg-orange-50' },
                                    { id: 'banana', name: 'Banana Modi', price: 200, emoji: '🍌', bg: 'bg-yellow-100' },
                                    { id: 'modi_nano_banana', name: 'Nano Banana', price: 250, emoji: '🍌', bg: 'bg-purple-100' },
                                    { id: 'modi_astronaut', name: 'Astro Modi', price: 300, emoji: '🚀', bg: 'bg-blue-100' },
                                    { id: 'modi_superhero', name: 'Super Modi', price: 400, emoji: '🦸', bg: 'bg-red-100' },
                                    { id: 'modi_king', name: 'King Modi', price: 500, emoji: '👑', bg: 'bg-amber-100' },
                                ].map((skin) => (
                                    <div key={skin.id} className={`p-3 border-4 border-black ${skin.bg} flex justify-between items-center shadow-[2px_2px_0_0_#000]`}>
                                        <div className="flex gap-3 items-center">
                                            <div className="w-10 h-10 border-2 border-black bg-white flex items-center justify-center text-xl">{skin.emoji}</div>
                                            <div className="flex flex-col">
                                                <span className="font-press-start text-[9px] text-black mb-1">{skin.name}</span>
                                                {skin.price === 0 ? (
                                                    <span className="font-press-start text-[7px] text-gray-500">Free</span>
                                                ) : !ownedSkins.includes(skin.id) && (
                                                    <span className="font-press-start text-[7px] text-gray-600">{skin.price} 🪙</span>
                                                )}
                                            </div>
                                        </div>
                                        {equippedSkin === skin.id ? (
                                            <button className="bg-[#5eb6e4] text-white border-2 border-black p-2 font-press-start text-[7px]" disabled>EQUIPPED</button>
                                        ) : (ownedSkins.includes(skin.id) || skin.price === 0) ? (
                                            <button onClick={(e) => { e.stopPropagation(); setEquippedSkin(skin.id); localStorage.setItem('modi_skin', skin.id); }} className="bg-gray-400 text-white border-2 border-black p-2 font-press-start text-[7px] active:translate-y-1 active:shadow-none transition-all">EQUIP</button>
                                        ) : (
                                            <button onClick={(e) => {
                                                e.stopPropagation();
                                                if (coins >= skin.price) {
                                                    const nc = coins - skin.price;
                                                    setCoins(nc); localStorage.setItem('modi_coins', nc.toString());
                                                    const no = [...ownedSkins, skin.id];
                                                    setOwnedSkins(no); localStorage.setItem('modi_owned_skins', JSON.stringify(no));
                                                    setEquippedSkin(skin.id); localStorage.setItem('modi_skin', skin.id);
                                                } else { alert(`Not enough coins! Need ${skin.price}.`); }
                                            }} className="bg-[#2ecc71] text-white border-2 border-black p-2 font-press-start text-[7px] active:translate-y-1 active:shadow-none transition-all">BUY {skin.price}</button>
                                        )}
                                    </div>
                                ))}

                            </div>
                        </div>
                    )
                }

                {/* SETTINGS MODULE OVERLAY */}
                {
                    isSettingsOpen && (
                        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center pointer-events-auto p-6 z-50" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsSettingsOpen(false); }}
                                className="absolute top-4 right-4 bg-white border-4 border-black text-black w-10 h-10 flex items-center justify-center font-press-start shadow-[2px_2px_0_0_#000] active:translate-y-1 active:shadow-none transition-all"
                            >
                                X
                            </button>

                            <div className="bg-[#5eb6e4] border-4 border-black p-6 w-full max-w-[320px] shadow-[8px_8px_0_0_#000] flex flex-col items-center">
                                <h2 className="text-white text-xl font-press-start mb-8 text-center" style={{ textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000' }}>SETTINGS</h2>

                                <div className="w-full flex justify-between items-center p-4 border-4 border-black bg-white mb-6">
                                    <span className="font-press-start text-sm text-black">SOUND</span>
                                    <button
                                        className={`border-4 border-black px-4 py-2 font-press-start shadow-[2px_2px_0_0_#000] active:translate-y-1 active:shadow-none ${soundEnabled ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const newSound = !soundEnabled;
                                            setSoundEnabled(newSound);
                                            localStorage.setItem('modi_sound', newSound.toString());
                                        }}
                                    >
                                        {soundEnabled ? 'ON' : 'OFF'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div >
        </div >
    );
}

