import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import type { Instance, SignalData } from 'simple-peer';
import { useAuth } from '../../context/AuthContext';
import {
    CheckCircle2, Mic, MicOff, Video, VideoOff, PhoneOff,
    ShieldCheck, Settings, AlertCircle, Info, User
} from 'lucide-react';
import { MedicalLoader } from '../ui/MedicalLoader';
import appointmentService from '../../services/appointment.service';
import type { Appointment } from '../../services/appointment.service';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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
        const fetchAppointment = async () => {
            if (!appointmentId) return;
            try {
                const data = await appointmentService.getAppointmentById(Number(appointmentId));
                setAppointment(data);

                // Initialize Socket
                socketRef.current = io(SOCKET_URL);
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
            if (peerRef.current) {
                peerRef.current.destroy();
            }
        };
    }, [appointmentId, navigate, stream]);

    // 2. Initialize Media in Lobby
    useEffect(() => {
        if (status === 'lobby') {
            navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                .then((currentStream) => {
                    setStream(currentStream);
                    setSystemReady({ mic: true, camera: true });
                    if (myVideo.current) {
                        myVideo.current.srcObject = currentStream;
                    }
                })
                .catch(err => {
                    console.error("Failed to get local stream", err);
                    setSystemReady({ mic: false, camera: false });
                });
        }
    }, [status]);

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
                <MedicalLoader fullPage message="Securing end-to-end encrypted connection..." />
            </div>
        );
    }

    if (status === 'ended') {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-background">
                <Card className="p-10 text-center max-w-sm border-2 border-primary/20 shadow-2xl">
                    <div className="bg-primary/10 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="h-10 w-10 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Consultation Completed</h2>
                    <p className="text-muted-foreground mb-6">Your medical interaction was secure and private. Returning to dashboard...</p>
                    <Button onClick={() => navigate('/dashboard')} className="w-full">Return Now</Button>
                </Card>
            </div>
        );
    }

    // LOBBY UI
    if (status === 'lobby') {
        return (
            <div className="h-screen w-full bg-[#0B1214] text-white flex flex-col md:flex-row p-6 md:p-12 gap-8 items-center justify-center">
                <div className="flex-1 max-w-2xl w-full">
                    <div className="relative aspect-video bg-neutral-900 rounded-2xl overflow-hidden border-2 border-white/5 shadow-2xl group">
                        <video playsInline muted ref={myVideo} autoPlay className="w-full h-full object-cover transform scale-x-[-1]" />

                        {!systemReady.camera && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
                                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                                <p className="font-bold">Camera Access Required</p>
                                <p className="text-sm text-neutral-400 mt-2 text-center px-8">Please enable your camera to join this Botswana Healthcare Session</p>
                            </div>
                        )}

                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/40 backdrop-blur-xl p-2 rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={toggleMute} className={`p-3 rounded-full ${isMuted ? 'bg-red-500' : 'bg-white/10'}`}>
                                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                            </button>
                            <button onClick={toggleVideo} className={`p-3 rounded-full ${isVideoOff ? 'bg-red-500' : 'bg-white/10'}`}>
                                {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="w-full md:w-[400px] space-y-8">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-4 border border-emerald-500/20">
                            <ShieldCheck size={14} /> Encrypted Session
                        </div>
                        <h1 className="text-3xl font-bold leading-tight">Video Consultation with {appointment?.doctor_name}</h1>
                        <p className="text-neutral-400 mt-2 font-medium">{appointment?.specialization || 'Specialist'}</p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                            <div className="flex items-center gap-3">
                                <div className={`h-2 w-2 rounded-full ${systemReady.camera ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
                                <span className="text-sm font-medium">Camera System</span>
                            </div>
                            <span className="text-xs text-neutral-500 uppercase font-black">{systemReady.camera ? 'Ready' : 'Offline'}</span>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                            <div className="flex items-center gap-3">
                                <div className={`h-2 w-2 rounded-full ${systemReady.mic ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
                                <span className="text-sm font-medium">Microphone System</span>
                            </div>
                            <span className="text-xs text-neutral-500 uppercase font-black">{systemReady.mic ? 'Ready' : 'Offline'}</span>
                        </div>
                    </div>

                    <div className="pt-4">
                        <Button
                            onClick={joinConsultation}
                            disabled={!systemReady.camera || !systemReady.mic}
                            className="w-full h-14 bg-primary hover:bg-primary-600 text-white text-lg font-bold rounded-xl shadow-lg shadow-primary/20 gap-3"
                        >
                            Join Consultation Room
                        </Button>
                        <p className="text-center text-xs text-neutral-500 mt-6 leading-relaxed">
                            By joining, you agree to Botswana Health Data Privacy terms. <br />Your session is end-to-end encrypted.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ACTIVE CALL UI
    return (
        <div className="flex flex-col md:flex-row h-screen w-full bg-[#0B1214] text-white overflow-hidden">
            <div className="flex-1 relative bg-black flex items-center justify-center">
                {/* Remote Video (Large) */}
                <div className="w-full h-full flex items-center justify-center">
                    {status === 'active' ? (
                        <video playsInline ref={userVideo} autoPlay className="w-full h-full object-cover" />
                    ) : (
                        <div className="text-center">
                            <MedicalLoader message="Waiting for Specialist..." />
                            <p className="text-neutral-400 mt-2">{appointment?.doctor_name} is being notified of your arrival.</p>

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
                <div className="absolute top-6 right-6 w-36 h-24 md:w-64 md:h-44 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10 bg-neutral-900 z-10 transition-all hover:scale-105">
                    <video playsInline muted ref={myVideo} autoPlay className="w-full h-full object-cover transform scale-x-[-1]" />
                    <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg">
                        <User size={12} className="text-primary" />
                        <span className="text-[10px] font-bold uppercase tracking-widest leading-none">
                            {user?.name}
                        </span>
                    </div>
                </div>

                {/* Call Controls */}
                <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 flex items-center gap-6 bg-[#0F1C1F]/90 backdrop-blur-2xl px-10 py-5 rounded-[2rem] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-20">
                    <button
                        className={`h-14 w-14 rounded-full flex items-center justify-center transition-all duration-300 ${isMuted
                            ? 'bg-red-500 scale-110 shadow-lg shadow-red-500/30'
                            : 'bg-white/5 hover:bg-white/10 border border-white/10'
                            }`}
                        onClick={toggleMute}
                    >
                        {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                    </button>

                    <button
                        className={`h-14 w-14 rounded-full flex items-center justify-center transition-all duration-300 ${isVideoOff
                            ? 'bg-red-500 scale-110 shadow-lg shadow-red-500/30'
                            : 'bg-white/5 hover:bg-white/10 border border-white/10'
                            }`}
                        onClick={toggleVideo}
                    >
                        {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
                    </button>

                    <div className="w-px h-8 bg-white/10 mx-2" />

                    <button
                        className="h-16 w-16 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 text-white transition-all hover:scale-110 hover:rotate-12 shadow-2xl shadow-red-600/40"
                        onClick={endCall}
                    >
                        <PhoneOff size={28} />
                    </button>
                </div>
            </div>

            {/* Specialist Sidebar */}
            <div className="w-full md:w-[360px] bg-[#0F1C1F] border-t md:border-t-0 md:border-l border-white/5 flex flex-col p-8 z-30">
                <div className="space-y-6">
                    <div>
                        <h3 className="text-2xl font-bold tracking-tight">{appointment?.doctor_name}</h3>
                        <p className="text-primary font-bold text-sm uppercase tracking-widest mt-1">{appointment?.specialization}</p>
                    </div>

                    <div className="p-5 rounded-2xl bg-white/5 border border-white/5">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-black">
                                BW
                            </div>
                            <div>
                                <p className="text-xs text-neutral-500 font-bold uppercase tracking-tighter">Practitioner Status</p>
                                <p className="text-emerald-400 font-bold text-sm flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                                    BOMRA Verified
                                </p>
                            </div>
                        </div>
                        <p className="text-xs text-neutral-400 leading-relaxed font-medium">
                            This specialist is duly registered with the Botswana Health Professions Council (BHPC).
                        </p>
                    </div>

                    <div className="space-y-4 pt-4">
                        <p className="text-xs font-black uppercase tracking-widest text-neutral-500">Session Details</p>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-neutral-400">Duration</span>
                                <span className="font-bold">30 mins</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-neutral-400">Reference</span>
                                <span className="font-mono text-xs">{appointmentId}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-auto pt-10">
                    <Button variant="ghost" className="w-full border-white/5 bg-white/5 text-xs text-neutral-400 hover:text-white mb-4">
                        <Settings size={14} className="mr-2" /> Connection Settings
                    </Button>
                    <p className="text-[10px] text-neutral-600 text-center uppercase font-black tracking-widest">
                        Haemi Life Telemedicine Secure-Core v2.1
                    </p>
                </div>
            </div>
        </div>
    );
};

