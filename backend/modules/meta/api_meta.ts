import { ApiModule } from "../../api_module";
import { ApiInterfaceMetaOut } from "../../../api_common/api_meta"
import { ApiInterfaceEmptyIn, ApiModuleResponse } from "../../../api_common/backend_call";
import { getDeploymentType } from '../../index';
import { DeploymentType } from "../../deployment";
import { UserPermission } from "../../../api_common/permission_types";

export class ApiModuleMeta extends ApiModule {

    modname(): string {
        return "meta";
    }

    async initialize() { }

    loginRequired(): boolean {
        return false;
    }

    permissionRequired(): UserPermission | undefined {
        return undefined;
    }

    registerEndpoints(): void {
        this.get<ApiInterfaceEmptyIn, ApiInterfaceMetaOut>("meta", async (req, user) => {
            let result: ApiModuleResponse<ApiInterfaceMetaOut>;
            result = { statusCode: 200, responseObject: { isDevelopmentDeployment: getDeploymentType() == DeploymentType.DEVELOPMENT }, error: undefined };
            return result;
        });
    }
}