import { DeepARInterface } from "../../deeparInterface";
declare class EffectController {
    private deepAR;
    private readonly rootPath;
    private static readonly WATERMARK_EFFECT_PATH;
    private static readonly WATERMARK_IMAGE_PATH;
    private readonly effects;
    private requiredEffectsByParameters;
    private readonly requiredEffectsByDefault;
    private readonly loadAndUnloadEffectAtInitialize;
    private loadedEffectSlot;
    private isInitialized;
    private isLogoVisible;
    readonly watermarkEffectPath: string;
    readonly watermarkImagePath: string;
    constructor(deepAR: DeepARInterface, rootPath: string, effects: {
        [key: string]: string;
    }, requiredEffectsByDefault: string[], loadAndUnloadEffectAtInitialize: string[]);
    init(): Promise<void>;
    geIsInitialized(): boolean;
    shutdown(): void;
    setLogoVisible(isVisible: boolean): Promise<void>;
    isEffectLoaded(effect: string): boolean;
    setEffectEnabled(effect: string, enable: boolean): void;
    requireEffect(effect: string, id: number): Promise<void>;
    unrequireEffect(effect: string, id: number): void;
    private loadDefaultEffects;
    private unloadDefaultEffects;
    private unloadAllEffects;
    private loadAndUnloadEffects;
    loadEffect(effect: string): Promise<void>;
    unloadEffect(effect: string): void;
    private loadPluginEffect;
    private static checkDefaultEffects;
    private static generateSlotForEffect;
}
export { EffectController };
