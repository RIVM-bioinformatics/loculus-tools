import { BiowasmService } from './BiowasmService';

class PreloaderService {
  private fasttreeInitialized = false;
  private fasttreeInstance: BiowasmService | null = null;
  private loadingPromise: null | Promise<void> = null;
  private tn93Initialized = false;
  private tn93Instance: BiowasmService | null = null;

  public async getFastTreeInstance(): Promise<BiowasmService> {
    if (this.loadingPromise) {
      await this.loadingPromise;
    }
    if (this.fasttreeInstance && this.fasttreeInitialized) {
      return this.fasttreeInstance;
    }
    const service = new BiowasmService(['fasttree/2.1.11']);
    await service.init();
    this.fasttreeInstance = service;
    this.fasttreeInitialized = true;
    return this.fasttreeInstance;
  }

  public getLoadingStatus(): { all: boolean; fasttree: boolean; tn93: boolean } {
    return {
      all: this.fasttreeInitialized && this.tn93Initialized,
      fasttree: this.fasttreeInstance !== null && this.fasttreeInitialized,
      tn93: this.tn93Instance !== null && this.tn93Initialized,
    };
  }

  public async getTN93Instance(): Promise<BiowasmService> {
    if (this.loadingPromise) {
      await this.loadingPromise;
    }
    if (this.tn93Instance && this.tn93Initialized) {
      return this.tn93Instance;
    }
    const service = new BiowasmService(['tn93/1.0.11']);
    await service.init();
    this.tn93Instance = service;
    this.tn93Initialized = true;
    return this.tn93Instance;
  }

  public async preloadAll(): Promise<void> {
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = this.executePreload();
    return this.loadingPromise;
  }

  private async executePreload(): Promise<void> {
    console.log('[PreloaderService] 🚀 Starting parallel preload of FastTree and TN93...');
    const startTime = performance.now();

    try {
      const results = await Promise.allSettled([
        this.preloadFastTree(),
        this.preloadTN93(),
      ]);

      const duration = (performance.now() - startTime).toFixed(1);
      const fasttreeSuccess = results[0].status === 'fulfilled';
      const tn93Success = results[1].status === 'fulfilled';

      if (fasttreeSuccess && tn93Success) {
        console.log(`[PreloaderService] ✅ FastTree and TN93 preloaded successfully in ${duration}ms`);
      } else {
        console.warn(`[PreloaderService] ⚠️ Partial preload in ${duration}ms (FastTree: ${fasttreeSuccess}, TN93: ${tn93Success})`);
      }
    } catch (error) {
      console.error('[PreloaderService] ❌ Preload error:', error);
    }
  }

  private async preloadFastTree(): Promise<void> {
    if (this.fasttreeInstance && this.fasttreeInitialized) {
      return;
    }
    try {
      this.fasttreeInstance = new BiowasmService(['fasttree/2.1.11']);
      await this.fasttreeInstance.init();
      this.fasttreeInitialized = true;
    } catch (error) {
      console.error('[PreloaderService] Failed to preload FastTree:', error);
      this.fasttreeInstance = null;
      this.fasttreeInitialized = false;
      throw error;
    }
  }

  private async preloadTN93(): Promise<void> {
    if (this.tn93Instance && this.tn93Initialized) {
      return;
    }
    try {
      this.tn93Instance = new BiowasmService(['tn93/1.0.11']);
      await this.tn93Instance.init();
      this.tn93Initialized = true;
    } catch (error) {
      console.error('[PreloaderService] Failed to preload TN93:', error);
      this.tn93Instance = null;
      this.tn93Initialized = false;
      throw error;
    }
  }
}

export const preloaderService = new PreloaderService();
