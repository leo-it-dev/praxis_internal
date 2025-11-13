import { UserPermissionList } from "../api_common/permission_types";

export type User = {
    userTokenData: JsonObject;
    userPermissions: UserPermissionList;
}