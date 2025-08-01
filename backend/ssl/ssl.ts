import fs = require('node:fs');
import https = require('https');

export let CA_CERT: string = "";
export let ADFS_CERT: string = "";
export let intranetCertificate: string = "";
export let intranetPrivateKey: string = "";

export const SSL_OPTIONS = {
    key: '<uninitialized>',
    cert: '<uninitialized>',
};

export function initSSL() {
    this.CA_CERT = fs.readFileSync(__dirname + '/certs/ca.crt');
    this.ADFS_CERT = fs.readFileSync(__dirname + '/certs/adfs.crt');
    this.intranetCertificate = fs.readFileSync(__dirname + '/certs/internal-praxisnet.crt');
    this.intranetPrivateKey = fs.readFileSync(__dirname + '/certs/internal-praxisnet.key');

    SSL_OPTIONS.key = intranetPrivateKey;
    SSL_OPTIONS.cert = intranetCertificate;
}

export function httpsRequest(hostname: string, path: string, method: string, body: string, contentType?: string, authorization?: string): Promise<{'statusCode': number, 'data': string}> {
    return new Promise<{'statusCode': number, 'data': string}>((res, rej) => {
        console.log("Performing https request: ", hostname, path, method);
        let reqHeaders = {};
        if (contentType) {
            reqHeaders = { 'content-type': contentType };
        }
        if (authorization) {
            reqHeaders = { ...reqHeaders, 'Authorization': authorization };
        }
    
        reqHeaders = {
            ...reqHeaders,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
            "Accept": "application/json",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "same-origin",
            "Pragma": "no-cache",
            "Cache-Control": "no-cache",
            "content-length": body.length
        };
        
        const requ = https.request({
            hostname: hostname,
            path: path,
            method: method,
            headers: reqHeaders,
            cert: ADFS_CERT,
            ca: CA_CERT
        }, (response) => {
            let data = "";
            response.on('data', (chunk) => data += chunk.toString());
            response.on('error', (err) => {
                console.error(err);
                rej(err);
            });
            response.on('end', () => {
                res({'statusCode': response.statusCode, 'data': data});
            });
        });
        requ.write(body);
        requ.end();
    });
}