import bodyParser = require("body-parser");
import { Express } from "express";
import { AdfsOidc } from "./framework/adfs_oidc_instance";
import { ApiModuleResponse, ApiModuleBody, ApiModuleInterfaceF2B, ApiModuleInterfaceB2F, RequestTyped } from "../api_common/backend_call"
import { Logger } from "winston";
import { getLogger } from "./logger";

export abstract class ApiModule {
    private _app: Express;
    private _logger: Logger;

    constructor(app: Express) {
        this._app = app;
    }

    abstract modname(): string;
    abstract registerEndpoints(): void;
    abstract initialize(): any;
    abstract loginRequired(): boolean;
    
    basepath(): string {
        return "/module/" + this.modname();
    }

    logger(): Logger {
        if (this._logger === undefined) {
            this._logger = getLogger(this.modname());
        }
        return this._logger;
    }

    postJson<REQ extends ApiModuleInterfaceF2B, RES extends ApiModuleInterfaceB2F>(route: string, handler: (req: RequestTyped<REQ>, user) => Promise<ApiModuleResponse<RES>>) {
        this._app.post(this.basepath() + "/" + route, bodyParser.json(), async (req, res) => {
            let validationResult: string|JsonObject = undefined;
            if (this.loginRequired() && typeof(validationResult = await AdfsOidc.validateTokenInRequest(req)) == "string") {
                let response = {
                    error: "unauthorized: " + validationResult
                };
                this.logger().error("User tried to access backend resource with invalid access token! There may be a problem with the client app or a foreign program tries to access our backend!", {path: req.path, ip: req.ip});
                res.status(401).json(response);
            } else {
                let moduleResponse = await handler(new RequestTyped<REQ>(req), validationResult);
                let transformedResponse: ApiModuleBody = {
                    content: moduleResponse.responseObject,
                    error: moduleResponse.error
                };
                res.status(moduleResponse.statusCode).json(transformedResponse);
            }
        });
    }

    get<REQ extends ApiModuleInterfaceF2B, RES extends ApiModuleInterfaceB2F>(route: string, handler: (req: RequestTyped<REQ>, user) => Promise<ApiModuleResponse<RES>>) {
        this._app.get(this.basepath() + "/" + route, async (req, res) => {
            let validationResult: string|JsonObject = undefined;
            if (this.loginRequired() && typeof(validationResult = await AdfsOidc.validateTokenInRequest(req)) == "string") {
                let response = {
                    error: "unauthorized: " + validationResult
                };
                this.logger().error("User tried to access backend resource with invalid access token! There may be a problem with the client app or a foreign program tries to access our backend!", {path: req.path, ip: req.ip});
                res.status(401).json(response);
            } else {
                let moduleResponse = await handler(new RequestTyped<REQ>(req), validationResult);
                let transformedResponse: ApiModuleBody = {
                    content: moduleResponse.responseObject,
                    error: moduleResponse.error
                };
                res.status(moduleResponse.statusCode).json(transformedResponse);
            }
        });
    }
}