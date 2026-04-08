import { UserPermission, UserPermissionList } from "../api_common/permission_types";
const config = require('config');

export type User = {
    userTokenData: JsonObject;
    userPermissions: UserPermissionList;
}

export function expandSecurityGroupNameToFullDN(securityGroupName: string) {
    const SecurityGroupBaseDN = config.get("generic.LDAP_USER_DN_BASE");
    return 'CN=' + securityGroupName + "," + SecurityGroupBaseDN;
}

export const UserPermissionToSecurityGroup = {
    [UserPermission.QS_REPORT]: expandSecurityGroupNameToFullDN(config.get("userPermissions.SECURITY_GROUP_ALLOW_QS_REPORTS")),
    [UserPermission.NEWS]: expandSecurityGroupNameToFullDN(config.get("userPermissions.SECURITY_GROUP_ALLOW_NEWS")),
    [UserPermission.POST_NEWS]: expandSecurityGroupNameToFullDN(config.get("userPermissions.SECURITY_GROUP_ALLOW_POST_NEWS")),
    [UserPermission.TRAVEL_EXPENSES_MAP]: expandSecurityGroupNameToFullDN(config.get("userPermissions.SECURITY_GROUP_ALLOW_TRAVEL_EXPENSES_MAP")),
}
export const SecurityGroupToUserPermission = Object.fromEntries(Object.entries(UserPermissionToSecurityGroup).map(a => a.reverse()))

export function userPermissionsFromSecurityGroupNames(securityGroupNames: string[]): UserPermissionList {
    return userPermissionsFromSecurityGroupDNs(securityGroupNames.map(groupName => expandSecurityGroupNameToFullDN(groupName)));
}

export function userPermissionsFromSecurityGroupDNs(securityGroups: string[]): UserPermissionList {
    let permissions = [];
    for (let secGroup of securityGroups) {
        if (secGroup in SecurityGroupToUserPermission) {
            permissions.push(parseInt(SecurityGroupToUserPermission[secGroup]));
        }
    }
    return new UserPermissionList(permissions);
}

export function securityGroupsFromUserPermissions(userPermissions: UserPermissionList): string[] {
    let securityGroups = [];
    for (let userPermission of userPermissions.values()) {
        if (userPermission in UserPermissionToSecurityGroup) {
            securityGroups.push(UserPermissionToSecurityGroup[userPermission]);
        }
    }
    return securityGroups;
}