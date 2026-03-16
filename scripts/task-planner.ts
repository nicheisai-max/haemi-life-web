import fs from 'fs';
import path from 'path';

const QUEUE_PATH = path.join(__dirname, '..', '.ai-system', 'task-queue.json');

interface Task {
    id: string;
    description: string;
    status: 'pending' | 'executing' | 'completed' | 'failed';
}

interface TaskQueue {
    tasks: Task[];
    completed: Task[];
    failed: Task[];
}

function loadQueue(): TaskQueue {
    return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
}

function saveQueue(queue: TaskQueue) {
    fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2));
}

export function addTask(description: string) {
    const queue = loadQueue();
    const id = `task-${String(queue.tasks.length + queue.completed.length + queue.failed.length + 1).padStart(3, '0')}`;
    const newTask: Task = { id, description, status: 'pending' };
    queue.tasks.push(newTask);
    saveQueue(queue);
    console.log(`📝 Task Added: [${id}] ${description}`);
}

export function getNextTask(): Task | null {
    const queue = loadQueue();
    return queue.tasks.find((t: Task) => t.status === 'pending') || null;
}

export function markTaskExecuting(id: string) {
    const queue = loadQueue();
    const task = queue.tasks.find((t: Task) => t.id === id);
    if (task) {
        task.status = 'executing';
        saveQueue(queue);
    }
}

export function markTaskComplete(id: string) {
    const queue = loadQueue();
    const index = queue.tasks.findIndex((t: Task) => t.id === id);
    if (index !== -1) {
        const [task] = queue.tasks.splice(index, 1);
        task.status = 'completed';
        queue.completed.push(task);
        saveQueue(queue);
        console.log(`✅ Task Completed: ${id}`);
    }
}

export function markTaskFailed(id: string) {
    const queue = loadQueue();
    const index = queue.tasks.findIndex((t: Task) => t.id === id);
    if (index !== -1) {
        const [task] = queue.tasks.splice(index, 1);
        task.status = 'failed';
        queue.failed.push(task);
        saveQueue(queue);
        console.log(`❌ Task Failed: ${id}`);
    }
}

// CLI Support
const command = process.argv[2];
const arg = process.argv[3];

if (command === 'add' && arg) {
    addTask(arg);
} else if (command === 'list') {
    console.log(loadQueue());
}
