import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import { PLUGIN_ID } from "./manifest.js";

export type ActivityKind = "coding" | "research" | "writing" | "meeting" | "idle";

export type AgentLiveEvent = {
  kind: "status" | "run-started" | "run-finished" | "run-failed" | "run-cancelled";
  agentId: string;
  status: string | null;
  activityKind: ActivityKind;
  /** Title of the in-progress issue assigned to this agent, or null. */
  taskTitle: string | null;
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

/**
 * Map agentId -> title of the issue that agent is currently working on.
 *
 * Deliberately one `issues.list` call for the whole company rather than one
 * per agent: the camera lists up to 100 agents, and a per-agent lookup would
 * fan that out into 100 round trips every time the page mounts.
 */
async function fetchCurrentTasks(
  ctx: { issues: { list(input: Record<string, unknown>): Promise<Array<{ title: string; assigneeAgentId: string | null }>> } },
  companyId: string,
): Promise<Map<string, string>> {
  const byAgent = new Map<string, string>();
  try {
    const issues = await ctx.issues.list({ companyId, status: "in_progress", limit: 200, offset: 0 });
    for (const issue of issues) {
      if (!issue.assigneeAgentId) continue;
      // Keep the first one: an agent with several in-progress issues still only
      // gets one line of canvas real estate.
      if (!byAgent.has(issue.assigneeAgentId)) byAgent.set(issue.assigneeAgentId, issue.title);
    }
  } catch {
    // Task titles are decorative; never let a failure here blank the office.
  }
  return byAgent;
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

        const tasks = await fetchCurrentTasks(ctx, event.companyId);

        ctx.streams.emit(ensureChannel(event.companyId), {
          kind,
          agentId,
          status: agent.status,
          activityKind: inferActivityKind(agent),
          taskTitle: tasks.get(agentId) ?? null,
          at: event.occurredAt,
        } satisfies AgentLiveEvent);
      });
    }

    ctx.data.register("camera-room", async (params) => {
      const companyId = typeof params.companyId === "string" ? params.companyId : null;
      // Previously the channel only opened lazily, the first time a subscribed
      // agent event fired after this worker process started — so a company
      // with no qualifying event since worker boot never got a channel at
      // all, and usePluginStream on the UI side sat permanently unconnected
      // (no error, just nothing to attach to) with no way to recover short of
      // an actual event arriving. Open it eagerly as soon as the UI asks for
      // camera-room data, which happens on every mount.
      if (companyId) ensureChannel(companyId);
      const agents = companyId ? await ctx.agents.list({ companyId, limit: 100, offset: 0 }) : [];
      const tasks = companyId ? await fetchCurrentTasks(ctx, companyId) : new Map<string, string>();

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
          taskTitle: tasks.get(agent.id) ?? null,
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
