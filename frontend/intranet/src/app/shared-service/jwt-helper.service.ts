import { Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class JwtHelperService {
	constructor() { }

	parseJWTtoken(jwtString: string): JwtToken {
		let [header, content, hash] = jwtString.split(".");

		const headerParsed = JSON.parse(atob(header));
		const contentParsed = JSON.parse(atob(content));

		return { header: headerParsed, content: contentParsed, hash: hash };
	}

	/**
	 * Checks if the token is still valid, based on it's exp claim.
	 * @param token to check for validity
	 * @returns true if the token is still valid, false if it is expired or invalid
	 */
	verifyExpirationClaim(token: JwtToken): boolean {
		if ('exp' in token.content) {
			let expirationTimestamp = token.content.exp as number;
			if (new Date().getTime() / 1000 >= expirationTimestamp) {
				return false;
			} else {
				return true;
			}
		} else {
			return false;
		}
	}
}

export type JwtToken = {
	header: object;
	content: object;
	hash: string;
};