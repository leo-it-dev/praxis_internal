import bodyParser = require("body-parser");
import { Express } from "express";
import { AdfsOidc } from "./framework/adfs_oidc_instance";

export interface ApiModuleResponse {
    statusCode: number,
    responseObject: object,
    error: string
}

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

    postJson(route: string, handler: (req, user) => Promise<ApiModuleResponse>) {
        this._app.post(this.basepath() + "/" + route, bodyParser.json(), async (req, res) => {
            let validationResult: string|JsonObject = undefined;
            if (this.loginRequired() && typeof(validationResult = await AdfsOidc.validateTokenInRequest(req)) == "string") {
                let response = {
                    error: "unauthorized" + validationResult
                };
                res.status(401).json(response);
            } else {
                let moduleResponse = await handler(req, validationResult);

                let transformedResponse = {
                    content: moduleResponse.responseObject,
                    error: moduleResponse.error
                };
                res.status(moduleResponse.statusCode).json(transformedResponse);
            }
        });
    }

    get(route: string, handler: (req, user) => Promise<ApiModuleResponse>) {
        this._app.get(this.basepath() + "/" + route, async (req, res) => {
            let validationResult: string|JsonObject = undefined;
            if (this.loginRequired() && typeof(validationResult = await AdfsOidc.validateTokenInRequest(req)) == "string") {
                let response = {
                    error: "unauthorized: " + validationResult
                };
                res.status(401).json(response);
            } else {
                let moduleResponse = await handler(req, validationResult);
                let transformedResponse = {
                    content: moduleResponse.responseObject,
                    error: moduleResponse.error
                };
                res.status(moduleResponse.statusCode).json(transformedResponse);
            }
        });
    }
}