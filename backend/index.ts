import https = require('node:https');
import express = require('express');
import path = require('path');
import * as ssl from './ssl/ssl'

/**
 * Endpoint modules
 */
import { ApiModuleQs } from './modules/qs/api_qs';
import { ApiModuleAuth } from './modules/auth/api_auth';
import { ApiModule } from './api_module';
import { AdfsOidc } from './framework/adfs_oidc_instance';
import { ApiModuleLdapQuery } from './modules/ldapquery/api_ldapquery';

let apiModulesInstances = [];

async function startup() {
    // Change directory to project root (ts-files)
    const projectRoot = require('path').resolve('./');
    process.chdir(projectRoot);
    __dirname = projectRoot;

    const app = express();

    console.log("started server");
    const apiModules = [
        ApiModuleAuth,
        ApiModuleQs,
        ApiModuleLdapQuery
    ];

    // Initialize framework classes needed by modules below ------
    await AdfsOidc.initialize();

    // Now initialize all intranet modules -------
    console.log("Starting module loader ---");
    for (let apiModuleClass of apiModules) {
        let apiModule = new apiModuleClass(app);
        console.log("- Loading Api Backend Module " + apiModuleClass.name + " on basepath -> " + apiModule.basepath());
        await apiModule.initialize();
        apiModule.registerEndpoints();
        apiModulesInstances.push(apiModule);
    }
    console.log("Finished module loader ---");

    app.use("/", express.static(path.join(__dirname, '../frontend/intranet/dist/intranet/browser')));
    app.use("/login", express.static(path.join(__dirname, '../frontend/intranet/dist/intranet/browser')));
    app.use("/qs", express.static(path.join(__dirname, '../frontend/intranet/dist/intranet/browser')));
    app.use("/datepicker", express.static(path.join(__dirname, '../frontend/intranet/dist/intranet/browser')));
    app.use("/Books", express.static(path.join(__dirname, '../frontend/intranet/public/Books')));
    app.use("/block", express.static(path.join(__dirname, '../frontend/intranet/dist/intranet/browser')));

    https.createServer(ssl.SSL_OPTIONS, app).listen(443);
}
startup();

export function getApiModule<T = ApiModule>(apiModuleClass: { new (...args: any[]): T }): T | undefined {
    for (let apiModule of apiModulesInstances) {
        if (apiModule == apiModuleClass) {
            return apiModule;
        }
    }
    return undefined;
}