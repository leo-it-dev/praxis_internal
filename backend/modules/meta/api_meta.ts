import { ApiInterfaceMetaOut } from "../../../api_common/api_meta";
import { ApiInterfaceEmptyIn, ApiModuleResponse } from "../../../api_common/backend_call";
import { UserPermission } from "../../../api_common/permission_types";
import { ApiModuleUnauthorized } from "../../api_module";
import { DeploymentType } from "../../deployment";
import { getDeploymentType } from '../../index';

export class ApiModuleMeta extends ApiModuleUnauthorized {

    modname(): string {
        return "meta";
    }

    async initialize() { }

    permissionRequired(): UserPermission | undefined {
        return undefined;
    }

    registerEndpoints(): void {
        this.get<ApiInterfaceEmptyIn, ApiInterfaceMetaOut>("meta", async (req) => {
            let result: ApiModuleResponse<ApiInterfaceMetaOut>;
            result = { statusCode: 200, responseObject: { isDevelopmentDeployment: getDeploymentType() == DeploymentType.DEVELOPMENT }, error: undefined };
            return result;
        });
    }
}