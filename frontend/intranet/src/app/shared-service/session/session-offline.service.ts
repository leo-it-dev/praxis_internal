import { Injectable } from '@angular/core';
import { SessionProviderPlugin } from './session-provider-plugin';
import { SessionProviderService, SessionType } from './session-provider.service';

@Injectable({
    providedIn: 'root'
})
export class SessionOfflineService extends SessionProviderPlugin {

    override authorizeSession() {
        let storage = SessionProviderService.instance;
        storage.store.lazyloadUserInfo = {thumbnail: "", vetproofVeterinaryName: "Offline Session"};
        storage.store.accessToken = "-";
        storage.store.idToken = "-";
        storage.store.refreshToken = "-";
        storage.storeSessionInStore(SessionType.OFFLINE);
        storage.store.isLoggedIn = true;
    }

    override exchangeCodeForToken(code: string, state: string): Promise<void> {
        return Promise.reject("not implemented!");
    }

    override unauthorizeSession(reason: string): Promise<void> {
        return new Promise((res, rej) => {
            let storage = SessionProviderService.instance;
            storage.removeUserInformation();
            storage.storeSessionInStore(SessionType.OFFLINE);
            setTimeout((() => { storage.redirectClientToLoginPage(reason) }).bind(this), 100);
            res();
        });
    }

    override getAccessToken(): Promise<string> {
        return Promise.resolve("-");
    }
}