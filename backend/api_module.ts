import bodyParser = require("body-parser");
import { Express } from "express";
import { Logger } from "winston";
import { ApiModuleBody, ApiModuleInterfaceB2F, ApiModuleInterfaceF2B, ApiModuleResponse, RequestTyped } from "../api_common/backend_call";
import { UserPermission } from "../api_common/permission_types";
import { AdfsOidc } from "./framework/adfs_oidc_instance";
import { getLogger } from "./logger";
import { User, userPermissionsFromSecurityGroupNames } from "./user";
import { SQLiteDB, SqlUpdate } from "./framework/sqlite_database";
import { BODY_SIZE_LIMIT } from "./index";

export abstract class ApiModule {
    protected _app: Express;
    protected _logger!: Logger;
    protected _sqlite!: SQLiteDB;

    constructor(app: Express) {
        this._app = app;
    }

    async initializeModuleInternal() {
        this._sqlite = new SQLiteDB();
        this._sqlite.sqliteInit(this.modname());

        const sqliteCreateTable = this.sqliteTableCreate();
        if (sqliteCreateTable != undefined) {
            for (let update of sqliteCreateTable) {
                await this._sqlite.sqlUpdate(update);
            }
        }

        this.moduleInitialized();
    }

    moduleInitialized() {};
    abstract modname(): string;
    abstract registerEndpoints(): void;
    abstract initialize(): any;
    
    basepath(): string {
        return "/module/" + this.modname();
    }

    protected logger(): Logger {
        if (this._logger === undefined) {
            this._logger = getLogger(this.modname());
        }
        return this._logger;
    }

    protected sqliteTableCreate(): SqlUpdate[] | undefined {
        return undefined;
    };

    protected sqlite() {
        return this._sqlite;
    }
}


export abstract class ApiModuleUnauthorized extends ApiModule {

    constructor(app: Express) {
        super(app);
    }

    protected postJson<REQ extends ApiModuleInterfaceF2B, RES extends ApiModuleInterfaceB2F>(route: string, handler: (req: RequestTyped<REQ>) => Promise<ApiModuleResponse<RES>>) {
        this._app.post(this.basepath() + "/" + route, bodyParser.json({limit: BODY_SIZE_LIMIT}), async (req, res) => {
            let moduleResponse = await handler(new RequestTyped<REQ>(req));

            let transformedResponse: ApiModuleBody = {
                content: moduleResponse.responseObject,
                error: moduleResponse.error
            };
            res.status(moduleResponse.statusCode).json(transformedResponse);
        });
    }

    protected get<REQ extends ApiModuleInterfaceF2B, RES extends ApiModuleInterfaceB2F>(route: string, handler: (req: RequestTyped<REQ>) => Promise<ApiModuleResponse<RES>>) {
        this._app.get(this.basepath() + "/" + route, async (req, res) => {
            let moduleResponse = await handler(new RequestTyped<REQ>(req));

            let transformedResponse: ApiModuleBody = {
                content: moduleResponse.responseObject,
                error: moduleResponse.error
            };
            res.status(moduleResponse.statusCode).json(transformedResponse);
        });
    }
}

export abstract class ApiModuleAuthorized extends ApiModule {

    constructor(app: Express) {
        super(app);
    }

    abstract permissionRequired(): UserPermission | undefined;

    protected postJson<REQ extends ApiModuleInterfaceF2B, RES extends ApiModuleInterfaceB2F>(route: string, handler: (req: RequestTyped<REQ>, user: User) => Promise<ApiModuleResponse<RES>>) {
        this._app.post(this.basepath() + "/" + route, bodyParser.json({limit: BODY_SIZE_LIMIT}), async (req, res) => {
            let validationResult: string|JsonObject|undefined = undefined;
            let moduleResponse: ApiModuleResponse<RES>;

            validationResult = await AdfsOidc.validateTokenInRequest(req);

            if (validationResult instanceof Object) {
                let userPermissions = userPermissionsFromSecurityGroupNames(validationResult["roles"] as string[]);

                if (!userPermissions.userHasPermission(this.permissionRequired())) {
                    moduleResponse = { error: "unauthorized: " + validationResult, statusCode: 401, responseObject: undefined }
                    this.logger().error("User tried to access backend resource without permission! There may be a problem with the client app or a foreign program tries to access our backend!", {path: req.path, ip: req.ip});
                } else {
                    moduleResponse = await handler(new RequestTyped<REQ>(req), {userTokenData: validationResult, userPermissions: userPermissions});
                }
            } else {
                moduleResponse = { error: "unauthorized: " + validationResult, statusCode: 401, responseObject: undefined }
                this.logger().error("User tried to access backend resource with invalid access token! There may be a problem with the client app or a foreign program tries to access our backend!", {path: req.path, ip: req.ip});
                return;
            }

            let transformedResponse: ApiModuleBody = {
                content: moduleResponse.responseObject,
                error: moduleResponse.error
            };
            res.status(moduleResponse.statusCode).json(transformedResponse);
        });
    }

    protected get<REQ extends ApiModuleInterfaceF2B, RES extends ApiModuleInterfaceB2F>(route: string, handler: (req: RequestTyped<REQ>, user: User) => Promise<ApiModuleResponse<RES>>) {
        this._app.get(this.basepath() + "/" + route, async (req, res) => {
            let validationResult: string|JsonObject|undefined = undefined;
            let moduleResponse: ApiModuleResponse<RES>;

            validationResult = await AdfsOidc.validateTokenInRequest(req);

            if (validationResult instanceof Object) {
                let userPermissions = userPermissionsFromSecurityGroupNames(validationResult["roles"] as string[]);

                if (!userPermissions.userHasPermission(this.permissionRequired())) {
                    moduleResponse = { error: "unauthorized: " + validationResult, statusCode: 401, responseObject: undefined }
                    this.logger().error("User tried to access backend resource without permission! There may be a problem with the client app or a foreign program tries to access our backend!", {path: req.path, ip: req.ip});
                } else {
                    moduleResponse = await handler(new RequestTyped<REQ>(req), {userTokenData: validationResult, userPermissions: userPermissions});
                }
            } else {
                moduleResponse = { error: "unauthorized: " + validationResult, statusCode: 401, responseObject: undefined }
                this.logger().error("User tried to access backend resource with invalid access token! There may be a problem with the client app or a foreign program tries to access our backend!", {path: req.path, ip: req.ip});
                return;
            }

            let transformedResponse: ApiModuleBody = {
                content: moduleResponse.responseObject,
                error: moduleResponse.error
            };
            res.status(moduleResponse.statusCode).json(transformedResponse);
        });
    }
}