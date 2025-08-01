import bodyParser = require("body-parser");
import { Express } from "express";
import { AdfsOidc } from "./framework/adfs_oidc_instance";
import { ApiModuleResponse, ApiModuleBody, ApiModuleInterfaceF2B, ApiModuleInterfaceB2F, RequestTyped } from "../api_common/backend_call"

export abstract class ApiModule {
    private _app: Express;

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

    postJson<REQ extends ApiModuleInterfaceF2B, RES extends ApiModuleInterfaceB2F>(route: string, handler: (req: RequestTyped<REQ>, user) => Promise<ApiModuleResponse<RES>>) {
        this._app.post(this.basepath() + "/" + route, bodyParser.json(), async (req, res) => {
            let validationResult: string|JsonObject = undefined;
            if (this.loginRequired() && typeof(validationResult = await AdfsOidc.validateTokenInRequest(req)) == "string") {
                let response = {
                    error: "unauthorized: " + validationResult
                };
                console.error("User tried to access backend resource (" + req.path + ") with invalid access token: " + req.ip + ". There may be a problem with the client app or a foreign program tries to access our backend!");
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
                console.error("User tried to access backend resource (" + req.path + ") with invalid access token: " + req.ip + ". There may be a problem with the client app or a foreign program tries to access our backend!");
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