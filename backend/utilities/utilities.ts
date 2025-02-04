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

export function parseSimpleDate(dateStr: string): Date {
    let parts = dateStr.split(".");
    if (parts.length !== 3) {
        console.error("Error parsing simple date! Not exactly three parts to date!");
        return new Date(0);
    }
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
}

export function compare(a: number, b: number): number {
    if ( a > b ) {
        return 1;
    }
    if ( b > a ) {
        return -1;
    }
    return 0;
}

export function sum(elements: number[]): number {
    return elements.reduce((last, current) => last + current, 0)
}
export function sumVA(...elements: number[]): number {
    return sum(elements);
}
