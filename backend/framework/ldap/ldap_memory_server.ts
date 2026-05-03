import * as net from 'net';
import { Socket } from 'node:net';
import * as tls from 'node:tls';
import * as ssl from '../../ssl/ssl';
import { getLogger } from '../../logger';
import * as asn1js from 'asn1js';
import { buildLdapMessage, readLdapMessage } from './messages/ldap_message';
import { BindResponse, buildBindResponse } from './messages/bind_response';
import { LdapResult, LdapResultCode } from './messages/ldap_result';
import { AuthenticationChoiceSasl, AuthenticationChoiceSimple, readBindRequest } from './messages/bind_request';
import { LdapClientHandler } from './ldap_client_handler';
import { LdapStore } from './ldap_store';

let logger = getLogger('ldap-memory-server');

export interface ILdapAuthentication {
    authenticateUser(name: string, authentication: AuthenticationChoiceSimple | AuthenticationChoiceSasl): boolean;
}

export class LdapMemoryServer {

    ldapClients: LdapClientHandler[] = [];

    constructor(port: number, bindingAddress: string, useTLS: boolean, baseDN: string, private authenticationProvider: ILdapAuthentication, private ldapStore: LdapStore) {
        let server: net.Server | tls.Server;

        if (useTLS) {
            server = tls.createServer(ssl.SSL_OPTIONS, socket => this.acceptConnection(socket));
        } else {
            server = net.createServer(socket => this.acceptConnection(socket));
        }

        server.on('error', (err) => {
            if (err["code"] === 'EADDRINUSE') {
                logger.error('Error starting LDAP memory server instance! Address is already in use!');
                setTimeout(() => {
                    server.close();
                    server.listen(port, bindingAddress);
                }, 5000);
            }
        });

        server.on('listening', () => {
            logger.info("Started LDAP memory server instance!", { port: port, address: bindingAddress, useTLS: useTLS, baseDN: baseDN })
        });

        server.listen(port, bindingAddress);
    }

    delegateAuthentication(name: string, authentication: AuthenticationChoiceSimple | AuthenticationChoiceSasl) {
        return this.authenticationProvider.authenticateUser(name, authentication);
    }

    terminate(socket: Socket) {
        if (!socket.closed) {
            socket.end();
        }

        this.ldapClients = this.ldapClients.filter(c => c.getSocket() != socket);
        logger.info("LDAP Client disconnected from memory server!", {address: socket.remoteAddress, connectedCount: this.ldapClients.length});
    }

    acceptConnection(socket: Socket) {
        this.ldapClients.push(new LdapClientHandler(socket, this));
        socket.on('close', _ => this.terminate);
        socket.on('error', _ => this.terminate);
    }

    getLdapStore() {
        return this.ldapStore;
    }
}