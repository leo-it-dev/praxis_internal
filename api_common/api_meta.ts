import { ApiModuleInterfaceB2F, ApiModuleInterfaceF2B } from "./backend_call"

/* Api endpoint meta */

export interface ApiInterfaceMetaOut extends ApiModuleInterfaceB2F { isDevelopmentDeployment: boolean };
