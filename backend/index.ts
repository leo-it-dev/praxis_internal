import https = require('node:https');
import express = require('express');
import path = require('path');
import * as ssl from './ssl/ssl'
const fs = require('fs');

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

    // The file structure slightly differs between deployment and development run.
    // We can use this information to determine whether or not we are run in development or deploy environment.
    const filePathFrontendDev = '../frontend/intranet/dist/intranet/browser';
    const filePathFrontendDepl = '../frontend/intranet/browser';

    const devMode = fs.existsSync(filePathFrontendDev);
    const deployMode = fs.existsSync(filePathFrontendDepl);
    if (devMode) {
        console.log("File structure indicates development mode!");
    } else if (deployMode) {
        console.log("File structure indicates deployment mode!");
    } else {
        console.log("File structure seems odd. Can't find frontend, won't start!");
        return;
    }

    const filePathFrontend = devMode ? filePathFrontendDev : filePathFrontendDepl;
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

    app.use(express.static(path.join(__dirname, filePathFrontend)));

    app.use((req, res, next) => {
        if (req.url.includes("ngsw.json") || req.url.includes("worker-basic.min.js")) {
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
            res.setHeader("Pragma", "no-cache");
            res.setHeader("Expires", "0");
        }
        next();
    });

    app.get("*", (req, res) => {
        if (fs.existsSync('')) {
            if (deployMode) {
                res.sendFile(filePathFrontendDepl);
            }
            if (devMode) {
                res.sendFile(filePathFrontendDev);
            }
        }
    });

    https.createServer(ssl.SSL_OPTIONS, app).listen(443);
}
startup();

export function getApiModule<T = ApiModule>(apiModuleClass: { new(...args: any[]): T }): T | undefined {
    for (let apiModule of apiModulesInstances) {
        if (apiModule instanceof apiModuleClass) {
            return apiModule;
        }
    }
    return undefined;
}