import { Router } from "@angular/router";
import { JwtHelperService } from "../jwt-helper.service";
import { BackendService } from "../../api/backend.service";
import { Injectable } from "@angular/core";
import { ErrorlistService } from "../../timed-popups/popuplist/errorlist.service";

@Injectable()
export abstract class SessionProviderPlugin {
    constructor(protected jwtHelperService: JwtHelperService,
        protected errorlistService: ErrorlistService,
        protected router: Router,
        protected backend: BackendService
    ) { }

    abstract authorizeSession(): void;
    abstract exchangeCodeForToken(code: string, state: string): Promise<void>;
    abstract unauthorizeSession(reason: string): Promise<void>;
    abstract getAccessToken(): Promise<string>;
}