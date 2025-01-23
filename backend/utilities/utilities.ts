export const b64UrlRegexChar = "[A-Za-z0-9_-]";

export function getSystemTimeZone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function base64urlDecode(base64url: string) {
    // Replace URL-safe characters with Base64 characters
    let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');

    // Add padding characters if needed
    while (base64.length % 4 !== 0) {
        base64 += '=';
    }

    // Decode the Base64 string
    return Buffer.from(base64, 'base64').toString('utf8');
}
