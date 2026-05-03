import * as kerberos from 'kerberos';
import * as process from 'process';
import * as config from 'config';
import * as path from 'path';

const servicePrincipalName = config.get('kerberos.SERVICE_PRINCIPAL_NAME') as string;

export function initializeKerberos() {
    process.env.KRB5_KTNAME = path.resolve(__dirname + '/auth/service.keytab');
}

export async function validateKerberosAuthHeader(authHeader: string) {
    if (!authHeader || !authHeader.startsWith('Negotiate ')) {
        throw new Error('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];

    return new Promise((resolve, reject) => {
        kerberos.initializeServer(servicePrincipalName).then(server => {
            server.step(token).then(response => {
                // If successful, user is authenticated
                const username = server.username;

                resolve({
                    username,
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