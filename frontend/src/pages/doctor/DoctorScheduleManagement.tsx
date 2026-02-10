import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { getDoctorSchedule, updateDoctorSchedule } from '../../services/doctor.service';
import type { DoctorSchedule } from '../../services/doctor.service';
import './DoctorScheduleManagement.css';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const DoctorScheduleManagement: React.FC = () => {
    const [schedule, setSchedule] = useState<DoctorSchedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        fetchSchedule();
    }, []);

    const fetchSchedule = async () => {
        try {
            setLoading(true);
            const data = await getDoctorSchedule();
            setSchedule(data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load schedule');
        } finally {
            setLoading(false);
        }
    };

    const handleScheduleChange = (dayOfWeek: number, field: string, value: any) => {
        const existing = schedule.find(s => s.day_of_week === dayOfWeek);

        if (existing) {
            setSchedule(schedule.map(s =>
                s.day_of_week === dayOfWeek ? { ...s, [field]: value } : s
            ));
        } else {
            setSchedule([...schedule, {
                id: 0,
                doctor_id: 0,
                day_of_week: dayOfWeek,
                start_time: '09:00',
                end_time: '17:00',
                is_available: field === 'is_available' ? value : false,
                [field]: value
            }]);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);
            setSuccess(false);

            const scheduleData = schedule.map(s => ({
                day_of_week: s.day_of_week,
                start_time: s.start_time,
                end_time: s.end_time,
                is_available: s.is_available
            }));

            await updateDoctorSchedule(scheduleData);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to update schedule');
        } finally {
            setSaving(false);
        }
    };

    const getScheduleForDay = (dayOfWeek: number) => {
        return schedule.find(s => s.day_of_week === dayOfWeek) || {
            id: 0,
            doctor_id: 0,
            day_of_week: dayOfWeek,
            start_time: '09:00',
            end_time: '17:00',
            is_available: false
        };
    };

    if (loading) {
        return (
            <div className="schedule-container">
                <Card style={{ padding: '2rem', textAlign: 'center' }}>
                    <div className="loading-spinner">Loading schedule...</div>
                </Card>
            </div>
        );
    }

    return (
        <div className="schedule-container fade-in">
            <div className="page-header">
                <div>
                    <h1>Schedule Management</h1>
                    <p>Configure your weekly availability</p>
                </div>
                <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={saving}
                    leftIcon={saving ? undefined : <span className="material-icons-outlined">save</span>}
                >
                    {saving ? 'Saving...' : 'Save Schedule'}
                </Button>
            </div>

            {error && (
                <Card className="alert alert-error">
                    <span className="material-icons-outlined">error</span>
                    {error}
                </Card>
            )}

            {success && (
                <Card className="alert alert-success">
                    <span className="material-icons-outlined">check_circle</span>
                    Schedule updated successfully!
                </Card>
            )}

            <Card className="schedule-card">
                <div className="schedule-list">
                    {DAYS_OF_WEEK.map((day, index) => {
                        const daySchedule = getScheduleForDay(index);
                        return (
                            <div key={index} className="day-row">
                                <div className="day-info">
                                    <label className="toggle-switch">
                                        <input
                                            type="checkbox"
                                            checked={daySchedule.is_available}
                                            onChange={(e) => handleScheduleChange(index, 'is_available', e.target.checked)}
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                    <span className={`day-name ${daySchedule.is_available ? 'active' : ''}`}>
                                        {day}
                                    </span>
                                </div>

                                {daySchedule.is_available && (
                                    <div className="time-inputs">
                                        <div className="time-group">
                                            <label>Start Time</label>
                                            <input
                                                type="time"
                                                value={daySchedule.start_time}
                                                onChange={(e) => handleScheduleChange(index, 'start_time', e.target.value)}
                                                className="time-input"
                                            />
                                        </div>
                                        <span className="time-separator">to</span>
                                        <div className="time-group">
                                            <label>End Time</label>
                                            <input
                                                type="time"
                                                value={daySchedule.end_time}
                                                onChange={(e) => handleScheduleChange(index, 'end_time', e.target.value)}
                                                className="time-input"
                                            />
                                        </div>
                                    </div>
                                )}

                                {!daySchedule.is_available && (
                                    <span className="unavailable-text">Unavailable</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Card>

            <Card className="info-card">
                <div className="info-header">
                    <span className="material-icons-outlined">info</span>
                    <h3>Schedule Guidelines</h3>
                </div>
                <ul className="info-list">
                    <li>Toggle days on/off to set your availability</li>
                    <li>Set start and end times for each available day</li>
                    <li>Appointments will only be bookable during these hours</li>
                    <li>Changes take effect immediately after saving</li>
                </ul>
            </Card>
        </div>
    );
};
