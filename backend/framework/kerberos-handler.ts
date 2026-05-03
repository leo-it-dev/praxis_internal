import * as kerberos from 'kerberos';
import * as process from 'process';
import * as config from 'config';
import * as path from 'path';

const servicePrincipalName = config.get('kerberos.SERVICE_PRINCIPAL_NAME') as string;

export function initializeKerberos() {
    process.env.KRB5_KTNAME = path.resolve(__dirname + '/auth/service.keytab');
}

export async function validateKerberosTicket(ticket: Uint8Array): Promise<{username: string, responseToken: string}> {
    return new Promise((resolve, reject) => {
        kerberos.initializeServer(servicePrincipalName).then(server => {
            server.step(Buffer.from(ticket).toString('base64')).then(response => {
                // If successful, user is authenticated
                const username = server.username;

                resolve({
                    username: username,
                    responseToken: response // send back if needed
                });
            }).catch(err => {
                reject(err);
            });
        }).catch(err => {
            reject(err);
        });
    });
}