import React, { useState, useEffect, useCallback, useRef } from 'react';
import './PomodoroTimer.css';

type TimerMode = 'focus' | 'rest';

interface Task {
  id: string;
  text: string;
  completed: boolean;
  estimatedTimers?: number;
  project?: string;
  finishedTimers: number;
}

const PomodoroTimer: React.FC = () => {
  const [mode, setMode] = useState<TimerMode>('focus');
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes in seconds
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [isTaskInputExpanded, setIsTaskInputExpanded] = useState(false);
  const [estimatedTimers, setEstimatedTimers] = useState(1);
  const [selectedProject, setSelectedProject] = useState('');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const focusTime = 25 * 60; // 25 minutes
  const restTime = 5 * 60; // 5 minutes

  // Sample projects - you can expand this
  const projects = ['Work', 'Study', 'Personal', 'Health', 'Learning', 'Other'];

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

  // Task management functions
  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskText.trim()) {
      const newTask: Task = {
        id: Date.now().toString(),
        text: newTaskText.trim(),
        completed: false,
        estimatedTimers: estimatedTimers,
        project: selectedProject || undefined,
        finishedTimers: 0,
      };
      setTasks([...tasks, newTask]);
      setNewTaskText('');
      setEstimatedTimers(1);
      setSelectedProject('');
      setIsTaskInputExpanded(false);
    }
  };

  const toggleTask = (taskId: string) => {
    setTasks(tasks.map(task => 
      task.id === taskId ? { ...task, completed: !task.completed } : task
    ));
  };

  const deleteTask = (taskId: string) => {
    setTasks(tasks.filter(task => task.id !== taskId));
  };

  const handleTaskInputClick = () => {
    setIsTaskInputExpanded(true);
  };

  // Find the topmost incomplete task
  const topmostIncompleteTaskIndex = tasks.findIndex(task => !task.completed);

  // Drag and drop functions
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    (e.currentTarget as HTMLElement).style.opacity = '0.5';
    setDraggedTaskId(taskId);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = '1';
    setDraggedTaskId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const targetTaskId = (e.currentTarget as HTMLElement).dataset.taskId;
    if (targetTaskId) {
      setDragOverTaskId(targetTaskId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault();
    const draggedTaskId = e.dataTransfer.getData('text/plain');
    
    if (draggedTaskId === targetTaskId) return;

    const draggedIndex = tasks.findIndex(task => task.id === draggedTaskId);
    const targetIndex = tasks.findIndex(task => task.id === targetTaskId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;

    const newTasks = [...tasks];
    const [draggedTask] = newTasks.splice(draggedIndex, 1);
    newTasks.splice(targetIndex, 0, draggedTask);
    
    setTasks(newTasks);
    setDragOverTaskId(null);
  };

  useEffect(() => {
    let interval: number | null = null;

    if (isRunning && !isPaused && timeLeft > 0) {
      interval = window.setInterval(() => {
        setTimeLeft((prev: number) => {
          if (prev <= 1) {
            setIsRunning(false);
            setIsPaused(false);
            
            // This line may be triggered twice because setTimeLeft is called in a setInterval,
            // and when prev <= 1, the callback is executed, but React's state batching and
            // asynchronous updates can cause the effect to run more than once before the interval is cleared.
            // To prevent double-triggering, you can add a guard to only play the sound when timeLeft actually reaches 0.
            if (prev === 1) {
              // Prevent double-triggering by using a ref as a guard
              if (!(window as any).__pomodoroTimerEnds) {
                // Play notification sound when timer ends
                playNotificationSound();
                (window as any).__pomodoroTimerEnds = true;
                setTimeout(() => { (window as any).__pomodoroTimerEnds = false; }, 1000); // reset after 1s
            
                // Increment finishedTimers for topmost incomplete task if in focus mode
                if (mode === 'focus' && topmostIncompleteTaskIndex !== -1) {
                  setTasks(prevTasks => 
                    prevTasks.map((task, index) => 
                      index === topmostIncompleteTaskIndex 
                        ? { ...task, finishedTimers: task.finishedTimers + 1 }
                        : task
                    )
                  );
                }
              }
            }
            
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

  // Update browser title with timer
  useEffect(() => {
    const title = isRunning && !isPaused 
      ? mode === 'focus'
        ? `🍅 ${formatTime(timeLeft)} - Focus`
        : `💤 ${formatTime(timeLeft)} - Break`
      : isPaused 
        ? `⭕️ ${formatTime(timeLeft)} - Paused`
        : `${formatTime(timeLeft)} - Idle`;
    
    document.title = title;
  }, [timeLeft, isRunning, isPaused]);

  return (
    <div className="pomodoro-container">
      {/* Header */}
      <div className="header">
        <div className="brand">
          <h1 className="brand-title">pomodoro noir 🍅</h1>
          <p className="brand-subtitle">dark themed deep focus</p>
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
            Focus
          </button>
          <button
            className={`mode-button ${mode === 'rest' ? 'active' : ''}`}
            onClick={() => switchMode('rest')}
          >
            Break
          </button>
        </div>

        {/* Timer Display */}
        <div className="timer-display" onClick={toggleTimer}>
          <span className="timer-text">{formatTime(timeLeft)}</span>
        </div>

        {/* Current Task Display */}
        {topmostIncompleteTaskIndex !== -1 && (
          <div className="current-task-display">
            <span className="current-task-label">Current Focus:</span>
            <span className="current-task-name">{tasks[topmostIncompleteTaskIndex].text}</span>
          </div>
        )}

        {/* Action Buttons */}
        {/* <div className="action-buttons">
        </div> */}
      </div>

      {/* Task List Section */}
      <div className="task-section">
        {/* <h3 className="task-title">Tasks 📝</h3> */}
        
        {/* Add Task Form */}
        <form onSubmit={addTask} className="task-form">
          <input
            type="text"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            placeholder="Add a new task..."
            className="task-input"
            onClick={handleTaskInputClick}
          />
          {isTaskInputExpanded && newTaskText.trim() && (
            <div className="task-input-expanded">
              <div className="estimated-timers-container">
                <div className="estimated-timers-label-container">
                  <span className="estimated-timers-label">🍅 x </span>
                </div>
                <div className="estimated-timers-controls">
                  
                  <input
                    type="number"
                    value={estimatedTimers}
                    onChange={(e) => setEstimatedTimers(Math.max(1, Number(e.target.value)))}
                    placeholder="1"
                    className="estimated-timers-input"
                    min="1"
                  />
                  <button
                    type="button"
                    className="timer-control-btn"
                    onClick={() => setEstimatedTimers(Math.max(1, estimatedTimers - 1))}
                  >
                    ➖
                  </button>
                  <button
                    type="button"
                    className="timer-control-btn"
                    onClick={() => setEstimatedTimers(estimatedTimers + 1)}
                  >
                    ➕
                  </button>
                </div>
              </div>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="project-select"
              >
                <option value="">Select a project</option>
                {projects.map(project => (
                  <option key={project} value={project}>{project}</option>
                ))}
              </select>
              <button type="submit" className="add-task-button">
                ➕
              </button>
            </div>
          )}
        </form>

        {/* Task List */}
        <div className="task-list">
          {tasks.length === 0 ? (
            <p className="no-tasks">No tasks yet. Add one above! ✨</p>
          ) : (
            tasks.map(task => (
              <div
                key={task.id}
                className={`task-item ${task.completed ? 'completed' : ''} ${
                  draggedTaskId === task.id ? 'dragging' : ''
                } ${
                  dragOverTaskId === task.id ? 'drag-over' : ''
                }`}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, task.id)}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, task.id)}
                data-task-id={task.id}
              >
                <button
                  className="task-checkbox"
                  onClick={() => toggleTask(task.id)}
                >
                  {task.completed ? '✔️' : 
                    tasks.indexOf(task) === topmostIncompleteTaskIndex ? '🕓' : '⭕️'}
                </button>
                <div className="task-content">
                  <span className="task-text">{task.text}</span>
                  {(task.estimatedTimers || task.project || task.finishedTimers > 0) && (
                    <div className="task-meta">
                      {task.estimatedTimers && (
                        <span className="task-estimate">🍅 {task.finishedTimers}/{task.estimatedTimers}</span>
                      )}
                      {task.project && (
                        <span className="task-project">📁 {task.project}</span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  className="delete-task-button"
                  onClick={() => deleteTask(task.id)}
                >
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      {/* <div className="footer">
        <button className="icon-button">
        ⚙️
        </button> 
      </div> */}
    </div>
  );
};

export default PomodoroTimer; 