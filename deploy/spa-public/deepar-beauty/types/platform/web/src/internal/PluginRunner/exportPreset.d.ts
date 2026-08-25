import { ExportType, ImportInfo } from "../../parameterTypes";
import { PluginParameter } from "./parameters";
import { PluginRunner } from "./pluginRunner";
declare function exportPreset(exportType: ExportType, parameters: PluginParameter[]): Promise<Blob>;
declare function importPreset(presetZip: string | Blob, pluginRunner: PluginRunner, parameters: {
    [key: string]: PluginParameter;
}, overrideImportType?: ExportType): Promise<ImportInfo>;
declare function exporterShutdown(): void;
export { exportPreset, importPreset, exporterShutdown };
