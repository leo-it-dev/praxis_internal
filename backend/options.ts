export const options = {
    'TOKEN_EXPIRATION_SAFETY_MARGIN_SECONDS_QS': 120,
    'TOKEN_EXPIRATION_SAFETY_MARGIN_SECONDS_ADFS': 120,
    'GATEWAY_ID': '<replace with gateway ID>',
    'USER_ALIAS': '<replace with username>',
    'USER_PASSWORD': '<replace with user password>',
    
    'HOSTNAME_ADFS': '<FQDN of ADFS server>',
    'ADFS_URL_ROOT': '/adfs',
    'ADFS_URL_LOGOUT': '/adfs/oauth2/logout',
    'ADFS_URL_TOKEN': '/adfs/oauth2/token',

    'ADFS_INTRANET_CLIENT_ID': "<replace with relying party's client id>",
    'ADFS_INTRANET_CLIENT_SECRET': "<replace with relying party's client secret>",
    'ADFS_INTRANET_REDIRECT_URL_LOGOUT': "<URL registered as logout redirect in ADFS. Must point to endpoint on this server>",
    'ADFS_INTRANET_REDIRECT_URL_LOGIN': "<URL registered as login redirect in ADFS. Must point to endpoint on this server>",

    'JWKS_UPDATE_INTERVAL_MINUTES': 60,

    'LDAP_USER_DN_BASE': 'CN=Users,DC=<replace>,DC=<replace>',
    'LDAP_LOGIN_USER': 'CN=<replace>,CN=Users,DC=<replace>,DC=<replace>',
    'LDAP_LOGIN_PASS': '<replace with ldap bind users password>',
    'LDAP_URL': 'ldap://<fqdn of ldap server>',

    //'DRUGS_XLSX_URL': "https://www.bvl.bund.de/SharedDocs/Downloads/05_Tierarzneimittel/Liste_der_mitteilungspflichtigen_Arzneimittel.xlsx?__blob=publicationFile",
    'DRUGS_CSV_URL_HIT': 'https://www.hi-tier.de/Entwicklung/Dateibereich/TAM_ARZNX.CSV',
    'DRUGS_CRAWLING_INTERVAL_DAYS': 20, // max of 24?? days, as maximum of setInterval (32-bit signed).
    'QS_API_SYSTEM': 'https://test.vetproof.de/user-rest',
    'QS_DATABASE_CRAWL_UPDATE_INTERVAL_DAYS': 2
};

export const AdfsOicdConfiguration: OidcConfigurationRaw = {
    oidcRoot: '/adfs',
    configurationPath: '/adfs/.well-known/openid-configuration',
    hostname: '<FQDN of OIDC server>'
}