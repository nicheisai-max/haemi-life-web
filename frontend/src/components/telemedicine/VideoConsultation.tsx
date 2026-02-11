import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import Peer from 'simple-peer';
import type { Instance } from 'simple-peer';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle2, Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';

const SOCKET_URL = 'http://localhost:5000';

export const VideoConsultation: React.FC = () => {
    const { id: appointmentId } = useParams<{ id: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [status, setStatus] = useState<'lobby' | 'connecting' | 'active' | 'ended'>('lobby');

    const socketRef = useRef<any>(null);
    const myVideo = useRef<HTMLVideoElement>(null);
    const userVideo = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<Instance | null>(null);

    useEffect(() => {
        // Initialize socket
        socketRef.current = io(SOCKET_URL);

        // Get user media
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then((currentStream) => {
                setStream(currentStream);
                if (myVideo.current) {
                    myVideo.current.srcObject = currentStream;
                }
            })
            .catch(err => {
                console.error("Failed to get local stream", err);
                alert("Please enable camera and microphone access to join the consultation.");
            });

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, []);

    const joinConsultation = () => {
        setStatus('connecting');
        socketRef.current.emit('join-consultation', appointmentId);

        socketRef.current.on('participant-joined', (participantId: string) => {
            // console.log("Other participant joined:", participantId);
            initiateCall(participantId);
        });

        socketRef.current?.on('call-made', async ({ offer, socket: from }: { offer: any, socket: string }) => {
            // console.log("Receiving call from:", from);
            answerCall(offer, from);
        });

        socketRef.current?.on('answer-made', async ({ answer }: { answer: any }) => {
            // console.log("Call answered");
            await peerRef.current?.signal(answer);
            setStatus('active');
        });

        socketRef.current?.on('ice-candidate', ({ candidate }: { candidate: any }) => {
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
            socketRef.current.emit('call-user', { offer: data, to: participantId });
        });

        peer.on('stream', (remoteStream) => {
            if (userVideo.current) {
                userVideo.current.srcObject = remoteStream;
            }
            setStatus('active');
        });

        peerRef.current = peer;
    };

    const answerCall = (offer: any, from: string) => {
        const peer = new Peer({
            initiator: false,
            trickle: false,
            stream: stream!,
        });

        peer.on('signal', (data) => {
            socketRef.current.emit('make-answer', { answer: data, to: from });
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
        setTimeout(() => navigate(-1), 2000);
    };

    if (status === 'ended') {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-background">
                <div className="p-10 bg-card rounded-xl shadow-lg text-center max-w-sm border border-border">
                    <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
                    <h2 className="text-xl font-bold mb-2">Consultation Ended</h2>
                    <p className="text-muted-foreground">Thank you for using Haemi Life. Returning you to dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col md:flex-row h-screen w-full bg-slate-900 text-white overflow-hidden">
            <div className="flex-1 relative bg-black flex items-center justify-center">
                {/* Remote Video (Large) */}
                <div className="w-full h-full flex items-center justify-center">
                    {status === 'active' ? (
                        <video playsInline ref={userVideo} autoPlay className="w-full h-full object-cover" />
                    ) : (
                        <div className="text-center">
                            <div className="w-20 h-20 rounded-full bg-primary mx-auto mb-6 animate-pulse shadow-[0_0_0_0_rgba(79,70,229,0.7)]"
                                style={{ animation: 'pulse 2s infinite' }}></div>
                            <style>{`
                                @keyframes pulse {
                                    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.7); }
                                    70% { transform: scale(1); box-shadow: 0 0 0 20px rgba(79, 70, 229, 0); }
                                    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(79, 70, 229, 0); }
                                }
                            `}</style>
                            <p className="text-lg font-medium">{status === 'lobby' ? 'Ready to join?' : 'Waiting for other participant...'}</p>
                            {status === 'lobby' && (
                                <button
                                    className="mt-4 px-8 py-3 bg-primary hover:bg-primary/90 text-white rounded-md font-medium transition-colors"
                                    onClick={joinConsultation}
                                >
                                    Join Consultation
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Local Video (PiP) */}
                <div className="absolute top-4 right-4 md:top-6 md:right-6 w-32 h-24 md:w-60 md:h-40 rounded-lg overflow-hidden shadow-xl border-2 border-white/10 bg-slate-800 z-10">
                    <video playsInline muted ref={myVideo} autoPlay className="w-full h-full object-cover transform scale-x-[-1]" />
                    <span className="absolute bottom-2 left-2 bg-black/50 px-2 py-0.5 rounded textxs font-medium backdrop-blur-sm">
                        {user?.name} (You)
                    </span>
                </div>

                {/* Call Controls */}
                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-4 bg-slate-900/80 backdrop-blur-md p-3 md:px-6 rounded-full border border-white/10 z-20">
                    <button
                        className={`h-12 w-12 rounded-full flex items-center justify-center transition-all ${isMuted
                            ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'
                            : 'bg-white/10 hover:bg-white/20 text-white hover:scale-105'
                            }`}
                        onClick={toggleMute}
                        title={isMuted ? 'Unmute' : 'Mute'}
                    >
                        {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    </button>

                    <button
                        className={`h-12 w-12 rounded-full flex items-center justify-center transition-all ${isVideoOff
                            ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'
                            : 'bg-white/10 hover:bg-white/20 text-white hover:scale-105'
                            }`}
                        onClick={toggleVideo}
                        title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
                    >
                        {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                    </button>

                    <button
                        className="h-12 w-12 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 text-white transition-all hover:scale-105 shadow-lg shadow-red-600/30"
                        onClick={endCall}
                        title="End Consultation"
                    >
                        <PhoneOff className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Sidebar / Info (Hidden on mobile by default in CSS, but here we make it responsive) */}
            <div className="w-full md:w-80 bg-slate-800 border-t md:border-t-0 md:border-l border-white/10 flex flex-col p-6 order-2 md:order-2">
                <div className="mb-6">
                    <h3 className="text-xl font-semibold text-white">Specialist Consultation</h3>
                    <p className="text-sm text-slate-400 mt-1">ID: {appointmentId}</p>
                </div>

                <div className="flex-1">
                    <div className="flex items-center gap-3 bg-white/5 p-4 rounded-lg border border-white/5">
                        <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center font-bold text-white">
                            DR
                        </div>
                        <div className="flex flex-col">
                            <span className="font-semibold text-white">Doctor Mpho</span>
                            <span className="text-xs text-green-400 font-medium flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-green-400 inline-block"></span>
                                Connected
                            </span>
                        </div>
                    </div>
                </div>

                <div className="mt-auto bg-white/5 p-4 rounded-lg border border-white/5">
                    <p className="text-xs text-slate-400 mb-3">Video call not working? Use our secure chat fallback below.</p>
                    <button className="w-full py-2 px-4 border border-white/20 hover:bg-white/10 rounded-md text-sm font-medium transition-colors">
                        Open Secure Chat
                    </button>
                </div>
            </div>
        </div>
    );
};
