import https = require('node:https');
import express = require('express');
import * as config from 'config';
import * as fs from 'fs';
import * as path from 'path';
import * as kerberos from './framework/kerberos-handler';
import * as ssl from './ssl/ssl';

/**
 * Endpoint modules
 */
import { ApiModule } from './api_module';
import { DeploymentType } from './deployment';
import { AdfsOidc } from './framework/adfs_oidc_instance';
import * as ors from './framework/openrouteservice';
import { RepeatedTaskScheduler } from './framework/scheduled_events';
import { getLogger } from './logger';
import { ApiModuleAuth } from './modules/auth/api_auth';
import { ApiModuleCustomerLdapMirror } from './modules/customer_ldap_mirror/api_customer_ldap_mirror';
import { ApiModuleLdapQuery } from './modules/ldapquery/api_ldapquery';
import { ApiModuleMeta } from './modules/meta/api_meta';
import { ApiModuleNews } from './modules/news/api_news';
import { ApiModuleQs } from './modules/qs/api_qs';
import { ApiModuleTravelExpenses } from './modules/travel-expenses/api_travel-expenses';

let apiModulesInstances: ApiModule[] = [];

let deploymentType: DeploymentType = DeploymentType.DEVELOPMENT;

let moduleLogger = getLogger('index');

let repeatedTaskScheduler = new RepeatedTaskScheduler();

function initializeDevelopmentBuildEnvironment(projectRoot: string) {
    moduleLogger.info("--- Preparing development environment ---");
    let runtimeRoot = path.join(projectRoot, 'js', 'backend');

    let copyPaths = [
        {
            src: path.join(projectRoot, 'ssl', 'certs'),
            dest: path.join(runtimeRoot, 'ssl', 'certs')
        },
        {
            src: path.join(projectRoot, 'framework', 'databases'),
            dest: path.join(runtimeRoot, 'framework', 'databases')
        },
        {
            src: path.join(projectRoot, 'framework', 'auth'),
            dest: path.join(runtimeRoot, 'framework', 'auth')
        }
    ]

    for (let copyPath of copyPaths) {
        if (!fs.existsSync(copyPath.dest)) {
            moduleLogger.info("    - Copying path ", { src: copyPath.src, dst: copyPath.dest });
            fs.cpSync(copyPath.src, copyPath.dest, { recursive: true });
        } else {
            moduleLogger.info("    - Skipping path. - already exists - ", { src: copyPath.src, dst: copyPath.dest });
        }
    }
    moduleLogger.info("--- Preparing development environment finished ---");
}

async function runSecureRedirectServer() {
    let redirectionLogger = getLogger('https-redirection-server');

    redirectionLogger.info("Starting up secure redirection server on port 80...");
    const app = express();
    // redirect every single incoming request to https
    app.use(function (req, res) {
        redirectionLogger.debug("Redirected request to " + req.url + " from HTTP to HTTPS!");
        res.redirect('https://' + config.get('generic.SERVE_DOMAIN') + req.originalUrl);
    });
    app.listen(80);
    redirectionLogger.info("Secure redirect server is running on port 80!");
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
        moduleLogger.info("File structure indicates deployment mode", { mode: "DEVELOPMENT" });
        initializeDevelopmentBuildEnvironment(projectRoot);
    } else if (fs.existsSync(filePathFrontendDepl)) {
        deploymentType = DeploymentType.PRODUCTION;
        moduleLogger.info("File structure indicates deployment mode", { mode: "PRODUCTION" });
    } else {
        moduleLogger.error("File structure seems odd. Can't find frontend, won't start!");
        return;
    }

    moduleLogger.debug("Env: ", { env: process.env });
    moduleLogger.info("Loading configuration file: ", { configFileName: process.env.NODE_ENV });

    const filePathFrontend = deploymentType == DeploymentType.PRODUCTION ? filePathFrontendDepl : filePathFrontendDev;
    const app = express();

    moduleLogger.info("started server");
    const apiModules = [
        ApiModuleMeta,
        ApiModuleAuth,
        ApiModuleQs,
        ApiModuleLdapQuery,
        ApiModuleNews,
        ApiModuleTravelExpenses,
        ApiModuleCustomerLdapMirror
    ];

    ssl.initSSL();
    repeatedTaskScheduler.schedulerInit();
    ors.init();
    kerberos.initializeKerberos();

    // Initialize framework classes needed by modules below ------
    await AdfsOidc.initialize();

    // Now initialize all intranet modules -------
    let moduleLoaderLogger = moduleLogger.child({ service: 'module-loader' });
    moduleLoaderLogger.info("Starting module loader ---");

    for (let apiModuleClass of apiModules) {
        let apiModule = new apiModuleClass(app);
        moduleLoaderLogger.info("Loading Api Backend Module on basepath: ", { module: apiModuleClass.name, basepath: apiModule.basepath() });
        await apiModule.initializeModuleInternal();
        await apiModule.initialize();
        apiModule.registerEndpoints();
        apiModulesInstances.push(apiModule);
    }
    moduleLoaderLogger.info("Finished module loader ---");

    app.use(express.static(path.join(__dirname, filePathFrontend)));

    app.use((req, res, next) => {
        if (req.url.includes("ngsw.json") || req.url.includes("worker-basic.min.js")) {
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
            res.setHeader("Pragma", "no-cache");
            res.setHeader("Expires", "0");
        }
        next();
    });

    // /{*splat}
    // for default requests (to /) serve index.html
    app.get(/^(?!\/module).*/, (req: express.Request, res: express.Response) => {
        res.sendFile(path.join(__dirname, path.join(filePathFrontend, 'index.html')));
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

export function getRepeatedScheduler(): RepeatedTaskScheduler {
    return repeatedTaskScheduler;
}