import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { createSettingsSnapshotRoute } from "../server/routes/settings-snapshot.ts";

let tmpRoot: string | null = null;

async function writeFile(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");
}

async function makeEngine() {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hana-settings-snapshot-"));
  const agentsDir = path.join(tmpRoot, "agents");
  const userDir = path.join(tmpRoot, "user");
  const agentDir = path.join(agentsDir, "agent-a");
  await writeFile(path.join(agentDir, "config.yaml"), [
    "agent:",
    "  name: Agent A",
    "desk:",
    "  home_folder: /tmp/agent-a",
    "memory:",
    "  enabled: false",
    "experience:",
    "  enabled: false",
    "",
  ].join("\n"));
  await writeFile(path.join(agentDir, "identity.md"), "identity");
  await writeFile(path.join(agentDir, "ishiki.md"), "ishiki");
  await writeFile(path.join(agentDir, "public-ishiki.md"), "public");
  await writeFile(path.join(agentDir, "pinned.md"), "keep this");
  await writeFile(path.join(userDir, "profile.md"), "user profile");

  return {
    agentsDir,
    userDir,
    currentAgentId: "agent-a",
    listAgents: () => [{ id: "agent-a", name: "Agent A" }],
    getAgent: () => ({ tools: [] }),
    providerRegistry: {
      getAllProvidersRaw: () => ({}),
      get: () => null,
    },
    pluginManager: {
      getAllTools: () => [],
      getAllowFullAccess: () => false,
      getUserPluginsDir: () => path.join(userDir, "plugins"),
      getSettingsTabs: () => [],
    },
    preferences: {
      getExperimentValue: () => undefined,
    },
    getComputerUseSettings: () => ({ enabled: false }),
    getSharedModels: () => ({ utility: { id: "utility" }, utility_large: { id: "utility-large" } }),
    getThinkingLevel: () => "medium",
    getSearchConfig: () => ({ provider: "", api_key: "", api_keys: {} }),
    getUtilityApi: () => ({ provider: "", base_url: "", api_key: "" }),
    getQuickChatPreferences: () => ({ shortcut: "CommandOrControl+Shift+K", reuseTimeoutMinutes: 12 }),
    getNotificationPreferences: () => ({ turnCompletion: "when_session_unfocused" }),
    getBridgePermissionMode: () => "operate",
    getBridgeReadOnly: () => false,
    getBridgeReceiptEnabled: () => false,
    getSpeechRecognitionConfig: () => ({ enabled: false }),
    getKeepAwake: () => false,
    getHeartbeatMaster: () => false,
    getAutomationPermissionMode: () => "auto",
  };
}

describe("settings snapshot route", () => {
  afterEach(async () => {
    if (tmpRoot) {
      await fs.rm(tmpRoot, { recursive: true, force: true });
      tmpRoot = null;
    }
  });

  it("returns one settings snapshot without losing explicit false values", async () => {
    const engine = await makeEngine();
    const app = new Hono();
    app.route("/api", createSettingsSnapshotRoute(engine));

    const res = await app.request("/api/settings/snapshot?agentId=agent-a");
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.agentId).toBe("agent-a");
    expect(body.config.agent.name).toBe("Agent A");
    expect(body.config.memory.enabled).toBe(false);
    expect(body.config.keep_awake).toBe(false);
    expect(body.config.desk.heartbeat_master).toBe(false);
    expect(body.preferences.bridge).toEqual({
      permissionMode: "operate",
      readOnly: false,
      receiptEnabled: false,
    });
    expect(body.preferences.speechRecognition.enabled).toBe(false);
    expect(body.plugins.allowFullAccess).toBe(false);
    expect(body.plugins.devToolsEnabled).toBe(false);
    expect(body.identity).toBe("identity");
    expect(body.ishiki).toBe("ishiki");
    expect(body.publicIshiki).toBe("public");
    expect(body.userProfile).toBe("user profile");
  });
});
