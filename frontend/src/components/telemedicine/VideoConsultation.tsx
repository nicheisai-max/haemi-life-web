import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import { useAuth } from '../../context/AuthContext';
import './VideoConsultation.css';

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
    const peerRef = useRef<any>(null);

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

        socketRef.current.on('call-made', async ({ offer, socket: from }: any) => {
            // console.log("Receiving call from:", from);
            answerCall(offer, from);
        });

        socketRef.current.on('answer-made', async ({ answer }: any) => {
            // console.log("Call answered");
            await peerRef.current.signal(answer);
            setStatus('active');
        });

        socketRef.current.on('ice-candidate', ({ candidate }: any) => {
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
            <div className="consultation-ended">
                <div className="ended-card">
                    <span className="material-icons-outlined large-icon text-success">check_circle</span>
                    <h2>Consultation Ended</h2>
                    <p>Thank you for using Haemi Life. Returning you to dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="video-consultation-container">
            <div className="video-viewport">
                {/* Remote Video (Large) */}
                <div className="remote-video-container">
                    {status === 'active' ? (
                        <video playsInline ref={userVideo} autoPlay className="remote-video" />
                    ) : (
                        <div className="waiting-placeholder">
                            <div className="pulse-loader"></div>
                            <p>{status === 'lobby' ? 'Ready to join?' : 'Waiting for other participant...'}</p>
                            {status === 'lobby' && (
                                <button className="btn btn-primary join-btn" onClick={joinConsultation}>
                                    Join Consultation
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Local Video (PiP) */}
                <div className="local-video-container">
                    <video playsInline muted ref={myVideo} autoPlay className="local-video" />
                    <span className="local-name">{user?.name} (You)</span>
                </div>

                {/* Call Controls */}
                <div className="call-controls">
                    <button
                        className={`control-btn ${isMuted ? 'active danger' : ''}`}
                        onClick={toggleMute}
                        title={isMuted ? 'Unmute' : 'Mute'}
                    >
                        <span className="material-icons-outlined">
                            {isMuted ? 'mic_off' : 'mic'}
                        </span>
                    </button>

                    <button
                        className={`control-btn ${isVideoOff ? 'active danger' : ''}`}
                        onClick={toggleVideo}
                        title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
                    >
                        <span className="material-icons-outlined">
                            {isVideoOff ? 'videocam_off' : 'videocam'}
                        </span>
                    </button>

                    <button className="control-btn end-call-btn" onClick={endCall} title="End Consultation">
                        <span className="material-icons-outlined">call_end</span>
                    </button>
                </div>
            </div>

            {/* Sidebar / Info */}
            <div className="consultation-sidebar">
                <div className="consultation-header">
                    <h3>Specialist Consultation</h3>
                    <p className="appointment-id">ID: {appointmentId}</p>
                </div>

                <div className="participant-info">
                    <div className="participant">
                        <div className="pt-avatar">DR</div>
                        <div className="pt-details">
                            <span className="pt-name">Doctor Mpho</span>
                            <span className="pt-status online">Connected</span>
                        </div>
                    </div>
                </div>

                <div className="chat-fallback">
                    <p className="note">Video call not working? Use our secure chat fallback below.</p>
                    <button className="btn btn-outline btn-block">Open Secure Chat</button>
                </div>
            </div>
        </div>
    );
};
