import { BiowasmService } from "./biowasm";

/**
 * PreloaderService
 *
 * Initializes all external dependencies during app startup to eliminate
 * loading delays when the user interacts with the application. Preloads two
 * separate Aioli instances (FastTree and TN93) in parallel, and falls back to
 * on-demand initialization if a preload fails.
 */

export interface PreloadStatus {
  fasttree: boolean;
  tn93: boolean;
  all: boolean;
}

class PreloaderService {
  private fasttreeInstance: BiowasmService | null = null;
  private fasttreeInitialized = false;
  private tn93Instance: BiowasmService | null = null;
  private tn93Initialized = false;
  private loadingPromise: Promise<void> | null = null;

  /**
   * Preloads all external dependencies. Should be called during app
   * initialization. Returns the existing promise if already in progress.
   */
  async preloadAll(): Promise<void> {
    if (this.loadingPromise) {
      return this.loadingPromise;
    }
    this.loadingPromise = this.executePreload();
    return this.loadingPromise;
  }

  private async executePreload(): Promise<void> {
    console.log("🚀 Starting preload of all external dependencies...");
    const startTime = performance.now();

    try {
      // Preload in parallel; allSettled lets the app continue even if one fails.
      const results = await Promise.allSettled([
        this.preloadFastTree(),
        this.preloadTN93(),
      ]);

      const duration = (performance.now() - startTime).toFixed(2);
      const fasttreeSuccess = results[0].status === "fulfilled";
      const tn93Success = results[1].status === "fulfilled";

      if (fasttreeSuccess && tn93Success) {
        console.log(`✅ All dependencies preloaded successfully in ${duration}ms`);
      } else {
        console.log(`⚠️ Partial preload completed in ${duration}ms`);
        if (!fasttreeSuccess) {
          console.warn("❌ FastTree preload failed - will attempt on-demand loading");
        }
        if (!tn93Success) {
          console.warn("❌ TN93 preload failed - will attempt on-demand loading");
        }
      }
    } catch (error) {
      console.error("❌ Error during preload:", error);
      // Don't throw - allow the app to continue with on-demand loading.
    }
  }

  /** Preloads Biowasm/Aioli with FastTree. */
  private async preloadFastTree(): Promise<void> {
    if (this.fasttreeInstance && this.fasttreeInitialized) {
      return;
    }
    try {
      this.fasttreeInstance = new BiowasmService(["fasttree/2.1.11"]);
      await this.fasttreeInstance.init();
      this.fasttreeInitialized = true;
    } catch (error) {
      console.error("❌ Failed to preload FastTree:", error);
      this.fasttreeInstance = null;
      this.fasttreeInitialized = false;
    }
  }

  /** Preloads Biowasm/Aioli with TN93. */
  private async preloadTN93(): Promise<void> {
    if (this.tn93Instance && this.tn93Initialized) {
      return;
    }
    try {
      this.tn93Instance = new BiowasmService(["tn93/1.0.11"]);
      await this.tn93Instance.init();
      this.tn93Initialized = true;
    } catch (error) {
      console.error("❌ Failed to preload TN93:", error);
      this.tn93Instance = null;
      this.tn93Initialized = false;
    }
  }

  /**
   * Gets the preloaded FastTree instance, initializing on-demand if the
   * preload failed or was never started.
   */
  async getFastTreeInstance(): Promise<BiowasmService> {
    if (this.loadingPromise) {
      await this.loadingPromise;
    }
    if (this.fasttreeInstance && this.fasttreeInitialized) {
      return this.fasttreeInstance;
    }
    console.warn("⚠️ FastTree not preloaded, initializing on-demand...");
    try {
      const service = new BiowasmService(["fasttree/2.1.11"]);
      await service.init();
      this.fasttreeInstance = service;
      this.fasttreeInitialized = true;
      return this.fasttreeInstance;
    } catch (error) {
      console.error("❌ Failed to initialize FastTree:", error);
      throw new Error(
        "Failed to initialize FastTree. Please check your internet connection and try again."
      );
    }
  }

  /**
   * Gets the preloaded TN93 instance, initializing on-demand if the preload
   * failed or was never started.
   */
  async getTN93Instance(): Promise<BiowasmService> {
    if (this.loadingPromise) {
      await this.loadingPromise;
    }
    if (this.tn93Instance && this.tn93Initialized) {
      return this.tn93Instance;
    }
    console.warn("⚠️ TN93 not preloaded, initializing on-demand...");
    try {
      const service = new BiowasmService(["tn93/1.0.11"]);
      await service.init();
      this.tn93Instance = service;
      this.tn93Initialized = true;
      return this.tn93Instance;
    } catch (error) {
      console.error("❌ Failed to initialize TN93:", error);
      throw new Error(
        "Failed to initialize TN93. Please check your internet connection and try again."
      );
    }
  }

  /** Gets loading status for UI feedback. */
  getLoadingStatus(): PreloadStatus {
    return {
      fasttree: this.fasttreeInstance !== null && this.fasttreeInitialized,
      tn93: this.tn93Instance !== null && this.tn93Initialized,
      all:
        this.fasttreeInstance !== null &&
        this.fasttreeInitialized &&
        this.tn93Instance !== null &&
        this.tn93Initialized,
    };
  }
}

// Export singleton instance
export const preloader = new PreloaderService();