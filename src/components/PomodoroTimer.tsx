import React, { useState, useEffect, useCallback, useRef } from 'react';
import './PomodoroTimer.css';

type TimerMode = 'focus' | 'rest';

const PomodoroTimer: React.FC = () => {
  const [mode, setMode] = useState<TimerMode>('focus');
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes in seconds
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const focusTime = 25 * 60; // 25 minutes
  const restTime = 5 * 60; // 5 minutes

  // Function to play notification sound
  const playNotificationSound = useCallback(() => {
    try {
      // Create audio context if it doesn't exist
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Create a pleasant notification sound
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // Start at 800Hz
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1); // Drop to 600Hz
      oscillator.frequency.setValueAtTime(400, audioContext.currentTime + 0.2); // Drop to 400Hz

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);

      // Also try to play a system notification sound as fallback
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Timer Complete!', {
          body: mode === 'focus' ? 'Focus session completed! Time for a break.' : 'Break completed! Ready to focus?',
          icon: '/favicon.ico'
        });
      }
    } catch (error) {
      console.log('Could not play notification sound:', error);
    }
  }, [mode]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setIsPaused(false);
    setTimeLeft(mode === 'focus' ? focusTime : restTime);
  }, [mode, focusTime, restTime]);

  const toggleTimer = () => {
    if (isRunning) {
      setIsPaused(!isPaused);
    } else {
      setIsRunning(true);
      setIsPaused(false);
    }
  };

  const switchMode = (newMode: TimerMode) => {
    setMode(newMode);
    setIsRunning(false);
    setIsPaused(false);
    setTimeLeft(newMode === 'focus' ? focusTime : restTime);
  };

  useEffect(() => {
    let interval: number | null = null;

    if (isRunning && !isPaused && timeLeft > 0) {
      interval = window.setInterval(() => {
        setTimeLeft((prev: number) => {
          if (prev <= 1) {
            setIsRunning(false);
            setIsPaused(false);
            
            // Play notification sound when timer ends
            playNotificationSound();
            
            // Auto-switch to rest mode when focus timer ends
            if (mode === 'focus') {
              setMode('rest');
              return restTime;
            } else {
              setMode('focus');
              return focusTime;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, isPaused, timeLeft, mode, focusTime, restTime, playNotificationSound]);

  // Request notification permission on component mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <div className="pomodoro-container">
      {/* Header */}
      <div className="header">
        <div className="brand">
          <h1 className="brand-title">pomodoro noir 🍅</h1>
          <p className="brand-subtitle">open focus advisor</p>
        </div>
      </div>

      {/* Main Timer Section */}
      <div className="timer-section">
        {/* Mode Selection Buttons */}
        <div className="mode-buttons">
          <button
            className={`mode-button ${mode === 'focus' ? 'active' : ''}`}
            onClick={() => switchMode('focus')}
          >
            Focus 💡
          </button>
          <button
            className={`mode-button ${mode === 'rest' ? 'active' : ''}`}
            onClick={() => switchMode('rest')}
          >
            Break 💤
          </button>
        </div>

        {/* Timer Display */}
        <div className="timer-display">
          <span className="timer-text">{formatTime(timeLeft)}</span>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button className="start-button" onClick={toggleTimer}>
            {isRunning && !isPaused ? 'Pause ⏸️' : 'Start ▶️'}
          </button>
          <button className="reset-button" onClick={resetTimer}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
              <path d="M3 21v-5h5"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="footer">
        <button className="icon-button">
        ⚙️
        </button>
      </div>
    </div>
  );
};

export default PomodoroTimer; 