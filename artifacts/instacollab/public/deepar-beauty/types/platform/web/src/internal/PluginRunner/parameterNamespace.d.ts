import { PluginParameter } from "./parameters";
declare class ParameterNamespace {
    parameters: {
        [key: string]: PluginParameter;
    };
    namespaces: {
        [key: string]: ParameterNamespace;
    };
    disabler?: string;
    parentNamespace: ParameterNamespace | null;
    readonly fqName: string;
    readonly name: string;
    private _isDisabled;
    constructor(parentNamespace: ParameterNamespace | null, fqName: string, name: string);
    isEffectivelyDisabled(): boolean;
    get isDisabled(): boolean;
    setDisabled(isDisabled: boolean): void;
}
export { ParameterNamespace };
