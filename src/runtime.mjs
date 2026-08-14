import { OverlayController } from "./controller.mjs";
import { createFileModeStore } from "./mode-store.mjs";
import { createProtocol } from "./protocol.mjs";
import { TranslationService } from "./translation-service.mjs";

export function createBilingualRuntime(options = {}) {
  const translation = options.translation ?? new TranslationService();
  const modeStore = options.modeStore ?? createFileModeStore();
  const controller = options.controller ?? new OverlayController({
    translate: (text) => translation.translate(text),
  });

  const getRuntimeStatus = () => {
    const overlayStatus = controller.getStatus();
    const translationStatus = translation.getStatus();
    return {
      ...overlayStatus,
      ...translationStatus,
      lastError: overlayStatus.lastError ?? translationStatus.lastError ?? null,
    };
  };

  const protocol = createProtocol({
    onModeChange: (mode) => controller.setMode(mode),
    getRuntimeStatus,
    modeStore,
  });

  const close = async () => {
    try {
      await controller.setMode("off");
    } finally {
      translation.close();
    }
  };

  return { close, controller, protocol, translation };
}
