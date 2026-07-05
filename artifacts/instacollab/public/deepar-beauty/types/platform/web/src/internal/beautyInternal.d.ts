import { PluginRunner } from "./PluginRunner/pluginRunner";
declare class BeautyInternal {
    protected pluginRunner: PluginRunner;
    constructor(pluginRunner: PluginRunner);
    init(): Promise<void>;
}
export { BeautyInternal };
