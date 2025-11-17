export enum UserPermission {
    QS_REPORT
}

export class UserPermissionList {

    userPermissions: UserPermission[] = [];

    constructor(permissions: UserPermission[]) {
        this.userPermissions = permissions;
    }

    public userHasPermission(permission: UserPermission | undefined) {
        if (permission === undefined) {
            return true;
        }
        return this.userPermissions.includes(permission);
    }

    static grantAll() {
        return new UserPermissionList(Object.values(UserPermission).filter(v => typeof v === 'number'));
    }

    public serial(): string {
        return JSON.stringify(this.userPermissions);
    }

    public values(): UserPermission[] {
        return this.userPermissions;
    }

    static parseSerial(serial: string | null) {
        if (serial == null) {
            return new UserPermissionList([]);
        }
        
        let permissions = JSON.parse(serial) as Number[];
        let values = Object.values(UserPermission).filter(v => typeof v === 'number');
        return new UserPermissionList(values.filter(v => permissions.includes(v)));
    }
}