import { options } from '../options';
import { resolveOicdConfiguration, updateJwksCertificates } from '../utilities/jwt_helper';
import { b64UrlRegexChar, base64urlDecode } from '../utilities/utilities';
import jwt = require('jsonwebtoken');
import { Mutex } from 'async-mutex';

export class OidcInstance {

    private configuration: OidcConfigurationResolved;
    private jwksUpdateInterval: NodeJS.Timeout;
    private jwksUpdateMutex: Mutex;

    private constructor(configResolved: OidcConfigurationResolved) {
        this.configuration = configResolved;
        this.jwksUpdateMutex = new Mutex();
        this.jwksUpdateInterval = setInterval(this.updateJwksKeyStore.bind(this), options.JWKS_UPDATE_INTERVAL_MINUTES * 60 * 1000);
        console.log("OIDC registered automatic jwks key store renew interval for host " + this.configuration.hostname + ": " + options.JWKS_UPDATE_INTERVAL_MINUTES + " Minutes");
        this.updateJwksKeyStore();
    }

    static construct(config: OidcConfigurationRaw): Promise<OidcInstance> {
        return new Promise<OidcInstance>((res, rej) => {
            resolveOicdConfiguration(config).then(configRes => {
                res(new OidcInstance(configRes));
            }).catch(err => {
                rej();
            });
        });
    }

    updateJwksKeyStore() {
        console.log("Scheduled jwks update for oidc instance " + this.configuration.hostname);
        const inst = this;
        this.jwksUpdateMutex.runExclusive(() => {
            console.log("Mutex released. Starting jwks update for oidc instance " + inst.configuration.hostname);
            updateJwksCertificates(inst.configuration).then(() => {
                console.log("Successfully updated jwks certificates in store: " + inst.configuration.hostname + ". Received " + inst.configuration.jwksCertificates.length + " items!");
            }).catch(err => {
                console.error("Error updating jwks certificate store! " + err);
            });
        }).then(() => {
            console.log("Finished jwks update for oidc instance " + inst.configuration.hostname);
        }).catch((err) => {
            console.error("Error updating jwks store: " + err);
        });
    }

    getConfiguration(): OidcConfigurationResolved {
        return this.configuration;
    }

    getJwksCertificate(x5t: string): JwksCertificate {
        return this.configuration.jwksCertificates.find(c => c.x5t == x5t);
    }

    validateJWTtoken(jwtToken: string): Promise<JsonObject> {
        var inst = this;
        return new Promise<JsonObject>(async (res, rej) => {
            if (!jwtToken || !jwtToken.match(b64UrlRegexChar + "+\\." + b64UrlRegexChar + "+\\." + b64UrlRegexChar)) {
                rej("Token is not in JWT format!");
                return;
            }
            // TODO: Check if valid base64 decodable!! Otherwise crash may occur
            const [headerJson, payloadJson, signature] = [
                JSON.parse(base64urlDecode(jwtToken.split(".")[0])),
                JSON.parse(base64urlDecode(jwtToken.split(".")[1])),
                base64urlDecode(jwtToken.split(".")[2]),
            ];
            const alg = headerJson['alg'];
            const iss = payloadJson['iss'];
            const x5t = headerJson['x5t'];
        
            if (alg != 'RS256') { // Expected signature algorithm
                rej("Unsupported algorithm used!");
                return;
            }
        
            const issUrl = new URL(iss);
            if (issUrl.host != inst.configuration.hostname || !issUrl.pathname.startsWith(inst.configuration.oidcRoot)) { // Expected issuer
                rej("Token issuer does not match expected issuer: " + issUrl);
                return;
            }
        
            // Ensure no update operation on the certificate list is made while we check the token against the certificates.
            await inst.jwksUpdateMutex.waitForUnlock();

            const certificate = inst.getJwksCertificate(x5t);
            if (certificate == undefined) {
                rej("Unknown certificate used for hashing token!");
                return;
            }

            jwt.verify(jwtToken, certificate.publicKey, (err, user) => {
                if (err == null) {
                    // Success
                    console.log("Successfully validated JWT token!");
                    res(user);
                } else {
                    // Error
                    console.log("Error validating JWT token: ", err);
                    rej("Error validating JWT token signature: " + err);
                }
            });
        });
    }    
}