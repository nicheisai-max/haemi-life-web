import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import { getAccessToken } from '../../services/api';
import type { Instance, SignalData } from 'simple-peer';
import { useAuth } from '@/hooks/use-auth';
import {
    CheckCircle2, Mic, MicOff, Video, VideoOff, PhoneOff,
    ShieldCheck, Settings, AlertCircle, Info, User, ArrowLeft
} from 'lucide-react';
import { PremiumLoader } from '../ui/premium-loader';
import { MedicalLoader } from '../ui/medical-loader';
import appointmentService from '../../services/appointment.service';
import type { Appointment } from '../../services/appointment.service';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

const SOCKET_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

// Socket type handled via standard library to avoid 'as' assertions
type SocketType = ReturnType<typeof io>;

export const VideoConsultation: React.FC = () => {
    const { id: appointmentId } = useParams<{ id: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [appointment, setAppointment] = useState<Appointment | null>(null);
    const [loading, setLoading] = useState(true);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [status, setStatus] = useState<'lobby' | 'connecting' | 'active' | 'ended'>('lobby');
    const [systemReady, setSystemReady] = useState({ mic: false, camera: false });

    const socketRef = useRef<SocketType | null>(null);
    const myVideo = useRef<HTMLVideoElement>(null);
    const userVideo = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<Instance | null>(null);

    // 1. Fetch Appointment Data
    useEffect(() => {
        const handleTokenRefreshed = (e: Event) => {
            if (!(e instanceof CustomEvent)) return;
            const detail = e.detail;
            if (socketRef.current && detail && typeof detail === 'object' && 'token' in detail) {
                const newToken = String(detail.token);
                // Enterprise Fix: Safely update token using property narrowing to avoid 'as'
                const s = socketRef.current;
                if ('auth' in s && typeof s.auth === 'object' && s.auth !== null) {
                    Object.assign(s.auth, { token: newToken });
                }
            }
        };

        const fetchAppointment = async () => {
            if (!appointmentId) return;
            try {
                const data = await appointmentService.getAppointmentById(Number(appointmentId));
                setAppointment(data);

                // Initialize Socket with Auth - ZERO UI DAMAGE
                const token = getAccessToken();
                const newSocket = io(SOCKET_URL, {
                    auth: { token },
                    transports: ['websocket']
                });

                if (newSocket) {
                    socketRef.current = newSocket;
                }

                window.addEventListener('auth:token-refreshed', handleTokenRefreshed);
            } catch (err) {
                console.error("Failed to fetch appointment", err);
                toast.error("Invalid appointment room.");
                navigate('/dashboard');
            } finally {
                setLoading(false);
            }
        };

        fetchAppointment();

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            window.removeEventListener('auth:token-refreshed', handleTokenRefreshed);
            if (peerRef.current) {
                peerRef.current.destroy();
            }
        };
    }, [appointmentId, navigate, stream]);

    // 2. Initialize Media in Lobby
    useEffect(() => {
        if (status === 'lobby' && !stream) {
            navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                .then((currentStream) => {
                    setStream(currentStream);
                    setSystemReady({ mic: true, camera: true });
                })
                .catch(err => {
                    console.error("Failed to get local stream", err);
                    setSystemReady({ mic: false, camera: false });
                });
        }
    }, [status, stream]);

    // 3. Sync local stream with video ref whenever status or stream changes
    useEffect(() => {
        if (myVideo.current && stream) {
            myVideo.current.srcObject = stream;
        }
    }, [stream, status]);

    const joinConsultation = () => {
        if (!systemReady.camera && !systemReady.mic) {
            toast.error("Please enable camera and microphone to continue.");
            return;
        }

        setStatus('connecting');
        socketRef.current?.emit('join-consultation', appointmentId);

        socketRef.current?.on('participant-joined', (participantId: string) => {
            initiateCall(participantId);
        });

        socketRef.current?.on('call-made', async ({ offer, socket: from }: { offer: SignalData, socket: string }) => {
            answerCall(offer, from);
        });

        socketRef.current?.on('answer-made', async ({ answer }: { answer: SignalData }) => {
            await peerRef.current?.signal(answer);
            setStatus('active');
        });

        socketRef.current?.on('ice-candidate', ({ candidate }: { candidate: SignalData }) => {
            if (peerRef.current) {
                peerRef.current.signal(candidate);
            }
        });
    };

    const initiateCall = (participantId: string) => {
        const peer = new Peer({
            initiator: true,
            trickle: false,
            stream: stream!,
        });

        peer.on('signal', (data) => {
            socketRef.current?.emit('call-user', { offer: data, to: participantId });
        });

        peer.on('stream', (remoteStream) => {
            if (userVideo.current) {
                userVideo.current.srcObject = remoteStream;
            }
            setStatus('active');
        });

        peerRef.current = peer;
    };

    const answerCall = (offer: SignalData, from: string) => {
        const peer = new Peer({
            initiator: false,
            trickle: false,
            stream: stream!,
        });

        peer.on('signal', (data) => {
            socketRef.current?.emit('make-answer', { answer: data, to: from });
        });

        peer.on('stream', (remoteStream) => {
            if (userVideo.current) {
                userVideo.current.srcObject = remoteStream;
            }
            setStatus('active');
        });

        peer.signal(offer);
        peerRef.current = peer;
    };

    const toggleMute = () => {
        if (stream) {
            stream.getAudioTracks()[0].enabled = isMuted;
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (stream) {
            stream.getVideoTracks()[0].enabled = isVideoOff;
            setIsVideoOff(!isVideoOff);
        }
    };

    const endCall = () => {
        if (peerRef.current) peerRef.current.destroy();
        if (stream) stream.getTracks().forEach(track => track.stop());
        setStatus('ended');
        setTimeout(() => navigate('/dashboard'), 3000);
    };

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-background">
                <MedicalLoader variant="global" message="Securing end-to-end encrypted connection..." />
            </div>
        );
    }

    if (status === 'ended') {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-background text-foreground p-6">
                <Card className="p-10 text-center max-w-sm border-2 border-primary/20 shadow-2xl bg-card">
                    <div className="bg-primary/10 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="h-10 w-10 text-primary" />
                    </div>
                    <h2 className="text-h2 mb-2">Consultation Completed</h2>
                    <p className="text-muted-foreground mb-6">Your medical interaction was secure and private. Returning to dashboard...</p>
                    <Button onClick={() => navigate('/dashboard')} className="w-full">Return Now</Button>
                </Card>
            </div>
        );
    }

    // LOBBY UI
    if (status === 'lobby') {
        return (
            <div className="h-screen w-full bg-background text-foreground flex flex-col items-center justify-center relative overflow-hidden">
                {/* Premium Back Button */}
                <div className="absolute top-8 left-8 z-50">
                    <button
                        onClick={() => navigate(-1)}
                        className="group flex items-center gap-2 px-4 py-2 rounded-full bg-background/80 md:bg-card/50 backdrop-blur-xl border border-border/50 shadow-lg hover:shadow-primary/20 hover:border-primary/50 transition-all duration-300 hover:scale-105 active:scale-95"
                    >
                        <ArrowLeft className="h-4 w-4 text-foreground/70 group-hover:text-primary transition-colors" strokeWidth={2.5} />
                        <span className="text-sm font-bold text-foreground/70 group-hover:text-primary transition-colors">Go Back</span>
                    </button>
                </div>

                {/* Decorative Background Glows */}
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

                <div className="container max-w-6xl mx-auto flex flex-col md:flex-row p-6 md:p-12 gap-8 items-center justify-center relative z-10">
                    <div className="flex-1 max-w-2xl w-full">
                        <div className="relative aspect-video bg-neutral-900 dark:bg-neutral-950 rounded-3xl overflow-hidden border-4 border-card shadow-2xl group ring-1 ring-border/50">
                            <video playsInline muted ref={myVideo} autoPlay className="w-full h-full object-cover transform scale-x-[-1]" />

                            {!systemReady.camera && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
                                    <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                                    <p className="text-white font-bold">Camera Access Required</p>
                                    <p className="text-sm text-neutral-400 mt-2 text-center px-8">Please enable your camera to join this Botswana Healthcare Session</p>
                                </div>
                            )}

                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-background/95 md:bg-background/90 backdrop-blur-2xl p-3 rounded-full border border-border/50 shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 scale-90 group-hover:scale-100">
                                <button
                                    onClick={toggleMute}
                                    className={`p-3.5 rounded-full transition-all shadow-sm ${isMuted
                                        ? 'bg-red-500 text-white shadow-red-500/20'
                                        : 'bg-card border border-border/50 text-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30'
                                        }`}
                                >
                                    {isMuted ? <MicOff size={22} strokeWidth={2.5} /> : <Mic size={22} strokeWidth={2.5} />}
                                </button>
                                <button
                                    onClick={toggleVideo}
                                    className={`p-3.5 rounded-full transition-all shadow-sm ${isVideoOff
                                        ? 'bg-red-500 text-white shadow-red-500/20'
                                        : 'bg-card border border-border/50 text-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30'
                                        }`}
                                >
                                    {isVideoOff ? <VideoOff size={22} strokeWidth={2.5} /> : <Video size={22} strokeWidth={2.5} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="w-full md:w-[400px] space-y-8">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-4 border border-primary/20">
                                <ShieldCheck size={14} /> Encrypted Session
                            </div>
                            <h1 className="text-h1 leading-tight text-foreground">Video Consultation</h1>
                            <p className="text-xl font-medium text-primary flex items-center gap-2">
                                with {appointment?.doctorName}
                            </p>
                            <p className="text-muted-foreground mt-2 font-medium">{appointment?.specialization || 'Specialist'}</p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-5 rounded-2xl bg-card border border-border/50 shadow-sm transition-all hover:shadow-md hover:border-primary/20">
                                <div className="flex items-center gap-3">
                                    <div className={`h-2.5 w-2.5 rounded-full ${systemReady.camera ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
                                    <span className="text-sm font-bold text-foreground">Camera System</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest bg-muted px-2 py-0.5 rounded-md">{systemReady.camera ? 'Ready' : 'Offline'}</span>
                            </div>
                            <div className="flex items-center justify-between p-5 rounded-2xl bg-card border border-border/50 shadow-sm transition-all hover:shadow-md hover:border-primary/20">
                                <div className="flex items-center gap-3">
                                    <div className={`h-2.5 w-2.5 rounded-full ${systemReady.mic ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
                                    <span className="text-sm font-bold text-foreground">Microphone System</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest bg-muted px-2 py-0.5 rounded-md">{systemReady.mic ? 'Ready' : 'Offline'}</span>
                            </div>
                        </div>

                        <div className="pt-4">
                            <Button
                                onClick={joinConsultation}
                                disabled={!systemReady.camera || !systemReady.mic}
                                className="w-full h-14 bg-primary hover:bg-primary-900 dark:hover:bg-primary-600 text-white text-lg font-bold rounded-2xl shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98] gap-3"
                            >
                                Join Consultation Room
                            </Button>
                            <p className="text-center text-xs text-muted-foreground mt-8 leading-relaxed font-medium">
                                By joining, you agree to Botswana Health Data Privacy terms. <br />Your session is end-to-end encrypted.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ACTIVE CALL UI
    return (
        <div className="flex flex-col md:flex-row h-screen w-full bg-background text-foreground overflow-hidden">
            <div className="flex-1 relative bg-neutral-950 flex items-center justify-center">
                {/* Remote Video (Large) */}
                <div className="w-full h-full flex items-center justify-center">
                    {status === 'active' || status === 'connecting' ? (
                        <video playsInline ref={userVideo} autoPlay className="w-full h-full object-cover" />
                    ) : (
                        <div className="text-center">
                            <PremiumLoader />
                            <p className="font-semibold mt-4 text-foreground">Waiting for Specialist...</p>
                            <p className="text-neutral-400 mt-2">{appointment?.doctorName} is being notified of your arrival.</p>

                            <div className="mt-12 p-6 rounded-2xl bg-white/5 border border-white/5 max-w-sm mx-auto flex items-center gap-4 text-left">
                                <Info className="h-8 w-8 text-primary shrink-0" />
                                <p className="text-xs text-neutral-400 italic font-medium leading-relaxed">
                                    "Stay on this screen. Ensure you are in a quiet, well-lit environment for the best medical assessment."
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Local Video (PiP) */}
                <div className="absolute top-6 right-6 w-36 h-24 md:w-64 md:h-44 rounded-2xl overflow-hidden shadow-2xl border-4 border-card bg-neutral-900 dark:bg-neutral-950 z-10 transition-all hover:scale-105 ring-1 ring-border/50">
                    <video playsInline muted ref={myVideo} autoPlay className="w-full h-full object-cover transform scale-x-[-1]" />
                    <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-[var(--card-radius)]">
                        <User size={12} className="text-primary" />
                        <span className="text-[10px] font-bold uppercase tracking-widest leading-none text-white">
                            {user?.name}
                        </span>
                    </div>
                </div>

                {/* Call Controls */}
                <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 flex items-center gap-6 bg-card/95 backdrop-blur-3xl px-10 py-5 rounded-[2.5rem] border border-border/60 shadow-[0_25px_60px_rgba(0,0,0,0.2)] z-20">
                    <button
                        className={`h-14 w-14 rounded-full flex items-center justify-center transition-all duration-300 ${isMuted
                            ? 'bg-red-500 scale-110 shadow-lg shadow-red-500/30 text-white'
                            : 'bg-background hover:bg-primary/10 text-foreground hover:text-primary border border-border shadow-sm'
                            }`}
                        onClick={toggleMute}
                    >
                        {isMuted ? <MicOff size={24} strokeWidth={2.5} /> : <Mic size={24} strokeWidth={2.5} />}
                    </button>

                    <button
                        className={`h-14 w-14 rounded-full flex items-center justify-center transition-all duration-300 ${isVideoOff
                            ? 'bg-red-500 scale-110 shadow-lg shadow-red-500/30 text-white'
                            : 'bg-background hover:bg-primary/10 text-foreground hover:text-primary border border-border shadow-sm'
                            }`}
                        onClick={toggleVideo}
                    >
                        {isVideoOff ? <VideoOff size={24} strokeWidth={2.5} /> : <Video size={24} strokeWidth={2.5} />}
                    </button>

                    <div className="w-px h-8 bg-border mx-2" />

                    <button
                        className="h-16 w-16 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 text-white transition-all hover:scale-110 hover:rotate-12 shadow-2xl shadow-red-600/40"
                        onClick={endCall}
                    >
                        <PhoneOff size={28} />
                    </button>
                </div>
            </div>

            {/* Specialist Sidebar */}
            <div className="w-full md:w-[360px] bg-card border-t md:border-t-0 md:border-l border-border flex flex-col p-8 z-30 shadow-2xl">
                <div className="space-y-6">
                    <div>
                        <h3 className="text-h3 tracking-tight text-foreground">{appointment?.doctorName}</h3>
                        <p className="text-primary font-black text-xs uppercase tracking-[0.2em] mt-2 bg-primary/5 inline-block px-2 py-1 rounded">{appointment?.specialization}</p>
                    </div>

                    <div className="p-6 rounded-2xl bg-muted/30 border border-border/50">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="h-12 w-12 rounded-xl bg-primary text-white flex items-center justify-center font-black shadow-lg shadow-primary/20">
                                BW
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Practitioner Status</p>
                                <p className="text-emerald-500 dark:text-emerald-400 font-bold text-sm flex items-center gap-1.5 mt-0.5">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                                    BOMRA Verified
                                </p>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed font-semibold italic">
                            This specialist is duly registered with the Botswana Health Professions Council (BHPC).
                        </p>
                    </div>

                    <div className="space-y-4 pt-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Session Details</p>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground font-medium">Duration</span>
                                <span className="font-bold text-foreground bg-muted px-2 py-0.5 rounded">30 mins</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground font-medium">Reference</span>
                                <span className="font-mono text-[10px] text-foreground bg-muted px-2 py-0.5 rounded">#REF-{appointmentId}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-auto pt-10">
                    <Button variant="outline" className="w-full rounded-xl border-border bg-background text-xs font-bold text-foreground/80 hover:text-primary hover:border-primary/30 mb-6 transition-all shadow-sm">
                        <Settings size={14} className="mr-2" /> Connection Settings
                    </Button>
                    <p className="text-[9px] text-muted-foreground/40 text-center uppercase font-black tracking-[0.3em]">
                        Haemi Life Telemedicine Secure-Core v2.1
                    </p>
                </div>
            </div>
        </div>
    );
};

