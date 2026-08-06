import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import { PLUGIN_ID } from "./manifest.js";

export type ActivityKind = "coding" | "research" | "writing" | "meeting" | "idle";

export type AgentLiveEvent = {
  kind: "status" | "run-started" | "run-finished" | "run-failed" | "run-cancelled";
  agentId: string;
  status: string | null;
  activityKind: ActivityKind;
  at: string;
};

const AGENT_EVENTS = [
  ["agent.status_changed", "status"],
  ["agent.updated", "status"],
  ["agent.run.started", "run-started"],
  ["agent.run.finished", "run-finished"],
  ["agent.run.failed", "run-failed"],
  ["agent.run.cancelled", "run-cancelled"],
] as const;

const activityChannel = (companyId: string) => `agent-activity:${companyId}`;

function inferActivityKind(agent: { name: string; title: string | null; role: string; status: string }): ActivityKind {
  if (agent.status !== "running") return "idle";

  const text = `${agent.name} ${agent.title ?? ""} ${agent.role}`.toLowerCase();
  if (text.includes("research") || text.includes("seo") || text.includes("analyst")) return "research";
  if (text.includes("copy") || text.includes("content") || text.includes("writer") || text.includes("email")) return "writing";
  if (text.includes("ceo") || text.includes("cmo") || text.includes("strateg")) return "meeting";
  if (text.includes("engineer") || text.includes("devops") || text.includes("cto") || text.includes("software")) return "coding";

  return agent.status === "running" || agent.status === "active" ? "coding" : "idle";
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info("Agent Pixels plugin setup complete");

    const openChannels = new Set<string>();
    function ensureChannel(companyId: string): string {
      const channel = activityChannel(companyId);
      if (!openChannels.has(channel)) {
        ctx.streams.open(channel, companyId);
        openChannels.add(channel);
      }
      return channel;
    }

    for (const [eventType, kind] of AGENT_EVENTS) {
      ctx.events.on(eventType, async (event) => {
        const payload = typeof event.payload === "object" && event.payload !== null ? event.payload : null;
        const payloadAgentId =
          payload && "agentId" in payload && typeof payload.agentId === "string" ? payload.agentId : null;
        // `agent.status_changed` / `agent.updated` carry the agent as the entity, but
        // `agent.run.*` carry the run — reading entityId unconditionally would hand
        // ctx.agents.get a run id and silently drop every run event. Trust entityId
        // only when the host says it is an agent; otherwise take payload.agentId.
        // The real host payload shape is still unverified, hence the final fallback.
        const agentId =
          event.entityType === "agent" ? event.entityId : (payloadAgentId ?? event.entityId ?? null);
        if (!agentId) return;

        const agent = await ctx.agents.get(agentId, event.companyId);
        if (!agent) return;

        ctx.streams.emit(ensureChannel(event.companyId), {
          kind,
          agentId,
          status: agent.status,
          activityKind: inferActivityKind(agent),
          at: event.occurredAt,
        } satisfies AgentLiveEvent);
      });
    }

    ctx.data.register("camera-room", async (params) => {
      const companyId = typeof params.companyId === "string" ? params.companyId : null;
      const agents = companyId ? await ctx.agents.list({ companyId, limit: 100, offset: 0 }) : [];

      return {
        room: "Office",
        fetchedAt: new Date().toISOString(),
        agents: agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          status: agent.status,
          urlKey: agent.urlKey,
          role: agent.role,
          title: agent.title,
          activityKind: inferActivityKind(agent),
        })),
      };
    });

    ctx.data.register("character-settings", async (params) => {
      const companyId = typeof params.companyId === "string" ? params.companyId : null;
      const agents = companyId ? await ctx.agents.list({ companyId, limit: 100, offset: 0 }) : [];

      return {
        agents: agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          status: agent.status,
          urlKey: agent.urlKey,
        })),
      };
    });
  },

  async onHealth() {
    return { status: "ok", message: `${PLUGIN_ID} ready` };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
