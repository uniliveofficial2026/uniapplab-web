import { ParameterContext } from "./pluginRunner";
import { ChangeParameterType } from "./parameters";
import { DeepARInterface } from "../../deeparInterface";
declare function testPredicate(name: string, params: any, paramContext: ParameterContext): boolean;
declare function runTransform(name: string, params: any, paramContext: ParameterContext): ChangeParameterType;
declare function runChangeParameter(type: string, node: string, component: string, parameter: string, value: ChangeParameterType, paramContext: ParameterContext, deepAR: DeepARInterface): Promise<void>;
export { testPredicate, runTransform, runChangeParameter };
