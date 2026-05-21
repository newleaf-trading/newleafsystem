import { randomUUID } from 'crypto';
import type { TradeIdea, VerificationJob, Verdict, AgentStatus } from '../types.js';

/**
 * JobStore with dual backend:
 * - Development: in-memory Map (fast, no Firestore needed)
 * - Production: Firestore (persistent across function instances)
 */
export class JobStore {
  private memJobs = new Map<string, VerificationJob>();
  private get useFirestore() {
    return process.env.NODE_ENV === 'production';
  }

  private async db() {
    const { getFirestore } = await import('firebase-admin/firestore');
    return getFirestore().collection('jobs');
  }

  async createJob(input: TradeIdea): Promise<string> {
    const jobId = randomUUID();
    const job: VerificationJob = { jobId, status: 'running', input, createdAt: Date.now(), agents: {} };

    if (this.useFirestore) {
      const col = await this.db();
      await col.doc(jobId).set(job);
    } else {
      this.memJobs.set(jobId, job);
    }
    return jobId;
  }

  async updateAgent(jobId: string, agent: string, status: AgentStatus, payload?: unknown): Promise<void> {
    if (this.useFirestore) {
      const col = await this.db();
      await col.doc(jobId).update({ [`agents.${agent}`]: { status, payload } });
    } else {
      const job = this.memJobs.get(jobId);
      if (!job) return;
      job.agents = { ...(job.agents ?? {}), [agent]: { status, payload } };
    }
  }

  async finalizeJob(jobId: string, verdict: Verdict): Promise<void> {
    if (this.useFirestore) {
      const col = await this.db();
      await col.doc(jobId).update({ status: 'complete', verdict, completedAt: Date.now() });
    } else {
      const job = this.memJobs.get(jobId);
      if (!job) return;
      job.status = 'complete';
      job.verdict = verdict;
      job.completedAt = Date.now();
    }
  }

  async failJob(jobId: string, err: unknown): Promise<void> {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (this.useFirestore) {
      const col = await this.db();
      await col.doc(jobId).update({ status: 'failed', error: errorMsg });
    } else {
      const job = this.memJobs.get(jobId);
      if (!job) return;
      job.status = 'failed';
      job.error = errorMsg;
    }
  }

  async getJob(jobId: string): Promise<VerificationJob | undefined> {
    if (this.useFirestore) {
      const col = await this.db();
      const doc = await col.doc(jobId).get();
      return doc.exists ? (doc.data() as VerificationJob) : undefined;
    }
    return this.memJobs.get(jobId);
  }
}
