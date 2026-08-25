interface DeepARInterface {
    switchEffect(effect: string | ArrayBuffer, effectOptions?: {
        slot?: string;
        face?: number;
    }): Promise<void>;
    clearEffect(slot?: string): void;
    changeParameterBool(gameObject: string, component: string, parameter: string, value: boolean): void;
    changeParameterFloat(gameObject: string, component: string, parameter: string, value: number): void;
    changeParameterVector(gameObject: string, component: string, parameter: string, x: number, y: number, z: number, w: number): void;
    changeParameterTexture(gameObject: string, component: string, parameter: string, textureUrl: string): void;
}
export { DeepARInterface };
