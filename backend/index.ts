import https = require('node:https');
import express = require('express');
import * as path from 'path';
import * as ssl from './ssl/ssl'
import * as fs from 'fs';
import * as config from 'config';

/**
 * Endpoint modules
 */
import { ApiModuleQs } from './modules/qs/api_qs';
import { ApiModuleAuth } from './modules/auth/api_auth';
import { ApiModule } from './api_module';
import { AdfsOidc } from './framework/adfs_oidc_instance';
import { ApiModuleLdapQuery } from './modules/ldapquery/api_ldapquery';
import { DeploymentType } from './deployment';
import { ApiModuleMeta } from './modules/meta/api_meta';

let apiModulesInstances = [];

let deploymentType: DeploymentType = DeploymentType.DEVELOPMENT;

function initializeDevelopmentBuildEnvironment(projectRoot: string) {
    console.log("--- Preparing development environment ---");
    let runtimeRoot = path.join(projectRoot, 'js', 'backend');

    let copyPaths = [
        {
            src: path.join(projectRoot, 'ssl', 'certs'),
            dest: path.join(runtimeRoot, 'ssl', 'certs')
        }
    ]

    for (let copyPath of copyPaths) {
        console.log("    - Copying path ", copyPath.src, "to", copyPath.dest);
        fs.cpSync(copyPath.src, copyPath.dest, { recursive: true });
    }

    console.log("--- Preparing development environment finished ---");
}

async function runSecureRedirectServer() {
    console.log("Starting up secure redirection server on port 80...");
    const app = express();
    // redirect every single incoming request to https
    app.use(function(req, res) {
        console.log("Redirected request to " + req.url + " from HTTP to HTTPS!");
        res.redirect('https://' + config.get('generic.SERVE_DOMAIN') + req.originalUrl);
    });
    app.listen(80);
    console.log("Secure redirect server is running on port 80!");
}

async function startup() {
    // Change directory to project root (ts-files)
    const projectRoot = require('path').resolve('./');
    process.chdir(projectRoot);
    __dirname = projectRoot;

    // The file structure slightly differs between deployment and development run.
    // We can use this information to determine whether or not we are run in development or deploy environment.
    const filePathFrontendDev = '../frontend/intranet/dist/intranet/browser';
    const filePathFrontendDepl = '../frontend/intranet/browser';


    if (fs.existsSync(filePathFrontendDev)) {
        deploymentType = DeploymentType.DEVELOPMENT;
        console.log("File structure indicates development mode!");
        initializeDevelopmentBuildEnvironment(projectRoot);
    } else if (fs.existsSync(filePathFrontendDepl)) {
        deploymentType = DeploymentType.PRODUCTION;
        console.log("File structure indicates deployment mode!");
    } else {
        console.log("File structure seems odd. Can't find frontend, won't start!");
        return;
    }

    console.log("Env: ", process.env);
    console.log("Loading configuration file: ", process.env.NODE_ENV);

    const filePathFrontend = deploymentType == DeploymentType.PRODUCTION ? filePathFrontendDepl : filePathFrontendDev;
    const app = express();

    console.log("started server");
    const apiModules = [
        ApiModuleMeta,
        ApiModuleAuth,
        ApiModuleQs,
        ApiModuleLdapQuery
    ];

    ssl.initSSL();

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
            if (deploymentType == DeploymentType.PRODUCTION) {
                res.sendFile(filePathFrontendDepl);
            }
            if (deploymentType == DeploymentType.DEVELOPMENT) {
                res.sendFile(filePathFrontendDev);
            }
        }
    });

    runSecureRedirectServer();
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

export function getDeploymentType(): DeploymentType {
    return deploymentType;
}