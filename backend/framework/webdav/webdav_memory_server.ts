const xmlparser = require('express-xml-bodyparser');
import express = require('express');
import https = require('node:https');
import * as config from 'config';
import { getLogger } from '../../logger';
import * as ssl from '../../ssl/ssl';
import { WebdavSResource } from './elements/storage_elements';
import { WebdavResourceType } from './elements/xml/webdav_properties';
import { WebdavHref, WebdavMultiStatus, WebdavProperty, WebdavPropertyValue, WebdavPropfind, WebdavPropfindDepth, WebdavPropfindRequestType, WebdavPropStat, WebdavResponse, WebdavResponseDescription, WebdavStatus, XmlNamespace } from './elements/xml/webdav_xmlelements';
import { WebdavMemoryStorage } from './webdav_memory_storage';

let logger = getLogger('webdav-memory-server');

export interface IUserResourceMapping {
    mapUsernameToResource(username: string): WebdavSResource | undefined;
}

export class WebDAVMemoryServer {

    private app?: express.Express;
    private memoryStorage: WebdavMemoryStorage;

    constructor(memoryStore: WebdavMemoryStorage, private userMapping: IUserResourceMapping) {
        this.memoryStorage = memoryStore;

        let WEBDAV_SERVER_PORT = config.get("carddav-mirror.PORT");

        this.app = express();

        this.app.use(xmlparser({
            normalize: false,
            normalizeTags: false
        }));
        this.app.use(this.redirectWellKnown.bind(this));
        this.app.use(this.authenticateWebDAVRequest.bind(this));
        this.app.use(this.handleWebDAVRequest.bind(this));
        https.createServer(ssl.SSL_OPTIONS, this.app).listen(WEBDAV_SERVER_PORT);
        logger.info("WebDAV server started up!", {port: WEBDAV_SERVER_PORT});
    }
    
    redirectWellKnown(req: express.Request, res: express.Response, next: () => void) {
        if (req.path == "/.well-known/carddav") {
            res
                .status(301)
                .setHeader("Location", "/carddav")
                .send();
        } else {
            next();
        }
    }

    authenticateWebDAVRequest(req: express.Request, res: express.Response, next: () => void) {
        if (!req.headers.authorization) {
            res.status(400).send();
            return;
        }
        if (!req.headers.authorization.startsWith("Basic ")) {
            res.status(401).send();
            return;
        }
        let basicAuth = atob(req.headers.authorization.split("Basic ")[1]);
        let username = basicAuth.split(":")[0];
        let password = basicAuth.split(":")[1];

        if (username != config.get("carddav-mirror.USERNAME") || password != config.get("carddav-mirror.PASSWORD")) {
            res.status(401).send();
            return;
        }

        next();
    }

    resolveUsernameToResource(username: string) {
        return this.userMapping.mapUsernameToResource(username);
    }

    handleWebDAVRequest(req: express.Request, res: express.Response, next: () => void) {
        let headers = new Map<string, string>(
            Object.entries(req.headers).map(header => [header[0].toLowerCase(), header[1] as string])
        );
        let resourceUri = req.path;
        let username = atob(headers.get("authorization")!.split(" ")[1]).split(":")[0];

        let userResource = this.resolveUsernameToResource(username);

        if (!userResource) { // no resource is associated with the logged in user
            res.status(404).send();
            return;
        }
        
        switch(req.method.toUpperCase()) {
            case "PROPFIND":
                this.handlePropfindRequest(req, res, headers, userResource);
                logger.debug("Processing WebDAV request!", {source: req.ip, method: req.method});
                break;
            default:
                logger.debug("Unknown WebDAV request!", {source: req.ip, method: req.method});
                res.status(400).send();
                break;
        }

        console.log("Request: ", req.body);

        next();
    }

