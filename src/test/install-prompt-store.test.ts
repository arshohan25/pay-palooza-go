import { afterEach, describe, expect, it } from "vitest";
import {
  captureInstallPrompt,
  clearPrompt,
  getInstallPromptForManifest,
  getInstallPromptManifestHref,
} from "@/lib/installPromptStore";

function dispatchPrompt(manifestHref: string) {
  document.head.innerHTML = `<link rel="manifest" href="${manifestHref}">`;
  const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  };
  event.prompt = async () => {};
  event.userChoice = Promise.resolve({ outcome: "dismissed" });
  window.dispatchEvent(event);
  return event;
}

describe("installPromptStore", () => {
  afterEach(() => {
    clearPrompt();
    document.head.innerHTML = "";
  });

  it("returns a captured install prompt only for the manifest that fired it", () => {
    captureInstallPrompt();

    const agentPrompt = dispatchPrompt("/manifest-agent.json");

    expect(getInstallPromptManifestHref()).toBe("/manifest-agent.json");
    expect(getInstallPromptForManifest("/manifest-agent.json")).toBe(agentPrompt);
    expect(getInstallPromptForManifest("/manifest-merchant.json")).toBeNull();
  });

  it("replaces a stale role prompt when another role manifest fires", () => {
    captureInstallPrompt();

    dispatchPrompt("/manifest-agent.json");
    const merchantPrompt = dispatchPrompt("/manifest-merchant.json");

    expect(getInstallPromptManifestHref()).toBe("/manifest-merchant.json");
    expect(getInstallPromptForManifest("/manifest-agent.json")).toBeNull();
    expect(getInstallPromptForManifest("/manifest-merchant.json")).toBe(merchantPrompt);
  });
});