import { ColorRGB, ColorRGBA, ParameterType, ParameterTypeString, Texture, ValidRangeFloat } from "../../parameterTypes";
import { ParameterNamespace } from "./parameterNamespace";
declare abstract class ParameterBase<T extends ParameterType> {
    private static lastUniqueParameterId;
    readonly name: string;
    readonly fqName: string;
    readonly type: ParameterTypeString;
    private value;
    readonly defaultValue: T;
    readonly defaultId: string | null;
    private id;
    readonly spec: any;
    readonly uniqueParameterId: number;
    readonly prepackaged: {
        [key: string]: T | string;
    } | null;
    private _isDisabled;
    private _isParentDisabled;
    private _isEffectivelyDisabled;
    private oldValue;
    private oldId;
    readonly namespace: ParameterNamespace;
    private onValueChangedCb;
    protected constructor(fqName: string, name: string, type: ParameterTypeString, defaultValue: T, namespace: ParameterNamespace, spec: any, defaultId: string | null, prepackaged: {
        [key: string]: T | string;
    } | null);
    setValue(value: T, id: string | null): void;
    getValue(): T;
    getId(): string | null;
    getOldValue(): T;
    getOldId(): string | null;
    reset(): void;
    setDisabled(isDisabled: boolean): boolean;
    updateOnDisableParent(): boolean;
    private updateOnDisableInternal;
    get isDisabled(): boolean;
    get isEffectivelyDisabled(): boolean;
    addOnValueChangedCallback(callback: (newValue: T) => void): void;
    removeOnValueChangedCallback(callback: (newValue: T) => void): void;
    abstract checkType(obj: any): boolean;
}
declare class ParameterFloat extends ParameterBase<number> {
    readonly validRange: ValidRangeFloat;
    constructor(fqName: string, name: string, defaultValue: number, validRange: ValidRangeFloat, namespace: ParameterNamespace, spec: any, defaultId: string | null, prepackaged: {
        [key: string]: number | string;
    } | null);
    setValue(value: number, id: string | null): void;
    checkType(obj: any): boolean;
}
declare class ParameterTexture extends ParameterBase<Texture> {
    constructor(fqName: string, name: string, defaultValue: Texture, namespace: ParameterNamespace, spec: any, defaultId: string | null, prepackaged: {
        [key: string]: string | Texture;
    } | null);
    checkType(obj: any): boolean;
}
declare class ParameterRGB extends ParameterBase<ColorRGB> {
    constructor(fqName: string, name: string, defaultValue: ColorRGB, namespace: ParameterNamespace, spec: any, defaultId: string | null, prepackaged: {
        [p: string]: string | ColorRGB;
    } | null);
    setValue(value: ColorRGB, id: string | null): void;
    checkType(obj: any): boolean;
}
declare class ParameterRGBA extends ParameterBase<ColorRGBA> {
    constructor(fqName: string, name: string, defaultValue: ColorRGBA, namespace: ParameterNamespace, spec: any, defaultId: string | null, prepackaged: {
        [p: string]: string | ColorRGBA;
    } | null);
    setValue(value: ColorRGBA, id: string | null): void;
    checkType(obj: any): boolean;
}
declare class ParameterBoolean extends ParameterBase<boolean> {
    constructor(fqName: string, name: string, defaultValue: boolean, namespace: ParameterNamespace, spec: any);
    setValue(value: boolean): void;
    checkType(obj: any): boolean;
}
type PluginParameter = ParameterFloat | ParameterBoolean | ParameterTexture | ParameterRGB | ParameterRGBA;
declare function isColorRGB(obj: any): boolean;
declare function isColorRGBA(obj: any): boolean;
declare function isTexture(obj: any): boolean;
declare function isNumber(obj: any): boolean;
declare function isBoolean(obj: any): boolean;
interface Vec4 {
    x: number;
    y: number;
    z: number;
    w: number;
}
interface Vec3 {
    x: number;
    y: number;
    z: number;
}
declare function isVec4(obj: any): boolean;
declare function isVec3(obj: any): boolean;
type ChangeParameterType = ParameterType | Vec3 | Vec4;
declare function colorRGBAtoVec4(color: ColorRGBA): Vec4;
declare function colorRGBtoVec3(color: ColorRGB): Vec3;
export { ParameterBoolean, ParameterRGB, ParameterRGBA, ParameterTexture, ParameterFloat, ValidRangeFloat, PluginParameter, isColorRGBA, isColorRGB, isBoolean, isTexture, isNumber, Vec4, Vec3, isVec3, isVec4, ChangeParameterType, colorRGBAtoVec4, colorRGBtoVec3 };
