// types/jobs.ts

export enum JobStatus {
    PENDING = "PENDING",
    PROCESSING = "PROCESSING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
}

export interface WebSocketMessage {
    job_id: number; // ID is now a number
    status: JobStatus;
    text?: string;
    error?: string;
    filename?: string;
    type: 'status_update' | 'job_completed' | 'job_failed' | 'error';
}