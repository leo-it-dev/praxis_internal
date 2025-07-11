interface OidcConfigurationRaw {
    hostname: string;
    configurationPath: string;
    oidcRoot: string;
}

interface JwksCertificate {
    x5t: string;
    cert: string;
    publicKey: string;
}

interface OidcConfigurationResolved extends OidcConfigurationRaw {
    jwksUrl: URL;
    jwksCertificates: Array<JwksCertificate>;
    logoutUrl: URL;
    tokenEndpointUrl: URL;
}

type JsonObject = {
    [key: string]:any;
};