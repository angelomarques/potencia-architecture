export interface Env {
  CF_QUEUE_NAME?: string;
}

export default {
  async queue(batch: MessageBatch, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      console.log("[cf-queues] message", env.CF_QUEUE_NAME, msg.id, msg.body);
      msg.ack();
    }
  },
};
