interface ColorRGB {
    r: number;
    g: number;
    b: number;
}
interface ColorRGBA {
    r: number;
    g: number;
    b: number;
    a: number;
}
type Texture = string;
type ParameterType = number | Texture | boolean | ColorRGB | ColorRGBA;
type ParameterTypeString = "float" | "boolean" | "rgb" | "rgba" | "texture";
interface ValidRangeFloat {
    min: number;
    max: number;
}
interface ParameterInfo {
    type: ParameterTypeString;
    name: string;
    defaultValue: ParameterType;
    templates?: string[];
    validRange?: ValidRangeFloat;
}
declare enum ExportType {
    LOOK = "LOOK",
    PRESET = "PRESET",
    PARAMETER_PRESET = "PARAMETER_PRESET"
}
interface ChangedParameterValue {
    newValue: ParameterType;
    newId: string | null;
}
type ChangedParameters = {
    [paramName: string]: ChangedParameterValue;
};
interface ImportInfo {
    type: ExportType;
    changedParameters: ChangedParameters;
}
export { ColorRGB, ColorRGBA, Texture, ParameterType, ParameterTypeString, ParameterInfo, ValidRangeFloat, ExportType, ChangedParameters, ChangedParameterValue, ImportInfo };
