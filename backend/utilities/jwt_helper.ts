import jwt = require('jsonwebtoken');
import crypto = require('crypto');
import { getLogger } from '../logger';
const ssl = require('../ssl/ssl');

const logger = getLogger('jwt-helper');

export function parseJWTtoken(jwtString: string): {'header': string, 'content': string, 'hash': string} {
    let [header, content, hash] = jwtString.split(".");
    
    const headerParsed = JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
    const contentParsed = JSON.parse(Buffer.from(content, 'base64').toString('ascii'));
    
    return {'header': headerParsed, 'content': contentParsed, 'hash': hash};
}

export function resolveOidcConfiguration(endpoint: OidcConfigurationRaw): Promise<OidcConfigurationResolved> {
    return new Promise<OidcConfigurationResolved>(async (res, rej) => {
        try {
            /**
             * Extract OIDC configuration
             */
    
            let resp = await ssl.httpsRequest(endpoint.hostname, endpoint.configurationPath, 'GET', '', undefined, undefined);
            if (resp.statusCode != 200) {
                logger.error("Error reading OIDC configuration! ADFS returned invalid status code!", {hostname: endpoint.hostname, configPath: endpoint.configurationPath, statusCode: resp.statusCode});
                return null;
            }

            logger.info("Read OIDC configuration!");
            const body = JSON.parse(resp.data);
            /**
             * Maybe additional information is to be parsed out of this body
             * Add data extraction code here.
             */

            res({
                ...endpoint,
                jwksUrl: new URL(body['jwks_uri']),
                logoutUrl: new URL(body['end_session_endpoint']),
                tokenEndpointUrl: new URL(body['token_endpoint']),
                jwksCertificates: []
            });
        } catch(err) {
            logger.error("An error occurred while trying to resolve OIDC configuration!", {error: err});
            rej(err);
        }
    });
}

export function updateJwksCertificates(endpoint: OidcConfigurationResolved): Promise<void> {
    return new Promise<void>(async (res, rej) => {
        endpoint.jwksCertificates = [];

        try {
            /**
             * Extract certificates
             */
            if (endpoint.jwksUrl.hostname != endpoint.hostname) {
                logger.error("Invalid JWKS host announced by ADFS server!", {hostnameExpected: endpoint.hostname, hostnameReported: endpoint.jwksUrl.hostname});
                return false;
            }
            let resp = await ssl.httpsRequest(endpoint.hostname, endpoint.jwksUrl.pathname, 'GET', '', undefined, undefined);
            if (resp.statusCode != 200) {
                logger.error("Error reading JWT Keystore page! ADFS returned invalid status code!", {statusCode: resp.statusCode});
                return false;
            }
    
            let jwks = JSON.parse(resp.data);
    
            logger.info("Read JWT key store!", {jwks: jwks});
            for (const key of jwks['keys']) {
                if (key['alg'] == 'RS256') {
                    const x5t = key['x5t'];
                    const x5c = key['x5c'][0];
                    const cert = "-----BEGIN CERTIFICATE-----\n" + x5c + "\n-----END CERTIFICATE-----\n";
                    const publicKey = new crypto.X509Certificate(cert).publicKey;
                    endpoint.jwksCertificates.push({
                        x5t: x5t, 
                        cert: x5c, 
                        publicKey: publicKey.export({type: "spki", format: "pem"}).toString()});
                    logger.info("Loaded ADFS verfication certificate for x5t!", {x5t: x5t});
                }
            }
    
            res();
        } catch(e) {
            logger.error("Error occurred while trying to update jwks certificate store!", {error: e});
            rej(e);
        }
    });
}
