import { resolveOidcConfiguration, updateJwksCertificates } from '../utilities/jwt_helper';
import { b64UrlRegexChar, base64urlDecode } from '../utilities/utilities';
import jwt = require('jsonwebtoken');
import { Mutex } from 'async-mutex';
import { JwtError, JwtErrorType } from '../../api_common/api_auth';
import { getLogger } from '../logger';
import { ScheduledRepeatedEvent } from './scheduled_events';
import { getRepeatedScheduler } from '..';
const config = require('config');

export class OidcInstance {

    private configuration: OidcConfigurationResolved;
    private jwksUpdateInterval: ScheduledRepeatedEvent;
    private jwksUpdateMutex: Mutex;

    private logger = getLogger('oidc-instance');

    private constructor(configResolved: OidcConfigurationResolved) {
        this.configuration = configResolved;
        this.jwksUpdateMutex = new Mutex();
        this.jwksUpdateInterval = getRepeatedScheduler().scheduleRepeatedEvent(
            null,
            "jwks-keystore-update", 
            config.get('generic.JWKS_UPDATE_INTERVAL_MINUTES') * 60, 
            this.updateJwksKeyStore.bind(this), 
            true);
        this.logger.info("OIDC registered automatic jwks key store renew interval.", {host: this.configuration.hostname, updateIntervalMinutes: config.get('generic.JWKS_UPDATE_INTERVAL_MINUTES')});
    }

    static construct(config: OidcConfigurationRaw): Promise<OidcInstance> {
        return new Promise<OidcInstance>((res, rej) => {
            resolveOidcConfiguration(config).then(configRes => {
                res(new OidcInstance(configRes));
            }).catch(err => {
                rej();
            });
        });
    }

    updateJwksKeyStore(finished: () => void) {
        this.logger.info("Scheduled jwks update for oidc instance!", {host: this.configuration.hostname});
        const inst = this;
        this.jwksUpdateMutex.runExclusive(async () => {
            this.logger.info("Mutex released. Starting jwks update for oidc instance!", {host: inst.configuration.hostname});
            await updateJwksCertificates(inst.configuration);
            this.logger.info("Successfully updated jwks certificates in store!", {host: inst.configuration.hostname, certCount: inst.configuration.jwksCertificates.length});
        }).then(() => {
            this.logger.info("Finished jwks update for oidc instance!", {host: inst.configuration.hostname});
        }).catch((err) => {
            this.logger.error("Error updating jwks store!", {error: err});
        }).finally(() => {
            finished();
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
        return new Promise<JsonObject>(async (res, rej: (err: JwtError) => void) => {
            if (!jwtToken || !jwtToken.match(b64UrlRegexChar + "+\\." + b64UrlRegexChar + "+\\." + b64UrlRegexChar)) {
                rej({error: JwtErrorType.OTHER, reason: "Token is not in JWT format!"});
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
                rej({error: JwtErrorType.OTHER, reason: "Unsupported algorithm used!"});
                return;
            }
        
            const issUrl = new URL(iss);
            if (issUrl.host != inst.configuration.hostname || !issUrl.pathname.startsWith(inst.configuration.oidcRoot)) { // Expected issuer
                rej({error: JwtErrorType.OTHER, reason: "Token issuer does not match expected issuer: " + issUrl});
                return;
            }
        
            // Ensure no update operation on the certificate list is made while we check the token against the certificates.
            await inst.jwksUpdateMutex.waitForUnlock();

            const certificate = inst.getJwksCertificate(x5t);
            if (certificate == undefined) {
                rej({error: JwtErrorType.OTHER, reason: "Unknown certificate used for hashing token!"});
                return;
            }

            jwt.verify(jwtToken, certificate.publicKey, (err, user) => {
                if (err == null) {
                    // Success
                    this.logger.debug("Successfully validated JWT token!", {userSid: user.sid, userEmail: user.email});
                    res(user);
                } else {
                    this.logger.error("Error validating JWT token!", {error: err});
                    if (err.name == 'TokenExpiredError') {
                        rej({error: JwtErrorType.EXPIRED, reason: "Error validating JWT token signature: " + err});
                    } else {
                        rej({error: JwtErrorType.OTHER, reason: "Error validating JWT token signature: " + err});
                    }
                }
            });
        });
    }    
}