    generateLiveProperties(userResource: WebdavSResource, parentNS: XmlNamespace, resource: WebdavSResource): WebdavPropertyValue[] {
        return [
            new WebdavPropertyValue(parentNS, "current-user-principal", new WebdavHref(userResource.resourceUri)),
            new WebdavPropertyValue(parentNS, "resourcetype", new WebdavResourceType(resource.type)),
            new WebdavPropertyValue(parentNS, "principal-URL", new WebdavHref(resource.resourceUri)),
        ]
    }

    propfindPropertyRequested(propname: string, propfind: WebdavPropfind): boolean {
        if (propfind.type == WebdavPropfindRequestType.ALLPROP) {
            return true;
        }
        if (propfind.type == WebdavPropfindRequestType.PROPNAME) {
            return true;
        }
        if (propfind.type == WebdavPropfindRequestType.PROP) {
            return propfind.prop!.propertyNames.find(prop => prop.includes(propname)) != undefined;
        }
        return false;
    }

    propfindPropertiesNotFound(propfind: WebdavPropfind, propertiesFound: WebdavPropertyValue[]): string[] {
        if (propfind.type == WebdavPropfindRequestType.ALLPROP) {
            return [];
        }
        if (propfind.type == WebdavPropfindRequestType.PROPNAME) {
            return [];
        }
        if (propfind.type == WebdavPropfindRequestType.PROP) {
            return propfind.prop!.propertyNames.filter(propRequested => !propertiesFound.find(propFound => propFound.propertyName == propRequested));
        }
        return [];
    }

    handlePropfindRequest(req: express.Request, res: express.Response, headers: Map<string, string>, userResource: WebdavSResource) {
        let propfind = new WebdavPropfind().deserialize(req.body, new XmlNamespace("", ""));
        if (propfind.ns.nsHref != "DAV:") {
            res.status(400).send();
            return;
        }

        let propfindDepth = WebdavPropfindDepth.DINFINITY;
        let depth = headers.get("depth");
        if (depth == "0") propfindDepth = WebdavPropfindDepth.D0;
        if (depth == "1") propfindDepth = WebdavPropfindDepth.D1;

        let resource = this.memoryStorage.getResource(req.path);

        if (!resource) {
            res.status(404).send();
            return;
        }

        let rootNamespace = new XmlNamespace("D:", "DAV:");
        let liveProperties = this.generateLiveProperties(userResource, rootNamespace, resource).filter(
            prop => this.propfindPropertyRequested(prop.propertyName, propfind)
        );
        let deadProperties: WebdavPropertyValue[] = [];

        let allProperties = [...liveProperties, ...deadProperties];
        let propfindPropsNotFound = this.propfindPropertiesNotFound(propfind, allProperties);

        //TODO: A login user is a principal -> principal-URI, current-user-principal.
        // If the resource is not a principal, don't return those two properties.

        let propStats: WebdavPropStat[] = [];
        
        let successfullPropStat = new WebdavPropStat(
            new WebdavProperty(propfind.ns, liveProperties),
            new WebdavStatus("HTTP/1.1 200 OK"),
            undefined
        );
        propStats.push(successfullPropStat);
        
        if (propfindPropsNotFound.length > 0) {
            let notFoundPropStat = new WebdavPropStat(
                new WebdavProperty(propfind.ns, propfindPropsNotFound.map(prop => new WebdavPropertyValue(propfind.ns, prop, undefined))),
                new WebdavStatus("HTTP/1.1 404 Not Found"),
                new WebdavResponseDescription("The requested properties were not found on the server.")
            );
            propStats.push(notFoundPropStat);
        }

        let response = new WebdavResponse(
            [new WebdavHref(req.path)],
            undefined, // error
            undefined, // response description
            undefined, // location
            propfind.ns,
            undefined, // webdav status
            propStats
        );
        
        // handle live properties
        let multistatusResponse = new WebdavMultiStatus(
            new XmlNamespace("D:", "DAV:"),
            [
                response
            ],
            undefined // response description
        )

        let bodySerialized = multistatusResponse.serialize(new XmlNamespace("", ""));

        console.log(propfind);
        console.log(multistatusResponse)
        console.log(bodySerialized);
        debugger
    }
}